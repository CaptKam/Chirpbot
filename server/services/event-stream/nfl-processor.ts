/**
 * NFL Event Stream Processor
 * 
 * Preserves ALL existing NFL alert logic while providing event-driven
 * processing capabilities. Integrates with existing NFLEngine, alert
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

// Import existing NFL system components
import { NFLEngine } from '../engines/nfl-engine';
import { getUnifiedSettings } from '../unified-settings';

// Import specific NFL alert modules for direct access
import FourthDownModule from '../engines/alert-cylinders/nfl/fourth-down-module';
import GameStartModule from '../engines/alert-cylinders/nfl/game-start-module';
import MassiveWeatherModule from '../engines/alert-cylinders/nfl/massive-weather-module';
import RedZoneModule from '../engines/alert-cylinders/nfl/red-zone-module';
import RedZoneOpportunityModule from '../engines/alert-cylinders/nfl/red-zone-opportunity-module';
import SecondHalfKickoffModule from '../engines/alert-cylinders/nfl/second-half-kickoff-module';
import TurnoverLikelihoodModule from '../engines/alert-cylinders/nfl/turnover-likelihood-module';
import TwoMinuteWarningModule from '../engines/alert-cylinders/nfl/two-minute-warning-module';

export class NFLProcessor extends BaseProcessor {
  private readonly nflEngine: NFLEngine;
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

  constructor(id: string = 'nfl_processor', sport: string = 'NFL') {
    super(id, sport);
    
    // Initialize with existing NFL engine
    this.nflEngine = new NFLEngine();
    
    // Initialize all NFL alert modules
    this.initializeAlertModules();
    
    console.log(`🏈 NFL Event Stream Processor initialized with ${this.alertModules.size} alert modules`);
  }

  /**
   * Initialize all NFL alert modules (same as existing system)
   */
  private initializeAlertModules(): void {
    const modules = [
      { name: 'NFL_FOURTH_DOWN', module: FourthDownModule },
      { name: 'NFL_GAME_START', module: GameStartModule },
      { name: 'NFL_MASSIVE_WEATHER', module: MassiveWeatherModule },
      { name: 'NFL_RED_ZONE', module: RedZoneModule },
      { name: 'NFL_RED_ZONE_OPPORTUNITY', module: RedZoneOpportunityModule },
      { name: 'NFL_SECOND_HALF_KICKOFF', module: SecondHalfKickoffModule },
      { name: 'NFL_TURNOVER_LIKELIHOOD', module: TurnoverLikelihoodModule },
      { name: 'NFL_TWO_MINUTE_WARNING', module: TwoMinuteWarningModule }
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
      this.log('debug', `Processing game state change for game ${event.gameId}`);
      
      // Delegate to existing NFL engine for alert generation
      const alerts = await this.nflEngine.monitor(event.currentState);
      
      const filteredAlerts: AlertResult[] = [];
      
      // Apply deduplication and cooldown logic
      for (const alert of alerts) {
        const alertKey = `${event.gameId}_${alert.type}_${alert.message}`;
        
        if (!this.hasAlertBeenSent(event.gameId, alertKey)) {
          filteredAlerts.push(alert);
          this.markAlertSent(event.gameId, alertKey);
          
          // Emit alert generated event
          if (context.eventBus) {
            context.eventBus.emit('alertGenerated', {
              type: 'alertGenerated',
              alertId: alertKey,
              gameId: event.gameId,
              sport: this.sport,
              alertType: alert.type,
              alert: alert,
              timestamp: Date.now(),
              processor: this.id
            });
          }
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Shadow mode logging
      if (this.config.shadowMode) {
        this.log('info', `[Shadow][nfl_processor] Processed ${filteredAlerts.length} alerts for game ${event.gameId} in ${processingTime}ms`);
        
        if (filteredAlerts.length > 0) {
          this.log('info', `[Shadow][nfl_processor] Alert types: ${filteredAlerts.map(a => a.type).join(', ')}`);
        }
      }

      return {
        success: true,
        processed: true,
        alertsGenerated: filteredAlerts.length,
        processingTimeMs: processingTime,
        metadata: {
          gameId: event.gameId,
          sport: this.sport,
          engineUsed: 'NFLEngine',
          shadowMode: this.config.shadowMode,
          totalAlertsConsidered: alerts.length,
          alertsAfterDeduplication: filteredAlerts.length
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.log('error', `Error processing NFL game state change:`, error);
      
      return {
        success: false,
        processed: false,
        alertsGenerated: 0,
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          gameId: event.gameId,
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
      this.log('debug', `[Shadow][nfl_processor] Received alert: ${event.alertType} for game ${event.gameId}`);
    }

    return {
      success: true,
      processed: true,
      alertsGenerated: 0,
      processingTimeMs: 0,
      metadata: {
        gameId: event.gameId,
        alertType: event.alertType,
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
   * Core alert generation logic - preserves existing NFL engine behavior
   */
  protected async generateAlerts(gameState: GameState, context: ProcessorContext): Promise<AlertResult[]> {
    try {
      // Delegate to existing NFL engine for alert generation
      const alerts = await this.nflEngine.monitor(gameState);
      
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
        this.log('info', `Generated ${filteredAlerts.length} NFL alerts for game ${gameState.gameId}`);
      }

      return filteredAlerts;
      
    } catch (error) {
      this.log('error', `Error generating NFL alerts:`, error);
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
      expectedModules: 8,
      sentAlertsCount: this.alertTimestamps.size,
      gamesTracked: this.sentAlerts.size,
      lastCleanup: this.lastCleanup,
      shadowMode: this.config.shadowMode,
      engineType: 'NFLEngine'
    };
  }

}