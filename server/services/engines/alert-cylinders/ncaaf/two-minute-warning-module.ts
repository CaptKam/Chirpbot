

import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NCAAF_TWO_MINUTE_WARNING';
  sport = 'NCAAF';

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;
    
    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      return totalSeconds <= 120 && totalSeconds > 0; // 2 minutes = 120 seconds
    } catch (error) {
      return false;
    }
  }

  private isCloseGame(gameState: GameState): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return scoreDiff <= 14; // Within two touchdowns
  }

  private calculateGamePressure(gameState: GameState): number {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    let pressure = 50; // Base pressure
    
    // Score difference impact
    if (scoreDiff <= 3) pressure += 40; // Field goal game
    else if (scoreDiff <= 7) pressure += 30; // One touchdown game
    else if (scoreDiff <= 14) pressure += 20; // Two touchdown game
    
    // Time pressure
    if (timeSeconds <= 60) pressure += 30; // Final minute
    else if (timeSeconds <= 120) pressure += 20; // Final two minutes
    
    // Quarter impact
    if (gameState.quarter === 4) pressure += 20; // End of game
    else if (gameState.quarter === 2) pressure += 10; // Halftime
    
    return Math.min(100, pressure);
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

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           (gameState.quarter === 2 || gameState.quarter === 4) &&
           this.isWithinTwoMinutes(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const isHalftime = gameState.quarter === 2;
    const isEndOfGame = gameState.quarter === 4;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const isCloseGame = this.isCloseGame(gameState);
    const pressure = this.calculateGamePressure(gameState);
    
    // Determine situation type
    let situationType = '';
    let priority = 75;
    let emoji = '⏱️';
    
    if (isEndOfGame) {
      if (isCloseGame) {
        situationType = 'CRUNCH_TIME';
        priority = 95;
        emoji = '🚨';
      } else {
        situationType = 'FINAL_MINUTES';
        priority = 85;
        emoji = '⏰';
      }
    } else if (isHalftime) {
      situationType = 'HALFTIME_APPROACH';
      priority = 80;
      emoji = '⏱️';
    }
    
    // Craft message based on context
    let message = '';
    const timeDisplay = gameState.timeRemaining;
    const quarterText = isHalftime ? '2nd Quarter' : '4th Quarter';
    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    const trailingTeam = gameState.homeScore > gameState.awayScore ? gameState.awayTeam : gameState.homeTeam;
    const leadingScore = Math.max(gameState.homeScore, gameState.awayScore);
    const trailingScore = Math.min(gameState.homeScore, gameState.awayScore);
    
    if (isEndOfGame && isCloseGame) {
      if (scoreDiff === 0) {
        message = `${emoji} NCAAF CRUNCH TIME! Tied ${leadingScore}-${trailingScore} with ${timeDisplay} left in ${quarterText}! ${gameState.awayTeam} @ ${gameState.homeTeam}`;
      } else {
        message = `${emoji} NCAAF CRUNCH TIME! ${leadingTeam} leads ${leadingScore}-${trailingScore} with ${timeDisplay} left! ${gameState.awayTeam} @ ${gameState.homeTeam}`;
      }
    } else if (isEndOfGame) {
      message = `${emoji} NCAAF Final Two Minutes: ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeDisplay} remaining`;
    } else {
      message = `${emoji} NCAAF Halftime Approaching: ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeDisplay} left in 1st half`;
    }
    
    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        timeSeconds,
        scoreDiff,
        isHalftime,
        isEndOfGame,
        isCloseGame,
        situationType,
        pressure,
        leadingTeam: scoreDiff > 0 ? leadingTeam : null,
        trailingTeam: scoreDiff > 0 ? trailingTeam : null,
        gamePhase: isHalftime ? 'APPROACHING_HALFTIME' : 'FINAL_MINUTES'
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    return this.calculateGamePressure(gameState);
  }
}

