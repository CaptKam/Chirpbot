
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FullCountModule extends BaseAlertModule {
  alertType = 'MLB_FULL_COUNT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           gameState.balls === 3 && 
           gameState.strikes === 2;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_full_count_${gameState.inning}_${gameState.isTopInning}_${gameState.outs}`,
      type: this.alertType,
      message: `⚾ Full count (3-2), ${gameState.outs} out${gameState.outs === 1 ? '' : 's'} - ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs,
        balls: gameState.balls,
        strikes: gameState.strikes
      },
      priority: 70
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 80 : 0;
  }
}
