import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class CFLFinalMinutesModule extends BaseAlertModule {
  alertType = 'CFL_FINAL_MINUTES';
  sport = 'CFL';

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  private isWithinFinalMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    const totalSeconds = this.parseTimeToSeconds(timeRemaining);
    return totalSeconds <= 300 && totalSeconds > 120; // Between 2-5 minutes
  }

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           (gameState.quarter === 2 || gameState.quarter === 4) &&
           this.isWithinFinalMinutes(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isCloseGame = scoreDiff <= 10;
    const periodText = gameState.quarter === 2 ? 'First Half' : 'Game';
    const urgencyLevel = isCloseGame ? 'CRUNCH TIME' : 'FINAL MINUTES';
    
    return {
      alertKey: `${gameState.gameId}_cfl_final_minutes_q${gameState.quarter}`,
      type: this.alertType,
      message: `⏰ CFL ${urgencyLevel}! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${gameState.timeRemaining} left in ${periodText}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDiff,
        isCloseGame,
        periodText,
        urgencyLevel,
        // CFL-specific context
        threeDownSystem: true,
        rougeOpportunity: scoreDiff <= 1, // Rouge could be game-deciding
        cflingIntensity: 'high'
      },
      priority: isCloseGame ? 88 : 75
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    let probability = 100; // Base for being in final minutes
    
    // CFL-specific probability adjustments
    if (scoreDiff <= 3) probability += 15; // Field goal game
    else if (scoreDiff <= 7) probability += 10; // One touchdown
    else if (scoreDiff <= 14) probability += 5; // Two touchdowns
    
    // Time pressure in CFL (3-down system creates more urgency)
    if (timeSeconds <= 180) probability += 10; // Final 3 minutes
    if (timeSeconds <= 240) probability += 5; // Final 4 minutes
    
    return Math.min(probability, 100);
  }
}