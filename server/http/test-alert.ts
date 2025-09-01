import express from 'express';
import { storage } from '../storage';

export const testAlert = express.Router();

// GET /api/admin/test-alert?type=HIGH_SCORING_OPP&sport=MLB&gameId=DEMO1
testAlert.get('/api/admin/test-alert', async (req, res) => {
  const { type = 'HIGH_SCORING_OPP', sport = 'MLB', gameId = 'DEMO1' } = req.query as Record<string, string>;

  const alertCandidate = {
    sport: sport as any,
    gameId,
    type: type as any,
    phase: 'TEST_PHASE',
    situation: `TEST_${Date.now()}`,   // unique to bypass dedup on repeats
    ruleVersion: 'ruleset_test',
    score: 77,
    context: { note: 'Synthetic test alert' }
  };

  try {
    // Create the alert payload - keep alertKey under 24 chars
    const shortKey = Math.random().toString(36).substr(2, 8);
    const alertPayload = {
      alertKey: shortKey, // Keep it short for database
      sport,
      gameId,
      type,
      state: 'NEW',
      score: 77,
      payload: alertCandidate
    };

    console.log('Creating test alert with alertKey length:', alertPayload.alertKey.length);

    // Insert into database
    const inserted = await storage.createAlert(alertPayload);
    
    if (!inserted) {
      return res.status(200).json({ 
        ok: true, 
        note: 'duplicate-key (expected if you re-use situation)' 
      });
    }

    // Broadcast to WebSocket clients (if available)
    if ((global as any).broadcastAlert) {
      (global as any).broadcastAlert(alertPayload);
    }

    res.json({ 
      ok: true, 
      alert_key: alertPayload.alertKey, 
      alert: alertPayload 
    });
  } catch (error) {
    console.error('Error creating test alert:', error);
    res.status(500).json({ error: 'Failed to create test alert', details: error.message });
  }
});