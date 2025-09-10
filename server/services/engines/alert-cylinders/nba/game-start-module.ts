import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'NBA_GAME_START';
  sport = 'NBA';

  isTriggered(gameState: GameState): boolean {
    // NBA game start: live status, first quarter, early in the quarter
    return gameState.status === 'live' && 
           gameState.quarter === 1 && 
           this.parseTimeToSeconds(gameState.timeRemaining) >= 600; // First 2 minutes of quarter
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