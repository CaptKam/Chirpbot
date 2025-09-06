import { BaseSportEngine, GameState, AlertResult } from './base-engine';

export class MLBEngine extends BaseSportEngine {
  private alertModules: Map<string, any> = new Map();

  constructor() {
    super('MLB');
  }

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
    console.log(`🔧 Loading ${enabledAlertTypes.length} MLB alert modules...`);

    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ MLB module loaded: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load MLB module: ${alertType}`, error);
      }
    }

    console.log(`🎯 Successfully initialized ${this.alertModules.size} MLB alert modules`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    const moduleMap: Record<string, string> = {
      'GAME_START': 'game-start-module',
      'RISP': 'risp-module',
      'BASES_LOADED': 'bases-loaded-module',
      'RUNNERS_1ST_2ND': 'runners-1st-2nd-module',
      'LATE_PRESSURE': 'late-pressure-module',
      'POWER_HITTER': 'power-hitter-module',
      'HOT_HITTER': 'hot-hitter-module',
      'CLOSE_GAME': 'close-game-module',
      'HIGH_SCORING': 'high-scoring-module',
      'SHUTOUT': 'shutout-module',
      'BLOWOUT': 'blowout-module',
      'STRIKEOUT': 'strikeout-module',
      'HOME_RUN_LIVE': 'home-run-live-module',
      'CLOSE_GAME_LIVE': 'close-game-live-module'
    };

    const moduleName = moduleMap[alertType];
    if (!moduleName) {
      console.log(`❌ No MLB module found for: ${alertType}`);
      return null;
    }

    try {
      const modulePath = `./alert-cylinders/mlb/${moduleName}`;
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.error(`❌ Failed to load MLB alert module ${alertType}:`, error);
      return null;
    }
  }
}