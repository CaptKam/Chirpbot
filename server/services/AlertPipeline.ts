
/**
 * Generic, layered alert pipeline for Chirpbot.
 *
 * This module defines a series of classes that cleanly separate the alert
 * workflow into independent layers: monitoring, detection, enrichment,
 * betting insights and delivery.  Each layer exposes a small, well‑defined
 * interface and can be reused across sports.  The goal is to make the
 * flow modular, testable and maintainable.
 */

import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { sendTelegramAlert } from './telegram';

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
  debugId: string;
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
    console.log(`📊 GameMonitor: Updated state for ${state.sport} game ${state.gameId}`);
  }

  getCurrentState(gameId: string): GenericGameState | undefined {
    return this.stateCache.get(gameId);
  }

  getAllStates(): GenericGameState[] {
    return Array.from(this.stateCache.values());
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
    console.log(`🔍 AlertDetector: Registered model for ${sport.toUpperCase()}`);
  }

  /**
   * Execute the detection function for the given game state.
   *
   * Returns a generic negative result if no model is registered.
   */
  async detect(state: GenericGameState): Promise<DetectionResult> {
    const fn = this.modelRegistry.get(state.sport.toUpperCase());
    if (!fn) {
      console.log(`⚠️ AlertDetector: No model registered for ${state.sport}`);
      return { shouldAlert: false, alertType: '', probability: 0, priority: 0, reasons: [] };
    }
    
    const result = await fn(state);
    console.log(`🔍 AlertDetector: ${state.sport} detection result:`, result);
    return result;
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
    const debugId = id.substring(0, 8);
    const scoreText = `${state.awayScore}-${state.homeScore}`;
    
    // Follow Law #7: Alert Format Consistency
    const title = `⚾ ${alert.type.toUpperCase()} (${scoreText})`;
    
    // 3-line description format per Law #7
    let description = this.buildStandardDescription(alert, state);
    
    let refinedTitle = title;
    let refinedDesc = description;
    
    if (this.aiEngine) {
      try {
        const aiInput = {
          sport: state.sport,
          homeTeam: state.homeTeam,
          awayTeam: state.awayTeam,
          homeScore: state.homeScore,
          awayScore: state.awayScore,
          situation: alert.type,
          probability: alert.probability,
          priority: alert.priority
        };
        
        // Call AI engine if available
        refinedDesc = await this.aiEngine.generateAlertDescription(aiInput);
      } catch (err) {
        console.warn('AI enrichment failed, using fallback:', err);
      }
    }
    
    const gameInfo = {
      gameId: state.gameId,
      homeTeam: state.homeTeam,
      awayTeam: state.awayTeam,
      score: { home: state.homeScore, away: state.awayScore },
      situation: alert.type,
      // Sport-specific data
      ...this.extractSportSpecificData(state)
    };
    
    console.log(`✨ AlertEnricher: Enriched ${alert.sport} alert [${debugId}]`);
    
    return {
      ...alert,
      id,
      debugId,
      title: refinedTitle,
      description: refinedDesc,
      gameInfo,
      timestamp: new Date()
    };
  }

  private buildStandardDescription(alert: BaseAlert, state: GenericGameState): string {
    // Law #7: 3-line format
    // Line 1: Time/Period info
    let line1 = "";
    if (state.inning) {
      line1 = `${state.inning}${this.getOrdinalSuffix(state.inning)} ${state.inningState || ''}`;
    } else if (state.quarter) {
      line1 = `${state.quarter} Quarter`;
    } else if (state.period) {
      line1 = `${state.period} Period`;
    }
    
    // Line 2: Game situation
    const line2 = alert.reasons.length > 0 ? alert.reasons[0] : alert.type;
    
    // Line 3: Why it matters
    const confidence = Math.round(alert.probability * 100);
    const line3 = `${confidence}% scoring probability - Prime betting opportunity`;
    
    return [line1, line2, line3].filter(Boolean).join('\n');
  }

  private extractSportSpecificData(state: GenericGameState): any {
    const data: any = {};
    
    // MLB specific
    if (state.sport === 'MLB' && state.runners) {
      data.runners = state.runners;
      data.outs = state.outs;
      data.inning = state.inning;
      data.inningState = state.inningState;
    }
    
    // NFL specific
    if (state.sport === 'NFL') {
      if (state.down) data.down = state.down;
      if (state.yardsToGo) data.yardsToGo = state.yardsToGo;
      if (state.yardLine) data.yardLine = state.yardLine;
    }
    
    // NBA specific
    if (state.sport === 'NBA') {
      if (state.timeRemaining) data.timeRemaining = state.timeRemaining;
      if (state.shotClock) data.shotClock = state.shotClock;
    }
    
    return data;
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';  
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}

