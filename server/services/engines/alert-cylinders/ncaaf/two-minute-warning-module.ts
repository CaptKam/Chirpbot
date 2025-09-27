import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


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
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${this.createDynamicMessage(gameState, halfText)}`,
      displayMessage: `🏈 ${this.createDynamicMessage(gameState, halfText)} | Q${gameState.quarter}`,

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

  private createDynamicMessage(gameState: GameState, halfText: string): string {
    const timeRemaining = gameState.timeRemaining;
    const quarter = gameState.quarter;
    const possession = gameState.possession;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    // Create contextual two-minute warning message
    if (quarter === 2) {
      // First half - focus on halftime approach
      if (scoreDiff === 0) {
        return `2:00 warning - Tied game approaching halftime`;
      } else if (scoreDiff <= 7) {
        return `2:00 warning - Close game approaching halftime`;
      } else {
        return `2:00 warning - ${halfText} final drive`;
      }
    } else if (quarter === 4) {
      // Fourth quarter - more critical
      if (possession) {
        if (scoreDiff === 0) {
          return `2:00 warning - ${possession} driving, tied game`;
        } else if (scoreDiff <= 3) {
          return `2:00 warning - ${possession} driving, ${scoreDiff}-pt game`;
        } else {
          return `2:00 warning - ${possession} driving in crucial situation`;
        }
      } else {
        if (scoreDiff === 0) {
          return `2:00 warning - Tied game, final two minutes`;
        } else if (scoreDiff <= 7) {
          return `2:00 warning - ${scoreDiff}-pt game, crunch time`;
        } else {
          return `2:00 warning - Critical final two minutes`;
        }
      }
    } else {
      // Fallback
      return `2:00 warning - ${halfText} final two minutes`;
    }
  }
}