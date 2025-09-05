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
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails, to ensure alerts still fire
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // MLB-specific probability calculation
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

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'mlb');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Also check global settings
      const globallyEnabledTypes = [];
      for (const alertType of enabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType); // Use the class method
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing MLB engine for user ${userId} with alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize only the alert modules that are both globally enabled and user-enabled
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine for user ${userId}:`, error);
    }
  }

  // Placeholder for initializing user-specific alert modules
  private async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // This method would dynamically load and set up the alert generation logic
    // for each enabled alert type. For now, we'll just log them.
    console.log(`Setting up alert modules for: ${enabledAlertTypes.join(', ')}`);
    // Example:
    // if (enabledAlertTypes.includes('MLB_GAME_START')) {
    //   this.alertGenerators.push(this.generateGameStartAlerts);
    // }
    // ... and so on for other alert types.
  }

  // Helper method to parse time strings (if needed)
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    // MLB doesn't use time format like football, but keeping for compatibility
    const parts = timeString.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }
}