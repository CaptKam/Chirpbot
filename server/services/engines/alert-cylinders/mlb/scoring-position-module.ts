
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ScoringPositionModule extends BaseAlertModule {
  alertType = 'MLB_SCORING_POSITION';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           (gameState.hasSecond || gameState.hasThird) &&
           gameState.outs < 2;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const runnersDesc = [];
    if (gameState.hasFirst) runnersDesc.push('1st');
    if (gameState.hasSecond) runnersDesc.push('2nd');
    if (gameState.hasThird) runnersDesc.push('3rd');

    return {
      alertKey: `${gameState.gameId}_scoring_pos_${gameState.inning}_${gameState.isTopInning}_${gameState.outs}`,
      type: this.alertType,
      message: `🎯 Runner in scoring position: ${runnersDesc.join(' & ')} base, ${gameState.outs} out${gameState.outs === 1 ? '' : 's'} - ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs,
        hasFirst: gameState.hasFirst,
        hasSecond: gameState.hasSecond,
        hasThird: gameState.hasThird
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 85 : 0;
  }
}
