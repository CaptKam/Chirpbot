
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'WNBA_TWO_MINUTE_WARNING';
  sport = 'WNBA';

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    const [minutes, seconds] = timeRemaining.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds <= 120; // 2 minutes = 120 seconds
  }

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           gameState.quarter === 4 &&
           this.isWithinTwoMinutes(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_two_minute_warning`,
      type: this.alertType,
      message: `⏱️ WNBA Final Two Minutes: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDiff: Math.abs(gameState.homeScore - gameState.awayScore)
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
