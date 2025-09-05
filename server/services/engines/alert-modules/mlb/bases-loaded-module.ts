
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BasesLoadedModule extends BaseAlertModule {
  alertType = 'BASES_LOADED';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // All three bases must be occupied
    return gameState.hasFirst && gameState.hasSecond && gameState.hasThird;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { outs, inning } = gameState;
    const alertKey = `${gameState.gameId}_MLB_BASES_LOADED_${inning}_${outs}`;
    const message = `⚾ BASES LOADED! ${outs} out${outs !== 1 ? 's' : ''} - Maximum scoring potential!`;

    return {
      alertKey,
      type: this.alertType,
      message,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning,
        outs,
        hasFirst: gameState.hasFirst,
        hasSecond: gameState.hasSecond,
        hasThird: gameState.hasThird,
        basesLoaded: true
      },
      priority: 95
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 85; // Base bases loaded probability
    
    // Adjust for outs - bases loaded is always high value
    if (gameState.outs === 0) probability += 10;
    else if (gameState.outs === 1) probability += 5;
    else if (gameState.outs === 2) probability -= 5; // Still valuable with 2 outs
    
    // Late game situation
    if (gameState.inning >= 7) probability += 5;
    
    return Math.min(Math.max(probability, 75), 95);
  }
}
