import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamSchema, insertAlertSchema, insertSettingsSchema } from "@shared/schema";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { getWeatherData } from "./services/weather";
import { sportsService, type SportsEvent } from "./services/sports";
import { liveSportsService } from "./services/live-sports";
import { adminRouter } from "./routes/admin";
import { registerMultiSourceRoutes } from "./routes/multi-source";
import { tennisRouter } from "./routes/tennis";

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
      } else if (client.bufferedAmount >= 1_000_000) {
        console.warn('WebSocket client buffer full, skipping broadcast');
      }
    });
  }

  // Admin routes
  app.use("/api/admin", adminRouter);

  // Multi-source data aggregator routes
  registerMultiSourceRoutes(app);

  // Tennis routes
  app.use("/api/tennis", tennisRouter);

  // Games routes
  app.get("/api/games/today", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      const games = await liveSportsService.getTodaysGames(sport);
      res.json(games);
    } catch (error) {
      console.error('Error fetching games:', error);
      res.status(500).json({ message: "Failed to fetch today's games" });
    }
  });

  // Teams routes
  app.get("/api/teams", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      const teams = sport ? await storage.getTeamsBySport(sport) : await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/monitored", async (req, res) => {
    try {
      const teams = await storage.getMonitoredTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch monitored teams" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(validatedData);
      res.json(team);
    } catch (error) {
      res.status(400).json({ message: "Invalid team data" });
    }
  });

  app.patch("/api/teams/:id/monitor", async (req, res) => {
    try {
      const { id } = req.params;
      const { monitored } = req.body;
      const team = await storage.toggleTeamMonitoring(id, monitored);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Broadcast team monitoring change
      broadcast({ type: 'team_monitoring_changed', data: team });
      
      res.json(team);
    } catch (error) {
      res.status(500).json({ message: "Failed to update team monitoring" });
    }
  });

  // Alerts routes
  app.get("/api/alerts", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      const type = req.query.type as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

      let alerts;
      if (sport) {
        alerts = await storage.getAlertsBySport(sport);
      } else if (type) {
        alerts = await storage.getAlertsByType(type);
      } else {
        alerts = await storage.getRecentAlerts(limit);
      }
      
      // Always limit to max 30 alerts for performance
      if (alerts.length > 30) {
        alerts = alerts.slice(0, 30);
      }

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const validatedData = insertAlertSchema.parse(req.body);
      
      // Get weather data for the game location using city name
      let weatherData = null;
      if (validatedData.gameInfo.homeTeam) {
        const teamCityMap: Record<string, string> = {
          'Los Angeles Angels': 'Los Angeles', 'Los Angeles Dodgers': 'Los Angeles',
          'Oakland Athletics': 'Oakland', 'San Francisco Giants': 'San Francisco', 
          'Athletics': 'Oakland', // Handle short name
          'Seattle Mariners': 'Seattle', 'Texas Rangers': 'Arlington',
          'Houston Astros': 'Houston', 'Minnesota Twins': 'Minneapolis',
          'Kansas City Royals': 'Kansas City', 'Chicago White Sox': 'Chicago',
          'Chicago Cubs': 'Chicago', 'Cleveland Guardians': 'Cleveland',
          'Detroit Tigers': 'Detroit', 'Milwaukee Brewers': 'Milwaukee',
          'St. Louis Cardinals': 'St. Louis', 'Atlanta Braves': 'Atlanta',
          'Miami Marlins': 'Miami', 'New York Yankees': 'New York',
          'New York Mets': 'New York', 'Philadelphia Phillies': 'Philadelphia',
          'Washington Nationals': 'Washington', 'Boston Red Sox': 'Boston',
          'Toronto Blue Jays': 'Toronto', 'Baltimore Orioles': 'Baltimore',
          'Tampa Bay Rays': 'Tampa', 'Pittsburgh Pirates': 'Pittsburgh',
          'Cincinnati Reds': 'Cincinnati', 'Colorado Rockies': 'Denver',
          'Arizona Diamondbacks': 'Phoenix', 'San Diego Padres': 'San Diego'
        };
        
        const cityName = teamCityMap[validatedData.gameInfo.homeTeam] || validatedData.gameInfo.homeTeam;
        weatherData = await getWeatherData(cityName);
      }

      const settings = await storage.getSettingsBySport(validatedData.sport);

      const alert = await storage.createAlert({
        ...validatedData,
        weatherData,
      });

      // Send to Telegram if both push notifications and telegram are enabled
      if (settings?.pushNotificationsEnabled && settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
          chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
        };

        const sent = await sendTelegramAlert(telegramConfig, alert);
        if (sent) {
          await storage.markAlertSentToTelegram(alert.id);
        }
      }

      // Broadcast new alert to connected clients
      broadcast({ type: 'new_alert', data: alert });

      res.json(alert);
    } catch (error) {
      console.error("Failed to create alert:", error);
      res.status(400).json({ message: "Invalid alert data" });
    }
  });

  // Mark alert as seen
  app.patch("/api/alerts/:id/seen", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markAlertAsSeen(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking alert as seen:", error);
      res.status(500).json({ message: "Failed to mark alert as seen" });
    }
  });

  // Delete a specific alert
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAlert(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Get unseen alerts count
  app.get("/api/alerts/unseen/count", async (req, res) => {
    try {
      const count = await storage.getUnseenAlertsCount();
      res.json({ count });
    } catch (error) {
      console.error("Error getting unseen alerts count:", error);
      res.status(500).json({ message: "Failed to get unseen alerts count" });
    }
  });

  // Mark all alerts as seen
  app.patch("/api/alerts/mark-all-seen", async (req, res) => {
    try {
      await storage.markAllAlertsAsSeen();
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all alerts as seen:", error);
      res.status(500).json({ message: "Failed to mark all alerts as seen" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      
      if (sport) {
        const settings = await storage.getSettingsBySport(sport);
        if (!settings) {
          return res.status(404).json({ message: "Settings not found for sport" });
        }
        res.json(settings);
      } else {
        const allSettings = await storage.getAllSettings();
        res.json(allSettings);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Public route for enabled alert keys - no authentication required
  app.get("/api/settings/enabled-alert-keys/:sport", async (req, res) => {
    try {
      const { sport } = req.params;
      const enabledKeys = await storage.getEnabledAlertKeysBySport(sport.toUpperCase());
      res.json({ enabledKeys });
    } catch (error) {
      console.error("Error fetching enabled alert keys:", error);
      res.status(500).json({ error: "Failed to fetch enabled alert keys" });
    }
  });

  // Public route for master alert controls - no authentication required for viewing
  app.get("/api/settings/master-alert-controls", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      const controls = sport 
        ? await storage.getMasterAlertControlsBySport(sport.toUpperCase())
        : await storage.getAllMasterAlertControls();
      res.json(controls);
    } catch (error) {
      console.error("Error fetching master alert controls:", error);
      res.status(500).json({ error: "Failed to fetch master alert controls" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.parse(req.body);
      const settings = await storage.createSettings(validatedData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  app.patch("/api/settings/:sport", async (req, res) => {
    try {
      const { sport } = req.params;
      const updates = req.body;
      
      const settings = await storage.updateSettings(sport, updates);
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }

      // Broadcast settings change
      broadcast({ type: 'settings_changed', data: settings });
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // User monitored games endpoints
  app.get('/api/user/:userId/monitored-games', async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport } = req.query;
      
      const monitoredGames = sport 
        ? await storage.getUserMonitoredGamesBySport(userId, sport as string)
        : await storage.getUserMonitoredGames(userId);
        
      res.json(monitoredGames);
    } catch (error) {
      console.error("Error fetching monitored games:", error);
      res.status(500).json({ message: "Failed to fetch monitored games" });
    }
  });

  app.post('/api/user/:userId/monitored-games', async (req, res) => {
    try {
      const { userId } = req.params;
      const { gameId, sport, homeTeamName, awayTeamName } = req.body;
      
      
      const monitoring = await storage.addUserMonitoredGame({
        userId,
        gameId,
        sport,
        homeTeamName,
        awayTeamName
      });
      
      res.json(monitoring);
    } catch (error) {
      console.error("Error adding monitored game:", error);
      res.status(500).json({ message: "Failed to add monitored game" });
    }
  });

  app.delete('/api/user/:userId/monitored-games/:gameId', async (req, res) => {
    try {
      const { userId, gameId } = req.params;
      
      
      await storage.removeUserMonitoredGame(userId, gameId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing monitored game:", error);
      res.status(500).json({ message: "Failed to remove monitored game" });
    }
  });

  app.get('/api/user/:userId/monitored-games/:gameId/status', async (req, res) => {
    try {
      const { userId, gameId } = req.params;
      
      const isMonitored = await storage.isGameMonitoredByUser(userId, gameId);
      res.json({ isMonitored });
    } catch (error) {
      console.error("Error checking game monitoring status:", error);
      res.status(500).json({ message: "Failed to check monitoring status" });
    }
  });

  // User Telegram settings routes
  app.put("/api/user/:userId/telegram", async (req, res) => {
    try {
      const { userId } = req.params;
      const { telegramBotToken, telegramChatId, telegramEnabled } = req.body;

      const user = await storage.updateUserTelegramSettings(userId, telegramBotToken, telegramChatId, telegramEnabled);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        message: "Telegram settings updated successfully",
        telegramEnabled: user.telegramEnabled 
      });
    } catch (error) {
      console.error("Error updating user Telegram settings:", error);
      res.status(500).json({ message: "Failed to update Telegram settings" });
    }
  });

  app.post("/api/user/:userId/telegram/test", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found", connected: false });
      }

      if (!user.telegramBotToken || !user.telegramChatId) {
        return res.status(400).json({ message: "Telegram credentials not configured", connected: false });
      }

      const telegramConfig = {
        botToken: user.telegramBotToken,
        chatId: user.telegramChatId,
      };

      const isConnected = await testTelegramConnection(telegramConfig);
      
      if (!isConnected) {
        return res.json({ 
          connected: false, 
          message: "Connection failed. Please check your bot token and chat ID. Make sure your bot is active and you've started a conversation with it." 
        });
      }
      
      res.json({ connected: true, message: "Successfully connected to your Telegram bot!" });
    } catch (error) {
      console.error("Error testing user Telegram connection:", error);
      res.status(500).json({ message: "Failed to test Telegram connection", connected: false });
    }
  });

  app.get("/api/user/:userId/telegram", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        telegramEnabled: user.telegramEnabled,
        hasCredentials: !!(user.telegramBotToken && user.telegramChatId)
      });
    } catch (error) {
      console.error("Error fetching user Telegram settings:", error);
      res.status(500).json({ message: "Failed to fetch Telegram settings" });
    }
  });

  // Legacy global Telegram test route (for backward compatibility)
  app.post("/api/telegram/test", async (req, res) => {
    try {
      const telegramConfig = {
        botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
        chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
      };

      const isConnected = await testTelegramConnection(telegramConfig);
      res.json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ message: "Failed to test Telegram connection", connected: false });
    }
  });

  // Sports data routes
  app.get("/api/sports/games", async (req, res) => {
    try {
      const sport = req.query.sport as string;
      const games = await sportsService.getLiveGames(sport);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });


  // Import modular sport engines
  const { alertEngineManager } = await import('./services/engines');
  
  // Setup alert broadcasting for all sports
  alertEngineManager.setAlertCallback((alert: any) => {
    broadcast({ type: 'new_alert', data: alert });
  });
  
  // Start all sport engines (MLB: 10s, NFL: 30s, NBA: 20s, NHL: 15s, Weather: 5min, AI: 15s)
  await alertEngineManager.startAllEngines();

  // Helper function to generate alert descriptions
  function generateAlertDescription(alertType: string, game: any): string {
    const score = `${game.awayTeam.name} ${game.awayTeam.score || Math.floor(Math.random() * 15)} - ${game.homeTeam.score || Math.floor(Math.random() * 15)} ${game.homeTeam.name}`;
    
    switch (alertType) {
      case 'RISP Opportunity':
        return `Runners likely in scoring position! ${score} - Prime RBI opportunity developing`;
      case 'BASES LOADED':
        return `BASES LOADED! ${score} - MAXIMUM scoring opportunity!`;
      case 'High Pressure Situation':
        return `One-run game! ${score} - High-value betting opportunity`;
      case 'NFL Close Game':
        return `One-score game! ${score} - Key betting moment`;
      default:
        return `${alertType} situation developing! ${score}`;
    }
  }

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { usernameOrEmail, password, firstName, lastName } = req.body;
      
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: "Username/email and password are required" });
      }

      if (usernameOrEmail.length < 3) {
        return res.status(400).json({ message: "Username/email must be at least 3 characters long" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Check if this is an email or username
      const isEmail = usernameOrEmail.includes('@');
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(usernameOrEmail);
      if (existingUser) {
        return res.status(400).json({ 
          message: isEmail ? "Email already registered" : "Username already exists" 
        });
      }

      // Hash password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const userData = {
        [isEmail ? 'email' : 'username']: usernameOrEmail,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        authMethod: 'local' as const
      };
      
      const user = await storage.createUser(userData);
      
      // Start session
      (req.session as any).userId = user.id;
      (req.session as any).userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      res.json({ 
        id: user.id, 
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        message: "Account created successfully" 
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Auth status endpoint
  app.get("/api/auth/me", async (req, res) => {
    try {
      const session = req.session as any;
      if (!session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({ 
        id: user.id, 
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        authMethod: user.authMethod
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Failed to check authentication" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const session = req.session as any;
      
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: "Username/email and password are required" });
      }

      // User login
      const user = await storage.getUserByUsername(usernameOrEmail);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check password with bcrypt
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Start session
      (req.session as any).userId = user.id;
      (req.session as any).userInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      res.json({ 
        id: user.id, 
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        message: "Login successful" 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    const session = req.session as any;
    if (session?.userId) {
      res.json({ 
        id: session.userId, 
        ...session.userInfo,
        isAuthenticated: true 
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // OAuth routes (placeholder endpoints for future OAuth implementation)
  app.get("/api/auth/google", (req, res) => {
    // TODO: Implement Google OAuth
    res.status(501).json({ 
      message: "Google OAuth not yet implemented. Please use email/username signup.",
      success: false 
    });
  });

  app.get("/api/auth/apple", (req, res) => {
    // TODO: Implement Apple OAuth  
    res.status(501).json({ 
      message: "Apple OAuth not yet implemented. Please use email/username signup.",
      success: false 
    });
  });

  // OAuth callback routes
  app.get("/api/auth/google/callback", (req, res) => {
    // TODO: Handle Google OAuth callback
    res.redirect("/?oauth=error&provider=google");
  });

  app.get("/api/auth/apple/callback", (req, res) => {
    // TODO: Handle Apple OAuth callback
    res.redirect("/?oauth=error&provider=apple");
  });

  // Quick test endpoint without AI
  app.post("/api/test/quick-alert", async (req, res) => {
    try {
      const testAlert = {
        type: "Quick Test",
        sport: "MLB",
        title: "Test Alert - Immediate Response",
        description: "Testing alert system without AI delay",
        gameInfo: {
          homeTeam: "Test Home Team",
          awayTeam: "Test Away Team",
          status: "Live"
        },
        aiContext: "Quick test - AI bypassed",
        aiConfidence: 100,
        weatherData: {
          temperature: 72,
          condition: "Clear",
          windSpeed: 5,
          windDirection: "N"
        },
        sentToTelegram: false
      };

      const alert = await storage.createAlert(testAlert);
      broadcast({ type: 'new_alert', data: alert });
      
      res.json({
        success: true,
        message: "Quick alert created successfully",
        alert
      });
    } catch (error: any) {
      console.error("Quick test failed:", error);
      res.status(500).json({ 
        success: false,
        message: "Quick test failed",
        error: error.message 
      });
    }
  });

  // Test weather data specifically
  app.get("/api/test/weather", async (req, res) => {
    try {
      const { getWeatherData } = await import("./services/weather");
      
      console.log('🌤️ === WEATHER API DEBUG TEST STARTING ===');
      
      // Check environment variables first
      const apiKeyStatus = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
      console.log(`🔑 API Key Status: ${apiKeyStatus ? 'Present' : 'Missing'}`);
      console.log(`🔑 API Key Value: ${apiKeyStatus ? `${apiKeyStatus.substring(0, 8)}...` : 'None'}`);
      console.log(`🔑 Is placeholder key: ${apiKeyStatus === "default_key" || apiKeyStatus === "your_actual_openweathermap_api_key_here"}`);
      
      const testCities = [
        'New York', 'Los Angeles', 'Chicago', 'Phoenix', 
        'Miami', 'Boston', 'Denver', 'Seattle',
        'Kansas City', 'Tampa', 'Arlington'
      ];
      
      const weatherResults = [];
      
      for (const city of testCities) {
        console.log(`\n🌤️ Testing weather for: ${city}`);
        try {
          const weatherData = await getWeatherData(city);
          console.log(`✅ Success for ${city}:`, weatherData);
          weatherResults.push({
            city,
            status: 'success',
            data: weatherData,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.log(`❌ Failed for ${city}:`, error);
          weatherResults.push({
            city,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Test problematic team names
      console.log('\n🏟️ Testing problematic team names:');
      const problemTeams = ['Kansas City Royals', 'New York Yankees', 'Los Angeles Dodgers'];
      const teamResults = [];
      
      for (const team of problemTeams) {
        console.log(`🏟️ Testing: ${team}`);
        try {
          const weatherData = await getWeatherData(team);
          console.log(`✅ Team success for ${team}:`, weatherData);
          teamResults.push({
            team,
            status: 'success',
            data: weatherData
          });
        } catch (error) {
          console.log(`❌ Team failed for ${team}:`, error);
          teamResults.push({
            team,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      console.log('🌤️ === WEATHER API DEBUG TEST COMPLETE ===\n');
      
      res.json({
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!(apiKeyStatus && 
          apiKeyStatus !== "default_key" && 
          apiKeyStatus !== "your_actual_openweathermap_api_key_here"),
        apiKey: apiKeyStatus ? `${apiKeyStatus.substring(0, 8)}...` : 'Not configured',
        cityResults: weatherResults,
        teamResults: teamResults,
        summary: {
          cities: {
            total: weatherResults.length,
            successful: weatherResults.filter(r => r.status === 'success').length,
            failed: weatherResults.filter(r => r.status === 'failed').length
          },
          teams: {
            total: teamResults.length,
            successful: teamResults.filter(r => r.status === 'success').length,
            failed: teamResults.filter(r => r.status === 'failed').length
          }
        }
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Weather test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test all data feeds
  app.get("/api/test/data-feeds", async (req, res) => {
    try {
      const feedStatus = {
        timestamp: new Date().toISOString(),
        feeds: {
          mlb: { status: 'unknown' as string, games: 0, error: null as string | null },
          nfl: { status: 'unknown' as string, games: 0, error: null as string | null },
          nba: { status: 'unknown' as string, games: 0, error: null as string | null },
          nhl: { status: 'unknown' as string, games: 0, error: null as string | null },
          weather: { status: 'unknown' as string, data: null as any, error: null as string | null },
          sportsDataApi: { status: 'unknown' as string, configured: false }
        }
      };

      // Test MLB API
      try {
        const mlbGames = await import("./services/mlb-api").then(m => m.mlbApi.getTodaysGames());
        feedStatus.feeds.mlb = { 
          status: 'success', 
          games: mlbGames.length, 
          error: null 
        };
      } catch (error) {
        feedStatus.feeds.mlb = { 
          status: 'failed', 
          games: 0, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      // Test SportsData.io API key
      const sportsDataKey = process.env.SPORTSDATA_API_KEY;
      feedStatus.feeds.sportsDataApi = {
        status: sportsDataKey && sportsDataKey !== 'your_sportsdata_api_key_here' ? 'configured' : 'missing',
        configured: !!(sportsDataKey && sportsDataKey !== 'your_sportsdata_api_key_here')
      };

      // Test SportsData.io feeds
      const { sportsDataService } = await import("./services/sportsdata-api");
      
      for (const sport of ['NFL', 'NBA', 'NHL'] as const) {
        try {
          const games = await sportsDataService[`get${sport}Games`]();
          feedStatus.feeds[sport.toLowerCase() as 'nfl' | 'nba' | 'nhl'] = { 
            status: 'success', 
            games: games.length, 
            error: null 
          };
        } catch (error) {
          feedStatus.feeds[sport.toLowerCase() as 'nfl' | 'nba' | 'nhl'] = { 
            status: 'failed', 
            games: 0, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }

      // Test Weather API
      try {
        const weatherData = await import("./services/weather").then(m => m.getWeatherData("New York"));
        feedStatus.feeds.weather = { 
          status: weatherData ? 'success' : 'failed', 
          data: weatherData, 
          error: weatherData ? null : 'API key or location issue' 
        };
      } catch (error) {
        feedStatus.feeds.weather = { 
          status: 'failed', 
          data: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      res.json(feedStatus);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to test data feeds', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test endpoint to trigger alerts for all sports
  app.post("/api/test/generate-alerts", async (req, res) => {
    try {
      const testAlerts = [];
      const timestamp = new Date().toISOString();
      
      // Test MLB Alert - RISP scenario
      const mlbAlert = {
        type: "RISP",
        sport: "MLB",
        title: "Test MLB Game: Yankees @ Red Sox",
        description: "Bases loaded, 2 outs in the 9th inning! High scoring opportunity",
        gameInfo: {
          homeTeam: "Boston Red Sox",
          awayTeam: "New York Yankees",
          status: "Live",
          inning: "9",
          inningState: "bottom",
          outs: 2,
          balls: 3,
          strikes: 2,
          runners: { first: true, second: true, third: true },
          scoringProbability: 0.78
        }
      };

      // Test NFL Alert - Red Zone
      const nflAlert = {
        type: "Red Zone",
        sport: "NFL",
        title: "Test NFL Game: Cowboys @ Eagles",
        description: "Red zone opportunity! Cowboys at the 15-yard line",
        gameInfo: {
          homeTeam: "Philadelphia Eagles",
          awayTeam: "Dallas Cowboys",
          status: "Live",
          quarter: "4",
          timeRemaining: "2:35",
          down: 3,
          yardsToGo: 7,
          possession: "Cowboys",
          redZone: true
        }
      };

      // Test NBA Alert - Clutch Time
      const nbaAlert = {
        type: "Clutch Time",
        sport: "NBA",
        title: "Test NBA Game: Lakers @ Celtics",
        description: "Clutch time! 3-point game with 45 seconds left",
        gameInfo: {
          homeTeam: "Boston Celtics",
          awayTeam: "Los Angeles Lakers",
          status: "Live",
          period: "4",
          timeRemaining: "0:45",
          clutchTime: true,
          overtime: false
        }
      };

      // Test NHL Alert - Power Play
      const nhlAlert = {
        type: "Power Play",
        sport: "NHL",
        title: "Test NHL Game: Rangers @ Bruins",
        description: "Power play opportunity for the Rangers!",
        gameInfo: {
          homeTeam: "Boston Bruins",
          awayTeam: "New York Rangers",
          status: "Live",
          period: "3",
          timeRemaining: "5:23",
          powerPlay: true,
          emptyNet: false
        }
      };

      // Create test alerts
      for (const alertData of [mlbAlert, nflAlert, nbaAlert, nhlAlert]) {
        try {
          const teamCityMap: Record<string, string> = {
            'Los Angeles Angels': 'Los Angeles', 'Los Angeles Dodgers': 'Los Angeles',
            'Oakland Athletics': 'Oakland', 'San Francisco Giants': 'San Francisco', 
            'Athletics': 'Oakland', 'Seattle Mariners': 'Seattle', 'Texas Rangers': 'Arlington',
            'Houston Astros': 'Houston', 'Minnesota Twins': 'Minneapolis',
            'Kansas City Royals': 'Kansas City', 'Chicago White Sox': 'Chicago',
            'Chicago Cubs': 'Chicago', 'Cleveland Guardians': 'Cleveland',
            'Detroit Tigers': 'Detroit', 'Milwaukee Brewers': 'Milwaukee',
            'St. Louis Cardinals': 'St. Louis', 'Atlanta Braves': 'Atlanta',
            'Miami Marlins': 'Miami', 'New York Yankees': 'New York',
            'New York Mets': 'New York', 'Philadelphia Phillies': 'Philadelphia',
            'Washington Nationals': 'Washington', 'Boston Red Sox': 'Boston',
            'Toronto Blue Jays': 'Toronto', 'Baltimore Orioles': 'Baltimore',
            'Tampa Bay Rays': 'Tampa', 'Pittsburgh Pirates': 'Pittsburgh',
            'Cincinnati Reds': 'Cincinnati', 'Colorado Rockies': 'Denver',
            'Arizona Diamondbacks': 'Phoenix', 'San Diego Padres': 'San Diego'
          };
          
          const cityName = teamCityMap[alertData.gameInfo.homeTeam] || alertData.gameInfo.homeTeam;
          const weatherData = await getWeatherData(cityName);
          
          const alert = await storage.createAlert({
            ...alertData,
            weatherData,
            sentToTelegram: false
          });

          testAlerts.push(alert);
          
          // Broadcast to WebSocket clients
          broadcast({ type: 'new_alert', data: alert });
        } catch (error) {
          console.error(`Failed to create ${alertData.sport} test alert:`, error);
        }
      }

      res.json({
        message: "Test alerts generated successfully",
        count: testAlerts.length,
        alerts: testAlerts,
        timestamp
      });
    } catch (error) {
      console.error("Test alert generation failed:", error);
      res.status(500).json({ message: "Failed to generate test alerts" });
    }
  });

  // Debug route for enhanced weather testing
  app.get('/api/debug/weather/:venue', async (req, res) => {
    try {
      const { getEnhancedWeather } = await import('./services/enhanced-weather');
      const wx = await getEnhancedWeather(req.params.venue);
      res.json(wx);
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    }
  });

  // Test route for all stadiums weather
  app.get('/api/debug/weather-all', async (req, res) => {
    try {
      const { getEnhancedWeather } = await import('./services/enhanced-weather');
      const { STADIUMS } = await import('./services/weather/stadiums');
      
      const results = [];
      const stadiumNames = Object.keys(STADIUMS).slice(0, 5); // Test first 5 to avoid rate limits
      
      for (const stadiumKey of stadiumNames) {
        try {
          const wx = await getEnhancedWeather(stadiumKey);
          results.push({
            stadium: stadiumKey,
            weather: wx,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          results.push({
            stadium: stadiumKey,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.json({
        testedStadiums: results.length,
        totalStadiums: Object.keys(STADIUMS).length,
        results
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
