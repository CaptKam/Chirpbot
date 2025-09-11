
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'WNBA_GAME_START';
  sport = 'WNBA';
  
  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;
    
    const currentState = this.gameStates.get(gameState.gameId);
    const isLiveGame = gameState.status === 'live' && gameState.quarter === 1 && gameState.timeRemaining === '10:00';
    
    // Only trigger if game is now live AND we haven't triggered for this game yet
    if (isLiveGame) {
      // If we haven't seen this game before, or if we've seen it but it wasn't live before
      if (!currentState || (!currentState.hasTriggered)) {
        // Update our tracking
        this.gameStates.set(gameState.gameId, { 
          status: 'live',
          hasTriggered: true 
        });
        return true;
      }
    } else {
      // Game is not live yet, track it but don't trigger
      if (!currentState) {
        this.gameStates.set(gameState.gameId, { 
          status: gameState.status || 'scheduled',
          hasTriggered: false 
        });
      }
    }
    
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_game_start`,
      type: this.alertType,
      message: `🏀 WNBA Game Started: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
