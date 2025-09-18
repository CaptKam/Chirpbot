
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FourthQuarterModule extends BaseAlertModule {
  alertType = 'WNBA_FOURTH_QUARTER';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return gameState.quarter === 4 && 
           this.parseTimeToSeconds(gameState.timeRemaining) <= 300 && // 5 minutes
           scoreDiff <= 12;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeRemaining = gameState.timeRemaining;
    
    return {
      alertKey: `${gameState.gameId}_fourth_quarter_${timeRemaining.replace(/[:\s]/g, '')}`,
      type: this.alertType,
      message: `🏀 WNBA FOURTH QUARTER CRUNCH TIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        scoreDiff
      },
      priority: scoreDiff <= 5 ? 95 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 85 : 0;
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
