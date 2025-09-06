
import { GameState, AlertResult } from '../../base-engine';

export interface GameStartContext {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  isLive: boolean;
  quarter?: number;
  gameStartTime?: string;
}

export class NCAAFGameStartModule {
  private processedGames: Set<string> = new Set();

  async checkAlert(gameState: GameState): Promise<AlertResult> {
    const gameId = gameState.gameId;
    
    if (this.processedGames.has(gameId)) {
      return {
        shouldAlert: false,
        type: 'GAME_START',
        message: '',
        priority: 0,
        context: {}
      };
    }

    const isGameStarting = (
      gameState.isLive && 
      gameState.status === 'live' &&
      (!gameState.quarter || gameState.quarter <= 1)
    );

    if (isGameStarting) {
      this.processedGames.add(gameId);
      
      const context: GameStartContext = {
        gameId: gameState.gameId,
        sport: 'NCAAF',
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        status: gameState.status,
        isLive: gameState.isLive,
        quarter: gameState.quarter,
        gameStartTime: new Date().toISOString()
      };

      return {
        shouldAlert: true,
        type: 'GAME_START',
        message: `🏈 College Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
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

export default NCAAFGameStartModule;
