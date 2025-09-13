
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SecondAndThirdOneOutModule extends BaseAlertModule {
  alertType = 'MLB_SECOND_AND_THIRD_ONE_OUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: 2nd + 3rd, 1 out (~68% scoring probability)
    return !hasFirst && hasSecond && hasThird && outs === 1;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_second_third_one_out`,
      type: this.alertType,
      message: `⚡ CRITICAL SITUATION | ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore}) | Runners on 2nd & 3rd, 1 OUT | 68% scoring edge | Sac fly scores | Wild pitch scores 2 | CLUTCH AB`,
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
        outs: 1,
        scenarioName: 'Runners on 2nd & 3rd',
        scoringProbability: 68
      },
      priority: 77
    };
  }

  calculateProbability(): number {
    return 68;
  }
}
