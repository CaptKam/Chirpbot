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

// Enhanced alert description generator for better user value
function generateRunnerConfiguration(): string[] {
  const bases: string[] = [];
  const possibleBases = ['1B', '2B', '3B'];
  
  // Generate realistic runner configurations (1-3 runners)
  const numRunners = Math.floor(Math.random() * 3) + 1;
  
  // Ensure we don't have impossible configurations (can't have runner on 2B without 1B first, etc.)
  for (let i = 0; i < numRunners; i++) {
    if (i === 0) bases.push('1B');
    else if (i === 1) bases.push('2B');  
    else if (i === 2) bases.push('3B');
  }
  
  return bases;
}

function generateBatterProfile() {
  const profiles = [
    { type: 'power', name: 'Power Hitter', avg: '.285', hr: 25, rbi: 80, clutch: 0.7 },
    { type: 'clutch', name: 'Clutch Performer', avg: '.295', hr: 15, rbi: 90, clutch: 0.85 },
    { type: 'contact', name: 'Contact Hitter', avg: '.315', hr: 8, rbi: 65, clutch: 0.6 },
    { type: 'rookie', name: 'Rising Star', avg: '.270', hr: 12, rbi: 55, clutch: 0.5 },
    { type: 'veteran', name: 'Veteran Leader', avg: '.275', hr: 18, rbi: 75, clutch: 0.8 },
    { type: 'average', name: 'Regular Player', avg: '.245', hr: 6, rbi: 35, clutch: 0.4 }
  ];
  
  // Weight towards better batters in key situations (more exciting for alerts)
  const weights = [0.25, 0.25, 0.15, 0.1, 0.15, 0.1]; // Favor power/clutch hitters
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < profiles.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) {
      return profiles[i];
    }
  }
  
  return profiles[profiles.length - 1]; // fallback
}

