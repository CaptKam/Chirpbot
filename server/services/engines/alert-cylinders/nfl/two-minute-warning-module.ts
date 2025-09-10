
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NFL_TWO_MINUTE_WARNING';
  sport = 'NFL';

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    const [minutes, seconds] = timeRemaining.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds <= 120; // 2 minutes = 120 seconds
  }

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           (gameState.quarter === 2 || gameState.quarter === 4) &&
           this.isWithinTwoMinutes(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const halfText = gameState.quarter === 2 ? 'First Half' : 'Game';
    
    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}`,
      type: this.alertType,
      message: `⏱️ Two Minute Warning - ${halfText}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDiff: Math.abs(gameState.homeScore - gameState.awayScore),
        // NFL-specific context for AI enhancement
        nflContext: {
          isTwoMinuteWarning: true,
          isEndOfHalf: gameState.quarter === 2,
          isEndOfGame: gameState.quarter === 4,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          clockManagementPhase: this.getClockManagementPhase(gameState),
          timeoutSituation: this.getTimeoutSituation(gameState),
          comebackProbability: this.getComebackProbability(gameState),
          urgencyLevel: this.getUrgencyLevel(gameState)
        }
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
  
  private getClockManagementPhase(gameState: GameState): string {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (gameState.quarter === 4) {
      if (scoreDiff <= 3) return 'CRITICAL_LATE_GAME';
      if (scoreDiff <= 7) return 'COMEBACK_ATTEMPT';
      if (scoreDiff >= 14) return 'RUNNING_OUT_CLOCK';
      return 'STANDARD_LATE_GAME';
    }
    
    if (gameState.quarter === 2) {
      return 'END_OF_HALF';
    }
    
    return 'STANDARD';
  }
  
  private getTimeoutSituation(gameState: GameState): string {
    // In a real implementation, this would check actual timeout counts
    // For now, provide strategic analysis based on situation
    const clockPhase = this.getClockManagementPhase(gameState);
    
    switch (clockPhase) {
      case 'CRITICAL_LATE_GAME':
        return 'PRESERVE_TIMEOUTS';
      case 'COMEBACK_ATTEMPT':
        return 'AGGRESSIVE_TIMEOUT_USAGE';
      case 'RUNNING_OUT_CLOCK':
        return 'FORCE_OPPONENT_TIMEOUTS';
      case 'END_OF_HALF':
        return 'STRATEGIC_TIMEOUT_DECISION';
      default:
        return 'NORMAL_MANAGEMENT';
    }
  }
  
  private getComebackProbability(gameState: GameState): number {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (gameState.quarter !== 4) {
      return 50; // End of half, no comeback analysis
    }
    
    // Fourth quarter comeback probability based on score differential
    if (scoreDiff === 0) return 50;
    if (scoreDiff <= 3) return 45; // Field goal difference
    if (scoreDiff <= 7) return 35; // One touchdown
    if (scoreDiff <= 10) return 25; // Touchdown + field goal
    if (scoreDiff <= 14) return 15; // Two touchdowns
    if (scoreDiff <= 17) return 10; // Two TDs + field goal
    if (scoreDiff <= 21) return 5;  // Three touchdowns
    
    return 2; // Nearly impossible
  }
  
  private getUrgencyLevel(gameState: GameState): string {
    const clockPhase = this.getClockManagementPhase(gameState);
    const comebackProb = this.getComebackProbability(gameState);
    
    if (clockPhase === 'CRITICAL_LATE_GAME') return 'MAXIMUM';
    if (clockPhase === 'COMEBACK_ATTEMPT' && comebackProb >= 25) return 'HIGH';
    if (clockPhase === 'END_OF_HALF') return 'MEDIUM';
    if (clockPhase === 'RUNNING_OUT_CLOCK') return 'LOW';
    
    return 'MEDIUM';
  }
}
