
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BasesLoadedNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_BASES_LOADED_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Bases loaded, 0 outs (~86% scoring probability)
    return hasFirst && hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_bases_loaded_no_outs`,
      type: this.alertType,
      message: `🔥 HIGH SCORING PROBABILITY: Bases Loaded, 0 outs - 86% chance to score!`,
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
        hasThird: true,
        outs: 0,
        scenarioName: 'Bases Loaded',
        scoringProbability: 86
      },
      priority: 97
    };
  }

  calculateProbability(): number {
    return 86;
  }
}
