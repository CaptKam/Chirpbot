
import type { Game } from "@shared/schema";
import { mlbApi } from "./mlb-api";
import { storage } from "../storage";
import { analyzeAlert } from "./openai";
import { getWeatherData } from "./weather";
import { sendTelegramAlert } from "./telegram";

export interface MLBGameState {
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  balls: number;
  strikes: number;
  runners: {
    first?: boolean;
    second?: boolean;
    third?: boolean;
  };
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  status: string;
}

export interface MLBAlert {
  type: string;
  priority: number;
  scoringProbability: number;
  description: string;
  gameState: MLBGameState;
}

export class MLBAlertEngine {
  private gameStates: Map<number, MLBGameState> = new Map();
  private alertHistory: Map<string, number> = new Map(); // Prevent duplicate alerts
  private readonly ALERT_COOLDOWN = 30000; // 30 seconds between same type alerts for same game
  
  // Callback for broadcasting alerts to WebSocket clients
  public onAlert?: (alert: any) => void;

  /**
   * Analyze game state and generate high-priority alerts
   */
  analyzeGameForAlerts(gameState: MLBGameState): MLBAlert[] {
    const alerts: MLBAlert[] = [];
    const { inning, inningState, outs, runners, homeScore, awayScore } = gameState;
    const scoreDiff = Math.abs(homeScore - awayScore);

    // 1. Game Start Alert
    if (inning === 1 && inningState === 'top' && outs === 0) {
      alerts.push({
        type: "Game Start",
        priority: 40,
        scoringProbability: 25,
        description: `⚾ GAME START: ${gameState.awayTeam} @ ${gameState.homeTeam} - First pitch!`,
        gameState
      });
    }

    // 2. 7th Inning Warning
    if (inning === 7 && inningState === 'top' && outs === 0) {
      alerts.push({
        type: "7th Inning Warning",
        priority: 50,
        scoringProbability: 35,
        description: `🚨 7TH INNING STRETCH: ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Critical innings ahead!`,
        gameState
      });
    }

    // 3. Tie Game Going Into 9th
    if (inning === 9 && inningState === 'top' && outs === 0 && homeScore === awayScore) {
      alerts.push({
        type: "Tie Game 9th Inning",
        priority: 85,
        scoringProbability: 60,
        description: `🔥 TIE GAME 9TH INNING: ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - FINAL INNING DRAMA!`,
        gameState
      });
    }

    // 4. High-Probability Scoring Situations (RISP Analysis)
    const runnersArray = [];
    if (runners.first) runnersArray.push('1B');
    if (runners.second) runnersArray.push('2B');
    if (runners.third) runnersArray.push('3B');

    // Bases Loaded scenarios
    if (runners.first && runners.second && runners.third) {
      if (outs === 0) {
        alerts.push({
          type: "Bases Loaded 0 Outs",
          priority: 95,
          scoringProbability: 85,
          description: `🚨 BASES LOADED, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - MAXIMUM scoring opportunity!`,
          gameState
        });
      } else if (outs === 1) {
        alerts.push({
          type: "Bases Loaded 1 Out",
          priority: 85,
          scoringProbability: 70,
          description: `🔥 BASES LOADED, 1 OUT! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - High-value scoring chance!`,
          gameState
        });
      }
    }

    // Runners on 2nd & 3rd scenarios
    else if (runners.second && runners.third && !runners.first) {
      if (outs === 0) {
        alerts.push({
          type: "Runners 2nd & 3rd 0 Outs",
          priority: 90,
          scoringProbability: 80,
          description: `🎯 RUNNERS ON 2ND & 3RD, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Prime RBI situation!`,
          gameState
        });
      } else if (outs === 1) {
        alerts.push({
          type: "Runners 2nd & 3rd 1 Out",
          priority: 75,
          scoringProbability: 65,
          description: `⚡ RUNNERS ON 2ND & 3RD, 1 OUT! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Key scoring opportunity!`,
          gameState
        });
      }
    }

    // Runner on 3rd scenarios
    else if (runners.third && !runners.second && !runners.first) {
      if (outs === 0) {
        alerts.push({
          type: "Runner 3rd 0 Outs",
          priority: 80,
          scoringProbability: 75,
          description: `📈 RUNNER ON 3RD, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Easy run scoring position!`,
          gameState
        });
      } else if (outs === 1) {
        alerts.push({
          type: "Runner 3rd 1 Out",
          priority: 65,
          scoringProbability: 55,
          description: `⚠️ RUNNER ON 3RD, 1 OUT! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Sacrifice fly opportunity!`,
          gameState
        });
      }
    }

    // Runners on 1st & 3rd scenarios
    else if (runners.first && runners.third && !runners.second) {
      if (outs === 0) {
        alerts.push({
          type: "Runners 1st & 3rd 0 Outs",
          priority: 75,
          scoringProbability: 70,
          description: `🎯 RUNNERS ON 1ST & 3RD, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Multiple scoring threats!`,
          gameState
        });
      } else if (outs === 1) {
        alerts.push({
          type: "Runners 1st & 3rd 1 Out",
          priority: 65,
          scoringProbability: 55,
          description: `📊 RUNNERS ON 1ST & 3RD, 1 OUT! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Double play or RBI situation!`,
          gameState
        });
      }
    }

    // Runners on 1st & 2nd scenarios
    else if (runners.first && runners.second && !runners.third) {
      if (outs === 0) {
        alerts.push({
          type: "Runners 1st & 2nd 0 Outs",
          priority: 70,
          scoringProbability: 60,
          description: `📈 RUNNERS ON 1ST & 2ND, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Rally building!`,
          gameState
        });
      }
    }

    // Runner on 2nd only scenarios
    else if (runners.second && !runners.first && !runners.third) {
      if (outs === 0) {
        alerts.push({
          type: "Runner 2nd 0 Outs",
          priority: 60,
          scoringProbability: 60,
          description: `⚡ RUNNER ON 2ND, 0 OUTS! ${gameState.awayTeam} ${awayScore} - ${homeScore} ${gameState.homeTeam} - Scoring position established!`,
          gameState
        });
      }
    }

    // Add late-game pressure multiplier
    if (inning >= 7) {
      alerts.forEach(alert => {
        alert.priority += 15;
        alert.scoringProbability += 10;
        if (alert.description.includes('🚨')) return; // Already has high priority emoji
        if (alert.priority >= 85) alert.description = alert.description.replace('⚡', '🚨');
        if (alert.priority >= 75 && alert.priority < 85) alert.description = alert.description.replace('📈', '🔥');
      });
    }

    // Add close game multiplier
    if (scoreDiff <= 2 && inning >= 6) {
      alerts.forEach(alert => {
        alert.priority += 10;
        alert.description += ` [${scoreDiff <= 1 ? 'ONE-RUN GAME' : 'CLOSE GAME'}]`;
      });
    }

    return alerts.filter(alert => this.shouldTriggerAlert(alert, gameState.gamePk));
  }

