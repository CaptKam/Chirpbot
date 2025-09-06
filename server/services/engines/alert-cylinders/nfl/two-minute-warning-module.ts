import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'TWO_MINUTE_WARNING';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Trigger in 2nd or 4th quarter with exactly 2:00 remaining
    if (![2, 4].includes(gameState.quarter)) return false;

    const timeRemaining = gameState.timeRemaining;
    if (!timeRemaining) return false;

    // Check for official two-minute warning (exactly 2:00)
    return timeRemaining === '2:00' || timeRemaining === '02:00';
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