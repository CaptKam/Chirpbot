import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { storage } from "../storage";
import { evaluateGameForAlerts, type MLBGameState } from "./mlb-probability-engine";
import { openaiEnhancer } from "./openai-alert-enhancer";

interface AlertData {
  type: string;
  sport: string;
  gameId: string;
  score: number;
  payload: any;
  alertKey: string;
  state: string;
}

export class AlertGenerator {
  private mlbApi: MLBApiService;
  private ncaafApi: NCAAFApiService;

  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
  }

  // Check if alert type is enabled globally AND has enabled users
  private async isAlertTypeEnabled(sport: string, alertType: string): Promise<boolean> {
    try {
      // NEVER GENERATE STRIKEOUT ALERTS - HARD BLOCKED
      if (alertType === 'STRIKEOUT' || alertType.includes('STRIKE')) {
        return false;
      }

      // First check if the alert type is globally enabled by admin
      const globalSettings = await storage.getGlobalAlertSettings(sport);
      const isGloballyEnabled = globalSettings[alertType] === true;
      
      if (!isGloballyEnabled) {
        return false;
      }
      
      // Then check if any user has this alert type enabled
      const enabledPreferences = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM user_alert_preferences 
        WHERE sport = ${sport} 
        AND alert_type = ${alertType} 
        AND alert_type != 'STRIKEOUT'
        AND enabled = true
      `);
      
      const result = enabledPreferences.rows?.[0] as any;
      const count = Number(result?.count) || 0;
      return count > 0;
    } catch (error) {
      console.error(`Error checking if alert type ${alertType} is enabled:`, error);
      return false;
    }
  }

  // Generate realistic alerts from today's completed games
  async generateAlertsFromCompletedGames(): Promise<void> {
    try {
      const games = await this.mlbApi.getTodaysGames();
      console.log(`Found ${games.length} games to analyze for alerts`);

      for (const game of games) {
        if (game.status === 'final' && game.homeScore && game.awayScore) {
          await this.generateGameAlerts(game);
        }
      }
    } catch (error) {
      console.error('Error generating alerts from completed games:', error);
    }
  }

  private async generateGameAlerts(game: any): Promise<void> {
    try {
      // Convert game data to MLBGameState format for probability engine
      const gameState: MLBGameState = {
        gameId: game.gameId,
        status: game.status,
        home: game.homeTeam,
        away: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning: { number: 9, half: 'Bottom' }, // Use final inning for completed games
        outs: 2, // Simulate high-pressure situations
        runners: {
          first: Math.random() > 0.7,
          second: Math.random() > 0.8,
          third: Math.random() > 0.85
        }
      };

      // Generate alerts using probability engine - NO STRIKEOUTS
      const potentialAlerts = await evaluateGameForAlerts(gameState);
      
      for (const alert of potentialAlerts) {
        // HARD BLOCK: Never allow strikeout alerts
        if (alert.type === 'STRIKEOUT' || alert.type.includes('STRIKE')) {
          continue;
        }

        // Check if this alert type is enabled
        const isEnabled = await this.isAlertTypeEnabled('MLB', alert.type);
        if (!isEnabled) {
          continue;
        }

        // Enhance with OpenAI if available
        let finalMessage = alert.message;
        try {
          const enhanced = await openaiEnhancer.enhanceAlert({
            type: alert.type,
            message: alert.message,
            sport: 'MLB',
            context: alert.payload
          });
          if (enhanced?.enhancedMessage) {
            finalMessage = enhanced.enhancedMessage;
            alert.payload.openaiEnhanced = true;
          }
        } catch (error) {
          console.error('OpenAI enhancement failed, using original message:', error);
        }

        // Store alert in database
        await storage.createAlert({
          id: alert.id,
          alertKey: alert.alertKey,
          sport: 'MLB',
          gameId: game.gameId,
          type: alert.type,
          state: 'NEW',
          score: alert.score,
          payload: {
            ...alert.payload,
            message: finalMessage,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      console.log(`Generated ${potentialAlerts.length} alerts for game ${game.gameId}: ${game.awayTeam} vs ${game.homeTeam}`);
    } catch (error) {
      console.error(`Error generating alerts for game ${game.gameId}:`, error);
    }
  }

  // Check live games and generate real-time alerts
  async checkLiveGamesForAlerts(): Promise<void> {
    try {
      console.log(`⚡ Real-time monitoring: Checking for live game alerts...`);
      
      // Get live games
      const mlbGames = await this.mlbApi.getTodaysGames();
      const liveGames = mlbGames.filter(game => game.isLive);
      
      console.log(`🔍 Monitoring ${liveGames.length} MLB + 0 NCAAF live games for alerts`);
      
      if (liveGames.length === 0) {
        console.log(`📊 No live games to monitor`);
        return;
      }

      console.log(`⚾ Processing ${liveGames.length} live MLB games`);
      let totalNewAlerts = 0;

      for (const game of liveGames) {
        try {
          // Get detailed game state from MLB API
          const gameState = await this.mlbApi.getGameState(game.gameId);
          
          if (gameState && gameState.status === 'live') {
            // Generate alerts using probability engine - NO STRIKEOUTS
            const potentialAlerts = await evaluateGameForAlerts(gameState);
            
            for (const alert of potentialAlerts) {
              // HARD BLOCK: Never allow strikeout alerts
              if (alert.type === 'STRIKEOUT' || alert.type.includes('STRIKE')) {
                continue;
              }

              // Check if this alert type is enabled
              const isEnabled = await this.isAlertTypeEnabled('MLB', alert.type);
              if (!isEnabled) {
                continue;
              }

              // Check if we've already generated this alert recently
              const existingAlert = await storage.getAlertByKey(alert.alertKey);
              if (existingAlert) {
                continue;
              }

              // Enhance with OpenAI
              let finalMessage = alert.message;
              try {
                const enhanced = await openaiEnhancer.enhanceAlert({
                  type: alert.type,
                  message: alert.message,
                  sport: 'MLB',
                  context: alert.payload
                });
                if (enhanced?.enhancedMessage) {
                  finalMessage = enhanced.enhancedMessage;
                  alert.payload.openaiEnhanced = true;
                }
              } catch (error) {
                console.error('OpenAI enhancement failed:', error);
              }

              // Create the alert
              await storage.createAlert({
                id: alert.id,
                alertKey: alert.alertKey,
                sport: 'MLB',
                gameId: gameState.gameId,
                type: alert.type,
                state: 'LIVE',
                score: alert.score,
                payload: {
                  ...alert.payload,
                  message: finalMessage,
                  homeTeam: gameState.home,
                  awayTeam: gameState.away,
                  homeScore: gameState.homeScore,
                  awayScore: gameState.awayScore,
                  timestamp: new Date().toISOString()
                }
              });

              totalNewAlerts++;
            }
          }
        } catch (error) {
          console.error(`Error processing live game ${game.gameId}:`, error);
        }
      }

      if (totalNewAlerts === 0) {
        console.log(`📊 No new alerts generated from live games`);
      } else {
        console.log(`📊 Generated ${totalNewAlerts} new alerts from live games`);
      }
    } catch (error) {
      console.error('Error checking live games for alerts:', error);
    }
  }
}

export const alertGenerator = new AlertGenerator();