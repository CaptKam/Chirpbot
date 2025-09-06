
import { BaseAlertModule, GameState, AlertResult } from '../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'GAME_START';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.quarter === 1 && 
           gameState.homeScore === 0 && 
           gameState.awayScore === 0 &&
           gameState.timeRemaining && 
           gameState.timeRemaining.includes('15:00');
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_GAME_START`,
      type: this.alertType,
      message: `🍁 Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
