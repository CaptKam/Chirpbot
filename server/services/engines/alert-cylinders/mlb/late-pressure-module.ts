
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class LatePressureModule extends BaseAlertModule {
  alertType = 'LATE_PRESSURE';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Late inning (8th or later) with close score and runners on base
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const hasRunners = gameState.hasFirst || gameState.hasSecond || gameState.hasThird;
    return gameState.inning >= 8 && scoreDiff <= 3 && hasRunners;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { outs, inning } = gameState;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const alertKey = `${gameState.gameId}_MLB_LATE_PRESSURE_${inning}_${outs}`;
    const message = `🔥 LATE PRESSURE! Inning ${inning}, ${outs} out${outs !== 1 ? 's' : ''}, ${scoreDiff} run game!`;

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
        scoreDifference: scoreDiff,
        hasFirst: gameState.hasFirst,
        hasSecond: gameState.hasSecond,
        hasThird: gameState.hasThird,
        latePressure: true
      },
      priority: 95
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    let probability = 85; // Base late pressure probability
    
    // Closer game = higher probability
    if (scoreDiff === 0) probability += 10; // Tied
    else if (scoreDiff === 1) probability += 8;
    else if (scoreDiff === 2) probability += 5;
    
    // More runners = higher probability
    const runnerCount = (gameState.hasFirst ? 1 : 0) + (gameState.hasSecond ? 1 : 0) + (gameState.hasThird ? 1 : 0);
    probability += runnerCount * 3;
    
    // Fewer outs = higher probability
    if (gameState.outs === 0) probability += 5;
    else if (gameState.outs === 1) probability += 3;
    
    return Math.min(Math.max(probability, 80), 98);
  }
}
