import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FourthQuarterModule extends BaseAlertModule {
  alertType = 'NBA_FOURTH_QUARTER';
  sport = 'NBA';

  // Track triggered games to prevent duplicates
  private triggeredGames = new Set<string>();

  isTriggered(gameState: GameState): boolean {
    // Check if already triggered for this game
    if (this.triggeredGames.has(gameState.gameId)) {
      return false; // Already triggered for this game
    }

    // Fourth quarter start in close games (within 15 points for NBA pace)
    const shouldTrigger = gameState.status === 'live' && 
                         gameState.quarter === 4 &&
                         this.parseTimeToSeconds(gameState.timeRemaining) >= 600 && // First 2 minutes of quarter
                         Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0)) <= 15;

    if (shouldTrigger) {
      this.triggeredGames.add(gameState.gameId);
    }

    return shouldTrigger;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const priority = scoreDiff <= 5 ? 95 : (scoreDiff <= 10 ? 90 : 85);
    const timeRemaining = gameState.timeRemaining || '12:00';

    return {
      alertKey: `${gameState.gameId}_nba_fourth_quarter`,
      type: this.alertType,
      message: `🏀 NBA FOURTH QUARTER! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Crunch time begins!`,
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
          isFourthQuarter: true,
          isCloseGame: scoreDiff <= 10,
          clutchTimeFactor: this.calculateClutchFactor(gameState),
          professionalBasketball: true,
          criticalMoments: 'Fourth quarter where championships are decided'
        }
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 85; // Base high probability for fourth quarter

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Closer games get higher probability
    if (scoreDiff <= 3) probability = 95; // One possession game
    else if (scoreDiff <= 6) probability = 90; // Two possession game
    else if (scoreDiff <= 10) probability = 85; // Three possession game

    return probability;
  }

  private calculateClutchFactor(gameState: GameState): number {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    let clutchFactor = 50;

    // Score pressure
    if (scoreDiff <= 3) clutchFactor += 40; // One possession
    else if (scoreDiff <= 6) clutchFactor += 30; // Two possessions
    else if (scoreDiff <= 10) clutchFactor += 20; // Three possessions

    // Quarter pressure
    clutchFactor += 25; // Fourth quarter automatically adds pressure

    return Math.min(clutchFactor, 100);
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