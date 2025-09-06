
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ThirdDownModule extends BaseAlertModule {
  alertType = 'THIRD_DOWN';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    // CFL uses 3 downs instead of 4
    return gameState.status === 'in' && 
           gameState.down === 3;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const possessionTeam = gameState.possession === 'home' ? gameState.homeTeam : gameState.awayTeam;
    const yardsToGo = gameState.yardsToGo || 0;

    return {
      alertKey: `third-down-${gameState.gameId}-${gameState.quarter}-${gameState.timeRemaining}`,
      type: this.alertType,
      message: `⚡ CFL 3rd & ${yardsToGo}: ${possessionTeam} must convert`,
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
    
    // 3rd down in CFL is do-or-die
    if (yardsToGo <= 3) return 60;
    if (yardLine <= 25) return 65; // CFL red zone is 25 yards
    if (yardsToGo <= 7) return 40;
    return 20;
  }
}
