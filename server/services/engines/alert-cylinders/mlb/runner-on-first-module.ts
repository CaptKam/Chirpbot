
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class RunnerOnFirstModule extends BaseAlertModule {
  alertType = 'MLB_RUNNER_ON_FIRST';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           gameState.hasFirst && 
           !gameState.hasSecond && 
           !gameState.hasThird &&
           gameState.outs < 2;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    return {
      alertKey: `${gameState.gameId}_runner_first_${gameState.inning}_${gameState.isTopInning}_${gameState.outs}`,
      type: this.alertType,
      message: `🏃 Runner on 1st base, ${gameState.outs} out${gameState.outs === 1 ? '' : 's'} - ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs,
        hasFirst: true
      },
      priority: 60
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 70 : 0;
  }
}
