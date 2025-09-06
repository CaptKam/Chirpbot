import { BaseSportEngine, GameState, AlertResult } from './base-engine';

export class CFLEngine extends BaseSportEngine {
  constructor() {
    super('CFL');
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
    console.log(`🔧 Loading ${enabledAlertTypes.length} CFL alert modules...`);
    
    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ CFL module loaded: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load CFL module: ${alertType}`, error);
      }
    }
    
    console.log(`🎯 Successfully initialized ${this.alertModules.size} CFL alert modules`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    const moduleMap: Record<string, string> = {
      'GAME_START': 'game-start-module',
      'THIRD_DOWN': 'third-down-module',
      'THREE_MINUTE_WARNING': 'three-minute-warning-module'
    };

    const moduleName = moduleMap[alertType];
    if (!moduleName) {
      console.log(`❌ No CFL module found for: ${alertType}`);
      return null;
    }

    try {
      const modulePath = `./alert-cylinders/cfl/${moduleName}`;
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.error(`❌ Failed to load CFL alert module ${alertType}:`, error);
      return null;
    }
  }
}