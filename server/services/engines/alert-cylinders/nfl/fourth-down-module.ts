
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FourthDownModule extends BaseAlertModule {
  alertType = 'FOURTH_DOWN';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'in' && 
           gameState.down === 4;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const possessionTeam = gameState.possession === 'home' ? gameState.homeTeam : gameState.awayTeam;
    const yardsToGo = gameState.yardsToGo || 0;

    return {
      alertKey: `fourth-down-${gameState.gameId}-${gameState.quarter}-${gameState.timeRemaining}`,
      type: this.alertType,
      message: `⚡ 4th & ${yardsToGo}: ${possessionTeam} decision time`,
      context: {
        gameId: gameState.gameId,
        possession: possessionTeam,
        down: gameState.down,
        yardsToGo: yardsToGo,
        yardLine: gameState.yardLine,
        quarter: gameState.quarter
      },
      priority: 4
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const yardsToGo = gameState.yardsToGo || 10;
    const yardLine = gameState.yardLine || 50;
    
    // Short yardage or red zone = higher conversion probability
    if (yardsToGo <= 2) return 65;
    if (yardLine <= 10) return 70; // Goal line stands
    if (yardsToGo <= 5) return 45;
    return 25;
  }
}
