import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SecondHalfKickoffModule extends BaseAlertModule {
  alertType = 'NFL_SECOND_HALF_KICKOFF';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Second half kickoff - quarter 3 with kickoff time (15:00 or close to it)
    return gameState.status === 'live' && 
           gameState.quarter === 3 && 
           this.isKickoffTime(gameState.timeRemaining);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const dynamicMessage = this.createDynamicMessage(gameState);

    return {
      alertKey: `${gameState.gameId}_second_half_kickoff`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${gameState.quarter}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        isSecondHalf: true
      },
      priority: 85
    };
  }

  private createDynamicMessage(gameState: GameState): string {
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    
    // Create score context
    let situationDesc = '';
    
    if (homeScore === awayScore) {
      if (homeScore === 0) {
        situationDesc = 'Second half begins - Scoreless game';
      } else {
        situationDesc = `Second half begins - Tied ${homeScore}-${awayScore}`;
      }
    } else {
      const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
      const leadingScore = Math.max(homeScore, awayScore);
      const trailingScore = Math.min(homeScore, awayScore);
      
      if (scoreDiff >= 21) {
        situationDesc = `Second half begins - ${leadingTeam} leads ${leadingScore}-${trailingScore} (blowout)`;
      } else if (scoreDiff >= 14) {
        situationDesc = `Second half begins - ${leadingTeam} leads ${leadingScore}-${trailingScore} (big lead)`;
      } else if (scoreDiff >= 7) {
        situationDesc = `Second half begins - ${leadingTeam} leads ${leadingScore}-${trailingScore} (1-score game)`;
      } else if (scoreDiff >= 3) {
        situationDesc = `Second half begins - ${leadingTeam} leads ${leadingScore}-${trailingScore} (field goal game)`;
      } else {
        situationDesc = `Second half begins - ${leadingTeam} leads ${leadingScore}-${trailingScore} (tight game)`;
      }
    }
    
    return situationDesc;
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }

  private isKickoffTime(timeRemaining: string): boolean {
    // Kickoff typically happens at start of quarter (15:00 or close to it)
    if (!timeRemaining) return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds >= 880 && totalSeconds <= 900; // Between 14:40 and 15:00
    } catch (error) {
      return false;
    }
  }

  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }
}