import { BaseSportEngine, GameState, AlertResult } from './base-engine';
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
        'MLB_BASES_LOADED_ONE_OUT'
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
            awayScore: enhancedData.awayScore || gameState.awayScore,
            // Enhanced player context
            currentBatter: enhancedData.batter || null,
            currentPitcher: enhancedData.pitcher || null,
            runnerDetails: enhancedData.runnerDetails || null
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
        'MLB_BASES_LOADED_ONE_OUT'
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
        'MLB_SECOND_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/second-and-third-one-out-module.ts'
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
}