import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ThirdDownSituationModule extends BaseAlertModule {
  alertType = 'CFL_THIRD_DOWN_SITUATION';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    // Third down is critical in CFL's 3-down system
    return gameState.status === 'live' && 
           gameState.down === 3 && 
           gameState.quarter >= 2; // More significant from 2nd quarter onward
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const yardageText = gameState.yardsToGo 
      ? gameState.yardsToGo <= 3 
        ? "short yardage" 
        : `${gameState.yardsToGo} yards`
      : "unknown distance";
    
    const fieldPosText = gameState.fieldPosition 
      ? gameState.fieldPosition <= 20 
        ? "in the red zone" 
        : `at the ${gameState.fieldPosition}`
      : "";

    return {
      alertKey: `${gameState.gameId}_third_down_q${gameState.quarter}`,
      type: this.alertType,
      message: `🚨 CFL Third Down: ${yardageText} ${fieldPosText} - Crucial moment in 3-down system!`,
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
        scoreDiff: Math.abs(gameState.homeScore - gameState.awayScore)
      },
      priority: 88 // High priority due to CFL 3-down system criticality
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}