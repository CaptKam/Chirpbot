
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RedZoneModule extends BaseAlertModule {
  alertType = 'NFL_RED_ZONE';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Team is in red zone (within 20 yards of goal line)
    return gameState.status === 'live' && 
           gameState.fieldPosition !== undefined && 
           gameState.fieldPosition <= 20 &&
           gameState.fieldPosition > 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const probability = this.calculateProbability(gameState);
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;

    return {
      alertKey: `${gameState.gameId}_NFL_RED_ZONE_${down}_${yardsToGo}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | RED ZONE`,
      displayMessage: `🏈 RED ZONE | Q${gameState.quarter} • ${down}${this.getOrdinalSuffix(down)} & ${yardsToGo}`,
      context: {
        gameId: gameState.gameId,
        sport: gameState.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        probability
      },
      priority: probability > 70 ? 90 : 85
    };
  }

  private getOrdinalSuffix(num: number): string {
    const remainder = num % 100;
    if (remainder >= 11 && remainder <= 13) return 'th';
    switch (num % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 60; // Base red zone probability

    // Field position impact
    if (gameState.fieldPosition <= 10) probability += 20; // Goal line area
    else if (gameState.fieldPosition <= 15) probability += 10;

    // Down and distance impact
    if (gameState.down === 1) probability += 15;
    else if (gameState.down === 2) probability += 5;
    else if (gameState.down === 3) probability -= 5;
    else if (gameState.down === 4) probability += 10; // High stakes

    // Yards to go impact
    if (gameState.yardsToGo <= 3) probability += 15;
    else if (gameState.yardsToGo <= 7) probability += 5;

    // Time pressure (4th quarter)
    if (gameState.quarter === 4) probability += 10;

    return Math.min(Math.max(probability, 20), 95);
  }

}
