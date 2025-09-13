import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class PitchingChangeModule extends BaseAlertModule {
  alertType = 'MLB_PITCHING_CHANGE';
  sport = 'MLB';
  
  // Track pitchers per game
  private lastPitchers: Map<string, string> = new Map();

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 MLB Pitching Change check for ${gameState.gameId}: pitcher=${gameState.currentPitcher}`);
    
    // Must be a live game
    if (!gameState.isLive) {
      console.log(`❌ Pitching Change: Game not live`);
      return false;
    }
    
    // Must have current pitcher info
    if (!gameState.currentPitcher) {
      console.log(`❌ Pitching Change: No pitcher info`);
      return false;
    }
    
    const gameId = gameState.gameId;
    const lastPitcher = this.lastPitchers.get(gameId);
    
    // First time seeing this game - track but don't trigger
    if (!lastPitcher) {
      this.lastPitchers.set(gameId, gameState.currentPitcher);
      console.log(`📋 Pitching Change: Initial pitcher tracked for ${gameId}: ${gameState.currentPitcher}`);
      return false;
    }
    
    // Check if pitcher changed
    const pitcherChanged = lastPitcher !== gameState.currentPitcher;
    
    if (pitcherChanged) {
      console.log(`🎯 MLB PITCHING CHANGE TRIGGERED! Old: ${lastPitcher}, New: ${gameState.currentPitcher}`);
      // Update tracked pitcher
      this.lastPitchers.set(gameId, gameState.currentPitcher);
      return true;
    }
    
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const inningText = gameState.isTopInning ? `Top ${gameState.inning}` : `Bottom ${gameState.inning}`;
    
    const message = `⚾ PITCHING CHANGE! ${inningText} | New pitcher: ${gameState.currentPitcher} | ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`;
    
    return {
      alertKey: `${gameState.gameId}_pitching_change_${gameState.currentPitcher}_${Date.now()}`,
      type: this.alertType,
      message,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        newPitcher: gameState.currentPitcher,
        currentBatter: gameState.currentBatter
      },
      priority: 82
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 100; // Certain when pitcher changes
  }
}