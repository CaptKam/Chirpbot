import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class CFLGreyCupImplicationsModule extends BaseAlertModule {
  alertType = 'CFL_GREY_CUP_IMPLICATIONS';
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

  private hasGreyCupImplications(gameState: GameState): boolean {
    // Grey Cup implications typically apply in:
    // 1. Close games that could affect playoff positioning
    // 2. Division rivalry games
    // 3. Late season games with postseason impact
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isCloseGame = scoreDiff <= 14; // Within two touchdowns
    const isLateGame = gameState.quarter >= 3; // Third quarter or later
    
    return isCloseGame && isLateGame;
  }

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const isCriticalTime = timeSeconds <= 480; // Final 8 minutes
    
    return gameState.quarter >= 3 && 
           isCriticalTime &&
           this.hasGreyCupImplications(gameState);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    let intensityLevel = 'PLAYOFF IMPLICATIONS';
    let contextMessage = 'This game has significant Grey Cup playoff implications!';
    
    if (scoreDiff <= 3) {
      intensityLevel = 'GREY CUP DESTINY';
      contextMessage = 'Every play matters for Grey Cup positioning!';
    } else if (scoreDiff <= 7) {
      intensityLevel = 'CHAMPIONSHIP HOPES';
      contextMessage = 'Championship dreams on the line!';
    }
    
    return {
      alertKey: `${gameState.gameId}_grey_cup_implications_${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message: `🏆 CFL ${intensityLevel}! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${contextMessage}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDiff,
        timeSeconds,
        intensityLevel,
        contextMessage,
        // CFL-specific Grey Cup context
        isGreyCupRelevant: true,
        playoffImplications: 'high',
        championshipContext: scoreDiff <= 7,
        canadianFootball: true,
        threeDownPressure: true
      },
      priority: scoreDiff <= 3 ? 95 : (scoreDiff <= 7 ? 90 : 85)
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    let probability = 85; // Base Grey Cup implications probability
    
    // Score-based adjustments
    if (scoreDiff <= 3) probability += 15; // Field goal decides Grey Cup implications
    else if (scoreDiff <= 7) probability += 12; // One touchdown
    else if (scoreDiff <= 14) probability += 8; // Two touchdowns
    
    // Time pressure adjustments
    if (timeSeconds <= 240) probability += 10; // Final 4 minutes
    else if (timeSeconds <= 360) probability += 5; // Final 6 minutes
    
    // Quarter adjustments
    if (gameState.quarter === 4) probability += 10; // Fourth quarter
    else if (gameState.quarter >= 5) probability += 15; // Overtime
    
    return Math.min(probability, 100);
  }
}