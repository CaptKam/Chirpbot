/**
 * NCAAF Event Stream Processor
 * 
 * Preserves ALL existing NCAAF alert logic while providing event-driven
 * processing capabilities. Integrates with existing NCAAFEngine, alert
 * modules, settings system, and performance tracking.
 * 
 * Shadow Mode Features:
 * - Runs parallel to existing system without user impact
 * - Compares results with legacy system for validation
 * - Maintains full backward compatibility
 * - Preserves all deduplication and cooldown logic
 * - Integrates with unified settings system
 */

import { BaseProcessor } from './base-processor';
import type { 
  ProcessorContext, 
  ProcessorResult, 
  ProcessorConfig,
  GameStateChangedEvent,
  AlertGeneratedEvent
} from './types';
import type { GameState, AlertResult } from '../engines/base-engine';

// Import existing NCAAF system components
import { NCAAFEngine } from '../engines/ncaaf-engine';
import { getUnifiedSettings } from '../unified-settings';

// Import specific NCAAF alert modules for direct access
import CloseGameModule from '../engines/alert-cylinders/ncaaf/close-game-module';
import ComebackPotentialModule from '../engines/alert-cylinders/ncaaf/comeback-potential-module';
import FourthDownDecisionModule from '../engines/alert-cylinders/ncaaf/fourth-down-decision-module';
import FourthQuarterModule from '../engines/alert-cylinders/ncaaf/fourth-quarter-module';
import GameStartModule from '../engines/alert-cylinders/ncaaf/game-start-module';
import HalftimeModule from '../engines/alert-cylinders/ncaaf/halftime-module';
import MassiveWeatherModule from '../engines/alert-cylinders/ncaaf/massive-weather-module';
import RedZoneEfficiencyModule from '../engines/alert-cylinders/ncaaf/red-zone-efficiency-module';
import RedZoneModule from '../engines/alert-cylinders/ncaaf/red-zone-module';
import ScoringPlayModule from '../engines/alert-cylinders/ncaaf/scoring-play-module';
import SecondHalfKickoffModule from '../engines/alert-cylinders/ncaaf/second-half-kickoff-module';
import TwoMinuteWarningModule from '../engines/alert-cylinders/ncaaf/two-minute-warning-module';
import UpsetOpportunityModule from '../engines/alert-cylinders/ncaaf/upset-opportunity-module';

export class NCAAFProcessor extends BaseProcessor {
  private readonly ncaafEngine: NCAAFEngine;
  private readonly alertModules = new Map<string, any>();
  
  // Performance and deduplication tracking (mirrors existing system)
  private readonly sentAlerts = new Map<string, Set<string>>(); // gameId -> Set of alertKeys
  private readonly alertTimestamps = new Map<string, number>(); // alertKey -> timestamp
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes cooldown per alert
  private readonly CLEANUP_INTERVAL_MS = 600000; // Clean up old entries every 10 minutes
  private lastCleanup = Date.now();
  
  // Shadow mode comparison data
  private comparisonResults: Array<{
    gameId: string;
    timestamp: number;
    legacyAlerts: AlertResult[];
    eventStreamAlerts: AlertResult[];
    differences: any;
  }> = [];

  constructor(id: string = 'ncaaf_processor', sport: string = 'NCAAF') {
    super(id, sport);
    
    // Initialize with existing NCAAF engine
    this.ncaafEngine = new NCAAFEngine();
    
    // Initialize all NCAAF alert modules
    this.initializeAlertModules();
    
    console.log(`🏈 NCAAF Event Stream Processor initialized with ${this.alertModules.size} alert modules`);
  }

