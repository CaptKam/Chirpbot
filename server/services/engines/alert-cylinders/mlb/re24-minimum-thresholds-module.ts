
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RE24MinimumThresholdsModule extends BaseAlertModule {
  alertType = 'RE24_MINIMUM_THRESHOLDS';
  sport = 'MLB';

  private readonly MINIMUM_PROBABILITY = 5;
  private readonly MAXIMUM_PROBABILITY = 95;
  private readonly HIGH_PROBABILITY_THRESHOLD = 75;

  isTriggered(gameState: GameState): boolean {
    const baseProbability = this.calculateBaseProbability(gameState);
    return gameState.isLive && baseProbability >= this.HIGH_PROBABILITY_THRESHOLD;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const probability = this.calculateBaseProbability(gameState);
    
    return {
      alertKey: `${gameState.gameId}_RE24_THRESHOLD_${gameState.inning}_${gameState.outs}`,
      type: this.alertType,
      message: `🔥 High-Value Alert: ${Math.round(probability)}% scoring probability`,
      context: {
        probability,
        threshold: this.HIGH_PROBABILITY_THRESHOLD,
        inning: gameState.inning,
        outs: gameState.outs
      },
      priority: Math.min(95, probability)
    };
  }

  calculateProbability(gameState: GameState): number {
    const baseProbability = this.calculateBaseProbability(gameState);
    return Math.min(this.MAXIMUM_PROBABILITY, Math.max(this.MINIMUM_PROBABILITY, baseProbability));
  }

  private calculateBaseProbability(gameState: GameState): number {
    let probability = 50; // Base probability

    // Base runners
    if (gameState.hasFirst) probability += 15;
    if (gameState.hasSecond) probability += 20;
    if (gameState.hasThird) probability += 25;

    // Outs adjustment
    if (gameState.outs === 0) probability += 10;
    else if (gameState.outs === 1) probability += 5;
    else if (gameState.outs === 2) probability -= 15;

    // Count situation
    if (gameState.balls === 3 && gameState.strikes <= 1) probability += 10; // Hitter's count
    if (gameState.balls <= 1 && gameState.strikes === 2) probability -= 5; // Pitcher's count

    return probability;
  }
}
