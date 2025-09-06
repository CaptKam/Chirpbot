
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ShutoutModule extends BaseAlertModule {
  alertType = 'SHUTOUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    return (gameState.homeScore === 0 || gameState.awayScore === 0) && gameState.inning >= 7;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const shutoutTeam = gameState.homeScore === 0 ? gameState.homeTeam : gameState.awayTeam;
    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    
    return {
      alertKey: `${gameState.gameId}_SHUTOUT_${gameState.inning}`,
      type: this.alertType,
      message: `⭕ Shutout Alert! ${shutoutTeam} held scoreless through ${gameState.inning} innings`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        shutoutTeam,
        leadingTeam
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 80;
    
    if (gameState.inning >= 8) probability += 10;
    if (gameState.inning >= 9) probability += 5;
    
    return Math.min(probability, 95);
  }
}
