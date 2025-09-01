import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamSchema, insertSettingsSchema } from "@shared/schema";
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";

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

  return httpServer;
}