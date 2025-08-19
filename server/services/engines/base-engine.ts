import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { analyzeAlert } from '../openai';
import { sendTelegramAlert } from '../telegram';

export interface AlertConfig {
  type: string;
  priority: number;
  probability: number;
  description: string;
  conditions?: (gameState: any) => boolean;
}

export interface SportEngine {
  sport: string;
  alertConfigs: AlertConfig[];
  monitoringInterval: number;
  
  extractGameState(apiData: any): any;
  checkAlertConditions(gameState: any): AlertConfig[];
  processAlerts(alerts: AlertConfig[], gameState: any): Promise<void>;
}

export abstract class BaseSportEngine implements SportEngine {
  abstract sport: string;
  abstract alertConfigs: AlertConfig[];
  abstract monitoringInterval: number;
  
  protected alertHistory = new Map<string, number>();
  protected readonly ALERT_COOLDOWN = 300000; // 5 minutes
  
  abstract extractGameState(apiData: any): any;
  
  checkAlertConditions(gameState: any): AlertConfig[] {
    return this.alertConfigs.filter(config => {
      if (config.conditions) {
        return config.conditions(gameState) && Math.random() < config.probability;
      }
      return Math.random() < config.probability;
    });
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

          const sent = await sendTelegramAlert(telegramConfig, createdAlert);
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
  
  // Optional callback for broadcasting alerts
  public onAlert?: (alert: any) => void;
}