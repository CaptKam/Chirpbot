
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class PowerHitterModule extends BaseAlertModule {
  alertType = 'POWER_HITTER';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Check if current batter has 20+ home runs this season
    return gameState.currentBatter?.homeRuns >= 20;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const batter = gameState.currentBatter;
    if (!batter) return null;

    const { outs, inning } = gameState;
    const alertKey = `${gameState.gameId}_MLB_POWER_HITTER_${batter.id}_${inning}_${outs}`;
    const message = `💪 POWER HITTER! ${batter.name} (${batter.homeRuns} HRs) at bat!`;

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
        batter: {
          name: batter.name,
          homeRuns: batter.homeRuns,
          battingAverage: batter.battingAverage
        },
        powerHitter: true
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const batter = gameState.currentBatter;
    if (!batter) return 0;
    
    let probability = 60; // Base power hitter probability
    
    // More home runs = higher probability
    if (batter.homeRuns >= 40) probability += 20;
    else if (batter.homeRuns >= 30) probability += 15;
    else if (batter.homeRuns >= 25) probability += 10;
    else if (batter.homeRuns >= 20) probability += 5;
    
    // Runners in scoring position
    if (gameState.hasSecond || gameState.hasThird) probability += 10;
    
    // Count situation
    if (gameState.balls >= 2 && gameState.strikes <= 1) probability += 5; // Hitter's count
    
    return Math.min(Math.max(probability, 50), 85);
  }
}
