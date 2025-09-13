import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class CFLFourthQuarterModule extends BaseAlertModule {
  alertType = 'CFL_FOURTH_QUARTER';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           gameState.quarter === 4 && 
           gameState.timeRemaining === '15:00';
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isCloseGame = scoreDiff <= 7; // One touchdown game in CFL
    const intensityLevel = isCloseGame ? 'CRUCIAL' : 'INTENSE';
    
    return {
      alertKey: `${gameState.gameId}_cfl_fourth_quarter`,
      type: this.alertType,
      message: `🏈 CFL ${intensityLevel} FOURTH QUARTER! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Final quarter begins!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDiff,
        isCloseGame,
        intensityLevel,
        // CFL-specific context
        isCFLGame: true,
        threeDownSystem: true,
        greyCapImplications: scoreDiff <= 14 // Could impact playoff positioning
      },
      priority: isCloseGame ? 90 : 80
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const baseProb = 100; // Always triggered when conditions met
    
    // CFL-specific adjustments for Canadian football
    let adjustedProb = baseProb;
    if (scoreDiff <= 3) adjustedProb += 10; // Field goal game
    else if (scoreDiff <= 7) adjustedProb += 5; // One touchdown game
    
    return Math.min(adjustedProb, 100);
  }
}