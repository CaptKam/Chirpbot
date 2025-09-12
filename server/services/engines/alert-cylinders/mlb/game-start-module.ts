
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'MLB_GAME_START';
  sport = 'MLB';
  
  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;
    
    const currentState = this.gameStates.get(gameState.gameId);
    const currentStatus = gameState.status || (gameState.isLive ? 'live' : 'scheduled');
    
    // Detect status transition from scheduled/pre-game to live
    const statusTransition = !currentState || 
      (currentState.status !== 'live' && currentStatus === 'live');
    
    // Broader detection: game is live and in early innings (1-3)
    const isEarlyLiveGame = (gameState.isLive || currentStatus === 'live') && 
      (!gameState.inning || gameState.inning <= 3);
    
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
      message: `🚨 LIVE NOW | ${gameState.awayTeam} @ ${gameState.homeTeam} | First pitch thrown | Opening lines locked | Early value bets available | Momentum building | GET POSITIONED`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
