
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TestAlertModule extends BaseAlertModule {
  alertType = 'TEST_ALERT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Always trigger for any live game
    return gameState.isLive || gameState.homeScore > 0 || gameState.awayScore > 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const alertKey = `${gameState.gameId}_TEST_ALERT`;
    const message = `🧪 Test Alert: ${gameState.awayTeam} ${gameState.awayScore}-${gameState.homeScore} ${gameState.homeTeam}`;

    return {
      alertKey,
      type: this.alertType,
      message,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        isTest: true
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return 75; // Fixed probability for test alerts
  }
}
