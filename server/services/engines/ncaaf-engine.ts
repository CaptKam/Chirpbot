import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { asyncAIProcessor } from '../async-ai-processor';
import { CrossSportContext } from '../cross-sport-ai-enhancement';

export class NCAAFEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
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
    redZoneDetections: 0,
    fourthDownSituations: 0,
    comebackOpportunities: 0
  };

  constructor() {
    super('NCAAF');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // CRITICAL FIX: Only check settings for NCAAF alert types with actual cylinder modules
      const validNCAAFAlerts = [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_RED_ZONE',
        'NCAAF_FOURTH_DOWN_DECISION', 'NCAAF_UPSET_OPPORTUNITY', 
        'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_COMEBACK_POTENTIAL'
      ];

      if (!validNCAAFAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NCAAF alert type (no cylinder module exists) - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NCAAF Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability

      // Enhanced NCAAF-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore } = gameState;

      // Quarter-specific adjustments (optimized calculation)
      if (quarter === 1) probability += 15; // Game start excitement
      else if (quarter === 2) probability += 10; // End of first half drama
      else if (quarter === 3) probability += 12; // Second half start
      else if (quarter === 4) probability += 20; // Fourth quarter drama

      // Time factors (optimized time parsing)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 120 && (quarter === 2 || quarter === 4)) {
          probability += 25; // Two-minute warning situations
        } else if (timeSeconds <= 300) {
          probability += 15; // Final 5 minutes
        }
      }

      // Down and distance (enhanced with field position)
      if (down && yardsToGo) {
        if (down === 1) probability += 12;
        else if (down === 2) probability += 8;
        else if (down === 3) probability += 5;
        else if (down === 4) probability += 30; // Fourth down is crucial in college

        // Short yardage situations
        if (yardsToGo <= 3) probability += 10;
      }

      // Field position (red zone and scoring territory)
      if (fieldPosition !== undefined) {
        if (fieldPosition <= 20) {
          probability += 25; // Red zone
          if (down === 4) probability += 15; // Fourth down in red zone
        } else if (fieldPosition <= 40) {
          probability += 12; // Scoring territory
        }
      }

      // Score differential (quick calculation)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) probability += 25; // Very close game
        else if (scoreDiff <= 7) probability += 18; // Close game (touchdowns matter more in college)
        else if (scoreDiff <= 14) probability += 10; // Two-score game
        else if (scoreDiff <= 21) probability += 5; // Three-score game
      }

      // Game start situations (kickoff detection)
      if (quarter === 1 && this.isKickoffTime(timeRemaining)) {
        probability += 25;
      }

      const result = Math.min(Math.max(probability, 10), 95);

      const calcTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calcTime);

      if (calcTime > 5) {
        console.log(`⚠️ NCAAF Slow probability calculation: ${calcTime}ms`);
      }

      return result;
    } catch (error) {
      const calcTime = Date.now() - startTime;
      console.error(`❌ NCAAF Probability calculation failed after ${calcTime}ms:`, error);
      return 50; // Fallback to base probability
    }
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Enhance game state with NCAAF-specific live data if needed
      const enhanceStartTime = Date.now();
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);
      const enhanceTime = Date.now() - enhanceStartTime;
      this.performanceMetrics.enhanceDataTime.push(enhanceTime);

      // Use the parent class method which properly calls all loaded modules
      const alertStartTime = Date.now();
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      const alertTime = Date.now() - alertStartTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);

      // Process alerts with cross-sport AI enhancement for high-priority NCAAF situations
      const processedAlerts = await this.processEnhancedNCAAFAlerts(rawAlerts, enhancedGameState);

      this.performanceMetrics.totalAlerts += processedAlerts.length;

      const totalTime = Date.now() - startTime;
      if (totalTime > 150) {
        console.log(`⚠️ NCAAF Slow alert generation: ${totalTime}ms for game ${gameState.gameId} (enhance: ${enhanceTime}ms, alerts: ${alertTime}ms)`);
      }

      return processedAlerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ NCAAF Alert generation failed after ${totalTime}ms:`, error);
      return [];
    }
  }

  // Reuse single API service instance to avoid overhead
  private static ncaafApiService: any = null;

  // Enhanced game state processing with live data enrichment
  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();

    try {
      let enhancedGameState = { ...gameState };

      // Get live data from NCAAF API if game is live
      if (gameState.isLive && gameState.gameId) {
        // Reuse singleton API service instance to avoid creation overhead
        if (!NCAAFEngine.ncaafApiService) {
          const { NCAAFApiService } = await import('../ncaaf-api');
          NCAAFEngine.ncaafApiService = new NCAAFApiService();
        }

        const enhancedData = await NCAAFEngine.ncaafApiService.getEnhancedGameData?.(gameState.gameId);

        // CRITICAL FIX: Only use enhanced data if it's meaningful, not stub data
        if (enhancedData && !enhancedData.error && this.isEnhancedDataMeaningful(enhancedData, gameState)) {
          // Only merge fields that have meaningful enhanced values
          enhancedGameState = {
            ...enhancedGameState,
            // Only use enhanced quarter if it's different from default AND gameState has no quarter or they differ meaningfully
            quarter: this.shouldUseEnhancedValue(enhancedData.quarter, gameState.quarter, 1) ? enhancedData.quarter : gameState.quarter,
            // Only use enhanced time if it's not the default stub value
            timeRemaining: this.shouldUseEnhancedValue(enhancedData.timeRemaining, gameState.timeRemaining, '15:00') ? enhancedData.timeRemaining : gameState.timeRemaining,
            // Only enhance specific fields if they're provided
            down: enhancedData.down !== undefined ? enhancedData.down : gameState.down,
            yardsToGo: enhancedData.yardsToGo !== undefined ? enhancedData.yardsToGo : gameState.yardsToGo,
            fieldPosition: enhancedData.fieldPosition !== undefined ? enhancedData.fieldPosition : gameState.fieldPosition,
            possession: enhancedData.possession !== undefined ? enhancedData.possession : gameState.possession,
            // Only use enhanced scores if they're meaningful (not 0 when game has real scores)
            homeScore: this.shouldUseEnhancedScore(enhancedData.homeScore, gameState.homeScore),
            awayScore: this.shouldUseEnhancedScore(enhancedData.awayScore, gameState.awayScore),
            homeRank: enhancedData.homeRank !== undefined ? enhancedData.homeRank : (gameState.homeRank || 0),
            awayRank: enhancedData.awayRank !== undefined ? enhancedData.awayRank : (gameState.awayRank || 0)
          };

          this.performanceMetrics.cacheHits++;
          console.log(`🔍 NCAAF Enhanced game ${gameState.gameId}: Used meaningful enhanced data`);
        } else {
          this.performanceMetrics.cacheMisses++;
          console.log(`🚫 NCAAF Game ${gameState.gameId}: Enhanced data was stub/meaningless - preserving original data`);
        }
      }

      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);

      // Auto-cleanup metrics to prevent memory growth
      if (this.performanceMetrics.gameStateEnhancementTime.length % 50 === 0) {
        this.cleanupPerformanceMetrics();
      }

      if (enhanceTime > 50) {
        console.log(`⚠️ NCAAF Slow game state enhancement: ${enhanceTime}ms for game ${gameState.gameId}`);
      }

      return enhancedGameState;
    } catch (error) {
      const enhanceTime = Date.now() - startTime;
      console.error(`❌ NCAAF Game state enhancement failed after ${enhanceTime}ms:`, error);
      return gameState;
    }
  }

  // Helper to determine if enhanced data is meaningful vs stub data
  private isEnhancedDataMeaningful(enhancedData: any, gameState: GameState): boolean {
    // If enhanced data has default stub values that would overwrite real data, reject it
    if (enhancedData.quarter === 1 && enhancedData.timeRemaining === '15:00' && 
        enhancedData.homeScore === 0 && enhancedData.awayScore === 0 &&
        (gameState.quarter !== 1 || gameState.timeRemaining !== '15:00' || 
         gameState.homeScore !== 0 || gameState.awayScore !== 0)) {
      return false; // This is clearly stub data that would corrupt real game data
    }
    return true;
  }

  // Helper to determine if enhanced value should be used over game state value
  private shouldUseEnhancedValue(enhancedValue: any, gameStateValue: any, stubDefault: any): boolean {
    // Don't use enhanced value if it's the stub default and gameState has a different value
    if (enhancedValue === stubDefault && gameStateValue !== undefined && gameStateValue !== stubDefault) {
      return false;
    }
    // Use enhanced value if it's meaningful and different
    return enhancedValue !== undefined && enhancedValue !== stubDefault;
  }

  // Helper to determine if enhanced scores should be used
  private shouldUseEnhancedScore(enhancedScore: number, gameStateScore: number): number {
    // If enhanced score is 0 but gameState has a real score, keep gameState score
    if (enhancedScore === 0 && gameStateScore > 0) {
      return gameStateScore;
    }
    // Otherwise use enhanced score if it's meaningful
    return enhancedScore !== undefined ? enhancedScore : gameStateScore;
  }

  // Optimized helper methods for NCAAF-specific calculations
  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= 120 && totalSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  private isKickoffTime(timeRemaining: string): boolean {
    // Kickoff typically happens at start of quarter (15:00 or close to it)
    if (!timeRemaining) return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds >= 880 && totalSeconds <= 900; // Between 14:40 and 15:00
    } catch (error) {
      return false;
    }
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Get available alert types from cylinders (only implemented modules)
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'NCAAF_GAME_START',
      'NCAAF_TWO_MINUTE_WARNING',
      'NCAAF_RED_ZONE',
      'NCAAF_FOURTH_DOWN_DECISION',
      'NCAAF_UPSET_OPPORTUNITY',
      'NCAAF_RED_ZONE_EFFICIENCY',
      'NCAAF_COMEBACK_POTENTIAL'
    ];
  }

  // Get performance metrics for monitoring and debugging
  getPerformanceMetrics() {
    const avgCalculationTime = this.performanceMetrics.probabilityCalculationTime.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;

    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
      : 0;

    const avgEnhanceTime = this.performanceMetrics.enhanceDataTime.length > 0
      ? this.performanceMetrics.enhanceDataTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.enhanceDataTime.length
      : 0;

    const avgAITime = this.performanceMetrics.aiEnhancementTime.length > 0
      ? this.performanceMetrics.aiEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.aiEnhancementTime.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    return {
      sport: 'NCAAF',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime + avgAITime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        avgAIEnhancementTime: avgAITime,
        cacheHitRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        enhancedAlerts: this.performanceMetrics.enhancedAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        aiEnhancementRate: this.performanceMetrics.totalAlerts > 0 
          ? (this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100 
          : 0,
        redZoneDetections: this.performanceMetrics.redZoneDetections,
        fourthDownSituations: this.performanceMetrics.fourthDownSituations,
        comebackOpportunities: this.performanceMetrics.comebackOpportunities,
        collegeFootballAlerts: this.performanceMetrics.totalAlerts
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20),
        aiTimes: this.performanceMetrics.aiEnhancementTime.slice(-20)
      }
    };
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'NCAAF' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'NCAAF');

      // CRITICAL FIX: Only process if user has explicit NCAAF preferences
      if (userPrefs.length === 0) {
        console.log(`🚫 User ${userId} has no explicit NCAAF preferences - skipping NCAAF initialization`);
        return;
      }

      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      if (enabledTypes.length === 0) {
        console.log(`🚫 User ${userId} has no enabled NCAAF alerts - skipping NCAAF initialization`);
        return;
      }

      // CRITICAL FIX: Only include NCAAF alerts that have actual cylinder modules implemented
      const validNCAAFAlerts = [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_RED_ZONE',
        'NCAAF_FOURTH_DOWN_DECISION', 'NCAAF_UPSET_OPPORTUNITY', 
        'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_COMEBACK_POTENTIAL'
      ];

      const ncaafEnabledTypes = enabledTypes.filter(alertType =>
        validNCAAFAlerts.includes(alertType)
      );

      // Check global settings for these NCAAF alerts
      const globallyEnabledTypes = [];
      for (const alertType of ncaafEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing NCAAF engine for user ${userId} with ${globallyEnabledTypes.length} NCAAF alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the NCAAF alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize NCAAF engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type (with performance monitoring)
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();

    try {
      const moduleMap: Record<string, string> = {
        'NCAAF_GAME_START': './alert-cylinders/ncaaf/game-start-module.ts',
        'NCAAF_TWO_MINUTE_WARNING': './alert-cylinders/ncaaf/two-minute-warning-module.ts',
        'NCAAF_RED_ZONE': './alert-cylinders/ncaaf/red-zone-module.ts',
        'NCAAF_FOURTH_DOWN_DECISION': './alert-cylinders/ncaaf/fourth-down-decision-module.ts',
        'NCAAF_UPSET_OPPORTUNITY': './alert-cylinders/ncaaf/upset-opportunity-module.ts',
        'NCAAF_RED_ZONE_EFFICIENCY': './alert-cylinders/ncaaf/red-zone-efficiency-module.ts',
        'NCAAF_COMEBACK_POTENTIAL': './alert-cylinders/ncaaf/comeback-potential-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NCAAF module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);

      if (loadTime > 50) {
        console.log(`⚠️ NCAAF Slow module load: ${alertType} took ${loadTime}ms`);
      }

      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load NCAAF alert module ${alertType} after ${loadTime}ms:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types (optimized)
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    const startTime = Date.now();

    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);

    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 NCAAF alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }

    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared NCAAF alert modules due to type changes`);
    }

    // Load modules in parallel for better performance
    const moduleLoadPromises = enabledAlertTypes.map(async (alertType) => {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded NCAAF alert cylinder: ${alertType}`);
        return { alertType, success: true };
      } else {
        return { alertType, success: false };
      }
    });

    const results = await Promise.all(moduleLoadPromises);
    const successCount = results.filter(r => r.success).length;
    const initTime = Date.now() - startTime;

    if (initTime > 100) {
      console.log(`⚠️ NCAAF Slow module initialization: ${initTime}ms for ${enabledAlertTypes.length} modules`);
    }

    console.log(`🔧 Initialized ${successCount}/${enabledAlertTypes.length} NCAAF alert cylinders in ${initTime}ms: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  // Optimized batch processing for multiple games
  async processMultipleGames(gameStates: GameState[]): Promise<AlertResult[]> {
    const startTime = Date.now();
    const allAlerts: AlertResult[] = [];

    try {
      // Process games in parallel for maximum performance
      const gamePromises = gameStates.map(async (gameState) => {
        try {
          return await this.generateLiveAlerts(gameState);
        } catch (error) {
          console.error(`❌ NCAAF Error processing game ${gameState.gameId}:`, error);
          return [];
        }
      });

      const gameResults = await Promise.all(gamePromises);

      // Flatten results
      for (const alerts of gameResults) {
        allAlerts.push(...alerts);
      }

      const totalTime = Date.now() - startTime;

      if (totalTime > 200) {
        console.log(`⚠️ NCAAF Slow batch processing: ${totalTime}ms for ${gameStates.length} games, ${allAlerts.length} alerts`);
      } else {
        console.log(`⚡ NCAAF Fast batch processing: ${totalTime}ms for ${gameStates.length} games, ${allAlerts.length} alerts`);
      }

      return allAlerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ NCAAF Batch processing failed after ${totalTime}ms:`, error);
      return allAlerts;
    }
  }

  // Process NCAAF alerts with cross-sport AI enhancement for high-priority college situations
  private async processEnhancedNCAAFAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Enhanced AI threshold - process medium-priority alerts and above (>= 60 probability)
        const probability = await this.calculateProbability(gameState);

        if (probability >= 60 && this.crossSportAI.configured) {
          console.log(`🧠 NCAAF AI Enhancement: Processing ${alert.type} alert (${probability}%)`);

          // Build comprehensive cross-sport context for NCAAF with college-specific elements
          const aiContext: CrossSportContext = {
            sport: 'NCAAF',
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
            down: gameState.down,
            yardsToGo: gameState.yardsToGo,
            fieldPosition: gameState.fieldPosition,
            possession: gameState.possession,
            redZone: gameState.fieldPosition ? gameState.fieldPosition <= 20 : false,
            goalLine: gameState.fieldPosition ? gameState.fieldPosition <= 5 : false,
            // College football specific context
            playoffImplications: this.hasPlayoffImplications(gameState),
            championshipContext: this.getChampionshipContext(gameState),
            originalMessage: alert.message,
            originalContext: alert.context
          };

          const aiResponse = await this.crossSportAI.enhanceAlert(aiContext);

          // Update alert with comprehensive AI enhancement
          enhancedAlerts.push({
            ...alert,
            message: aiResponse.enhancedMessage,
            context: {
              ...alert.context,
              aiEnhanced: true,
              aiInsights: aiResponse.contextualInsights,
              aiRecommendation: aiResponse.actionableRecommendation,
              urgencyLevel: aiResponse.urgencyLevel,
              bettingContext: aiResponse.bettingContext,
              gameProjection: aiResponse.gameProjection,
              confidence: aiResponse.confidence,
              sportSpecificData: aiResponse.sportSpecificData,
              processingTime: aiResponse.aiProcessingTime,
              // Additional college football context
              collegeFactors: this.getCollegeSpecificFactors(gameState),
              recruitingImplications: this.getRecruitingImplications(gameState)
            }
          });

          this.performanceMetrics.enhancedAlerts++;
        } else {
          // Keep original alert for lower-priority situations
          enhancedAlerts.push(alert);
        }
      } catch (error) {
        console.error(`❌ NCAAF AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    this.performanceMetrics.aiEnhancementTime.push(aiTime);

    if (aiTime > 50) {
      console.log(`⚠️ NCAAF AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Check if game has playoff implications
  private hasPlayoffImplications(gameState: GameState): boolean {
    // Simple heuristic - games with close scores in later quarters
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    return (gameState.quarter || 0) >= 3 && scoreDiff <= 14;
  }

  // Get championship context for college football
  private getChampionshipContext(gameState: GameState): string {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const quarter = gameState.quarter || 1;

    if (quarter >= 4 && scoreDiff <= 7) {
      return 'Conference championship implications - close fourth quarter battle';
    } else if (quarter >= 3 && scoreDiff <= 3) {
      return 'Playoff positioning at stake - tight late-game situation';
    }

    return '';
  }

  // Get college-specific factors
  private getCollegeSpecificFactors(gameState: GameState): string[] {
    const factors: string[] = [];
    const quarter = gameState.quarter || 1;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));

    if (quarter >= 4) factors.push('Fourth quarter execution crucial');
    if (scoreDiff <= 7) factors.push('One-score game dynamics');
    if (gameState.redZone) factors.push('Red zone efficiency critical');
    if (gameState.down === 4) factors.push('Fourth down decision point');

    return factors;
  }

  // Get recruiting implications
  private getRecruitingImplications(gameState: GameState): string {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const quarter = gameState.quarter || 1;

    if (quarter >= 4 && scoreDiff <= 3) {
      return 'High-stakes finish showcases program under pressure';
    } else if (gameState.redZone && quarter >= 3) {
      return 'Red zone execution demonstrates offensive capabilities';
    }

    return 'Game performance impacts program perception';
  }

  // Memory cleanup and optimization
  cleanupPerformanceMetrics(): void {
    // Keep only the last 100 measurements to prevent memory buildup
    const maxEntries = 100;

    if (this.performanceMetrics.alertGenerationTime.length > maxEntries) {
      this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-maxEntries);
    }
    if (this.performanceMetrics.moduleLoadTime.length > maxEntries) {
      this.performanceMetrics.moduleLoadTime = this.performanceMetrics.moduleLoadTime.slice(-maxEntries);
    }
    if (this.performanceMetrics.enhanceDataTime.length > maxEntries) {
      this.performanceMetrics.enhanceDataTime = this.performanceMetrics.enhanceDataTime.slice(-maxEntries);
    }
    if (this.performanceMetrics.probabilityCalculationTime.length > maxEntries) {
      this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-maxEntries);
    }
    if (this.performanceMetrics.gameStateEnhancementTime.length > maxEntries) {
      this.performanceMetrics.gameStateEnhancementTime = this.performanceMetrics.gameStateEnhancementTime.slice(-maxEntries);
    }
    if (this.performanceMetrics.aiEnhancementTime.length > maxEntries) {
      this.performanceMetrics.aiEnhancementTime = this.performanceMetrics.aiEnhancementTime.slice(-maxEntries);
    }
  }
}