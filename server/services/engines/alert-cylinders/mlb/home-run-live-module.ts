
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class HomeRunLiveModule extends BaseAlertModule {
  alertType = 'HOME_RUN_LIVE';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // This would need live play data to detect home runs
    // For now, return false as we need additional data
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_HOME_RUN_LIVE`,
      type: this.alertType,
      message: `⚾ HOME RUN! Live home run hit!`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning
      },
      priority: 90
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 95 : 0;
  }
}
