import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { mlbPerformanceTracker } from '../../mlb-performance-tracker';

export default class SeventhInningStretchModule extends BaseAlertModule {
  alertType = 'MLB_SEVENTH_INNING_STRETCH';
  sport = 'MLB';
  private triggeredGames = new Set<string>();

  isTriggered(gameState: GameState): boolean {
    // Only trigger once per game, specifically at top of 7th inning
    if (this.triggeredGames.has(gameState.gameId)) {
      return false; // Already triggered for this game
    }
    
    // Trigger only for inning 7, top half
    return gameState.inning === 7 && gameState.isTopInning === true && gameState.isLive;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // Validate required game state fields to prevent constraint violations
    if (!gameState || !gameState.gameId || typeof gameState.inning !== 'number' || !gameState.isLive) {
      console.warn(`⚠️ SeventhInningStretchModule: Invalid game state - gameId: ${gameState?.gameId}, inning: ${gameState?.inning}, isLive: ${gameState?.isLive}`);
      return null;
    }

    // Validate team names and scores
    const homeTeam = this.getTeamName(gameState.homeTeam) || 'Home Team';
    const awayTeam = this.getTeamName(gameState.awayTeam) || 'Away Team';
    const homeScore = typeof gameState.homeScore === 'number' ? gameState.homeScore : 0;
    const awayScore = typeof gameState.awayScore === 'number' ? gameState.awayScore : 0;

    // Only generate alert if we meet the trigger conditions
    if (!this.isTriggered(gameState)) {
      return null;
    }

    const alertKey = `mlb_seventh_inning_stretch_${gameState.gameId}`;

    const scoreDiff = Math.abs(homeScore - awayScore);
    const isCloseGame = scoreDiff <= 2;
    const totalRuns = homeScore + awayScore;

    // Strategic context for late-game dynamics
    const context = {
      gameId: gameState.gameId,
      sport: 'MLB',
      inning: gameState.inning,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeScore: homeScore,
      awayScore: awayScore,

      // Late-game strategic context
      reasons: [
        'Bullpen era begins - fresh arms vs tired starters',
        'Managerial decisions intensify (pinch hitters, defensive subs)',
        isCloseGame ? 'Close game - every at-bat matters' : 'Score differential may drive aggressive play',
        'Historical: 31% of game-winning runs scored in final 3 innings'
      ],

      // Betting dynamics
      bettingShifts: [
        'Live totals adjust for bullpen tendencies',
        'Closer availability impacts late-inning props',
        'Pinch hitter props become available'
      ],

      // Game state analysis
      gameState: {
        competitiveness: isCloseGame ? 'Highly competitive' : scoreDiff > 5 ? 'Blowout territory' : 'Moderate lead',
        totalPace: totalRuns > 8 ? 'High-scoring affair' : totalRuns < 4 ? 'Pitcher duel' : 'Average scoring',
        momentum: homeScore > awayScore ? 'Home team leading' : 'Away team ahead'
      },

      // Strategic factors
      lateGameFactors: [
        'Starter pitch counts becoming critical',
        'Bullpen matchups favor left/right splits',
        'Home field advantage amplifies in final innings',
        'Pressure situations create hero/goat moments'
      ],

      // Urgency and timing
      urgency: 'Critical transition point - next 45 minutes determine game outcome',

      // Statistical context
      historical: `Close games (≤2 run diff) in 7th: 67% decided by 1 run, 23% go to extras`,

      // Weather impact continuation
      weatherImpact: gameState.weatherContext?.windSpeed ? 
        `Late-game wind patterns: ${gameState.weatherContext.windSpeed}mph may affect fly balls` : 
        'Controlled conditions maintain consistency'
    };

    // Ensure all required fields are properly set to prevent constraint violations
    const alertResult: AlertResult = {
      alertKey,
      type: 'MLB_SEVENTH_INNING_STRETCH',
      priority: isCloseGame ? 45 : 35,
      message: this.generateEnhancedSeventhInningMessage(gameState),
      context
    };

    // Final validation to ensure no undefined fields
    if (!alertResult.type || !alertResult.alertKey || !alertResult.message) {
      console.error('❌ SeventhInningStretchModule: Invalid AlertResult object generated', alertResult);
      return null;
    }

    // Mark this game as triggered to prevent duplicates
    this.triggeredGames.add(gameState.gameId);

    return alertResult;
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }

  private generateEnhancedSeventhInningMessage(gameState: GameState): string {
    const awayTeam = gameState.awayTeam;
    const homeTeam = gameState.homeTeam;
    const awayScore = gameState.awayScore;
    const homeScore = gameState.homeScore;
    
    // Get performance context
    const batterContext = gameState.currentBatter ? 
      mlbPerformanceTracker.generateBatterContext(gameState.gameId, gameState.currentBatter) : null;
    const pitcherContext = gameState.currentPitcher ? 
      mlbPerformanceTracker.generatePitcherContext(gameState.gameId, gameState.currentPitcher) : null;
    const teamContext = mlbPerformanceTracker.generateTeamMomentumContext(gameState.gameId, awayTeam);
    
    // Build enhanced message
    let message = `Seventh inning stretch - ${awayTeam} @ ${homeTeam} (${awayScore}-${homeScore})`;
    
    // Add performance insights
    const contexts: string[] = [];
    if (pitcherContext) {
      contexts.push(`P: ${pitcherContext}`);
    }
    if (batterContext) {
      contexts.push(`Batter: ${batterContext}`);
    }
    if (teamContext) {
      contexts.push(`Momentum: ${teamContext}`);
    }
    
    // Add standard late game context
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 2) {
      contexts.push('Close game - clutch time');
    } else {
      contexts.push('Lead to protect/overcome');
    }
    
    if (contexts.length > 0) {
      message += ` | ${contexts.join(' | ')}`;
    }
    
    return message;
  }
}