  /**
   * Check if alert should be triggered (prevents spam)
   */
  private shouldTriggerAlert(alert: MLBAlert, gamePk: number): boolean {
    const alertKey = `${gamePk}-${alert.type}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const now = Date.now();
    
    if (lastAlert && (now - lastAlert) < this.ALERT_COOLDOWN) {
      return false;
    }
    
    this.alertHistory.set(alertKey, now);
    return true;
  }

  /**
   * Monitor live games and generate alerts every 10 seconds
   */
  async startRealTimeMonitoring() {
    console.log('🔴 MLB Real-Time Alert Engine STARTED - 10-second monitoring');
    
    setInterval(async () => {
      try {
        await this.checkLiveGamesForAlerts();
      } catch (error) {
        console.error('MLB alert monitoring error:', error);
      }
    }, 10000); // Check every 10 seconds for maximum responsiveness
  }

  /**
   * Check all live games for alert conditions
   */
  async checkLiveGamesForAlerts() {
    try {
      const settings = await storage.getSettingsBySport('MLB');
      if (!settings?.aiEnabled) {
        return; // Skip if MLB alerts are disabled
      }

      const liveGames = await mlbApi.getLiveGames();
      
      if (liveGames.length === 0) {
        return; // No live games
      }

      console.log(`🔍 Checking ${liveGames.length} live MLB games for alerts...`);

      for (const game of liveGames) {
        try {
          // Get detailed live feed for accurate game state
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);
          const gameState = this.extractGameState(liveFeed, game);
          
          if (!gameState) continue;
          
          // Generate alerts for this game
          const alerts = this.analyzeGameForAlerts(gameState);
          
          if (alerts.length > 0) {
            console.log(`⚡ Found ${alerts.length} alerts for ${game.homeTeam.name} vs ${game.awayTeam.name}`);
            
            // Process each alert
            for (const alert of alerts) {
              await this.processAlert(alert, settings);
            }
          }
          
        } catch (gameError) {
          console.error(`Error processing game ${game.id}:`, gameError);
        }
      }
      
    } catch (error) {
      console.error('Error in MLB alert monitoring:', error);
    }
  }

  /**
   * Extract game state from MLB live feed
   */
  private extractGameState(liveFeed: any, game: Game): MLBGameState | null {
    try {
      const linescore = liveFeed.liveData.linescore;
      const gameData = liveFeed.gameData;
      
      return {
        gamePk: game.gamePk,
        inning: linescore.currentInning || 1,
        inningState: linescore.inningState === 'Top' ? 'top' : 'bottom',
        outs: linescore.outs || 0,
        balls: linescore.balls || 0,
        strikes: linescore.strikes || 0,
        runners: {
          first: !!linescore.offense?.first,
          second: !!linescore.offense?.second,
          third: !!linescore.offense?.third,
        },
        homeScore: linescore.teams.home.runs || 0,
        awayScore: linescore.teams.away.runs || 0,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        status: gameData.status.detailedState
      };
    } catch (error) {
      console.error('Error extracting game state:', error);
      return null;
    }
  }

  /**
   * Process and store alert
   */
  private async processAlert(alert: MLBAlert, settings: any) {
    try {
      const weatherData = await getWeatherData(alert.gameState.homeTeam);
      
      const alertData = {
        type: alert.type,
        sport: 'MLB',
        title: `${alert.gameState.awayTeam} @ ${alert.gameState.homeTeam}`,
        description: alert.description,
        gameInfo: {
          score: { 
            away: alert.gameState.awayScore, 
            home: alert.gameState.homeScore 
          },
          inning: alert.gameState.inning,
          inningState: alert.gameState.inningState,
          outs: alert.gameState.outs,
          status: 'Live',
          awayTeam: alert.gameState.awayTeam,
          homeTeam: alert.gameState.homeTeam,
          priority: alert.priority,
          scoringProbability: alert.scoringProbability
        },
        weatherData,
        aiContext: undefined as string | undefined,
        aiConfidence: alert.priority,
        sentToTelegram: false,
      };

      // Get AI analysis for high-priority alerts
      if (alert.priority >= 70 && settings?.aiEnabled) {
        const analysis = await analyzeAlert(
          alertData.type,
          alertData.sport,
          alertData.gameInfo,
          weatherData
        );
        alertData.aiContext = analysis.context;
        alertData.aiConfidence = analysis.confidence;
      }

      const createdAlert = await storage.createAlert(alertData);

      // Send to Telegram for high-priority alerts
      if (alert.priority >= 75 && settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
          chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
        };

        const sent = await sendTelegramAlert(telegramConfig, createdAlert);
        if (sent) {
          await storage.markAlertSentToTelegram(createdAlert.id);
        }
      }

      console.log(`✅ MLB Alert created: ${alert.type} (Priority: ${alert.priority})`);
      
      // Broadcast alert to connected clients
      if (this.onAlert) {
        this.onAlert(createdAlert);
      }
      
      return createdAlert;
      
    } catch (error) {
      console.error('Error processing MLB alert:', error);
    }
  }
}

export const mlbAlertEngine = new MLBAlertEngine();
