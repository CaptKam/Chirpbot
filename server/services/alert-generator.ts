import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { storage } from "../storage";
import { AlertDeduplication } from "./alert-deduplication";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";
import { SettingsCache } from "./settings-cache";

// Import sport engines
import { MLBEngine } from './engines/mlb-engine';
import { NCAAFEngine } from './engines/ncaaf-engine';
import { WNBAEngine } from './engines/wnba-engine';
import { NFLEngine } from './engines/nfl-engine';
import { CFLEngine } from './engines/cfl-engine';
import { BaseSportEngine, GameState, AlertResult } from './engines/base-engine';

// Betting Analysis Engine
interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
}

interface V3Analysis {
  tier: number;
  probability: number;
  reasons: string[];
  recommendation: string;
  confidence: number;
}

export class AlertGenerator {
  private mlbApi: MLBApiService;
  private ncaafApi: NCAAFApiService;
  private alertDeduplication: AlertDeduplication;
  private settingsCache: SettingsCache;

  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
    this.alertDeduplication = new AlertDeduplication();
    this.settingsCache = new SettingsCache();
  }

  async generateAlert(
    type: string,
    message: string,
    context: any,
    probability: number = 50,
    userId?: string,
    gameId?: string,
    sport: string = 'MLB'
  ): Promise<string | null> {
    try {
      console.log(`🎯 Generating ${type} alert with ${probability}% probability`);

      let finalPriority = probability;

      // Generate contextual advice based on actual game situation
      const { homeScore = 0, awayScore = 0, homeTeam = 'Home', awayTeam = 'Away', inning = 5 } = context || {};
      const totalScore = homeScore + awayScore;
      const totalLine = 8.5; // Standard MLB total
      const currentInning = Math.min(9, Math.max(1, inning));

      // Generate contextual advice based on actual game situation  
      const awayTeamName = typeof awayTeam === 'string' ? awayTeam : awayTeam?.name || 'Away';
      const homeTeamName = typeof homeTeam === 'string' ? homeTeam : homeTeam?.name || 'Home';
      let advice = `${awayTeamName.split(' ').pop()} ${awayScore}-${homeScore} ${homeTeamName.split(' ').pop()}`;

      if (type === 'BASES_LOADED') {
        advice += ` | BASES LOADED: Strong over ${totalLine} value. Historical 75%+ scoring rate.`;
      } else if (type === 'RISP') {
        advice += ` | Runner in scoring position. Over ${totalLine} shows value at ${inning}th inning.`;
      } else if (type === 'HOME_RUN') {
        advice += ` | Momentum shift! Live betting window for over ${totalLine}.`;
      } else if (totalScore < totalLine - 1) {
        advice += ` | Current pace suggests OVER ${totalLine} value (${totalScore} through ${currentInning}).`;
      } else if (totalScore > totalLine + 1) {
        advice += ` | High-scoring game. Consider UNDER ${totalLine} (${totalScore} runs already).`;
      } else {
        advice += ` | Live total ${totalLine}. Monitor for value based on next few plays.`;
      }

      // Update context with betting advice
      context.aiAdvice = advice;

      const alertKey = `${type}-${gameId || 'general'}-${Date.now()}`;

      // Check for duplicates
      const isDuplicate = await this.alertDeduplication.isDuplicate(alertKey);
      if (isDuplicate) {
        console.log(`🔄 Skipping duplicate alert: ${alertKey}`);
        return null;
      }

      // Check if user has this alert type enabled
      if (userId) {
        const userPreferences = await this.settingsCache.getUserPreferences(userId);
        const alertTypeKey = `${sport}_${type}`;

        if (!userPreferences[alertTypeKey]) {
          console.log(`🔕 User ${userId} has ${alertTypeKey} disabled`);
          return null;
        }
      }

      // Store alert in database
      const [alert] = await db.execute(sql`
        INSERT INTO alerts (type, message, context, priority, created_at, user_id, game_id, sport)
        VALUES (${type}, ${message}, ${JSON.stringify(context)}, ${finalPriority}, datetime('now'), ${userId || null}, ${gameId || null}, ${sport})
        RETURNING *
      `);

      const alertId = (alert as any).id;
      console.log(`✅ Generated ${type} alert: ${alertId} (Priority: ${finalPriority})`);

      // Send Telegram notification if configured
      if (userId) {
        try {
          await this.sendTelegramNotification(userId, type, message, context);
        } catch (telegramError) {
          console.warn('📱 Telegram notification failed:', telegramError);
        }
      }

      return alertId;
    } catch (error) {
      console.error('❌ Alert generation failed:', error);
      return null;
    }
  }

  private async sendTelegramNotification(userId: string, type: string, message: string, context: any) {
    try {
      // Get user's Telegram config
      const userSettings = await this.settingsCache.getUserSettings(userId);
      const telegramConfig: TelegramConfig = {
        botToken: userSettings.TELEGRAM_BOT_TOKEN,
        chatId: userSettings.TELEGRAM_CHAT_ID,
        enabled: userSettings.TELEGRAM_ENABLED === 'true'
      };

      if (!telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) {
        return; // Telegram not configured for this user
      }

      await sendTelegramAlert(message, telegramConfig);
      console.log(`📱 Telegram notification sent for ${type} alert`);
    } catch (error) {
      console.error('📱 Telegram notification error:', error);
    }
  }

  // Simplified V3 analysis without AI
  calculateV3Analysis(
    alertType: string,
    probability: number,
    gameContext: any
  ): V3Analysis {
    let tier = 3;
    let confidence = probability;
    const reasons: string[] = [];
    let recommendation = 'MONITOR';

    // Determine tier based on probability and context
    if (probability >= 85) {
      tier = 1;
      recommendation = 'BET NOW';
      reasons.push('Extremely high probability situation');
    } else if (probability >= 70) {
      tier = 2;
      recommendation = 'STRONG BET';
      reasons.push('High probability opportunity');
    } else if (probability >= 60) {
      tier = 3;
      recommendation = 'CONSIDER';
      reasons.push('Moderate probability situation');
    } else {
      tier = 4;
      recommendation = 'WAIT';
      reasons.push('Low probability - monitor');
    }

    // Add context-specific reasons
    if (alertType === 'BASES_LOADED') {
      reasons.push('Historical 75%+ run scoring rate');
      confidence += 10;
    }

    if (alertType === 'RISP') {
      reasons.push('Runner in prime scoring position');
      confidence += 5;
    }

    if (gameContext?.inning >= 7) {
      reasons.push('Late inning pressure situation');
      confidence += 5;
    }

    return {
      tier,
      probability: Math.min(95, confidence),
      reasons: reasons.slice(0, 3),
      recommendation,
      confidence: Math.min(95, confidence)
    };
  }

  async getBetbookData(gameId: string, sport: string = 'MLB'): Promise<BetbookData> {
    // Simplified betting data without AI
    return {
      odds: {
        home: -110,
        away: -110,
        total: 8.5
      },
      aiAdvice: 'Monitor live betting opportunities',
      sportsbookLinks: [
        { name: 'DraftKings', url: 'https://sportsbook.draftkings.com' },
        { name: 'FanDuel', url: 'https://sportsbook.fanduel.com' },
        { name: 'BetMGM', url: 'https://sports.betmgm.com' }
      ]
    };
  }

  async getAlerts(userId?: string, sport?: string, limit: number = 50) {
    try {
      let query = sql`
        SELECT * FROM alerts
        WHERE 1=1
      `;

      if (userId) {
        query = sql`${query} AND user_id = ${userId}`;
      }

      if (sport) {
        query = sql`${query} AND sport = ${sport}`;
      }

      query = sql`${query} ORDER BY created_at DESC LIMIT ${limit}`;

      const alerts = await db.execute(query);
      return alerts;
    } catch (error) {
      console.error('❌ Failed to fetch alerts:', error);
      return [];
    }
  }

  async getAlertStats(userId?: string) {
    try {
      let totalQuery = sql`SELECT COUNT(*) as count FROM alerts`;
      let todayQuery = sql`SELECT COUNT(*) as count FROM alerts WHERE date(created_at) = date('now')`;

      if (userId) {
        totalQuery = sql`${totalQuery} WHERE user_id = ${userId}`;
        todayQuery = sql`${todayQuery} AND user_id = ${userId}`;
      }

      const [totalResult] = await db.execute(totalQuery);
      const [todayResult] = await db.execute(todayQuery);

      return {
        totalAlerts: (totalResult as any).count,
        todayAlerts: (todayResult as any).count,
        liveGames: 0 // Will be populated by actual game monitoring
      };
    } catch (error) {
      console.error('❌ Failed to fetch alert stats:', error);
      return { totalAlerts: 0, todayAlerts: 0, liveGames: 0 };
    }
  }
}