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

  // Optional method for initializing user alert modules (implemented by subclasses that support it)
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Default implementation does nothing - subclasses can override
    console.log(`🔧 Base engine: no specific alert modules to initialize for ${this.sport}`);
  }

  // Basic alert generation - generate alerts based on game conditions
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    
    try {
      // Check for basic alert conditions
      if (gameState.isLive) {
        // Generate close game alert if score difference is 3 or less
        const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
        if (scoreDiff <= 3) {
          alerts.push({
            alertKey: `${gameState.gameId}-close-game`,
            type: 'CLOSE_GAME',
            message: `Close game alert: ${gameState.awayTeam} vs ${gameState.homeTeam} - ${gameState.awayScore}-${gameState.homeScore}`,
            context: {
              gameId: gameState.gameId,
              scoreDifference: scoreDiff,
              homeScore: gameState.homeScore,
              awayScore: gameState.awayScore
            },
            priority: 90
          });
        }
      }
    } catch (error) {
      console.error(`Error generating alerts for ${gameState.gameId}:`, error);
    }
    
    return alerts;
  }
}