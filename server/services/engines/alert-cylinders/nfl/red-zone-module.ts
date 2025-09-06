
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RedZoneModule extends BaseAlertModule {
  alertType = 'RED_ZONE';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Red zone is typically within 20 yards of end zone
    return gameState.status === 'in' && 
           gameState.possession && 
           gameState.yardLine && 
           gameState.yardLine <= 20;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const possessionTeam = gameState.possession === 'home' ? gameState.homeTeam : gameState.awayTeam;

    return {
      alertKey: `red-zone-${gameState.gameId}-${gameState.quarter}-${gameState.timeRemaining}`,
      type: this.alertType,
      message: `🚨 Red Zone Alert: ${possessionTeam} at ${gameState.yardLine} yard line`,
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
    
    // Closer to goal line = higher scoring probability
    const yardLine = gameState.yardLine || 20;
    return Math.max(40, 100 - (yardLine * 3));
  }
}
