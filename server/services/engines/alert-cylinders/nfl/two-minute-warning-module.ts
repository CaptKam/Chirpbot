
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NFL_TWO_MINUTE_WARNING';
  sport = 'NFL';

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    const [minutes, seconds] = timeRemaining.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds <= 120; // 2 minutes = 120 seconds
  }

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           (gameState.quarter === 2 || gameState.quarter === 4) &&
           this.isWithinTwoMinutes(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const halfText = gameState.quarter === 2 ? 'First Half' : 'Game';
    
    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}`,
      type: this.alertType,
      message: `⏱️ Two Minute Warning - ${halfText}: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
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
