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

import { AlertPipeline, DetectionResult, DetectionFn, GenericGameState } from './alertPipeline';

// Import the CommonJS MLB alert model.  The file name contains a space,
// so require() is used instead of a static import statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mlbModel = require('./mlbAlertModel (1).cjs');

export class MLBEngine {
  private pipeline: AlertPipeline;

  constructor(aiEngine: any | null = null, broadcast: ((alert: any) => void) | null = null) {
    // Create a new alert pipeline.  The AI engine can be null to disable AI
    // rewriting; broadcast is used to push alerts to connected clients.
    this.pipeline = new AlertPipeline(aiEngine, broadcast);
    // Register MLB detection logic
    this.pipeline.registerModel('MLB', this.mlbDetection.bind(this));
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
    if (state.clock && typeof state.clock.inning === 'number') {
      const inning = state.clock.inning;
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
   * Placeholder for starting the engine’s periodic polling.  In a real
   * implementation this could fetch data from ESPN’s MLB scoreboard API,
   * update internal state caches and call `processGameState()` when games
   * transition to live.
   */
  async start(): Promise<void> {
    console.log('MLBEngine started (no polling implemented)');
  }
}