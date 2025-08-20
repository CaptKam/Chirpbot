import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { sendTelegramAlert } from '../telegram';
import { PredictionRequest, GameContext, PREDICTION_EVENTS } from '../ai-predictions';
import { getOpenAIManager } from '../openai-manager';
import { randomUUID } from 'crypto'; // Assuming crypto is available for randomUUID

export interface AlertConfig {
  type: string;
  settingKey?: string; // Maps to alertTypes setting key
  priority: number;
  probability: number;
  description: string;
  conditions?: (gameState: any) => boolean;
  isPrediction?: boolean;
  predictionEvents?: string[];
  minimumPredictionProbability?: number;
}

export interface SportEngine {
  sport: string;
  alertConfigs: AlertConfig[];
  monitoringInterval: number;

  extractGameState(apiData: any): any;
  checkAlertConditions(gameState: any): Promise<AlertConfig[]>;
  processAlerts(alerts: AlertConfig[], gameState: any): Promise<void>;
}

export abstract class BaseSportEngine implements SportEngine {
  abstract sport: string;
  abstract alertConfigs: AlertConfig[];
  abstract monitoringInterval: number;

  // Track last game state that triggered each alert to prevent duplicates
  protected lastAlertStates = new Map<string, {hash: string, ts: number}>();
  private MAX_KEYS = 5000;
  private MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
  private lastFireAt = new Map<string, number>(); // track last fire time
  private MIN_REFIRE_MS = 20000; // 20 seconds minimum between same alerts

  abstract extractGameState(apiData: any): any;
  abstract monitor(): Promise<void>;

  async checkAlertConditions(gameState: any): Promise<AlertConfig[]> {
    // Get settings to check which alert types are enabled
    const settings = await storage.getSettingsBySport(this.sport);
    if (!settings) {
      return [];
    }

    const regularAlerts = this.alertConfigs.filter(config => !config.isPrediction);
    const predictionAlerts = this.alertConfigs.filter(config => config.isPrediction);

    // Process regular condition-based alerts
    const triggeredRegular = regularAlerts.filter(config => {
      // Check if this alert type is enabled in settings
      if (config.settingKey && !(settings.alertTypes as any)[config.settingKey]) {
        console.log(`⏭️ Alert type '${config.type}' skipped - setting '${config.settingKey}' is disabled`);
        return false;
      }

      if (config.conditions) {
        const conditionMet = config.conditions(gameState);
        const probabilityMet = Math.random() < config.probability;
        if (conditionMet && !probabilityMet) {
          console.log(`🎲 Alert type '${config.type}' condition met but probability check failed (${config.probability * 100}% chance)`);
        }
        return conditionMet && probabilityMet;
      }
      return Math.random() < config.probability;
    });

    // Process AI prediction-based alerts - only if AI is enabled and there are prediction alerts
    let triggeredPredictions: AlertConfig[] = [];
    if (settings.aiEnabled && predictionAlerts.length > 0) {
      triggeredPredictions = await this.checkPredictionAlerts(predictionAlerts, gameState);
    }

    return [...triggeredRegular, ...triggeredPredictions];
  }

  protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
    const key = `${gameId}-${alertType}`;
    const stateHash = this.createGameStateHash(gameState, alertType);
    const now = Date.now();

    // Check minimum refire interval
    const lastFire = this.lastFireAt.get(key) ?? 0;
    if (now - lastFire < this.MIN_REFIRE_MS) {
      return false;
    }

    // Check if same state
    const prev = this.lastAlertStates.get(key);
    if (prev && prev.hash === stateHash) {
      return false;
    }

    // Update tracking
    this.lastAlertStates.set(key, { hash: stateHash, ts: now });
    this.lastFireAt.set(key, now);

    // Prune old entries if map gets too large
    if (this.lastAlertStates.size > this.MAX_KEYS) {
      const cutoff = now - this.MAX_AGE_MS;
      const entries = Array.from(this.lastAlertStates.entries());
      for (const [k, v] of entries) {
        if (v.ts < cutoff) {
          this.lastAlertStates.delete(k);
          this.lastFireAt.delete(k);
        }
      }
    }

