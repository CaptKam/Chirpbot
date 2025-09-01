import express from 'express';
import { db } from '../db';
import { alerts } from '../../shared/schema';
import { sql, count } from 'drizzle-orm';

export const status = express.Router();

status.get('/admin/status', async (_req, res) => {
  try {
    const result = await db
      .select({
        alerts_5m: count(alerts.id),
        delivered_5m: sql<number>`count(*) FILTER (WHERE ${alerts.state} = 'DELIVERED' AND ${alerts.createdAt} >= now()-interval '5 minutes')`
      })
      .from(alerts)
      .where(sql`${alerts.createdAt} >= now()-interval '5 minutes'`);

    const stats = result[0] || { alerts_5m: 0, delivered_5m: 0 };

    res.json({
      ok: true,
      maintenance: process.env.MAINTENANCE_MODE === '1',
      ruleset: process.env.RULESET_ACTIVE || 'default',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ 
      error: 'Failed to get status',
      timestamp: new Date().toISOString()
    });
  }
});