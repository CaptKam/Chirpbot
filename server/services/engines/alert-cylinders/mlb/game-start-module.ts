
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class MLBGameStartModule extends BaseAlertModule {
  alertType = 'MLB_GAME_START';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger when game starts (status changes to 'in' and inning is 1st, top half)
    return gameState.status === 'in' && 
           gameState.inning === 1 && 
           gameState.topBottom === 'top';
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `mlb-game-start-${gameState.gameId}`,
      type: this.alertType,
      message: `⚾ First Pitch: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        inning: gameState.inning,
        topBottom: gameState.topBottom
      },
      priority: 3
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
