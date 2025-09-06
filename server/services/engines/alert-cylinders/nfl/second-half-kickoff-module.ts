
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SecondHalfKickoffModule extends BaseAlertModule {
  alertType = 'NFL_SECOND_HALF_KICKOFF';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'in' && 
           gameState.quarter === 3 && 
           gameState.timeRemaining && 
           gameState.timeRemaining.includes('15:00');
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const halftimeScore = `${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`;

    return {
      alertKey: `second-half-kickoff-${gameState.gameId}`,
      type: this.alertType,
      message: `🏈 Second Half Kickoff: ${halftimeScore}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter
      },
      priority: 2
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
