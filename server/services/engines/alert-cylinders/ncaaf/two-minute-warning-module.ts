
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class NCAAFTwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NCAAF_TWO_MINUTE_WARNING';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    // College football doesn't have official two-minute warning, but trigger for crunch time
    if (![2, 4].includes(gameState.quarter)) return false;
    
    const timeRemaining = gameState.timeRemaining;
    if (!timeRemaining) return false;
    
    // Parse time like "2:00" or "1:45"
    const [minutes, seconds] = timeRemaining.split(':').map(Number);
    const totalSeconds = (minutes * 60) + seconds;
    
    return totalSeconds <= 120 && totalSeconds > 110; // Trigger in 2:00-1:50 range
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isClose = scoreDiff <= 14; // Touchdown + conversion
    const quarterName = gameState.quarter === 2 ? 'Half' : 'Game';

    return {
      alertKey: `ncaaf-two-minute-warning-${gameState.gameId}`,
      type: this.alertType,
      message: `⏰ College ${quarterName} Crunch Time: ${gameState.timeRemaining}${isClose ? ' - Close Game!' : ''}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        scoreDifference: scoreDiff
      },
      priority: isClose ? 4 : 3
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
