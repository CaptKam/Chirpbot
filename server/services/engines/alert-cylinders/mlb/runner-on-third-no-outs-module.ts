
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RunnerOnThirdNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_THIRD_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Runner on 3rd, 0 outs (~84% scoring probability)
    return !hasFirst && !hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    return {
      alertKey: `${gameState.gameId}_runner_third_no_outs`,
      type: this.alertType,
      message: `🚨 PRIME SCORING POSITION | ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore}) | Runner on 3rd, NO OUTS | 84% scoring probability | Multiple ways to score | OVER bets spiking | ACT NOW`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst || false,
        hasSecond: gameState.hasSecond || false,
        hasThird: gameState.hasThird || true,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
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
