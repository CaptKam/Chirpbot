import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class WNBAEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('WNBA');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`WNBA Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // WNBA-specific probability calculation
    // Based on quarter, time remaining, score differential, possession, etc.
    const { quarter, timeRemaining, homeScore, awayScore } = gameState;

    let probability = 50; // Base probability
    const scoreDiff = Math.abs(homeScore - awayScore);
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Quarter-specific adjustments
    if (quarter >= 4) probability += 15; // Fourth quarter intensity
    if (quarter >= 5) probability += 25; // Overtime intensity

    // Time pressure adjustments
    if (timeSeconds <= 60) probability += 20; // Final minute
    else if (timeSeconds <= 120) probability += 10; // Final 2 minutes

    // Score differential impact
    if (scoreDiff <= 3) probability += 20; // Very close game
    else if (scoreDiff <= 7) probability += 10; // Close game
    else if (scoreDiff >= 15) probability -= 20; // Blowout

    return Math.min(Math.max(probability, 5), 95);
  }

  private alertModules: Map<string, any> = new Map();

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    
    // Process each initialized alert module
    for (const [alertType, module] of this.alertModules.entries()) {
      try {
        const result = await module.checkAlert(gameState);
        if (result.shouldAlert) {
          alerts.push({
            alertKey: `${gameState.gameId}-${alertType}-${Date.now()}`,
            type: alertType,
            message: result.message,
            priority: result.priority || 50,
            context: result.context || gameState
          });
        }
      } catch (error) {
        console.error(`❌ Error processing ${alertType} alert:`, error);
      }
    }
    
    return alerts;
  }

  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    console.log(`🔧 Loading ${enabledAlertTypes.length} WNBA alert modules...`);
    
    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ WNBA module loaded: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load WNBA module: ${alertType}`, error);
      }
    }
    
    console.log(`🎯 Successfully initialized ${this.alertModules.size} WNBA alert modules`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    const moduleMap: Record<string, string> = {
      'GAME_START': 'game-start-module',
      'FOURTH_QUARTER': 'fourth-quarter-module',
      'CLOSE_GAME': 'close-game-module',
      'OVERTIME': 'overtime-module',
      'HIGH_SCORING': 'high-scoring-module',
      'COMEBACK': 'comeback-module',
      'CLUTCH_PERFORMANCE': 'clutch-performance-module'
    };

    const moduleName = moduleMap[alertType];
    if (!moduleName) {
      console.log(`❌ No WNBA module found for: ${alertType}`);
      return null;
    }

    try {
      const modulePath = `./alert-cylinders/wnba/${moduleName}`;
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.error(`❌ Failed to load WNBA alert module ${alertType}:`, error);
      return null;
    }
  }

  private isWithinMinutes(timeRemaining: string, minutes: number): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= (minutes * 60) && totalSeconds > 0;
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

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }
}