
import { getAlertPipeline, GenericGameState } from '../AlertPipeline';

export class NHLEngine {
  private pipeline: any;

  constructor(aiEngine: any = null, broadcast: any = null) {
    this.pipeline = getAlertPipeline(aiEngine, broadcast);
    console.log('🏒 NHLEngine initialized');
  }

  async getTodaysGames(): Promise<any[]> {
    // Return empty for now
    return [];
  }

  async start(): Promise<void> {
    console.log('🏒 NHLEngine started');
  }
}
