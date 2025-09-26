
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class GameStartModule extends BaseAlertModule {
  alertType = 'NCAAF_GAME_START';
  sport = 'NCAAF';
  
  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;
    
    const currentState = this.gameStates.get(gameState.gameId);
    
    // More flexible game start detection - trigger for any live game we haven't seen before
    const isLiveGame = gameState.status === 'live' && (gameState.quarter === 1 || gameState.quarter === 2);
    
    // Only trigger if game is now live AND we haven't triggered for this game yet
    if (isLiveGame) {
      // If we haven't seen this game before, or if we've seen it but it wasn't live before
      if (!currentState || (!currentState.hasTriggered && currentState.status !== 'live')) {
        console.log(`🎯 NCAAF Game Start triggered for ${gameState.gameId}: Q${gameState.quarter}, ${gameState.timeRemaining}`);
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
    // Don't call isTriggered() again - it was already called by the engine
    // and has side effects that change internal state

    return {
      alertKey: `${gameState.gameId}_game_start`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | GAME START`,
      displayMessage: `🏈 NCAAF GAME START | Q${gameState.quarter}`,

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
