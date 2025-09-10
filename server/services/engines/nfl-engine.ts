import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class NFLEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor() {
    super('NFL');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual NFL alert types
      const validNFLAlerts = [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD'
      ];

      if (!validNFLAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NFL alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NFL Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // Enhanced NFL-specific probability calculation with optimized performance
    const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore } = gameState;

    let probability = 50; // Base probability

    // Quarter-specific adjustments (optimized for faster calculation)
    if (quarter === 1) probability += 10; // Game start excitement
    else if (quarter === 3) probability += 8; // Second half start
    else if (quarter === 4) probability += 15; // Fourth quarter drama

    // Down and distance (enhanced with field position context)
    if (down === 1) probability += 15;
    else if (down === 2) probability += 5;
    else if (down === 3) probability -= 5;
    else if (down === 4) probability += 25; // Fourth down is actually exciting!

    // Enhanced field position logic (optimized calculations)
    if (fieldPosition && fieldPosition <= 20) {
      probability += 20; // Red zone
      if (down === 4) probability += 10; // Fourth down in red zone
    } else if (fieldPosition && fieldPosition <= 40) {
      probability += 10; // Scoring territory
    }

    // Score differential (quick calculation)
    if (homeScore !== undefined && awayScore !== undefined) {
      const scoreDiff = Math.abs(homeScore - awayScore);
      if (scoreDiff <= 3) probability += 20; // Very close game
      else if (scoreDiff <= 7) probability += 10; // Close game
      else if (scoreDiff <= 14) probability += 5; // Competitive game
    }

    // Time factors (optimized time parsing)
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    if (timeSeconds <= 120) {
      probability += 20; // Two-minute warning
      if (quarter === 4) probability += 10; // End of game drama
    }

    // Yards to go consideration
    if (yardsToGo && yardsToGo <= 3) {
      probability += 10; // Short yardage situations are exciting
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  // Override to add NFL-specific game state enhancement and delegate to base class
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      // Enhance game state with NFL-specific live data if needed
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
      if (totalTime > 100) {
        console.log(`⚠️ NFL Slow alert generation: ${totalTime}ms for game ${gameState.gameId} (enhance: ${enhanceTime}ms, alerts: ${alertTime}ms)`);
      }
      
      return alerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ NFL Alert generation failed after ${totalTime}ms:`, error);
      return [];
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      // Get live data from NFL API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { NFLApiService } = await import('../nfl-api');
        const nflApi = new NFLApiService();
        const enhancedData = await nflApi.getEnhancedGameData(gameState.gameId, 'live');

        if (enhancedData && !enhancedData.error) {
          return {
            ...gameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
            down: enhancedData.down || null,
            yardsToGo: enhancedData.yardsToGo || null,
            fieldPosition: enhancedData.fieldPosition || null,
            possession: enhancedData.possession || null,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing NFL game state with live data:', error);
    }

    return gameState;
  }







  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }


  // Initialize alert modules based on user's enabled preferences (optimized)
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'NFL' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'NFL');
      console.log(`📋 NFL User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ NFL Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid NFL alerts that have corresponding module files
      const validNFLAlerts = [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD'
      ];

      const nflEnabledTypes = enabledTypes.filter(alertType =>
        validNFLAlerts.includes(alertType)
      );

      // Check global settings for these NFL alerts (optimized batch check)
      const globallyEnabledTypes = [];
      for (const alertType of nflEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 NFL Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing NFL engine for user ${userId} with ${globallyEnabledTypes.length} NFL alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the NFL alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize NFL engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      const moduleMap: Record<string, string> = {
        'NFL_GAME_START': './alert-cylinders/nfl/game-start-module.ts',
        'NFL_TWO_MINUTE_WARNING': './alert-cylinders/nfl/two-minute-warning-module.ts',
        'NFL_RED_ZONE': './alert-cylinders/nfl/red-zone-module.ts',
        'NFL_SECOND_HALF_KICKOFF': './alert-cylinders/nfl/second-half-kickoff-module.ts',
        'NFL_FOURTH_DOWN': './alert-cylinders/nfl/fourth-down-module.ts',
        'NFL_RED_ZONE_OPPORTUNITY': './alert-cylinders/nfl/red-zone-opportunity-module.ts',
        'NFL_TURNOVER_LIKELIHOOD': './alert-cylinders/nfl/turnover-likelihood-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NFL module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);
      
      if (loadTime > 50) {
        console.log(`⚠️ NFL Slow module load: ${alertType} took ${loadTime}ms`);
      }
      
      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load NFL alert module ${alertType} after ${loadTime}ms:`, error);
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
      console.log(`🔄 NFL alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }
    
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared NFL alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded NFL alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} NFL alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }
  
  // Get performance statistics for monitoring
  getPerformanceStats(): any {
    const { alertGenerationTime, moduleLoadTime, enhanceDataTime } = this.performanceMetrics;
    
    const calculateStats = (times: number[]) => {
      if (times.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0, min: 0 };
      
      const sorted = [...times].sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const max = Math.max(...times);
      const min = Math.min(...times);
      
      return { avg: Math.round(avg * 100) / 100, p50, p95, p99, max, min };
    };
    
    return {
      alertGeneration: calculateStats(alertGenerationTime),
      moduleLoading: calculateStats(moduleLoadTime),
      dataEnhancement: calculateStats(enhanceDataTime),
      totalRequests: this.performanceMetrics.totalRequests,
      totalAlerts: this.performanceMetrics.totalAlerts,
      cacheHitRate: this.performanceMetrics.totalRequests > 0 
        ? Math.round((this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100) 
        : 0,
      alertsPerRequest: this.performanceMetrics.totalRequests > 0 
        ? Math.round((this.performanceMetrics.totalAlerts / this.performanceMetrics.totalRequests) * 100) / 100 
        : 0
    };
  }
  
  // Log performance summary every 5 minutes
  logPerformanceSummary(): void {
    const stats = this.getPerformanceStats();
    console.log(`📊 NFL Engine Performance Summary:
` +
      `  Alert Generation: avg ${stats.alertGeneration.avg}ms, p95 ${stats.alertGeneration.p95}ms\n` +
      `  Module Loading: avg ${stats.moduleLoading.avg}ms, p95 ${stats.moduleLoading.p95}ms\n` +
      `  Data Enhancement: avg ${stats.dataEnhancement.avg}ms, p95 ${stats.dataEnhancement.p95}ms\n` +
      `  Total Requests: ${stats.totalRequests}, Alerts: ${stats.totalAlerts}\n` +
      `  Cache Hit Rate: ${stats.cacheHitRate}%, Alerts/Request: ${stats.alertsPerRequest}`);
  }
}