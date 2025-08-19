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
import { checkAlerts, generateGameContext, filterAlertsBySettings } from "./services/alertEngine";

// Removed mock data generators - only using real ESPN API data

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

      // Sort alerts by timestamp descending (newest first)
      const sortedAlerts = alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(sortedAlerts);
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

  // Delete alert
  app.delete("/api/alerts/:alertId", async (req, res) => {
    try {
      const { alertId } = req.params;
      
      const deleted = await storage.deleteAlert(alertId);
      if (!deleted) {
        return res.status(404).json({ message: "Alert not found" });
      }

      // Broadcast alert deletion to connected clients
      broadcast({ type: 'alert_deleted', data: { alertId } });

      res.json({ message: "Alert deleted successfully" });
    } catch (error) {
      console.error("Failed to delete alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
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

      // Get AI analysis and check advanced alerts
      const settings = await storage.getSettingsBySport(alertData.sport);
      
      // Use the advanced alert engine to generate context-aware alerts
      const gameContext = generateGameContext(event.game);
      const potentialAlerts = checkAlerts(gameContext);
      const filteredAlerts = filterAlertsBySettings(potentialAlerts, settings || {});
      
      // If no alerts pass the filter, don't create an alert
      if (filteredAlerts.length === 0) {
        return res.json({ message: "Alert filtered out by user settings" });
      }
      
      // Use the first available alert
      const topAlert = filteredAlerts[0];
      
      // Update alert data with engine results
      alertData.title = `${event.game.homeTeam} - ${topAlert}`;
      alertData.description = topAlert;
      
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

  // Real-time alert generation using ESPN API data - no mock data
  const gameStates = new Map(); // Track previous game states for change detection
  
  console.log('🚀 Starting real-time alert generation system...');
  
  setInterval(async () => {
    console.log('⚡ Alert generation cycle starting...');
    try {
      // Get today's live games from ESPN API
      const gamesData = await liveSportsService.getTodaysGames();
      const allGames = gamesData.games || [];
      const liveGames = allGames.filter(game => game.status === 'live');
      
      // Debug: Log game data for verification
      console.log(`Found ${allGames.length} total games, ${liveGames.length} live games`);
      
      if (liveGames.length === 0) {
        // If no live games, check for close scheduled/final games with scores for testing
        const gamesWithScores = allGames.filter(game => 
          (game.status === 'final' || game.status === 'live') && 
          (game.score?.home > 0 || game.score?.away > 0)
        );
        if (gamesWithScores.length > 0) {
          console.log(`Using ${gamesWithScores.length} completed/final games for score verification`);
          // Use these for testing score extraction
          for (const game of gamesWithScores.slice(0, 1)) { // Just test one
            console.log(`Score test - ${game.awayTeam.name} ${game.score?.away || 0} - ${game.score?.home || 0} ${game.homeTeam.name}`);
          }
        }
        return; // No live games, no alerts
      }

      // Check each live game for real events
      for (const game of liveGames) {
        const gameId = game.id;
        const homeScore = game.score?.home || 0;
        const awayScore = game.score?.away || 0;
        const previousState = gameStates.get(gameId);
        
        // Debug: Log scores to verify correct extraction
        console.log(`Game ${game.awayTeam.name} @ ${game.homeTeam.name}: Away ${awayScore} - Home ${homeScore} (Status: ${game.status})`);
        
        // Skip if this is the first time seeing this game
        if (!previousState) {
          gameStates.set(gameId, { homeScore, awayScore, lastAlertTime: Date.now() });
          continue;
        }
        
        // Check for score changes (real events)
        const homeScored = homeScore > previousState.homeScore;
        const awayScored = awayScore > previousState.awayScore;
        const scoreDiff = Math.abs(homeScore - awayScore);
        const totalScore = homeScore + awayScore;
        
        // Generate ACCURATE PREDICTIVE alerts based only on verifiable game states
        let alertType = null;
        let alertDescription = null;
        
        // Only generate alerts based on actual game data we can verify
        if (game.sport === 'MLB') {
          // Close game alerts (100% accurate based on score)
          if (scoreDiff <= 1 && totalScore >= 5) {
            const timeSinceLastAlert = Date.now() - (previousState.lastAlertTime || 0);
            if (timeSinceLastAlert > 600000) { // 10 minutes between alerts
              alertType = "High Leverage Situation";
              alertDescription = `${scoreDiff === 0 ? 'Tie game' : 'One-run game'}! ${game.awayTeam.name} ${awayScore} - ${homeScore} ${game.homeTeam.name} - Critical betting moment`;
            }
          }
          // Comeback opportunity (verifiable from scores)
          else if (scoreDiff >= 2 && scoreDiff <= 3 && totalScore >= 6) {
            const timeSinceLastAlert = Date.now() - (previousState.lastAlertTime || 0);
            if (timeSinceLastAlert > 900000) { // 15 minutes between alerts
              alertType = "Comeback Opportunity";
              alertDescription = `${scoreDiff}-run game. ${awayScore > homeScore ? game.homeTeam.name : game.awayTeam.name} within striking distance!`;
            }
          }
        } else if (game.sport === 'NFL') {
          // NFL one-score game alerts
          if (scoreDiff <= 8 && totalScore >= 14) {
            const timeSinceLastAlert = Date.now() - (previousState.lastAlertTime || 0);
            if (timeSinceLastAlert > 600000) {
              alertType = "NFL One-Score Game";
              alertDescription = `${scoreDiff <= 3 ? 'Field goal' : 'Touchdown'} difference! ${game.awayTeam.name} ${awayScore} - ${homeScore} ${game.homeTeam.name}`;
            }
          }
        } else if (game.sport === 'NBA') {
          // NBA clutch time (verifiable from scores)
          if (scoreDiff <= 5 && totalScore >= 160) {
            const timeSinceLastAlert = Date.now() - (previousState.lastAlertTime || 0);
            if (timeSinceLastAlert > 600000) {
              alertType = "NBA Clutch Time";
              alertDescription = `${scoreDiff}-point game! ${game.awayTeam.name} ${awayScore} - ${homeScore} ${game.homeTeam.name} - Every possession critical`;
            }
          }
        } else if (game.sport === 'NHL') {
          // NHL close game (verifiable from scores)
          if (scoreDiff <= 1 && totalScore >= 2) {
            const timeSinceLastAlert = Date.now() - (previousState.lastAlertTime || 0);
            if (timeSinceLastAlert > 600000) {
              alertType = "NHL Tight Game";
              alertDescription = `${scoreDiff === 0 ? 'Tie game' : 'One-goal game'}! ${game.awayTeam.name} ${awayScore} - ${homeScore} ${game.homeTeam.name}`;
            }
          }
        }
        
        // Create alert if we have a real event
        if (alertType && alertDescription) {
          const weatherData = await getWeatherData(game.homeTeam.name);
          
          const alertData = {
            type: alertType,
            sport: game.sport,
            title: `${game.awayTeam.name} @ ${game.homeTeam.name}`,
            description: alertDescription,
            gameInfo: {
              score: { away: awayScore, home: homeScore },
              scoreDiff,
              totalScore,
              status: 'Live',
              awayTeam: game.awayTeam.name,
              homeTeam: game.homeTeam.name,
              venue: game.venue || 'TBD'
            },
            weatherData,
            aiContext: undefined as string | undefined,
            aiConfidence: 0,
            sentToTelegram: false,
          };

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

          broadcast({ type: 'new_alert', data: alert });
          console.log(`Real alert generated: ${alertType} for ${game.homeTeam.name} vs ${game.awayTeam.name}`);
          
          // Update game state with alert timing
          const newState = { 
            homeScore, 
            awayScore, 
            totalScore,
            lastAlertTime: Date.now(),
            lastAlertTime: Date.now()
          };
          gameStates.set(gameId, newState);
        } else {
          // Update game state even if no alert
          gameStates.set(gameId, { 
            homeScore, 
            awayScore, 
            totalScore,
            lastAlertTime: previousState.lastAlertTime
          });
        }
      }
      
      // Simple predictive alerts based on game situations (no complex API mapping needed)
      // Focus on situations that create betting opportunities BEFORE they resolve
      
      // Check for late-game pressure in close MLB games
      const mlbGames = liveGames.filter(game => game.sport === 'MLB');
      for (const game of mlbGames) {
        const gameId = `${game.id}-pressure`;
        const previousPressureState = gameStates.get(gameId);
        const scoreDiff = Math.abs((game.score?.home || 0) - (game.score?.away || 0));
        const totalScore = (game.score?.home || 0) + (game.score?.away || 0);
        const timeSinceLastPressureAlert = Date.now() - (previousPressureState?.lastAlertTime || 0);
        
        // Generate pressure situation alerts
        if (scoreDiff <= 1 && totalScore >= 6 && timeSinceLastPressureAlert > 900000) { // 15 minutes between pressure alerts
          const alertData = {
            type: "High Pressure Situation",
            sport: game.sport,
            title: `${game.awayTeam.name} @ ${game.homeTeam.name}`,
            description: `One-run game! ${game.awayTeam.name} ${game.score?.away || 0} - ${game.score?.home || 0} ${game.homeTeam.name} - High-value betting opportunity`,
            gameInfo: {
              score: game.score,
              status: 'Live',
              awayTeam: game.awayTeam.name,
              homeTeam: game.homeTeam.name,
              venue: game.venue || 'TBD',
              situation: 'One-run game - maximum pressure'
            },
            weatherData: await getWeatherData(game.homeTeam.name),
            aiContext: undefined as string | undefined,
            aiConfidence: 0,
            sentToTelegram: false,
          };

          const settings = await storage.getSettingsBySport(alertData.sport);
          if (settings?.aiEnabled) {
            const analysis = await analyzeAlert(
              alertData.type,
              alertData.sport,
              alertData.gameInfo,
              alertData.weatherData
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

            const sent = await sendTelegramAlert(telegramConfig, {
              ...alert,
              aiContext: alert.aiContext || undefined
            });
            if (sent) {
              await storage.markAlertSentToTelegram(alert.id);
            }
          }

          broadcast({ type: 'new_alert', data: alert });
          console.log(`🔥 PRESSURE ALERT: ${game.homeTeam.name} vs ${game.awayTeam.name} - One-run game!`);
          
          // Update last pressure alert time
          gameStates.set(gameId, { lastAlertTime: Date.now() });
        }
      }
    } catch (error) {
      console.error("🚨 Real-time alert generation error:", error);
      if (error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
    }
  }, 30000); // Check for real game changes every 30 seconds


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

  // Auth status endpoint with enhanced debugging
  app.get("/api/auth/me", async (req, res) => {
    try {
      const session = req.session as any;
      console.log(`Auth check - Session ID: ${req.sessionID}, User ID: ${session?.userId}, Session exists: ${!!session}`);
      
      if (!session || !session.userId) {
        console.log('No valid session found');
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        console.log(`User not found in database: ${session.userId}`);
        return res.status(401).json({ message: "User not found" });
      }

      console.log(`Auth successful for user: ${user.username}`);
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
      console.log(`Login attempt for user: ${username}`);
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`User not found: ${username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check password (in production, use proper password hashing)
      if (user.password !== password) {
        console.log(`Invalid password for user: ${username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Start session with regeneration for security
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
        }
        
        (req.session as any).userId = user.id;
        (req.session as any).username = user.username;
        
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Session error" });
          }
          
          console.log(`User ${username} logged in successfully with session ID: ${req.sessionID}`);
          res.json({ 
            id: user.id, 
            username: user.username,
            message: "Login successful" 
          });
        });
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
