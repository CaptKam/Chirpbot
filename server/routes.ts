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
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  function broadcast(data: any) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
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
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      let alerts;
      if (sport) {
        alerts = await storage.getAlertsBySport(sport);
      } else if (type) {
        alerts = await storage.getAlertsByType(type);
      } else {
        alerts = await storage.getRecentAlerts(limit);
      }

      res.json(alerts);
    } catch (error) {
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

        const sent = await sendTelegramAlert(telegramConfig, alert);
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

  // Real-time alert generation for live games only
  setInterval(async () => {
    try {
      // Get today's games (now includes official MLB.com data)
      const gamesData = await liveSportsService.getTodaysGames();
      const liveGames = gamesData.games.filter(game => 
        game.status === 'live' || game.isLive === true
      );
      
      if (liveGames.length === 0) {
        console.log('No live games found, skipping alert generation');
        return;
      }

      console.log(`Found ${liveGames.length} live games for alert generation`);

      // Only generate alerts for actually live games
      const randomLiveGame = liveGames[Math.floor(Math.random() * liveGames.length)];
      
      // Check if alerts are enabled for this sport
      const settings = await storage.getSettingsBySport(randomLiveGame.sport);
      if (!settings?.aiEnabled) {
        console.log(`Alerts disabled for ${randomLiveGame.sport}, skipping`);
        return;
      }
      
      // Generate realistic event based on sport
      const eventTypes = randomLiveGame.sport === 'MLB' 
        ? [
            { type: "RISP Opportunity", probability: 0.8 },
            { type: "BASES LOADED", probability: 0.6 }, 
            { type: "High Pressure Situation", probability: 0.7 },
            { type: "NFL Close Game", probability: 0.5 }
          ]
        : randomLiveGame.sport === 'NFL'
        ? [{ type: "NFL Close Game", probability: 0.8 }]
        : randomLiveGame.sport === 'NBA'
        ? [{ type: "ClutchTime", probability: 0.7 }]
        : [];

      if (eventTypes.length === 0) return;

      const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      // Higher probability for testing
      if (Math.random() > 0.8) return;

      const weatherData = await getWeatherData(randomLiveGame.homeTeam.name);
      
      // Create realistic alert data using actual game information
      const alertData = {
        type: randomEvent.type,
        sport: randomLiveGame.sport,
        title: `${randomLiveGame.homeTeam.name} @ ${randomLiveGame.awayTeam.name}`,
        description: generateAlertDescription(randomEvent.type, randomLiveGame),
        gameInfo: {
          score: { 
            away: randomLiveGame.awayTeam.score || Math.floor(Math.random() * 15), 
            home: randomLiveGame.homeTeam.score || Math.floor(Math.random() * 15) 
          },
          inning: randomLiveGame.inning || (randomLiveGame.sport === 'MLB' ? Math.floor(Math.random() * 9) + 1 : undefined),
          quarter: randomLiveGame.sport === 'NFL' ? `${Math.floor(Math.random() * 4) + 1}` : undefined,
          status: 'Live',
          awayTeam: randomLiveGame.awayTeam.name,
          homeTeam: randomLiveGame.homeTeam.name
        },
        weatherData,
        aiContext: undefined as string | undefined,
        aiConfidence: 0,
        sentToTelegram: false,
      };
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

      if (settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
          chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
        };

        const sent = await sendTelegramAlert(telegramConfig, alert);
        if (sent) {
          await storage.markAlertSentToTelegram(alert.id);
        }
      }

      broadcast({ type: 'new_alert', data: alert });
      console.log(`Generated alert for live game: ${randomLiveGame.homeTeam.name} vs ${randomLiveGame.awayTeam.name}`);
    } catch (error) {
      console.error("Live game alert generation error:", error);
    }
  }, 60000 + Math.random() * 60000); // 1-2 minutes

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

  return httpServer;
}