  /**
   * Initialize all NCAAF alert modules (same as existing system)
   */
  private initializeAlertModules(): void {
    const modules = [
      { name: 'NCAAF_CLOSE_GAME', module: CloseGameModule },
      { name: 'NCAAF_COMEBACK_POTENTIAL', module: ComebackPotentialModule },
      { name: 'NCAAF_FOURTH_DOWN_DECISION', module: FourthDownDecisionModule },
      { name: 'NCAAF_FOURTH_QUARTER', module: FourthQuarterModule },
      { name: 'NCAAF_GAME_START', module: GameStartModule },
      { name: 'NCAAF_HALFTIME', module: HalftimeModule },
      { name: 'NCAAF_MASSIVE_WEATHER', module: MassiveWeatherModule },
      { name: 'NCAAF_RED_ZONE_EFFICIENCY', module: RedZoneEfficiencyModule },
      { name: 'NCAAF_RED_ZONE', module: RedZoneModule },
      { name: 'NCAAF_SCORING_PLAY', module: ScoringPlayModule },
      { name: 'NCAAF_SECOND_HALF_KICKOFF', module: SecondHalfKickoffModule },
      { name: 'NCAAF_TWO_MINUTE_WARNING', module: TwoMinuteWarningModule },
      { name: 'NCAAF_UPSET_OPPORTUNITY', module: UpsetOpportunityModule }
    ];

    for (const { name, module: ModuleClass } of modules) {
      try {
        const moduleInstance = new ModuleClass();
        this.alertModules.set(name, moduleInstance);
        
        if (this.config.shadowMode) {
          this.log('debug', `Loaded alert module: ${name}`);
        }
      } catch (error) {
        this.log('error', `Failed to load alert module ${name}:`, error);
      }
    }
  }

  /**
   * Check if an alert has already been sent recently (prevents duplicates)
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.log('debug', `Duplicate alert blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }

    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= 50) { // MAX_ALERTS_PER_GAME
      this.log('warn', `Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
      return true;
    }

    return false;
  }

  /**
   * Mark an alert as sent
   */
  private markAlertSent(gameId: string, alertKey: string): void {
    if (!this.sentAlerts.has(gameId)) {
      this.sentAlerts.set(gameId, new Set());
    }
    this.sentAlerts.get(gameId)!.add(alertKey);
    this.alertTimestamps.set(alertKey, Date.now());
    
    this.log('debug', `Alert tracked: ${alertKey} for game ${gameId}`);
    this.cleanupOldAlerts();
  }

