
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FirstAndThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_FIRST_AND_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: 1st + 3rd, 0 outs (~86% scoring probability)
    return hasFirst && !hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_first_third_no_outs`,
      type: this.alertType,
      message: `🔥 HIGH SCORING PROBABILITY: Runners on 1st & 3rd, 0 outs - 86% chance to score!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst,
        hasSecond: gameState.hasSecond,
        hasThird: gameState.hasThird,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
        scenarioName: 'Runners on 1st & 3rd',
        scoringProbability: 86
      },
      priority: 97
    };
  }

  calculateProbability(): number {
    return 86;
  }
}
