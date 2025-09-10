import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FourthDownModule extends BaseAlertModule {
  alertType = 'NFL_FOURTH_DOWN';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Fourth down situations - game must be live and down must be 4
    return gameState.status === 'live' && 
           gameState.down === 4 &&
           gameState.yardsToGo !== undefined &&
           gameState.fieldPosition !== undefined;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const priority = gameState.yardsToGo <= 3 ? 95 : 85; // Higher priority for short yardage
    const fieldPosition = gameState.fieldPosition || 50;
    const yardsToGo = gameState.yardsToGo || 10;

    return {
      alertKey: `${gameState.gameId}_fourth_down_${yardsToGo}_${fieldPosition}`,
      type: this.alertType,
      message: `🏈 FOURTH DOWN! ${gameState.awayTeam} vs ${gameState.homeTeam} - 4th & ${yardsToGo} at ${fieldPosition} yard line`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        isFourthDown: true
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 90; // Base high probability for fourth down

    // Higher probability for shorter yardage
    if (gameState.yardsToGo <= 1) probability = 100;
    else if (gameState.yardsToGo <= 3) probability = 95;
    else if (gameState.yardsToGo <= 5) probability = 90;

    // Higher probability in red zone
    if (gameState.fieldPosition <= 20) probability += 5;

    // Higher probability in fourth quarter
    if (gameState.quarter === 4) probability += 5;

    return Math.min(probability, 100);
  }
}