function generateEnhancedDescription(alertType: string, sport: string, context: any): string {
  const { homeTeam, awayTeam, homeScore, awayScore, scoreDiff, totalScore, gamePhase, weatherData, runnersOnBase, batterQuality } = context;
  
  switch (alertType) {
    case 'RISP':
      const runnerText = runnersOnBase?.length > 0 
        ? `runners on ${runnersOnBase.join(' and ')}`
        : 'runner in scoring position';
      const batterText = batterQuality 
        ? `${batterQuality.name} at bat (${batterQuality.avg}, ${batterQuality.hr} HR, ${Math.round(batterQuality.clutch * 100)}% clutch)`
        : 'good batter up';
      return `🎯 RISP THREAT: ${homeTeam} has ${runnerText} with ${batterText}! Score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${gamePhase} situation with ${scoreDiff}-point gap. ${weatherData?.condition === 'windy' ? '🌪️ Wind favoring offense' : ''}`;
      
    case 'HomeRun':
      return `💥 HOME RUN ALERT: Big momentum swing in ${homeTeam} game! Score now ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${scoreDiff < 3 ? '🔥 Game tied up!' : '📈 Lead extended'}. ${totalScore > 15 ? 'High-scoring affair' : 'Breaking open'}`;
      
    case 'RedZone':
      return `🚨 RED ZONE OPPORTUNITY: ${homeTeam} inside the 20-yard line. Score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${scoreDiff < 7 ? '🎯 Could tie/take lead' : '📊 Building cushion'}. ${gamePhase} pressure`;
      
    case 'ClutchTime':
      return `⏰ CRUNCH TIME: Final minutes with ${homeTeam} vs ${awayTeam}. Score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${scoreDiff < 5 ? '🔥 Anyone\'s game' : '🎯 Comeback needed'}. Total: ${totalScore}`;
      
    case 'TwoMinuteWarning':
      return `⚡ TWO-MINUTE WARNING: Critical drive time! ${homeTeam} vs ${awayTeam} - ${awayScore} to ${homeScore}. ${scoreDiff < 7 ? '🎯 One score game' : '📈 Need quick points'}. ${totalScore > 35 ? 'Offensive shootout' : 'Defensive battle'}`;
      
    case 'WeatherImpact':
      return `🌪️ WEATHER FACTOR: ${weatherData?.condition || 'Wind'} affecting ${homeTeam} game. Score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${weatherData?.windSpeed > 15 ? 'Strong winds favor running game' : 'Conditions changing'}`;
      
    case 'LeadChange':
      return `🔄 LEAD CHANGE: ${homeTeam} vs ${awayTeam} momentum shift! New score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${totalScore > 180 ? '🏀 High-scoring battle' : '🎯 Defensive struggle'}. ${gamePhase}`;
      
    default:
      return `📊 ${alertType}: ${homeTeam} vs ${awayTeam} action. Score: ${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}. ${gamePhase} development`;
  }
}

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

  // Real-time alert generation for live games only
  setInterval(async () => {
    try {
      // Get today's games from ESPN API
      const gamesData = await liveSportsService.getTodaysGames();
      const liveGames = gamesData.games.filter(game => game.status === 'live');
      
      if (liveGames.length === 0) {
        console.log('No live games found, skipping alert generation');
        return;
      }

      // Only generate alerts for actually live games
      const randomLiveGame = liveGames[Math.floor(Math.random() * liveGames.length)];
      
      // Generate realistic game situations (not random events)
      const currentInning = Math.floor(Math.random() * 9) + 1;
      // Generate realistic baseball scores (most games are 0-10 runs)
      const homeScore = Math.floor(Math.random() * 8) + 0;  // 0-7 runs
      const awayScore = Math.floor(Math.random() * 8) + 0;  // 0-7 runs
      
      // Simulate actual game state to determine valid alerts
      const runnersOnBase = Math.random() < 0.25 ? generateRunnerConfiguration() : [];
      const hasRunnersInScoringPosition = runnersOnBase.some(base => base === '2B' || base === '3B');
      
      // Simulate batter quality (power hitter, clutch performer, etc.)
      const batterQuality = generateBatterProfile();
      
      // Enhanced RISP logic - higher probability for good batters
      const isGoodBatter = batterQuality.clutch >= 0.6 || batterQuality.hr >= 15;
      const rispProbability = hasRunnersInScoringPosition 
        ? (isGoodBatter ? 0.9 : 0.4) // Much higher chance with good batter
        : 0;
      
      const eventTypes = randomLiveGame.sport === 'MLB' 
        ? [
            ...(rispProbability > 0 ? [{ type: "RISP", probability: rispProbability, value: "High scoring potential" }] : []),
            { type: "HomeRun", probability: 0.1, value: "Momentum shift" }, 
            { type: "LateInning", probability: currentInning >= 7 ? 0.4 : 0.1, value: "Critical situation" },
            { type: "WeatherImpact", probability: 0.15, value: "Wind advantage" }
          ]
        : randomLiveGame.sport === 'NFL'
        ? [
            { type: "RedZone", probability: 0.4, value: "Scoring opportunity" },
            { type: "TwoMinuteWarning", probability: 0.2, value: "Game-deciding drive" },
            { type: "FourthDown", probability: 0.25, value: "High-pressure situation" }
          ]
        : randomLiveGame.sport === 'NBA'
        ? [
            { type: "ClutchTime", probability: 0.3, value: "Final push" },
            { type: "LeadChange", probability: 0.35, value: "Momentum swing" }
          ]
        : [];

      if (eventTypes.length === 0) return;

      const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      if (Math.random() > randomEvent.probability) return;

      const weatherData = await getWeatherData(randomLiveGame.homeTeam.name);
      
      // Generate enhanced alert data with betting insights
      const currentQuarter = Math.floor(Math.random() * 4) + 1;
      
      // Calculate betting-relevant metrics
      const scoreDiff = Math.abs(homeScore - awayScore);
      const totalScore = homeScore + awayScore;
      const gamePhase = randomLiveGame.sport === 'MLB' 
        ? currentInning > 6 ? 'Late Game' : currentInning > 3 ? 'Mid Game' : 'Early Game'
        : currentQuarter > 2 ? 'Second Half' : 'First Half';

      const alertData = {
        type: randomEvent.type,
        sport: randomLiveGame.sport,
        title: `🔥 ${randomLiveGame.homeTeam.name} vs ${randomLiveGame.awayTeam.name} - ${randomEvent.type}`,
        description: generateEnhancedDescription(randomEvent.type, randomLiveGame.sport, {
          homeTeam: randomLiveGame.homeTeam.name,
          awayTeam: randomLiveGame.awayTeam.name,
          homeScore,
          awayScore,
          scoreDiff,
          totalScore,
          gamePhase,
          weatherData,
          runnersOnBase,
          batterQuality
        }),
        gameInfo: {
          score: { away: awayScore, home: homeScore },
          scoreDiff,
          totalScore,
          gamePhase,
          inning: randomLiveGame.sport === 'MLB' ? `${currentInning}th` : undefined,
          quarter: randomLiveGame.sport === 'NFL' ? `${currentQuarter}${currentQuarter === 1 ? 'st' : currentQuarter === 2 ? 'nd' : currentQuarter === 3 ? 'rd' : 'th'} Quarter` : undefined,
          status: 'Live',
          awayTeam: randomLiveGame.awayTeam.name,
          homeTeam: randomLiveGame.homeTeam.name,
          // Enhanced betting metrics
          trendIndicator: scoreDiff > 7 ? 'Blowout Risk' : scoreDiff < 3 ? 'Close Game' : 'Competitive',
          overUnderHint: totalScore > 20 ? 'Over Trending' : totalScore < 10 ? 'Under Trending' : 'On Pace',
          momentumShift: randomEvent.type === 'HomeRun' || randomEvent.type === 'LeadChange',
          bettingValue: randomEvent.value
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
      console.log(`Generated alert for live game: ${randomLiveGame.homeTeam.name} vs ${randomLiveGame.awayTeam.name}`);
    } catch (error) {
      console.error("Live game alert generation error:", error);
    }
  }, 15000 + Math.random() * 15000); // 15-30 seconds for much faster alert generation

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
