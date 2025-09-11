import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { asyncAIProcessor } from '../async-ai-processor';
import { CrossSportContext } from '../cross-sport-ai-enhancement';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';

export class MLBEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
  private lineMovementCache: Map<string, any> = new Map(); // Track line movements
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
    basesLoadedSituations: 0,
    seventhInningDetections: 0,
    runnerScoringOpportunities: 0
  };

  constructor() {
    super('MLB');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual MLB alert types that have corresponding modules
      const validMLBAlerts = [
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH',
        'MLB_RUNNER_ON_THIRD_NO_OUTS',
        'MLB_FIRST_AND_THIRD_NO_OUTS',
        'MLB_SECOND_AND_THIRD_NO_OUTS',
        'MLB_BASES_LOADED_NO_OUTS',
        'MLB_RUNNER_ON_THIRD_ONE_OUT',
        'MLB_SECOND_AND_THIRD_ONE_OUT',
        'MLB_BASES_LOADED_ONE_OUT',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE'
      ];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();
    
    try {
      if (!gameState.isLive) return 0;

      const { inning, outs, homeScore, awayScore } = gameState;

      let probability = 40; // Base probability

    // Simple inning adjustments
    if (inning >= 7) probability += 20; // Late innings are more exciting
    else if (inning >= 4) probability += 10; // Middle innings
    else probability += 5; // Early innings

    // Outs situation - simple rules
    if (outs === 0) probability += 20; // No outs - high potential
    else if (outs === 1) probability += 10; // One out - still good
    else probability += 5; // Two outs - pressure but still possible

    // Score differential
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 1) probability += 25; // Very close game
    else if (scoreDiff <= 3) probability += 15; // Close game
    else if (scoreDiff <= 6) probability += 5; // Moderately competitive
    else probability -= 10; // Blowout

    // Simple base runner boost
    let runnerBonus = 0;
    if (gameState.hasThird) runnerBonus += 15; // Runner on third
    if (gameState.hasSecond) runnerBonus += 10; // Runner on second
    if (gameState.hasFirst) runnerBonus += 5; // Runner on first
    
    probability += runnerBonus;

    // Keep probability within reasonable bounds
    return Math.min(Math.max(probability, 15), 90);
    } finally {
      // Track performance metrics
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      this.performanceMetrics.totalRequests++;
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.probabilityCalculationTime.length > 100) {
        this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-100);
      }
    }
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    
    try {
      // Enhance game state with MLB-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      
      // Enhance alerts with time-sensitive intelligence via AlertComposer
      const composedAlerts = await this.composeTimeBasedAlerts(rawAlerts, enhancedGameState);
      
      // Process alerts with cross-sport AI enhancement for high-priority situations
      const alerts = await this.processEnhancedMLBAlerts(composedAlerts, enhancedGameState);
      
      // Track MLB-specific metrics
      if (enhancedGameState.hasFirst && enhancedGameState.hasSecond && enhancedGameState.hasThird) {
        this.performanceMetrics.basesLoadedSituations++;
      }
      if (enhancedGameState.inning === 7) {
        this.performanceMetrics.seventhInningDetections++;
      }
      if (enhancedGameState.hasThird && enhancedGameState.outs <= 1) {
        this.performanceMetrics.runnerScoringOpportunities++;
      }
      
      this.performanceMetrics.totalAlerts += alerts.length;
      return alerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 MLB Enhancement: Game ${gameState.gameId} - status=${gameState.status}, isLive=${gameState.isLive}`);
      
      // Get live data from MLB API for any non-final game (fixes catch-22 gating loop)
      if (gameState.gameId && gameState.status !== 'final') {
        console.log(`✅ MLB Enhancement: Fetching enhanced data for non-final game ${gameState.gameId}`);
        const { MLBApiService } = await import('../mlb-api');
        const mlbApi = new MLBApiService();
        const enhancedData = await mlbApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          this.performanceMetrics.cacheHits++;
          // Fetch weather data if available
          let weatherContext = gameState.weatherContext;
          try {
            const { weatherAlertIntegration } = await import('../weather-alert-integration');
            const weatherData = await weatherAlertIntegration.getCurrentConditions(
              gameState.homeTeam,
              gameState.awayTeam
            );
            if (weatherData && !weatherData.error) {
              weatherContext = {
                windSpeed: weatherData.windSpeed,
                windDirection: weatherData.windDirection,
                temperature: weatherData.temperature,
                humidity: weatherData.humidity
              };
            }
          } catch (error) {
            // Weather fetch failed, continue without it
          }

          const enhancedGameState = {
            ...gameState,
            hasFirst: enhancedData.runners?.first || false,
            hasSecond: enhancedData.runners?.second || false,
            hasThird: enhancedData.runners?.third || false,
            balls: enhancedData.balls || 0,
            strikes: enhancedData.strikes || 0,
            outs: enhancedData.outs || 0,
            inning: enhancedData.inning || gameState.inning || 1,
            isTopInning: enhancedData.isTopInning,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            currentBatter: enhancedData.currentBatter || gameState.currentBatter,
            currentPitcher: enhancedData.currentPitcher || gameState.currentPitcher,
            onDeckBatter: enhancedData.onDeckBatter || gameState.onDeckBatter,
            weatherContext,
            // Force isLive=true for games with rich live data indicators
            isLive: true
          };
          console.log(`🚀 MLB Enhancement: Game ${gameState.gameId} enhanced - isLive=${enhancedGameState.isLive}, runners=[${enhancedGameState.hasFirst ? '1B' : ''}${enhancedGameState.hasSecond ? '2B' : ''}${enhancedGameState.hasThird ? '3B' : ''}], outs=${enhancedGameState.outs}, inning=${enhancedGameState.inning}`);
          return enhancedGameState;
        } else {
          this.performanceMetrics.cacheMisses++;
        }
      }
    } catch (error) {
      console.error('Error enhancing game state with live data:', error);
      this.performanceMetrics.cacheMisses++;
    } finally {
      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.gameStateEnhancementTime.length > 100) {
        this.performanceMetrics.gameStateEnhancementTime = this.performanceMetrics.gameStateEnhancementTime.slice(-100);
      }
    }

    return gameState;
  }

  // Process alerts with cross-sport AI enhancement for high-priority MLB situations
  private async processEnhancedMLBAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Only enhance high-priority alerts (>= 85 probability)
        const probability = await this.calculateProbability(gameState);
        
        if (probability >= 85) {
          console.log(`🧠 MLB AI Enhancement: Processing ${alert.type} alert (${probability}%)`);
          
          // Build cross-sport context for MLB
          const aiContext: CrossSportContext = {
            sport: 'MLB',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            inning: gameState.inning,
            outs: gameState.outs,
            balls: gameState.balls,
            strikes: gameState.strikes,
            baseRunners: {
              first: gameState.hasFirst || false,
              second: gameState.hasSecond || false,
              third: gameState.hasThird || false
            },
            originalMessage: alert.message,
            originalContext: alert.context
          };

          // Queue for async AI enhancement (non-blocking) and return base alert immediately
          await asyncAIProcessor.queueAlertForEnhancement(alert, aiContext, 'system');
          console.log(`🚀 MLB Async AI: Queued ${alert.type} for background enhancement`);
        }
        
        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ MLB AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ MLB AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'MLB' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'MLB');
      console.log(`📋 MLB User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ MLB Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid MLB alerts that have corresponding module files
      const validMLBAlerts = [
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH',
        'MLB_RUNNER_ON_THIRD_NO_OUTS',
        'MLB_FIRST_AND_THIRD_NO_OUTS',
        'MLB_SECOND_AND_THIRD_NO_OUTS',
        'MLB_BASES_LOADED_NO_OUTS',
        'MLB_RUNNER_ON_THIRD_ONE_OUT',
        'MLB_SECOND_AND_THIRD_ONE_OUT',
        'MLB_BASES_LOADED_ONE_OUT',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE'
      ];

      const mlbEnabledTypes = enabledTypes.filter(alertType =>
        validMLBAlerts.includes(alertType)
      );

      // Check global settings for these MLB alerts
      const globallyEnabledTypes = [];
      for (const alertType of mlbEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 MLB Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing MLB engine for user ${userId} with ${globallyEnabledTypes.length} MLB alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the MLB alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'MLB_GAME_START': './alert-cylinders/mlb/game-start-module.ts',
        'MLB_SEVENTH_INNING_STRETCH': './alert-cylinders/mlb/seventh-inning-stretch-module.ts',
        'MLB_BASES_LOADED_ONE_OUT': './alert-cylinders/mlb/bases-loaded-one-out-module.ts',
        'MLB_RUNNER_ON_THIRD_NO_OUTS': './alert-cylinders/mlb/runner-on-third-no-outs-module.ts',
        'MLB_FIRST_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/first-and-third-no-outs-module.ts',
        'MLB_SECOND_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/second-and-third-no-outs-module.ts',
        'MLB_BASES_LOADED_NO_OUTS': './alert-cylinders/mlb/bases-loaded-no-outs-module.ts',
        'MLB_RUNNER_ON_THIRD_ONE_OUT': './alert-cylinders/mlb/runner-on-third-one-out-module.ts',
        'MLB_SECOND_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/second-and-third-one-out-module.ts',
        'MLB_BATTER_DUE': './alert-cylinders/mlb/batter-due-module.ts',
        'MLB_STEAL_LIKELIHOOD': './alert-cylinders/mlb/steal-likelihood-module.ts',
        'MLB_ON_DECK_PREDICTION': './alert-cylinders/mlb/on-deck-prediction-module.ts',
        'MLB_WIND_CHANGE': './alert-cylinders/mlb/wind-change-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No MLB module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      return new module.default();
    } catch (error) {
      console.error(`❌ Failed to load MLB alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);
    
    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 MLB alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }
    
    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared MLB alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded MLB alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} MLB alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  /**
   * Compose time-based, actionable alerts using AlertComposer
   */
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const composedAlerts: AlertResult[] = [];
    
    for (const alert of alerts) {
      try {
        // Generate enhanced payload with time-sensitive intelligence
        const enhancedPayload = await alertComposer.composeEnhancedAlert(alert, gameState, {
          // Add any MLB-specific context
          recentLineMovement: this.getRecentLineMovement(gameState),
          sharpMoney: this.getSharpMoneyIndicator(gameState)
        });
        
        // Create enhanced alert with rich messaging
        const enhancedAlert: AlertResult = {
          ...alert,
          message: enhancedPayload.headline,
          context: {
            ...alert.context,
            enhanced: enhancedPayload,
            displayText: alertComposer.formatForDisplay(enhancedPayload),
            mobileText: alertComposer.formatForMobileNotification(enhancedPayload),
            timing: enhancedPayload.timing,
            action: enhancedPayload.action,
            insight: enhancedPayload.insight,
            riskReward: enhancedPayload.riskReward
          }
        };
        
        composedAlerts.push(enhancedAlert);
        console.log(`⚡ MLB Alert Composed: ${alert.type} - ${enhancedPayload.timing.urgencyLevel} priority`);
      } catch (error) {
        console.error(`Failed to compose MLB alert:`, error);
        composedAlerts.push(alert); // Fallback to original
      }
    }
    
    return composedAlerts;
  }
  
  /**
   * Get recent line movement for context
   */
  private getRecentLineMovement(gameState: GameState): any {
    // In production, this would connect to real-time odds feeds
    // For now, simulate based on game state
    const key = `${gameState.gameId}_line`;
    const previous = this.lineMovementCache.get(key);
    const current = {
      total: gameState.homeScore + gameState.awayScore,
      spread: gameState.homeScore - gameState.awayScore,
      timestamp: Date.now()
    };
    
    if (previous && (current.timestamp - previous.timestamp) < 60000) {
      const totalMove = current.total - previous.total;
      const spreadMove = current.spread - previous.spread;
      
      if (Math.abs(totalMove) >= 0.5 || Math.abs(spreadMove) >= 0.5) {
        this.lineMovementCache.set(key, current);
        return {
          totalMove,
          spreadMove,
          timeAgo: Math.floor((current.timestamp - previous.timestamp) / 1000)
        };
      }
    }
    
    this.lineMovementCache.set(key, current);
    return null;
  }
  
  /**
   * Get sharp money indicators
   */
  private getSharpMoneyIndicator(gameState: GameState): any {
    // In production, this would use real betting data
    // Simulate based on game flow
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inning = gameState.inning || 1;
    
    if (scoreDiff <= 1 && inning >= 7) {
      return { indicator: 'heavy', direction: 'over', confidence: 85 };
    }
    if (gameState.hasFirst && gameState.hasSecond && gameState.hasThird) {
      return { indicator: 'moderate', direction: 'over', confidence: 70 };
    }
    
    return null;
  }
  
  // Get performance metrics for V3 dashboard
  getPerformanceMetrics() {
    const avgCalculationTime = this.performanceMetrics.probabilityCalculationTime.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;

    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
      : 0;

    const avgEnhanceTime = this.performanceMetrics.gameStateEnhancementTime.length > 0
      ? this.performanceMetrics.gameStateEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.gameStateEnhancementTime.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    return {
      sport: 'MLB',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        cacheHitRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        basesLoadedSituations: this.performanceMetrics.basesLoadedSituations,
        seventhInningDetections: this.performanceMetrics.seventhInningDetections,
        runnerScoringOpportunities: this.performanceMetrics.runnerScoringOpportunities
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20)
      }
    };
  }
}