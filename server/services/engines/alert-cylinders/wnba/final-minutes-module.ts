
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FinalMinutesModule extends BaseAlertModule {
  alertType = 'FINAL_MINUTES';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    return gameState.quarter === 4 && 
           this.parseTimeToSeconds(gameState.timeRemaining) <= 60 &&
           this.parseTimeToSeconds(gameState.timeRemaining) > 0 &&
           Math.abs(gameState.homeScore - gameState.awayScore) <= 10;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeRemaining = gameState.timeRemaining;
    
    return {
      alertKey: `${gameState.gameId}_final_minutes_${timeRemaining.replace(/[:\s]/g, '')}`,
      type: this.alertType,
      message: `⏰ WNBA FINAL MINUTE! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left`,
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
      priority: scoreDiff <= 3 ? 95 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 90 : 0;
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
