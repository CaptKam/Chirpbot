import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { cleanAlertFormatter } from '../../../clean-alert-formatter';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NCAAF_TWO_MINUTE_WARNING';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Two Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);

    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Two Minute: Game not live (${gameState.status})`);
      return false;
    }

    // Must be in 2nd or 4th quarter (end of half situations)
    if (gameState.quarter !== 2 && gameState.quarter !== 4) {
      console.log(`❌ Two Minute: Wrong quarter (Q${gameState.quarter})`);
      return false;
    }

    // RELAXED: Must be under 2:30 remaining (instead of exactly 2:00)
    const underTwoThirty = this.isUnderTwoThirty(gameState.timeRemaining);
    if (!underTwoThirty) {
      console.log(`❌ Two Minute: Not under 2:30 remaining (${gameState.timeRemaining})`);
      return false;
    }

    console.log(`🎯 NCAAF Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const isFirstHalf = gameState.quarter === 2;
    const halfText = isFirstHalf ? '1st Half' : '2nd Half';
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | TWO MINUTE WARNING`,
      displayMessage: cleanAlertFormatter.format({
        type: this.alertType,
        sport: this.sport,
        gameState: gameState,
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
          twoMinuteWarning: true
        },
        riskReward: {
          probability: 95
        }
      }).primary,
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
        twoMinuteWarning: true
      },
      priority: 88
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 95; // High probability since it's exactly at 2:00 mark
  }

  private isUnderTwoThirty(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // RELAXED: Trigger when under 2:30 (150 seconds)
      return totalSeconds <= 150 && totalSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  private isExactlyTwoMinutes(timeRemaining: string): boolean {
    return this.isUnderTwoThirty(timeRemaining); // Use relaxed version
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