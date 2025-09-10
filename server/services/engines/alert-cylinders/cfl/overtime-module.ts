import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class OvertimeModule extends BaseAlertModule {
  alertType = 'CFL_OVERTIME';
  sport = 'CFL';

  isTriggered(gameState: GameState): boolean {
    // CFL overtime: Quarter 5 and beyond
    return gameState.status === 'live' && gameState.quarter >= 5;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const overtimePeriod = gameState.quarter - 4;
    const overtimeText = overtimePeriod === 1 ? "Overtime" : `${overtimePeriod}${this.getOrdinalSuffix(overtimePeriod)} Overtime`;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const gameStateText = scoreDiff === 0 ? "Tied game" : `${scoreDiff}-point difference`;

    return {
      alertKey: `${gameState.gameId}_overtime_${gameState.quarter}`,
      type: this.alertType,
      message: `🏆 CFL ${overtimeText}: ${gameStateText} - Every play matters in sudden-death format!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        overtimePeriod: overtimePeriod,
        scoreDiff: scoreDiff,
        isPlayoffs: gameState.quarter >= 6, // Extended overtime suggests playoffs
        isSuddenDeath: true // CFL playoff overtime is sudden-death
      },
      priority: 95 // Very high priority - overtime drama
    };
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}