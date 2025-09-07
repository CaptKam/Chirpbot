
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SecondAndThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_SECOND_AND_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: 2nd + 3rd, 0 outs (~85% scoring probability)
    return !hasFirst && hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_second_third_no_outs`,
      type: this.alertType,
      message: `🔥 HIGH SCORING PROBABILITY: Runners on 2nd & 3rd, 0 outs - 85% chance to score!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: false,
        hasSecond: true,
        hasThird: true,
        outs: 0,
        scenarioName: 'Runners on 2nd & 3rd',
        scoringProbability: 85
      },
      priority: 96
    };
  }

  calculateProbability(): number {
    return 85;
  }
}
