
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class WNBAGameStartModule extends BaseAlertModule {
  alertType = 'WNBA_GAME_START';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    // Trigger when game starts (status changes to 'in' and quarter is 1)
    return gameState.status === 'in' && 
           gameState.quarter === 1 && 
           gameState.timeRemaining && 
           gameState.timeRemaining.includes('12:00');
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `wnba-game-start-${gameState.gameId}`,
      type: this.alertType,
      message: `🏀 Tip-off: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
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
