import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { analyzeAlert } from '../openai';
import { sendTelegramAlert } from '../telegram';
import { sendSMS, formatAlertForSMS } from '../sms';
import { generatePredictions, PredictionRequest, GameContext, PREDICTION_EVENTS } from '../ai-predictions';

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
  
  protected alertHistory = new Map<string, number>();
  protected readonly ALERT_COOLDOWN = 300000; // 5 minutes
  
  abstract extractGameState(apiData: any): any;
  
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
        return false;
      }
      
      if (config.conditions) {
        return config.conditions(gameState) && Math.random() < config.probability;
      }
      return Math.random() < config.probability;
    });
    
    // Process AI prediction-based alerts
    const triggeredPredictions = await this.checkPredictionAlerts(predictionAlerts, gameState);
    
    return [...triggeredRegular, ...triggeredPredictions];
  }
  
  protected shouldTriggerAlert(alertType: string, gameId: string): boolean {
    const alertKey = `${gameId}-${alertType}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const now = Date.now();
    
    if (lastAlert && (now - lastAlert) < this.ALERT_COOLDOWN) {
      return false;
    }
    
    this.alertHistory.set(alertKey, now);
    return true;
  }
  
  async processAlerts(triggeredAlerts: AlertConfig[], gameState: any): Promise<void> {
    for (const alert of triggeredAlerts) {
      if (!this.shouldTriggerAlert(alert.type, gameState.gameId)) {
        continue;
      }
      
      try {
        const weatherData = await getWeatherData(gameState.homeTeam);
        
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
          aiContext: undefined as string | undefined,
          aiConfidence: alert.priority,
          sentToTelegram: false,
        };

        // Get settings for this sport
        const settings = await storage.getSettingsBySport(this.sport);
        
        // Get AI analysis for high-priority alerts
        if (alert.priority >= 70 && settings?.aiEnabled) {
          const analysis = await analyzeAlert(
            alertData.type,
            alertData.sport,
            alertData.gameInfo,
            weatherData
          );
          alertData.aiContext = analysis.context || undefined;
          alertData.aiConfidence = analysis.confidence;
        }

        const createdAlert = await storage.createAlert(alertData);

        // Send to Telegram for high-priority alerts
        if (alert.priority >= 75 && settings?.telegramEnabled) {
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
        
        // Send SMS for high-priority alerts
        if (alert.priority >= 75 && settings?.smsEnabled && settings?.phoneNumber) {
          try {
            const smsMessage = formatAlertForSMS({
              type: alert.type,
              sport: this.sport,
              title: alertData.title,
              description: alert.description,
              gameInfo: alertData.gameInfo
            });
            const smsSent = await sendSMS(settings.phoneNumber, smsMessage);
            if (smsSent) {
              console.log(`📱 SMS alert sent for ${alert.type}`);
            }
          } catch (error) {
            console.error('SMS notification failed:', error);
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
      
      const predictions = await generatePredictions(predictionRequest);
      
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