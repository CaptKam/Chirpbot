
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BasesLoadedNoOutsModule extends BaseAlertModule {
  alertType = 'MLB_BASES_LOADED_NO_OUTS';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Specifically: Bases loaded, 0 outs (~86% scoring probability)
    return hasFirst && hasSecond && hasThird && outs === 0;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    // Generate player-enhanced message
    const playerContext = this.generatePlayerContext(gameState);
    const baseMessage = `🔥 HIGH SCORING PROBABILITY: Bases Loaded, 0 outs - 86% chance to score!`;
    const enhancedMessage = playerContext ? `${baseMessage} ${playerContext}` : baseMessage;

    return {
      alertKey: `${gameState.gameId}_bases_loaded_no_outs`,
      type: this.alertType,
      message: enhancedMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst || true,
        hasSecond: gameState.hasSecond || true,
        hasThird: gameState.hasThird || true,
        outs: gameState.outs || 0,
        balls: gameState.balls,
        strikes: gameState.strikes,
        scenarioName: 'Bases Loaded',
        scoringProbability: 86,
        // Enhanced player data
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        runnerDetails: gameState.runnerDetails,
        playerImpact: this.calculatePlayerImpact(gameState)
      },
      priority: 97
    };
  }

  private generatePlayerContext(gameState: GameState): string | null {
    const batter = gameState.currentBatter;
    if (!batter) return null;

    // Extract player name (handle various formats)
    const playerName = batter.fullName || batter.name || batter.lastName || 'Unknown';
    
    // Check for star players or high-impact situations
    const isStarPlayer = this.isStarPlayer(batter);
    const battingAvg = batter.seasonStats?.avg || batter.avg;
    const homeRuns = batter.seasonStats?.homeRuns || batter.hr || 0;

    if (isStarPlayer) {
      return `⭐ ${playerName} at bat!`;
    } else if (battingAvg && parseFloat(battingAvg) > 0.300) {
      return `🔥 ${playerName} (.${Math.round(parseFloat(battingAvg) * 1000)}) at bat!`;
    } else if (homeRuns > 20) {
      return `💪 ${playerName} (${homeRuns} HRs) at bat!`;
    } else if (playerName !== 'Unknown') {
      return `⚾ ${playerName} at bat`;
    }

    return null;
  }

  private isStarPlayer(batter: any): boolean {
    if (!batter) return false;
    
    const playerName = (batter.fullName || batter.name || batter.lastName || '').toLowerCase();
    
    // List of star players (you can expand this)
    const starPlayers = [
      'shohei ohtani', 'ohtani', 'mike trout', 'trout', 'mookie betts', 'betts',
      'aaron judge', 'judge', 'bryce harper', 'harper', 'manny machado', 'machado',
      'vladimir guerrero', 'guerrero', 'fernando tatis', 'tatis', 'juan soto', 'soto',
      'ronald acuna', 'acuna', 'freddie freeman', 'freeman', 'corey seager', 'seager'
    ];

    return starPlayers.some(star => playerName.includes(star));
  }

  private calculatePlayerImpact(gameState: GameState): number {
    const batter = gameState.currentBatter;
    if (!batter) return 0;

    let impact = 0;
    
    // Star player bonus
    if (this.isStarPlayer(batter)) impact += 15;
    
    // Batting average impact
    const battingAvg = batter.seasonStats?.avg || batter.avg;
    if (battingAvg) {
      const avg = parseFloat(battingAvg);
      if (avg > 0.350) impact += 20;
      else if (avg > 0.300) impact += 15;
      else if (avg > 0.280) impact += 10;
    }

    // Home run potential
    const homeRuns = batter.seasonStats?.homeRuns || batter.hr || 0;
    if (homeRuns > 40) impact += 20;
    else if (homeRuns > 25) impact += 15;
    else if (homeRuns > 15) impact += 10;

    // RBI potential in clutch situations
    const rbis = batter.seasonStats?.rbi || batter.rbi || 0;
    if (rbis > 100) impact += 10;
    else if (rbis > 80) impact += 5;

    return Math.min(impact, 50); // Cap at 50% impact
  }

  calculateProbability(): number {
    return 86;
  }
}
