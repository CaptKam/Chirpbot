
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'WNBA_TWO_MINUTE_WARNING';
  sport = 'WNBA';

  private isExactlyTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // Allow for 10-second window around exactly 2:00 (115-125 seconds)
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

    // Must be exactly at 2:00 remaining (within 10 second window)
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
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}`,
      type: this.alertType,
      message: `⏱️ WNBA Two Minute Warning: ${gameState.awayTeam} @ ${gameState.homeTeam} | ${this.getScoreDisplay(gameState)}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        timeSeconds,
        scoreDiff,
        twoMinuteWarning: true
      },
      priority: 88
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 95; // High probability since it's exactly at 2:00 mark
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;

    try {
      const [minutes, seconds] = timeString.split(':').map(Number);
      return (minutes * 60) + seconds;
    } catch (error) {
      return 0;
    }
  }

  private getScoreDisplay(gameState: GameState): string {
    if (gameState.homeScore === gameState.awayScore) {
      return `Tied ${gameState.homeScore}-${gameState.awayScore}`;
    }

    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    const leadingScore = Math.max(gameState.homeScore, gameState.awayScore);
    const trailingScore = Math.min(gameState.homeScore, gameState.awayScore);

    return `${leadingTeam} leads ${leadingScore}-${trailingScore}`;
  }
}
