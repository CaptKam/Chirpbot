
import { getAlertPipeline, GenericGameState } from '../AlertPipeline';

export class NFLEngine {
  private pipeline: any;

  constructor(aiEngine: any = null, broadcast: any = null) {
    this.pipeline = getAlertPipeline(aiEngine, broadcast);
    console.log('🏈 NFLEngine initialized');
  }

  async getTodaysGames(): Promise<any[]> {
    // Return empty for now - NFL season is not active
    return [];
  }

  async start(): Promise<void> {
    console.log('🏈 NFLEngine started (no active season)');
  }
}
