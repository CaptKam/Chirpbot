import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FinalMinutesModule extends BaseAlertModule {
  alertType = 'NBA_FINAL_MINUTES';
  sport = 'NBA';

  isTriggered(gameState: GameState): boolean {
    // Final 2 minutes of fourth quarter or any overtime in close games
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return gameState.status === 'live' && 
           ((gameState.quarter === 4 && timeSeconds <= 120 && timeSeconds > 0) ||
            (gameState.quarter >= 5 && timeSeconds <= 180)) && // More time for OT
           scoreDiff <= 12; // NBA professional basketball pace
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const timeRemaining = gameState.timeRemaining || '0:00';
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    
    // Higher priority for closer games and less time
    let priority = 90;
    if (scoreDiff <= 3) priority = 98; // One possession
    else if (scoreDiff <= 6) priority = 95; // Two possessions
    else if (scoreDiff <= 9) priority = 92; // Three possessions
    
    if (timeSeconds <= 60) priority = Math.min(priority + 5, 100); // Final minute boost

    const periodText = gameState.quarter >= 5 ? `OT${gameState.quarter - 4}` : '4th Quarter';

    return {
      alertKey: `${gameState.gameId}_nba_final_minutes_${periodText}_${timeRemaining.replace(/[:\s]/g, '')}`,
      type: this.alertType,
      message: `🔥 NBA CRUNCH TIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left in ${periodText}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        scoreDiff,
        timeSeconds,
        // NBA-specific context
        nbaContext: {
          isCrunchTime: true,
          isClutchTime: timeSeconds <= 120,
          possessionCount: Math.ceil(scoreDiff / 3),
          shotClockCount: Math.ceil(timeSeconds / 24),
          professionalBasketball: true,
          intensity: 'Maximum',
          gamePhase: gameState.quarter >= 5 ? 'Overtime' : 'Final Minutes'
        }
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    let probability = 90;

    // Score differential adjustments
    if (scoreDiff <= 3) probability = 98; // One possession
    else if (scoreDiff <= 6) probability = 95; // Two possessions
    else if (scoreDiff <= 9) probability = 92; // Three possessions

    // Time pressure adjustments
    if (timeSeconds <= 30) probability = Math.min(probability + 5, 100); // Final 30 seconds
    else if (timeSeconds <= 60) probability = Math.min(probability + 3, 100); // Final minute

    // Overtime gets extra intensity
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