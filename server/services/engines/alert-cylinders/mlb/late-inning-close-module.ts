import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { mlbPerformanceTracker } from '../../mlb-performance-tracker';

export default class LateInningCloseModule extends BaseAlertModule {
  alertType = 'MLB_LATE_INNING_CLOSE';
  sport = 'MLB';
  
  // Track last alert per game/inning to avoid spam
  private lastAlerts: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 180000; // 3 minutes between alerts

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 MLB Late Inning Close check for ${gameState.gameId}: inning=${gameState.inning}, scores=${gameState.homeScore}-${gameState.awayScore}`);
    
    // Must be a live game
    if (!gameState.isLive) {
      console.log(`❌ Late Inning: Game not live`);
      return false;
    }
    
    // Must be 7th inning or later
    if (!gameState.inning || gameState.inning < 7) {
      console.log(`❌ Late Inning: Too early (inning ${gameState.inning})`);
      return false;
    }
    
    // Check score difference
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff > 3) {
      console.log(`❌ Late Inning: Score difference too large (${scoreDiff})`);
      return false;
    }
    
    // Check cooldown
    const alertKey = `${gameState.gameId}_late_close_${gameState.inning}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    if (lastAlert && (Date.now() - lastAlert) < this.COOLDOWN_MS) {
      console.log(`❌ Late Inning: Cooldown active`);
      return false;
    }
    
    console.log(`🎯 MLB LATE INNING CLOSE GAME TRIGGERED!`);
    this.lastAlerts.set(alertKey, Date.now());
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inningText = gameState.isTopInning ? `Top ${gameState.inning}` : `Bottom ${gameState.inning}`;
    
    // Get performance context for late-game situations
    const pitcherPerformance = gameState.currentPitcher ? 
      mlbPerformanceTracker.generatePitcherContext(gameState.gameId, gameState.currentPitcher) : null;
    const homeTeamMomentum = mlbPerformanceTracker.generateTeamMomentumContext(gameState.gameId, gameState.homeTeam);
    const awayTeamMomentum = mlbPerformanceTracker.generateTeamMomentumContext(gameState.gameId, gameState.awayTeam);
    const batterContext = gameState.currentBatter ? 
      mlbPerformanceTracker.generateBatterContext(gameState.gameId, gameState.currentBatter) : null;
    
    let message = `Late inning close game - ${inningText} - `;
    
    if (scoreDiff === 0) {
      message += `Tied ${gameState.homeScore}-${gameState.awayScore}`;
    } else {
      const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
      message += `${leadingTeam} leads by ${scoreDiff}`;
    }
    
    message += ` - ${gameState.awayTeam} @ ${gameState.homeTeam}`;
    
    if (gameState.inning === 9) {
      message += ` - Final inning`;
    }
    
    // Add enhanced performance context
    const contexts: string[] = [];
    
    if (pitcherPerformance) {
      contexts.push(`P: ${pitcherPerformance}`);
    }
    
    if (batterContext) {
      contexts.push(`Batter: ${batterContext}`);
    }
    
    // Add team momentum context
    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : 
                        gameState.awayScore > gameState.homeScore ? gameState.awayTeam : null;
    const trailingTeam = gameState.homeScore > gameState.awayScore ? gameState.awayTeam : 
                         gameState.awayScore > gameState.homeScore ? gameState.homeTeam : null;
    
    if (trailingTeam && scoreDiff > 0) {
      const trailingMomentum = trailingTeam === gameState.homeTeam ? homeTeamMomentum : awayTeamMomentum;
      if (trailingMomentum) {
        contexts.push(`${trailingTeam}: ${trailingMomentum}`);
      }
    } else if (scoreDiff === 0) {
      // Tied game - show most relevant momentum
      if (homeTeamMomentum) {
        contexts.push(`${gameState.homeTeam}: ${homeTeamMomentum}`);
      } else if (awayTeamMomentum) {
        contexts.push(`${gameState.awayTeam}: ${awayTeamMomentum}`);
      }
    }
    
    // Add contexts to message
    if (contexts.length > 0) {
      message += ` | ${contexts.join(' | ')}`;
    }
    
    return {
      alertKey: `${gameState.gameId}_late_close_${gameState.inning}_${gameState.isTopInning ? 'T' : 'B'}_${scoreDiff}`,
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
        scoreDifference: scoreDiff,
        outs: gameState.outs
      },
      priority: gameState.inning === 9 ? 55 : 50
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff === 0) return 95;
    if (scoreDiff === 1) return 90;
    if (scoreDiff === 2) return 85;
    return 80;
  }
}