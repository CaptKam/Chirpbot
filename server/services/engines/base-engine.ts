import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { sendTelegramAlert } from '../telegram';
import { enhanceHighPriorityAlert, generateAdvancedPredictions } from '../ai-analysis';
import { randomUUID } from 'crypto';

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
  
  // Add onAlert callback for real-time WebSocket broadcasting
  onAlert?: (alert: any) => void;

  protected lastAlertStates = new Map<string, {hash: string, ts: number}>();
  private MAX_KEYS = 5000;
  private MAX_AGE_MS = 30 * 60 * 1000;
  private lastFireAt = new Map<string, number>();
  private MIN_REFIRE_MS = 700;  // 0.7 seconds for critical situations like your successful system

  abstract extractGameState(apiData: any): any;
  abstract monitor(): Promise<void>;

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
      console.log(`   Alert types triggered: ${triggeredAlerts.map(a => a.type).join(', ')}`);
    }

    // 🎯 ANTI-SPAM: Filter overlapping alerts to prevent spam
    const filteredAlerts = this.filterOverlappingAlerts(triggeredAlerts);
    if (filteredAlerts.length !== triggeredAlerts.length) {
      console.log(`🔧 After overlap filtering: ${filteredAlerts.length} alerts (removed ${triggeredAlerts.length - filteredAlerts.length} overlapping)`);
    }

    return filteredAlerts;
  }

  protected filterOverlappingAlerts(alerts: AlertConfig[]): AlertConfig[] {
    if (alerts.length <= 1) return alerts;

    // 🎯 ULTRA ANTI-SPAM: Return only the highest priority alert
    const sortedByPriority = alerts.sort((a, b) => b.priority - a.priority);
    const topAlert = sortedByPriority[0];
    
    console.log(`🎯 ULTRA FILTER: Keeping only TOP priority alert: ${topAlert.type} (Priority: ${topAlert.priority})`);
    if (sortedByPriority.length > 1) {
      console.log(`⏭️ Suppressed ${sortedByPriority.length - 1} lower priority alerts: ${sortedByPriority.slice(1).map(a => a.type).join(', ')}`);
    }

    return [topAlert];
  }

  protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
    // 🎯 GLOBAL DEDUPLICATION: Only ONE alert per alert type across ALL games
    // Use alertType as key instead of gameId_alertType
    const globalKey = alertType;
    const now = Date.now();
    const cooldownMs = 30000; // 30 seconds between same alert types globally

    const lastGlobalFire = this.lastFireAt.get(globalKey);
    if (lastGlobalFire && (now - lastGlobalFire) < cooldownMs) {
      console.log(`🚫 GLOBAL DEDUP: Alert type '${alertType}' blocked - fired ${((now - lastGlobalFire) / 1000).toFixed(1)}s ago`);
      return false;
    }

    // For Game Situations, only trigger once per alert type regardless of which game has it
    this.lastFireAt.set(globalKey, now);
    console.log(`✅ GLOBAL ALERT: '${alertType}' allowed - first occurrence in 30s window`);

    return true;
  }

  protected generateGameStateHash(alertType: string, gameState: any): string {
    let relevantState: any = {};

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
        // Removed batter and pitch count - only situation matters for runners
      };
    } else if (alertType.toLowerCase().includes('inning')) {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs
      };
    } else if (alertType.toLowerCase().includes('score') || alertType.toLowerCase().includes('tie')) {
      relevantState = {
        score: `${gameState.awayScore}-${gameState.homeScore}`,
        inning: gameState.inning
      };
    } else {
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
    // 🎯 ULTIMATE ANTI-SPAM: Only ONE alert per game per polling cycle
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

      // 🤖 AI ENHANCEMENT: For high-priority alerts (80+), use AI to enhance descriptions
      let finalDescription = alert.description;
      let finalPriority = alert.priority;
      
      // 🎰 FORCE BETTING INTELLIGENCE FOR ALL ALERTS 
      if (alert.priority >= 50) {
        const settings = await storage.getSettingsBySport(this.sport);
        console.log(`🎰 BETTING INTEL: Priority ${alert.priority}, AI Enabled: ${(settings as any)?.aiEnabled}, Type: ${alert.type}`);
        if (settings && (settings as any).aiEnabled) {
          try {
            const gameContext = this.buildGameContext(gameState);
            const enhanced = await enhanceHighPriorityAlert(
              alert.type,
              gameContext,
              alert.description,
              alert.priority
            );
            
            if (enhanced) {
              finalDescription = enhanced.enhancedDescription;
              finalPriority = enhanced.priority;
              
              // 🚀 GENERATE ADVANCED PREDICTIONS
              const predictions = await generateAdvancedPredictions(gameContext, alert.type);
              if (predictions) {
                finalDescription += ` | 📊 Analytics: WP±${predictions.winProbabilityShift}% | Leverage: ${predictions.leverageIndex} | Clutch: ${predictions.clutchRating}% | ${predictions.predictedOutcome}`;
                console.log(`🧠 Advanced AI Prediction: ${predictions.predictedOutcome}`);
              }
              
              console.log(`🤖 AI Enhanced: ${alert.type} - "${enhanced.enhancedDescription}"`);
            }
          } catch (error) {
            console.log(`🤖 AI enhancement failed for ${alert.type}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        } else {
          console.log(`🤖 AI enhancement skipped - AI disabled in settings`);
        }
      }

      const alertData = {
        type: alert.type,
        sport: this.sport,
        title: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
        description: finalDescription,
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
        sentToTelegram: false,
        priority: finalPriority, // Use AI-enhanced priority if available
        probability: alert.probability
      };

      const settings = await storage.getSettingsBySport(this.sport);
      const createdAlert = await storage.createAlert(alertData);

      // Send to Telegram for high-priority alerts (using enhanced priority)
      if (finalPriority >= 75 && settings?.telegramEnabled) {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || "default_key",
          chatId: process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || "default_key",
        };
        const sent = await sendTelegramAlert(telegramConfig, createdAlert);
        if (sent) {
          await storage.markAlertSentToTelegram(createdAlert.id);
        }
      }

      console.log(`✅ ${this.sport} Alert created: ${alert.type} (Priority: ${finalPriority}${finalPriority !== alert.priority ? ` - AI Enhanced from ${alert.priority}` : ''})`);

      // INSTANT BROADCAST: Send alert immediately via WebSocket
      if (this.onAlert) {
        this.onAlert(createdAlert);
        console.log(`📡 Alert broadcast immediately via WebSocket`);
      }

    } catch (error) {
      console.error(`Error processing ${this.sport} alert:`, error);
    }
  }

  protected abstract getGameSpecificInfo(gameState: any): any;
  protected abstract buildGameContext(gameState: any): any;

  private async checkPredictionAlerts(predictionConfigs: AlertConfig[], gameState: any): Promise<AlertConfig[]> {
    if (predictionConfigs.length === 0) return [];

    const settings = await storage.getSettingsBySport(this.sport);
    if (!settings) {
      return [];
    }

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
      const predictionRequest: any = {
        eventTypes: uniqueEvents,
        context: gameContext,
        minimumProbability: 60
      };

      const predictionResults = await this.makePredictionRequest(predictionRequest);

      const triggeredPredictions: AlertConfig[] = [];
      for (const config of enabledPredictionConfigs) {
        if (config.predictionEvents) {
          for (const eventType of config.predictionEvents) {
            const prediction = predictionResults.find((p: any) => p.eventType === eventType);
            if (prediction && prediction.probability >= (config.minimumPredictionProbability || 60)) {
              const probabilityAlert = {
                ...config,
                type: `${config.type} (${Math.round(prediction.probability)}% chance)`,
                description: `${config.description} - ${Math.round(prediction.probability)}% probability`,
                probability: prediction.probability / 100
              };
              triggeredPredictions.push(probabilityAlert);
            } else if (prediction) {
              console.log(`🎲 Alert type '${config.type}' condition met but probability check failed (${Math.round(prediction.probability)}% chance)`);
            }
          }
        }
      }

      return triggeredPredictions;
    } catch (error) {
      console.error(`Error getting prediction alerts for ${this.sport}:`, error);
      return [];
    }
  }

  private async makePredictionRequest(request: any): Promise<any[]> {
    console.log(`🔮 Making prediction request with ${request.eventTypes.length} event types`);
    
    try {
      const predictions = request.eventTypes.map((eventType: string) => ({
        eventType,
        probability: Math.random() * 40 + 30
      }));

      return predictions;
    } catch (error) {
      console.error(`Prediction request failed:`, error);
      return [];
    }
  }
}