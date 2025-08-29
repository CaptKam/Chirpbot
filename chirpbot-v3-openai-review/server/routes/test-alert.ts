// test-alert.ts
//
// Temporary endpoint to create sample alerts with AI betting insights for testing

import { Router } from 'express';
import { storage } from '../storage';
import { randomUUID } from 'crypto';

const router = Router();

// Create a test alert with AI betting insights
router.post('/create-with-betbook', async (req, res) => {
  try {
    // Generate mock betbook data
    const betbookData = {
      odds: {
        home: -110,
        away: +105,
        total: 8.5
      },
      aiAdvice: "High scoring probability (82%) detected. Consider live betting opportunities on the over/under as weather conditions favor offensive play. Monitor late-inning momentum shifts for value opportunities. Always gamble responsibly and within your means.",
      sportsbookLinks: [
        { name: 'FanDuel', url: 'https://www.fanduel.com/' },
        { name: 'DraftKings', url: 'https://www.draftkings.com/' },
        { name: 'BetMGM', url: 'https://www.betmgm.com/' }
      ]
    };

    const testAlert = {
      id: randomUUID(),
      userId: req.query.userId as string || 'c698f33b-08b4-48e9-abed-8172770cadb3', // Default test user
      title: `Tier 3: Los Angeles Dodgers @ San Francisco Giants`,
      type: 'MLB Tier 3 Alert',
      description: '🚨 OPTIMAL CONDITIONS: RISP + Power Hitter + Favorable Wind',
      sport: 'MLB',
      team: 'Los Angeles Dodgers',
      opponent: 'San Francisco Giants', 
      priority: 95,
      probability: 0.82,
      createdAt: new Date(),
      timestamp: new Date(),
      seen: false,
      sentToTelegram: false,
      gameInfo: {
        gameId: 'test-dodgers-giants-123',
        gamePk: 123456,
        homeTeam: 'Los Angeles Dodgers',
        awayTeam: 'San Francisco Giants',
        homeScore: 4,
        awayScore: 5,
        status: 'Live',
        inning: 8,
        inningState: 'bottom',
        outs: 2,
        runners: {
          first: false,
          second: true, 
          third: true
        },
        v3Analysis: {
          tier: 3,
          probability: 0.82,
          metadata: {
            l1: true,
            l2: true,
            l3: true,
            l4: false,
            aiConfident: false,
            severity: 'High'
          },
          reasons: [
            'Runners in scoring position (2nd & 3rd)',
            'Power hitter at the plate (28 HR, .885 OPS)', 
            'Favorable wind conditions (12mph out)',
            'Late-inning high-leverage situation'
          ],
          deduplicationKey: '123456:L3:8:bottom:2:011:545361:605200'
        }
      },
      betbookData,
      weatherData: {
        temperature: 75,
        condition: 'Clear',
        windSpeed: 12,
        windDirection: 'out'
      }
    };

    const createdAlert = await storage.createAlert(testAlert);

    res.json({
      success: true,
      message: 'Test alert created with AI betting insights',
      alert: createdAlert,
      instructions: 'Go to the alerts page and swipe LEFT on this alert to see the AI betting insights panel'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;