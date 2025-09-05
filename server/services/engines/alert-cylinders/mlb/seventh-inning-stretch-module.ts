
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SeventhInningStretchModule extends BaseAlertModule {
  alertType = 'MLB_SEVENTH_INNING_STRETCH';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger at the bottom of the 7th inning (traditional stretch time)
    return gameState.status === 'in' && 
           gameState.inning === 7 && 
           gameState.topBottom === 'bottom';
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `mlb-seventh-stretch-${gameState.gameId}`,
      type: this.alertType,
      message: `🎵 7th Inning Stretch: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        inning: gameState.inning,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore
      },
      priority: 2
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
