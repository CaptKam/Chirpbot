

import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NCAAF_TWO_MINUTE_WARNING';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Two Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);
    
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
    
    // Must be within 2 minutes
    const withinTwoMins = this.isWithinTwoMinutes(gameState.timeRemaining);
    if (!withinTwoMins) {
      console.log(`❌ Two Minute: Not within 2 minutes (${gameState.timeRemaining})`);
      return false;
    }
    
    // Must be a close game to be interesting
    const isClose = this.isCloseGame(gameState);
    if (!isClose) {
      console.log(`❌ Two Minute: Game not close enough (${gameState.homeScore}-${gameState.awayScore})`);
      return false;
    }
    
    console.log(`🎯 NCAAF Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const isEndOfGame = gameState.quarter === 4;
    const alertKey = `${gameState.gameId}_two_minute_warning_q${gameState.quarter}`;
    
    return {
      alertKey,
      type: this.alertType,
      message: `⏰ TWO MINUTE WARNING! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${gameState.timeRemaining} left in ${isEndOfGame ? '4th quarter' : '2nd quarter'}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        isEndOfHalf: gameState.quarter === 2,
        isEndOfGame: gameState.quarter === 4,
        scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore)
      },
      priority: isEndOfGame ? 95 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 70; // Base probability for two-minute situations
    
    // Higher probability for end of game
    if (gameState.quarter === 4) {
      probability += 20;
    }
    
    // Higher probability for closer games
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) probability += 10;
    else if (scoreDiff <= 7) probability += 5;
    
    return Math.min(probability, 100);
  }

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

