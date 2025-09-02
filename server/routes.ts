import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertTeamSchema, insertSettingsSchema, insertUserSchema } from "@shared/schema";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { AlertGenerator } from "./services/alert-generator";

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server with heartbeat
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  function heartbeat(this: any) { 
    this.isAlive = true; 
  }

  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('pong', heartbeat);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Heartbeat interval to detect zombie connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Ensure cleanup on server shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Server shutting down, cleaning up intervals...');
    clearInterval(heartbeatInterval);
    process.exit(0);
  });

  // Broadcast function with backpressure handling
  function broadcast(data: any) {
    const payload = JSON.stringify(data);
    clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1_000_000) {
        client.send(payload);
      }
    });
  }

  // Basic health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Teams routes
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.get('/api/teams/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      const teams = await storage.getTeamsBySport(sport);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams by sport:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.post('/api/teams', async (req, res) => {
    try {
      const team = await storage.createTeam(req.body);
      res.json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ message: 'Failed to create team' });
    }
  });

  app.put('/api/teams/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const team = await storage.updateTeam(id, req.body);
      res.json(team);
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ message: 'Failed to update team' });
    }
  });

  app.delete('/api/teams/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTeam(id);
      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ message: 'Failed to delete team' });
    }
  });

  // Games routes
  app.get('/api/games/today', async (req, res) => {
    try {
      const { sport = 'MLB', date } = req.query;
      let games = [];
      
      switch(sport) {
        case 'MLB':
          const { MLBApiService } = await import('./services/mlb-api');
          const mlbService = new MLBApiService();
          games = await mlbService.getTodaysGames(date as string);
          break;
          
        case 'NFL':
          const { NFLApiService } = await import('./services/nfl-api');
          const nflService = new NFLApiService();
          games = await nflService.getTodaysGames(date as string);
          break;
          
        case 'NBA':
          const { NBAApiService } = await import('./services/nba-api');
          const nbaService = new NBAApiService();
          games = await nbaService.getTodaysGames(date as string);
          break;
          
        case 'NHL':
          const { NHLApiService } = await import('./services/nhl-api');
          const nhlService = new NHLApiService();
          games = await nhlService.getTodaysGames(date as string);
          break;
          
        case 'CFL':
          const { CFLApiService } = await import('./services/cfl-api');
          const cflService = new CFLApiService();
          games = await cflService.getTodaysGames(date as string);
          break;
          
        case 'NCAAF':
          const { NCAAFApiService } = await import('./services/ncaaf-api');
          const ncaafService = new NCAAFApiService();
          games = await ncaafService.getTodaysGames(date as string);
          break;
          
        default:
          games = [];
      }
      
      const { getPacificDate } = await import('./utils/timezone');
      res.json({ games, date: date || getPacificDate() });
    } catch (error) {
      console.error('Error fetching games:', error);
      res.status(500).json({ message: 'Failed to fetch games' });
    }
  });

  // User monitored games routes
  app.get('/api/user/:userId/monitored-games', async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport } = req.query;
      const games = await storage.getUserMonitoredGames(userId);
      res.json(games);
    } catch (error) {
      console.error('Error fetching monitored games:', error);
      res.status(500).json({ message: 'Failed to fetch monitored games' });
    }
  });

  app.post('/api/user/:userId/monitored-games', async (req, res) => {
    try {
      const { userId } = req.params;
      const { gameId, sport, homeTeamName, awayTeamName } = req.body;
      
      const gameData = {
        userId,
        gameId,
        sport: sport || 'MLB',
        homeTeamName: homeTeamName || '',
        awayTeamName: awayTeamName || '',
        createdAt: new Date()
      };
      
      await storage.addUserMonitoredGame(gameData);
      res.json({ message: 'Game monitoring enabled' });
    } catch (error) {
      console.error('Error adding monitored game:', error);
      res.status(500).json({ message: 'Failed to enable game monitoring' });
    }
  });

  app.delete('/api/user/:userId/monitored-games/:gameId', async (req, res) => {
    try {
      const { userId, gameId } = req.params;
      await storage.removeUserMonitoredGame(userId, gameId);
      res.json({ message: 'Game monitoring disabled' });
    } catch (error) {
      console.error('Error removing monitored game:', error);
      res.status(500).json({ message: 'Failed to disable game monitoring' });
    }
  });

  // Settings routes
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const settings = await storage.upsertSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({ message: 'Failed to save settings' });
    }
  });

  // User alert preferences routes
  app.get('/api/user/:userId/alert-preferences', async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences:', error);
      res.status(500).json({ message: 'Failed to fetch alert preferences' });
    }
  });

  app.get('/api/user/:userId/alert-preferences/:sport', async (req, res) => {
    try {
      const { userId, sport } = req.params;
      const preferences = await storage.getUserAlertPreferencesBySport(userId, sport.toUpperCase());
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences for sport:', error);
      res.status(500).json({ message: 'Failed to fetch sport alert preferences' });
    }
  });

  app.post('/api/user/:userId/alert-preferences', async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, alertType, enabled } = req.body;
      
      if (!sport || !alertType || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: sport, alertType, enabled' });
      }
      
      const preference = await storage.setUserAlertPreference(userId, sport.toUpperCase(), alertType, enabled);
      res.json(preference);
    } catch (error) {
      console.error('Error setting alert preference:', error);
      res.status(500).json({ message: 'Failed to set alert preference' });
    }
  });

  app.post('/api/user/:userId/alert-preferences/bulk', async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, preferences } = req.body;
      
      if (!sport || !preferences || !Array.isArray(preferences)) {
        return res.status(400).json({ message: 'Missing required fields: sport, preferences array' });
      }
      
      const result = await storage.bulkSetUserAlertPreferences(userId, sport.toUpperCase(), preferences);
      res.json({ message: 'Alert preferences updated successfully', count: result.length });
    } catch (error) {
      console.error('Error setting bulk alert preferences:', error);
      res.status(500).json({ message: 'Failed to set bulk alert preferences' });
    }
  });

  // Authentication routes
  app.get('/api/auth/user', async (req, res) => {
    try {
      if (req.session?.userId) {
        const user = await storage.getUserById(req.session.userId);
        if (user) {
          // Return user data without sensitive fields
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        }
      }
      res.status(401).json({ message: 'Not authenticated' });
    } catch (error) {
      console.error('Error checking authentication:', error);
      res.status(500).json({ message: 'Authentication check failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Find user by username or email
      let user = await storage.getUserByUsername(usernameOrEmail);
      if (!user) {
        user = await storage.getUserByEmail(usernameOrEmail);
      }
      
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Create session
      req.session.userId = user.id;
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ message: 'Login successful', user: userWithoutPassword });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      
      // Check if user already exists
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(409).json({ message: 'Email already exists' });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        authMethod: 'local',
        role: 'user'
      });
      
      // Create session
      req.session.userId = newUser.id;
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json({ message: 'Account created successfully', user: userWithoutPassword });
    } catch (error) {
      console.error('Error during signup:', error);
      res.status(500).json({ message: 'Signup failed' });
    }
  });

  // User routes (basic)
  app.get('/api/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Telegram settings routes
  app.get('/api/user/:userId/telegram', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        telegramEnabled: user.telegramEnabled,
        telegramBotToken: user.telegramBotToken ? '***' : '',
        telegramChatId: user.telegramChatId || ''
      });
    } catch (error) {
      console.error('Error fetching telegram settings:', error);
      res.status(500).json({ message: 'Failed to fetch telegram settings' });
    }
  });

  app.post('/api/user/:userId/telegram', async (req, res) => {
    try {
      const { userId } = req.params;
      const { botToken, chatId, enabled } = req.body;
      
      await storage.updateUserTelegramSettings(userId, botToken, chatId, enabled);
      res.json({ message: 'Telegram settings updated successfully' });
    } catch (error) {
      console.error('Error updating telegram settings:', error);
      res.status(500).json({ message: 'Failed to update telegram settings' });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      
      if (!botToken || !chatId) {
        return res.status(400).json({ message: 'Bot token and chat ID are required' });
      }

      const config: TelegramConfig = { botToken, chatId };
      const result = await testTelegramConnection(config);
      
      res.json(result);
    } catch (error) {
      console.error('Error testing telegram connection:', error);
      res.status(500).json({ message: 'Failed to test telegram connection' });
    }
  });

  // Alerts routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get real alerts from database
      const result = await db.execute(sql`
        SELECT id, type, game_id, sport, score, payload, created_at 
        FROM alerts 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `);
      
      const alerts = result.rows.map(row => {
        let payload = {};
        try {
          // The payload is already a JSON object, not a string
          payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        } catch (e) {
          console.error('Error parsing payload:', e);
          payload = {};
        }
        
        return {
          id: row.id,
          type: row.type,
          message: payload.message || payload.situation || `${row.type} alert for game ${row.game_id}`,
          gameId: row.game_id,
          sport: row.sport || 'MLB',
          homeTeam: payload.context?.homeTeam || 'Home Team',
          awayTeam: payload.context?.awayTeam || 'Away Team',
          homeScore: payload.context?.homeScore,
          awayScore: payload.context?.awayScore,
          confidence: row.score || 85,
          priority: row.score || 80,
          createdAt: row.created_at,
          // Add context data for footer
          context: payload.context || {},
          inning: payload.context?.inning,
          isTopInning: payload.context?.isTopInning,
          outs: payload.context?.outs,
          balls: payload.context?.balls,
          strikes: payload.context?.strikes,
          hasFirst: payload.context?.first || payload.context?.hasFirst,
          hasSecond: payload.context?.second || payload.context?.hasSecond,
          hasThird: payload.context?.third || payload.context?.hasThird
        };
      });
      
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.get('/api/alerts/stats', async (req, res) => {
    try {
      // Use direct SQL counts for better performance and reliability
      const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
      const monitoredGames = await storage.getAllMonitoredGames();
      
      const stats = {
        totalAlerts: parseInt(totalAlertsResult.rows[0]?.count || '0'),
        todayAlerts: parseInt(todayAlertsResult.rows[0]?.count || '0'),
        liveGames: 6, // This would need live games API integration
        monitoredGames: monitoredGames.length
      };
      res.json(stats);
    } catch (error) {
      console.error('Error fetching alert stats:', error);
      res.status(500).json({ message: 'Failed to fetch alert stats' });
    }
  });

  app.get('/api/alerts/count', async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      res.json({ count: parseInt(result.rows[0]?.count || '0') });
    } catch (error) {
      console.error('Error counting alerts:', error);
      res.status(500).json({ message: 'Failed to count alerts' });
    }
  });

  // Show timezone info on startup
  const { formatPacificTime, getPacificDate } = await import('./utils/timezone');
  console.log('🌴 ChirpBot V2 - Using Pacific Timezone (PST/PDT)');
  console.log(`📅 Current Pacific Date: ${getPacificDate()}`);
  console.log(`🕐 Current Pacific Time: ${formatPacificTime()}`);
  
  // Generate alerts from today's completed games
  const alertGenerator = new AlertGenerator();
  alertGenerator.generateAlertsFromCompletedGames().catch(console.error);

  // Start live game monitoring every 15 seconds for real-time alerts
  setInterval(async () => {
    try {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
      await alertGenerator.generateLiveGameAlerts();
    } catch (error) {
      console.error('Error in live monitoring:', error);
    }
  }, 15000); // Check every 15 seconds for real-time updates

  return httpServer;
}