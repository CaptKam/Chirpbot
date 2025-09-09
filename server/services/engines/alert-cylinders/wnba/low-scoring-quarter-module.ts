
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class LowScoringQuarterModule extends BaseAlertModule {
  alertType = 'LOW_SCORING_QUARTER';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    const totalScore = gameState.homeScore + gameState.awayScore;
    return gameState.quarter >= 3 && totalScore <= 15;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const totalScore = gameState.homeScore + gameState.awayScore;
    
    return {
      alertKey: `${gameState.gameId}_low_scoring_quarter_${gameState.quarter}`,
      type: this.alertType,
      message: `🐌 LOW-SCORING WNBA GAME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Only ${totalScore} combined points`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        totalScore
      },
      priority: 70
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 65 : 0;
  }
}
