
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RE24ContextFactorsModule extends BaseAlertModule {
  alertType = 'RE24_CONTEXT_FACTORS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger when context factors significantly increase probability
    const contextBonus = this.calculateContextBonus(gameState);
    return gameState.isLive && contextBonus >= 8; // 8%+ context boost
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const contextBonus = this.calculateContextBonus(gameState);
    const factors = this.getActiveFactors(gameState);
    
    return {
      alertKey: `${gameState.gameId}_RE24_CONTEXT_${gameState.inning}_${gameState.outs}`,
      type: this.alertType,
      message: `🎯 Enhanced Situation: +${Math.round(contextBonus)}% from ${factors.join(', ')}`,
      context: {
        contextBonus,
        activeFactors: factors,
        inning: gameState.inning,
        outs: gameState.outs
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateContextBonus(gameState);
  }

  private calculateContextBonus(gameState: GameState): number {
    let bonus = 0;

    // Weather factors (if available)
    if (gameState.weather?.windSpeed > 10 && gameState.weather?.windDirection === 'helping') {
      bonus += 5; // +5% for favorable wind
    }

    // Power hitter factor
    if (gameState.currentBatter?.homeRuns >= 20) {
      bonus += 3; // +3% for power hitters
    }

    // Ballpark factors (hitter-friendly venues)
    const hitterFriendlyParks = ['Coors Field', 'Great American Ball Park', 'Yankee Stadium'];
    if (gameState.venue && hitterFriendlyParks.some(park => gameState.venue.includes(park))) {
      bonus += 2; // +2% for hitter-friendly parks
    }

    // Late innings pressure
    if (gameState.inning >= 7) {
      bonus += 2; // +2% for late innings
    }

    // Close game factor
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) {
      bonus += 3; // +3% for close games
    }

    return bonus;
  }

  private getActiveFactors(gameState: GameState): string[] {
    const factors = [];

    if (gameState.weather?.windSpeed > 10 && gameState.weather?.windDirection === 'helping') {
      factors.push('favorable wind');
    }

    if (gameState.currentBatter?.homeRuns >= 20) {
      factors.push('power hitter');
    }

    if (gameState.inning >= 7) {
      factors.push('late innings');
    }

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) {
      factors.push('close game');
    }

    return factors;
  }
}
