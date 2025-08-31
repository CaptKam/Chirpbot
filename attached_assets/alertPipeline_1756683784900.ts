/**
 * Generic, layered alert pipeline for Chirpbot.
 *
 * This module defines a series of classes that cleanly separate the alert
 * workflow into independent layers: monitoring, detection, enrichment,
 * betting insights and delivery.  Each layer exposes a small, well‑defined
 * interface and can be reused across sports.  The goal is to make the
 * flow modular, testable and maintainable.  Note that this is a skeleton
 * implementation – it demonstrates how the layers interact rather than
 * implementing every sport‑specific detail.  Sport engines can compose
 * these classes to build a complete alerting solution.
 */

import { randomUUID } from 'crypto';
import { storage } from './storage';
import { sendTelegramAlert } from './services/telegram';
import { getBetbookData } from './services/engines/betbook-engine';
// Dynamically import sport models when needed.  These imports should
// point at the CommonJS modules (e.g. mlbAlertModel.cjs, NCAAFAlertModel.cjs).

// Types used throughout the pipeline
export interface GenericGameState {
  gameId: string;
  sport: string;
  // Teams and scores
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  // Additional fields vary by sport (down, distance, bases, outs, etc.)
  // Use an index signature to allow extra data
  [key: string]: any;
}

export interface BaseAlert {
  type: string;
  sport: string;
  priority: number;
  probability: number;
  reasons: string[];
}

export interface EnrichedAlert extends BaseAlert {
  id: string;
  title: string;
  description: string;
  gameInfo: {
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    score: { home: number; away: number };
    situation?: string;
    [key: string]: any;
  };
  betbookData?: any;
  timestamp: Date;
}

/**
 * Monitor Layer
 *
 * The monitor keeps track of game state updates.  A sport engine should
 * call `updateGameState()` whenever a new snapshot of a game is available.
 * Consumers can then retrieve the latest state via `getCurrentState()`.
 */
export class GameMonitor {
  private stateCache = new Map<string, GenericGameState>();

  updateGameState(state: GenericGameState): void {
    this.stateCache.set(state.gameId, state);
  }

  getCurrentState(gameId: string): GenericGameState | undefined {
    return this.stateCache.get(gameId);
  }
}

/**
 * Alert Detection Layer
 *
 * The detector uses sport‑specific models to decide when an alert should
 * fire.  It abstracts away the details of scoring probability, red‑zone
 * detection, fourth down situations, etc.  Consumers register a model
 * provider (a function that returns a detection result) for each sport.
 */
export interface DetectionResult {
  shouldAlert: boolean;
  alertType: string;
  probability: number;
  priority: number;
  reasons: string[];
}

export type DetectionFn = (state: GenericGameState) => Promise<DetectionResult>;

export class AlertDetector {
  private modelRegistry = new Map<string, DetectionFn>();

  /**
   * Register a detection function for a given sport.
   *
   * @param sport The sport key (e.g. "MLB", "NCAAF").
   * @param fn    The async function that inspects a game state and returns a detection result.
   */
  registerModel(sport: string, fn: DetectionFn): void {
    this.modelRegistry.set(sport.toUpperCase(), fn);
  }

  /**
   * Execute the detection function for the given game state.
   *
   * Returns a generic negative result if no model is registered.
   */
  async detect(state: GenericGameState): Promise<DetectionResult> {
    const fn = this.modelRegistry.get(state.sport.toUpperCase());
    if (!fn) {
      return { shouldAlert: false, alertType: '', probability: 0, priority: 0, reasons: [] };
    }
    return fn(state);
  }
}

/**
 * Alert Enrichment Layer
 *
 * Builds user‑friendly titles and descriptions from raw alert data.  This
 * includes formatting the score, quarter/inning information, and any
 * sport‑specific context.  An optional `OpenAiEngine` can be injected
 * to further refine or rewrite messages; however, this dependency is
 * optional to keep costs down.
 */
export class AlertEnricher {
  constructor(private aiEngine: any | null = null) {}

  /**
   * Generate a human‑readable alert from base information.
   */
  async enrich(alert: BaseAlert, state: GenericGameState): Promise<EnrichedAlert> {
    const id = randomUUID();
    const scoreText = `${state.awayScore}-${state.homeScore}`;
    const title = `${alert.type.toUpperCase()} (${scoreText})`;
    // Simple description: sports can override or extend this pattern.
    let description = `${state.awayTeam} @ ${state.homeTeam} — ${scoreText}`;
    if (alert.reasons && alert.reasons.length > 0) {
      description += `\n${alert.reasons.join('; ')}`;
    }
    let refinedTitle = title;
    let refinedDesc = description;
    if (this.aiEngine) {
      try {
        // Hypothetical call to an AI engine.  In this skeleton we simply
        // return the original strings.  Integrators should call their
        // provider here.
        // const result = await this.aiEngine.rewriteAlert(title, description);
        // refinedTitle = result.title;
        // refinedDesc = result.description;
      } catch (err) {
        console.warn('AI enrichment failed:', err);
      }
    }
    const gameInfo = {
      gameId: state.gameId,
      homeTeam: state.homeTeam,
      awayTeam: state.awayTeam,
      score: { home: state.homeScore, away: state.awayScore },
      situation: alert.type
    };
    return {
      ...alert,
      id,
      title: refinedTitle,
      description: refinedDesc,
      gameInfo,
      timestamp: new Date()
    };
  }
}

