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

// Alert analysis interfaces

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

      // Generate basic game context
      const { homeScore = 0, awayScore = 0, homeTeam = 'Home', awayTeam = 'Away', inning = 5 } = context || {};
      const awayTeamName = typeof awayTeam === 'string' ? awayTeam : awayTeam?.name || 'Away';
      const homeTeamName = typeof homeTeam === 'string' ? homeTeam : homeTeam?.name || 'Home';
      
      // Simple game state description
      context.gameState = `${awayTeamName.split(' ').pop()} ${awayScore}-${homeScore} ${homeTeamName.split(' ').pop()}`;

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