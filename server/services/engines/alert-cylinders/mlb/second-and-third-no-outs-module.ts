
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SecondAndThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_SECOND_AND_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: 2nd + 3rd, 0 outs (~85% scoring probability)
    return !hasFirst && hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_second_third_no_outs`,
      type: this.alertType,
      message: `Runners on 2nd & 3rd, no outs | 85% multi-run potential | Sacrifice fly minimum | Infield hit scores 2`,
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
