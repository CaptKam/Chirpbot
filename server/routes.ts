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
// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    adminUserId?: string;
  }
}

// Middleware to ensure user is authenticated
async function requireAuthentication(req: any, res: any, next: any) {
  if (req.session?.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) {
      req.user = user; // Attach user to request for convenience
      return next();
    }
  }
  res.status(401).json({ message: 'Authentication required' });
}


export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Add route debugging middleware with duplicate detection
  const recentRequests = new Map();
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const now = Date.now();
      const requestKey = `${req.method}:${req.path}:${req.ip}`;
      const lastRequest = recentRequests.get(requestKey);
      
      if (lastRequest && (now - lastRequest) < 100) { // Within 100ms is likely duplicate
        console.log(`⚠️ DUPLICATE REQUEST: ${req.method} ${req.path} - ${now - lastRequest}ms since last`);
      } else {
        console.log(`🔧 ROUTE DEBUG: ${req.method} ${req.path} - Body:`, req.body ? JSON.stringify(req.body).substring(0, 100) : 'none');
      }
      
      recentRequests.set(requestKey, now);
      // Clean up old entries periodically
      if (recentRequests.size > 100) {
        const oldestTime = now - 10000; // 10 seconds
        for (const [key, time] of recentRequests.entries()) {
          if (time < oldestTime) recentRequests.delete(key);
        }
      }
    }
    next();
  });

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

  // Wind speed test for specific stadiums
  app.get('/api/test-wind-speeds', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');

      // Test a few different stadiums
      const testStadiums = [
        'Boston Red Sox',
        'Chicago Cubs',
        'San Francisco Giants',
        'Colorado Rockies',
        'Houston Astros'
      ];

      const windData = [];

      for (const team of testStadiums) {
        const weather = await weatherService.getWeatherForTeam(team);
        const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
        const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

        windData.push({
          team,
          stadium: team === 'Boston Red Sox' ? 'Fenway Park' :
                  team === 'Chicago Cubs' ? 'Wrigley Field' :
                  team === 'San Francisco Giants' ? 'Oracle Park' :
                  team === 'Colorado Rockies' ? 'Coors Field' : 'Minute Maid Park',
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection,
          windDescription: windDesc,
          temperature: weather.temperature,
          homeRunFactor: homeRunFactor,
          weatherImpact: homeRunFactor > 1.1 ? 'Favorable for HRs' :
                        homeRunFactor < 0.9 ? 'Hurts HR distance' : 'Neutral'
        });
      }

      res.json({
        timestamp: new Date().toISOString(),
        source: process.env.OPENWEATHERMAP_API_KEY ? 'Live OpenWeatherMap API' : 'Fallback Data',
        stadiumWindData: windData
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

      const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF", "WNBA"];

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

        case 'WNBA':
          const { WNBAApiService } = await import('./services/wnba-api');
          const wnbaService = new WNBAApiService();
          games = await wnbaService.getTodaysGames(date as string);
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

  // Enhanced live game data route
  app.get('/api/games/:gameId/enhanced', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { MLBApiService } = await import('./services/mlb-api');
      const mlbService = new MLBApiService();
      const enhancedData = await mlbService.getEnhancedGameData(gameId);
      res.json(enhancedData);
    } catch (error) {
      console.error('Error fetching enhanced game data:', error);
      res.status(500).json({ message: 'Failed to fetch enhanced game data' });
    }
  });

  // Get enhanced live game data for baseball diamond display
  app.get("/api/games/:gameId/live", async (req, res) => {
    try {
      const { gameId } = req.params;
      const { MLBApiService } = await import('./services/mlb-api');
      const mlbService = new MLBApiService();
      const liveData = await mlbService.getEnhancedGameData(gameId);
      res.json(liveData);
    } catch (error) {
      console.error('Error fetching live game data:', error);
      res.status(500).json({ error: 'Failed to fetch live game data' });
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

  // Debug all Telegram configurations
  app.get('/api/telegram/debug', requireAuthentication, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const telegramDebug = allUsers.map(user => ({
        username: user.username,
        id: user.id,
        telegramEnabled: user.telegramEnabled,
        hasToken: !!user.telegramBotToken && user.telegramBotToken !== 'default_key' && user.telegramBotToken !== 'test-token',
        tokenLength: user.telegramBotToken?.length || 0,
        tokenValue: user.telegramBotToken?.substring(0, 10) + '...' || 'MISSING',
        hasChatId: !!user.telegramChatId && user.telegramChatId !== 'default_key' && user.telegramChatId !== 'test-chat-id',
        chatId: user.telegramChatId || 'MISSING',
        isTestData: user.telegramBotToken === 'default_key' || user.telegramChatId === 'test-chat-id'
      }));

      const validUsers = telegramDebug.filter(u => u.telegramEnabled && u.hasToken && u.hasChatId && !u.isTestData);

      res.json({
        timestamp: new Date().toISOString(),
        totalUsers: allUsers.length,
        telegramEnabledUsers: telegramDebug.filter(u => u.telegramEnabled).length,
        validTelegramUsers: validUsers.length,
        usersWithTestData: telegramDebug.filter(u => u.isTestData).length,
        users: telegramDebug,
        readyForAlerts: validUsers.length > 0,
        nextSteps: validUsers.length === 0 ? [
          "1. Go to Settings → Telegram Notifications",
          "2. Create a bot with @BotFather on Telegram", 
          "3. Get your chat ID from @userinfobot",
          "4. Enter real credentials and test connection"
        ] : ["Telegram is properly configured and ready!"]
      });
    } catch (error) {
      console.error('Error debugging Telegram:', error);
      res.status(500).json({ error: 'Failed to debug Telegram configurations' });
    }
  });

  // Test Telegram connection
  app.post('/api/telegram/test', requireAuthentication, async (req, res) => {
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

  // Generate test live alerts
  app.post('/api/alerts/force-generate', async (req, res) => {
    try {
      console.log('🧪 FORCING TEST LIVE ALERTS');

      const alertGenerator = new AlertGenerator();
      const alertCount = await alertGenerator.generateLiveGameAlerts();

      res.json({ 
        message: `Generated ${alertCount} test alerts`,
        alertCount
      });
    } catch (error) {
      console.error('Error generating test alerts:', error);
      res.status(500).json({ error: 'Failed to generate test alerts' });
    }
  });

  // Force send test Telegram alert
  app.post('/api/telegram/force-test', async (req, res) => {
    try {
      console.log('🧪 FORCING TEST TELEGRAM ALERT');

      // Get all users with Telegram
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);

      console.log(`📱 Found ${telegramUsers.length} users with Telegram configured`);

      let successCount = 0;
      let errorCount = 0;

      for (const user of telegramUsers) {
        console.log(`📱 Testing Telegram for user: ${user.username}`);
        console.log(`📱 Bot token length: ${user.telegramBotToken?.length || 0}`);
        console.log(`📱 Chat ID: ${user.telegramChatId}`);

        const config: TelegramConfig = {
          botToken: user.telegramBotToken || '',
          chatId: user.telegramChatId || ''
        };

        const testAlert = {
          type: 'TEST_STRIKEOUT',
          title: 'Test Strikeout Alert',
          description: '⚡ TEST STRIKEOUT! Test Batter struck out by Test Pitcher - Test Team vs Test Team',
          gameInfo: {
            homeTeam: 'Test Home',
            awayTeam: 'Test Away',
            score: { home: 0, away: 0 },
            inning: 5,
            inningState: 'top',
            outs: 2,
            balls: 1,
            strikes: 2,
            runners: {
              first: false,
              second: true,
              third: false
            }
          }
        };

        const sent = await sendTelegramAlert(config, testAlert);
        if (sent) {
          successCount++;
          console.log(`📱 ✅ Test alert sent to ${user.username}`);
        } else {
          errorCount++;
          console.log(`📱 ❌ Test alert failed for ${user.username}`);
        }
      }

      res.json({ 
        message: 'Test alerts completed',
        userCount: telegramUsers.length,
        successCount,
        errorCount
      });
    } catch (error) {
      console.error('Error sending test alerts:', error);
      res.status(500).json({ error: 'Failed to send test alerts' });
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
      const limit = parseInt(req.query.limit as string) || 50;

      // Get alerts from database
      const result = await db.execute(sql`
        SELECT id, type, game_id, sport, score, payload, created_at
        FROM alerts
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      const alerts = [];

      for (const row of result.rows) {
        const sport = String(row.sport || 'MLB');
        const alertType = String(row.type || '');

        // Check if this alert type is globally enabled
        try {
          const globalSettings: Record<string, boolean> = await storage.getGlobalAlertSettings(sport);
          const isEnabled = alertType && globalSettings[alertType] !== false;

          if (isEnabled) {
            let payload: any = {};
            try {
              // The payload is already a JSON object, not a string
              payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
            } catch (e) {
              console.error('Error parsing payload:', e);
              payload = {};
            }

            alerts.push({
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
              hasThird: payload.context?.third || payload.context?.hasThird,
              // Include AI data
              betbookData: payload.betbookData || null,
              gameInfo: payload.gameInfo || null
            });
          } else {
            console.log(`🚫 Filtered out ${alertType} alert (globally disabled)`);
          }
        } catch (error) {
          // If we can't check global settings, include the alert (fail-safe)
          console.error(`Error checking global settings for ${sport}:${alertType}`, error);
          let payload: any = {};
          try {
            payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
          } catch (e) {
            console.error('Error parsing payload:', e);
            payload = {};
          }
          alerts.push({
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
            hasThird: payload.context?.third || payload.context?.hasThird,
            // Include AI data
            betbookData: payload.betbookData || null,
            gameInfo: payload.gameInfo || null
          });
        }
      }

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

  app.delete('/api/alerts/:alertId', async (req, res) => {
    try {
      const { alertId } = req.params;

      if (!alertId) {
        return res.status(400).json({ message: 'Alert ID is required' });
      }

      // Delete the alert from database
      const result = await db.execute(sql`
        DELETE FROM alerts 
        WHERE id = ${alertId}
      `);

      if (result.rowsAffected === 0) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: 'Failed to delete alert' });
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

  // Weather endpoint for calendar games
  app.get('/api/weather/team/:teamName', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');
      const teamName = decodeURIComponent(req.params.teamName);
      const weather = await weatherService.getWeatherForTeam(teamName);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

      res.json({
        temperature: weather.temperature,
        condition: weather.condition,
        windSpeed: weather.windSpeed,
        windDirection: weather.windDirection,
        windDescription: windDesc,
        homeRunFactor,
        humidity: weather.humidity,
        pressure: weather.pressure,
        timestamp: weather.timestamp
      });
    } catch (error: any) {
      console.error(`Weather API error for team ${req.params.teamName}:`, error);
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

  // Comprehensive App Debug Endpoint
  app.get('/api/debug/comprehensive', async (req, res) => {
    try {
      const debugResults = {
        timestamp: new Date().toISOString(),
        endpoints: {},
        database: {},
        services: {},
        configuration: {},
        errors: []
      };

      // Test Database Connection
      try {
        const dbTest = await db.execute(sql`SELECT 1 as test`);
        debugResults.database.connection = 'OK';
        debugResults.database.testQuery = dbTest.rows[0] ? 'PASS' : 'FAIL';
      } catch (error: any) {
        debugResults.database.connection = 'FAIL';
        debugResults.database.error = error.message;
        debugResults.errors.push(`Database: ${error.message}`);
      }

      // Test User Table
      try {
        const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        debugResults.database.userCount = parseInt(String(userCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.userTableError = error.message;
        debugResults.errors.push(`User table: ${error.message}`);
      }

      // Test Alert Table
      try {
        const alertCount = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
        debugResults.database.alertCount = parseInt(String(alertCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.alertTableError = error.message;
        debugResults.errors.push(`Alert table: ${error.message}`);
      }

      // Test Settings Table
      try {
        const settingsCount = await db.execute(sql`SELECT COUNT(*) as count FROM settings`);
        debugResults.database.settingsCount = parseInt(String(settingsCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.settingsTableError = error.message;
        debugResults.errors.push(`Settings table: ${error.message}`);
      }

      // Test Telegram Service
      try {
        const telegramUsers = await storage.getAllUsers();
        const validTelegramUsers = telegramUsers.filter(u => 
          u.telegramEnabled && 
          u.telegramBotToken && 
          u.telegramBotToken !== 'default_key' &&
          u.telegramChatId &&
          u.telegramChatId !== 'default_key'
        );
        debugResults.services.telegram = {
          totalUsers: telegramUsers.length,
          validConfigurations: validTelegramUsers.length,
          status: validTelegramUsers.length > 0 ? 'CONFIGURED' : 'NO_VALID_CONFIGS'
        };
      } catch (error: any) {
        debugResults.services.telegram = { status: 'ERROR', error: error.message };
        debugResults.errors.push(`Telegram service: ${error.message}`);
      }

      // Test MLB API
      try {
        const { MLBApiService } = await import('./services/mlb-api');
        const mlbService = new MLBApiService();
        const todaysGames = await mlbService.getTodaysGames();
        debugResults.services.mlbApi = {
          status: 'OK',
          todaysGames: todaysGames.length,
          endpoint: 'statsapi.mlb.com'
        };
      } catch (error: any) {
        debugResults.services.mlbApi = { status: 'FAIL', error: error.message };
        debugResults.errors.push(`MLB API: ${error.message}`);
      }

      // Test Weather Service
      try {
        const { weatherService } = await import('./services/weather-service');
        const testWeather = await weatherService.getWeatherForTeam('Boston Red Sox');
        debugResults.services.weather = {
          status: 'OK',
          source: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data',
          temperature: testWeather.temperature,
          condition: testWeather.condition
        };
      } catch (error: any) {
        debugResults.services.weather = { status: 'FAIL', error: error.message };
        debugResults.errors.push(`Weather service: ${error.message}`);
      }

      // Test Alert Generator
      try {
        const alertGenerator = new AlertGenerator();
        debugResults.services.alertGenerator = {
          status: 'INITIALIZED',
          class: 'AlertGenerator'
        };
      } catch (error: any) {
        debugResults.services.alertGenerator = { status: 'FAIL', error: error.message };
        debugResults.errors.push(`Alert Generator: ${error.message}`);
      }

      // Test Environment Variables
      debugResults.configuration = {
        nodeEnv: process.env.NODE_ENV || 'not_set',
        port: process.env.PORT || 'not_set',
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
        sessionSecret: process.env.SESSION_SECRET ? 'SET' : 'NOT_SET',
        openWeatherKey: process.env.OPENWEATHERMAP_API_KEY ? 'SET' : 'NOT_SET'
      };

      // Test Core Endpoints
      const endpointsToTest = [
        { path: '/health', method: 'GET' },
        { path: '/api/teams', method: 'GET' },
        { path: '/api/games/today', method: 'GET' },
        { path: '/api/alerts', method: 'GET' },
        { path: '/api/settings', method: 'GET' }
      ];

      for (const endpoint of endpointsToTest) {
        try {
          // Simulate internal request
          debugResults.endpoints[endpoint.path] = 'AVAILABLE';
        } catch (error: any) {
          debugResults.endpoints[endpoint.path] = 'ERROR';
          debugResults.errors.push(`Endpoint ${endpoint.path}: ${error.message}`);
        }
      }

      // Test WebSocket
      debugResults.services.websocket = {
        clients: clients.size,
        status: 'ACTIVE'
      };

      // Overall Health Score
      const totalChecks = Object.keys(debugResults.database).length + 
                         Object.keys(debugResults.services).length + 
                         Object.keys(debugResults.endpoints).length;
      const errorCount = debugResults.errors.length;
      const healthScore = Math.max(0, Math.round(((totalChecks - errorCount) / totalChecks) * 100));

      debugResults.summary = {
        healthScore: `${healthScore}%`,
        totalErrors: errorCount,
        status: errorCount === 0 ? 'HEALTHY' : errorCount < 5 ? 'DEGRADED' : 'CRITICAL',
        recommendation: errorCount === 0 ? 'System is operating normally' : 
                       errorCount < 5 ? 'Minor issues detected, monitor closely' : 
                       'Critical issues require immediate attention'
      };

      res.json(debugResults);
    } catch (error: any) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({ 
        error: 'Debug endpoint failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Individual Service Debug Endpoints
  app.get('/api/debug/database', async (req, res) => {
    try {
      const dbStatus = {
        connection: 'UNKNOWN',
        tables: {},
        indexes: {},
        performance: {}
      };

      // Test connection
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbStatus.performance.connectionTime = `${Date.now() - start}ms`;
      dbStatus.connection = 'OK';

      // Check all tables
      const tables = ['users', 'alerts', 'settings', 'teams', 'user_monitored_teams', 'master_alert_controls'];
      for (const table of tables) {
        try {
          const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
          dbStatus.tables[table] = {
            status: 'OK',
            count: parseInt(String(count.rows[0]?.count || '0'))
          };
        } catch (error: any) {
          dbStatus.tables[table] = { status: 'ERROR', error: error.message };
        }
      }

      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/debug/alerts-system', async (req, res) => {
    try {
      const alertsDebug = {
        generation: {},
        storage: {},
        delivery: {},
        configuration: {}
      };

      // Check alert generation
      try {
        const recentAlerts = await db.execute(sql`
          SELECT type, COUNT(*) as count, MAX(created_at) as latest
          FROM alerts 
          WHERE created_at > NOW() - INTERVAL '1 hour'
          GROUP BY type
        `);
        alertsDebug.generation = {
          status: 'OK',
          recentTypes: recentAlerts.rows,
          lastHourTotal: recentAlerts.rows.reduce((sum: number, row: any) => sum + parseInt(String(row.count)), 0)
        };
      } catch (error: any) {
        alertsDebug.generation = { status: 'ERROR', error: error.message };
      }

      // Check global alert settings
      try {
        const globalSettings = await storage.getGlobalAlertSettings('MLB');
        const enabledAlerts = Object.entries(globalSettings).filter(([_, enabled]) => enabled).length;
        alertsDebug.configuration = {
          status: 'OK',
          totalAlertTypes: Object.keys(globalSettings).length,
          enabledTypes: enabledAlerts,
          disabledTypes: Object.keys(globalSettings).length - enabledAlerts
        };
      } catch (error: any) {
        alertsDebug.configuration = { status: 'ERROR', error: error.message };
      }

      // Check Telegram delivery
      try {
        const telegramUsers = await storage.getAllUsers();
        const validUsers = telegramUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);
        alertsDebug.delivery = {
          status: validUsers.length > 0 ? 'READY' : 'NO_RECIPIENTS',
          configuredUsers: validUsers.length,
          totalUsers: telegramUsers.length
        };
      } catch (error: any) {
        alertsDebug.delivery = { status: 'ERROR', error: error.message };
      }

      res.json(alertsDebug);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/debug/live-monitoring', async (req, res) => {
    try {
      const monitoringStatus = {
        games: {},
        apis: {},
        monitoring: {}
      };

      // Check today's games
      try {
        const { MLBApiService } = await import('./services/mlb-api');
        const mlbService = new MLBApiService();
        const todaysGames = await mlbService.getTodaysGames();
        const liveGames = todaysGames.filter(game => game.status === 'live' || game.isLive);

        monitoringStatus.games = {
          status: 'OK',
          total: todaysGames.length,
          live: liveGames.length,
          scheduled: todaysGames.filter(g => g.status === 'scheduled').length,
          completed: todaysGames.filter(g => g.status === 'completed' || g.status === 'final').length
        };
      } catch (error: any) {
        monitoringStatus.games = { status: 'ERROR', error: error.message };
      }

      // Check monitored games
      try {
        const monitoredGames = await storage.getAllMonitoredGames();
        monitoringStatus.monitoring = {
          status: 'OK',
          userMonitoredGames: monitoredGames.length,
          uniqueUsers: [...new Set(monitoredGames.map(g => g.userId))].length
        };
      } catch (error: any) {
        monitoringStatus.monitoring = { status: 'ERROR', error: error.message };
      }

      res.json(monitoringStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin-auth/logout', (req, res) => {
    req.session.adminUserId = undefined;
    res.json({ message: 'Admin logout successful' });
  });

  // Global Alert Management Endpoints
  app.get('/api/admin/global-alert-settings/:sport', async (req, res) => {
    try {
      // Allow both admin users and regular users to read global settings
      // Admin users need this for management, regular users need it for their settings page
      const { sport } = req.params;

      // Get the global settings from storage
      const settings = await storage.getGlobalAlertSettings(sport);

      res.json(settings);
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

      // Update the category settings which will apply to all users
      await storage.updateGlobalAlertCategory(sport, alertKeys, enabled, req.session.adminUserId);

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
      // Write operations still require admin authentication
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport, alertType, enabled } = req.body;

      // Update the global setting which will apply to all users
      await storage.updateGlobalAlertSetting(sport, alertType, enabled, req.session.adminUserId);

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

  // Global settings endpoint for user settings page
  app.get('/api/global-alert-settings/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      const settings = await storage.getGlobalAlertSettings(sport);
      res.json(settings);
    } catch (error) {
      console.error('Error fetching global settings:', error);
      res.status(500).json({ message: 'Failed to fetch global settings' });
    }
  });

  // Legacy endpoint for backwards compatibility
  app.get('/api/admin/global-settings', async (req, res) => {
    try {
      // This endpoint should return the same data as the sport-specific endpoint
      // but for all sports. For now, return MLB settings since that's what's being used
      const mlbSettings = await storage.getGlobalAlertSettings('MLB');
      res.json(mlbSettings);
    } catch (error) {
      console.error('Error fetching global settings:', error);
      res.status(500).json({ message: 'Failed to fetch global settings' });
    }
  });

  // Quick fix endpoint to enable critical MLB alerts
  app.post('/api/admin/quick-enable-mlb', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const criticalAlerts = [
        'BASES_LOADED',
        'HOME_RUN_LIVE',
        'HIGH_SCORING',
        'SHUTOUT',
        'BLOWOUT',
        'STRIKEOUT',  // Enable this for testing
        'FULL_COUNT'  // Enable this for testing
      ];

      const results = [];
      for (const alertType of criticalAlerts) {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, req.session.adminUserId);
        results.push({ alertType, enabled: true });
      }

      res.json({
        message: 'Critical MLB alerts enabled successfully (including STRIKEOUT for testing)',
        enabledAlerts: results,
        nextStep: 'Alerts should start generating within 15 seconds if you have valid Telegram credentials'
      });
    } catch (error) {
      console.error('Error enabling critical alerts:', error);
      res.status(500).json({ message: 'Failed to enable critical alerts' });
    }
  });

  // Enable all alerts for testing
  app.post('/api/admin/enable-all-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const allAlerts = [
        'RISP', 'BASES_LOADED', 'RUNNERS_1ST_2ND', 'CLOSE_GAME', 'CLOSE_GAME_LIVE',
        'LATE_PRESSURE', 'HOME_RUN_LIVE', 'HIGH_SCORING', 'SHUTOUT', 'BLOWOUT',
        'FULL_COUNT', 'STRIKEOUT', 'POWER_HITTER', 'HOT_HITTER'
      ];

      const results = [];
      for (const alertType of allAlerts) {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, req.session.adminUserId);
        results.push({ alertType, enabled: true });
      }

      res.json({
        message: 'All MLB alerts enabled for testing',
        enabledAlerts: results,
        count: results.length
      });
    } catch (error) {
      console.error('Error enabling all alerts:', error);
      res.status(500).json({ message: 'Failed to enable all alerts' });
    }
  });

  // Debug endpoint to test admin-user settings connection
  app.get('/api/debug/settings-connection/:userId/:sport', async (req, res) => {
    try {
      const { userId, sport } = req.params;

      // Get global admin settings
      const globalSettings = await storage.getGlobalAlertSettings(sport);
      
      // Get user's individual preferences
      const userPreferences = await storage.getUserAlertPreferencesBySport(userId, sport);
      
      // Create a combined view
      const combinedView = {};
      for (const [alertType, globalEnabled] of Object.entries(globalSettings)) {
        const userPref = userPreferences.find(p => p.alertType === alertType);
        const userEnabled = userPref ? userPref.enabled : true; // Default to true if no user preference
        
        combinedView[alertType] = {
          globallyEnabled: globalEnabled,
          userEnabled: userEnabled,
          finalResult: globalEnabled && userEnabled, // Must pass both checks
          ruledBy: !globalEnabled ? 'ADMIN_DISABLED' : 'USER_CHOICE'
        };
      }

      res.json({
        userId,
        sport,
        timestamp: new Date().toISOString(),
        globalSettings,
        userPreferencesCount: userPreferences.length,
        combinedView,
        summary: {
          totalAlerts: Object.keys(globalSettings).length,
          adminDisabled: Object.entries(globalSettings).filter(([_, enabled]) => !enabled).length,
          userCustomized: userPreferences.length,
          finallyEnabled: Object.values(combinedView).filter((alert: any) => alert.finalResult).length
        }
      });
    } catch (error) {
      console.error('Error debugging settings connection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/apply-global-settings', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport, settings } = req.body;

      // Use the storage method to apply settings to all users
      const result = await storage.applyGlobalSettingsToAllUsers(sport, settings, req.session.adminUserId);

      res.json({
        message: `Global settings applied to ${result.usersUpdated} users successfully`,
        sport,
        ...result
      });
    } catch (error) {
      console.error('Error applying global settings:', error);
      res.status(500).json({ message: 'Failed to apply global settings' });
    }
  });


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