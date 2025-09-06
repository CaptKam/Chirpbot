
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RISPModule extends BaseAlertModule {
  alertType = 'RISP';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Check if runners are in scoring position (2nd or 3rd base)
    return gameState.hasSecond || gameState.hasThird;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { hasSecond, hasThird, outs, inning } = gameState;
    const runners = [];
    if (hasSecond) runners.push('2nd');
    if (hasThird) runners.push('3rd');
    
    const alertKey = `${gameState.gameId}_MLB_RISP_${inning}_${outs}`;
    const message = `⚾ RUNNERS IN SCORING POSITION! ${runners.join(' & ')} base, ${outs} out${outs !== 1 ? 's' : ''}`;

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
        hasSecond,
        hasThird,
        scoringPosition: true
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 70; // Base RISP probability
    
    // Adjust for outs
    if (gameState.outs === 0) probability += 15;
    else if (gameState.outs === 1) probability += 5;
    else if (gameState.outs === 2) probability -= 10;
    
    // Adjust for inning
    if (gameState.inning >= 7) probability += 10; // Late game pressure
    
    // Both 2nd and 3rd base
    if (gameState.hasSecond && gameState.hasThird) probability += 10;
    
    return Math.min(Math.max(probability, 10), 95);
  }
}
