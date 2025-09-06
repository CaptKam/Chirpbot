
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class NFLGameStartModule extends BaseAlertModule {
  alertType = 'NFL_GAME_START';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Trigger when game starts (status changes to 'in' and quarter is 1)
    return gameState.status === 'in' && 
           gameState.quarter === 1 && 
           gameState.timeRemaining && 
           gameState.timeRemaining.includes('15:00');
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `nfl-game-start-${gameState.gameId}`,
      type: this.alertType,
      message: `🏈 Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
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
