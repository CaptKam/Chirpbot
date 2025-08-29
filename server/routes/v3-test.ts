// v3-test.ts
//
// API endpoints for testing ChirpBot v3 functionality

import { Router } from 'express';
import { MLBEngineV3 } from '../services/engines/mlb-engine';
// Legacy imports removed - V3 system uses integrated calculations
// Removed: mlb-alert-model, user-settings, betbook-engine
import { storage } from '../storage';

const router = Router();

// Test V3 MLB alert model
router.get('/test/mlb-model', async (req, res) => {
  try {
    const testGameState = {
      runners: { first: true, second: true, third: false },
      outs: 1,
      currentBatter: {
        name: "Mike Trout",
        stats: { hr: 25, avg: 0.285, ops: 0.920 }
      },
      currentPitcher: {
        name: "Jacob deGrom",
        stats: { era: 3.80, whip: 1.15 }
      },
      inning: 8,
      homeScore: 4,
      awayScore: 5,
      inningState: 'bottom' as const,
      ballpark: "Yankee Stadium",
      weather: {
        windSpeed: 12,
        windDirection: "out",
        temperature: 75
      }
    };

    const result = calculateMLBSeverity(testGameState);
    
    res.json({
      success: true,
      testScenario: "RISP + Power Hitter + Late Inning + Wind",
      result,
      explanation: {
        baseProb: `${(result.baseProb * 100).toFixed(1)}%`,
        finalProb: `${(result.probability * 100).toFixed(1)}%`,
        severity: result.severity,
        priority: result.priority,
        reasons: result.reasons
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test V3 4-tier alert system
router.get('/test/four-tier/:gameId?', async (req, res) => {
  try {
    const mlbEngineV3 = new MLBEngineV3();
    
    // Mock game state for testing
    const mockGameState = {
      gameId: req.params.gameId || 'test-game-123',
      gamePk: 123456,
      status: 'Live' as const,
      homeTeam: 'Los Angeles Dodgers',
      awayTeam: 'San Francisco Giants',
      homeScore: 3,
      awayScore: 4,
      inning: 9,
      inningState: 'bottom' as const,
      outs: 2,
      runners: { first: false, second: true, third: true },
      currentBatter: {
        id: 545361,
        name: "Mookie Betts",
        stats: { hr: 28, avg: 0.295, ops: 0.885 }
      },
      currentPitcher: {
        id: 605200,
        name: "Jordan Hicks",
        stats: { era: 4.25, whip: 1.35 }
      },
      ballpark: "Dodger Stadium",
      venue: "Dodger Stadium"
    };

    await mlbEngineV3.evaluateFourTierSystem(mockGameState);
    
    res.json({
      success: true,
      message: "V3 4-tier system evaluation completed",
      gameState: mockGameState,
      note: "Check console logs for detailed tier evaluation results"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test user settings override
router.get('/test/user-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sport = 'MLB';
    const tier = parseInt(req.query.tier as string) || 2;

    const userSettings = await storage.getSettingsByUserId(userId);
    const shouldNotify = shouldNotifyUser(userSettings, sport, tier);

    res.json({
      success: true,
      userId,
      userSettings,
      testParameters: { sport, tier },
      shouldNotifyUser: shouldNotify,
      explanation: shouldNotify 
        ? "Alert would be sent to user"
        : "Alert blocked by user settings"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test Betbook engine
router.get('/test/betbook', async (req, res) => {
  try {
    const alertContext = {
      sport: 'MLB',
      gameId: 'dodgers-giants-123',
      tier: 3,
      homeTeam: 'Los Angeles Dodgers',
      awayTeam: 'San Francisco Giants', 
      homeScore: 6,
      awayScore: 7,
      inning: 9,
      probability: 0.82
    };

    const shouldShow = shouldShowBetbook(alertContext);
    const betbookData = shouldShow ? getBetbookData(alertContext) : null;

    res.json({
      success: true,
      alertContext,
      shouldShowBetbook: shouldShow,
      betbookData,
      note: "Betbook engine provides betting context for swipe-left actions"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// V3 system status
router.get('/status', async (req, res) => {
  try {
    const users = await storage.getUsers();
    const mlbSettings = await storage.getSettingsBySport('MLB');
    
    res.json({
      success: true,
      v3Status: "ChirpBot v3 Implemented",
      features: {
        gameSatusGating: "✅ Only live games monitored",
        fourTierAlerts: "✅ L1→L2→L3→L4 decision rules",
        userSettingsOverride: "✅ Per-user alert preferences", 
        contextDeduplication: "✅ Advanced deduplication keys",
        mlbScoringModel: "✅ Mathematical severity bands",
        betbookEngine: "✅ Optional betting context"
      },
      systemStats: {
        totalUsers: users.length,
        mlbMonitoringEnabled: mlbSettings?.alertsEnabled || false,
        storageType: "PostgreSQL (DatabaseStorage)"
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;