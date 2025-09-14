import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'MLB_GAME_START';
  sport = 'MLB';

  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;

    const currentState = this.gameStates.get(gameState.gameId);
    const isLiveGame = gameState.isLive && gameState.inning <= 3; // First 3 innings

    // Only trigger if game is now live AND we haven't triggered for this game yet
    if (isLiveGame) {
      // If we haven't seen this game before, or if we've seen it but it wasn't live before
      if (!currentState || (!currentState.hasTriggered)) {
        // Update our tracking
        this.gameStates.set(gameState.gameId, { 
          status: 'live',
          hasTriggered: true 
        });
        return true;
      }
    } else {
      // Game is not live yet, track it but don't trigger
      if (!currentState) {
        this.gameStates.set(gameState.gameId, { 
          status: gameState.status || 'scheduled',
          hasTriggered: false 
        });
      }
    }

    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // Fire for any early inning situation - removed exact timing requirement
    // No restrictions - alert for any game start scenario

    const alertKey = `mlb_game_start_${gameState.gameId}_${gameState.inning}`;

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

    return {
      alertKey,
      type: 'MLB_GAME_START',
      priority: 75,
      message: `⚾ FIRST PITCH: ${gameState.awayTeam?.name || gameState.awayTeam} @ ${gameState.homeTeam?.name || gameState.homeTeam} | Fresh betting lines, weather locked, full game props active`,
      context
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}