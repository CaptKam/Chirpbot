
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class HighScoringModule extends BaseAlertModule {
  alertType = 'HIGH_SCORING';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    const totalRuns = gameState.homeScore + gameState.awayScore;
    return totalRuns >= 12 && gameState.inning >= 6;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const totalRuns = gameState.homeScore + gameState.awayScore;
    
    return {
      alertKey: `${gameState.gameId}_HIGH_SCORING_${gameState.inning}`,
      type: this.alertType,
      message: `🔥 High-Scoring Game! ${totalRuns} total runs`,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        totalRuns
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const totalRuns = gameState.homeScore + gameState.awayScore;
    let probability = 75;
    
    if (totalRuns >= 15) probability += 10;
    if (totalRuns >= 18) probability += 10;
    
    return Math.min(probability, 95);
  }
}
