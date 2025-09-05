
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class NCAAFGameStartModule extends BaseAlertModule {
  alertType = 'NCAAF_GAME_START';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'in' && 
           gameState.quarter === 1 && 
           gameState.timeRemaining && 
           gameState.timeRemaining.includes('15:00');
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `ncaaf-game-start-${gameState.gameId}`,
      type: this.alertType,
      message: `🏈 College Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        quarter: gameState.quarter
      },
      priority: 3
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
