
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BasesLoadedOneOutModule extends BaseAlertModule {
  alertType = 'MLB_BASES_LOADED_ONE_OUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Bases loaded, 1 out (~66% scoring probability)
    return hasFirst && hasSecond && hasThird && outs === 1;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_bases_loaded_one_out`,
      type: this.alertType,
      message: `⚡ ${gameState.awayTeam} @ ${gameState.homeTeam}: Bases Loaded, 1 out - 66% scoring chance!`,
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
        outs: 1,
        scenarioName: 'Bases Loaded',
        scoringProbability: 66
      },
      priority: 75
    };
  }

  calculateProbability(): number {
    return 66;
  }
}
