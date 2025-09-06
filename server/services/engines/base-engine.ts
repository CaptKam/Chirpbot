
export interface GameState {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isLive: boolean;
  [key: string]: any; // Allow additional sport-specific fields
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

  // Always return empty array - no alerts will be generated
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    console.log(`🚫 Alert generation disabled for ${this.sport} - returning empty array`);
    return [];
  }

  // Empty initialization methods
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    console.log(`🚫 Alert modules disabled for ${this.sport}`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    console.log(`🚫 Alert module loading disabled for ${alertType} in ${this.sport}`);
    return null;
  }
}
