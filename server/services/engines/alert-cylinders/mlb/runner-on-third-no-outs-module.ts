
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RunnerOnThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Runner on 3rd, 0 outs (~84% scoring probability)
    return !hasFirst && !hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_runner_third_no_outs`,
      type: this.alertType,
      message: `🔥 HIGH SCORING PROBABILITY: Runner on 3rd, 0 outs - 84% chance to score!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: false,
        hasSecond: false,
        hasThird: true,
        outs: 0,
        scenarioName: 'Runner on 3rd',
        scoringProbability: 84
      },
      priority: 95
    };
  }

  calculateProbability(): number {
    return 84;
  }
}
