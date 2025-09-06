
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class StrikeoutModule extends BaseAlertModule {
  alertType = 'STRIKEOUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // This would need live play-by-play data to detect strikeouts
    // For now, return false as we need additional data
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_STRIKEOUT`,
      type: this.alertType,
      message: `⚡ Strikeout! Batter struck out`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning
      },
      priority: 70
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 85 : 0;
  }
}
