
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class HighScoringQuarterModule extends BaseAlertModule {
  alertType = 'HIGH_SCORING_QUARTER';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    const totalScore = gameState.homeScore + gameState.awayScore;
    return gameState.quarter >= 2 && totalScore >= 40;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const totalScore = gameState.homeScore + gameState.awayScore;
    
    return {
      alertKey: `${gameState.gameId}_high_scoring_quarter_${gameState.quarter}`,
      type: this.alertType,
      message: `🔥 HIGH-SCORING WNBA QUARTER! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${totalScore} combined points`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        totalScore
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 75 : 0;
  }
}
