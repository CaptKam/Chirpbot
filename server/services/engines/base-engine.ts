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
  
  // Add onAlert callback for real-time WebSocket broadcasting
  onAlert?: (alert: any) => void;

  protected lastAlertStates = new Map<string, {hash: string, ts: number}>();
  private MAX_KEYS = 5000;
  private MAX_AGE_MS = 30 * 60 * 1000;
  private lastFireAt = new Map<string, number>();
  private MIN_REFIRE_MS = 3000;  // Gambling alerts need 3-second windows!

  abstract extractGameState(apiData: any): any;
  abstract monitor(): Promise<void>;

  async checkAlertConditions(gameState: any): Promise<AlertConfig[]> {
    const settings = await storage.getSettingsBySport(this.sport);
    if (!settings) return [];

    const triggeredAlerts: AlertConfig[] = [];
    
    for (const config of this.alertConfigs) {
      if (config.settingKey && !(settings.alertTypes as any)[config.settingKey]) {
        console.log(`⏭️ Alert type '${config.type}' skipped - setting '${config.settingKey}' is disabled`);
        continue;
      }

      if (!config.conditions) continue;

      try {
        if (config.conditions(gameState)) {
          triggeredAlerts.push(config);
        }
      } catch (error) {
        console.error(`Error checking condition for ${config.type}:`, error);
      }
    }

    return triggeredAlerts;
  }

  protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
    // 🎯 GAMBLING ALERTS: Allow Hybrid RE24+AI to fire every time for 3-second decision windows
    if (alertType.includes('Hybrid RE24+AI')) {
      const key = `${gameId}_${alertType}`;
      const now = Date.now();
      const lastFire = this.lastFireAt.get(key);
      
      // Only wait 2 seconds for gambling alerts
      if (lastFire && (now - lastFire) < 2000) {
        return false;
      }
      this.lastFireAt.set(key, now);
      return true;
    }

    const stateHash = this.generateGameStateHash(alertType, gameState);
    const key = `${gameId}_${alertType}`;
    const now = Date.now();

    const lastFire = this.lastFireAt.get(key);
    if (lastFire && (now - lastFire) < this.MIN_REFIRE_MS) {
      return false;
    }

    const lastState = this.lastAlertStates.get(key);
    if (lastState && lastState.hash === stateHash && (now - lastState.ts) < 5000) {  // Reduced from 60s to 5s
      return false;
    }

    this.lastAlertStates.set(key, { hash: stateHash, ts: now });
    this.lastFireAt.set(key, now);

    if (this.lastAlertStates.size > this.MAX_KEYS) {
      const cutoff = now - this.MAX_AGE_MS;
      const entries = Array.from(this.lastAlertStates.entries());
      for (const [k, v] of entries) {
        if (v.ts < cutoff) {
          this.lastAlertStates.delete(k);
        }
      }
    }

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
    // ANTI-BATCH FIX: Only send the highest priority alert to prevent batching
    if (triggeredAlerts.length === 0) return;
    
    // Sort by priority (highest first) and only process the top alert
    const sortedAlerts = triggeredAlerts.sort((a, b) => b.priority - a.priority);
    const alert = sortedAlerts[0];
    
    console.log(`🎯 Processing ONLY highest priority alert: ${alert.type} (Priority: ${alert.priority})`);
    if (sortedAlerts.length > 1) {
      console.log(`⏭️ Skipping ${sortedAlerts.length - 1} lower priority alerts: ${sortedAlerts.slice(1).map(a => a.type).join(', ')}`);
    }
    
    // 🎯 GAMBLING FIX: Skip deduplication for gambling alerts in base engine
    if (alert.type !== 'Hybrid RE24+AI Analysis') {
      if (!this.shouldTriggerAlert(alert.type, gameState.gameId, gameState)) {
        console.log(`⏭️ Alert '${alert.type}' skipped due to deduplication`);
        return;
      }
    } else {
      console.log(`🎯 BASE ENGINE: Processing gambling alert '${alert.type}' without deduplication!`);
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