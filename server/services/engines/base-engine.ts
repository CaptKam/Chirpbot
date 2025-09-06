export interface GameState {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isLive: boolean;
  [key: string]: any; // Allow sport-specific fields
}

export interface AlertResult {
  alertKey: string;
  type: string;
  message: string;
  context: any;
  priority: number;
}

export abstract class BaseSportEngine {
  protected sport: string;

  constructor(sport: string) {
    this.sport = sport;
  }

  abstract calculateProbability(gameState: GameState): Promise<number>;

  // Simplified alert generation without modules
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    console.log(`🔍 Alert generation disabled - no modules loaded for ${gameState.gameId}`);
    return [];
  }
}