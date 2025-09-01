import express from 'express';
import { db } from '../db';
import { redis } from '../services/redis';

export const health = express.Router();

health.get('/healthz', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

health.get('/readyz', async (_, res) => {
  try {
    // Check database connection
    let dbStatus = 'ok';
    try {
      await db.execute('SELECT 1');
    } catch (error) {
      dbStatus = 'error';
      console.error('Database health check failed:', error);
    }

    // Check Redis connection
    let redisStatus = 'ok';
    try {
      await redis.set('health_check', 'ok', 10);
      const result = await redis.get('health_check');
      if (result !== 'ok') redisStatus = 'error';
    } catch (error) {
      redisStatus = 'error';
      console.error('Redis health check failed:', error);
    }

    // Check external data sources (stub)
    const sourcesStatus = 'ok'; // Would check ESPN API, weather API, etc.

    const allOk = dbStatus === 'ok' && redisStatus === 'ok' && sourcesStatus === 'ok';
    
    res.status(allOk ? 200 : 503).json({
      db: dbStatus,
      redis: redisStatus,
      sources: sourcesStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});