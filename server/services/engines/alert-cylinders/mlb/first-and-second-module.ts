import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FirstAndSecondModule extends BaseAlertModule {
  alertType = 'MLB_FIRST_AND_SECOND';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: 1st + 2nd, any outs (58-68% scoring probability depending on outs)
    return hasFirst && hasSecond && !hasThird && outs < 3;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const scoringProb = gameState.outs === 0 ? 68 : gameState.outs === 1 ? 58 : 42;
    const priority = gameState.outs === 0 ? 75 : gameState.outs === 1 ? 65 : 55;

    return {
      alertKey: `${gameState.gameId}_first_second_${gameState.outs}_out`,
      type: this.alertType,
      message: `🚨 SCORING POSITION | ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore}) | Runners on 1st & 2nd, ${gameState.outs} OUT${gameState.outs !== 1 ? 'S' : ''} | ${scoringProb}% scoring edge | Double scores 2 | Single scores 1`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: true,
        hasSecond: true,
        hasThird: false,
        outs: gameState.outs,
        scenarioName: 'Runners on 1st & 2nd',
        scoringProbability: scoringProb
      },
      priority
    };
  }

  calculateProbability(): number {
    return 58; // Average probability across different out scenarios
  }
}