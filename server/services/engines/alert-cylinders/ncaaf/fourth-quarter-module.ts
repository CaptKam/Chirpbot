import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class FourthQuarterModule extends BaseAlertModule {
  alertType = 'NCAAF_FOURTH_QUARTER';
  sport = 'NCAAF';
  
  // Track which games have triggered Q4 alert
  private q4Triggered: Set<string> = new Set();

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Fourth Quarter check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}`);
    
    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Fourth Quarter: Game not live (${gameState.status})`);
      return false;
    }
    
    // Must be in fourth quarter
    if (gameState.quarter !== 4) {
      console.log(`❌ Fourth Quarter: Not in Q4 (Q${gameState.quarter})`);
      return false;
    }
    
    // Check if we've already triggered for this game
    if (this.q4Triggered.has(gameState.gameId)) {
      console.log(`❌ Fourth Quarter: Already triggered for ${gameState.gameId}`);
      return false;
    }
    
    console.log(`🎯 NCAAF FOURTH QUARTER TRIGGERED for ${gameState.gameId}`);
    this.q4Triggered.add(gameState.gameId);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isCloseGame = scoreDiff <= 14;
    
    return {
      alertKey: `${gameState.gameId}_fourth_quarter_start`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${this.createDynamicMessage(gameState, scoreDiff, isCloseGame)}`,
      displayMessage: `🏈 NCAAF FOURTH QUARTER | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: 4,
        timeRemaining: gameState.timeRemaining,
        scoreDifference: scoreDiff,
        isCloseGame
      },
      priority: isCloseGame ? 90 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    // Higher probability for close games
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 7) return 95;
    if (scoreDiff <= 14) return 85;
    return 75;
  }

  private createDynamicMessage(gameState: GameState, scoreDiff: number, isCloseGame: boolean): string {
    const timeRemaining = gameState.timeRemaining;
    
    if (isCloseGame) {
      if (scoreDiff === 0) {
        return `Tied entering Q4 - ${timeRemaining} to decide it`;
      } else {
        return `${scoreDiff}-point game entering Q4 - Crunch time`;
      }
    } else {
      return `Fourth quarter begins - ${timeRemaining} remaining`;
    }
  }
}