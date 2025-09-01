import express from 'express';
import { db } from '../db';
import { alerts } from '../../shared/schema';
import { desc, eq, and, count } from 'drizzle-orm';

export const alertsApi = express.Router();

// GET /alerts - Fetch recent alerts
alertsApi.get('/', async (req, res) => {
  try {
    const { sport, gameId, limit = '50' } = req.query;
    
    let query = db.select().from(alerts).orderBy(desc(alerts.createdAt));
    
    // Apply filters
    if (sport && typeof sport === 'string') {
      query = query.where(eq(alerts.sport, sport));
    }
    
    if (gameId && typeof gameId === 'string') {
      query = query.where(
        sport 
          ? and(eq(alerts.sport, sport as string), eq(alerts.gameId, gameId))
          : eq(alerts.gameId, gameId)
      );
    }
    
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    query = query.limit(limitNum);
    
    const recentAlerts = await query;
    
    res.json({
      alerts: recentAlerts,
      count: recentAlerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /alerts/stats - Alert statistics
alertsApi.get('/stats', async (req, res) => {
  try {
    // Get alert counts by sport and type
    const stats = await db
      .select({
        sport: alerts.sport,
        type: alerts.type,
        count: count()
      })
      .from(alerts)
      .groupBy(alerts.sport, alerts.type);
    
    res.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch alert stats:', error);
    res.status(500).json({
      error: 'Failed to fetch alert stats',
      timestamp: new Date().toISOString()
    });
  }
});