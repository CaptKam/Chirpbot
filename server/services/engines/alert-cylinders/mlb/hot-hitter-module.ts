
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class HotHitterModule extends BaseAlertModule {
  alertType = 'HOT_HITTER';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Check if current batter has home runs today
    return gameState.batter && gameState.batter.homeRunsToday > 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { batter, inning } = gameState;
    const alertKey = `${gameState.gameId}_HOT_HITTER_${batter.id}_${inning}`;
    const message = `⚾ HOT HITTER! ${batter.name} (${batter.homeRunsToday} HR today) at bat`;

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
        batter,
        hotHitter: true
      },
      priority: 70
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 65; // Base hot hitter probability
    
    // More home runs today = higher probability
    const homeRuns = gameState.batter?.homeRunsToday || 0;
    probability += Math.min(homeRuns * 10, 20); // Cap at +20
    
    // Late game situations
    if (gameState.inning >= 7) probability += 5;
    
    // Favorable count
    if (gameState.balls > gameState.strikes) probability += 5;
    
    return Math.min(Math.max(probability, 50), 85);
  }
}
