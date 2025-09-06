
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class CloseGameModule extends BaseAlertModule {
  alertType = 'CLOSE_GAME';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Game is close if score difference is 3 runs or less
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return scoreDiff <= 3 && gameState.inning >= 7; // Only late in game
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const alertKey = `${gameState.gameId}_MLB_CLOSE_GAME_${gameState.inning}`;
    const message = `🔥 Close Game! ${scoreDiff} run difference in inning ${gameState.inning}`;

    return {
      alertKey,
      type: this.alertType,
      message,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        scoreDifference: scoreDiff,
        isCloseGame: true
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    let probability = 80; // Base close game probability
    
    // Closer = higher probability
    if (scoreDiff === 0) probability += 15; // Tied game
    else if (scoreDiff === 1) probability += 10;
    else if (scoreDiff === 2) probability += 5;
    
    // Later in game = higher probability
    if (gameState.inning >= 9) probability += 10;
    else if (gameState.inning === 8) probability += 5;
    
    return Math.min(Math.max(probability, 70), 95);
  }
}
