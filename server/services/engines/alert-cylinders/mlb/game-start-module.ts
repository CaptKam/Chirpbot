
import { GameState, AlertResult } from '../../base-engine';

export interface GameStartContext {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  isLive: boolean;
  inning?: number;
  gameStartTime?: string;
}

export class MLBGameStartModule {
  private processedGames: Set<string> = new Set();

  async checkAlert(gameState: GameState): Promise<AlertResult> {
    const gameId = gameState.gameId;
    
    // Only alert once per game when it starts
    if (this.processedGames.has(gameId)) {
      return {
        shouldAlert: false,
        type: 'GAME_START',
        message: '',
        priority: 0,
        context: {}
      };
    }

    // Check if game is starting (status indicates live/in-progress and we haven't seen it yet)
    const isGameStarting = (
      gameState.isLive && 
      gameState.status === 'live' &&
      (!gameState.inning || gameState.inning <= 1)
    );

    if (isGameStarting) {
      this.processedGames.add(gameId);
      
      const context: GameStartContext = {
        gameId: gameState.gameId,
        sport: 'MLB',
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        status: gameState.status,
        isLive: gameState.isLive,
        inning: gameState.inning,
        gameStartTime: new Date().toISOString()
      };

      return {
        shouldAlert: true,
        type: 'GAME_START',
        message: `⚾ Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
        priority: 75,
        context,
        alertKey: `${gameId}_GAME_START`
      };
    }

    return {
      shouldAlert: false,
      type: 'GAME_START',
      message: '',
      priority: 0,
      context: {}
    };
  }
}

export default MLBGameStartModule;
