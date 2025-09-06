
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BlowoutModule extends BaseAlertModule {
  alertType = 'BLOWOUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return scoreDiff >= 8 && gameState.inning >= 5;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    
    return {
      alertKey: `${gameState.gameId}_BLOWOUT_${gameState.inning}`,
      type: this.alertType,
      message: `📈 Blowout Game! ${leadingTeam} leads by ${scoreDiff} runs`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        scoreDifference: scoreDiff,
        leadingTeam
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    let probability = 70;
    
    if (scoreDiff >= 10) probability += 15;
    else if (scoreDiff >= 12) probability += 20;
    
    return Math.min(probability, 95);
  }
}
