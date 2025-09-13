
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class NCAAFSecondHalfKickoffModule extends BaseAlertModule {
  alertType = 'NCAAF_SECOND_HALF_KICKOFF';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    // Second half kickoff - quarter 3 with kickoff time (15:00 or close to it)
    return gameState.status === 'live' && 
           gameState.quarter === 3 && 
           this.isKickoffTime(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_ncaaf_second_half_kickoff`,
      type: this.alertType,
      message: `🏈 SECOND HALF KICKOFF! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Second half begins!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        isSecondHalf: true
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }

  private isKickoffTime(timeRemaining: string): boolean {
    // Kickoff typically happens at start of quarter (15:00 or close to it)
    if (!timeRemaining) return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds >= 880 && totalSeconds <= 900; // Between 14:40 and 15:00
    } catch (error) {
      return false;
    }
  }

  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }
}
