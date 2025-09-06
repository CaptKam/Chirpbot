import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class NCAAFEngine extends BaseSportEngine {
  // Removed settingsCache property as it's related to alerts

  constructor() {
    super('NCAAF');
    // Removed settingsCache initialization
  }

  // Removed isAlertEnabled method

  async calculateProbability(gameState: GameState): Promise<number> {
    // NCAAF-specific probability calculation
    // Based on down, distance, field position, time remaining, etc.
    const { down, yardsToGo, fieldPosition, quarter, timeRemaining } = gameState;

    let probability = 50; // Base probability

    // Down-specific adjustments
    if (down === 1) probability += 20;
    else if (down === 2) probability += 10;
    else if (down === 3) probability -= 10;
    else if (down === 4) probability -= 30;

    // Distance adjustments
    if (yardsToGo <= 3) probability += 15;
    else if (yardsToGo <= 7) probability += 5;
    else if (yardsToGo >= 15) probability -= 15;

    // Field position (red zone bonus)
    if (fieldPosition <= 20) probability += 25;
    else if (fieldPosition <= 40) probability += 10;

    // Time pressure
    if (quarter >= 4 && this.parseTimeToSeconds(timeRemaining) <= 120) {
      probability += 10;
    }

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
    console.log(`🔧 Loading ${enabledAlertTypes.length} NCAAF alert modules...`);
    
    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ NCAAF module loaded: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load NCAAF module: ${alertType}`, error);
      }
    }
    
    console.log(`🎯 Successfully initialized ${this.alertModules.size} NCAAF alert modules`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    const moduleMap: Record<string, string> = {
      'GAME_START': 'game-start-module',
      'RED_ZONE': 'red-zone-module',
      'FOURTH_DOWN': 'fourth-down-module',
      'TWO_MINUTE_WARNING': 'two-minute-warning-module',
      'CLUTCH_TIME': 'clutch-time-module',
      'OVERTIME': 'overtime-module'
    };

    const moduleName = moduleMap[alertType];
    if (!moduleName) {
      console.log(`❌ No NCAAF module found for: ${alertType}`);
      return null;
    }

    try {
      const modulePath = `./alert-cylinders/ncaaf/${moduleName}`;
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.error(`❌ Failed to load NCAAF alert module ${alertType}:`, error);
      return null;
    }
  }

  // Removed generateTwoMinuteWarningAlerts method
  // Removed generateRedZoneAlerts method
  // Removed generateFourthDownAlerts method
  // Removed generateGameStartAlerts method
  // Removed generateHalftimeKickoffAlerts method
  // Removed generateOvertimeAlerts method

  // Removed isWithinTwoMinutes method
  // Removed parseTimeToSeconds method
  // Removed isKickoffTime method
  // Removed getOrdinalSuffix method
}