    return true;
  }

  protected createGameStateHash(gameState: any, alertType: string): string {
    // Only track properties relevant to each alert type to avoid duplicates
    let relevantState: any = {};

    // For runner-based alerts, track runners and outs (ignore balls/strikes)
    if (alertType.toLowerCase().includes('runner') || alertType.toLowerCase().includes('risp') || alertType.toLowerCase().includes('bases')) {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs,
        r1: !!gameState.runners?.first,
        r2: !!gameState.runners?.second,
        r3: !!gameState.runners?.third,
        away: gameState.awayScore,
        home: gameState.homeScore
      };
    }
    // For inning-based alerts, track inning changes only
    else if (alertType.toLowerCase().includes('inning')) {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs
      };
    }
    // For score-based alerts, track score
    else if (alertType.toLowerCase().includes('score') || alertType.toLowerCase().includes('tie')) {
      relevantState = {
        score: `${gameState.awayScore}-${gameState.homeScore}`,
        inning: gameState.inning
      };
    }
    // Default: track major game state changes
    else {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs,
        runners: gameState.runners,
        score: `${gameState.awayScore}-${gameState.homeScore}`
      };
    }

    return JSON.stringify(relevantState);
  }

  async processAlerts(triggeredAlerts: AlertConfig[], gameState: any): Promise<void> {
    for (const alert of triggeredAlerts) {
      if (!this.shouldTriggerAlert(alert.type, gameState.gameId, gameState)) {
        continue;
      }

      try {
        const weatherData = await getWeatherData(gameState.homeTeam);

        // Get AI analysis for ALL alerts when AI is enabled
        let aiContext = `${alert.type} situation detected`;
        let aiConfidence = 75;

        // Use centralized OpenAI manager for AI analysis
        if ((await storage.getSettingsBySport(this.sport))?.aiEnabled) {
          try {
            const openaiManager = getOpenAIManager();
            const aiAnalysis = await openaiManager.analyzeAlert(
              alert.type,
              this.sport,
              {
                score: {
                  away: gameState.awayScore,
                  home: gameState.homeScore
                },
                status: 'Live', // Assuming 'Live' status for alerts
                awayTeam: gameState.awayTeam,
                homeTeam: gameState.homeTeam,
                ...this.getGameSpecificInfo(gameState)
              },
              weatherData
            );
            aiContext = aiAnalysis.context;
            aiConfidence = aiAnalysis.confidence;
          } catch (error) {
            console.log(`AI analysis skipped for ${alert.type}: ${error}`);
          }
        }

        const alertData = {
          type: alert.type,
          sport: this.sport,
          title: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
          description: alert.description,
          gameInfo: {
            score: {
              away: gameState.awayScore,
              home: gameState.homeScore
            },
            status: 'Live',
            awayTeam: gameState.awayTeam,
            homeTeam: gameState.homeTeam,
            ...this.getGameSpecificInfo(gameState)
          },
          weatherData,
          aiContext: aiContext,
          aiConfidence: aiConfidence,
          sentToTelegram: false,
        };

        // Get settings for this sport
        const settings = await storage.getSettingsBySport(this.sport);

        const createdAlert = await storage.createAlert(alertData);

        // Send to Telegram for high-priority alerts (check both push notifications and telegram toggles)
        if (alert.priority >= 75 && settings?.pushNotificationsEnabled && settings?.telegramEnabled) {
          const telegramConfig = {
            botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
            chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
          };

          const sent = await sendTelegramAlert(telegramConfig, {
            ...createdAlert,
            aiContext: createdAlert.aiContext || undefined
          });
          if (sent) {
            await storage.markAlertSentToTelegram(createdAlert.id);
          }
        }

        console.log(`✅ ${this.sport} Alert created: ${alert.type} (Priority: ${alert.priority})`);

        // Broadcast to clients if callback exists
        if (this.onAlert) {
          this.onAlert(createdAlert);
        }

      } catch (error) {
        console.error(`Error processing ${this.sport} alert:`, error);
      }
    }
  }

  protected abstract getGameSpecificInfo(gameState: any): any;

  protected abstract buildGameContext(gameState: any): GameContext;

  private async checkPredictionAlerts(predictionConfigs: AlertConfig[], gameState: any): Promise<AlertConfig[]> {
    if (predictionConfigs.length === 0) return [];

    // Get settings to check which prediction alerts are enabled
    const settings = await storage.getSettingsBySport(this.sport);
    if (!settings?.aiEnabled) {
      return [];
    }

    // Filter prediction configs by enabled settings
    const enabledPredictionConfigs = predictionConfigs.filter(config => {
      if (config.settingKey && !(settings.alertTypes as any)[config.settingKey]) {
        return false;
      }
      return true;
    });

    if (enabledPredictionConfigs.length === 0) return [];

    try {
      const gameContext = this.buildGameContext(gameState);
      const allPredictionEvents = enabledPredictionConfigs.flatMap(config => config.predictionEvents || []);

      if (allPredictionEvents.length === 0) return [];

      const uniqueEvents = Array.from(new Set(allPredictionEvents));
      const predictionRequest: PredictionRequest = {
        eventTypes: uniqueEvents, // Remove duplicates
        context: gameContext,
        minimumProbability: 60 // Default threshold
      };

      // Use centralized OpenAI manager for predictions
      const openaiManager = getOpenAIManager();
      const predictions = await openaiManager.generatePredictions(
        predictionRequest.eventTypes,
        predictionRequest.context,
        predictionRequest.minimumProbability
      );

      // Match predictions to alert configs
      const triggeredPredictions: AlertConfig[] = [];

      for (const config of enabledPredictionConfigs) {
        const relevantPredictions = predictions.filter(p =>
          config.predictionEvents?.includes(p.eventType) &&
          p.probability >= (config.minimumPredictionProbability || 60) &&
          p.shouldAlert
        );

        if (relevantPredictions.length > 0) {
          // Create a new alert config with prediction data
          const predictionAlert: AlertConfig = {
            ...config,
            description: `${config.description} - AI Prediction: ${relevantPredictions[0].reasoning}`,
            probability: relevantPredictions[0].probability / 100,
            priority: Math.max(config.priority, relevantPredictions[0].confidence)
          };

          triggeredPredictions.push(predictionAlert);
        }
      }

      return triggeredPredictions;

    } catch (error) {
      console.error(`Error checking prediction alerts for ${this.sport}:`, error);
      return [];
    }
  }

  // Optional callback for broadcasting alerts
  public onAlert?: (alert: any) => void;
}