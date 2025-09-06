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
      // No valid MLB alerts defined yet
      const validMLBAlerts: string[] = [];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return false; // Default to false since no modules exist
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    return 50; // Base probability only
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    // No modules to process, return empty array
    return [];
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    console.log(`🎯 No MLB alert modules available - skipping initialization for user ${userId}`);
  }

  // Load alert modules dynamically - MLB only
  async loadAlertModule(alertType: string): Promise<any | null> {
    console.log(`❌ No MLB modules available for: ${alertType}`);
    return null;
  }

  // Initialize alert modules for enabled alert types - MLB only
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();
    console.log(`🔧 No MLB alert modules to load - system reset`);
  }
}