
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'WNBA_TWO_MINUTE_WARNING';
  sport = 'WNBA';

  private isExactlyTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // Use same tight window as working CFL/NBA modules (115-125 seconds = 10-second window around 2:00)
      return totalSeconds >= 115 && totalSeconds <= 125;
    } catch (error) {
      return false;
    }
  }

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 WNBA Two Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);

    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Two Minute: Game not live (${gameState.status})`);
      return false;
    }

    // Must be in 4th quarter
    if (gameState.quarter !== 4) {
      console.log(`❌ Two Minute: Wrong quarter (Q${gameState.quarter})`);
      return false;
    }

    // Must be exactly at 2:00 remaining (within 10-second window like working modules)
    const exactlyTwoMinutes = this.isExactlyTwoMinutes(gameState.timeRemaining);
    if (!exactlyTwoMinutes) {
      console.log(`❌ Two Minute: Not exactly 2:00 remaining (${gameState.timeRemaining})`);
      return false;
    }

    console.log(`🎯 WNBA Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}`,
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
