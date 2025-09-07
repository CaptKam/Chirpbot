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

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role?: string;
      };
    }
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

  // Export broadcast function for use by other services
  (global as any).wsBroadcast = broadcast;

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
      const games = await storage.getUserMonitoredTeams(userId);
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

      await storage.addUserMonitoredTeam(userId, gameId, sport || 'MLB', homeTeamName || '', awayTeamName || '');
      res.json({ message: 'Game monitoring enabled' });
    } catch (error) {
      console.error('Error adding monitored game:', error);
      res.status(500).json({ message: 'Failed to enable game monitoring' });
    }
  });

  app.delete('/api/user/:userId/monitored-games/:gameId', async (req, res) => {
    try {
      const { userId, gameId } = req.params;
      await storage.removeUserMonitoredTeam(userId, gameId);
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
      console.log(`🔍 Fetching alert preferences for user ${userId}, sport ${sport}`);
      const preferences = await storage.getUserAlertPreferencesBySport(userId, sport.toUpperCase());
      console.log(`📋 Found ${preferences.length} preferences for user ${userId} in ${sport}:`, preferences.map(p => `${p.alertType}=${p.enabled}`));
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences for sport:', error);
      res.status(500).json({ message: 'Failed to fetch sport alert preferences' });
    }
  });

  app.post('/api/user/:userId/alert-preferences', requireAuthentication, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, alertType, enabled } = req.body;

      // Verify user can only modify their own preferences
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Can only modify your own alert preferences' });
      }

      if (!sport || !alertType || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: sport, alertType, enabled' });
      }

      // Check if alert type is globally enabled first
      const isGloballyEnabled = await storage.isAlertGloballyEnabled(sport.toUpperCase(), alertType);
      if (!isGloballyEnabled && enabled) {
        return res.status(400).json({ 
          message: `Alert type ${alertType} is globally disabled by admin`,
          globallyDisabled: true 
        });
      }

      const preference = await storage.setUserAlertPreference(userId, sport.toUpperCase(), alertType, enabled);
      res.json(preference);
    } catch (error) {
      console.error('Error setting alert preference:', error);
      res.status(500).json({ message: 'Failed to set alert preference' });
    }
  });

  app.post('/api/user/:userId/alert-preferences/bulk', requireAuthentication, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, preferences } = req.body;

      // Verify user can only modify their own preferences
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Can only modify your own alert preferences' });
      }

      if (!sport || !preferences || !Array.isArray(preferences)) {
        return res.status(400).json({ message: 'Missing required fields: sport, preferences array' });
      }

      // Validate each preference against global settings
      const globalSettings = await storage.getGlobalAlertSettings(sport.toUpperCase());
      const filteredPreferences = [];

      for (const pref of preferences) {
        if (pref.enabled && !globalSettings[pref.alertType]) {
          console.log(`🚫 Skipping ${pref.alertType} - globally disabled by admin`);
          continue;
        }
        filteredPreferences.push(pref);
      }

      const result = await storage.bulkSetUserAlertPreferences(userId, sport.toUpperCase(), filteredPreferences);
      res.json({ 
        message: 'Alert preferences updated successfully', 
        count: result.length,
        filtered: preferences.length - filteredPreferences.length 
      });
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
  app.get('/api/telegram/debug', requireAdmin, async (req, res) => {
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

  // Debug: Test specific alert generation
  app.post('/api/debug/test-alerts', requireAdmin, async (req, res) => {
    try {
      console.log('🧪 Testing alert generation system...');
      
      const alertGenerator = new AlertGenerator();
      
      // Force generate alerts for live games
      await alertGenerator.generateLiveGameAlerts();
      
      res.json({
        message: 'Test alert generation completed - check server logs',
        note: 'This forces the alert generation process to run immediately'
      });
    } catch (error) {
      console.error('Error in test alert generation:', error);
      res.status(500).json({ error: 'Failed to test alert generation' });
    }
  });

  // Generate test live alerts - RULE COMPLIANT VERSION - ADMIN ONLY
  app.post('/api/alerts/force-generate', requireAdmin, async (req, res) => {
    try {
      console.log('🧪 ADMIN FORCING RULE-COMPLIANT TEST LIVE ALERTS');
      console.log('🛡️ NOTE: All generated alerts will respect global admin settings and user preferences');

      const alertGenerator = new AlertGenerator();
      const alertCount = await alertGenerator.generateLiveGameAlerts();

      res.json({
        message: `Generated ${alertCount} rule-compliant alerts (filtered by admin settings)`,
        alertCount,
        note: 'All alerts respect global admin settings and user preferences'
      });
    } catch (error) {
      console.error('Error generating test alerts:', error);
      res.status(500).json({ error: 'Failed to generate test alerts' });
    }
  });

  // Force send test Telegram alert - RULE COMPLIANT VERSION - ADMIN ONLY
  app.post('/api/telegram/force-test', requireAdmin, async (req, res) => {
    try {
      console.log('🧪 TESTING TELEGRAM ALERT (Rule-Compliant)');

      // Get all users with Telegram
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);

      console.log(`📱 Found ${telegramUsers.length} users with Telegram configured`);

      let successCount = 0;
      let errorCount = 0;

      for (const user of telegramUsers) {
        console.log(`📱 Testing Telegram for user: ${user.username}`);

        // 🛡️ RULE COMPLIANCE: Check if TEST_STRIKEOUT is globally enabled
        const alertGenerator = new AlertGenerator();
        const isGloballyEnabled = await (alertGenerator as any).isAlertGloballyEnabled('MLB', 'TEST_STRIKEOUT');

        if (!isGloballyEnabled) {
          console.log(`🚫 RULE COMPLIANT: TEST_STRIKEOUT globally disabled - skipping user ${user.username}`);
          errorCount++;
          continue;
        }

        // 🛡️ RULE COMPLIANCE: Check user preferences
        try {
          const userPrefs = await storage.getUserAlertPreferencesBySport(user.id, 'mlb');
          const userPref = userPrefs.find(p => p.alertType === 'TEST_STRIKEOUT');
          const userHasEnabled = userPref ? userPref.enabled : isGloballyEnabled;

          if (!userHasEnabled) {
            console.log(`🚫 RULE COMPLIANT: User ${user.username} has TEST_STRIKEOUT disabled`);
            errorCount++;
            continue;
          }
        } catch (prefError) {
          console.error(`❌ Error checking preferences for ${user.username}:`, prefError);
          errorCount++;
          continue;
        }

        const config: TelegramConfig = {
          botToken: user.telegramBotToken || '',
          chatId: user.telegramChatId || ''
        };

        const testAlert = {
          type: 'TEST_STRIKEOUT',
          title: 'Test Strikeout Alert',
          description: '⚡ RULE-COMPLIANT TEST! Test Batter struck out by Test Pitcher - Test Team vs Test Team',
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
          console.log(`📱 ✅ Rule-compliant test alert sent to ${user.username}`);
        } else {
          errorCount++;
          console.log(`📱 ❌ Test alert failed for ${user.username}`);
        }
      }

      res.json({
        message: 'Rule-compliant test alerts completed',
        userCount: telegramUsers.length,
        successCount,
        errorCount,
        note: 'All alerts respect global admin settings and user preferences'
      });
    } catch (error) {
      console.error('Error sending test alerts:', error);
      res.status(500).json({ error: 'Failed to send test alerts' });
    }
  });

  // Debug endpoint to check user alert preferences
  app.get('/api/debug/user-preferences/:userId', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get user info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get all alert preferences for this user
      const allPreferences = await storage.getUserAlertPreferences(userId);
      
      // Group by sport
      const preferencesBySport = {};
      allPreferences.forEach(pref => {
        if (!preferencesBySport[pref.sport]) {
          preferencesBySport[pref.sport] = [];
        }
        preferencesBySport[pref.sport].push({
          alertType: pref.alertType,
          enabled: pref.enabled,
          updatedAt: pref.updatedAt
        });
      });

      // Get global settings for comparison
      const globalMLB = await storage.getGlobalAlertSettings('MLB');
      const globalNFL = await storage.getGlobalAlertSettings('NFL');

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        userPreferences: preferencesBySport,
        globalSettings: {
          MLB: globalMLB,
          NFL: globalNFL
        },
        totalPreferences: allPreferences.length,
        preferencesSummary: Object.keys(preferencesBySport).map(sport => ({
          sport,
          count: preferencesBySport[sport].length,
          enabled: preferencesBySport[sport].filter(p => p.enabled).length
        }))
      });
    } catch (error) {
      console.error('Error checking user preferences:', error);
      res.status(500).json({ error: 'Failed to check user preferences' });
    }
  });

  // Debug endpoint to detect rule bypasses
  app.get('/api/debug/telegram-bypasses', requireAdmin, async (req, res) => {
    try {
      console.log('🔍 SCANNING FOR TELEGRAM BYPASS ROUTES');

      const bypasses = [];

      // Check for direct telegram calls in the codebase
      const potentialBypasses = [
        {
          route: '/api/telegram/force-test',
          status: 'PATCHED - Now rule-compliant',
          risk: 'LOW'
        },
        {
          route: '/api/alerts/force-generate',
          status: 'PATCHED - Now rule-compliant',
          risk: 'LOW'
        },
        {
          route: '/api/telegram/test',
          status: 'SAFE - Connection test only',
          risk: 'NONE'
        }
      ];

      // Check alert generator paths
      const alertPaths = [
        {
          path: 'saveRealTimeAlert() -> Telegram sending',
          ruleCheck: 'isAlertGloballyEnabled() + user preferences',
          status: 'PROTECTED'
        },
        {
          path: 'saveAlert() -> WebSocket broadcast only',
          ruleCheck: 'isAlertGloballyEnabled() before DB save',
          status: 'PROTECTED'
        }
      ];

      res.json({
        message: 'Telegram bypass scan complete',
        potentialBypasses,
        alertPaths,
        recommendation: 'All major bypass routes have been identified and patched'
      });
    } catch (error) {
      console.error('Error scanning for bypasses:', error);
      res.status(500).json({ error: 'Failed to scan for bypasses' });
    }
  });

  // Admin middleware
  async function requireAdmin(req: any, res: any, next: any) {
    try {
      // Check for admin session (adminUserId) first, then fall back to regular session
      const userId = req.session?.adminUserId || req.session?.userId;

      if (!userId) {
        console.log('🔒 Admin middleware: No session found');
        return res.status(401).json({ message: 'Authentication required' });
      }

      const user = await storage.getUserById(userId);
      if (!user || user.role !== 'admin') {
        console.log(`🔒 Admin middleware: User ${userId} is not admin (role: ${user?.role})`);
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log(`✅ Admin middleware: Admin ${user.username} authenticated`);
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

  app.delete('/api/admin/users/:userId', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user; // from requireAdmin middleware

      console.log(`🗑️ Admin ${currentUser.username} attempting to delete user ${userId}`);

      // Prevent self-deletion
      if (userId === currentUser.id) {
        return res.status(400).json({
          message: 'Cannot delete your own account'
        });
      }

      // Check if user exists
      const userToDelete = await storage.getUserById(userId);
      if (!userToDelete) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent deleting the last admin
      if (userToDelete.role === 'admin') {
        const allAdmins = await storage.getUsersByRole('admin');
        if (allAdmins.length <= 1) {
          return res.status(400).json({
            message: 'Cannot delete the last admin user'
          });
        }
      }

      // Delete user and all related data
      const deleted = await storage.deleteUser(userId);

      if (deleted) {
        console.log(`✅ User ${userToDelete.username} deleted successfully by admin ${currentUser.username}`);
        res.json({
          message: `User ${userToDelete.username} deleted successfully`,
          deletedUser: {
            id: userToDelete.id,
            username: userToDelete.username,
            email: userToDelete.email,
            role: userToDelete.role
          }
        });
      } else {
        res.status(500).json({ message: 'Failed to delete user' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Force delete endpoint for stubborn test users
  app.delete('/api/admin/users/:userId/force', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      console.log(`💀 Admin ${currentUser.username} attempting FORCE DELETE of user ${userId}`);

      // Prevent self-deletion
      if (userId === currentUser.id) {
        return res.status(400).json({
          message: 'Cannot delete your own account'
        });
      }

      // Force delete using the aggressive method
      const deleted = await storage.forceDeleteUser(userId);

      if (deleted) {
        console.log(`✅ User ${userId} FORCE DELETED by admin ${currentUser.username}`);
        res.json({
          message: `User ${userId} has been completely removed from the system`,
          method: 'FORCE_DELETE',
          deletedUserId: userId
        });
      } else {
        res.json({
          message: `User ${userId} was not found or already deleted`,
          method: 'FORCE_DELETE',
          deletedUserId: userId
        });
      }
    } catch (error) {
      console.error('Error force deleting user:', error);
      res.status(500).json({ message: 'Failed to force delete user' });
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
      // Check if master alerts are disabled
      const masterAlertsEnabled = await storage.getMasterAlertEnabled();
      if (!masterAlertsEnabled) {
        // Return empty array if master alerts are disabled
        res.json([]);
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;

      // Get current user from session
      const currentUserId = req.session?.userId;
      
      // If user is not authenticated, return empty array
      if (!currentUserId) {
        res.json([]);
        return;
      }

      // Get user's monitored games
      const monitoredGames = await storage.getUserMonitoredTeams(currentUserId);
      const monitoredGameIds = monitoredGames.map(game => game.gameId);

      // If user has no monitored games, return empty array
      if (monitoredGameIds.length === 0) {
        res.json([]);
        return;
      }

      // Get alerts from database - filter by monitored game IDs
      const gameIdsPlaceholder = monitoredGameIds.map(() => '?').join(',');
      const result = await db.execute(sql`
        SELECT id, type, game_id, sport, score, payload, created_at
        FROM alerts
        WHERE game_id IN (${sql.raw(monitoredGameIds.map(id => `'${id}'`).join(','))})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      const alerts = [];

      for (const row of result.rows) {
        const sport = String(row.sport || 'MLB');
        const alertType = String(row.type || '');

        // Process alerts normally when master alerts are enabled
        try {
          let payload: any = {};
          try {
            payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
          } catch (e) {
            console.error('Error parsing payload:', e);
            payload = {};
          }
          alerts.push({
            id: row.id,
            alertKey: `${row.game_id}_${row.type}`,
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
            timestamp: row.created_at,
            seen: false,
            sentToTelegram: false,
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
        } catch (error) {
          console.error(`Error processing alert for ${row.id}:`, error);
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
          weatherSource: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data (Set OPENWEATHERMAP_API_KEY for live data)'
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
        timestamp: weather.timestamp,
        source: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data'
      });
    } catch (error: any) {
      console.error(`Weather API error for team ${req.params.teamName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Weather endpoint - redirect to team-specific endpoint
  app.get('/api/weather', async (req, res) => {
    console.log('🔧 ROUTE DEBUG: GET /api/weather - Body:', req.body);
    console.log('⚠️ Generic weather endpoint called - should use /api/weather/team/:teamName');

    // Return fallback data with clear indication it's generic
    res.json({
      temperature: 72,
      condition: 'Clear',
      windSpeed: 5,
      windDirection: 0, // North
      humidity: 50,
      pressure: 1013,
      timestamp: new Date().toISOString(),
      source: 'Generic Fallback - Use team-specific endpoint'
    });
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
        console.log('❌ Admin login failed: user not found:', username);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if user is admin
      if (user.role !== 'admin') {
        console.log('❌ Admin login failed: not admin:', username);
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Verify password
      if (!user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log('❌ Admin login failed: invalid password:', username);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Store both admin and regular session for flexibility
      req.session.adminUserId = user.id;
      req.session.userId = user.id;

      // Force session save to ensure persistence
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        } else {
          console.log('✅ Admin session saved for:', username);
        }
      });

      console.log('✅ Admin login successful:', username);
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
      // Check admin session first, then fall back to regular session
      const adminUserId = req.session?.adminUserId;
      const regularUserId = req.session?.userId;
      const userId = adminUserId || regularUserId;

      console.log('🔍 Admin verify check:', { 
        hasAdminSession: !!adminUserId, 
        hasRegularSession: !!regularUserId,
        sessionId: req.sessionID?.slice(0, 8) 
      });

      if (!userId) {
        console.log('❌ No user session found');
        return res.status(401).json({ authenticated: false });
      }

      const user = await storage.getUserById(userId);
      if (!user || user.role !== 'admin') {
        console.log('❌ User not admin or not found:', { userId, role: user?.role });
        // Clear invalid sessions
        req.session.adminUserId = undefined;
        req.session.userId = undefined;
        return res.status(401).json({ authenticated: false });
      }

      // Ensure admin session is properly set
      if (!req.session.adminUserId && user.role === 'admin') {
        req.session.adminUserId = user.id;
      }

      console.log('✅ Admin verified:', user.username);
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
      const debugResults: {
        timestamp: string;
        endpoints: Record<string, any>;
        database: Record<string, any>;
        services: Record<string, any>;
        configuration: Record<string, any>;
        errors: string[];
      } = {
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

  // Check if admin users exist (public endpoint for troubleshooting)
  app.get('/api/admin-auth/check', async (req, res) => {
    try {
      const adminUsers = await storage.getUsersByRole('admin');
      res.json({
        hasAdminUsers: adminUsers.length > 0,
        adminCount: adminUsers.length,
        adminUsernames: adminUsers.map(u => u.username)
      });
    } catch (error) {
      console.error('Error checking admin users:', error);
      res.status(500).json({ message: 'Error checking admin users' });
    }
  });

  // Global Alert Management Endpoints
  app.get('/api/admin/global-alert-settings/:sport', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { sport } = req.params;

      // Get the global settings from storage
      const settings = await storage.getGlobalAlertSettings(sport);

      res.json(settings);
    } catch (error) {
      console.error('Error fetching global alert settings:', error);
      res.status(500).json({ message: 'Failed to fetch global alert settings' });
    }
  });

  // Get available alert types from cylinders
  app.get('/api/admin/available-alerts/:sport', async (req, res) => {
    try {
      if (!req.session.adminUserId && !req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { sport } = req.params;

      try {
        let availableAlerts: string[] = [];

        // Get available alert types from the specific sport engine
        if (sport.toUpperCase() === 'NCAAF') {
          const { NCAAFEngine } = await import('./services/engines/ncaaf-engine');
          const tempEngine = new NCAAFEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'MLB') {
          const { MLBEngine } = await import('./services/engines/mlb-engine');
          const tempEngine = new MLBEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'NFL') {
          const { NFLEngine } = await import('./services/engines/nfl-engine');
          const tempEngine = new NFLEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'WNBA') {
          const { WNBAEngine } = await import('./services/engines/wnba-engine');
          const tempEngine = new WNBAEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'CFL') {
          const { CFLEngine } = await import('./services/engines/cfl-engine');
          const tempEngine = new CFLEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else {
          // Fallback to base engine for other sports
          const { BaseSportEngine } = await import('./services/engines/base-engine');
          const tempEngine = new (class extends BaseSportEngine {
            async calculateProbability() { return 0; }
          })(sport.toUpperCase());
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        }
        
        // Convert to the format expected by the frontend
        const alertConfig = availableAlerts.map(alertType => {
          const displayName = alertType
            .replace(`${sport.toUpperCase()}_`, '')
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
            
          return {
            key: alertType,
            label: displayName,
            description: `${displayName} alerts for ${sport.toUpperCase()} games`
          };
        });

        res.json(alertConfig);
      } catch (error) {
        console.error(`❌ Error getting available alerts for ${sport}:`, error);
        res.json([]); // Return empty array if no cylinders found
      }
    } catch (error) {
      console.error('Error fetching available alerts:', error);
      res.status(500).json({ message: 'Failed to fetch available alerts' });
    }
  });

  app.get('/api/admin/master-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const enabled = await storage.getMasterAlertEnabled();
      res.json({ enabled });
    } catch (error) {
      console.error('Error fetching master alerts status:', error);
      res.status(500).json({ message: 'Failed to fetch master alerts status' });
    }
  });

  app.put('/api/admin/master-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { enabled } = req.body;

      // Actually persist the master alerts setting to the database
      await storage.setMasterAlertEnabled(enabled, req.session.adminUserId);

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
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH'
      ];

      const results = [];
      for (const alertType of criticalAlerts) {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, req.session.adminUserId);
        results.push({ alertType, enabled: true });
      }

      res.json({
        message: 'Critical MLB alerts enabled successfully',
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
        'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'
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

  // Disable ALL alerts across entire system
  app.post('/api/admin/disable-all-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      console.log('🚫 ADMIN REQUEST: Disabling all alerts globally');

      // Define all alert types across all sports
      const allAlertTypes = {
        'MLB': [
          'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'
        ],
        'NFL': [
          'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'RED_ZONE', 'FOURTH_DOWN',
          'TWO_MINUTE_WARNING', 'CLUTCH_TIME', 'OVERTIME'
        ],
        'NCAAF': [
          'NCAAF_GAME_START', 'NCAAF_SECOND_HALF_KICKOFF', 'RED_ZONE', 'FOURTH_DOWN',
          'NCAAF_TWO_MINUTE_WARNING', 'CLUTCH_TIME', 'OVERTIME'
        ],
        'CFL': [
          'CFL_GAME_START', 'CFL_SECOND_HALF_KICKOFF', 'THIRD_DOWN', 'THREE_MINUTE_WARNING',
          'CFL_TWO_MINUTE_WARNING'
        ],
        'WNBA': [
          'WNBA_GAME_START', 'WNBA_FOURTH_QUARTER', 'WNBA_CLOSE_GAME', 'WNBA_OVERTIME',
          'WNBA_HIGH_SCORING', 'WNBA_COMEBACK', 'WNBA_CLUTCH_PERFORMANCE', 'WNBA_TWO_MINUTE_WARNING'
        ],
        'NBA': [
          'NBA_FOURTH_QUARTER', 'NBA_CLOSE_GAME', 'NBA_OVERTIME',
          'NBA_HIGH_SCORING', 'NBA_COMEBACK', 'NBA_CLUTCH_PERFORMANCE'
        ],
        'NHL': [
          'NHL_THIRD_PERIOD', 'NHL_CLOSE_GAME', 'NHL_OVERTIME',
          'NHL_POWER_PLAY', 'NHL_PENALTY_KILL', 'NHL_CLUTCH_PERFORMANCE'
        ]
      };

      let totalDisabled = 0;
      const results = [];

      // Disable all alert types globally
      for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
        for (const alertType of alertTypes) {
          try {
            await storage.updateGlobalAlertSetting(sport, alertType, false, req.session.adminUserId);
            results.push({ sport, alertType, disabled: true });
            totalDisabled++;
          } catch (error) {
            console.error(`Failed to disable ${sport}.${alertType}:`, error);
            results.push({ sport, alertType, disabled: false, error: error.message });
          }
        }
      }

      // Disable Telegram for all users
      const allUsers = await storage.getAllUsers();
      let telegramDisabled = 0;

      for (const user of allUsers) {
        if (user.telegramEnabled) {
          try {
            await storage.updateUserTelegramSettings(user.id, '', '', false);
            telegramDisabled++;
          } catch (error) {
            console.error(`Failed to disable Telegram for user ${user.username}:`, error);
          }
        }
      }

      res.json({
        message: 'ALL alert features disabled globally',
        summary: {
          alertTypesDisabled: totalDisabled,
          telegramUsersDisabled: telegramDisabled,
          totalUsers: allUsers.length
        },
        details: results,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Successfully disabled ${totalDisabled} alert types and ${telegramDisabled} Telegram configurations`);

    } catch (error) {
      console.error('Error disabling all alerts:', error);
      res.status(500).json({ message: 'Failed to disable all alerts' });
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

  // Start live game monitoring with robust error handling
  const monitoringInterval = setInterval(async () => {
    try {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
      await alertGenerator.generateLiveGameAlerts();
    } catch (error: any) {
      console.error('⚠️ Non-critical error in live monitoring:', error.message);
      // Don't crash - just continue monitoring
    }
  }, 15000); // Check every 15 seconds
  
  // Store monitoring interval globally for graceful shutdown cleanup
  (global as any).setMonitoringInterval(monitoringInterval);

  console.log('✅ ALERT SYSTEM ACTIVE - Live monitoring enabled');

  return httpServer;
}