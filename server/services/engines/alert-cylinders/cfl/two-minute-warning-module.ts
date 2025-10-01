
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'CFL_TWO_MINUTE_WARNING';
  sport = 'CFL';

  private isExactlyThreeMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // Allow for 5-second window around exactly 3:00 (175-185 seconds)
      return totalSeconds >= 175 && totalSeconds <= 185;
    } catch (error) {
      return false;
    }
  }

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 CFL Three Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);

    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Three Minute: Game not live (${gameState.status})`);
      return false;
    }

    // Must be in 2nd or 4th quarter (end of half situations)
    if (gameState.quarter !== 2 && gameState.quarter !== 4) {
      console.log(`❌ Three Minute: Wrong quarter (Q${gameState.quarter})`);
      return false;
    }

    // Must be exactly at 3:00 remaining (within 5 second window)
    const exactlyThreeMinutes = this.isExactlyThreeMinutes(gameState.timeRemaining);
    if (!exactlyThreeMinutes) {
      console.log(`❌ Three Minute: Not exactly 3:00 remaining (${gameState.timeRemaining})`);
      return false;
    }

    console.log(`🎯 CFL Three Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const isFirstHalf = gameState.quarter === 2;
    const halfText = isFirstHalf ? '1st Half' : '2nd Half';
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    const message = `⏰ Three Minutes Remaining in the ${halfText}! ${this.getScoreDisplay(gameState)}`;
    
    return {
      alertKey: `${gameState.gameId}_three_minute_warning_q${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        timeSeconds,
        halfText,
        isFirstHalf,
        threeMinuteWarning: true
      },
      priority: 88
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 95; // High probability since it's exactly at 3:00 mark
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
