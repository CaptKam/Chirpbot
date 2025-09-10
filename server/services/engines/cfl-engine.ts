import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class CFLEngine extends BaseSportEngine {
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
    greyCapContextDetections: 0,
    overtimeAlerts: 0,
    threeDownSituations: 0
  };

  constructor() {
    super('CFL');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // V3-15: Complete CFL alert types with Canadian football specifics
      const validCFLAlerts = [
        'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING',
        // V3-15: Core CFL professional Canadian football alert types
        'CFL_FOURTH_QUARTER', 'CFL_FINAL_MINUTES', 'CFL_GREY_CUP_IMPLICATIONS',
        // V3-15: Advanced CFL Canadian-specific alert types  
        'CFL_THIRD_DOWN_SITUATION', 'CFL_ROUGE_OPPORTUNITY', 'CFL_OVERTIME'
      ];

      if (!validCFLAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid CFL alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
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
        this.performanceMetrics.threeDownSituations++;
        
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
          this.performanceMetrics.greyCapContextDetections++;
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

  // Override to add CFL-specific game state enhancement and performance monitoring
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      // Enhance game state with CFL-specific live data if needed
      const enhanceStartTime = Date.now();
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);
      const enhanceTime = Date.now() - enhanceStartTime;
      this.performanceMetrics.enhanceDataTime.push(enhanceTime);
      
      // Use the parent class method which properly calls all loaded modules
      const alertStartTime = Date.now();
      const alerts = await super.generateLiveAlerts(enhancedGameState);
      const alertTime = Date.now() - alertStartTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      
      this.performanceMetrics.totalAlerts += alerts.length;
      
      const totalTime = Date.now() - startTime;
      if (totalTime > 150) {
        console.log(`⚠️ CFL Slow alert generation: ${totalTime}ms for game ${gameState.gameId} (${alerts.length} alerts)`);
      }
      
      return alerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ CFL Alert generation failed after ${totalTime}ms:`, error);
      return [];
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();
    
    try {
      // Get live data from CFL API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { CFLApiService } = await import('../cfl-api');
        const cflApi = new CFLApiService();
        // Note: CFL API doesn't provide enhanced data like MLB
        // Return game state as-is for now
      }
    } catch (error) {
      console.error('Error enhancing CFL game state with live data:', error);
    } finally {
      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);
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
      const validCFLAlerts = [
        'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING', 'CFL_FOURTH_QUARTER', 
        'CFL_FINAL_MINUTES', 'CFL_GREY_CUP_IMPLICATIONS', 'CFL_THIRD_DOWN_SITUATION',
        'CFL_ROUGE_OPPORTUNITY', 'CFL_OVERTIME'
      ];

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
      totalActiveModules: this.alertModules.size,
      requestsPerSecond: this.performanceMetrics.totalRequests / Math.max(1, (Date.now()) / 1000),
      alertSuccessRate: this.performanceMetrics.totalRequests > 0 ? (this.performanceMetrics.totalAlerts / this.performanceMetrics.totalRequests) * 100 : 0
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




}