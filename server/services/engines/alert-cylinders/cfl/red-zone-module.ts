
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RedZoneModule extends BaseAlertModule {
  alertType = 'RED_ZONE';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    // CFL red zone is 25 yards (larger field)
    return gameState.status === 'in' && 
           gameState.possession && 
           gameState.yardLine && 
           gameState.yardLine <= 25;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const possessionTeam = gameState.possession === 'home' ? gameState.homeTeam : gameState.awayTeam;

    return {
      alertKey: `red-zone-${gameState.gameId}-${gameState.quarter}-${gameState.timeRemaining}`,
      type: this.alertType,
      message: `🚨 CFL Red Zone: ${possessionTeam} at ${gameState.yardLine} yard line`,
      context: {
        gameId: gameState.gameId,
        possession: possessionTeam,
        yardLine: gameState.yardLine,
        down: gameState.down,
        quarter: gameState.quarter
      },
      priority: 4
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const yardLine = gameState.yardLine || 25;
    return Math.max(40, 100 - (yardLine * 2.4)); // CFL scoring rates
  }
}
