
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { mlbPerformanceTracker } from '../../mlb-performance-tracker';

export default class BasesLoadedOneOutModule extends BaseAlertModule {
  alertType = 'MLB_BASES_LOADED_ONE_OUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (!gameState.isLive) return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Bases loaded, 1 out (~66% scoring probability)
    return hasFirst && hasSecond && hasThird && outs === 1;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    
    // Get real performance data from tracker
    const batterId = gameState.currentBatterId || `batter_${(gameState.currentBatter || 'Unknown').replace(/\s+/g, '_')}`;
    const batterPerformance = mlbPerformanceTracker.getBatterSummary(gameState.gameId, batterId);
    const pitcherId = gameState.currentPitcherId || `pitcher_${(gameState.currentPitcher || 'Unknown').replace(/\s+/g, '_')}`;
    const pitcherPerformance = mlbPerformanceTracker.getPitcherSummary(gameState.gameId, pitcherId);
    const teamMomentum = mlbPerformanceTracker.getTeamMomentumSummary(
      gameState.gameId,
      gameState.isTopInning ? 'away' : 'home'
    );
    
    return {
      alertKey: `${gameState.gameId}_bases_loaded_one_out`,
      type: this.alertType,
      message: this.buildEnhancedMessage(gameState, batterPerformance, pitcherPerformance, teamMomentum),
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: true,
        hasSecond: true,
        hasThird: true,
        outs: 1,
        scenarioName: 'Bases Loaded',
        scoringProbability: 66
      },
      priority: 75
    };
  }

  calculateProbability(): number {
    return 66;
  }

  private buildEnhancedMessage(
    gameState: GameState,
    batterPerformance?: string | null,
    pitcherPerformance?: string | null,
    teamMomentum?: string | null
  ): string {
    let message = `⚡ HIGH LEVERAGE | ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore}) | BASES LOADED, 1 OUT | 66% scoring edge`;
    
    // Add pitcher performance context
    if (pitcherPerformance) {
      if (pitcherPerformance.includes('consecutive balls')) {
        message += ` | Pitcher control breaking down: ${pitcherPerformance}`;
      } else if (pitcherPerformance.includes('pitches') && parseInt(pitcherPerformance.match(/\d+/)?.[0] || '0') > 70) {
        message += ` | Pitcher workload: ${pitcherPerformance}`;
      }
    }
    
    // Add batter performance
    if (batterPerformance && batterPerformance.includes('-for-')) {
      message += ` | Batter: ${batterPerformance}`;
    }
    
    // Add team momentum
    if (teamMomentum && (teamMomentum.includes('rally') || teamMomentum.includes('runs in last'))) {
      message += ` | ${teamMomentum}`;
    }
    
    // Always include double play vs grand slam dynamic
    message += ` | Double play threat vs grand slam potential`;
    
    return message;
  }
}
