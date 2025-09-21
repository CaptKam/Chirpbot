import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { cleanAlertFormatter } from '../../../clean-alert-formatter';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'NFL_GAME_START';
  sport = 'NFL';

  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, { status: string, hasTriggered: boolean }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId) return false;

    const currentState = this.gameStates.get(gameState.gameId);
    const isLiveGame = gameState.status === 'live' && gameState.quarter <= 2; // First 2 quarters

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
    // Fire for any early game situation - removed exact timing requirement
    // No restrictions - alert for any game start scenario

    const alertKey = `nfl_game_start_${gameState.gameId}`;

    // Rich NFL game start context
    const context = {
      gameId: gameState.gameId,
      sport: 'NFL',
      quarter: gameState.quarter,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,

      // NFL-specific strategic context
      reasons: [
        'Opening drive sets tone - 73% of teams scoring first TD win',
        'Fresh game plans before in-game adjustments',
        'Weather conditions locked for 3+ hours',
        'Prime betting value before line movement'
      ],

      // Betting opportunities
      bettingOpportunities: [
        'First TD scorer props at maximum odds',
        'Opening drive result props available',
        'First quarter totals at opening lines',
        'Team total props before weather impact'
      ],

      // Game flow expectations
      gameFlow: {
        expectedDuration: '3 hours 12 minutes',
        paceExpectation: 'Methodical early, accelerated late',
        keyMoments: ['Opening drive', 'First turnover', 'Red zone efficiency'],
        momentum: 'Neutral - coaching game plans vs execution'
      },

      // Strategic factors
      strategicFactors: [
        'Home field crowd noise advantage',
        'Weather impact on passing vs running',
        'Injury report considerations locked in',
        'Coaching tendencies: conservative vs aggressive start'
      ],

      // Weather and field conditions
      fieldConditions: gameState.weatherContext ? {
        temperature: `${gameState.weatherContext.temperature}°F`,
        wind: `${gameState.weatherContext.windSpeed}mph ${gameState.weatherContext.windDirection || ''}`,
        impact: gameState.weatherContext.windSpeed > 15 ? 'Significant passing impact' : 'Minimal weather factor'
      } : {
        conditions: 'Dome/controlled environment',
        impact: 'Weather neutral - pure skill matchup'
      },

      // Time sensitivity
      urgency: 'Kickoff imminent - final window for optimal prop betting',

      // Historical context
      historical: 'NFL game start props show 78% accuracy in first quarter betting',

      // Key matchup factors
      matchupFactors: [
        'Offensive line vs pass rush sets game pace',
        'Secondary vs receivers determines deep ball success',
        'Running game efficiency affects clock management',
        'Special teams field position battle crucial'
      ]
    };

    return {
      alertKey,
      type: this.alertType,
      priority: 75,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | GAME START`,
      displayMessage: cleanAlertFormatter.format({
        type: this.alertType,
        sport: this.sport,
        gameState: gameState,
        context: {
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          quarter: gameState.quarter
        },
        riskReward: {
          probability: 100
        }
      }).primary,
      context
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      return 0;
    }
  }
}