
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'TWO_MINUTE_WARNING';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Trigger when approaching 2:00 mark in 2nd or 4th quarter
    if (gameState.status !== 'in') return false;
    if (!gameState.timeRemaining) return false;
    
    const [minutes, seconds] = gameState.timeRemaining.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    
    return (gameState.quarter === 2 || gameState.quarter === 4) && 
           totalSeconds <= 120 && totalSeconds > 110;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const half = gameState.quarter === 2 ? '1st Half' : '4th Quarter';
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const situation = scoreDiff <= 7 ? 'Close Game' : scoreDiff <= 14 ? 'Two Score Game' : 'Blowout';

    return {
      alertKey: `two-minute-warning-${gameState.gameId}-q${gameState.quarter}`,
      type: this.alertType,
      message: `⏰ Two-Minute Warning: ${half} - ${situation}`,
      context: {
        gameId: gameState.gameId,
        quarter: gameState.quarter,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        scoreDifference: scoreDiff,
        timeRemaining: gameState.timeRemaining
      },
      priority: 3
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
