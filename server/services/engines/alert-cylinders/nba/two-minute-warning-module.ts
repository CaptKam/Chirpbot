import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NBA_TWO_MINUTE_WARNING';
  sport = 'NBA';

  isTriggered(gameState: GameState): boolean {
    // Triggered at exactly 2:00 mark in fourth quarter or overtime (close games)
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return gameState.status === 'live' && 
           (gameState.quarter === 4 || gameState.quarter >= 5) &&
           timeSeconds >= 115 && timeSeconds <= 125 && // 2:00 +/- 5 seconds window
           scoreDiff <= 15; // Professional basketball competitive range
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const timeRemaining = gameState.timeRemaining || '2:00';
    
    // Priority based on how close the game is
    let priority = 88;
    if (scoreDiff <= 3) priority = 96; // One possession
    else if (scoreDiff <= 6) priority = 93; // Two possessions
    else if (scoreDiff <= 10) priority = 90; // Three possessions

    const periodText = gameState.quarter >= 5 ? `OT${gameState.quarter - 4}` : '4th Quarter';

    return {
      alertKey: `${gameState.gameId}_nba_two_minute_warning_${gameState.quarter}`,
      type: this.alertType,
      message: `⏰ NBA TWO MINUTE WARNING! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Official timeout in ${periodText}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        scoreDiff,
        // NBA-specific context
        nbaContext: {
          isTwoMinuteWarning: true,
          isOfficialTimeout: true,
          reviewPeriod: 'All plays reviewed under 2 minutes',
          strategyTime: 'Coaches planning final strategy',
          foulGame: 'Fouling strategy may begin',
          possessionCount: Math.ceil(scoreDiff / 3),
          professionalBasketball: true,
          criticalMoment: 'Game outcome largely determined in next 2 minutes'
        }
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let probability = 88; // Base probability for two-minute warning

    // Closer games get higher probability
    if (scoreDiff <= 3) probability = 96; // One possession
    else if (scoreDiff <= 6) probability = 93; // Two possessions
    else if (scoreDiff <= 10) probability = 90; // Three possessions

    // Overtime situations get boost
    if (gameState.quarter >= 5) probability = Math.min(probability + 5, 100);

    return probability;
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