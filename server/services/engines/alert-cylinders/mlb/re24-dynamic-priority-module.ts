
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RE24DynamicPriorityModule extends BaseAlertModule {
  alertType = 'RE24_DYNAMIC_PRIORITY';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    const priority = this.calculateDynamicPriority(gameState);
    return gameState.isLive && priority >= 85; // High priority situations
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const priority = this.calculateDynamicPriority(gameState);
    const factors = this.getPriorityFactors(gameState);
    
    return {
      alertKey: `${gameState.gameId}_RE24_PRIORITY_${gameState.inning}_${gameState.outs}`,
      type: this.alertType,
      message: `⚡ Priority Alert: Critical betting moment (${priority})`,
      context: {
        dynamicPriority: priority,
        priorityFactors: factors,
        inning: gameState.inning,
        outs: gameState.outs
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    return Math.min(95, this.calculateDynamicPriority(gameState));
  }

  private calculateDynamicPriority(gameState: GameState): number {
    let priority = 50; // Base priority

    // Game situation priority
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff === 0) priority += 20; // Tied game
    else if (scoreDiff === 1) priority += 15; // One-run game
    else if (scoreDiff <= 3) priority += 10; // Close game

    // Inning priority
    if (gameState.inning >= 9) priority += 20; // 9th inning or later
    else if (gameState.inning >= 7) priority += 10; // Late innings

    // Base runner priority
    if (gameState.hasThird) priority += 15; // Runner in scoring position
    if (gameState.hasFirst && gameState.hasSecond) priority += 10; // Multiple runners

    // Count priority
    if (gameState.balls === 3 && gameState.strikes === 2) priority += 15; // Full count
    if (gameState.strikes === 2) priority += 5; // Two strikes

    // Outs priority
    if (gameState.outs === 2) priority += 10; // Two outs, pressure situation

    return Math.min(100, priority);
  }

  private getPriorityFactors(gameState: GameState): string[] {
    const factors = [];

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff === 0) factors.push('tied game');
    else if (scoreDiff <= 3) factors.push('close game');

    if (gameState.inning >= 9) factors.push('late innings');
    if (gameState.hasThird) factors.push('scoring position');
    if (gameState.balls === 3 && gameState.strikes === 2) factors.push('full count');
    if (gameState.outs === 2) factors.push('two outs');

    return factors;
  }
}
