
/**
 * MLBEngine
 *
 * This class ties together the layered alert pipeline and a set of MLB‑specific
 * detection rules.  It registers a detection function with the pipeline
 * that evaluates high scoring opportunities (via the MLB alert model),
 * ninth‑inning or later tie situations and imminent power‑hitter events.
 * It exposes a simple `processGameState()` method so sport engines can
 * feed the latest game state snapshots into the alert system.
 */

import { getAlertPipeline, DetectionResult, DetectionFn, GenericGameState } from '../AlertPipeline';
import { fetchJson } from '../http';

// Simple MLB alert model (inline for now)
const mlbModel = {
  checkScoringProbability(state: GenericGameState): { shouldAlert: boolean; probability?: number; priority?: number; reasons?: string[] } {
    // High scoring situations: runners in scoring position with less than 2 outs
    const hasRISP = state.runners && (state.runners.second || state.runners.third);
    const isHighLeverage = state.outs !== undefined && state.outs < 2;
    
    if (hasRISP && isHighLeverage) {
      const baseSituation = state.runners.third ? 'runner on third' : 'runner in scoring position';
      return {
        shouldAlert: true,
        probability: state.runners.third ? 0.85 : 0.70,
        priority: state.runners.third ? 95 : 85,
        reasons: [`${baseSituation} with ${state.outs} outs`]
      };
    }
    
    // Bases loaded situation
    if (state.runners && state.runners.first && state.runners.second && state.runners.third) {
      return {
        shouldAlert: true,
        probability: 0.90,
        priority: 98,
        reasons: ['Bases loaded opportunity']
      };
    }
    
    return { shouldAlert: false };
  }
};

export class MLBEngine {
  private pipeline: any;
  private readonly MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

  constructor(aiEngine: any | null = null, broadcast: ((alert: any) => void) | null = null) {
    // Create a new alert pipeline using the global instance
    this.pipeline = getAlertPipeline(aiEngine, broadcast);
    // Register MLB detection logic
    this.pipeline.registerModel('MLB', this.mlbDetection.bind(this));
    console.log('🔧 MLBEngine initialized with AlertPipeline');
  }

  /**
   * MLB detection logic.
   *
   * Examines the incoming game state and returns a detection result for high
   * scoring opportunities, ninth‑inning tie conditions or power hitter
   * scenarios.  Priority is assigned based on the type of situation.
   */
  private async mlbDetection(state: GenericGameState): Promise<DetectionResult> {
    // Use the imported MLB scoring probability model
    let scoringResult: any;
    try {
      scoringResult = mlbModel.checkScoringProbability(state);
    } catch (err) {
      console.error('MLB scoring model failed:', err);
      scoringResult = { shouldAlert: false };
    }
    
    // High scoring opportunity
    if (scoringResult && scoringResult.shouldAlert) {
      return {
        shouldAlert: true,
        alertType: 'MLB_SCORING',
        probability: scoringResult.probability,
        priority: scoringResult.priority,
        reasons: scoringResult.reasons || []
      };
    }
    
    // Ninth inning or later, tie or one‑run game
    if (state.inning && typeof state.inning === 'number') {
      const inning = state.inning;
      const diff = Math.abs(state.homeScore - state.awayScore);
      if (inning >= 9 && diff <= 1) {
        return {
          shouldAlert: true,
          alertType: 'MLB_NINTH_TIE',
          probability: 0.8,
          priority: 90,
          reasons: ['Late innings tie/one‑run game']
        };
      }
    }
    
    // Power hitter at bat or on deck
    const hrNow = state.batter && typeof state.batter.hrSeason === 'number' ? state.batter.hrSeason : 0;
    const hrNext = state.onDeck && typeof state.onDeck.hrSeason === 'number' ? state.onDeck.hrSeason : 0;
    if (hrNow >= 25) {
      return {
        shouldAlert: true,
        alertType: 'MLB_POWER_HITTER',
        probability: 0.65,
        priority: 80,
        reasons: ['Power hitter at bat (25+ HR)']
      };
    }
    if (hrNext >= 30) {
      return {
        shouldAlert: true,
        alertType: 'MLB_POWER_HITTER',
        probability: 0.60,
        priority: 75,
        reasons: ['Power hitter on deck (30+ HR)']
      };
    }
    
    return { shouldAlert: false, alertType: '', probability: 0, priority: 0, reasons: [] };
  }

  /**
   * Feed a new MLB game state into the alert pipeline.  The pipeline will
   * evaluate detection rules, enrich any resulting alert and deliver it.
   */
  async processGameState(state: GenericGameState): Promise<void> {
    await this.pipeline.processState(state);
  }

  /**
   * Get today's MLB games from the official MLB API
   */
  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `${this.MLB_API_BASE}/schedule?sportId=1&date=${targetDate}&hydrate=game(content(summary,media(epg)),tickets),linescore(matchup,runners),metadata`;
      
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data || !(data as any).dates?.[0]?.games) {
        console.log(`📅 No MLB games found for ${targetDate}`);
        return [];
      }

      return (data as any).dates[0].games.map((game: any) => ({
        gamePk: game.gamePk,
        gameId: game.gamePk.toString(),
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        homeScore: game.teams.home.score || 0,
        awayScore: game.teams.away.score || 0,
        status: game.status.detailedState,
        gameDate: game.gameDate,
        startTime: game.gameDate,
        sport: 'MLB'
      }));
    } catch (error) {
      console.error('❌ MLB API Error:', error);
      return [];
    }
  }

  /**
   * Start the MLB engine monitoring
   */
  async start(): Promise<void> {
    console.log('🎯 MLBEngine started - monitoring disabled');
    // Monitoring completely disabled - no fake alerts will be generated
  }

  /**
   * Process all live MLB games
   */
  private async processLiveGames(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => 
        game.status && (game.status.includes('Progress') || game.status.includes('Live'))
      );
      
      console.log(`🎯 Processing ${liveGames.length} live MLB games`);
      
      for (const game of liveGames) {
        await this.processGame(game);
      }
    } catch (error) {
      console.error('❌ MLB live games processing error:', error);
    }
  }

  /**
   * Process a single MLB game
   */
  private async processGame(game: any): Promise<void> {
    try {
      // Convert to GenericGameState format
      const gameState: GenericGameState = {
        gameId: game.gameId,
        sport: 'MLB',
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        // Add MLB-specific data if available
        inning: game.inning || 1,
        inningState: game.inningState || 'top',
        outs: game.outs || 0,
        runners: game.runners || {},
        batter: game.batter,
        onDeck: game.onDeck
      };

      // Process through the alert pipeline
      await this.processGameState(gameState);
    } catch (error) {
      console.error(`❌ MLB game processing error for ${game.gameId}:`, error);
    }
  }
}
