
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RE24EnabledModule extends BaseAlertModule {
  alertType = 'RE24_ENABLED';
  sport = 'MLB';

  // RE24 Run Expectancy Matrix (24 states: 8 base states × 3 out states)
  private re24Matrix = {
    '000_0': 0.481, '000_1': 0.254, '000_2': 0.095,  // Bases empty
    '100_0': 0.831, '100_1': 0.509, '100_2': 0.207,  // Runner on 1st
    '010_0': 1.100, '010_1': 0.644, '010_2': 0.305,  // Runner on 2nd
    '001_0': 1.426, '001_1': 0.948, '001_2': 0.382,  // Runner on 3rd
    '110_0': 1.437, '110_1': 0.908, '110_2': 0.434,  // Runners on 1st & 2nd
    '101_0': 1.798, '101_1': 1.140, '101_2': 0.471,  // Runners on 1st & 3rd
    '011_0': 2.052, '011_1': 1.376, '011_2': 0.661,  // Runners on 2nd & 3rd
    '111_0': 2.292, '111_1': 1.541, '111_2': 0.798   // Bases loaded
  };

  isTriggered(gameState: GameState): boolean {
    // Always trigger for RE24 probability calculation
    return gameState.isLive && this.calculateRunExpectancy(gameState) > 0.8;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const runExpectancy = this.calculateRunExpectancy(gameState);
    const probability = this.convertToProbability(runExpectancy, gameState);
    
    return {
      alertKey: `${gameState.gameId}_RE24_${gameState.inning}_${gameState.outs}`,
      type: this.alertType,
      message: `📊 High Scoring Probability: ${Math.round(probability)}% chance to score`,
      context: {
        runExpectancy,
        probability,
        baseState: this.getBaseState(gameState),
        outs: gameState.outs,
        inning: gameState.inning
      },
      priority: Math.min(90, 60 + probability)
    };
  }

  calculateProbability(gameState: GameState): number {
    const runExpectancy = this.calculateRunExpectancy(gameState);
    return this.convertToProbability(runExpectancy, gameState);
  }

  private calculateRunExpectancy(gameState: GameState): number {
    const baseState = this.getBaseState(gameState);
    const outs = Math.min(2, gameState.outs || 0);
    const key = `${baseState}_${outs}`;
    
    return this.re24Matrix[key] || 0;
  }

  private getBaseState(gameState: GameState): string {
    const first = gameState.hasFirst ? '1' : '0';
    const second = gameState.hasSecond ? '1' : '0';
    const third = gameState.hasThird ? '1' : '0';
    return `${first}${second}${third}`;
  }

  private convertToProbability(runExpectancy: number, gameState: GameState): number {
    // Sigmoid function to convert run expectancy to probability
    let probability = 1 / (1 + Math.exp(-(runExpectancy - 1.2) * 2));
    probability *= 100;

    // Context adjustments
    probability += this.getContextAdjustments(gameState);

    return Math.min(95, Math.max(5, probability));
  }

  private getContextAdjustments(gameState: GameState): number {
    let adjustment = 0;

    // Late innings
    if (gameState.inning >= 7) adjustment += 2;
    
    // Close games
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) adjustment += 3;

    return adjustment;
  }
}
