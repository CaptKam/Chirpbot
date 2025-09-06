
import { BaseSportEngine, GameState, AlertResult } from './base-engine';

export class MLBEngine extends BaseSportEngine {
  constructor() {
    super('MLB');
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    console.log(`🚫 MLB alert generation is disabled - no alerts will be generated`);
    return [];
  }

  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    console.log(`🚫 MLB alert modules are disabled`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    console.log(`🚫 MLB alert module loading disabled for: ${alertType}`);
    return null;
  }
}
