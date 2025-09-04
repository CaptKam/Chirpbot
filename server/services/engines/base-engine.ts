
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

  abstract async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]>;
  abstract async isAlertEnabled(alertType: string): Promise<boolean>;
  abstract async calculateProbability(gameState: GameState): Promise<number>;
}
