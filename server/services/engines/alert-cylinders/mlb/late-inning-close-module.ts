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
    const pitcherId = gameState.currentPitcherId || `pitcher_${(gameState.currentPitcher || 'Unknown').replace(/\s+/g, '_')}`;
    const pitcherPerformance = mlbPerformanceTracker.getPitcherSummary(gameState.gameId, pitcherId);
    const homeTeamMomentum = mlbPerformanceTracker.getTeamMomentumSummary(gameState.gameId, 'home');
    const awayTeamMomentum = mlbPerformanceTracker.getTeamMomentumSummary(gameState.gameId, 'away');
    const patterns = mlbPerformanceTracker.detectUnusualPatterns(gameState.gameId);
    
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
    
    // Add bullpen/closer context with proper parsing
    if (pitcherPerformance) {
      // Parse pitch count correctly - look for "X pitches" pattern
      const pitchMatch = pitcherPerformance.match(/(\d+)\s*pitches/i);
      const pitchCount = pitchMatch ? parseInt(pitchMatch[1]) : gameState.pitchCount || 0;
      
      // Parse velocity changes
      const velocityMatch = pitcherPerformance.match(/velocity\s*(down|up)\s*(\d+)\s*mph/i);
      
      if (pitcherPerformance.includes('Closer in') || pitcherPerformance.includes('Setup man')) {
        message += ` | ${pitcherPerformance}`;
      } else if (pitchCount > 100) {
        message += ` | Starter fatigued: ${pitchCount} pitches`;
        if (velocityMatch && parseInt(velocityMatch[2]) > 2) {
          message += `, velocity ${velocityMatch[1]} ${velocityMatch[2]}mph`;
        }
      } else if (pitcherPerformance.includes('consecutive balls') || pitcherPerformance.includes('walked')) {
        message += ` | Pitcher struggling: ${pitcherPerformance}`;
      } else if (velocityMatch && parseInt(velocityMatch[2]) > 2) {
        message += ` | Velocity ${velocityMatch[1]} ${velocityMatch[2]}mph`;
      }
    }
    
    // Add momentum context for the relevant team
    const leadingTeam = gameState.homeScore > gameState.awayScore ? 'home' : 
                        gameState.awayScore > gameState.homeScore ? 'away' : null;
    const trailingTeam = leadingTeam === 'home' ? 'away' : leadingTeam === 'away' ? 'home' : null;
    
    if (trailingTeam) {
      const trailingMomentum = trailingTeam === 'home' ? homeTeamMomentum : awayTeamMomentum;
      if (trailingMomentum && (trailingMomentum.includes('rally') || trailingMomentum.includes('scored in'))) {
        message += ` | Comeback brewing: ${trailingMomentum}`;
      }
    } else if (scoreDiff === 0) {
      // Tied game - show both teams' momentum if relevant
      if (homeTeamMomentum && homeTeamMomentum.includes('rally')) {
        message += ` | Home: ${homeTeamMomentum}`;
      } else if (awayTeamMomentum && awayTeamMomentum.includes('rally')) {
        message += ` | Away: ${awayTeamMomentum}`;
      }
    }
    
    // Add critical patterns for late innings
    if (patterns && patterns.length > 0) {
      const criticalPattern = patterns.find(p => 
        p.includes('stranded') || p.includes('clutch') || p.includes('blown save')
      );
      if (criticalPattern) {
        message += ` | ${criticalPattern}`;
      }
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