  /**
   * Clean up old alert tracking data to prevent memory leaks
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) {
      return;
    }

    let removedCount = 0;
    for (const [alertKey, timestamp] of this.alertTimestamps.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN_MS) {
        this.alertTimestamps.delete(alertKey);
        removedCount++;
      }
    }

    const oneHourAgo = now - 3600000;
    for (const [gameId, alerts] of this.sentAlerts.entries()) {
      let hasRecentAlert = false;
      for (const alertKey of alerts) {
        const timestamp = this.alertTimestamps.get(alertKey);
        if (timestamp && timestamp > oneHourAgo) {
          hasRecentAlert = true;
          break;
        }
      }

      if (!hasRecentAlert) {
        this.sentAlerts.delete(gameId);
      }
    }

    this.lastCleanup = now;
    this.log('debug', `Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  /**
   * Process game state change event
   */
  async processGameStateChanged(event: GameStateChangedEvent, context: ProcessorContext): Promise<ProcessorResult> {
    const startTime = Date.now();
    
    try {
      this.log('debug', `Processing game state change for game ${event.payload.gameId}`);
      
      // Delegate to existing NCAAF engine for alert generation
      const alerts = await this.ncaafEngine.generateLiveAlerts(event.payload.currentState);
      
      const filteredAlerts: AlertResult[] = [];
      
      // Apply deduplication and cooldown logic
      for (const alert of alerts) {
        const alertKey = `${event.payload.gameId}_${alert.type}_${alert.message}`;
        
        if (!this.hasAlertBeenSent(event.payload.gameId, alertKey)) {
          filteredAlerts.push(alert);
          this.markAlertSent(event.payload.gameId, alertKey);
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Shadow mode logging
      if (this.config.shadowMode) {
        this.log('info', `[Shadow][ncaaf_processor] Processed ${filteredAlerts.length} alerts for game ${event.payload.gameId} in ${processingTime}ms`);
        
        if (filteredAlerts.length > 0) {
          this.log('info', `[Shadow][ncaaf_processor] Alert types: ${filteredAlerts.map(a => a.type).join(', ')}`);
        }
      }

      return {
        success: true,
        alerts: filteredAlerts,
        processingTimeMs: processingTime,
        metadata: {
          gameId: event.payload.gameId,
          sport: this.sport,
          engineUsed: 'NCAAFEngine',
          shadowMode: this.config.shadowMode,
          totalAlertsConsidered: alerts.length,
          alertsAfterDeduplication: filteredAlerts.length
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.log('error', `Error processing NCAAF game state change:`, error);
      
      return {
        success: false,
        alerts: [],
        processingTimeMs: processingTime,
        error: error instanceof Error ? error : new Error('Unknown error'),
        metadata: {
          gameId: event.payload.gameId,
          sport: this.sport,
          errorDetails: error
        }
      };
    }
  }

  /**
   * Process alert generated event (for comparison/validation)
   */
  async processAlertGenerated(event: AlertGeneratedEvent, context: ProcessorContext): Promise<ProcessorResult> {
    // In shadow mode, we can use this to compare our results with legacy system
    if (this.config.shadowMode) {
      this.log('debug', `[Shadow][ncaaf_processor] Received alert: ${event.payload.alertResult.type} for game ${event.payload.gameId}`);
    }

    return {
      success: true,
      alerts: [],
      processingTimeMs: 0,
      metadata: {
        gameId: event.payload.gameId,
        alertType: event.payload.alertResult.type,
        shadowMode: this.config.shadowMode
      }
    };
  }

  /**
   * Get default processor configuration
   */
  protected getDefaultConfig(): Partial<ProcessorConfig> {
    return {
      maxConcurrency: 3,
      timeout: 10000,
      retryConfig: {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitter: true
      },
      circuitBreakerConfig: {
        failureThreshold: 3,
        recoveryTimeoutMs: 30000,
        monitoringWindowMs: 180000,
        minimumRequests: 5,
        errorRateThreshold: 0.4
      }
    };
  }

  /**
   * Get supported alert types
   */
  protected getSupportedAlertTypes(): string[] {
    return Array.from(this.alertModules.keys());
  }

  /**
   * Core alert generation logic - preserves existing NCAAF engine behavior
   */
  protected async generateAlerts(gameState: GameState, context: ProcessorContext): Promise<AlertResult[]> {
    try {
      // Delegate to existing NCAAF engine for alert generation
      const alerts = await this.ncaafEngine.generateLiveAlerts(gameState);
      
      // Apply deduplication and cooldown logic
      const filteredAlerts: AlertResult[] = [];
      
      for (const alert of alerts) {
        const alertKey = `${gameState.gameId}_${alert.type}_${alert.message}`;
        
        if (!this.hasAlertBeenSent(gameState.gameId, alertKey)) {
          filteredAlerts.push(alert);
          this.markAlertSent(gameState.gameId, alertKey);
        }
      }

      if (this.config.shadowMode && filteredAlerts.length > 0) {
        this.log('info', `Generated ${filteredAlerts.length} NCAAF alerts for game ${gameState.gameId}`);
      }

      return filteredAlerts;
      
    } catch (error) {
      this.log('error', `Error generating NCAAF alerts:`, error);
      return [];
    }
  }

  /**
   * Get processor health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      processorId: this.id,
      sport: this.sport,
      isHealthy: true,
      alertModulesLoaded: this.alertModules.size,
      expectedModules: 13,
      sentAlertsCount: this.alertTimestamps.size,
      gamesTracked: this.sentAlerts.size,
      lastCleanup: this.lastCleanup,
      shadowMode: this.config.shadowMode,
      engineType: 'NCAAFEngine'
    };
  }

  /**
   * Custom logging with NCAAF processor prefix
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const prefix = this.config.shadowMode ? '[Shadow][ncaaf_processor]' : '[ncaaf_processor]';
    console.log(`${prefix} ${message}`, ...args);
  }
}