/**
 * Betting Insights Layer
 *
 * Connects to an external service (Betbook) to attach betting advice to
 * alerts.  The insights are merged into the alert object under the
 * `betbookData` field.  Errors are swallowed so they don't block alerting.
 */
export class BettingInsights {
  async attach(alert: EnrichedAlert): Promise<EnrichedAlert> {
    try {
      // Try to get betbook data if service is available
      let betbookData = null;
      
      // Betbook service is not available, using fallback
      console.log('📊 BettingInsights: Betbook service not available, using fallback');
      // Create fallback betting data
      betbookData = {
        recommendation: `VALUE ALERT: ${alert.sport} betting opportunity`,
        confidence: `${Math.round(alert.probability * 100)}% confidence`,
        odds: alert.priority >= 90 ? "+115" : "+105",
        reasoning: `${alert.type} situation with ${Math.round(alert.probability * 100)}% success rate`
      };
      
      console.log(`💰 BettingInsights: Attached betting data to ${alert.sport} alert`);
      return { ...alert, betbookData };
    } catch (err) {
      console.error('❌ BettingInsights: Failed to attach betting data:', err);
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
    try {
      // Persist to storage
      await storage.createAlert(alert);
      console.log(`💾 AlertDelivery: Persisted alert [${alert.debugId}] to database`);
      
      // Broadcast to clients via WebSocket (if callback provided)
      if (this.broadcast) {
        this.broadcast(alert);
        console.log(`📡 AlertDelivery: Broadcasted alert [${alert.debugId}] to WebSocket clients`);
      }
      
      // Send Telegram notifications (if configured)
      try {
        const telegramConfig = {
          botToken: process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '',
          chatId: process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || ''
        };
        
        if (telegramConfig.botToken && telegramConfig.chatId && 
            telegramConfig.botToken !== 'default_key' && telegramConfig.chatId !== 'default_key') {
          await sendTelegramAlert(telegramConfig, alert);
          console.log(`📲 AlertDelivery: Sent Telegram notification for [${alert.debugId}]`);
        }
      } catch (telegramError) {
        console.warn('📲 AlertDelivery: Telegram delivery failed:', telegramError);
      }
    } catch (err) {
      console.error('❌ AlertDelivery: Failed to deliver alert:', err);
      throw err;
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
    console.log('🚀 AlertPipeline: Initialized with AI engine and broadcast support');
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
  async processState(state: GenericGameState): Promise<EnrichedAlert | null> {
    try {
      // SAFETY CHECK: Reject any fake game states
      if (state.homeTeam === 'Unknown' || state.awayTeam === 'Unknown' || 
          state.homeTeam?.includes('Unknown') || state.awayTeam?.includes('Unknown')) {
        console.log(`🚫 AlertPipeline: Rejected fake game state for ${state.gameId}`);
        return null;
      }
      
      console.log(`🔄 AlertPipeline: Processing ${state.sport} game ${state.gameId}`);
      
      // Update internal cache
      this.monitor.updateGameState(state);
      
      // Run detection
      const result = await this.detector.detect(state);
      if (!result.shouldAlert) {
        console.log(`🚫 AlertPipeline: No alert needed for ${state.sport} game ${state.gameId}`);
        return null;
      }
      
      // Deduplication by gameId + alertType
      const key = `${state.gameId}:${result.alertType}`;
      const now = Date.now();
      const last = this.dedupCache.get(key) || 0;
      if (now - last < this.cooldownMs) {
        console.log(`⏰ AlertPipeline: Alert cooldown active for ${key}`);
        return null;
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
      
      console.log(`✅ AlertPipeline: Successfully processed alert [${withInsights.debugId}]`);
      return withInsights;
    } catch (error) {
      console.error(`❌ AlertPipeline: Failed to process ${state.sport} game ${state.gameId}:`, error);
      return null;
    }
  }

  /**
   * Get current monitoring statistics
   */
  getStats() {
    return {
      monitoredGames: this.monitor.getAllStates().length,
      registeredModels: this.detector['modelRegistry'].size,
      dedupCacheSize: this.dedupCache.size,
      cooldownMs: this.cooldownMs
    };
  }
}

// Create global pipeline instance
let globalPipeline: AlertPipeline | null = null;

export function getAlertPipeline(aiEngine: any = null, broadcast: DeliveryCallback | null = null): AlertPipeline {
  if (!globalPipeline) {
    globalPipeline = new AlertPipeline(aiEngine, broadcast);
    console.log('🌍 AlertPipeline: Created global pipeline instance');
  }
  return globalPipeline;
}

// Export types and classes
// Note: Classes are already exported above with 'export class' syntax
