import { BaseSportEngine } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class MLBEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('MLB');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual MLB alert types
      const validMLBAlerts = [
        'BASES_LOADED', 'FULL_COUNT', 'RISP', 'CLOSE_GAME', 'LATE_PRESSURE',
        'POWER_HITTER', 'HOT_HITTER', 'RUNNERS_1ST_2ND', 'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH', 'TEST_ALERT'
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
    const { inning, outs, homeScore, awayScore } = gameState;

    let probability = 50; // Base probability

    // Inning-specific adjustments
    if (inning >= 7) probability += 15; // Late innings
    else if (inning >= 4) probability += 8; // Middle innings
    else if (inning <= 2) probability += 10; // Early game excitement

    // Outs situation
    if (outs === 0) probability += 15; // No outs
    else if (outs === 1) probability += 5; // One out
    else if (outs === 2) probability -= 10; // Two outs - pressure

    // Score situation
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 2) probability += 20; // Close game
    else if (scoreDiff <= 5) probability += 10; // Moderately close
    else if (scoreDiff >= 8) probability -= 15; // Blowout

    // Base runners (if available)
    if (gameState.hasFirst || gameState.hasSecond || gameState.hasThird) {
      probability += 10; // Runners on base
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    // Enhance game state with MLB-specific data if needed
    const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

    // Use the parent class method which properly calls all loaded modules
    return super.generateLiveAlerts(enhancedGameState);
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      // Get live data from MLB API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { MLBApiService } = await import('../mlb-api');
        const mlbApi = new MLBApiService();
        const enhancedData = await mlbApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          return {
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
            awayScore: enhancedData.awayScore || gameState.awayScore
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing game state with live data:', error);
    }

    return gameState;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'mlb');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Filter to only valid MLB alerts
      const validMLBAlerts = [
        'BASES_LOADED', 'FULL_COUNT', 'RISP', 'CLOSE_GAME', 'LATE_PRESSURE',
        'POWER_HITTER', 'HOT_HITTER', 'RUNNERS_1ST_2ND', 'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH', 'TEST_ALERT'
      ];

      const mlbEnabledTypes = enabledTypes.filter(alertType =>
        validMLBAlerts.includes(alertType)
      );

      // Process all alerts - no global filtering
      console.log(`🎯 Initializing MLB engine for user ${userId} with ${mlbEnabledTypes.length} MLB alerts: ${mlbEnabledTypes.join(', ')}`);

      // Initialize the MLB alert modules using parent class method
      await this.initializeUserAlertModules(mlbEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine for user ${userId}:`, error);
    }
  }

  // Load alert modules dynamically - MLB only
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      // Map MLB alert types to actual module files
      const moduleMap: Record<string, string> = {
        'BASES_LOADED': 'bases-loaded-module',
        'RISP': 'risp-module',
        'CLOSE_GAME': 'close-game-module',
        'LATE_PRESSURE': 'late-pressure-module',
        'POWER_HITTER': 'power-hitter-module',
        'HOT_HITTER': 'hot-hitter-module',
        'RUNNERS_1ST_2ND': 'runners-1st-2nd-module',
        'FULL_COUNT': 'full-count-module',
        'MLB_GAME_START': 'game-start-module',
        'MLB_SEVENTH_INNING_STRETCH': 'seventh-inning-stretch-module',
        'TEST_ALERT': 'test-alert-module'
      };

      const moduleFileName = moduleMap[alertType];
      if (!moduleFileName) {
        console.log(`❌ No MLB module found for: ${alertType}`);
        return null;
      }

      const modulePath = `./alert-cylinders/${this.sport.toLowerCase()}/${moduleFileName}`;
      const module = await import(modulePath);
      const ModuleClass = module.default;
      return new ModuleClass();
    } catch (error) {
      console.error(`❌ Failed to load MLB alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert modules for enabled alert types - MLB only
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    console.log(`🔧 Loading ${enabledAlertTypes.length} MLB alert modules...`);

    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ Loaded MLB alert module: ${alertType}`);
        } else {
          console.log(`❌ Failed to load MLB module: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Error loading MLB ${alertType}:`, error);
      }
    }

    console.log(`🎯 Successfully initialized ${this.alertModules.size} MLB alert modules`);
  }
}