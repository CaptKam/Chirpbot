import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class OvertimeModule extends BaseAlertModule {
  alertType = 'NBA_OVERTIME';
  sport = 'NBA';

  isTriggered(gameState: GameState): boolean {
    // Any overtime period start (quarter 5+) in NBA
    return gameState.status === 'live' && 
           gameState.quarter >= 5 &&
           this.parseTimeToSeconds(gameState.timeRemaining) >= 240; // First minute of OT
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const overtimePeriod = gameState.quarter - 4;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const timeRemaining = gameState.timeRemaining || '5:00';
    
    // Overtime is always high priority, higher for multiple OTs
    let priority = 92;
    if (overtimePeriod >= 2) priority = 96; // Double OT or more
    if (scoreDiff <= 5) priority = Math.min(priority + 3, 100); // Close OT games

    const overtimeText = overtimePeriod === 1 ? 'OVERTIME' : `${this.getOrdinal(overtimePeriod)} OVERTIME`;

    return {
      alertKey: `${gameState.gameId}_nba_overtime_${overtimePeriod}`,
      type: this.alertType,
      message: `🚨 NBA ${overtimeText}! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Extra basketball!`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        overtimePeriod,
        scoreDiff,
        // NBA-specific context
        nbaContext: {
          isOvertime: true,
          overtimePeriod,
          overtimeLength: '5 minutes',
          isMultipleOvertime: overtimePeriod > 1,
          professionalBasketball: true,
          intensity: 'Maximum',
          rarity: overtimePeriod > 1 ? 'Extremely Rare' : 'Rare',
          fatigueFactor: 'Players showing fatigue',
          clutchPerformance: 'Stars separate themselves',
          historicalSignificance: overtimePeriod > 2 ? 'Historic game' : 'Special game'
        }
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    const overtimePeriod = gameState.quarter - 4;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let probability = 92; // Base high probability for any overtime

    // Multiple OT periods get even higher probability
    if (overtimePeriod >= 2) probability = 96; // Double OT+
    if (overtimePeriod >= 3) probability = 98; // Triple OT+

    // Close games in OT are maximum priority
    if (scoreDiff <= 5) probability = Math.min(probability + 3, 100);

    return probability;
  }

  private getOrdinal(num: number): string {
    const ordinals = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'];
    return ordinals[num] || `${num}TH`;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      return 0;
    }
  }
}