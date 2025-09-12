
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'CFL_GAME_START';
  sport = 'CFL';
  
  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;
    
    const currentState = this.gameStates.get(gameState.gameId);
    const currentStatus = gameState.status || 'scheduled';
    
    // Detect status transition from scheduled/pre-game to live
    const statusTransition = !currentState || 
      (currentState.status !== 'live' && currentStatus === 'live');
    
    // Broader detection: game is live and in early quarters (1-2)
    const isEarlyLiveGame = currentStatus === 'live' && 
      (!gameState.quarter || gameState.quarter <= 2);
    
    // Trigger if: status transition to live OR early live game we haven't seen before
    const shouldTrigger = (statusTransition && isEarlyLiveGame) || 
      (isEarlyLiveGame && !currentState);
    
    if (shouldTrigger && (!currentState || !currentState.hasTriggered)) {
      // Update our tracking
      this.gameStates.set(gameState.gameId, { 
        status: currentStatus,
        hasTriggered: true 
      });
      return true;
    }
    
    // Always track game state, even if not triggering
    if (!currentState) {
      this.gameStates.set(gameState.gameId, { 
        status: currentStatus,
        hasTriggered: false 
      });
    }
    
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_game_start`,
      type: this.alertType,
      message: `🏈 CFL Game Started: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
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
