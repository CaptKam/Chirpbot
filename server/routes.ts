import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamSchema, insertAlertSchema, insertSettingsSchema } from "@shared/schema";
import { analyzeAlert } from "./services/openai";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { getWeatherData } from "./services/weather";
import { sportsService, type SportsEvent } from "./services/sports";
import { liveSportsService } from "./services/live-sports";

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
      
      // Get weather data for the game location
      let weatherData = null;
      if (validatedData.gameInfo.homeTeam) {
        weatherData = await getWeatherData(validatedData.gameInfo.homeTeam);
      }

      // Get AI analysis if enabled
      let aiContext: string | undefined = undefined;
      let aiConfidence = 0;

      const settings = await storage.getSettingsBySport(validatedData.sport);
      if (settings?.aiEnabled) {
        const analysis = await analyzeAlert(
          validatedData.type,
          validatedData.sport,
          validatedData.gameInfo,
          weatherData
        );
        aiContext = analysis.context;
        aiConfidence = analysis.confidence;
      }

      const alert = await storage.createAlert({
        ...validatedData,
        aiContext,
        aiConfidence,
        weatherData,
      });

      // Send to Telegram if enabled
      if (settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
          chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
        };

        const sent = await sendTelegramAlert(telegramConfig, {
          ...alert,
          aiContext: alert.aiContext || undefined
        });
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

  // Telegram test route
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

  // Simulate sports events (for development)
  app.post("/api/sports/simulate", async (req, res) => {
    try {
      const event = sportsService.generateSportsEvent();
      if (!event) {
        return res.json({ message: "No event generated" });
      }

      // Create alert from the simulated event
      const weatherData = await getWeatherData(event.game.homeTeam);
      
      const alertData = {
        type: event.type,
        sport: event.type.includes("RedZone") ? "NFL" : event.type.includes("ClutchTime") ? "NBA" : "MLB",
        title: `${event.game.homeTeam} - ${event.type} Alert`,
        description: event.description,
        gameInfo: event.game,
        weatherData,
        aiContext: undefined as string | undefined,
        aiConfidence: 0,
        sentToTelegram: false,
      };

      // Get AI analysis
      const settings = await storage.getSettingsBySport(alertData.sport);
      if (settings?.aiEnabled) {
        const analysis = await analyzeAlert(
          alertData.type,
          alertData.sport,
          alertData.gameInfo,
          weatherData
        );
        alertData.aiContext = analysis.context;
        alertData.aiConfidence = analysis.confidence;
      }

      const alert = await storage.createAlert(alertData);

      // Send to Telegram if enabled
      if (settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
          chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
        };

        const sent = await sendTelegramAlert(telegramConfig, {
          ...alert,
          aiContext: alert.aiContext || undefined
        });
        if (sent) {
          await storage.markAlertSentToTelegram(alert.id);
        }
      }

      // Broadcast new alert
      broadcast({ type: 'new_alert', data: alert });

      res.json(alert);
    } catch (error) {
      console.error("Failed to simulate sports event:", error);
      res.status(500).json({ message: "Failed to simulate event" });
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
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters long" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create new user (in production, hash the password)
      const user = await storage.createUser({ username, password });
      
      // Start session
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;

      res.json({ 
        id: user.id, 
        username: user.username,
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

      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Failed to check authentication" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
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
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check password (in production, use proper password hashing)
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Start session
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;

      res.json({ 
        id: user.id, 
        username: user.username,
        message: "Login successful" 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    const session = req.session as any;
    if (session?.userId) {
      res.json({ 
        id: session.userId, 
        username: session.username,
        isAuthenticated: true 
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
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

      // Create alerts with AI analysis
      for (const alertData of [mlbAlert, nflAlert, nbaAlert, nhlAlert]) {
        try {
          const weatherData = await getWeatherData(alertData.gameInfo.homeTeam);
          
          // Get AI analysis
          const settings = await storage.getSettingsBySport(alertData.sport);
          let aiContext = undefined;
          let aiConfidence = 85;
          
          if (settings?.aiEnabled) {
            const analysis = await analyzeAlert(
              alertData.type,
              alertData.sport,
              alertData.gameInfo,
              weatherData
            );
            aiContext = analysis.context;
            aiConfidence = analysis.confidence;
          }

          const alert = await storage.createAlert({
            ...alertData,
            aiContext,
            aiConfidence,
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

  return httpServer;
}
