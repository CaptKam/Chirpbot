
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RunnerOnThirdOneOutModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_THIRD_ONE_OUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Runner on 3rd, 1 out (~66% scoring probability)
    return !hasFirst && !hasSecond && hasThird && outs === 1;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_runner_third_one_out`,
      type: this.alertType,
      message: `⚡ ${gameState.awayTeam} @ ${gameState.homeTeam}: Runner on 3rd, 1 out - 66% scoring chance!`,
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
        outs: 1,
        scenarioName: 'Runner on 3rd',
        scoringProbability: 66
      },
      priority: 75
    };
  }

  calculateProbability(): number {
    return 66;
  }
}
