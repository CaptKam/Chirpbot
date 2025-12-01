import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireAdminAuth } from '../middleware/auth';
import { validateCSRF } from '../middleware/csrf';
import { getUnifiedSettings } from '../services/unified-settings';

const router = Router();

router.get('/api/admin/users', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
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

router.get('/api/admin/users/role/:role', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { role } = req.params;
    const users = await storage.getUsersByRole(role);
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

router.put('/api/admin/users/:userId/role', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
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

    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ message: 'User role updated successfully', user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

router.patch('/api/admin/users/:userId/role', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
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

    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ message: 'User role updated successfully', user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

router.delete('/api/admin/users/:userId', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    console.log(`🗑️ Admin ${currentUser.username} attempting to delete user ${userId}`);

    if (userId === currentUser.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const userToDelete = await storage.getUserById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToDelete.role === 'admin') {
      const allAdmins = await storage.getUsersByRole('admin');
      if (allAdmins.length <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

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

router.get('/api/admin/stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    const adminUsers = await storage.getUsersByRole('admin');
    const managerUsers = await storage.getUsersByRole('manager');
    const analystUsers = await storage.getUsersByRole('analyst');
    const regularUsers = await storage.getUsersByRole('user');

    const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
    const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
    const monitoredTeamsResult = await db.execute(sql`SELECT COUNT(DISTINCT game_id) as count FROM user_monitored_teams`);

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
      },
      monitoredTeams: parseInt(String(monitoredTeamsResult.rows[0]?.count || '0'))
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

router.get('/api/admin/system-status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const masterAlertsEnabled = await storage.getMasterAlertEnabled();

    let databaseConnected = false;
    try {
      await db.execute(sql`SELECT 1`);
      databaseConnected = true;
    } catch (error) {
      databaseConnected = false;
    }

    const openaiEnabled = !!process.env.OPENAI_API_KEY;

    let telegramConnected = false;
    try {
      const usersWithTelegram = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE telegram_enabled = true
        AND telegram_bot_token IS NOT NULL
        AND telegram_chat_id IS NOT NULL
      `);
      telegramConnected = parseInt(String(usersWithTelegram.rows[0]?.count || '0')) > 0;
    } catch (error) {
      telegramConnected = false;
    }

    res.json({
      alertEngine: masterAlertsEnabled,
      database: databaseConnected,
      openai: openaiEnabled,
      telegram: telegramConnected
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ message: 'Failed to fetch system status' });
  }
});

router.post('/api/admin/cleanup-alerts', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { alertCleanupService } = await import('../services/alert-cleanup');

    const statsBefore = await alertCleanupService.getCleanupStats();
    const deletedCount = await alertCleanupService.cleanupNow();
    const statsAfter = await alertCleanupService.getCleanupStats();

    res.json({
      success: true,
      deletedCount,
      statsBefore,
      statsAfter,
      message: `Cleaned up ${deletedCount} alerts older than 24 hours`
    });
  } catch (error) {
    console.error('Error in manual cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup alerts' });
  }
});

router.get('/api/admin/cleanup-stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { alertCleanupService } = await import('../services/alert-cleanup');
    const stats = await alertCleanupService.getCleanupStats();

    res.json({
      success: true,
      stats,
      message: `${stats.old} alerts are older than 24 hours and will be cleaned up`
    });
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({ error: 'Failed to get cleanup stats' });
  }
});

router.post('/api/admin/enable-master-alerts', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    console.log('🔧 Admin: Enabling master alerts globally...');

    const mlbAlerts = [
      'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH', 'MLB_RUNNER_ON_THIRD_NO_OUTS',
      'MLB_FIRST_AND_THIRD_NO_OUTS', 'MLB_SECOND_AND_THIRD_NO_OUTS', 'MLB_FIRST_AND_SECOND',
      'MLB_BASES_LOADED_NO_OUTS', 'MLB_RUNNER_ON_THIRD_ONE_OUT', 'MLB_SECOND_AND_THIRD_ONE_OUT',
      'MLB_BASES_LOADED_ONE_OUT', 'MLB_BATTER_DUE', 'MLB_STEAL_LIKELIHOOD',
      'MLB_ON_DECK_PREDICTION', 'MLB_WIND_CHANGE'
    ];

    let enabledCount = 0;
    for (const alertType of mlbAlerts) {
      try {
        await storage.enableGlobalAlert('MLB', alertType);
        enabledCount++;
        console.log(`✅ Globally enabled: ${alertType}`);
      } catch (error) {
        console.log(`⚠️ Failed to enable ${alertType}:`, error);
      }
    }

    console.log(`🎯 Master alerts enabled: ${enabledCount}/${mlbAlerts.length} alert types`);

    res.json({
      success: true,
      message: `Successfully enabled ${enabledCount} MLB alert types globally`,
      alertTypes: mlbAlerts,
      enabledCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error enabling master alerts:', error);
    res.status(500).json({ success: false, error: error.message, message: 'Failed to enable master alerts' });
  }
});

router.put('/api/admin/global-alert-setting', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { sport, alertType, enabled } = req.body;

    if (!sport || !alertType || typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'Missing required fields: sport, alertType, enabled' });
    }

    await storage.upsertGlobalAlertSetting(sport, alertType, enabled, req.session.adminUserId!);

    console.log(`✅ Admin toggled ${sport} ${alertType} to ${enabled ? 'enabled' : 'disabled'}`);

    res.json({
      message: `${alertType} ${enabled ? 'enabled' : 'disabled'} for ${sport}`,
      sport,
      alertType,
      enabled
    });
  } catch (error) {
    console.error('Error updating global alert setting:', error);
    res.status(500).json({ message: 'Failed to update global alert setting' });
  }
});

router.post('/api/admin/reset-global-alerts', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { sport } = req.body;
    if (!sport) {
      return res.status(400).json({ message: 'Sport parameter is required' });
    }

    console.log(`🔄 Admin resetting global alerts to defaults for ${sport}`);

    await storage.clearGlobalAlertSettings(sport.toLowerCase());

    const unifiedSettings = getUnifiedSettings();
    const defaults = await unifiedSettings.getGlobalSettings(sport.toLowerCase());
    const enabledCount = Object.values(defaults).filter(enabled => enabled).length;

    res.json({
      message: `Global alert settings reset to defaults for ${sport.toUpperCase()}`,
      sport: sport.toUpperCase(),
      enabledCount,
      settings: defaults
    });
  } catch (error) {
    console.error('Error resetting global alerts:', error);
    res.status(500).json({ message: 'Failed to reset global alerts' });
  }
});

router.put('/api/admin/apply-global-settings', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { sport, settings } = req.body;

    const result = await storage.applyGlobalSettingsToAllUsers(sport, settings, req.session.adminUserId!);

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

router.put('/api/admin/master-alerts', requireAdminAuth, validateCSRF, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    const adminUserId = req.session?.adminUserId || 'admin';
    await storage.setMasterAlertEnabled(enabled, adminUserId);

    console.log(`🎚️ Master alerts ${enabled ? 'ENABLED' : 'DISABLED'} by admin`);

    res.json({
      message: `Master alerts ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled
    });
  } catch (error) {
    console.error('Error updating master alerts:', error);
    res.status(500).json({ message: 'Failed to update master alerts' });
  }
});

export default router;
