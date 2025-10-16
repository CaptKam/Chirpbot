import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';

export class NCAAFEngine extends BaseSportEngine {
  // Deduplication tracking - tracks sent alerts to prevent duplicates (standardized from MLB)

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
    comebackOpportunities: 0,
  };

  // Possession tracking system
  private possessionTracking: Map<string, {
    homeTeam: string;
    awayTeam: string;
    homePossessions: number;
    awayPossessions: number;
    currentPossession: 'home' | 'away' | null;
    lastPossessionChange: number;
    possessionHistory: Array<{
      team: 'home' | 'away';
      startTime: number;
      quarter?: number;
      fieldPosition?: number;
    }>;
  }> = new Map();

  // Track timeouts per team per game (NCAAF has 3 timeouts per half per team)
  private timeoutTracking = new Map<string, {
    homeTeam: string;
    awayTeam: string;
    homeTimeoutsRemaining: number;
    awayTimeoutsRemaining: number;
    homeTimeoutsUsed: number;
    awayTimeoutsUsed: number;
    timeoutHistory: Array<{
      team: 'home' | 'away';
      quarter: number;
      timeRemaining: string;
      timestamp: number;
    }>;
  }>();

  constructor() {
    super('NCAAF');
  }

  /**
   * Check if an alert has already been sent recently (standardized from MLB)
   */

  /**
   * Mark an alert as sent (standardized from MLB)
   */


  // initializeCrossSportAI method removed - unified AI processor used instead

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Get available alert types dynamically from filesystem (like MLB does)
      const availableTypes = await this.getAvailableAlertTypes();
      
      if (!availableTypes.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NCAAF alert type (no cylinder module exists) - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NCAAF Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  // OPTIMIZED: Streamlined probability calculation (reduced overhead)
  async calculateProbability(gameState: GameState): Promise<number> {
    if (!gameState.isLive) return 0;

    let probability = 50; // Base probability

    // OPTIMIZED: Fast probability calculation with minimal overhead
    const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore } = gameState;

    // Quarter-specific adjustments (lookup table approach)
    const quarterBonus = [0, 15, 10, 12, 20][quarter] || 0;
    probability += quarterBonus;

    // Time factors (optimized with fast parsing)
    if (timeRemaining) {
      const timeSeconds = this.parseTimeToSeconds(timeRemaining);
      if (timeSeconds <= 120 && (quarter === 2 || quarter === 4)) {
        probability += 25;
      } else if (timeSeconds <= 300) {
        probability += 15;
      }
    }

    // Down and distance (optimized conditionals)
    if (down && yardsToGo) {
      const downBonus = [0, 12, 8, 5, 30][down] || 0;
      probability += downBonus;
      
      if (yardsToGo <= 3) probability += 10;
      if (down === 4 && fieldPosition !== undefined && fieldPosition <= 20) probability += 15;
    }

    // Field position (optimized calculation)
    if (fieldPosition !== undefined) {
      if (fieldPosition <= 20) {
        probability += 25;
      } else if (fieldPosition <= 40) {
        probability += 12;
      }
    }

    // Score differential (optimized with pre-calculated abs)
    if (homeScore !== undefined && awayScore !== undefined) {
      const scoreDiff = Math.abs(homeScore - awayScore);
      if (scoreDiff <= 3) probability += 25;
      else if (scoreDiff <= 7) probability += 18;
      else if (scoreDiff <= 14) probability += 10;
      else if (scoreDiff <= 21) probability += 5;
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  // OPTIMIZED: Streamlined alert generation with reduced logging
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    // Early exit if game is not valid (optimized check)
    if (!gameState.gameId) {
      return [];
    }

    try {
      // Enhance game state with NCAAF-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);

      // Return raw alerts - GameStateManager will handle enhancement pipeline
      if (rawAlerts.length > 0) {
        console.log(`🔄 NCAAF: Generated ${rawAlerts.length} raw alerts - GameStateManager will handle enhancement`);
      }

      // OPTIMIZED: Lightweight metrics tracking
      const fieldPos = enhancedGameState.fieldPosition ?? 50;
      if (fieldPos <= 20) this.performanceMetrics.redZoneDetections++;
      if (enhancedGameState.down === 4) this.performanceMetrics.fourthDownSituations++;
      
      // Lightweight comeback opportunity tracking
      if (enhancedGameState.homeScore !== undefined && enhancedGameState.awayScore !== undefined) {
        const scoreDiff = Math.abs(enhancedGameState.homeScore - enhancedGameState.awayScore);
        if (scoreDiff <= 14 && (enhancedGameState.quarter ?? 1) >= 3) {
          this.performanceMetrics.comebackOpportunities++;
        }
      }

      this.performanceMetrics.totalAlerts += rawAlerts.length;
      this.performanceMetrics.totalRequests++;

      return rawAlerts;
    } catch (error) {
      return [];
    }
  }

  // Reuse single API service instance to avoid overhead
  private static ncaafApiService: any = null;

  // OPTIMIZED: Fast game state enhancement with reduced overhead
  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();
    
    try {
      // Fast check - if not live or no gameId, return immediately
      if (!gameState.isLive || !gameState.gameId) {
        return gameState;
      }
      
      // Reuse singleton API service instance to avoid creation overhead
      if (!NCAAFEngine.ncaafApiService) {
        const { NCAAFApiService } = await import('../ncaaf-api');
        NCAAFEngine.ncaafApiService = new NCAAFApiService();
      }

      const enhancedData = await NCAAFEngine.ncaafApiService.getEnhancedGameData?.(gameState.gameId);

      // Fast validation and enhancement
      if (enhancedData && !enhancedData.error && this.isEnhancedDataMeaningful(enhancedData, gameState)) {
        // OPTIMIZED: Direct object spread with faster property access
        const enhancedGameState = {
          ...gameState,
          quarter: this.shouldUseEnhancedValue(enhancedData.quarter, gameState.quarter, 1) ? enhancedData.quarter : gameState.quarter,
          timeRemaining: this.shouldUseEnhancedValue(enhancedData.timeRemaining, gameState.timeRemaining, '15:00') ? enhancedData.timeRemaining : gameState.timeRemaining,
          down: enhancedData.down ?? gameState.down,
          yardsToGo: enhancedData.yardsToGo ?? gameState.yardsToGo,
          fieldPosition: enhancedData.fieldPosition ?? gameState.fieldPosition,
          possession: enhancedData.possession ?? gameState.possession,
          homeScore: this.shouldUseEnhancedScore(enhancedData.homeScore, gameState.homeScore),
          awayScore: this.shouldUseEnhancedScore(enhancedData.awayScore, gameState.awayScore),
          homeRank: enhancedData.homeRank ?? (gameState.homeRank || 0),
          awayRank: enhancedData.awayRank ?? (gameState.awayRank || 0)
        };

        // Track possession changes for this game
        if (enhancedData.possessionSide) {
          this.trackPossessionChange(

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            gameState.gameId,

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            gameState.homeTeam as string,

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            gameState.awayTeam as string,

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            enhancedData.possessionSide,

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            enhancedData.quarter,

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
            enhancedData.fieldPosition

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
          );

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );
        }

        this.performanceMetrics.cacheHits++;
        
        const enhanceTime = Date.now() - startTime;
        this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);
        
        // Only log if critically slow (reduced threshold)
        if (enhanceTime > 100) {
          console.log(`⚠️ NCAAF Slow game state enhancement: ${enhanceTime}ms for game ${gameState.gameId}`);
        }
        
        return enhancedGameState;
      } else {
        this.performanceMetrics.cacheMisses++;
        this.performanceMetrics.gameStateEnhancementTime.push(Date.now() - startTime);
        return gameState;
      }

    } catch (error) {
      this.performanceMetrics.gameStateEnhancementTime.push(Date.now() - startTime);
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
        cacheMisses: this.performanceMetrics.cacheMisses,
      },
      sportSpecific: {
        aiEnhancementRate: this.performanceMetrics.totalAlerts > 0
          ? (this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100
          : 0,
        redZoneDetections: this.performanceMetrics.redZoneDetections,
        fourthDownSituations: this.performanceMetrics.fourthDownSituations,
        comebackOpportunities: this.performanceMetrics.comebackOpportunities,
        collegeFootballAlerts: this.performanceMetrics.totalAlerts,
        deduplicationRate: '0.0' // Now handled by unified deduplicator
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
      const validNCAAFAlerts = await this.getAvailableAlertTypes();

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
        'NCAAF_COMEBACK_POTENTIAL': './alert-cylinders/ncaaf/comeback-potential-module.ts',
        'NCAAF_MASSIVE_WEATHER': './alert-cylinders/ncaaf/massive-weather-module.ts',
        'NCAAF_SECOND_HALF_KICKOFF': './alert-cylinders/ncaaf/second-half-kickoff-module.ts',
        'NCAAF_CLOSE_GAME': './alert-cylinders/ncaaf/close-game-module.ts',
        'NCAAF_SCORING_PLAY': './alert-cylinders/ncaaf/scoring-play-module.ts',
        'NCAAF_FOURTH_QUARTER': './alert-cylinders/ncaaf/fourth-quarter-module.ts',
        'NCAAF_HALFTIME': './alert-cylinders/ncaaf/halftime-module.ts'
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

      const instance = new module.default();
      console.log(`✅ NCAAF ENGINE: Successfully registered alert module: ${alertType} from ${modulePath}`);
      return instance;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load NCAAF alert module ${alertType} after ${loadTime}ms:`, error);
      return null;
    }
  }

  // REMOVED: All delivery methods - AsyncAI processor handles all alert delivery
  // This ensures unified AI enhancement and prevents duplicate alerts

  // College football specific helper methods
  private isRivalryGame(gameState: GameState): boolean {
    // In a real implementation, this would check a database of rivalry games
    return false;
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

  // REMOVED: Custom processing method - unified AsyncAI processor handles all enhancement

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

  // Track possession changes for a game
  private trackPossessionChange(
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    possessionSide: 'home' | 'away' | null,
    quarter?: number,
    fieldPosition?: number
  ): void {
    if (!possessionSide) return;

    let tracking = this.possessionTracking.get(gameId);
    
    // Initialize tracking for new game
    if (!tracking) {
      tracking = {
        homeTeam,
        awayTeam,
        homePossessions: 0,
        awayPossessions: 0,
        currentPossession: null,
        lastPossessionChange: Date.now(),
        possessionHistory: []
      };
      this.possessionTracking.set(gameId, tracking);
    }

    // Check if possession changed
    if (tracking.currentPossession !== possessionSide) {
      console.log(`🏈 NCAAF Possession Change: Game ${gameId} - ${possessionSide === 'home' ? homeTeam : awayTeam} now has possession`);
      
      // Increment possession count
      if (possessionSide === 'home') {
        tracking.homePossessions++;
      } else {
        tracking.awayPossessions++;
      }

      // Record possession change
      tracking.possessionHistory.push({
        team: possessionSide,
        startTime: Date.now(),
        quarter,
        fieldPosition
      });

      tracking.currentPossession = possessionSide;
      tracking.lastPossessionChange = Date.now();
    }
  }

  // Get possession statistics for a game
  public getPossessionStats(gameId: string): any {
    const tracking = this.possessionTracking.get(gameId);
    if (!tracking) {
      return {
        gameId,
        tracked: false,
        message: 'No possession data tracked for this game'
      };
    }

    return {
      gameId,
      tracked: true,
      homeTeam: tracking.homeTeam,
      awayTeam: tracking.awayTeam,
      homePossessions: tracking.homePossessions,
      awayPossessions: tracking.awayPossessions,
      currentPossession: tracking.currentPossession,
      currentPossessionTeam: tracking.currentPossession === 'home' ? tracking.homeTeam : tracking.awayTeam,
      totalPossessions: tracking.homePossessions + tracking.awayPossessions,
      possessionHistory: tracking.possessionHistory,
      lastChange: new Date(tracking.lastPossessionChange).toISOString()
    };
  }

  // Get all possession stats across all tracked games
  public getAllPossessionStats(): any[] {
    const allStats = [];
    for (const [gameId, tracking] of this.possessionTracking.entries()) {
      allStats.push({
        gameId,
        homeTeam: tracking.homeTeam,
        awayTeam: tracking.awayTeam,
        homePossessions: tracking.homePossessions,
        awayPossessions: tracking.awayPossessions,
        currentPossession: tracking.currentPossession,
        currentPossessionTeam: tracking.currentPossession === 'home' ? tracking.homeTeam : tracking.awayTeam,
        totalPossessions: tracking.homePossessions + tracking.awayPossessions
      });
    }
    return allStats;
  }

  // Clear possession tracking for finished games
  public clearPossessionTracking(gameId: string): void {
    this.possessionTracking.delete(gameId);
    console.log(`🧹 NCAAF: Cleared possession tracking for game ${gameId}`);
  }

  // Get timeout statistics for a game
  public getTimeoutStats(gameId: string): any {
    const tracking = this.timeoutTracking.get(gameId);
    if (!tracking) {
      return {
        gameId,
        tracked: false,
        message: 'No timeout data tracked for this game'
      };
    }

    return {
      gameId,
      tracked: true,
      homeTeam: tracking.homeTeam,
      awayTeam: tracking.awayTeam,
      homeTimeoutsRemaining: tracking.homeTimeoutsRemaining,
      awayTimeoutsRemaining: tracking.awayTimeoutsRemaining,
      homeTimeoutsUsed: tracking.homeTimeoutsUsed,
      awayTimeoutsUsed: tracking.awayTimeoutsUsed,
      timeoutHistory: tracking.timeoutHistory
    };
  }

  // Clear timeout tracking for finished games
  public clearTimeoutTracking(gameId: string): void {
    this.timeoutTracking.delete(gameId);
    console.log(`🧹 NCAAF: Cleared timeout tracking for game ${gameId}`);
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
