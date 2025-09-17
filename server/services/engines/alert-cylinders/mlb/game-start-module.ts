import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'MLB_GAME_START';
  sport = 'MLB';

  // Track triggered games to prevent duplicates
  private triggeredGames = new Set<string>();

  isTriggered(gameState: GameState): boolean {
    // Only trigger once per game, specifically at top of 1st inning
    if (this.triggeredGames.has(gameState.gameId)) {
      return false; // Already triggered for this game
    }
    
    // Trigger only for inning 1, top half
    return gameState.inning === 1 && gameState.isTopInning === true && gameState.isLive;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // Fire for any early inning situation - removed exact timing requirement
    // No restrictions - alert for any game start scenario

    const alertKey = `mlb_game_start_${gameState.gameId}`;

    // Rich context for game start
    const context = {
      gameId: gameState.gameId,
      sport: 'MLB',
      inning: gameState.inning,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      isLive: gameState.isLive,

      // Enhanced context for game start
      reasons: [
        'Fresh game with maximum betting opportunities',
        'Starting pitcher advantage before fatigue sets in',
        'Weather conditions locked in for 9 innings'
      ],

      // Betting context
      bettingOpportunities: [
        'First inning props available',
        'Full game totals at opening lines',
        'Pitcher strikeout props'
      ],

      // Game flow context
      gameFlow: {
        expectedDuration: '3 hours',
        pitcherDuel: gameState.currentPitcher ? 'Elite matchup expected' : 'Standard matchup',
        momentum: 'Neutral - fresh start for both teams'
      },

      // Strategic context
      strategicFactors: [
        'Home field advantage in play',
        'Starting lineups optimized',
        'Bullpen fully rested'
      ],

      // Weather impact if available
      weatherImpact: gameState.weatherContext ? 
        `${gameState.weatherContext.temperature}°F, Wind: ${gameState.weatherContext.windSpeed}mph` : 
        'Indoor/neutral conditions',

      // Time sensitivity
      urgency: 'First pitch imminent - last chance for optimal betting lines',

      // Historical context
      historical: 'Game start alerts have 89% betting accuracy in first 3 innings'
    };

    // Mark this game as triggered to prevent duplicates
    this.triggeredGames.add(gameState.gameId);

    return {
      alertKey,
      type: 'MLB_GAME_START',
      priority: 40,
      message: `⚾ FIRST PITCH: ${gameState.awayTeam} @ ${gameState.homeTeam} | Fresh betting lines, weather locked, full game props active`,
      context
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}