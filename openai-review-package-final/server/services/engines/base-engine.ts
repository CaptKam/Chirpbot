import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { sendTelegramAlert } from '../telegram';

export interface AlertConfig {
  type: string;
  settingKey?: string;
  priority: number;
  probability: number;
  description: string;
  conditions?: (gameState: any) => boolean | Promise<boolean>;
  isPrediction?: boolean;
  predictionEvents?: string[];
  minimumPredictionProbability?: number;
}

export abstract class BaseSportEngine {
  abstract sport: string;
  abstract alertConfigs: AlertConfig[];
  abstract monitoringInterval: number;
  abstract extractGameState(apiData: any): any;
  
  // Base engine properties
  onAlert?: (alert: any) => void;
  protected lastAlertStates = new Map<string, {hash: string, ts: number}>();
  private MAX_KEYS = 5000;
  private MAX_AGE_MS = 30 * 60 * 1000;
  private lastFireAt = new Map<string, number>();
  private MIN_REFIRE_MS = 700;

  async monitor(): Promise<void> {
    // Default implementation - can be overridden by specific engines
    console.log(`🔍 Monitoring ${this.sport} games...`);
  }

  async checkAlertConditions(gameState: any): Promise<AlertConfig[]> {
    const settings = await storage.getSettingsBySport(this.sport);
    if (!settings) return [];

    const triggeredAlerts: AlertConfig[] = [];
    console.log(`🔧 Base engine processing ${this.alertConfigs.length} total alerts`);
    
    for (const config of this.alertConfigs) {
      console.log(`🔍 Processing alert: ${config.type} (settingKey: ${config.settingKey})`);
      
      // Check if this alert type is enabled in settings
      if (config.settingKey && !(settings.alertTypes as any)[config.settingKey]) {
        console.log(`⏭️ Alert type '${config.type}' skipped - setting '${config.settingKey}' is disabled`);
        continue;
      }

      if (!config.conditions) continue;

      try {
        // Handle both sync and async conditions properly
        const conditionResult = config.conditions(gameState);
        const shouldTrigger = conditionResult instanceof Promise ? await conditionResult : conditionResult;
        
        if (shouldTrigger) {
          triggeredAlerts.push(config);
        }
      } catch (error) {
        console.error(`Error checking condition for ${config.type}:`, error);
      }
    }

    console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.awayTeam} vs ${gameState.homeTeam}`);
    if (triggeredAlerts.length > 0) {
      console.log(`   Alert types triggered: ${triggeredAlerts.map((a: AlertConfig) => a.type).join(', ')}`);
    }

    // Filter overlapping alerts to prevent spam
    const filteredAlerts = this.filterOverlappingAlerts(triggeredAlerts);
    if (filteredAlerts.length !== triggeredAlerts.length) {
      console.log(`🔧 After overlap filtering: ${filteredAlerts.length} alerts (removed ${triggeredAlerts.length - filteredAlerts.length} overlapping)`);
    }

    return filteredAlerts;
  }

  protected filterOverlappingAlerts(alerts: AlertConfig[]): AlertConfig[] {
    if (alerts.length <= 1) return alerts;

    // Return only the highest priority alert
    const sortedByPriority = alerts.sort((a, b) => b.priority - a.priority);
    const topAlert = sortedByPriority[0];
    
    console.log(`🎯 FILTER: Keeping only TOP priority alert: ${topAlert.type} (Priority: ${topAlert.priority})`);
    if (sortedByPriority.length > 1) {
      console.log(`⏭️ Suppressed ${sortedByPriority.length - 1} lower priority alerts: ${sortedByPriority.slice(1).map(a => a.type).join(', ')}`);
    }

    return [topAlert];
  }

  protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
    // Simple deduplication logic
    const globalKey = alertType;
    const now = Date.now();
    const cooldownMs = 30000; // 30 seconds

    const lastGlobalFire = this.lastFireAt.get(globalKey);
    if (lastGlobalFire && (now - lastGlobalFire) < cooldownMs) {
      return false;
    }

    this.lastFireAt.set(globalKey, now);
    return true;
  }

  async processAlerts(triggeredAlerts: AlertConfig[], gameState: any): Promise<void> {
    // Only process one alert per game per polling cycle
    if (triggeredAlerts.length === 0) return;
    
    // Get the highest priority alert only
    const sortedAlerts = triggeredAlerts.sort((a, b) => b.priority - a.priority);
    const alert = sortedAlerts[0];
    
    console.log(`🎯 Processing ONLY ONE alert per game: ${alert.type} (Priority: ${alert.priority})`);
    if (sortedAlerts.length > 1) {
      console.log(`⏭️ Suppressing ${sortedAlerts.length - 1} other alerts: ${sortedAlerts.slice(1).map(a => a.type).join(', ')}`);
    }
    
    if (!this.shouldTriggerAlert(alert.type, gameState.gameId, gameState)) {
      console.log(`⏭️ Alert '${alert.type}' skipped due to deduplication`);
      return;
    }

    try {
      // Get weather data using city name instead of team name  
      let cityName = gameState.homeTeam;
      const teamCityMap: Record<string, string> = {
        'Los Angeles Angels': 'Los Angeles', 'Los Angeles Dodgers': 'Los Angeles',
        'Oakland Athletics': 'Oakland', 'San Francisco Giants': 'San Francisco', 
        'Athletics': 'Oakland', 'Seattle Mariners': 'Seattle', 'Texas Rangers': 'Arlington',
        'Houston Astros': 'Houston', 'Minnesota Twins': 'Minneapolis',
        'Kansas City Royals': 'Kansas City', 'Chicago White Sox': 'Chicago',
        'Chicago Cubs': 'Chicago', 'Cleveland Guardians': 'Cleveland',
        'Detroit Tigers': 'Detroit', 'Milwaukee Brewers': 'Milwaukee',
        'St. Louis Cardinals': 'St. Louis', 'Atlanta Braves': 'Atlanta',
        'Miami Marlins': 'Miami', 'New York Yankees': 'New York',
        'New York Mets': 'New York', 'Philadelphia Phillies': 'Philadelphia',
        'Washington Nationals': 'Washington', 'Boston Red Sox': 'Boston',
        'Toronto Blue Jays': 'Toronto', 'Baltimore Orioles': 'Baltimore',
        'Tampa Bay Rays': 'Tampa', 'Pittsburgh Pirates': 'Pittsburgh',
        'Cincinnati Reds': 'Cincinnati', 'Colorado Rockies': 'Denver',
        'Arizona Diamondbacks': 'Phoenix', 'San Diego Padres': 'San Diego'
      };
      
      if (teamCityMap[gameState.homeTeam]) {
        cityName = teamCityMap[gameState.homeTeam];
      }
      
      const weatherData = await getWeatherData(cityName);

      const alertData = {
        type: alert.type,
        sport: this.sport,
        title: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
        description: alert.description,
        gameInfo: {
          score: {
            away: gameState.awayScore || 0,
            home: gameState.homeScore || 0
          },
          status: 'Live',
          awayTeam: gameState.awayTeam,
          homeTeam: gameState.homeTeam,
          ...this.getGameSpecificInfo(gameState)
        },
        weatherData,
        sentToTelegram: false,
        priority: alert.priority,
        probability: alert.probability
      };

      const settings = await storage.getSettingsBySport(this.sport);
      const createdAlert = await storage.createAlert(alertData);

      // Send to Telegram for high-priority alerts
      if (alert.priority >= 75 && settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || "default_key",
          chatId: process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || "default_key",
        };
        const sent = await sendTelegramAlert(telegramConfig, createdAlert);
        if (sent) {
          await storage.markAlertSentToTelegram(createdAlert.id);
        }
      }

      console.log(`✅ ${this.sport} Alert created: ${alert.type} (Priority: ${alert.priority})`);

      // INSTANT BROADCAST: Send alert immediately via WebSocket
      if (this.onAlert) {
        this.onAlert(createdAlert);
        console.log(`📡 Alert broadcast immediately via WebSocket`);
      }

    } catch (error) {
      console.error(`Error processing ${this.sport} alert:`, error);
    }
  }

  protected getGameSpecificInfo(gameState: any): any {
    // Default implementation - can be overridden by specific engines
    return {};
  }

  protected buildGameContext(gameState: any): any {
    // Default implementation - can be overridden by specific engines
    return {
      sport: this.sport,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live'
    };
  }
}