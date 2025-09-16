import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class WNBAEngine extends BaseSportEngine {
  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    probabilityCalculationTime: [] as number[],
    gameStateEnhancementTime: [] as number[],
    aiEnhancementTime: [] as number[],
    enhancedAlerts: 0,
    clutchTimeDetections: 0,
    overtimeAlerts: 0,
    closeGameSituations: 0
  };

  constructor() {
    super('WNBA');
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual WNBA alert types
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER',
        // New WNBA predictive alert types
        'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL',
        'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ];

      if (!validWNBAAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid WNBA alert type - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`WNBA Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability

      // Enhanced WNBA-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, homeScore, awayScore, possession } = gameState;

      // Quarter-specific adjustments (optimized calculation)
      if (quarter === 1) probability += 10; // First quarter action
      else if (quarter === 2) probability += 12; // Second quarter momentum
      else if (quarter === 3) probability += 14; // Third quarter adjustments
      else if (quarter === 4) probability += 20; // Fourth quarter drama
      else if (quarter >= 5) probability += 30; // Overtime intensity

      // Time factors (optimized time parsing)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 60 && (quarter >= 4)) {
          probability += 25; // Final minute crunch time
        } else if (timeSeconds <= 120 && (quarter >= 4)) {
          probability += 18; // Final two minutes
        } else if (timeSeconds <= 300 && (quarter >= 4)) {
          probability += 12; // Final 5 minutes
        }

        // Shot clock scenarios (24-second WNBA shot clock)
        if (timeSeconds % 24 <= 5 && quarter >= 3) {
          probability += 8; // Shot clock pressure
        }
      }

      // Score differential (quick calculation)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 2) probability += 25; // Very close game (WNBA pace)
        else if (scoreDiff <= 5) probability += 18; // Close game
        else if (scoreDiff <= 10) probability += 10; // Competitive game
        else if (scoreDiff <= 15) probability += 5; // Moderately competitive
        else if (scoreDiff >= 20) probability -= 15; // Blowout

        // High-scoring game bonus (WNBA average ~85 points per team)
        const totalScore = homeScore + awayScore;
        if (totalScore >= 160 && quarter >= 3) probability += 12; // High-scoring
        else if (totalScore >= 140 && quarter >= 3) probability += 8; // Above average
        else if (totalScore <= 120 && quarter >= 3) probability += 6; // Defensive battle
      }

      // Possession and momentum factors
      if (possession && quarter >= 3) {
        probability += 3; // Possession adds context in later quarters
      }

      // Basketball-specific situational boosts
      if (quarter >= 4) {
        // Fourth quarter and overtime get extra weight
        if (homeScore !== undefined && awayScore !== undefined) {
          const scoreDiff = Math.abs(homeScore - awayScore);
          if (scoreDiff <= 8) probability += 15; // One possession games are crucial
        }
      }

      const finalProbability = Math.min(Math.max(probability, 10), 95);

      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);

      if (calculationTime > 50) {
        console.log(`⚠️ WNBA Slow probability calculation: ${calculationTime}ms for game ${gameState.gameId}`);
      }

      return finalProbability;
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      console.error(`❌ WNBA Probability calculation failed after ${calculationTime}ms:`, error);
      return 50; // Safe fallback
    }
  }

  // Override to add WNBA-specific game state enhancement and performance monitoring
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Enhance game state with WNBA-specific live data if needed
      const enhanceStartTime = Date.now();
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);
      const enhanceTime = Date.now() - enhanceStartTime;
      this.performanceMetrics.enhanceDataTime.push(enhanceTime);

      // Use the parent class method which properly calls all loaded modules
      const alertStartTime = Date.now();
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      const alertTime = Date.now() - alertStartTime;

      // Process alerts with cross-sport AI enhancement for high-priority WNBA situations
      const alerts = await this.processEnhancedWNBAAlerts(rawAlerts, enhancedGameState);
      this.performanceMetrics.alertGenerationTime.push(alertTime);

      this.performanceMetrics.totalAlerts += alerts.length;

      // Send alerts to both WebSocket and Telegram simultaneously
      await this.deliverAlertsToAllChannels(alerts, enhancedGameState);

      const totalTime = Date.now() - startTime;
      if (totalTime > 100) {
        console.log(`⚠️ WNBA Slow alert generation: ${totalTime}ms for game ${gameState.gameId} (enhance: ${enhanceTime}ms, alerts: ${alertTime}ms)`);
      }

      return alerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ WNBA Alert generation failed after ${totalTime}ms:`, error);
      return [];
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      // Get live data from WNBA API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { WNBAApiService } = await import('../wnba-api');
        const wnbaApi = new WNBAApiService();
        const enhancedData = await wnbaApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          return {
            ...gameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
            possession: enhancedData.possession || null,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            // WNBA-specific fields
            period: enhancedData.period || gameState.quarter,
            clock: enhancedData.clock || gameState.timeRemaining,
            situation: enhancedData.situation || {}
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing WNBA game state with live data:', error);
    }

    return gameState;
  }

  // Process alerts with cross-sport AI enhancement for high-priority WNBA situations
  private async processEnhancedWNBAAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Process all alerts for AI enhancement to ensure maximum coverage
        const probability = await this.calculateProbability(gameState);

        console.log(`🧠 WNBA AI Enhancement: Processing ${alert.type} alert (${probability}%)`);

        // Build cross-sport context for WNBA
        const aiContext: CrossSportContext = {
            sport: 'WNBA',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            quarter: gameState.quarter,
            timeRemaining: gameState.timeRemaining,
            timeLeft: gameState.timeRemaining,
            shotClock: (gameState as any).shotClock || 24,
            fouls: {
              home: (gameState as any).homeFouls || 0,
              away: (gameState as any).awayFouls || 0
            },
            possession: gameState.possession,
            originalMessage: alert.message,
            originalContext: alert.context
          };

        // NON-BLOCKING: Queue for async AI enhancement and return base alert immediately
        unifiedAIProcessor.queueAlert(alert, aiContext, 'system').catch(error => {
          console.warn(`⚠️ WNBA AI Queue failed for ${alert.type}:`, error);
        });
        console.log(`🚀 WNBA Async AI: Queued ${alert.type} for background enhancement`);
        
        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ WNBA AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    this.performanceMetrics.aiEnhancementTime.push(aiTime);
    if (aiTime > 50) {
      console.log(`⚠️ WNBA AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Send alerts to Telegram - WebSocket broadcasting removed to prevent duplicates
  // Note: WebSocket broadcasting now handled exclusively by AsyncAI processor for enhancement
  private async deliverAlertsToAllChannels(alerts: AlertResult[], gameState: GameState): Promise<void> {
    if (!alerts || alerts.length === 0) return;
    
    try {
      console.log(`🚀 Delivering ${alerts.length} WNBA alerts to Telegram (WebSocket handled by AsyncAI processor)`);
      
      // Only Telegram delivery - WebSocket broadcasting removed to prevent duplicates
      await this.deliverAlertsToTelegram(alerts, gameState);
      
      console.log(`✅ Telegram delivery complete for ${alerts.length} alerts`);
      
    } catch (error) {
      console.error('❌ Alert delivery system error:', error);
    }
  }

  // REMOVED: WebSocket delivery method - prevents duplicate alerts
  // WebSocket broadcasting now handled exclusively by AsyncAI processor in routes.ts
  // This ensures all alerts go through AI enhancement before being broadcast
  // 
  // private async deliverAlertsToWebSocket(alerts: AlertResult[], gameState: GameState): Promise<void> {
  //   // Method removed to prevent duplicate WebSocket broadcasts
  //   // All WebSocket delivery now handled by AsyncAI processor for proper enhancement
  // }

  private async deliverAlertsToTelegram(alerts: AlertResult[], gameState: GameState): Promise<void> {
    try {
      // Get all users with Telegram enabled
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(user => 
        user.telegramEnabled && 
        user.telegramBotToken && 
        user.telegramChatId &&
        user.telegramBotToken !== 'default_key' &&
        user.telegramChatId !== 'test-chat-id'
      );
      
      if (telegramUsers.length === 0) {
        console.log('📱 ℹ️ No users with valid Telegram configurations found');
        return;
      }
      
      console.log(`📱 🚀 Delivering ${alerts.length} WNBA alerts to ${telegramUsers.length} Telegram users`);
      
      // Send alerts to each user
      for (const alert of alerts) {
        for (const user of telegramUsers) {
          try {
            const telegramConfig: TelegramConfig = {
              botToken: user.telegramBotToken!,
              chatId: user.telegramChatId!
            };
            
            const telegramAlert = {
              id: alert.alertKey,
              type: alert.type,
              title: alert.message.split('|')[0].trim(),
              description: alert.message,
              gameInfo: {
                sport: 'WNBA',
                awayTeam: gameState.awayTeam,
                homeTeam: gameState.homeTeam,
                awayScore: gameState.awayScore,
                homeScore: gameState.homeScore,
                score: {
                  away: gameState.awayScore,
                  home: gameState.homeScore
                },
                quarter: gameState.quarter,
                quarterState: gameState.quarter <= 4 ? `Q${gameState.quarter}` : `OT${gameState.quarter - 4}`,
                timeRemaining: gameState.timeRemaining,
                possession: gameState.possession
              }
            };
            
            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
            
            if (sent) {
              console.log(`📱 ✅ Sent ${alert.type} alert to ${user.username || user.id}`);
            } else {
              console.log(`📱 ❌ Failed to send ${alert.type} alert to ${user.username || user.id}`);
            }
          } catch (error) {
            console.error(`📱 ❌ Telegram delivery error for user ${user.username || user.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('📱 ❌ Telegram delivery system error:', error);
    }
  }

  // These legacy methods are now replaced by the modular alert cylinder system
  // Keeping them for backward compatibility but they should not be called

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;

    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      console.warn(`WNBA: Failed to parse time string "${timeString}":`, error);
      return 0;
    }
  }

  // Optimized time checking for basketball game situations
  private isWithinTimeWindow(timeRemaining: string, maxSeconds: number): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= maxSeconds && totalSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Memory optimization - periodically clean up performance metrics
  public performPeriodicCleanup(): void {
    try {
      // Clean up old performance metrics
      this.cleanupPerformanceMetrics();

      // Log performance stats for monitoring
      const metrics = this.getPerformanceMetrics();
      if (metrics.totalRequests > 0) {
        console.log(`🏀 WNBA Engine Performance: ${metrics.totalRequests} requests, ${metrics.averageAlertGenerationTime}ms avg, ${metrics.loadedModules} modules, ${metrics.cacheHitRate}% cache hit rate`);

        // Warn on performance degradation
        if (metrics.averageAlertGenerationTime > 150) {
          console.warn(`⚠️ WNBA Engine performance degraded: ${metrics.averageAlertGenerationTime}ms average (target: <150ms)`);
        }
      }
    } catch (error) {
      console.error('WNBA Engine cleanup error:', error);
    }
  }

  // Basketball-specific optimizations for shot clock and possession tracking
  private optimizedBasketballTimeCalculation(timeRemaining: string, quarter: number): {
    isClutchTime: boolean,
    isCrunchTime: boolean,
    isShotClockPressure: boolean,
    gamePhase: 'early' | 'middle' | 'late' | 'crunch' | 'overtime'
  } {
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    const isOT = quarter >= 5;

    // Optimized basketball timing calculations
    return {
      isClutchTime: quarter >= 4 && timeSeconds <= 300, // Final 5 minutes of regulation
      isCrunchTime: (quarter >= 4 && timeSeconds <= 120) || (isOT && timeSeconds <= 300), // Final 2 minutes
      isShotClockPressure: timeSeconds % 24 <= 5, // Shot clock pressure (24 seconds in WNBA)
      gamePhase: isOT ? 'overtime' :
                quarter >= 4 && timeSeconds <= 120 ? 'crunch' :
                quarter >= 4 ? 'late' :
                quarter >= 2 ? 'middle' : 'early'
    };
  }

  // Initialize alert modules based on user's enabled preferences (optimized)
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'WNBA' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'WNBA');
      console.log(`📋 WNBA User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ WNBA Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid WNBA alerts that have corresponding module files
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER',
        // New WNBA predictive alert types
        'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL',
        'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ];

      const wnbaEnabledTypes = enabledTypes.filter(alertType =>
        validWNBAAlerts.includes(alertType)
      );

      // Check global settings for these WNBA alerts (optimized batch check)
      const globallyEnabledTypes = [];
      for (const alertType of wnbaEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 WNBA Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing WNBA engine for user ${userId} with ${globallyEnabledTypes.length} WNBA alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the WNBA alert modules using optimized parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize WNBA engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type (optimized with performance monitoring)
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();

    try {
      const moduleMap: Record<string, string> = {
        'WNBA_GAME_START': './alert-cylinders/wnba/game-start-module.ts',
        'WNBA_TWO_MINUTE_WARNING': './alert-cylinders/wnba/two-minute-warning-module.ts',
        'FINAL_MINUTES': './alert-cylinders/wnba/final-minutes-module.ts',
        'HIGH_SCORING_QUARTER': './alert-cylinders/wnba/high-scoring-quarter-module.ts',
        'LOW_SCORING_QUARTER': './alert-cylinders/wnba/low-scoring-quarter-module.ts',
        'FOURTH_QUARTER': './alert-cylinders/wnba/fourth-quarter-module.ts',
        // New WNBA predictive alert modules
        'WNBA_CLUTCH_TIME_OPPORTUNITY': './alert-cylinders/wnba/clutch-time-opportunity-module.ts',
        'WNBA_COMEBACK_POTENTIAL': './alert-cylinders/wnba/comeback-potential-module.ts',
        'WNBA_CRUNCH_TIME_DEFENSE': './alert-cylinders/wnba/crunch-time-defense-module.ts',
        'WNBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/wnba/wnba-championship-implications-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No WNBA module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);

      if (loadTime > 50) {
        console.log(`⚠️ WNBA Slow module load: ${alertType} took ${loadTime}ms`);
      }

      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load WNBA alert module ${alertType} after ${loadTime}ms:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types (memory-optimized)
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);

    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 WNBA alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }

    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared WNBA alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded WNBA alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} WNBA alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  // Get performance metrics for monitoring and optimization
  getPerformanceMetrics() {
    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b) / this.performanceMetrics.alertGenerationTime.length
      : 0;
    const avgModuleTime = this.performanceMetrics.moduleLoadTime.length > 0
      ? this.performanceMetrics.moduleLoadTime.reduce((a, b) => a + b) / this.performanceMetrics.moduleLoadTime.length
      : 0;
    const avgEnhanceTime = this.performanceMetrics.enhanceDataTime.length > 0
      ? this.performanceMetrics.enhanceDataTime.reduce((a, b) => a + b) / this.performanceMetrics.enhanceDataTime.length
      : 0;
    const avgProbabilityTime = this.performanceMetrics.probabilityCalculationTime.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;
    const avgAiEnhancementTime = this.performanceMetrics.aiEnhancementTime.length > 0
      ? this.performanceMetrics.aiEnhancementTime.reduce((a, b) => a + b) / this.performanceMetrics.aiEnhancementTime.length
      : 0;

    return {
      sport: 'WNBA',
      totalRequests: this.performanceMetrics.totalRequests,
      totalAlerts: this.performanceMetrics.totalAlerts,
      enhancedAlerts: this.performanceMetrics.enhancedAlerts,
      averageAlertGenerationTime: Math.round(avgAlertTime * 100) / 100,
      averageModuleLoadTime: Math.round(avgModuleTime * 100) / 100,
      averageEnhanceDataTime: Math.round(avgEnhanceTime * 100) / 100,
      averageProbabilityCalculationTime: Math.round(avgProbabilityTime * 100) / 100,
      averageAIEnhancementTime: Math.round(avgAiEnhancementTime * 100) / 100,
      cacheHitRate: this.performanceMetrics.totalRequests > 0
        ? Math.round((this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 10000) / 100
        : 0,
      loadedModules: this.alertModules.size,
      activeAlertTypes: Array.from(this.alertModules.keys())
    };
  }

  // Clean up old performance metrics to prevent memory growth
  cleanupPerformanceMetrics(): void {
    const maxSamples = 100; // Keep last 100 samples

    if (this.performanceMetrics.alertGenerationTime.length > maxSamples) {
      this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.moduleLoadTime.length > maxSamples) {
      this.performanceMetrics.moduleLoadTime = this.performanceMetrics.moduleLoadTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.enhanceDataTime.length > maxSamples) {
      this.performanceMetrics.enhanceDataTime = this.performanceMetrics.enhanceDataTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.probabilityCalculationTime.length > maxSamples) {
      this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.aiEnhancementTime.length > maxSamples) {
      this.performanceMetrics.aiEnhancementTime = this.performanceMetrics.aiEnhancementTime.slice(-maxSamples);
    }
  }

  // Override to return only valid WNBA alert types
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'WNBA_GAME_START',
      'WNBA_TWO_MINUTE_WARNING',
      'FINAL_MINUTES',
      'HIGH_SCORING_QUARTER',
      'LOW_SCORING_QUARTER',
      'FOURTH_QUARTER',
      // New WNBA predictive alert types
      'WNBA_CLUTCH_TIME_OPPORTUNITY',
      'WNBA_COMEBACK_POTENTIAL',
      'WNBA_CRUNCH_TIME_DEFENSE',
      'WNBA_CHAMPIONSHIP_IMPLICATIONS'
    ];
  }
}