import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamSchema, insertAlertSchema, insertSettingsSchema } from "@shared/schema";
import { analyzeAlert } from "./services/openai";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { getWeatherData } from "./services/weather";
import { sportsService, type SportsEvent } from "./services/sports";

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
      let aiContext = null;
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
      console.error("Failed to fetch live games:", error);
      res.status(500).json({ message: "Failed to fetch games - check ESPN API connection" });
    }
  });

  // New route to get live scores for a specific team
  app.get("/api/sports/team/:teamName/games", async (req, res) => {
    try {
      const { teamName } = req.params;
      const sport = req.query.sport as string;
      const allGames = await sportsService.getLiveGames(sport);
      const teamGames = allGames.filter(game => 
        game.homeTeam.toLowerCase().includes(teamName.toLowerCase()) ||
        game.awayTeam.toLowerCase().includes(teamName.toLowerCase())
      );
      res.json(teamGames);
    } catch (error) {
      console.error("Failed to fetch team games:", error);
      res.status(500).json({ message: "Failed to fetch team games" });
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
        aiContext: null,
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

  // Check for real sports events every 2 minutes, fallback to simulation if no real events
  setInterval(async () => {
    try {
      // First try to get real live games and check for events
      const allLiveGames = await sportsService.getLiveGames();
      let realEventFound = false;

      for (const game of allLiveGames) {
        // Simple real-time event detection based on game state
        const sportMapping: Record<string, string> = {
          "inning": "MLB",
          "quarter": "NFL",
          "period": "NHL"
        };

        let sport = "NBA"; // default
        let eventType = "ClutchTime";

        if (game.inning) {
          sport = "MLB";
          if (game.inning.includes("7th") || game.inning.includes("8th") || game.inning.includes("9th")) {
            eventType = "LateInning";
          } else {
            continue; // Only alert on late innings for MLB
          }
        } else if (game.quarter && game.quarter.includes("4th")) {
          if (game.quarter.includes("Quarter")) {
            sport = game.homeTeam.includes("Lakers") || game.homeTeam.includes("Warriors") || 
                  game.awayTeam.includes("Lakers") || game.awayTeam.includes("Warriors") ? "NBA" : "NFL";
            eventType = sport === "NBA" ? "ClutchTime" : "RedZone";
          }
        } else if (game.period) {
          sport = "NHL";
          eventType = "PowerPlay";
        } else {
          continue; // Skip if no interesting game state
        }

        const scoreDiff = Math.abs((game.score?.home || 0) - (game.score?.away || 0));
        
        // Only create alerts for close games
        if (scoreDiff <= (sport === "NFL" ? 7 : sport === "NBA" ? 5 : 2)) {
          const weatherData = await getWeatherData(game.homeTeam);
          
          const alertData = {
            type: eventType,
            sport,
            title: `${game.homeTeam} - ${eventType} Alert (LIVE)`,
            description: `Real-time alert: ${game.homeTeam} vs ${game.awayTeam} - Close game in ${sport === "MLB" ? "late innings" : sport === "NBA" ? "4th quarter" : sport === "NFL" ? "4th quarter" : "final period"}`,
            gameInfo: game,
            weatherData,
            aiContext: null,
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

            const sent = await sendTelegramAlert(telegramConfig, alert);
            if (sent) {
              await storage.markAlertSentToTelegram(alert.id);
            }
          }

          broadcast({ type: 'new_alert', data: alert });
          realEventFound = true;
          console.log("Real-time sports alert created:", alert.title);
          break; // Only create one alert per check to avoid spam
        }
      }

      // Fallback to simulation if no real events (for demo purposes)
      if (!realEventFound && Math.random() < 0.3) { // 30% chance to simulate if no real events
        const event = sportsService.generateSportsEvent();
        if (event) {
          const weatherData = await getWeatherData(event.game.homeTeam);
          
          const alertData = {
            type: event.type,
            sport: event.type.includes("RedZone") ? "NFL" : event.type.includes("ClutchTime") ? "NBA" : "MLB",
            title: `${event.game.homeTeam} - ${event.type} Alert (Simulated)`,
            description: event.description,
            gameInfo: event.game,
            weatherData,
            aiContext: null,
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

            const sent = await sendTelegramAlert(telegramConfig, alert);
            if (sent) {
              await storage.markAlertSentToTelegram(alert.id);
            }
          }

          broadcast({ type: 'new_alert', data: alert });
        }
      }

    } catch (error) {
      console.error("Real-time sports monitoring error:", error);
    }
  }, 120000); // Check every 2 minutes for real events

  return httpServer;
}