/**
 * Betting Insights Layer
 *
 * Connects to an external service (Betbook) to attach betting advice to
 * alerts.  The insights are merged into the alert object under the
 * `betbookData` field.  Errors are swallowed so they don’t block alerting.
 */
export class BettingInsights {
  async attach(alert: EnrichedAlert): Promise<EnrichedAlert> {
    try {
      const { gameInfo } = alert;
      const data = await getBetbookData({
        sport: alert.sport,
        gameId: gameInfo.gameId,
        homeTeam: gameInfo.homeTeam,
        awayTeam: gameInfo.awayTeam,
        homeScore: gameInfo.score.home,
        awayScore: gameInfo.score.away,
        probability: alert.probability
      });
      return { ...alert, betbookData: data };
    } catch (err) {
      console.error('Betbook integration failed:', err);
      return alert;
    }
  }
}

/**
 * Delivery Layer
 *
 * Responsible for persisting alerts, notifying users via WebSocket and
 * optionally sending external notifications (e.g. Telegram).  Consumers
 * can provide a callback to broadcast alerts to connected clients.
 */
export type DeliveryCallback = (alert: EnrichedAlert) => void;

export class AlertDelivery {
  constructor(private broadcast: DeliveryCallback | null = null) {}

  async deliver(alert: EnrichedAlert): Promise<void> {
    // Persist to storage
    await storage.createAlert(alert);
    // Broadcast to clients via WebSocket (if callback provided)
    if (this.broadcast) {
      this.broadcast(alert);
    }
    // Optionally send Telegram notifications per user settings.
    // Settings lookup is omitted here for brevity; integrate with storage as needed.
    try {
      // const userSettings = await storage.getSettingsBySport(alert.sport);
      // if (userSettings?.telegramEnabled) {
      //   await sendTelegramAlert({
      //     botToken: process.env.TELEGRAM_TOKEN || '',
      //     chatId: process.env.CHAT_ID || '',
      //   }, alert);
      // }
    } catch (err) {
      console.error('Telegram delivery failed:', err);
    }
  }
}

/**
 * Alert Pipeline
 *
 * Combines all the layers into a single orchestrator.  Given a game state,
 * it detects alerts, enriches them, attaches betting insights and
 * finally delivers them.  It also implements simple deduplication and
 * respects sport‑specific user settings.  Sport engines can call
 * `processState()` each time they receive a fresh snapshot.
 */
export class AlertPipeline {
  private monitor = new GameMonitor();
  private detector = new AlertDetector();
  private enricher: AlertEnricher;
  private betting = new BettingInsights();
  private delivery: AlertDelivery;
  private dedupCache = new Map<string, number>();
  private cooldownMs = 120000; // 2 minutes by default

  constructor(aiEngine: any | null = null, broadcast: DeliveryCallback | null = null) {
    this.enricher = new AlertEnricher(aiEngine);
    this.delivery = new AlertDelivery(broadcast);
  }

  /**
   * Register a detection model.  This forwards to the internal detector.
   */
  registerModel(sport: string, fn: DetectionFn): void {
    this.detector.registerModel(sport, fn);
  }

  /**
   * Update the current game state.  The pipeline stores it and runs
   * detection, enrichment and delivery if warranted.
   */
  async processState(state: GenericGameState): Promise<void> {
    // Update internal cache
    this.monitor.updateGameState(state);
    // Run detection
    const result = await this.detector.detect(state);
    if (!result.shouldAlert) return;
    // Deduplication by gameId + alertType + priority
    const key = `${state.gameId}:${result.alertType}`;
    const now = Date.now();
    const last = this.dedupCache.get(key) || 0;
    if (now - last < this.cooldownMs) {
      return;
    }
    this.dedupCache.set(key, now);
    // Build base alert
    const base: BaseAlert = {
      type: result.alertType,
      sport: state.sport,
      priority: result.priority,
      probability: result.probability,
      reasons: result.reasons
    };
    // Enrich
    const enriched = await this.enricher.enrich(base, state);
    // Attach betting insights
    const withInsights = await this.betting.attach(enriched);
    // Deliver
    await this.delivery.deliver(withInsights);
  }
}

// Example model registration (these will be registered by sport engines)
// Below is an example for MLB using the mlbAlertModel.cjs.  Engines
// should register similar functions for NCAAF, NBA, etc.

/*
const pipeline = new AlertPipeline(null, (alert) => {
  console.log('Broadcast alert:', alert);
});
import('./services/engines/mlbAlertModel.cjs').then(mod => {
  pipeline.registerModel('MLB', async (state) => {
    const res = mod.checkScoringProbability(state);
    return {
      shouldAlert: res.shouldAlert,
      alertType: 'MLB_SCORING',
      probability: res.probability,
      priority: res.priority,
      reasons: res.reasons,
    };
  });
});
*/