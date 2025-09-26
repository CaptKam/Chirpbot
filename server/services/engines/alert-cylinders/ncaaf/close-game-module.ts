import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class CloseGameModule extends BaseAlertModule {
  alertType = 'NCAAF_CLOSE_GAME';
  sport = 'NCAAF';
  
  // Track last alert to avoid spam
  private lastAlerts: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 180000; // 3 minutes between alerts

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Close Game check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, scores=${gameState.homeScore}-${gameState.awayScore}`);
    
    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Close Game: Game not live (${gameState.status})`);
      return false;
    }
    
    // Must be in Q3 or Q4 for dramatic close games
    if (gameState.quarter !== 3 && gameState.quarter !== 4) {
      console.log(`❌ Close Game: Not in Q3/Q4 (Q${gameState.quarter})`);
      return false;
    }
    
    // Check score difference
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff > 7) {
      console.log(`❌ Close Game: Score difference too large (${scoreDiff})`);
      return false;
    }
    
    // Check cooldown
    const alertKey = `${gameState.gameId}_close_game_q${gameState.quarter}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    if (lastAlert && (Date.now() - lastAlert) < this.COOLDOWN_MS) {
      console.log(`❌ Close Game: Cooldown active (${Math.round((Date.now() - lastAlert) / 1000)}s ago)`);
      return false;
    }
    
    console.log(`🎯 NCAAF CLOSE GAME TRIGGERED for ${gameState.gameId}: ${scoreDiff} point game in Q${gameState.quarter}`);
    this.lastAlerts.set(alertKey, Date.now());
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : 
                       gameState.homeScore < gameState.awayScore ? gameState.awayTeam : null;
    
    return {
      alertKey: `${gameState.gameId}_close_game_q${gameState.quarter}_${Date.now()}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | CLOSE GAME`,
      displayMessage: `🏈 NCAAF ${file##*/} | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        scoreDifference: scoreDiff,
        leadingTeam,
        isTied: scoreDiff === 0
      },
      priority: scoreDiff === 0 ? 95 : 90 - scoreDiff // Higher priority for closer games
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    // Higher probability for closer games
    return 100 - (scoreDiff * 10);
  }
}