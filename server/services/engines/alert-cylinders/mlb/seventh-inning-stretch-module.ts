import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class SeventhInningStretchModule extends BaseAlertModule {
  alertType = 'MLB_SEVENTH_INNING_STRETCH';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    return gameState.inning === 7 && !gameState.isTopInning && 
           gameState.isLive && gameState.outs === 0;
  }

  async generateAlert(gameState: GameState): Promise<AlertResult | null> {
    // Only trigger at the start of the 7th inning
    if (gameState.inning !== 7 || gameState.outs !== 0) {
      return null;
    }

    const alertKey = `mlb_seventh_inning_${gameState.gameId}`;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const isCloseGame = scoreDiff <= 2;
    const totalRuns = gameState.homeScore + gameState.awayScore;

    // Strategic context for late-game dynamics
    const context = {
      gameId: gameState.gameId,
      sport: 'MLB',
      inning: gameState.inning,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,

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
        momentum: gameState.homeScore > gameState.awayScore ? 'Home team leading' : 'Away team ahead'
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

    const urgencyLevel = isCloseGame ? '🔥 CRUNCH TIME' : '📊 LATE-GAME DYNAMICS';
    const scoreContext = isCloseGame ? 'razor-thin margin' : `${scoreDiff}-run difference`;

    return {
      alertKey,
      type: 'MLB_SEVENTH_INNING_STRETCH',
      priority: isCloseGame ? 80 : 60,
      message: `${urgencyLevel}: ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore}) | Bullpen era begins, ${scoreContext}, final 3 innings crucial`,
      context
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}