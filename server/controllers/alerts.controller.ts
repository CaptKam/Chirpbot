import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { Alert } from '@shared/schema';

const router = Router();

router.get('/api/alerts', async (req: Request, res: Response) => {
  try {
    const masterAlertsEnabled = await storage.getMasterAlertEnabled();
    if (!masterAlertsEnabled) {
      res.json([]);
      return;
    }

    const currentUserId = req.session?.userId;
    console.log(`🔍 ALERTS API: Session user ID: ${currentUserId || 'none'}`);

    if (!currentUserId) {
      console.log(`⚠️ ALERTS API: No authenticated user, returning empty array`);
      res.json([]);
      return;
    }

    const user = await storage.getUserById(currentUserId);
    if (!user) {
      console.log(`⚠️ ALERTS API: User not found in database`);
      res.json([]);
      return;
    }

    const monitoredGames = await storage.getUserMonitoredTeams(currentUserId);
    const monitoredGameIds = monitoredGames.map(g => g.gameId);

    console.log(`📊 ALERTS API: User ${user.username} monitoring ${monitoredGameIds.length} games`);

    if (monitoredGameIds.length === 0) {
      res.json([]);
      return;
    }

    const allAlerts = await storage.getAllAlerts();
    
    const filteredAlerts = allAlerts.filter((alert: Alert) => {
      if (!alert.gameId) return false;
      return monitoredGameIds.includes(alert.gameId);
    });

    console.log(`📤 ALERTS API: Returning ${filteredAlerts.length} of ${allAlerts.length} total alerts for user ${user.username}`);
    res.json(filteredAlerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

router.get('/api/alerts/snapshot', async (req: Request, res: Response) => {
  try {
    const currentUserId = req.session?.userId;
    if (!currentUserId) {
      res.json([]);
      return;
    }

    const user = await storage.getUserById(currentUserId);
    if (!user) {
      res.json([]);
      return;
    }

    const since = req.query.since as string;
    const sinceSeq = req.query.seq ? parseInt(req.query.seq as string) : null;

    console.log(`📸 Snapshot request: userId=${currentUserId}, since=${since}, seq=${sinceSeq}`);

    const monitoredGames = await storage.getAllMonitoredGames();
    const userMonitoredGames = monitoredGames.filter(g => g.userId === currentUserId);
    const monitoredGameIds = userMonitoredGames.map(g => g.gameId);

    if (monitoredGameIds.length === 0) {
      res.json([]);
      return;
    }

    let alerts = await storage.getAllAlerts();
    
    if (since) {
      const sinceDate = new Date(since);
      alerts = alerts.filter((a: Alert) => new Date(a.createdAt) > sinceDate);
    }

    alerts = alerts.filter((a: Alert) => a.gameId && monitoredGameIds.includes(a.gameId));

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alert snapshot:', error);
    res.status(500).json({ message: 'Failed to fetch alert snapshot' });
  }
});

router.get('/api/alerts/stats', async (req: Request, res: Response) => {
  try {
    const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
    const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
    const monitoredGames = await storage.getAllMonitoredGames();

    const stats = {
      totalAlerts: parseInt(String(totalAlertsResult.rows[0]?.count || '0')),
      todayAlerts: parseInt(String(todayAlertsResult.rows[0]?.count || '0')),
      liveGames: 6,
      monitoredGames: monitoredGames.length
    };
    res.json(stats);
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ message: 'Failed to fetch alert stats' });
  }
});

router.get('/api/alerts/count', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
    res.json({ count: parseInt(String(result.rows[0]?.count || '0')) });
  } catch (error) {
    console.error('Error counting alerts:', error);
    res.status(500).json({ message: 'Failed to count alerts' });
  }
});

router.delete('/api/alerts/:alertId', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    if (!alertId) {
      return res.status(400).json({ message: 'Alert ID is required' });
    }

    const result = await db.execute(sql`
      DELETE FROM alerts
      WHERE id = ${alertId}
    `);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

export default router;
