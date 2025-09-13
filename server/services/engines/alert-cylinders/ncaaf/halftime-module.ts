import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class HalftimeModule extends BaseAlertModule {
  alertType = 'NCAAF_HALFTIME';
  sport = 'NCAAF';
  
  // Track which games have triggered halftime alert
  private halftimeTriggered: Set<string> = new Set();

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Halftime check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}`);
    
    // Must be at halftime (between Q2 and Q3)
    // This is typically indicated by quarter=2 with time=0:00 or quarter=3 with time=15:00
    const isHalftime = gameState.status === 'halftime' || 
                       (gameState.quarter === 2 && gameState.timeRemaining === '0:00') ||
                       (gameState.quarter === 3 && gameState.timeRemaining === '15:00');
    
    if (!isHalftime) {
      console.log(`❌ Halftime: Not at halftime (Q${gameState.quarter}, ${gameState.timeRemaining})`);
      return false;
    }
    
    // Check if we've already triggered for this game
    if (this.halftimeTriggered.has(gameState.gameId)) {
      console.log(`❌ Halftime: Already triggered for ${gameState.gameId}`);
      return false;
    }
    
    console.log(`🎯 NCAAF HALFTIME TRIGGERED for ${gameState.gameId}`);
    this.halftimeTriggered.add(gameState.gameId);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    
    let message = `🏈 HALFTIME! `;
    
    if (scoreDiff === 0) {
      message += `Game tied ${homeScore}-${awayScore}`;
    } else {
      const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
      const leadingScore = Math.max(homeScore, awayScore);
      const trailingScore = Math.min(homeScore, awayScore);
      message += `${leadingTeam} leads ${leadingScore}-${trailingScore}`;
    }
    
    message += ` | ${gameState.awayTeam} @ ${gameState.homeTeam}`;
    
    // Add analysis for second half
    if (scoreDiff <= 7) {
      message += ` | Close game! Second half will be crucial.`;
    } else if (scoreDiff > 21) {
      message += ` | Can the trailing team mount a comeback?`;
    }
    
    return {
      alertKey: `${gameState.gameId}_halftime`,
      type: this.alertType,
      message,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore,
        awayScore,
        scoreDifference: scoreDiff,
        isCloseGame: scoreDiff <= 14
      },
      priority: 80
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 100; // Certain at halftime
  }
}