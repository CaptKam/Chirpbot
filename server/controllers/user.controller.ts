import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuthentication, requireUserAuth } from "../middleware/auth";
import { sanitizeUserForClient, redactSensitiveFields } from "../utils/user-helpers";
import { updateUserProfileSchema } from "../types";

const router = Router();

router.get('/api/user/:userId', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const safeUser = sanitizeUserForClient(user);
    res.json(safeUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

router.get('/api/user/:userId/telegram', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
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

router.post('/api/user/:userId/telegram', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { botToken, chatId, enabled } = req.body;

    await storage.updateUserTelegramSettings(userId, botToken, chatId, enabled);
    res.json({ message: 'Telegram settings updated successfully' });
  } catch (error) {
    console.error('Error updating telegram settings:', error);
    res.status(500).json({ message: 'Failed to update telegram settings' });
  }
});

router.get('/api/users/me', requireUserAuth, async (req: Request, res: Response) => {
  try {
    console.log('GET /api/users/me: Fetching profile for user', req.user.id);

    const user = await storage.getUserById(req.user.id);
    if (!user) {
      console.error('GET /api/users/me: User not found', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUserProfile = sanitizeUserForClient(user);
    res.json(safeUserProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

router.patch('/api/users/me', requireUserAuth, async (req: Request, res: Response) => {
  try {
    console.log('PATCH /api/users/me: Updating profile for user', req.user.id, 'with data:', redactSensitiveFields(req.body));

    const validationResult = updateUserProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('PATCH /api/users/me: Validation failed:', validationResult.error.flatten());
      return res.status(400).json({
        message: 'Invalid profile data',
        errors: validationResult.error.flatten()
      });
    }

    const updates = validationResult.data;
    const updatedUser = await storage.updateUser(req.user.id, updates);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUserProfile = sanitizeUserForClient(updatedUser);
    res.json(safeUserProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update user profile' });
  }
});

router.get('/api/settings', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const settings = await storage.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

router.post('/api/settings', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const settings = await storage.upsertSettings(req.body);
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

router.get('/api/user/:userId/alert-preferences', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const preferences = await storage.getUserAlertPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching alert preferences:', error);
    res.status(500).json({ message: 'Failed to fetch alert preferences' });
  }
});

router.get('/api/user/:userId/alert-preferences/:sport', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId, sport } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const preferences = await storage.getUserAlertPreferencesBySport(userId, sport.toLowerCase());
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching sport alert preferences:', error);
    res.status(500).json({ message: 'Failed to fetch sport alert preferences' });
  }
});

router.post('/api/user/:userId/alert-preferences', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { sport, alertType, enabled } = req.body;

    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Cannot modify other user preferences' });
    }

    await storage.setUserAlertPreference(userId, sport, alertType, enabled);
    res.json({ message: 'Alert preference updated successfully' });
  } catch (error) {
    console.error('Error setting alert preference:', error);
    res.status(500).json({ message: 'Failed to set alert preference' });
  }
});

router.post('/api/user/:userId/alert-preferences/bulk', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { sport, preferences } = req.body;

    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'Cannot modify other user preferences' });
    }

    const filteredPreferences = preferences;

    const result = await storage.bulkSetUserAlertPreferences(userId, sport.toLowerCase(), filteredPreferences);

    try {
      const { engineLifecycleManager } = await import('../services/engine-lifecycle-manager');
      await engineLifecycleManager.refreshEngineForUser(sport.toUpperCase(), userId);
      console.log(`Engine refreshed for ${sport} after preference update`);
    } catch (engineError) {
      console.error(`Failed to refresh engine:`, engineError);
    }

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

router.get('/api/user/:userId/monitored-games', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const monitoredGames = await storage.getUserMonitoredTeams(userId);
    res.json(monitoredGames);
  } catch (error) {
    console.error('Error fetching monitored games:', error);
    res.status(500).json({ message: 'Failed to fetch monitored games' });
  }
});

router.post('/api/user/:userId/monitored-games', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { gameId, sport, homeTeam, awayTeam } = req.body;

    if (!gameId) {
      return res.status(400).json({ message: 'gameId is required' });
    }

    const existing = await storage.getUserMonitoredTeams(userId);
    const alreadyMonitored = existing.some(g => g.gameId === gameId);

    if (alreadyMonitored) {
      return res.status(409).json({ message: 'Game already monitored' });
    }

    await storage.addUserMonitoredTeam(userId, gameId, sport || 'UNKNOWN', homeTeam || 'TBD', awayTeam || 'TBD');
    res.status(201).json({ message: 'Game added to monitoring' });
  } catch (error) {
    console.error('Error adding monitored game:', error);
    res.status(500).json({ message: 'Failed to add monitored game' });
  }
});

router.delete('/api/user/:userId/monitored-games/:gameId', requireAuthentication, async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const currentUserId = req.user?.id;
    
    if (userId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await storage.removeUserMonitoredTeam(userId, gameId);
    res.json({ message: 'Game removed from monitoring' });
  } catch (error) {
    console.error('Error removing monitored game:', error);
    res.status(500).json({ message: 'Failed to remove monitored game' });
  }
});

export default router;
