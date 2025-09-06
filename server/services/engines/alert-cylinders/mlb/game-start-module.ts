
import { BaseAlertModule, GameState, AlertResult } from '../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'GAME_START';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger when game starts (inning 1, top, no score yet)
    return gameState.inning === 1 && 
           gameState.isTopInning && 
           gameState.homeScore === 0 && 
           gameState.awayScore === 0 &&
           gameState.outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_GAME_START`,
      type: this.alertType,
      message: `🚨 Game Starting: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
