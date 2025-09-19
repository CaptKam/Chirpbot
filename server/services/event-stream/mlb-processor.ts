/**
 * MLB Event Stream Processor
 * 
 * Preserves ALL existing MLB alert logic while providing event-driven
 * processing capabilities. Integrates with existing MLBEngine, alert
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

// Import existing MLB system components
import { MLBEngine } from '../engines/mlb-engine';
import { getUnifiedSettings } from '../unified-settings';
import { mlbPerformanceTracker } from '../engines/mlb-performance-tracker';

// Import specific MLB alert modules for direct access
import BasesLoadedNoOutsModule from '../engines/alert-cylinders/mlb/bases-loaded-no-outs-module';
import BasesLoadedOneOutModule from '../engines/alert-cylinders/mlb/bases-loaded-one-out-module';
import BasesLoadedTwoOutsModule from '../engines/alert-cylinders/mlb/bases-loaded-two-outs-module';
import FirstAndThirdNoOutsModule from '../engines/alert-cylinders/mlb/first-and-third-no-outs-module';
import FirstAndThirdOneOutModule from '../engines/alert-cylinders/mlb/first-and-third-one-out-module';
import FirstAndThirdTwoOutsModule from '../engines/alert-cylinders/mlb/first-and-third-two-outs-module';
import FirstAndSecondModule from '../engines/alert-cylinders/mlb/first-and-second-module';
import GameStartModule from '../engines/alert-cylinders/mlb/game-start-module';
import HighScoringSituationModule from '../engines/alert-cylinders/mlb/high-scoring-situation-module';
import LateInningCloseModule from '../engines/alert-cylinders/mlb/late-inning-close-module';
import PitchingChangeModule from '../engines/alert-cylinders/mlb/pitching-change-module';
import RunnerOnSecondNoOutsModule from '../engines/alert-cylinders/mlb/runner-on-second-no-outs-module';
import RunnerOnThirdNoOutsModule from '../engines/alert-cylinders/mlb/runner-on-third-no-outs-module';
import RunnerOnThirdOneOutModule from '../engines/alert-cylinders/mlb/runner-on-third-one-out-module';
import RunnerOnThirdTwoOutsModule from '../engines/alert-cylinders/mlb/runner-on-third-two-outs-module';
import ScoringOpportunityModule from '../engines/alert-cylinders/mlb/scoring-opportunity-module';
import SecondAndThirdNoOutsModule from '../engines/alert-cylinders/mlb/second-and-third-no-outs-module';
import SecondAndThirdOneOutModule from '../engines/alert-cylinders/mlb/second-and-third-one-out-module';
import SeventhInningStretchModule from '../engines/alert-cylinders/mlb/seventh-inning-stretch-module';
import StealLikelihoodModule from '../engines/alert-cylinders/mlb/steal-likelihood-module';
import StrikeoutModule from '../engines/alert-cylinders/mlb/strikeout-module';
import WindChangeModule from '../engines/alert-cylinders/mlb/wind-change-module';

export class MLBProcessor extends BaseProcessor {
  private readonly mlbEngine: MLBEngine;
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

  constructor(id: string = 'mlb_processor', sport: string = 'MLB') {
    super(id, sport);
    
    // Initialize with existing MLB engine
    this.mlbEngine = new MLBEngine();
    
    // Initialize all MLB alert modules
    this.initializeAlertModules();
    
    console.log(`🏟️ MLB Event Stream Processor initialized with ${this.alertModules.size} alert modules`);
  }

  /**
   * Initialize all MLB alert modules (same as existing system)
   */
  private initializeAlertModules(): void {
    const modules = [
      { name: 'MLB_BASES_LOADED_NO_OUTS', module: BasesLoadedNoOutsModule },
      { name: 'MLB_BASES_LOADED_ONE_OUT', module: BasesLoadedOneOutModule },
      { name: 'MLB_BASES_LOADED_TWO_OUTS', module: BasesLoadedTwoOutsModule },
      { name: 'MLB_FIRST_AND_THIRD_NO_OUTS', module: FirstAndThirdNoOutsModule },
      { name: 'MLB_FIRST_AND_THIRD_ONE_OUT', module: FirstAndThirdOneOutModule },
      { name: 'MLB_FIRST_AND_THIRD_TWO_OUTS', module: FirstAndThirdTwoOutsModule },
      { name: 'MLB_FIRST_AND_SECOND', module: FirstAndSecondModule },
      { name: 'MLB_GAME_START', module: GameStartModule },
      { name: 'MLB_HIGH_SCORING_SITUATION', module: HighScoringSituationModule },
      { name: 'MLB_LATE_INNING_CLOSE', module: LateInningCloseModule },
      { name: 'MLB_PITCHING_CHANGE', module: PitchingChangeModule },
      { name: 'MLB_RUNNER_ON_SECOND_NO_OUTS', module: RunnerOnSecondNoOutsModule },
      { name: 'MLB_RUNNER_ON_THIRD_NO_OUTS', module: RunnerOnThirdNoOutsModule },
      { name: 'MLB_RUNNER_ON_THIRD_ONE_OUT', module: RunnerOnThirdOneOutModule },
      { name: 'MLB_RUNNER_ON_THIRD_TWO_OUTS', module: RunnerOnThirdTwoOutsModule },
      { name: 'MLB_SCORING_OPPORTUNITY', module: ScoringOpportunityModule },
      { name: 'MLB_SECOND_AND_THIRD_NO_OUTS', module: SecondAndThirdNoOutsModule },
      { name: 'MLB_SECOND_AND_THIRD_ONE_OUT', module: SecondAndThirdOneOutModule },
      { name: 'MLB_SEVENTH_INNING_STRETCH', module: SeventhInningStretchModule },
      { name: 'MLB_STEAL_LIKELIHOOD', module: StealLikelihoodModule },
      { name: 'MLB_STRIKEOUT', module: StrikeoutModule },
      { name: 'MLB_WIND_CHANGE', module: WindChangeModule }
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
   * Core alert generation logic - preserves existing MLB engine behavior
   */
  protected async generateAlerts(gameState: GameState, context: ProcessorContext): Promise<AlertResult[]> {
    try {
      // Clean up old deduplication data periodically
      this.cleanupOldAlerts();
      
      // Update performance tracking (same as existing system)
      this.updateMLBPerformanceTracking(gameState);
      
      // Get enabled alert types from settings (same filtering as existing system)
      const enabledAlertTypes = await this.getEnabledAlertTypes();
      
      const alerts: AlertResult[] = [];
      const generatedAlertTypes: string[] = [];
      
      if (this.config.shadowMode) {
        this.log('debug', `Processing game ${gameState.gameId} with ${enabledAlertTypes.length} enabled alert types`);
      }
      
      // Process each enabled alert module (mirrors existing MLB engine logic)
      for (const alertType of enabledAlertTypes) {
        const module = this.alertModules.get(alertType);
        if (!module) continue;
        
        try {
          // Global settings check removed - allow all alert generation
          // Only user preferences will control actual alert delivery
          
          if (this.config.shadowMode) {
            this.log('debug', `🧪 Checking ${alertType} module for game ${gameState.gameId}`);
          }
          
          // Use same triggering logic as existing system
          if (module.isTriggered && module.isTriggered(gameState)) {
            const alert = module.generateAlert && module.generateAlert(gameState);
            
            if (alert) {
              // Apply same deduplication logic as existing system
              if (!this.isDuplicate(alert.alertKey, gameState.gameId)) {
                alerts.push(alert);
                generatedAlertTypes.push(alertType);
                this.recordAlert(alert.alertKey, gameState.gameId);
                
                if (this.config.shadowMode) {
                  this.log('info', `✅ Generated ${alertType} alert: ${alert.message}`);
                }
              } else if (this.config.shadowMode) {
                this.log('debug', `🚫 Duplicate alert filtered: ${alertType}`);
              }
            }
          } else if (this.config.shadowMode) {
            this.log('debug', `⏸️ ${alertType} not triggered for game ${gameState.gameId}`);
          }
          
        } catch (error) {
          this.log('error', `Error processing ${alertType} module:`, error);
          // Continue with other modules - don't let one failure stop all alerts
        }
      }
      
      if (this.config.shadowMode && alerts.length > 0) {
        this.log('info', `📊 Generated ${alerts.length} alerts for game ${gameState.gameId}: ${generatedAlertTypes.join(', ')}`);
      }
      
      return alerts;
      
    } catch (error) {
      this.log('error', `Critical error in MLB alert generation:`, error);
      throw error;
    }
  }

  /**
   * Get enabled alert types from settings (same logic as existing system)
   */
  private async getEnabledAlertTypes(): Promise<string[]> {
    try {
      const unifiedSettings = getUnifiedSettings();
      const enabledTypes = await unifiedSettings.getEnabledAlertTypes('mlb');
      return enabledTypes.filter(type => this.alertModules.has(type));
    } catch (error) {
      this.log('error', 'Error getting enabled alert types:', error);
      // Fallback to all available types
      return Array.from(this.alertModules.keys());
    }
  }

  /**
   * Update MLB performance tracking (same as existing MLBEngine)
   */
  private updateMLBPerformanceTracking(gameState: GameState): void {
    try {
      const gameId = gameState.gameId;
      const inning = gameState.inning || 1;
      const outs = gameState.outs || 0;
      
      // Track batter performance if we have current batter info (same logic as existing)
      if (gameState.currentBatter && gameState.lastPlay?.description) {
        const outcome = this.parsePlayOutcome(gameState.lastPlay.description);
        if (outcome) {
          const runnersInScoringPosition = gameState.hasSecond || gameState.hasThird;
          
          mlbPerformanceTracker.updateBatterPerformance(
            gameId,
            gameState.currentBatterId || `batter_${gameState.currentBatter.replace(/\s+/g, '_')}`,
            gameState.currentBatter,
            gameState.isTopInning ? gameState.awayTeam : gameState.homeTeam,
            {
              type: outcome.type,
              inning: inning,
              pitcher: gameState.currentPitcher || 'Unknown',
              pitchCount: gameState.pitchCount || 0,
              rbis: outcome.rbis,
              runnersOn: gameState.hasFirst || gameState.hasSecond || gameState.hasThird,
              runnersInScoringPosition: runnersInScoringPosition,
              outs: outs
            }
          );
        }
      }
      
      // Track pitcher performance (same logic as existing)
      if (gameState.currentPitcher && gameState.lastPitch?.call) {
        const pitchOutcome = this.parsePitchOutcome(gameState.lastPitch.call);
        if (pitchOutcome) {
          mlbPerformanceTracker.updatePitcherPerformance(
            gameId,
            gameState.currentPitcherId || `pitcher_${gameState.currentPitcher.replace(/\s+/g, '_')}`,
            gameState.currentPitcher,
            gameState.isTopInning ? gameState.homeTeam : gameState.awayTeam,
            {
              type: pitchOutcome.type,
              velocity: pitchOutcome.velocity,
              batter: gameState.currentBatter || 'Unknown',
              inning: inning,
              balls: gameState.balls || 0,
              strikes: gameState.strikes || 0,
              isFullCount: (gameState.balls === 3 && gameState.strikes === 2),
              isThreeBalls: (gameState.balls === 3)
            }
          );
        }
      }
      
    } catch (error) {
      this.log('error', 'Error updating MLB performance tracking:', error);
    }
  }

  /**
   * Parse play outcome (same logic as existing MLBEngine)
   */
  private parsePlayOutcome(description: string): { type: string; rbis: number } | null {
    if (!description) return null;
    
    const desc = description.toLowerCase();
    
    // Parse RBIs
    let rbis = 0;
    const rbiMatch = description.match(/(\d+)\s*rbi/i);
    if (rbiMatch) {
      rbis = parseInt(rbiMatch[1]);
    } else if (desc.includes('scores') || desc.includes('run')) {
      rbis = 1; // Default assumption
    }
    
    // Determine outcome type
    let type = 'unknown';
    if (desc.includes('single')) type = 'single';
    else if (desc.includes('double')) type = 'double';
    else if (desc.includes('triple')) type = 'triple';
    else if (desc.includes('home run') || desc.includes('homer')) type = 'home_run';
    else if (desc.includes('walk') || desc.includes('ball four')) type = 'walk';
    else if (desc.includes('strikeout') || desc.includes('struck out')) type = 'strikeout';
    else if (desc.includes('out')) type = 'out';
    else if (desc.includes('hit')) type = 'hit';
    
    return { type, rbis };
  }

  /**
   * Parse pitch outcome (same logic as existing MLBEngine)
   */
  private parsePitchOutcome(call: string): { type: string; velocity?: number } | null {
    if (!call) return null;
    
    const callLower = call.toLowerCase();
    let type = 'unknown';
    
    if (callLower.includes('ball')) type = 'ball';
    else if (callLower.includes('strike')) type = 'strike';
    else if (callLower.includes('foul')) type = 'foul';
    
    // Try to extract velocity
    let velocity: number | undefined;
    const velocityMatch = call.match(/(\d+(?:\.\d+)?)\s*mph/i);
    if (velocityMatch) {
      velocity = parseFloat(velocityMatch[1]);
    }
    
    return { type, velocity };
  }

  /**
   * Check for duplicate alerts (same logic as existing MLBEngine)
   */
  private isDuplicate(alertKey: string, gameId: string): boolean {
    const gameAlerts = this.sentAlerts.get(gameId);
    if (!gameAlerts) return false;
    
    if (gameAlerts.has(alertKey)) {
      const timestamp = this.alertTimestamps.get(alertKey);
      if (timestamp && (Date.now() - timestamp) < this.ALERT_COOLDOWN_MS) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Record alert for deduplication (same logic as existing MLBEngine)
   */
  private recordAlert(alertKey: string, gameId: string): void {
    if (!this.sentAlerts.has(gameId)) {
      this.sentAlerts.set(gameId, new Set());
    }
    
    this.sentAlerts.get(gameId)!.add(alertKey);
    this.alertTimestamps.set(alertKey, Date.now());
  }

  /**
   * Clean up old deduplication data (same logic as existing MLBEngine)
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) {
      return;
    }
    
    this.lastCleanup = now;
    const cutoff = now - this.ALERT_COOLDOWN_MS * 2; // Keep data for 2x cooldown period
    
    // Clean up old timestamps
    for (const [alertKey, timestamp] of this.alertTimestamps.entries()) {
      if (timestamp < cutoff) {
        this.alertTimestamps.delete(alertKey);
      }
    }
    
    // Clean up old game alert sets
    for (const [gameId, alertSet] of this.sentAlerts.entries()) {
      const alertsToRemove = new Set<string>();
      
      for (const alertKey of alertSet) {
        const timestamp = this.alertTimestamps.get(alertKey);
        if (!timestamp || timestamp < cutoff) {
          alertsToRemove.add(alertKey);
        }
      }
      
      for (const alertKey of alertsToRemove) {
        alertSet.delete(alertKey);
      }
      
      if (alertSet.size === 0) {
        this.sentAlerts.delete(gameId);
      }
    }
    
    if (this.config.shadowMode) {
      this.log('debug', `🧹 Cleaned up deduplication data: ${this.alertTimestamps.size} active timestamps`);
    }
  }

  /**
   * Enhanced validation for MLB-specific game states
   */
  validateGameState(gameState: GameState): boolean {
    if (!super.validateGameState(gameState)) return false;
    
    // MLB-specific validations
    if (typeof gameState.homeScore !== 'number' || gameState.homeScore < 0) return false;
    if (typeof gameState.awayScore !== 'number' || gameState.awayScore < 0) return false;
    
    // Optional MLB fields validation
    if (gameState.inning !== undefined) {
      if (typeof gameState.inning !== 'number' || gameState.inning < 1 || gameState.inning > 20) {
        return false;
      }
    }
    
    if (gameState.outs !== undefined) {
      if (typeof gameState.outs !== 'number' || gameState.outs < 0 || gameState.outs > 3) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Create MLB-specific mock game state for health checks
   */
  protected createMockGameState(): GameState {
    return {
      gameId: `mock_mlb_${Date.now()}`,
      sport: 'MLB',
      homeTeam: 'MockHome',
      awayTeam: 'MockAway',
      homeScore: 3,
      awayScore: 2,
      status: 'live',
      isLive: true,
      inning: 7,
      outs: 1,
      balls: 2,
      strikes: 1,
      hasFirst: false,
      hasSecond: true,
      hasThird: false,
      isTopInning: false,
      currentBatter: 'Mock Batter',
      currentPitcher: 'Mock Pitcher'
    };
  }

  /**
   * Get processor metrics including MLB-specific stats
   */
  getStats(): any {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      mlbSpecific: {
        loadedAlertModules: this.alertModules.size,
        trackedGames: this.sentAlerts.size,
        activeAlertTimestamps: this.alertTimestamps.size,
        cooldownPeriodMs: this.ALERT_COOLDOWN_MS,
        lastCleanup: new Date(this.lastCleanup).toISOString(),
        comparisonResults: this.comparisonResults.length
      }
    };
  }

  /**
   * Compare results with legacy system (for shadow mode validation)
   */
  async compareWithLegacySystem(
    gameState: GameState,
    eventStreamAlerts: AlertResult[],
    legacyAlerts?: AlertResult[]
  ): Promise<void> {
    if (!this.config.shadowMode || !legacyAlerts) return;
    
    const differences = this.analyzeAlertDifferences(eventStreamAlerts, legacyAlerts);
    
    if (Object.keys(differences).length > 0) {
      this.comparisonResults.push({
        gameId: gameState.gameId,
        timestamp: Date.now(),
        legacyAlerts,
        eventStreamAlerts,
        differences
      });
      
      this.log('warn', `🔍 Alert differences detected for game ${gameState.gameId}:`, differences);
    } else if (eventStreamAlerts.length > 0 || legacyAlerts.length > 0) {
      this.log('debug', `✅ Alert results match for game ${gameState.gameId}`);
    }
  }

  /**
   * Analyze differences between alert systems
   */
  private analyzeAlertDifferences(eventStreamAlerts: AlertResult[], legacyAlerts: AlertResult[]): any {
    const differences: any = {};
    
    // Compare alert counts
    if (eventStreamAlerts.length !== legacyAlerts.length) {
      differences.countMismatch = {
        eventStream: eventStreamAlerts.length,
        legacy: legacyAlerts.length
      };
    }
    
    // Compare alert types
    const eventStreamTypes = new Set(eventStreamAlerts.map(a => a.type));
    const legacyTypes = new Set(legacyAlerts.map(a => a.type));
    
    const missingInEventStream = Array.from(legacyTypes).filter(t => !eventStreamTypes.has(t));
    const extraInEventStream = Array.from(eventStreamTypes).filter(t => !legacyTypes.has(t));
    
    if (missingInEventStream.length > 0) {
      differences.missingInEventStream = missingInEventStream;
    }
    
    if (extraInEventStream.length > 0) {
      differences.extraInEventStream = extraInEventStream;
    }
    
    return differences;
  }

  /**
   * Get comparison results for analysis
   */
  getComparisonResults(): any[] {
    return [...this.comparisonResults];
  }

  /**
   * Clear comparison results
   */
  clearComparisonResults(): void {
    this.comparisonResults.length = 0;
    this.log('info', 'Cleared comparison results');
  }
}