import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class NBAEngine extends BaseSportEngine {
  // Deduplication tracking - tracks sent alerts to prevent duplicates (standardized from MLB)
  private sentAlerts: Map<string, Set<string>> = new Map(); // gameId -> Set of alertKeys
  private alertTimestamps: Map<string, number> = new Map(); // alertKey -> timestamp
  private lastCleanup: number = Date.now();
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes cooldown per alert
  private readonly CLEANUP_INTERVAL_MS = 600000; // Clean up old entries every 10 minutes
  private readonly MAX_ALERTS_PER_GAME = 50; // Prevent memory overload per game
  
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
    clutchTimeDetections: 0,
    overtimeAlerts: 0,
    duplicatesBlocked: 0,
    alertsSent: 0
  };

  constructor() {
    super('NBA');
  }
  
  /**
   * Check if an alert has already been sent recently
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    // Check if this exact alert was sent recently
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.performanceMetrics.duplicatesBlocked++;
      console.log(`🚫 NBA Duplicate blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }
    
    // Check if we've sent too many alerts for this game
    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= this.MAX_ALERTS_PER_GAME) {
      console.log(`⚠️ NBA Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark an alert as sent
   */
  private markAlertSent(gameId: string, alertKey: string): void {
    // Track by game
    if (!this.sentAlerts.has(gameId)) {
      this.sentAlerts.set(gameId, new Set());
    }
    this.sentAlerts.get(gameId)!.add(alertKey);
    
    // Track timestamp
    this.alertTimestamps.set(alertKey, Date.now());
    this.performanceMetrics.alertsSent++;
    
    console.log(`✅ NBA Alert tracked: ${alertKey} for game ${gameId}`);
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupOldAlerts();
  }
  
  /**
   * Clean up old alert tracking data to prevent memory leaks
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    
    // Only run cleanup periodically
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) {
      return;
    }
    
    console.log(`🧹 NBA Alert cleanup: Removing alerts older than ${this.ALERT_COOLDOWN_MS}ms`);
    
    // Clean up old timestamps
    let removedCount = 0;
    for (const [alertKey, timestamp] of this.alertTimestamps.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN_MS) {
        this.alertTimestamps.delete(alertKey);
        removedCount++;
      }
    }
    
    // Clean up game tracking for finished games (no alerts in last hour)
    const oneHourAgo = now - 3600000;
    for (const [gameId, alerts] of this.sentAlerts.entries()) {
      let hasRecentAlert = false;
      for (const alertKey of alerts) {
        const timestamp = this.alertTimestamps.get(alertKey);
        if (timestamp && timestamp > oneHourAgo) {
          hasRecentAlert = true;
          break;
        }
      }
      
      if (!hasRecentAlert) {
        this.sentAlerts.delete(gameId);
        console.log(`🧹 NBA Removed tracking for game ${gameId}`);
      }
    }
    
    this.lastCleanup = now;
    console.log(`🧹 NBA Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual NBA alert types that have corresponding modules
      const validNBAAlerts = [
        'NBA_GAME_START', 'NBA_FOURTH_QUARTER', 'NBA_FINAL_MINUTES',
        'NBA_TWO_MINUTE_WARNING', 'NBA_OVERTIME',
        // V3-11: Core NBA professional basketball alert types
        'NBA_CLUTCH_TIME_OPPORTUNITY', 'NBA_STAR_PLAYER_PERFORMANCE',
        'NBA_CLOSE_GAME_ALERT', 'NBA_PLAYOFF_IMPLICATIONS',
        // V3-12: Advanced NBA predictive analytics alert types
        'NBA_CLUTCH_PERFORMANCE', 'NBA_CHAMPIONSHIP_IMPLICATIONS',
        'NBA_SUPERSTAR_ANALYTICS', 'NBA_PLAYOFF_INTENSITY'
      ];

      if (!validNBAAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NBA alert type - rejecting`);
        return false;
      }

      // Always return true for valid alert types - global settings removed to allow generation
      // Only user preferences will control actual alert delivery  
      return true;
    } catch (error) {
      console.error(`NBA Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();
    
    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability
      
      // Enhanced NBA-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, homeScore, awayScore, possession } = gameState;

      // Quarter-specific adjustments (optimized calculation for NBA pace)
      if (quarter === 1) probability += 10; // First quarter action
      else if (quarter === 2) probability += 12; // Second quarter momentum
      else if (quarter === 3) probability += 14; // Third quarter adjustments
      else if (quarter === 4) probability += 20; // Fourth quarter drama
      else if (quarter >= 5) probability += 30; // Overtime intensity

      // NBA Time factors (optimized time parsing for 24-second shot clock)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 60 && quarter >= 4) {
          probability += 25; // Final minute crunch time
          this.performanceMetrics.clutchTimeDetections++;
        } else if (timeSeconds <= 120 && quarter >= 4) {
          probability += 18; // Final two minutes (NBA two-minute warning)
        } else if (timeSeconds <= 300 && quarter >= 4) {
          probability += 12; // Final 5 minutes (clutch time)
        }
        
        // NBA shot clock scenarios (24-second NBA shot clock)
        if (timeSeconds % 24 <= 5 && quarter >= 3) {
          probability += 8; // Shot clock pressure
        }
      }

      // Score differential (optimized for NBA professional basketball pace)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) probability += 25; // Very close game (one possession)
        else if (scoreDiff <= 6) probability += 18; // Close game (two possessions)
        else if (scoreDiff <= 10) probability += 12; // Competitive game
        else if (scoreDiff <= 15) probability += 8; // Moderately competitive
        else if (scoreDiff >= 20) probability -= 10; // Blowout
        
        // NBA high-scoring game bonus (NBA average ~110 points per team)
        const totalScore = homeScore + awayScore;
        if (totalScore >= 220 && quarter >= 3) probability += 15; // High-scoring NBA game
        else if (totalScore >= 200 && quarter >= 3) probability += 10; // Above average
        else if (totalScore <= 180 && quarter >= 3) probability += 8; // Defensive battle
      }

      // Professional basketball possession and momentum factors
      if (possession && quarter >= 3) {
        probability += 5; // Possession adds more context in later quarters
      }

      // NBA-specific situational boosts (professional level)
      if (quarter >= 4) {
        // Fourth quarter and overtime get extra weight in NBA
        if (homeScore !== undefined && awayScore !== undefined) {
          const scoreDiff = Math.abs(homeScore - awayScore);
          if (scoreDiff <= 5) probability += 20; // One or two possession games are crucial
          if (scoreDiff <= 2) probability += 10; // Single possession games are most exciting
        }
      }

      // Overtime situations (NBA has 5-minute overtimes)
      if (quarter >= 5) {
        probability += 15; // Extra overtime drama
        this.performanceMetrics.overtimeAlerts++;
      }

      const finalProbability = Math.min(Math.max(probability, 10), 95);
      
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      
      if (calculationTime > 50) {
        console.log(`⚠️ NBA Slow probability calculation: ${calculationTime}ms for game ${gameState.gameId}`);
      }
      
      return finalProbability;
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      console.error(`❌ NBA Probability calculation failed after ${calculationTime}ms:`, error);
      return 50; // Safe fallback
    }
  }

  // Override to add NBA-specific game state normalization (standardized from WNBA)
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    
    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ NBA: No gameId provided, skipping alert generation');
        return [];
      }
      
      console.log(`🎯 NBA: Processing game ${gameState.gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      console.log(`🎯 NBA: Status=${gameState.status}, isLive=${gameState.isLive}, quarter=${gameState.quarter}`);
      
      // Enhance game state with NBA-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      
      // ✅ SEND RAW ALERTS TO UNIFIED AI PROCESSOR FOR ENHANCEMENT (standardized from WNBA)
      // Process ALL generated alerts through AI enhancement before deduplication
      if (rawAlerts.length > 0) {
        console.log(`🔄 NBA: Sending ${rawAlerts.length} raw alerts to AsyncAI processor for enhancement`);
        const { unifiedAIProcessor } = await import('../unified-ai-processor');
        
        // Send each raw alert to AsyncAI processor with proper context
        for (const alert of rawAlerts) {
          const context: CrossSportContext = {
            sport: 'NBA' as const,
            alertType: alert.type,
            gameId: enhancedGameState.gameId,
            priority: alert.priority || 75,
            probability: alert.priority || 75,
            homeTeam: enhancedGameState.homeTeam || 'Home',
            awayTeam: enhancedGameState.awayTeam || 'Away',
            homeScore: enhancedGameState.homeScore || 0,
            awayScore: enhancedGameState.awayScore || 0,
            isLive: enhancedGameState.isLive || false,
            quarter: enhancedGameState.quarter || 1,
            timeRemaining: enhancedGameState.timeRemaining || '',
            timeLeft: enhancedGameState.timeRemaining || '',
            shotClock: (enhancedGameState as any).shotClock || 24,
            fouls: {
              home: (enhancedGameState as any).homeFouls || 0,
              away: (enhancedGameState as any).awayFouls || 0
            },
            possession: enhancedGameState.possession,
            originalMessage: alert.message,
            originalContext: alert.context
          };
          
          console.log(`🎯 NBA AsyncAI: Queuing ${alert.type} alert for enhancement`);
          // NON-BLOCKING: Queue for AI enhancement in background
          unifiedAIProcessor.queueAlert(alert, context, enhancedGameState.gameId).catch(error => {
            console.warn(`⚠️ NBA AI Queue failed for ${alert.type}:`, error);
          });
        }
      } else {
        console.log(`🔄 NBA: No alerts generated for game ${enhancedGameState.gameId}`);
      }
      
      // Track NBA-specific metrics
      if (enhancedGameState.quarter >= 4) {
        this.performanceMetrics.clutchTimeDetections++;
      }
      if (enhancedGameState.quarter >= 5) {
        this.performanceMetrics.overtimeAlerts++;
      }
      if (enhancedGameState.homeScore !== undefined && enhancedGameState.awayScore !== undefined) {
        const scoreDiff = Math.abs(enhancedGameState.homeScore - enhancedGameState.awayScore);
        if (scoreDiff <= 3 && enhancedGameState.quarter >= 4) {
          // Track close game situations in NBA (within 3 points in 4th quarter)
        }
      }
      
      this.performanceMetrics.totalAlerts += rawAlerts.length;
      
      // Return raw alerts for tracking (AsyncAI will handle the actual broadcasting)
      return rawAlerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  // Reuse single API service instance to avoid overhead
  private static nbaApiService: any = null;

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();
    
    try {
      let enhancedGameState = { ...gameState };

      // Get live data from NBA API if game is live
      if (gameState.isLive && gameState.gameId) {
        // Reuse singleton API service instance to avoid creation overhead
        if (!NBAEngine.nbaApiService) {
          const { NBAApiService } = await import('../nba-api');
          NBAEngine.nbaApiService = new NBAApiService();
        }
        
        const enhancedData = await NBAEngine.nbaApiService.getEnhancedGameData?.(gameState.gameId);

        if (enhancedData && !enhancedData.error && this.isEnhancedDataMeaningful(enhancedData, gameState)) {
          enhancedGameState = {
            ...enhancedGameState,
            quarter: this.shouldUseEnhancedValue(enhancedData.quarter, gameState.quarter, 1) ? enhancedData.quarter : gameState.quarter,
            timeRemaining: this.shouldUseEnhancedValue(enhancedData.timeRemaining, gameState.timeRemaining, '12:00') ? enhancedData.timeRemaining : gameState.timeRemaining,
            possession: enhancedData.possession !== undefined ? enhancedData.possession : gameState.possession,
            homeScore: this.shouldUseEnhancedScore(enhancedData.homeScore, gameState.homeScore),
            awayScore: this.shouldUseEnhancedScore(enhancedData.awayScore, gameState.awayScore),
            // NBA-specific fields
            period: enhancedData.period || gameState.quarter,
            clock: enhancedData.clock || gameState.timeRemaining,
            shotClock: enhancedData.shotClock || 24, // NBA shot clock
            situation: enhancedData.situation || {},
            // Professional basketball context
            starPlayerStats: enhancedData.starPlayerStats || {},
            clutchSituation: this.detectClutchSituation(enhancedGameState)
          };
          
          this.performanceMetrics.cacheHits++;
          console.log(`🔍 NBA Enhanced game ${gameState.gameId}: Used meaningful enhanced data`);
        } else {
          this.performanceMetrics.cacheMisses++;
          console.log(`🚫 NBA Game ${gameState.gameId}: Enhanced data was stub/meaningless - preserving original data`);
        }
      }

      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);
      
      // Auto-cleanup metrics to prevent memory growth
      if (this.performanceMetrics.gameStateEnhancementTime.length % 50 === 0) {
        this.cleanupPerformanceMetrics();
      }
      
      if (enhanceTime > 100) {
        console.log(`⚠️ NBA Slow game state enhancement: ${enhanceTime}ms for game ${gameState.gameId}`);
      }

      return enhancedGameState;
    } catch (error) {
      const enhanceTime = Date.now() - startTime;
      console.error(`❌ NBA Game state enhancement failed after ${enhanceTime}ms:`, error);
      return gameState;
    }
  }

  // Helper to determine if enhanced data is meaningful vs stub data
  private isEnhancedDataMeaningful(enhancedData: any, originalGameState: GameState): boolean {
    // Check if enhanced data has meaningful differences from original or default values
    if (!enhancedData) return false;
    
    // Check if quarter is meaningful (not just default 1)
    if (enhancedData.quarter && enhancedData.quarter !== 1 && enhancedData.quarter !== originalGameState.quarter) {
      return true;
    }
    
    // Check if time is meaningful (not default 12:00)
    if (enhancedData.timeRemaining && enhancedData.timeRemaining !== '12:00' && enhancedData.timeRemaining !== originalGameState.timeRemaining) {
      return true;
    }
    
    // Check if scores are meaningful (not both 0)
    if ((enhancedData.homeScore > 0 || enhancedData.awayScore > 0) && 
        (enhancedData.homeScore !== originalGameState.homeScore || enhancedData.awayScore !== originalGameState.awayScore)) {
      return true;
    }
    
    return false;
  }

  // Helper to determine whether to use enhanced value or original
  private shouldUseEnhancedValue(enhancedValue: any, originalValue: any, defaultValue: any): boolean {
    // Use enhanced value if:
    // 1. It exists and is not the default stub value
    // 2. AND (original doesn't exist OR they're different)
    return enhancedValue !== undefined && 
           enhancedValue !== defaultValue && 
           (originalValue === undefined || enhancedValue !== originalValue);
  }

  // Helper for score values
  private shouldUseEnhancedScore(enhancedScore: number, originalScore: number): number {
    // Use enhanced score if it's meaningful (not 0) or if original is also 0
    if (enhancedScore !== undefined && enhancedScore >= 0) {
      // Use enhanced if it's non-zero or if original is also zero
      if (enhancedScore > 0 || originalScore === 0 || originalScore === undefined) {
        return enhancedScore;
      }
    }
    return originalScore || 0;
  }

  // NBA-specific clutch situation detection
  private detectClutchSituation(gameState: GameState): any {
    const { quarter, timeRemaining, homeScore, awayScore } = gameState;
    
    if (quarter >= 4 && timeRemaining) {
      const timeSeconds = this.parseTimeToSeconds(timeRemaining);
      const scoreDiff = Math.abs((homeScore || 0) - (awayScore || 0));
      
      return {
        isClutchTime: timeSeconds <= 300, // Final 5 minutes
        isCrunchTime: timeSeconds <= 120, // Final 2 minutes
        isCloseGame: scoreDiff <= 5, // Within 5 points
        clutchFactor: this.calculateClutchFactor(timeSeconds, scoreDiff, quarter)
      };
    }
    
    return {};
  }

  // Calculate NBA clutch factor for professional basketball
  private calculateClutchFactor(timeSeconds: number, scoreDiff: number, quarter: number): number {
    let clutchFactor = 0;
    
    // Time pressure (NBA-specific)
    if (timeSeconds <= 60) clutchFactor += 40; // Final minute
    else if (timeSeconds <= 120) clutchFactor += 30; // Final 2 minutes
    else if (timeSeconds <= 300) clutchFactor += 20; // Final 5 minutes
    
    // Score pressure
    if (scoreDiff <= 2) clutchFactor += 30; // One possession
    else if (scoreDiff <= 5) clutchFactor += 20; // Two possessions
    else if (scoreDiff <= 10) clutchFactor += 10; // Three possessions
    
    // Quarter pressure
    if (quarter >= 5) clutchFactor += 20; // Overtime
    else if (quarter === 4) clutchFactor += 15; // Fourth quarter
    
    return Math.min(clutchFactor, 100);
  }


  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'NBA' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'NBA');
      console.log(`📋 NBA User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ NBA Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid NBA alerts that have corresponding module files
      const validNBAAlerts = [
        'NBA_GAME_START', 'NBA_FOURTH_QUARTER', 'NBA_FINAL_MINUTES',
        'NBA_TWO_MINUTE_WARNING', 'NBA_OVERTIME',
        // V3-12: Advanced NBA predictive analytics alert types
        'NBA_CLUTCH_PERFORMANCE', 'NBA_CHAMPIONSHIP_IMPLICATIONS',
        'NBA_SUPERSTAR_ANALYTICS', 'NBA_PLAYOFF_INTENSITY'
      ];

      const nbaEnabledTypes = enabledTypes.filter(alertType =>
        validNBAAlerts.includes(alertType)
      );

      // Check global settings for these NBA alerts
      const globallyEnabledTypes = [];
      for (const alertType of nbaEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 NBA Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing NBA engine for user ${userId} with ${globallyEnabledTypes.length} NBA alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the NBA alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize NBA engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      const moduleMap: Record<string, string> = {
        'NBA_GAME_START': './alert-cylinders/nba/game-start-module.ts',
        'NBA_FOURTH_QUARTER': './alert-cylinders/nba/fourth-quarter-module.ts',
        'NBA_FINAL_MINUTES': './alert-cylinders/nba/final-minutes-module.ts',
        'NBA_TWO_MINUTE_WARNING': './alert-cylinders/nba/two-minute-warning-module.ts',
        'NBA_OVERTIME': './alert-cylinders/nba/overtime-module.ts',
        // V3-12: Advanced NBA predictive analytics modules
        'NBA_CLUTCH_PERFORMANCE': './alert-cylinders/nba/clutch-performance-module.ts',
        'NBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/nba/championship-implications-module.ts',
        'NBA_SUPERSTAR_ANALYTICS': './alert-cylinders/nba/superstar-analytics-module.ts',
        'NBA_PLAYOFF_INTENSITY': './alert-cylinders/nba/playoff-intensity-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NBA module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);
      
      if (loadTime > 50) {
        console.log(`⚠️ NBA Slow module load: ${alertType} took ${loadTime}ms`);
      }
      
      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load NBA alert module ${alertType} after ${loadTime}ms:`, error);
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
      console.log(`🔄 NBA alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }
    
    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared NBA alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded NBA alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} NBA alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  // NBA-specific time parsing optimized for professional basketball
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
      console.warn(`NBA: Failed to parse time string "${timeString}":`, error);
      return 0;
    }
  }

  
  




  // Performance metrics cleanup to prevent memory growth
  private cleanupPerformanceMetrics(): void {
    const maxSamples = 100; // Keep last 100 samples per metric
    
    this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-maxSamples);
    this.performanceMetrics.moduleLoadTime = this.performanceMetrics.moduleLoadTime.slice(-maxSamples);
    this.performanceMetrics.enhanceDataTime = this.performanceMetrics.enhanceDataTime.slice(-maxSamples);
    this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-maxSamples);
    this.performanceMetrics.gameStateEnhancementTime = this.performanceMetrics.gameStateEnhancementTime.slice(-maxSamples);
    
    console.log(`🧹 NBA Engine: Cleaned up performance metrics (kept last ${maxSamples} samples per metric)`);
  }

  // Get performance stats for monitoring
  getPerformanceStats(): any {
    const stats = {
      totalRequests: this.performanceMetrics.totalRequests,
      totalAlerts: this.performanceMetrics.totalAlerts,
      cacheHits: this.performanceMetrics.cacheHits,
      cacheMisses: this.performanceMetrics.cacheMisses,
      clutchTimeDetections: this.performanceMetrics.clutchTimeDetections,
      overtimeAlerts: this.performanceMetrics.overtimeAlerts,
      averageAlertTime: this.performanceMetrics.alertGenerationTime.length > 0 
        ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
        : 0,
      averageEnhanceTime: this.performanceMetrics.enhanceDataTime.length > 0
        ? this.performanceMetrics.enhanceDataTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.enhanceDataTime.length
        : 0,
      averageProbabilityTime: this.performanceMetrics.probabilityCalculationTime.length > 0
        ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
        : 0
    };
    
    return stats;
  }

  // Get performance metrics for V3 dashboard (consistent with other engines)
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
      
    const deduplicationRate = this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked > 0
      ? (this.performanceMetrics.duplicatesBlocked / (this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked)) * 100
      : 0;

    return {
      sport: 'NBA',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        cacheHitRate,
        deduplicationRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        alertsSent: this.performanceMetrics.alertsSent,
        duplicatesBlocked: this.performanceMetrics.duplicatesBlocked,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        clutchTimeDetections: this.performanceMetrics.clutchTimeDetections,
        overtimeAlerts: this.performanceMetrics.overtimeAlerts,
        professionalBasketballAlerts: this.performanceMetrics.totalAlerts,
        activeGameTracking: this.sentAlerts.size,
        totalTrackedAlerts: this.alertTimestamps.size
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20)
      }
    };
  }
}