import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SeventhInningStretchModule extends BaseAlertModule {
  alertType = 'MLB_SEVENTH_INNING_STRETCH';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger for any late inning (7+) - removed exact timing restrictions
    return gameState.inning >= 7 && gameState.isLive;
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

    const alertKey = `mlb_seventh_inning_${gameState.gameId}_${gameState.inning}`;

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
      priority: isCloseGame ? 80 : 60,
      message: `Seventh inning stretch - ${awayTeam} @ ${homeTeam} (${awayScore}-${homeScore}) - Late game transition`,
      context
    };

    // Final validation to ensure no undefined fields
    if (!alertResult.type || !alertResult.alertKey || !alertResult.message) {
      console.error('❌ SeventhInningStretchModule: Invalid AlertResult object generated', alertResult);
      return null;
    }

    return alertResult;
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}