import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RougeOpportunityModule extends BaseAlertModule {
  alertType = 'CFL_ROUGE_OPPORTUNITY';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    // Rouge opportunity: 3rd down within field goal range (CFL-specific)
    // Missed field goal through end zone = 1 point (rouge/single)
    return gameState.status === 'live' && 
           gameState.down === 3 && 
           gameState.fieldPosition !== undefined &&
           gameState.fieldPosition <= 45 && // Within reasonable FG range for rouge
           gameState.yardsToGo !== undefined &&
           gameState.yardsToGo >= 8; // Long yardage makes FG attempt likely
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const distance = gameState.fieldPosition ? 
      `${gameState.fieldPosition + 10}` : // Add 10 for end zone depth
      "unknown";

    return {
      alertKey: `${gameState.gameId}_rouge_opportunity_q${gameState.quarter}`,
      type: this.alertType,
      message: `⚡ CFL Rouge Opportunity: ${distance}-yard FG attempt possible - Even a miss can score 1 point!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        scoreDiff: Math.abs(gameState.homeScore - gameState.awayScore),
        estimatedFGDistance: gameState.fieldPosition ? gameState.fieldPosition + 10 : null
      },
      priority: 82 // Unique to CFL, important strategic element
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}