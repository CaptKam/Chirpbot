
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class Runners1st2ndModule extends BaseAlertModule {
  alertType = 'RUNNERS_1ST_2ND';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Runners on 1st and 2nd base
    return gameState.hasFirst && gameState.hasSecond && !gameState.hasThird;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { outs, inning } = gameState;
    const alertKey = `${gameState.gameId}_MLB_RUNNERS_1ST_2ND_${inning}_${outs}`;
    const message = `⚾ Runners on 1st & 2nd! ${outs} out${outs !== 1 ? 's' : ''} - Prime scoring opportunity!`;

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
        scoringOpportunity: true
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 75; // Base runners on 1st and 2nd probability
    
    // Adjust for outs
    if (gameState.outs === 0) probability += 15;
    else if (gameState.outs === 1) probability += 10;
    else if (gameState.outs === 2) probability += 5; // Still good chance with 2 outs
    
    // Late game situation
    if (gameState.inning >= 7) probability += 5;
    
    return Math.min(Math.max(probability, 60), 90);
  }
}
