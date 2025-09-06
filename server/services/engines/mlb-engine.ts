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
      // Core MLB alerts for base runner scenarios
      const validMLBAlerts: string[] = [
        'RISP', 'BASES_LOADED', 'RUNNERS_1ST_2ND', 'LATE_PRESSURE', 'POWER_HITTER'
      ];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return false;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    return 50; // Base probability only
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    
    // Extract base runner data
    const runners = gameState.runners || { first: false, second: false, third: false };
    const outs = gameState.outs || 0;
    
    // RISP Alert - Runners in Scoring Position (2nd or 3rd base)
    if ((runners.second || runners.third) && await this.isAlertEnabled('RISP')) {
      const baseText = [runners.second && '2nd', runners.third && '3rd']
        .filter(Boolean).join(' & ');
      alerts.push({
        type: 'RISP',
        message: `⚾ RUNNERS IN SCORING POSITION! ${baseText} base, ${outs} out${outs !== 1 ? 's' : ''}`,
        confidence: 85,
        priority: 90
      });
    }
    
    // Bases Loaded Alert
    if (runners.first && runners.second && runners.third && await this.isAlertEnabled('BASES_LOADED')) {
      alerts.push({
        type: 'BASES_LOADED', 
        message: `⚾ BASES LOADED! ${outs} out${outs !== 1 ? 's' : ''} - Maximum scoring potential!`,
        confidence: 95,
        priority: 100
      });
    }
    
    // Runners on 1st & 2nd
    if (runners.first && runners.second && !runners.third && await this.isAlertEnabled('RUNNERS_1ST_2ND')) {
      alerts.push({
        type: 'RUNNERS_1ST_2ND',
        message: `⚾ Runners on 1st & 2nd! ${outs} out${outs !== 1 ? 's' : ''} - Prime scoring opportunity!`,
        confidence: 80,
        priority: 85
      });
    }
    
    return alerts;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    const enabledAlerts = ['RISP', 'BASES_LOADED', 'RUNNERS_1ST_2ND', 'LATE_PRESSURE', 'POWER_HITTER'];
    console.log(`🎯 Initializing MLB engine for user ${userId} with ${enabledAlerts.length} MLB alerts:`, enabledAlerts.join(', '));
    await this.initializeUserAlertModules(enabledAlerts);
  }

  // Load alert modules dynamically - MLB only
  async loadAlertModule(alertType: string): Promise<any | null> {
    const validAlerts = ['RISP', 'BASES_LOADED', 'RUNNERS_1ST_2ND', 'LATE_PRESSURE', 'POWER_HITTER'];
    if (validAlerts.includes(alertType)) {
      console.log(`✅ Loaded MLB alert module: ${alertType}`);
      return { name: alertType, enabled: true };
    }
    console.log(`❌ No MLB module available for: ${alertType}`);
    return null;
  }

  // Initialize alert modules for enabled alert types - MLB only
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();
    console.log(`🔧 Loading ${enabledAlertTypes.length} MLB alert modules...`);
    
    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
      }
    }
    
    console.log(`🎯 Successfully initialized ${this.alertModules.size} MLB alert modules`);
  }
}