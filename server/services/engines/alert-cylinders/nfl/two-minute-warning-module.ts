
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { cleanAlertFormatter } from '../../../clean-alert-formatter';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NFL_TWO_MINUTE_WARNING';
  sport = 'NFL';

  private isExactlyTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // Allow for 5-second window around exactly 2:00 (115-125 seconds)
      return totalSeconds >= 115 && totalSeconds <= 125;
    } catch (error) {
      return false;
    }
  }

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NFL Two Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);

    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Two Minute: Game not live (${gameState.status})`);
      return false;
    }

    // Must be in 2nd or 4th quarter (end of half situations)
    if (gameState.quarter !== 2 && gameState.quarter !== 4) {
      console.log(`❌ Two Minute: Wrong quarter (Q${gameState.quarter})`);
      return false;
    }

    // Must be exactly at 2:00 remaining (within 5 second window)
    const exactlyTwoMinutes = this.isExactlyTwoMinutes(gameState.timeRemaining);
    if (!exactlyTwoMinutes) {
      console.log(`❌ Two Minute: Not exactly 2:00 remaining (${gameState.timeRemaining})`);
      return false;
    }

    console.log(`🎯 NFL Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const isFirstHalf = gameState.quarter === 2;
    const halfText = isFirstHalf ? '1st Half' : '2nd Half';
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | TWO MINUTE WARNING`,
      displayMessage: cleanAlertFormatter.format({
        type: this.alertType,
        sport: this.sport,
        gameState: gameState,
        context: {
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          quarter: gameState.quarter,
          timeRemaining: gameState.timeRemaining,
          timeSeconds,
          halfText,
          isFirstHalf,
          twoMinuteWarning: true
        },
        riskReward: {
          probability: 95
        }
      }).primary,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        timeSeconds,
        halfText,
        isFirstHalf,
        twoMinuteWarning: true
      },
      priority: 88
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 95; // High probability since it's exactly at 2:00 mark
  }
  
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;

    try {
      const [minutes, seconds] = timeString.split(':').map(Number);
      return (minutes * 60) + seconds;
    } catch (error) {
      return 0;
    }
  }

  private getScoreDisplay(gameState: GameState): string {
    if (gameState.homeScore === gameState.awayScore) {
      return `Tied ${gameState.homeScore}-${gameState.awayScore}`;
    }

    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    const leadingScore = Math.max(gameState.homeScore, gameState.awayScore);
    const trailingScore = Math.min(gameState.homeScore, gameState.awayScore);

    return `${leadingTeam} leads ${leadingScore}-${trailingScore}`;
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
