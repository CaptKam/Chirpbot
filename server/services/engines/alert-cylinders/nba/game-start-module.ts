import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'NBA_GAME_START';
  sport = 'NBA';
  
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

    const timeRemaining = gameState.timeRemaining || '12:00';

    return {
      alertKey: `${gameState.gameId}_nba_game_start`,
      type: this.alertType,
      message: `🏀 NBA TIP-OFF! ${gameState.awayTeam} @ ${gameState.homeTeam} - Game is underway!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        // NBA-specific context
        nbaContext: {
          isGameStart: true,
          quarter: 'First Quarter',
          shotClock: 24,
          professionalBasketball: true,
          leagueLevel: 'NBA'
        }
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 95 : 0;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      return 0;
    }
  }
}