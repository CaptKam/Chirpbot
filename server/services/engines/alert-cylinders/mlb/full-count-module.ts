
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FullCountModule extends BaseAlertModule {
  alertType = 'FULL_COUNT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // 3-2 count (3 balls, 2 strikes)
    const triggered = gameState.balls === 3 && gameState.strikes === 2;
    console.log(`🔍 FULL_COUNT check: balls=${gameState.balls}, strikes=${gameState.strikes} → ${triggered}`);
    return triggered;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { outs, inning } = gameState;
    const alertKey = `${gameState.gameId}_FULL_COUNT_${inning}_${outs}`;
    const message = `⚾ FULL COUNT! 3-2 count, ${outs} out${outs !== 1 ? 's' : ''} - Maximum pressure!`;

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
        balls: gameState.balls,
        strikes: gameState.strikes,
        fullCount: true
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 70; // Base full count probability
    
    // Adjust for outs
    if (gameState.outs === 2) probability += 15; // Two out pressure
    else if (gameState.outs === 1) probability += 10;
    else probability += 5;
    
    // Late game situations
    if (gameState.inning >= 7) probability += 10;
    
    // Runners on base adds pressure
    if (gameState.hasFirst || gameState.hasSecond || gameState.hasThird) {
      probability += 5;
    }
    
    return Math.min(Math.max(probability, 60), 90);
  }
}
