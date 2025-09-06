import { BaseSportEngine, GameState, AlertResult } from './base-engine';

export class CFLEngine extends BaseSportEngine {
  constructor() {
    super('CFL');
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    console.log(`🚫 CFL alert generation is disabled - no alerts will be generated`);
    return [];
  }
}