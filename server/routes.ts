import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertTeamSchema, insertSettingsSchema, insertUserSchema } from "@shared/schema";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { AlertGenerator } from "./services/alert-generator";
import { openaiEnhancer } from "./services/openai-alert-enhancer";
import { MLBApiService } from "./services/mlb-api";

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    adminUserId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server with heartbeat
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  // Serve admin static files
  app.use('/admin', express.static('public/admin'));

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

  // Detailed live games endpoint for admin dashboard
  app.get('/api/games/live-detailed', async (req, res) => {
    try {
      const { sport = 'MLB' } = req.query;
      let liveGames = [];
      
      if (sport === 'MLB') {
        // First get basic games data
        const { MLBApiService } = await import('./services/mlb-api');
        const mlbService = new MLBApiService();
        const games = await mlbService.getTodaysGames();
        
        // Filter to only live games and get detailed data
        const liveBasicGames = games.filter(game => game.isLive);
        
        for (const game of liveBasicGames) {
          try {
            // Fetch detailed live feed data from MLB API
            const liveFeedUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gameId}/feed/live`;
            const response = await fetch(liveFeedUrl);
            
            if (response.ok) {
              const liveFeedData = await response.json();
              const gameState = extractDetailedGameState(liveFeedData, game);
              liveGames.push(gameState);
            } else {
              // Fallback to basic game data if detailed feed fails
              liveGames.push(enhanceBasicGameData(game));
            }
          } catch (error) {
            console.error(`Error fetching detailed data for game ${game.gameId}:`, error);
            liveGames.push(enhanceBasicGameData(game));
          }
        }
      }
      
      res.json({ liveGames, sport });
    } catch (error) {
      console.error('Error fetching detailed live games:', error);
      res.status(500).json({ message: 'Failed to fetch detailed live games' });
    }
  });

  // Helper functions for detailed game state extraction
  function extractDetailedGameState(liveFeedData: any, basicGame: any) {
    try {
      const gameData = liveFeedData.gameData || {};
      const liveData = liveFeedData.liveData || {};
      const plays = liveData.plays || {};
      const currentPlay = plays.currentPlay || {};
      
      // Get current game situation
      const linescore = liveData.linescore || {};
      const offense = linescore.offense || {};
      const defense = linescore.defense || {};
      
      // Extract runners
      const runners = {
        first: false,
        second: false,
        third: false
      };
      
      if (offense.first) runners.first = true;
      if (offense.second) runners.second = true;  
      if (offense.third) runners.third = true;
      
      // Get count information
      const count = currentPlay.count || {};
      const balls = count.balls || 0;
      const strikes = count.strikes || 0;
      const outs = linescore.outs || 0;
      
      // Get batter information
      const currentBatter = currentPlay.matchup?.batter || null;
      const batterName = currentBatter ? 
        `${currentBatter.fullName || 'Unknown Batter'}` : 'Unknown Batter';
      
      // Get pitcher information  
      const currentPitcher = currentPlay.matchup?.pitcher || null;
      const pitcherName = currentPitcher ?
        `${currentPitcher.fullName || 'Unknown Pitcher'}` : 'Unknown Pitcher';
      
      // Get venue and weather
      const venue = gameData.venue?.name || basicGame.venue || 'Unknown Venue';
      const weather = gameData.weather || {};
      
      return {
        ...basicGame,
        runners,
        balls,
        strikes, 
        outs,
        currentBatter: {
          name: batterName,
          id: currentBatter?.id || null
        },
        currentPitcher: {
          name: pitcherName,
          id: currentPitcher?.id || null
        },
        venue,
        weather: {
          temp: weather.temp || null,
          condition: weather.condition || null,
          wind: weather.wind || null
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting detailed game state:', error);
      return enhanceBasicGameData(basicGame);
    }
  }

  function enhanceBasicGameData(basicGame: any) {
    return {
      ...basicGame,
      runners: { first: false, second: false, third: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      currentBatter: { name: 'Loading...', id: null },
      currentPitcher: { name: 'Loading...', id: null },
      weather: { temp: null, condition: null, wind: null },
      lastUpdated: new Date().toISOString()
    };
  }

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
      const upperSport = sport.toUpperCase();
      
      // Get user preferences
      const preferences = await storage.getUserAlertPreferencesBySport(userId, upperSport);
      
      // Get global alert settings
      const globalSettings = await storage.getGlobalAlertSettings(upperSport);
      
      // Filter out preferences for globally disabled alerts
      const filteredPreferences = preferences.filter(pref => {
        // If alert is globally disabled, don't show it to the user
        return globalSettings[pref.alertType] !== false;
      });
      
      res.json(filteredPreferences);
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

  // Admin middleware
  async function requireAdmin(req: any, res: any, next: any) {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = await storage.getUserById(req.session.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error('Error in admin middleware:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  }

  // Admin API routes
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/role/:role', requireAdmin, async (req, res) => {
    try {
      const { role } = req.params;
      const users = await storage.getUsersByRole(role);
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({ message: 'Failed to fetch users by role' });
    }
  });

  app.put('/api/admin/users/:userId/role', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!role || !['admin', 'manager', 'analyst', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be admin, manager, analyst, or user' });
      }
      
      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: 'User role updated successfully', user: userWithoutPassword });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  });

  app.get('/api/admin/users/:userId/alert-preferences', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching user alert preferences:', error);
      res.status(500).json({ message: 'Failed to fetch user alert preferences' });
    }
  });

  app.put('/api/admin/users/:userId/alert-preferences', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, preferences } = req.body;
      
      if (!sport || !preferences || !Array.isArray(preferences)) {
        return res.status(400).json({ message: 'Missing required fields: sport, preferences array' });
      }
      
      const result = await storage.bulkSetUserAlertPreferences(userId, sport.toUpperCase(), preferences);
      res.json({ message: 'User alert preferences updated successfully', count: result.length });
    } catch (error) {
      console.error('Error updating user alert preferences:', error);
      res.status(500).json({ message: 'Failed to update user alert preferences' });
    }
  });

  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const adminUsers = await storage.getUsersByRole('admin');
      const managerUsers = await storage.getUsersByRole('manager');
      const analystUsers = await storage.getUsersByRole('analyst');
      const regularUsers = await storage.getUsersByRole('user');
      
      const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
      
      res.json({
        users: {
          total: allUsers.length,
          admins: adminUsers.length,
          managers: managerUsers.length,
          analysts: analystUsers.length,
          regular: regularUsers.length
        },
        alerts: {
          total: parseInt(String(totalAlertsResult.rows[0]?.count || '0')),
          today: parseInt(String(todayAlertsResult.rows[0]?.count || '0'))
        }
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch admin stats' });
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
        let payload: any = {};
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
        totalAlerts: parseInt(String(totalAlertsResult.rows[0]?.count || '0')),
        todayAlerts: parseInt(String(todayAlertsResult.rows[0]?.count || '0')),
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
      res.json({ count: parseInt(String(result.rows[0]?.count || '0')) });
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
  
  // Weather test endpoint  
  app.get('/api/test-weather/:team', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');
      const weather = await weatherService.getWeatherForTeam(req.params.team);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);
      
      res.json({
        team: req.params.team,
        weather,
        analysis: {
          homeRunFactor,
          windDescription: windDesc,
          weatherSource: process.env.OPENWEATHERMAP_API_KEY ? 'Live OpenWeatherMap API' : 'Fallback Data'
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test NCAAF two-minute warning logic
  app.get('/api/test-ncaaf-2min/:time', async (req, res) => {
    try {
      const { AlertGenerator } = await import('./services/alert-generator');
      const generator = new AlertGenerator();
      
      const testTime = req.params.time;
      
      // Test the two-minute detection logic
      const isWithin2Min = (generator as any).isWithinTwoMinutes(testTime);
      
      // Create mock game data
      const mockGame = {
        gameId: 'test-game',
        awayTeam: 'Test Team A',
        homeTeam: 'Test Team B',
        awayScore: 14,
        homeScore: 21,
        timeRemaining: testTime,
        quarter: 4,
        status: 'live',
        isLive: true
      };
      
      res.json({
        inputTime: testTime,
        isWithinTwoMinutes: isWithin2Min,
        mockGame,
        testResults: {
          '1:30': (generator as any).isWithinTwoMinutes('1:30'),
          '2:30': (generator as any).isWithinTwoMinutes('2:30'),
          '0:45': (generator as any).isWithinTwoMinutes('0:45'),
          '3:00': (generator as any).isWithinTwoMinutes('3:00')
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Authentication Routes
  app.post('/api/admin-auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if user is admin
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Verify password
      if (!user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Store admin session
      req.session.adminUserId = user.id;

      res.json({
        message: 'Admin login successful',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/admin-auth/verify', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ authenticated: false });
      }

      const user = await storage.getUserById(req.session.adminUserId);
      if (!user || user.role !== 'admin') {
        req.session.adminUserId = undefined;
        return res.status(401).json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Admin verify error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin-auth/logout', (req, res) => {
    req.session.adminUserId = undefined;
    res.json({ message: 'Admin logout successful' });
  });

  // Global Alert Management Endpoints
  app.get('/api/admin/global-alert-settings/:sport', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport } = req.params;
      
      // Get settings from database
      const dbSettings = await storage.getGlobalAlertSettings(sport);
      
      // Default settings for all alerts (if not in database, they're enabled by default)
      const defaultSettings = {
        // MLB alerts - all enabled by default
        // Probability Engine Alerts (enabled by default)
        'RISP_CHANCE': true,
        'SCORING_PROBABILITY': true,
        'CLOSE_GAME_LATE': true,
        'LATE_PRESSURE': true,
        'NINTH_TIE': true,
        // Weather & Power Alerts (enabled by default)
        'WIND_JETSTREAM': true,
        'HR_HITTER_AT_BAT': true,
        // Legacy Alerts (kept for backward compatibility)
        'RISP': true,
        'BASES_LOADED': true,
        'RUNNERS_1ST_2ND': true,
        'CLOSE_GAME': true,
        'CLOSE_GAME_LIVE': true,
        'HOME_RUN_LIVE': true,
        'HIGH_SCORING': true,
        'SHUTOUT': true,
        'BLOWOUT': true,
        'FULL_COUNT': true,
        // NFL alerts
        'RED_ZONE': true,
        'FOURTH_DOWN': true,
        'TWO_MINUTE_WARNING': true,
        // NBA alerts
        'CLUTCH_TIME': true,
        'OVERTIME': true,
        // NHL alerts
        'POWER_PLAY': true,
        'EMPTY_NET': true
      };

      // Merge database settings with defaults
      const mergedSettings = { ...defaultSettings, ...dbSettings };
      
      res.json(mergedSettings);
    } catch (error) {
      console.error('Error fetching global alert settings:', error);
      res.status(500).json({ message: 'Failed to fetch global alert settings' });
    }
  });

  app.put('/api/admin/master-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { enabled } = req.body;
      
      // In a full implementation, this would update a global master switch in the database
      // For now, we'll just acknowledge the request
      console.log(`Master alerts ${enabled ? 'enabled' : 'disabled'} by admin`);
      
      res.json({ 
        message: `Master alerts ${enabled ? 'enabled' : 'disabled'} successfully`,
        enabled 
      });
    } catch (error) {
      console.error('Error updating master alerts:', error);
      res.status(500).json({ message: 'Failed to update master alerts' });
    }
  });

  app.put('/api/admin/global-alert-category', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport, category, alertKeys, enabled } = req.body;
      
      // Update each alert in the category
      for (const alertKey of alertKeys) {
        await storage.setGlobalAlertSetting(sport, alertKey, enabled, req.session.adminUserId);
      }
      
      console.log(`Category '${category}' for ${sport} ${enabled ? 'enabled' : 'disabled'} by admin`);
      console.log('Alert keys affected:', alertKeys);
      
      res.json({ 
        message: `Category ${enabled ? 'enabled' : 'disabled'} successfully`,
        sport,
        category,
        alertKeys,
        enabled 
      });
    } catch (error) {
      console.error('Error updating category settings:', error);
      res.status(500).json({ message: 'Failed to update category settings' });
    }
  });

  app.put('/api/admin/global-alert-setting', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport, alertType, enabled } = req.body;
      
      // Update in database
      await storage.setGlobalAlertSetting(sport, alertType, enabled, req.session.adminUserId);
      
      console.log(`Alert '${alertType}' for ${sport} ${enabled ? 'enabled' : 'disabled'} by admin`);
      
      res.json({ 
        message: `Alert ${enabled ? 'enabled' : 'disabled'} globally`,
        sport,
        alertType,
        enabled 
      });
    } catch (error) {
      console.error('Error updating alert setting:', error);
      res.status(500).json({ message: 'Failed to update alert setting' });
    }
  });

  app.post('/api/admin/apply-global-settings', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport, settings } = req.body;
      
      // Get all users
      const users = await storage.getAllUsers();
      let updatedCount = 0;
      
      // Apply settings to each user
      for (const user of users) {
        try {
          // Convert settings to the format expected by updateUserAlertPreferences
          const preferences = Object.entries(settings).map(([alertType, enabled]) => ({
            alertType,
            enabled: enabled === true
          }));
          
          await storage.updateUserAlertPreferences(user.id, sport.toLowerCase(), preferences);
          updatedCount++;
        } catch (userError) {
          console.error(`Failed to update settings for user ${user.id}:`, userError);
        }
      }
      
      console.log(`Applied global ${sport} alert settings to ${updatedCount} users by admin`);
      
      res.json({ 
        message: `Global settings applied to ${updatedCount} users successfully`,
        sport,
        usersUpdated: updatedCount,
        totalUsers: users.length
      });
    } catch (error) {
      console.error('Error applying global settings:', error);
      res.status(500).json({ message: 'Failed to apply global settings' });
    }
  });

  // System Configuration Admin Routes
  app.get('/api/admin/system-config', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const configurations = await storage.getAllSystemConfigurations();
      
      // Organize by category for easier frontend consumption
      const organized: Record<string, Record<string, any>> = {};
      for (const config of configurations) {
        if (!organized[config.category]) {
          organized[config.category] = {};
        }
        let parsedValue;
        try {
          parsedValue = JSON.parse(config.value as string);
        } catch (jsonError) {
          // Handle malformed JSON by treating as string
          console.warn(`Invalid JSON for ${config.category}.${config.key}:`, config.value);
          parsedValue = config.value;
        }
        organized[config.category][config.key] = {
          value: parsedValue,
          description: config.description,
          updatedAt: config.updatedAt
        };
      }
      
      res.json(organized);
    } catch (error) {
      console.error('Error fetching system configuration:', error);
      res.status(500).json({ message: 'Failed to fetch system configuration' });
    }
  });

  app.get('/api/admin/system-config/:category', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { category } = req.params;
      const configurations = await storage.getSystemConfigurationsByCategory(category);
      
      const result: Record<string, any> = {};
      for (const config of configurations) {
        let parsedValue;
        try {
          parsedValue = JSON.parse(config.value as string);
        } catch (jsonError) {
          // Handle malformed JSON by treating as string
          console.warn(`Invalid JSON for ${config.category}.${config.key}:`, config.value);
          parsedValue = config.value;
        }
        result[config.key] = {
          value: parsedValue,
          description: config.description,
          updatedAt: config.updatedAt
        };
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching system configuration by category:', error);
      res.status(500).json({ message: 'Failed to fetch system configuration' });
    }
  });

  app.put('/api/admin/system-config', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { category, key, value, description } = req.body;
      
      if (!category || !key || value === undefined) {
        return res.status(400).json({ message: 'Category, key, and value are required' });
      }

      const result = await storage.setSystemConfiguration(
        category, 
        key, 
        value, 
        description,
        req.session.adminUserId
      );
      
      console.log(`System config updated: ${category}.${key} = ${JSON.stringify(value)} by admin`);
      
      let parsedValue;
      try {
        parsedValue = JSON.parse(result.value as string);
      } catch (jsonError) {
        parsedValue = result.value;
      }
      
      res.json({
        message: 'Configuration updated successfully',
        configuration: {
          ...result,
          value: parsedValue
        }
      });
    } catch (error) {
      console.error('Error updating system configuration:', error);
      res.status(500).json({ message: 'Failed to update system configuration' });
    }
  });

  app.put('/api/admin/system-config/bulk', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { configurations } = req.body;
      
      if (!Array.isArray(configurations)) {
        return res.status(400).json({ message: 'Configurations must be an array' });
      }

      const results = await storage.bulkSetSystemConfiguration(configurations, req.session.adminUserId);
      
      console.log(`Bulk system configuration update: ${configurations.length} settings by admin`);
      
      res.json({
        message: `${configurations.length} configurations updated successfully`,
        results: results.map(r => {
          let parsedValue;
          try {
            parsedValue = JSON.parse(r.value as string);
          } catch (jsonError) {
            parsedValue = r.value;
          }
          return {
            ...r,
            value: parsedValue
          };
        })
      });
    } catch (error) {
      console.error('Error bulk updating system configuration:', error);
      res.status(500).json({ message: 'Failed to bulk update system configuration' });
    }
  });

  // Specific system status endpoints for easy access
  app.get('/api/system-status', async (req, res) => {
    try {
      const masterToggle = await storage.getSystemConfigValue('core', 'master_toggle', true);
      const maintenanceMode = await storage.getSystemConfigValue('core', 'maintenance_mode', false);
      const maintenanceMessage = await storage.getSystemConfigValue('core', 'maintenance_message', 'System is under maintenance');
      const systemAnnouncement = await storage.getSystemConfigValue('core', 'system_announcement', '');
      const announcementEnabled = await storage.getSystemConfigValue('core', 'announcement_enabled', false);
      
      res.json({
        masterToggle,
        maintenanceMode,
        maintenanceMessage,
        systemAnnouncement: announcementEnabled ? systemAnnouncement : null
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({ message: 'Failed to fetch system status' });
    }
  });


  // Generate alerts from today's completed games
  const alertGenerator = new AlertGenerator();
  alertGenerator.generateAlertsFromCompletedGames().catch(console.error);

  // Start live game monitoring every 15 seconds for real-time alerts + OpenAI monitoring
  setInterval(async () => {
    try {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
      await alertGenerator.generateLiveGameAlerts();
      
      // STEP 4: Check for OpenAI live alert updates
      try {
        const currentGameStates = new Map();
        const mlbApi = new MLBApiService();
        const allGames = await mlbApi.getTodaysGames();
        const liveGames = allGames.filter(game => game.isLive);
        
        for (const game of liveGames) {
          currentGameStates.set(game.gameId.toString(), game);
        }
        
        const updatedAlerts = await openaiEnhancer.monitorLiveAlerts(currentGameStates);
        
        if (updatedAlerts.length > 0) {
          console.log(`🤖 OpenAI generated ${updatedAlerts.length} alert updates`);
          
          // Save updated alerts to database
          for (const alert of updatedAlerts) {
            try {
              await db.execute(sql`
                INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
                VALUES (gen_random_uuid(), ${alert.alertKey}, ${alert.sport}, ${alert.gameId}, 
                        ${alert.type}, ${alert.state}, ${alert.score}, ${JSON.stringify(alert.payload)}, NOW())
              `);
            } catch (saveError) {
              console.error('Failed to save updated alert:', saveError);
            }
          }
        }
      } catch (aiError) {
        console.error('OpenAI monitoring error:', aiError);
      }
    } catch (error) {
      console.error('Error in live monitoring:', error);
    }
  }, 15000); // Check every 15 seconds for real-time updates

  return httpServer;
}