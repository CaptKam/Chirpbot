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

    // Must be within 2 minutes
    const withinTwoMins = this.isWithinTwoMinutes(gameState.timeRemaining);
    if (!withinTwoMins) {
      console.log(`❌ Two Minute: Not within 2 minutes (${gameState.timeRemaining})`);
      return false;
    }

    // Must be a competitive game (within 3 touchdowns for college football)
    const isCompetitive = this.isCompetitiveGame(gameState);
    if (!isCompetitive) {
      console.log(`❌ Two Minute: Game not competitive (${gameState.homeScore}-${gameState.awayScore})`);
      return false;
    }

    console.log(`🎯 NCAAF Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const isHalftime = gameState.quarter === 2;
    const isEndOfGame = gameState.quarter === 4;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    // Determine priority and message based on game situation
    let priority = 80;
    let emoji = '⏱️';
    let message = '';

    if (isEndOfGame) {
      if (scoreDiff <= 3) {
        // Field goal game
        priority = 95;
        emoji = '🚨';
        message = `${emoji} NCAAF CRUNCH TIME! ${this.getScoreDisplay(gameState)} - ${gameState.timeRemaining} left in 4th quarter!`;
      } else if (scoreDiff <= 7) {
        // One touchdown game
        priority = 90;
        emoji = '⏰';
        message = `${emoji} NCAAF Final Two Minutes! ${this.getScoreDisplay(gameState)} - ${gameState.timeRemaining} remaining!`;
      } else {
        // Competitive but not super close
        priority = 85;
        emoji = '⏱️';
        message = `${emoji} NCAAF Two Minutes Left! ${this.getScoreDisplay(gameState)} - ${gameState.timeRemaining} in 4th quarter`;
      }
    } else {
      // Halftime approaching
      priority = 80;
      emoji = '⏱️';
      message = `${emoji} NCAAF Halftime Approaching! ${this.getScoreDisplay(gameState)} - ${gameState.timeRemaining} left in 2nd quarter`;
    }

    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}_${timeSeconds}`,
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
        scoreDiff,
        isHalftime,
        isEndOfGame,
        isCompetitive: scoreDiff <= 21,
        gamePhase: isHalftime ? 'APPROACHING_HALFTIME' : 'FINAL_MINUTES'
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 70; // Base probability for two-minute situations

    // Higher probability for end of game vs halftime
    if (gameState.quarter === 4) {
      probability += 20;
    } else {
      probability += 10;
    }

    // Adjust for how close the game is
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) probability += 15; // Field goal game
    else if (scoreDiff <= 7) probability += 10; // One touchdown
    else if (scoreDiff <= 14) probability += 5; // Two touchdowns

    // Time factor - closer to end = higher probability
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    if (timeSeconds <= 60) probability += 10; // Final minute

    return Math.min(probability, 100);
  }

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      return totalSeconds <= 120 && totalSeconds > 0; // 2 minutes = 120 seconds
    } catch (error) {
      return false;
    }
  }

  private isCompetitiveGame(gameState: GameState): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    // For college football, games within 3 touchdowns (21 points) are still interesting
    return scoreDiff <= 21;
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