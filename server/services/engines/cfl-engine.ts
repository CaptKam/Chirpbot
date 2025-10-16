import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';

export class CFLEngine extends BaseSportEngine {

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
    thirdDownSituations: 0,
    rougeOpportunities: 0,
    greyHupImplications: 0,
    overtimeAlerts: 0,
  };

  // Track possession per team per game
  private possessionTracking = new Map<string, {
    homeTeam: string;
    awayTeam: string;
    homePossessions: number;
    awayPossessions: number;
    currentPossession: 'home' | 'away' | null;
    lastPossessionChange: number;
    possessionHistory: Array<{
      team: 'home' | 'away';
      startTime: number;
      quarter: number;
      fieldPosition?: number;
    }>;
  }>();

  // Track timeouts per team per game
  private timeoutTracking = new Map<string, {
    homeTeam: string;
    awayTeam: string;
    homeTimeoutsRemaining: number;
    awayTimeoutsRemaining: number;
    homeTimeoutsUsed: number;
    awayTimeoutsUsed: number;
    timeoutHistory: Array<{
      team: 'home' | 'away';
      time: number; // Time of timeout
      quarter: number;
      timeoutsRemaining: number;
    }>;
  }>();

  constructor() {
    super('CFL');
  }


  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Validate against dynamically discovered alert types
      const validAlerts = await this.getAvailableAlertTypes();

      if (!validAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid CFL alert type - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`CFL Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability

      // Enhanced CFL-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore, possession } = gameState;

      // Quarter-specific adjustments (optimized calculation for CFL pace)
      if (quarter === 1) probability += 10; // First quarter action
      else if (quarter === 2) probability += 12; // Second quarter momentum
      else if (quarter === 3) probability += 14; // Third quarter adjustments
      else if (quarter === 4) probability += 20; // Fourth quarter drama
      else if (quarter >= 5) probability += 30; // Overtime intensity

      // CFL Time factors (optimized time parsing for 15-minute quarters)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 60 && quarter >= 4) {
          probability += 25; // Final minute crunch time
        } else if (timeSeconds <= 120 && quarter >= 4) {
          probability += 18; // Final two minutes (CFL two-minute warning)
        } else if (timeSeconds <= 180 && quarter >= 4) {
          probability += 12; // Final 3 minutes (CFL three-minute warning)
        }

        // CFL play clock scenarios (CFL has 20-second play clock)
        if (timeSeconds % 20 <= 3 && quarter >= 3) {
          probability += 8; // Play clock pressure
        }
      }

      // CFL Down and distance factors (3-down system is critical)
      if (down && yardsToGo !== undefined) {
        if (down === 1) probability += 15; // First down advantage
        else if (down === 2) probability += 8; // Second down still good
        else if (down === 3) probability += 25; // Third down is critical in CFL!
        this.performanceMetrics.thirdDownSituations++;

        // Yards to go adjustments (CFL field specifics)
        if (yardsToGo <= 1) probability += 20; // Very short yardage
        else if (yardsToGo <= 3) probability += 12; // Short yardage
        else if (yardsToGo <= 10) probability += 5; // Medium yardage
        else if (yardsToGo >= 15) probability -= 5; // Long yardage
      }

      // CFL Field position (110-yard field, wider field, different end zones)
      if (fieldPosition !== undefined) {
        if (fieldPosition <= 20) probability += 25; // CFL red zone (closer than NFL)
        else if (fieldPosition <= 35) probability += 15; // CFL scoring territory
        else if (fieldPosition <= 55) probability += 5; // CFL midfield advantage

        // CFL Rouge scoring opportunity (missed FG through end zone = 1 point)
        if (fieldPosition <= 45 && down === 3) {
          probability += 10; // Rouge potential adds excitement
        }
      }

      // Score differential (optimized for CFL professional pace)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) probability += 25; // Very close game (one score)
        else if (scoreDiff <= 7) probability += 18; // Close game (one TD)
        else if (scoreDiff <= 14) probability += 12; // Competitive game (two TDs)
        else if (scoreDiff <= 21) probability += 8; // Moderately competitive
        else if (scoreDiff >= 28) probability -= 10; // Blowout

        // CFL high-scoring game bonus (CFL average ~27 points per team)
        const totalScore = homeScore + awayScore;
        if (totalScore >= 60 && quarter >= 3) probability += 15; // High-scoring CFL game
        else if (totalScore >= 45 && quarter >= 3) probability += 10; // Above average
        else if (totalScore <= 30 && quarter >= 3) probability += 8; // Defensive battle
      }

      // CFL-specific situational boosts (professional level)
      if (quarter >= 4) {
        // Fourth quarter and overtime get extra weight in CFL
        if (homeScore !== undefined && awayScore !== undefined) {
          const scoreDiff = Math.abs(homeScore - awayScore);
          if (scoreDiff <= 7) probability += 20; // One score games are crucial
          if (scoreDiff <= 3) probability += 10; // Field goal games are most exciting
        }
      }

      // Overtime situations (CFL has different OT rules)
      if (quarter >= 5) {
        probability += 15; // Extra overtime drama
        this.performanceMetrics.overtimeAlerts++;
      }

      // Grey Cup context detection
      if (quarter >= 3 && homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 14) {
          probability += 5; // Grey Cup implications
          this.performanceMetrics.greyHupImplications++;
        }
      }

      const finalProbability = Math.min(Math.max(probability, 10), 95);

      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);

      if (calculationTime > 50) {
        console.log(`⚠️ CFL Slow probability calculation: ${calculationTime}ms for game ${gameState.gameId}`);
      }

      return finalProbability;
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      console.error(`❌ CFL Probability calculation failed after ${calculationTime}ms:`, error);
      return 50; // Safe fallback
    }
  }

  // Override to add CFL-specific game state enhancement and follow unified architecture
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();

    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ CFL: No gameId provided, skipping alert generation');
        console.log('⚠️ CFL: GameState received:', JSON.stringify({
          id: gameState.id,
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          isLive: gameState.isLive,
          status: gameState.status
        }, null, 2));
        return [];
      }

      console.log(`🎯 CFL: Processing game ${gameState.gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      console.log(`🎯 CFL: Status=${gameState.status}, isLive=${gameState.isLive}, quarter=${gameState.quarter}`);

      // Enhance game state with CFL-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);

      // Return raw alerts - GameStateManager will handle enhancement pipeline
      if (rawAlerts.length > 0) {
        console.log(`🔄 CFL: Generated ${rawAlerts.length} raw alerts - GameStateManager will handle enhancement`);
      } else {
        console.log(`🔄 CFL: No alerts generated for game ${enhancedGameState.gameId}`);
      }

      // Track CFL-specific metrics
      if (enhancedGameState.quarter >= 4) {
        this.performanceMetrics.overtimeAlerts++;
      }
      if (enhancedGameState.down === 3) {
        this.performanceMetrics.thirdDownSituations++;
      }
      if (enhancedGameState.fieldPosition && enhancedGameState.fieldPosition <= 45 && enhancedGameState.down === 3) {
        this.performanceMetrics.rougeOpportunities++;
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

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();

    try {
      console.log(`🔧 CFL Enhancement: Game ${gameState.gameId} - status=${gameState.status}, isLive=${gameState.isLive}`);

      // Get live data from CFL API for any non-final game (fixes catch-22 gating loop)
      if (gameState.gameId && gameState.status !== 'final') {
        console.log(`✅ CFL Enhancement: Fetching enhanced data for non-final game ${gameState.gameId}`);
        const { CFLApiService } = await import('../cfl-api');
        const cflApi = new CFLApiService();
        const enhancedData = await cflApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          this.performanceMetrics.cacheHits++;

          const enhancedGameState = {
            ...gameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining,
            down: enhancedData.down || gameState.down,
            yardsToGo: enhancedData.yardsToGo || gameState.yardsToGo,
            fieldPosition: enhancedData.fieldPosition || gameState.fieldPosition,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            possession: enhancedData.possession || gameState.possession,
            possessionSide: enhancedData.possessionSide || null,
            // Respect original game status - only force false for finished games, preserve original live state
            isLive: gameState.status === 'final' ? false : gameState.isLive
          };

          // Track possession changes for this game
          if (enhancedData.possessionSide) {
            this.trackPossessionChange(
              gameState.gameId,
              gameState.homeTeam as string,
              gameState.awayTeam as string,
              enhancedData.possessionSide,
              enhancedData.quarter,
              enhancedData.fieldPosition
            );
          }

          // Track timeout data from ESPN
          this.updateTimeoutsFromESPN(
            gameState.gameId,
            gameState.homeTeam as string,
            gameState.awayTeam as string,
            enhancedData.homeTimeoutsRemaining,
            enhancedData.awayTimeoutsRemaining,
            enhancedData.quarter
          );

          console.log(`🚀 CFL Enhancement: Game ${gameState.gameId} enhanced - isLive=${enhancedGameState.isLive}, quarter=${enhancedGameState.quarter}, down=${enhancedGameState.down}`);
          return enhancedGameState;
        } else {
          this.performanceMetrics.cacheMisses++;
        }
      }
    } catch (error) {
      console.error('Error enhancing CFL game state with live data:', error);
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


  // V3-15: Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'CFL' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'CFL');
      console.log(`📋 CFL User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ CFL Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid CFL alerts that we have modules for
      const validCFLAlerts = await this.getAvailableAlertTypes();

      const cflEnabledTypes = enabledTypes.filter(alertType =>
        validCFLAlerts.includes(alertType)
      );
      console.log(`🔍 CFL Valid enabled types: ${cflEnabledTypes.join(', ')}`);

      // Check global settings for these CFL alerts
      const globallyEnabledTypes = [];
      for (const alertType of cflEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 CFL Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing CFL engine for user ${userId} with ${globallyEnabledTypes.length} CFL alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the CFL alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize CFL engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();

    try {
      const moduleMap: Record<string, string> = {
        'CFL_GAME_START': './alert-cylinders/cfl/game-start-module.ts',
        'CFL_TWO_MINUTE_WARNING': './alert-cylinders/cfl/two-minute-warning-module.ts',
        'CFL_FOURTH_QUARTER': './alert-cylinders/cfl/fourth-quarter-module.ts',
        'CFL_FINAL_MINUTES': './alert-cylinders/cfl/final-minutes-module.ts',
        'CFL_GREY_CUP_IMPLICATIONS': './alert-cylinders/cfl/grey-cup-implications-module.ts',
        'CFL_THIRD_DOWN_SITUATION': './alert-cylinders/cfl/third-down-situation-module.ts',
        'CFL_ROUGE_OPPORTUNITY': './alert-cylinders/cfl/rouge-opportunity-module.ts',
        'CFL_OVERTIME': './alert-cylinders/cfl/overtime-module.ts',
        'CFL_MASSIVE_WEATHER': './alert-cylinders/cfl/massive-weather-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No CFL module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);

      if (loadTime > 50) {
        console.log(`⚠️ CFL Slow module load: ${alertType} took ${loadTime}ms`);
      }

      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load CFL alert module ${alertType} after ${loadTime}ms:`, error);
      return null;
    }
  }

  // V3-15: Performance monitoring and diagnostics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageAlertGeneration: this.performanceMetrics.alertGenerationTime.length > 0
        ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
        : 0,
      averageProbabilityCalculation: this.performanceMetrics.probabilityCalculationTime.length > 0
        ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
        : 0,
      averageAIEnhancementTime: this.performanceMetrics.aiEnhancementTime?.length > 0
        ? this.performanceMetrics.aiEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.aiEnhancementTime.length
        : 0,
      totalActiveModules: this.alertModules.size,
      requestsPerSecond: this.performanceMetrics.totalRequests / Math.max(1, (Date.now()) / 1000),
      alertSuccessRate: this.performanceMetrics.totalRequests > 0 ? (this.performanceMetrics.totalAlerts / this.performanceMetrics.totalRequests) * 100 : 0,
      enhancedAlertRate: this.performanceMetrics.totalAlerts > 0 ? (this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100 : 0
    };
  }



  // V3-15: CFL-specific utility methods with performance optimization
  parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Track possession changes for a game
  private trackPossessionChange(
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    possessionSide: 'home' | 'away' | null,
    quarter: number,
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
      console.log(`🏈 CFL Possession Change: Game ${gameId} - ${possessionSide === 'home' ? homeTeam : awayTeam} now has possession`);

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
    console.log(`🧹 CFL: Cleared possession tracking for game ${gameId}`);
  }

  // Update timeout tracking from ESPN data
  private updateTimeoutsFromESPN(
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    homeTimeoutsRemaining: number | null | undefined,
    awayTimeoutsRemaining: number | null | undefined,
    quarter: number
  ): void {
    // Skip if no timeout data from ESPN
    if (homeTimeoutsRemaining == null && awayTimeoutsRemaining == null) {
      return;
    }

    let tracking = this.timeoutTracking.get(gameId);

    // Initialize tracking for new game
    if (!tracking) {
      tracking = {
        homeTeam,
        awayTeam,
        homeTimeoutsRemaining: homeTimeoutsRemaining ?? 1,
        awayTimeoutsRemaining: awayTimeoutsRemaining ?? 1,
        homeTimeoutsUsed: 0,
        awayTimeoutsUsed: 0,
        timeoutHistory: []
      };
      this.timeoutTracking.set(gameId, tracking);
      console.log(`📊 CFL: Initialized timeout tracking for game ${gameId} - Home: ${homeTimeoutsRemaining}, Away: ${awayTimeoutsRemaining}`);
      return;
    }

    // Update timeouts from ESPN data
    const prevHomeTimeouts = tracking.homeTimeoutsRemaining;
    const prevAwayTimeouts = tracking.awayTimeoutsRemaining;

    if (homeTimeoutsRemaining != null) {
      tracking.homeTimeoutsRemaining = homeTimeoutsRemaining;
      tracking.homeTimeoutsUsed = 1 - homeTimeoutsRemaining;
      
      // Detect timeout usage
      if (homeTimeoutsRemaining < prevHomeTimeouts) {
        tracking.timeoutHistory.push({
          team: 'home',
          time: Date.now(),
          quarter,
          timeoutsRemaining: homeTimeoutsRemaining
        });
        console.log(`⏱️ CFL: Home team timeout used in game ${gameId} - ${homeTimeoutsRemaining} remaining`);
      }
    }

    if (awayTimeoutsRemaining != null) {
      tracking.awayTimeoutsRemaining = awayTimeoutsRemaining;
      tracking.awayTimeoutsUsed = 1 - awayTimeoutsRemaining;
      
      // Detect timeout usage
      if (awayTimeoutsRemaining < prevAwayTimeouts) {
        tracking.timeoutHistory.push({
          team: 'away',
          time: Date.now(),
          quarter,
          timeoutsRemaining: awayTimeoutsRemaining
        });
        console.log(`⏱️ CFL: Away team timeout used in game ${gameId} - ${awayTimeoutsRemaining} remaining`);
      }
    }
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
    console.log(`🧹 CFL: Cleared timeout tracking for game ${gameId}`);
  }




}
