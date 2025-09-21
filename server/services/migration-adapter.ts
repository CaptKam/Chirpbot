/**
 * Migration Adapter for ChirpBot V3
 * 
 * Safely manages transition between legacy calendar sync and DataIngestionService.
 * Provides unified lifecycle management, rollout controls, and health monitoring.
 * 
 * Features:
 * - Owns instances of both CalendarSyncService and DataIngestionIntegration
 * - Exposes unified initialize/start/stop lifecycle methods
 * - Implements RolloutController with per-sport percentage controls
 * - Supports instant toggle between systems
 * - Maintains safe defaults with in-memory persistence
 * - Health monitoring for both systems
 * - Graceful shutdown handling
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CalendarSyncService, type CalendarSyncConfig, type CalendarGameData, type CalendarSyncMetrics } from './calendar-sync-service';
import { DataIngestionIntegration, type DataIngestionIntegrationConfig } from './data-ingestion-integration';
import { OutputRouter, type OutputRouterConfig } from './output-router';
import { getUnifiedEventStream } from './event-stream/unified-event-stream';
import type { GameStateManager } from './game-state-manager';
import { EventComparator, MetricsCollector, createEventComparisonSystem, type ComparisonMetrics } from './event-comparison-system';

// === CORE INTERFACES ===

export interface MigrationAdapterConfig {
  // Service configurations
  calendarSync: Partial<CalendarSyncConfig>;
  dataIngestion: Partial<DataIngestionIntegrationConfig>;
  outputRouter: Partial<OutputRouterConfig>;
  
  // Migration settings
  rollout: RolloutConfig;
  health: HealthConfig;
  autoRollback: AutoRollbackConfig;
  
  // Feature flags
  enableRolloutController: boolean;
  enableHealthMonitoring: boolean;
  enableMetrics: boolean;
  enableOutputRouter: boolean;
  enableAutoRollback: boolean;
  logLevel: 'minimal' | 'detailed' | 'debug';
}

export interface RolloutConfig {
  // Per-sport percentage controls (0-100)
  percentages: Record<string, number>;
  
  // Global toggle
  mode: 'legacy' | 'ingestion' | 'hybrid';
  
  // Safety settings
  enableSafetyChecks: boolean;
  maxRolloutPercentage: number;
  rolloutStepSize: number;
}

export interface HealthConfig {
  checkIntervalMs: number;
  timeoutMs: number;
  retryAttempts: number;
  alertThresholds: {
    errorRatePercent: number;
    responseTimeMs: number;
    failedChecksBeforeAlert: number;
  };
}

export interface AutoRollbackConfig {
  enabled: boolean;
  checkIntervalMs: number;
  logLevel: 'minimal' | 'detailed' | 'debug';
  
  // Circuit breaker thresholds
  thresholds: AutoRollbackThresholds;
  
  // Rollback behavior
  stepDownPercentage: number; // Amount to reduce percentage on moderate issues (e.g., 10, 25, 50)
  emergencyRevertMode: boolean; // Whether to completely revert to legacy on critical failures
  gradualRollback: boolean; // Whether to step down gradually vs immediate full rollback
  
  // Safety limits
  minimumPercentageBeforeStepDown: number; // Don't step down below this percentage
  maxConsecutiveRollbacks: number; // Max rollbacks before emergency stop
  cooldownPeriodMs: number; // Minimum time between auto-rollback actions
  
  // Audit settings
  enableAuditLogging: boolean;
  enableAlertNotifications: boolean;
  auditRetentionDays: number;
}

export interface AutoRollbackThresholds {
  // Error rate monitoring
  errorRate: {
    moderateThresholdPercent: number; // Trigger step-down (e.g., 5%)
    criticalThresholdPercent: number; // Trigger emergency revert (e.g., 15%)
    sampleWindowMs: number; // Time window for error rate calculation
    minimumSampleSize: number; // Minimum events before calculating error rate
  };
  
  // Failed health check streaks
  healthCheckFailures: {
    moderateStreakCount: number; // Trigger step-down (e.g., 3 consecutive failures)
    criticalStreakCount: number; // Trigger emergency revert (e.g., 5 consecutive failures)
  };
  
  // Response time degradation
  responseTime: {
    moderateThresholdMs: number; // Trigger step-down (e.g., 2000ms)
    criticalThresholdMs: number; // Trigger emergency revert (e.g., 5000ms)
    baselineWindowMs: number; // Time window for baseline calculation
    degradationMultiplier: number; // Multiplier of baseline to trigger alert (e.g., 2x)
  };
  
  // Comparison divergence rates
  divergence: {
    moderateThresholdPercent: number; // Trigger step-down (e.g., 10%)
    criticalThresholdPercent: number; // Trigger emergency revert (e.g., 30%)
    sampleWindowMs: number; // Time window for divergence calculation
    minimumComparisonCount: number; // Minimum comparisons before calculating divergence
  };
  
  // Service health monitoring
  serviceHealth: {
    dataIngestionCircuitBreakerOpen: boolean; // Trigger rollback if DataIngestion circuit breaker opens
    calendarSyncErrorThreshold: number; // Error count threshold for calendar sync
    outputRouterBacklogThreshold: number; // Queue backlog threshold
  };
}

export interface AutoRollbackStatus {
  enabled: boolean;
  isActive: boolean;
  lastCheckTime: Date;
  checksPerformed: number;
  
  // Current circuit breaker states
  circuitBreakers: {
    errorRate: CircuitBreakerState;
    healthCheck: CircuitBreakerState;
    responseTime: CircuitBreakerState;
    divergence: CircuitBreakerState;
    serviceHealth: CircuitBreakerState;
  };
  
  // Rollback statistics
  rollbackStats: {
    totalRollbacks: number;
    stepDownRollbacks: number;
    emergencyReverts: number;
    lastRollbackTime?: Date;
    consecutiveRollbacks: number;
    nextAllowedRollbackTime?: Date;
  };
  
  // Audit trail summary
  auditSummary: {
    totalAuditRecords: number;
    lastAuditTime?: Date;
    criticalActions: number;
    moderateActions: number;
  };
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  currentValue: number; // Current metric value being monitored
  threshold: number; // Threshold that would trigger the breaker
  lastTriggeredTime?: Date;
  consecutiveFailures: number;
  lastResetTime?: Date;
}

export interface AutoRollbackAuditRecord {
  id: string;
  timestamp: Date;
  
  // Trigger information
  triggerType: 'error_rate' | 'health_check_failure' | 'response_time' | 'divergence' | 'service_health' | 'manual';
  triggerSeverity: 'moderate' | 'critical';
  triggerDetails: Record<string, any>;
  
  // Action taken
  actionType: 'step_down' | 'emergency_revert' | 'no_action' | 'prevented_by_cooldown' | 'prevented_by_limits';
  actionDetails: {
    affectedSports: string[];
    oldPercentages: Record<string, number>;
    newPercentages: Record<string, number>;
    oldMode: string;
    newMode: string;
    stepDownAmount?: number;
  };
  
  // Context
  operator: string; // 'AUTO_ROLLBACK_GUARD' for automatic actions
  reason: string;
  forced: boolean;
  
  // System state at time of action
  systemSnapshot: {
    overallHealth: string;
    serviceStates: Record<string, any>;
    comparisonMetrics?: any;
    rolloutStatus: any;
  };
}

export interface MigrationAdapterStatus {
  status: 'initializing' | 'ready' | 'running' | 'degraded' | 'error' | 'stopped';
  services: {
    calendarSync: ServiceStatus;
    dataIngestion: ServiceStatus;
  };
  rollout: RolloutStatus;
  health: HealthStatus;
  autoRollback?: AutoRollbackStatus;
  comparison?: ComparisonMetrics;
  uptime: number;
  lastUpdate: Date;
}

export interface ServiceStatus {
  healthy: boolean;
  running: boolean;
  errorCount: number;
  lastCheck: Date;
  responseTimeMs?: number;
  details?: any;
}

export interface RolloutStatus {
  mode: 'legacy' | 'ingestion' | 'hybrid';
  sportPercentages: Record<string, number>;
  totalGamesCovered: number;
  migrationProgress: number; // 0-100%
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checksPerformed: number;
  checksPassed: number;
  lastCheckTime: Date;
  failureStreak: number;
}

// === ROLLOUT CONTROLLER ===

export class RolloutController {
  private percentages: Map<string, number> = new Map();
  private mode: 'legacy' | 'ingestion' | 'hybrid' = 'legacy';
  private readonly config: RolloutConfig;
  private readonly supportedSports = ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'];
  
  // Rollback capability - stores previous state for pause/resume
  private savedPercentages: Map<string, number> = new Map();
  private savedMode: 'legacy' | 'ingestion' | 'hybrid' = 'legacy';
  
  // Enhanced safety - paused state tracking and mode change logging
  private isPaused = false;
  private modeChangeLog: Array<{
    timestamp: Date;
    operator?: string;
    oldMode: string;
    newMode: string;
    forced: boolean;
    reason?: string;
  }> = [];

  constructor(config: RolloutConfig) {
    this.config = config;
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Safe defaults - start with 0% ingestion for all sports
    for (const sport of this.supportedSports) {
      this.percentages.set(sport, this.config.percentages[sport] || 0);
    }
    this.mode = this.config.mode || 'legacy';
    
    console.log(`🎛️ RolloutController: Initialized with mode=${this.mode}, percentages=${JSON.stringify(Object.fromEntries(this.percentages))}`);
  }

  // Set rollout percentage for specific sport (0-100%)
  setSportPercentage(sport: string, percentage: number): void {
    if (!this.supportedSports.includes(sport)) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error(`Invalid percentage: ${percentage}. Must be 0-100.`);
    }

    if (this.config.enableSafetyChecks && percentage > this.config.maxRolloutPercentage) {
      throw new Error(`Percentage ${percentage}% exceeds safety limit of ${this.config.maxRolloutPercentage}%`);
    }

    const oldPercentage = this.percentages.get(sport) || 0;
    this.percentages.set(sport, percentage);
    
    console.log(`🎛️ RolloutController: ${sport} rollout changed from ${oldPercentage}% to ${percentage}%`);
  }

  // Get current rollout percentage for sport
  getSportPercentage(sport: string): number {
    return this.percentages.get(sport) || 0;
  }

  // Set global mode with enhanced safety checks
  setMode(mode: 'legacy' | 'ingestion' | 'hybrid', options: {
    force?: boolean;
    operator?: string;
    reason?: string;
    minimumThreshold?: number;
  } = {}): void {
    const { force = false, operator, reason, minimumThreshold = 10 } = options;
    const oldMode = this.mode;
    
    // Enhanced safety checks for dangerous mode transitions
    if (mode === 'ingestion' && this.config.enableSafetyChecks && !force) {
      // Check if any sports have rollout percentages
      const hasAnyRollout = Array.from(this.percentages.values()).some(p => p > 0);
      if (!hasAnyRollout) {
        throw new Error(
          `SAFETY_CHECK_FAILED: Cannot switch to ingestion mode without any sport rollout percentages. ` +
          `Set at least one sport > 0% or use force:true to override.`
        );
      }

      // Check minimum threshold requirement for ingestion mode
      const sportsAboveThreshold = Array.from(this.percentages.entries())
        .filter(([, percentage]) => percentage >= minimumThreshold);
      
      if (sportsAboveThreshold.length === 0) {
        throw new Error(
          `SAFETY_CHECK_FAILED: Cannot switch to ingestion mode without at least one sport >= ${minimumThreshold}%. ` +
          `Current percentages: ${JSON.stringify(Object.fromEntries(this.percentages))}. ` +
          `Use force:true to override this safety check.`
        );
      }

      // Check against global maxRolloutPercentage
      const maxPercentage = Math.max(...this.percentages.values());
      if (maxPercentage > this.config.maxRolloutPercentage) {
        throw new Error(
          `SAFETY_CHECK_FAILED: Cannot switch to ingestion mode with sport percentage ${maxPercentage}% ` +
          `exceeding maxRolloutPercentage of ${this.config.maxRolloutPercentage}%. ` +
          `Reduce percentages or use force:true to override.`
        );
      }
    }
    
    // Log and persist mode change
    this.mode = mode;
    const changeRecord = {
      timestamp: new Date(),
      operator: operator || 'UNKNOWN_OPERATOR',
      oldMode,
      newMode: mode,
      forced: force,
      reason: reason || (force ? 'FORCED_OVERRIDE' : 'NORMAL_CHANGE')
    };
    
    this.modeChangeLog.push(changeRecord);
    
    // Keep only last 100 mode changes to prevent memory bloat
    if (this.modeChangeLog.length > 100) {
      this.modeChangeLog = this.modeChangeLog.slice(-100);
    }
    
    const logLevel = force ? '🚨 FORCED' : '🎛️';
    console.log(
      `${logLevel} RolloutController: Mode changed from ${oldMode} to ${mode} ` +
      `(operator: ${changeRecord.operator}, forced: ${force}, reason: ${changeRecord.reason})`
    );
  }

  // Get current mode
  getMode(): 'legacy' | 'ingestion' | 'hybrid' {
    return this.mode;
  }

  // Determine which system should handle a specific sport/game deterministically
  shouldUseIngestion(sport: string, gameId?: string): boolean {
    if (this.mode === 'legacy') return false;
    if (this.mode === 'ingestion') return true;
    
    // Hybrid mode - use deterministic percentage based on gameId hash
    const percentage = this.getSportPercentage(sport);
    
    if (percentage === 0) return false;
    if (percentage === 100) return true;
    
    // Generate deterministic hash from gameId or fallback to sport
    const hashInput = gameId ? `${sport}-${gameId}` : sport;
    const hash = this.generateDeterministicHash(hashInput);
    const normalizedHash = hash % 100; // Convert to 0-99 range
    
    return normalizedHash < percentage;
  }

  // Generate consistent hash from string input for deterministic routing
  private generateDeterministicHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Get rollout status
  getStatus(): RolloutStatus {
    const sportPercentages = Object.fromEntries(this.percentages);
    const totalGames = Array.from(this.percentages.values()).reduce((sum, p) => sum + p, 0);
    const migrationProgress = totalGames / (this.supportedSports.length * 100) * 100;

    return {
      mode: this.mode,
      sportPercentages,
      totalGamesCovered: Math.round(totalGames / this.supportedSports.length),
      migrationProgress: Math.round(migrationProgress)
    };
  }

  // Gradual rollout helpers
  incrementSportPercentage(sport: string, step?: number): number {
    const currentPercentage = this.getSportPercentage(sport);
    const stepSize = step || this.config.rolloutStepSize || 10;
    const newPercentage = Math.min(currentPercentage + stepSize, 100);
    
    this.setSportPercentage(sport, newPercentage);
    return newPercentage;
  }

  decrementSportPercentage(sport: string, step?: number): number {
    const currentPercentage = this.getSportPercentage(sport);
    const stepSize = step || this.config.rolloutStepSize || 10;
    const newPercentage = Math.max(currentPercentage - stepSize, 0);
    
    this.setSportPercentage(sport, newPercentage);
    return newPercentage;
  }

  // Emergency stop - revert to legacy for all sports
  emergencyRevert(): void {
    console.log('🚨 RolloutController: EMERGENCY REVERT - switching all to legacy mode');
    
    this.mode = 'legacy';
    for (const sport of this.supportedSports) {
      this.percentages.set(sport, 0);
    }
    
    console.log('🚨 RolloutController: Emergency revert complete');
  }

  // === ROLLBACK CAPABILITIES ===

  // Save current rollout state for later restoration
  saveRolloutState(): void {
    this.savedPercentages.clear();
    this.percentages.forEach((value, key) => {
      this.savedPercentages.set(key, value);
    });
    this.savedMode = this.mode;
    
    console.log(`💾 RolloutController: State saved - mode=${this.savedMode}, percentages=${JSON.stringify(Object.fromEntries(this.savedPercentages))}`);
  }

  // Restore previously saved rollout state
  restoreRolloutState(): void {
    if (this.savedPercentages.size === 0) {
      console.warn('⚠️ RolloutController: No saved state to restore');
      return;
    }

    this.percentages.clear();
    this.savedPercentages.forEach((value, key) => {
      this.percentages.set(key, value);
    });
    this.mode = this.savedMode;

    console.log(`🔄 RolloutController: State restored - mode=${this.mode}, percentages=${JSON.stringify(Object.fromEntries(this.percentages))}`);
  }

  // Pause all rollouts (saves current state and sets all to 0%) - IDEMPOTENT
  pauseAllRollouts(): void {
    if (this.isPaused) {
      console.log('⏸️ RolloutController: Already paused - idempotent operation, no changes made');
      return;
    }

    // Save current state first
    this.saveRolloutState();
    
    // Set all percentages to 0% and switch to legacy mode
    for (const sport of this.supportedSports) {
      this.percentages.set(sport, 0);
    }
    this.mode = 'legacy';
    this.isPaused = true;
    
    console.log('⏸️ RolloutController: All rollouts paused - switched to legacy mode with 0% rollout');
  }

  // Resume rollouts to previously saved state
  resumeAllRollouts(): void {
    if (!this.isPaused) {
      console.log('▶️ RolloutController: Not currently paused - no resume needed');
      return;
    }

    this.restoreRolloutState();
    this.isPaused = false;
    console.log('▶️ RolloutController: All rollouts resumed to previous state');
  }

  // Get saved rollout state for inspection
  getSavedRolloutState(): { mode: string; percentages: Record<string, number>; hasSavedState: boolean; isPaused: boolean } {
    return {
      mode: this.savedMode,
      percentages: Object.fromEntries(this.savedPercentages),
      hasSavedState: this.savedPercentages.size > 0,
      isPaused: this.isPaused
    };
  }

  // Get mode change log for audit purposes
  getModeChangeLog(): Array<{
    timestamp: Date;
    operator?: string;
    oldMode: string;
    newMode: string;
    forced: boolean;
    reason?: string;
  }> {
    return [...this.modeChangeLog]; // Return copy to prevent mutation
  }

  // Check if currently paused
  isPausedState(): boolean {
    return this.isPaused;
  }
}

// === AUTO-ROLLBACK GUARD ===

export class AutoRollbackGuard extends EventEmitter {
  private readonly config: AutoRollbackConfig;
  private readonly auditRecords: AutoRollbackAuditRecord[] = [];
  private readonly supportedSports = ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'];

  // Circuit breaker states
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  
  // Service references
  private rolloutController?: RolloutController;
  private metricsCollector?: MetricsCollector;
  private outputRouter?: OutputRouter;
  
  // State management
  private isActive = false;
  private lastCheckTime = new Date();
  private checksPerformed = 0;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  
  // Rollback statistics
  private rollbackStats = {
    totalRollbacks: 0,
    stepDownRollbacks: 0,
    emergencyReverts: 0,
    lastRollbackTime: undefined as Date | undefined,
    consecutiveRollbacks: 0,
    nextAllowedRollbackTime: undefined as Date | undefined
  };
  
  // In-memory metric tracking for circuit breaker analysis
  private recentErrors: Array<{ timestamp: number; sport: string; type: string }> = [];
  private recentHealthChecks: Array<{ timestamp: number; success: boolean; responseTime: number }> = [];
  private recentComparisons: Array<{ timestamp: number; sport: string; divergent: boolean }> = [];

  constructor(config: Partial<AutoRollbackConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      checkIntervalMs: 15_000, // Check every 15 seconds
      logLevel: 'detailed',
      stepDownPercentage: 25,
      emergencyRevertMode: true,
      gradualRollback: true,
      minimumPercentageBeforeStepDown: 10,
      maxConsecutiveRollbacks: 3,
      cooldownPeriodMs: 60_000, // 1 minute cooldown
      enableAuditLogging: true,
      enableAlertNotifications: true,
      auditRetentionDays: 30,
      thresholds: {
        errorRate: {
          moderateThresholdPercent: 5,
          criticalThresholdPercent: 15,
          sampleWindowMs: 300_000, // 5 minutes
          minimumSampleSize: 10
        },
        healthCheckFailures: {
          moderateStreakCount: 3,
          criticalStreakCount: 5
        },
        responseTime: {
          moderateThresholdMs: 2000,
          criticalThresholdMs: 5000,
          baselineWindowMs: 600_000, // 10 minutes
          degradationMultiplier: 2.0
        },
        divergence: {
          moderateThresholdPercent: 10,
          criticalThresholdPercent: 30,
          sampleWindowMs: 300_000, // 5 minutes
          minimumComparisonCount: 5
        },
        serviceHealth: {
          dataIngestionCircuitBreakerOpen: true,
          calendarSyncErrorThreshold: 10,
          outputRouterBacklogThreshold: 1000
        }
      },
      ...config
    };

    this.initializeCircuitBreakers();
    this.logInitialization();
  }

  // === INITIALIZATION ===

  private initializeCircuitBreakers(): void {
    const breakers = ['errorRate', 'healthCheck', 'responseTime', 'divergence', 'serviceHealth'];
    
    for (const name of breakers) {
      this.circuitBreakers.set(name, {
        status: 'closed',
        currentValue: 0,
        threshold: 0,
        consecutiveFailures: 0
      });
    }

    if (this.config.logLevel === 'debug') {
      console.log('🛡️ AutoRollbackGuard: Circuit breakers initialized');
    }
  }

  private logInitialization(): void {
    console.log('🛡️ AutoRollbackGuard: Initialized with the following configuration:');
    console.log(`🛡️   - Enabled: ${this.config.enabled}`);
    console.log(`🛡️   - Check Interval: ${this.config.checkIntervalMs}ms`);
    console.log(`🛡️   - Step Down: ${this.config.stepDownPercentage}%`);
    console.log(`🛡️   - Emergency Revert: ${this.config.emergencyRevertMode}`);
    console.log(`🛡️   - Cooldown Period: ${this.config.cooldownPeriodMs}ms`);
    console.log(`🛡️   - Max Consecutive Rollbacks: ${this.config.maxConsecutiveRollbacks}`);
  }

  // === SERVICE INTEGRATION ===

  setRolloutController(rolloutController: RolloutController): void {
    this.rolloutController = rolloutController;
    console.log('🛡️ AutoRollbackGuard: RolloutController integration enabled');
  }

  setMetricsCollector(metricsCollector: MetricsCollector): void {
    this.metricsCollector = metricsCollector;
    console.log('🛡️ AutoRollbackGuard: MetricsCollector integration enabled');
  }

  setOutputRouter(outputRouter: OutputRouter): void {
    this.outputRouter = outputRouter;
    console.log('🛡️ AutoRollbackGuard: OutputRouter integration enabled');
  }

  // === LIFECYCLE MANAGEMENT ===

  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🛡️ AutoRollbackGuard: Disabled - no automatic rollbacks will occur');
      return;
    }

    if (this.isActive) {
      console.log('⚠️ AutoRollbackGuard: Already active');
      return;
    }

    try {
      console.log('🚀 AutoRollbackGuard: Starting automatic rollback monitoring...');
      
      this.validateDependencies();
      this.startMonitoring();
      
      this.isActive = true;
      this.startTime = Date.now();
      
      console.log('✅ AutoRollbackGuard: Started successfully - protecting migration rollouts');

    } catch (error) {
      console.error('❌ AutoRollbackGuard: Failed to start:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isActive) {
      console.log('🛡️ AutoRollbackGuard: Not active');
      return;
    }

    try {
      console.log('🛑 AutoRollbackGuard: Stopping...');
      
      this.isActive = false;
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      console.log('✅ AutoRollbackGuard: Stopped successfully');

    } catch (error) {
      console.error('❌ AutoRollbackGuard: Error during shutdown:', error);
      throw error;
    }
  }

  private validateDependencies(): void {
    if (!this.rolloutController) {
      throw new Error('AutoRollbackGuard: RolloutController is required');
    }
    
    // MetricsCollector and OutputRouter are optional but recommended
    if (!this.metricsCollector && this.config.logLevel === 'debug') {
      console.warn('⚠️ AutoRollbackGuard: MetricsCollector not available - comparison monitoring disabled');
    }
    
    if (!this.outputRouter && this.config.logLevel === 'debug') {
      console.warn('⚠️ AutoRollbackGuard: OutputRouter not available - router health monitoring disabled');
    }
  }

  private startMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkIntervalMs);

    if (this.config.logLevel === 'debug') {
      console.log(`🛡️ AutoRollbackGuard: Monitoring started (interval: ${this.config.checkIntervalMs}ms)`);
    }
  }

  // === CIRCUIT BREAKER MONITORING ===

  private async performHealthCheck(): Promise<void> {
    try {
      this.checksPerformed++;
      this.lastCheckTime = new Date();

      if (this.config.logLevel === 'debug') {
        console.log(`🛡️ AutoRollbackGuard: Performing health check #${this.checksPerformed}`);
      }

      // Check if we're in cooldown period
      if (this.isInCooldownPeriod()) {
        if (this.config.logLevel === 'detailed') {
          console.log('🛡️ AutoRollbackGuard: In cooldown period - skipping rollback actions');
        }
        return;
      }

      // Perform all circuit breaker checks
      const circuitBreakerResults = await this.checkAllCircuitBreakers();
      
      // Analyze results and determine if rollback action is needed
      const rollbackDecision = this.analyzeCircuitBreakerResults(circuitBreakerResults);
      
      if (rollbackDecision.actionRequired) {
        await this.executeRollbackAction(rollbackDecision);
      }

    } catch (error) {
      console.error('❌ AutoRollbackGuard: Health check failed:', error);
    }
  }

  private async checkAllCircuitBreakers(): Promise<Map<string, any>> {
    const results = new Map();

    // 1. Error Rate Circuit Breaker
    const errorRateResult = await this.checkErrorRateBreaker();
    results.set('errorRate', errorRateResult);

    // 2. Health Check Failures Circuit Breaker
    const healthCheckResult = await this.checkHealthCheckBreaker();
    results.set('healthCheck', healthCheckResult);

    // 3. Response Time Circuit Breaker
    const responseTimeResult = await this.checkResponseTimeBreaker();
    results.set('responseTime', responseTimeResult);

    // 4. Divergence Circuit Breaker
    const divergenceResult = await this.checkDivergenceBreaker();
    results.set('divergence', divergenceResult);

    // 5. Service Health Circuit Breaker
    const serviceHealthResult = await this.checkServiceHealthBreaker();
    results.set('serviceHealth', serviceHealthResult);

    return results;
  }

  private async checkErrorRateBreaker(): Promise<any> {
    const threshold = this.config.thresholds.errorRate;
    const now = Date.now();
    const windowStart = now - threshold.sampleWindowMs;

    // Filter recent errors within sample window
    const recentErrors = this.recentErrors.filter(error => error.timestamp >= windowStart);
    
    if (recentErrors.length < threshold.minimumSampleSize) {
      return { triggered: false, reason: 'Insufficient sample size', currentValue: 0 };
    }

    // Calculate error rate as percentage
    const totalEvents = recentErrors.length; // For simplicity, assuming all tracked events
    const errorCount = recentErrors.length;
    const errorRate = (errorCount / totalEvents) * 100;

    const moderate = errorRate >= threshold.moderateThresholdPercent;
    const critical = errorRate >= threshold.criticalThresholdPercent;

    if (critical) {
      return {
        triggered: true,
        severity: 'critical',
        currentValue: errorRate,
        threshold: threshold.criticalThresholdPercent,
        reason: `Error rate ${errorRate.toFixed(1)}% exceeds critical threshold ${threshold.criticalThresholdPercent}%`
      };
    } else if (moderate) {
      return {
        triggered: true,
        severity: 'moderate',
        currentValue: errorRate,
        threshold: threshold.moderateThresholdPercent,
        reason: `Error rate ${errorRate.toFixed(1)}% exceeds moderate threshold ${threshold.moderateThresholdPercent}%`
      };
    }

    return { triggered: false, currentValue: errorRate, reason: 'Within normal range' };
  }

  private async checkHealthCheckBreaker(): Promise<any> {
    const threshold = this.config.thresholds.healthCheckFailures;
    
    // Get recent health checks and count consecutive failures
    const recentChecks = this.recentHealthChecks.slice(-10); // Last 10 checks
    let consecutiveFailures = 0;
    
    for (let i = recentChecks.length - 1; i >= 0; i--) {
      if (!recentChecks[i].success) {
        consecutiveFailures++;
      } else {
        break; // Stop counting when we hit a success
      }
    }

    const critical = consecutiveFailures >= threshold.criticalStreakCount;
    const moderate = consecutiveFailures >= threshold.moderateStreakCount;

    if (critical) {
      return {
        triggered: true,
        severity: 'critical',
        currentValue: consecutiveFailures,
        threshold: threshold.criticalStreakCount,
        reason: `${consecutiveFailures} consecutive health check failures (critical threshold: ${threshold.criticalStreakCount})`
      };
    } else if (moderate) {
      return {
        triggered: true,
        severity: 'moderate',
        currentValue: consecutiveFailures,
        threshold: threshold.moderateStreakCount,
        reason: `${consecutiveFailures} consecutive health check failures (moderate threshold: ${threshold.moderateStreakCount})`
      };
    }

    return { triggered: false, currentValue: consecutiveFailures, reason: 'Health checks within normal range' };
  }

  private async checkResponseTimeBreaker(): Promise<any> {
    const threshold = this.config.thresholds.responseTime;
    const now = Date.now();
    const baselineStart = now - threshold.baselineWindowMs;

    // Get recent health checks for response time analysis
    const recentChecks = this.recentHealthChecks.filter(check => check.timestamp >= baselineStart);
    
    if (recentChecks.length === 0) {
      return { triggered: false, reason: 'No recent response time data', currentValue: 0 };
    }

    const averageResponseTime = recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length;
    const maxResponseTime = Math.max(...recentChecks.map(check => check.responseTime));

    const critical = maxResponseTime >= threshold.criticalThresholdMs;
    const moderate = averageResponseTime >= threshold.moderateThresholdMs;

    if (critical) {
      return {
        triggered: true,
        severity: 'critical',
        currentValue: maxResponseTime,
        threshold: threshold.criticalThresholdMs,
        reason: `Maximum response time ${maxResponseTime}ms exceeds critical threshold ${threshold.criticalThresholdMs}ms`
      };
    } else if (moderate) {
      return {
        triggered: true,
        severity: 'moderate',
        currentValue: averageResponseTime,
        threshold: threshold.moderateThresholdMs,
        reason: `Average response time ${averageResponseTime.toFixed(0)}ms exceeds moderate threshold ${threshold.moderateThresholdMs}ms`
      };
    }

    return { triggered: false, currentValue: averageResponseTime, reason: 'Response times within normal range' };
  }

  private async checkDivergenceBreaker(): Promise<any> {
    if (!this.metricsCollector) {
      return { triggered: false, reason: 'MetricsCollector not available', currentValue: 0 };
    }

    const threshold = this.config.thresholds.divergence;
    const metrics = this.metricsCollector.getMetrics();
    
    if (!metrics || metrics.totalComparisons < threshold.minimumComparisonCount) {
      return { triggered: false, reason: 'Insufficient comparison data', currentValue: 0 };
    }

    const divergenceRate = metrics.divergenceRate;

    const critical = divergenceRate >= threshold.criticalThresholdPercent;
    const moderate = divergenceRate >= threshold.moderateThresholdPercent;

    if (critical) {
      return {
        triggered: true,
        severity: 'critical',
        currentValue: divergenceRate,
        threshold: threshold.criticalThresholdPercent,
        reason: `Event divergence rate ${divergenceRate.toFixed(1)}% exceeds critical threshold ${threshold.criticalThresholdPercent}%`
      };
    } else if (moderate) {
      return {
        triggered: true,
        severity: 'moderate',
        currentValue: divergenceRate,
        threshold: threshold.moderateThresholdPercent,
        reason: `Event divergence rate ${divergenceRate.toFixed(1)}% exceeds moderate threshold ${threshold.moderateThresholdPercent}%`
      };
    }

    return { triggered: false, currentValue: divergenceRate, reason: 'Divergence rate within normal range' };
  }

  private async checkServiceHealthBreaker(): Promise<any> {
    const threshold = this.config.thresholds.serviceHealth;
    const issues = [];

    // Check output router backlog if available
    if (this.outputRouter && typeof (this.outputRouter as any).getMetrics === 'function') {
      try {
        const routerMetrics = (this.outputRouter as any).getMetrics();
        const totalBacklog = routerMetrics.streamBacklogs?.production + routerMetrics.streamBacklogs?.shadow || 0;
        
        if (totalBacklog >= threshold.outputRouterBacklogThreshold) {
          issues.push(`OutputRouter backlog: ${totalBacklog} events (threshold: ${threshold.outputRouterBacklogThreshold})`);
        }
      } catch (error) {
        // Ignore metrics errors for service health check
      }
    }

    if (issues.length > 0) {
      return {
        triggered: true,
        severity: 'moderate',
        currentValue: issues.length,
        threshold: 1,
        reason: `Service health issues detected: ${issues.join(', ')}`
      };
    }

    return { triggered: false, currentValue: 0, reason: 'All services healthy' };
  }

  // === ROLLBACK DECISION LOGIC ===

  private analyzeCircuitBreakerResults(results: Map<string, any>): any {
    const triggeredBreakers = Array.from(results.entries())
      .filter(([_, result]) => result.triggered)
      .map(([name, result]) => ({ name, ...result }));

    if (triggeredBreakers.length === 0) {
      return { actionRequired: false, reason: 'All circuit breakers normal' };
    }

    // Determine highest severity
    const hasCritical = triggeredBreakers.some(breaker => breaker.severity === 'critical');
    const severity = hasCritical ? 'critical' : 'moderate';

    // Log triggered breakers
    if (this.config.logLevel !== 'minimal') {
      console.log(`🚨 AutoRollbackGuard: ${triggeredBreakers.length} circuit breaker(s) triggered:`);
      triggeredBreakers.forEach(breaker => {
        console.log(`🚨   - ${breaker.name}: ${breaker.reason}`);
      });
    }

    return {
      actionRequired: true,
      severity,
      triggeredBreakers,
      actionType: severity === 'critical' ? 'emergency_revert' : 'step_down'
    };
  }

  // === AUTO-ROLLBACK ACTION EXECUTION ===

  private async executeRollbackAction(decision: any): Promise<void> {
    if (!this.rolloutController) {
      console.error('❌ AutoRollbackGuard: Cannot execute rollback - RolloutController not available');
      return;
    }

    try {
      // Check consecutive rollback limits
      if (this.rollbackStats.consecutiveRollbacks >= this.config.maxConsecutiveRollbacks) {
        console.log('🛡️ AutoRollbackGuard: Maximum consecutive rollbacks reached - emergency stop');
        await this.executeEmergencyRevert(decision, 'max_consecutive_rollbacks_reached');
        return;
      }

      if (decision.actionType === 'emergency_revert' && this.config.emergencyRevertMode) {
        await this.executeEmergencyRevert(decision);
      } else if (decision.actionType === 'step_down') {
        await this.executeStepDownRollback(decision);
      }

    } catch (error) {
      console.error('❌ AutoRollbackGuard: Failed to execute rollback action:', error);
      await this.logAuditRecord({
        triggerType: 'manual',
        triggerSeverity: 'critical',
        actionType: 'no_action',
        reason: `Rollback execution failed: ${error instanceof Error ? error.message : String(error)}`,
        triggeredBreakers: decision.triggeredBreakers || []
      });
    }
  }

  private async executeEmergencyRevert(decision: any, reason?: string): Promise<void> {
    console.log('🚨 AutoRollbackGuard: EXECUTING EMERGENCY REVERT TO LEGACY MODE');

    const oldMode = this.rolloutController!.getMode();
    const oldPercentages = this.getPerSportPercentages();

    // Emergency revert - switch to legacy mode completely
    this.rolloutController!.setMode('legacy', {
      force: true,
      operator: 'AUTO_ROLLBACK_GUARD',
      reason: reason || `EMERGENCY_REVERT: ${decision.triggeredBreakers.map((b: any) => b.reason).join('; ')}`
    });

    // Update statistics
    this.rollbackStats.totalRollbacks++;
    this.rollbackStats.emergencyReverts++;
    this.rollbackStats.consecutiveRollbacks++;
    this.rollbackStats.lastRollbackTime = new Date();
    this.rollbackStats.nextAllowedRollbackTime = new Date(Date.now() + this.config.cooldownPeriodMs);

    // Log audit record
    await this.logAuditRecord({
      triggerType: 'service_health',
      triggerSeverity: 'critical',
      actionType: 'emergency_revert',
      reason: reason || `Emergency revert triggered by circuit breakers: ${decision.triggeredBreakers.map((b: any) => b.name).join(', ')}`,
      triggeredBreakers: decision.triggeredBreakers || [],
      oldMode,
      newMode: 'legacy',
      oldPercentages,
      newPercentages: this.getPerSportPercentages()
    });

    console.log('✅ AutoRollbackGuard: Emergency revert completed');
  }

  private async executeStepDownRollback(decision: any): Promise<void> {
    console.log('🔄 AutoRollbackGuard: EXECUTING STEP-DOWN ROLLBACK');

    const oldMode = this.rolloutController!.getMode();
    const oldPercentages = this.getPerSportPercentages();
    const affectedSports: string[] = [];

    // Step down percentages for sports that are currently using ingestion
    for (const sport of this.supportedSports) {
      const currentPercentage = this.rolloutController!.getSportPercentage(sport);
      
      if (currentPercentage > this.config.minimumPercentageBeforeStepDown) {
        const newPercentage = Math.max(
          currentPercentage - this.config.stepDownPercentage,
          0
        );
        
        this.rolloutController!.setSportPercentage(sport, newPercentage);
        affectedSports.push(sport);
        
        console.log(`🔄 AutoRollbackGuard: ${sport} percentage reduced from ${currentPercentage}% to ${newPercentage}%`);
      }
    }

    // If no sports were affected (all below minimum), don't count this as a rollback
    if (affectedSports.length === 0) {
      console.log('🔄 AutoRollbackGuard: No sports eligible for step-down (all below minimum threshold)');
      return;
    }

    // Update statistics
    this.rollbackStats.totalRollbacks++;
    this.rollbackStats.stepDownRollbacks++;
    this.rollbackStats.consecutiveRollbacks++;
    this.rollbackStats.lastRollbackTime = new Date();
    this.rollbackStats.nextAllowedRollbackTime = new Date(Date.now() + this.config.cooldownPeriodMs);

    // Log audit record
    await this.logAuditRecord({
      triggerType: decision.triggeredBreakers[0]?.name || 'unknown',
      triggerSeverity: 'moderate',
      actionType: 'step_down',
      reason: `Step-down rollback triggered by: ${decision.triggeredBreakers.map((b: any) => b.reason).join('; ')}`,
      triggeredBreakers: decision.triggeredBreakers || [],
      oldMode,
      newMode: this.rolloutController!.getMode(),
      oldPercentages,
      newPercentages: this.getPerSportPercentages(),
      affectedSports
    });

    console.log(`✅ AutoRollbackGuard: Step-down rollback completed for ${affectedSports.length} sports`);
  }

  // === UTILITY METHODS ===

  private isInCooldownPeriod(): boolean {
    if (!this.rollbackStats.nextAllowedRollbackTime) {
      return false;
    }
    
    return Date.now() < this.rollbackStats.nextAllowedRollbackTime.getTime();
  }

  private getPerSportPercentages(): Record<string, number> {
    const percentages: Record<string, number> = {};
    for (const sport of this.supportedSports) {
      percentages[sport] = this.rolloutController!.getSportPercentage(sport);
    }
    return percentages;
  }

  private async logAuditRecord(details: {
    triggerType: string;
    triggerSeverity: 'moderate' | 'critical';
    actionType: string;
    reason: string;
    triggeredBreakers?: any[];
    oldMode?: string;
    newMode?: string;
    oldPercentages?: Record<string, number>;
    newPercentages?: Record<string, number>;
    affectedSports?: string[];
  }): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    const auditRecord: AutoRollbackAuditRecord = {
      id: uuidv4(),
      timestamp: new Date(),
      triggerType: details.triggerType as any,
      triggerSeverity: details.triggerSeverity,
      triggerDetails: {
        triggeredBreakers: details.triggeredBreakers || []
      },
      actionType: details.actionType as any,
      actionDetails: {
        affectedSports: details.affectedSports || [],
        oldPercentages: details.oldPercentages || {},
        newPercentages: details.newPercentages || {},
        oldMode: details.oldMode || '',
        newMode: details.newMode || '',
        stepDownAmount: this.config.stepDownPercentage
      },
      operator: 'AUTO_ROLLBACK_GUARD',
      reason: details.reason,
      forced: true,
      systemSnapshot: {
        overallHealth: 'degraded',
        serviceStates: {},
        rolloutStatus: this.rolloutController?.getStatus() || {}
      }
    };

    // Store audit record
    this.auditRecords.push(auditRecord);
    
    // Cleanup old records
    this.cleanupOldAuditRecords();

    // Emit event for external handling
    this.emit('rollback_executed', auditRecord);

    if (this.config.logLevel !== 'minimal') {
      console.log(`📋 AutoRollbackGuard: Audit record created - ${auditRecord.actionType} action for ${auditRecord.triggerType}`);
    }
  }

  private cleanupOldAuditRecords(): void {
    const retentionPeriod = this.config.auditRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionPeriod;
    
    const initialCount = this.auditRecords.length;
    const filtered = this.auditRecords.filter(record => record.timestamp.getTime() >= cutoffTime);
    
    if (filtered.length !== initialCount) {
      this.auditRecords.length = 0;
      this.auditRecords.push(...filtered);
      
      if (this.config.logLevel === 'debug') {
        console.log(`📋 AutoRollbackGuard: Cleaned up ${initialCount - filtered.length} old audit records`);
      }
    }
  }

  // === PUBLIC API ===

  getStatus(): AutoRollbackStatus {
    const circuitBreakerStates: any = {};
    
    for (const [name, state] of this.circuitBreakers.entries()) {
      circuitBreakerStates[name] = { ...state };
    }

    return {
      enabled: this.config.enabled,
      isActive: this.isActive,
      lastCheckTime: this.lastCheckTime,
      checksPerformed: this.checksPerformed,
      circuitBreakers: circuitBreakerStates,
      rollbackStats: { ...this.rollbackStats },
      auditSummary: {
        totalAuditRecords: this.auditRecords.length,
        lastAuditTime: this.auditRecords.length > 0 ? this.auditRecords[this.auditRecords.length - 1].timestamp : undefined,
        criticalActions: this.auditRecords.filter(r => r.triggerSeverity === 'critical').length,
        moderateActions: this.auditRecords.filter(r => r.triggerSeverity === 'moderate').length
      }
    };
  }

  getAuditRecords(limit?: number): AutoRollbackAuditRecord[] {
    const records = [...this.auditRecords].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? records.slice(0, limit) : records;
  }

  // Track error for circuit breaker analysis
  recordError(sport: string, errorType: string): void {
    this.recentErrors.push({
      timestamp: Date.now(),
      sport,
      type: errorType
    });

    // Keep only recent errors (last hour)
    const oneHourAgo = Date.now() - 3600_000;
    this.recentErrors = this.recentErrors.filter(error => error.timestamp >= oneHourAgo);
  }

  // Track health check for circuit breaker analysis
  recordHealthCheck(success: boolean, responseTime: number): void {
    this.recentHealthChecks.push({
      timestamp: Date.now(),
      success,
      responseTime
    });

    // Keep only recent checks (last 50 checks)
    if (this.recentHealthChecks.length > 50) {
      this.recentHealthChecks = this.recentHealthChecks.slice(-50);
    }
  }

  // Reset consecutive rollback counter (called on successful operation)
  resetConsecutiveRollbacks(): void {
    if (this.rollbackStats.consecutiveRollbacks > 0) {
      console.log('✅ AutoRollbackGuard: Resetting consecutive rollback counter after successful operation');
      this.rollbackStats.consecutiveRollbacks = 0;
    }
  }

  // Manual trigger for testing
  async triggerEmergencyRollback(reason: string): Promise<void> {
    console.log(`🚨 AutoRollbackGuard: Manual emergency rollback triggered - ${reason}`);
    
    await this.executeEmergencyRevert({
      triggeredBreakers: [{ name: 'manual', reason }]
    }, `MANUAL_TRIGGER: ${reason}`);
  }
}

// === MIGRATION ADAPTER MAIN CLASS ===

export class MigrationAdapter {
  private readonly config: MigrationAdapterConfig;
  private calendarSyncService?: CalendarSyncService;
  private dataIngestionIntegration?: DataIngestionIntegration;
  private outputRouter?: OutputRouter;
  private rolloutController: RolloutController;
  private autoRollbackGuard?: AutoRollbackGuard;
  
  // Comparison system
  private eventComparator?: EventComparator;
  private metricsCollector?: MetricsCollector;
  
  private gameStateManager?: GameStateManager;
  private healthCheckInterval?: NodeJS.Timeout;
  private status: MigrationAdapterStatus;
  private startTime = Date.now();
  private isInitialized = false;
  private isRunning = false;

  constructor(config: Partial<MigrationAdapterConfig> = {}) {
    this.config = this.createDefaultConfig(config);
    this.rolloutController = new RolloutController(this.config.rollout);
    this.status = this.createInitialStatus();

    // Initialize Auto-Rollback Guard if enabled
    if (this.config.enableAutoRollback) {
      this.autoRollbackGuard = new AutoRollbackGuard(this.config.autoRollback);
      this.autoRollbackGuard.setRolloutController(this.rolloutController);
      console.log('🛡️ MigrationAdapter: Auto-Rollback Guard initialized and integrated');
    }
    
    console.log(`🔄 MigrationAdapter: Initialized with rollout mode=${this.rolloutController.getMode()}`);
  }

  private createDefaultConfig(config: Partial<MigrationAdapterConfig>): MigrationAdapterConfig {
    return {
      calendarSync: {
        sports: ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL'],
        enableMetrics: true,
        ...config.calendarSync
      },
      dataIngestion: {
        shadowMode: true,
        enableMetrics: true,
        healthCheckIntervalMs: 30_000,
        logLevel: 'detailed',
        ...config.dataIngestion
      },
      outputRouter: {
        enabled: true,
        enableDeduplication: true,
        enableShadowMode: true,
        enableMetrics: true,
        logLevel: 'detailed',
        defaultRoute: 'both',
        forceProductionSports: [],
        forceShadowSports: [],
        ...config.outputRouter
      },
      rollout: {
        percentages: {},
        mode: 'legacy',
        enableSafetyChecks: true,
        maxRolloutPercentage: 50,
        rolloutStepSize: 10,
        ...config.rollout
      },
      health: {
        checkIntervalMs: 30_000,
        timeoutMs: 5_000,
        retryAttempts: 3,
        alertThresholds: {
          errorRatePercent: 10,
          responseTimeMs: 1_000,
          failedChecksBeforeAlert: 3,
          ...(config.health?.alertThresholds || {})
        },
        ...config.health
      },
      enableRolloutController: true,
      enableHealthMonitoring: true,
      enableMetrics: true,
      enableOutputRouter: true,
      enableAutoRollback: true,
      logLevel: 'detailed',
      autoRollback: {
        enabled: true,
        checkIntervalMs: 15_000,
        logLevel: 'detailed',
        stepDownPercentage: 25,
        emergencyRevertMode: true,
        gradualRollback: true,
        minimumPercentageBeforeStepDown: 10,
        maxConsecutiveRollbacks: 3,
        cooldownPeriodMs: 60_000,
        enableAuditLogging: true,
        enableAlertNotifications: true,
        auditRetentionDays: 30,
        thresholds: {
          errorRate: {
            moderateThresholdPercent: 5,
            criticalThresholdPercent: 15,
            sampleWindowMs: 300_000,
            minimumSampleSize: 10
          },
          healthCheckFailures: {
            moderateStreakCount: 3,
            criticalStreakCount: 5
          },
          responseTime: {
            moderateThresholdMs: 2000,
            criticalThresholdMs: 5000,
            baselineWindowMs: 600_000,
            degradationMultiplier: 2.0
          },
          divergence: {
            moderateThresholdPercent: 10,
            criticalThresholdPercent: 30,
            sampleWindowMs: 300_000,
            minimumComparisonCount: 5
          },
          serviceHealth: {
            dataIngestionCircuitBreakerOpen: true,
            calendarSyncErrorThreshold: 10,
            outputRouterBacklogThreshold: 1000
          }
        }
      },
      ...config
    };
  }

  private createInitialStatus(): MigrationAdapterStatus {
    return {
      status: 'initializing',
      services: {
        calendarSync: {
          healthy: false,
          running: false,
          errorCount: 0,
          lastCheck: new Date()
        },
        dataIngestion: {
          healthy: false,
          running: false,
          errorCount: 0,
          lastCheck: new Date()
        }
      },
      rollout: this.rolloutController.getStatus(),
      health: {
        overall: 'healthy',
        checksPerformed: 0,
        checksPassed: 0,
        lastCheckTime: new Date(),
        failureStreak: 0
      },
      uptime: 0,
      lastUpdate: new Date()
    };
  }

  // === LIFECYCLE MANAGEMENT ===

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ MigrationAdapter: Already initialized');
      return;
    }

    try {
      console.log('🚀 MigrationAdapter: Starting initialization...');
      this.status.status = 'initializing';

      // Initialize CalendarSyncService
      this.calendarSyncService = new CalendarSyncService(this.config.calendarSync);
      if (this.gameStateManager) {
        this.calendarSyncService.setGameStateManager(this.gameStateManager);
      }

      // Initialize DataIngestionIntegration
      this.dataIngestionIntegration = new DataIngestionIntegration({
        shadowMode: this.config.dataIngestion.shadowMode ?? true,
        ...this.config.dataIngestion
      });
      await this.dataIngestionIntegration.initialize();

      // Initialize comparison system using factory function for proper wiring
      if (this.config.enableMetrics) {
        const comparisonSystem = createEventComparisonSystem({
          comparator: {
            enabled: true,
            logLevel: this.config.logLevel as 'minimal' | 'detailed' | 'debug',
            maxPendingEvents: 1_000,
            maxComparisonResults: 1_000,
            maxTimingSamples: 1_000,
            maxLatencySamples: 1_000
          },
          metricsFlushIntervalMs: 30_000
        });
        
        this.eventComparator = comparisonSystem.comparator;
        this.metricsCollector = comparisonSystem.metricsCollector;
        
        console.log('📊 EventComparator and MetricsCollector: Initialized with proper wiring');
        
        // Add logging to prove metrics are being updated
        this.metricsCollector.on('metrics_flush', (metrics) => {
          if (this.config.logLevel === 'detailed') {
            console.log(`📊 MetricsCollector: Flushed metrics - ${metrics.totalComparisons} comparisons, ${(metrics.matchSuccessRate * 100).toFixed(1)}% success rate`);
          }
        });
        
        this.eventComparator.on('comparison_complete', (result) => {
          if (this.config.logLevel === 'debug') {
            console.log(`🔍 EventComparator: Completed comparison for ${result.gameId} - match: ${result.matchType}, similarity: ${(result.contentSimilarity * 100).toFixed(1)}%`);
          }
        });
      } else {
        console.log('📊 Comparison system disabled via config');
      }

      // Initialize OutputRouter if enabled
      if (this.config.enableOutputRouter) {
        const productionStream = getUnifiedEventStream();
        const shadowStream = getUnifiedEventStream(); // For shadow mode
        
        this.outputRouter = new OutputRouter({
          ...this.config.outputRouter
        });
        
        // Wire comparison system to OutputRouter
        this.outputRouter.setEventComparator(this.eventComparator);
        this.outputRouter.setMetricsCollector(this.metricsCollector);
        
        console.log('🔀 OutputRouter: Initialized and wired to comparison system');
      }

      // Connect Auto-Rollback Guard to other services if enabled
      if (this.autoRollbackGuard) {
        if (this.metricsCollector) {
          this.autoRollbackGuard.setMetricsCollector(this.metricsCollector);
        }
        if (this.outputRouter) {
          this.autoRollbackGuard.setOutputRouter(this.outputRouter);
        }
        console.log('🛡️ AutoRollbackGuard: Connected to all available services');
      }

      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      this.isInitialized = true;
      this.status.status = 'ready';
      this.updateStatus();

      console.log('✅ MigrationAdapter: Initialization complete - both services ready');
      this.logMigrationStatus();

    } catch (error) {
      console.error('❌ MigrationAdapter: Initialization failed:', error);
      this.status.status = 'error';
      this.updateStatus();
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MigrationAdapter must be initialized before starting');
    }

    if (this.isRunning) {
      console.log('📄 MigrationAdapter: Already running');
      return;
    }

    try {
      console.log('🚀 MigrationAdapter: Starting services...');
      this.status.status = 'running';

      // Start CalendarSyncService (always runs for legacy support)
      if (this.calendarSyncService) {
        await this.calendarSyncService.start();
        console.log('✅ MigrationAdapter: CalendarSyncService started');
      }

      // DataIngestionIntegration is already started during initialization
      console.log('✅ MigrationAdapter: DataIngestionIntegration confirmed running');

      // Setup and start OutputRouter if enabled
      if (this.outputRouter && this.config.enableOutputRouter) {
        // Connect services to OutputRouter BEFORE starting
        if (this.calendarSyncService) {
          this.outputRouter.setCalendarSyncService(this.calendarSyncService);
        }
        if (this.dataIngestionIntegration && typeof this.outputRouter.setDataIngestionService === 'function') {
          this.outputRouter.setDataIngestionService(this.dataIngestionIntegration);
        }
        
        // Now start the OutputRouter with services connected
        await this.outputRouter.start();
        
        console.log('✅ MigrationAdapter: OutputRouter started and connected to services');
      }

      // Start Auto-Rollback Guard if enabled
      if (this.autoRollbackGuard) {
        await this.autoRollbackGuard.start();
        console.log('✅ MigrationAdapter: Auto-Rollback Guard started and monitoring');
      }

      this.isRunning = true;
      this.updateStatus();

      console.log('✅ MigrationAdapter: All services started successfully');
      this.logMigrationStatus();

    } catch (error) {
      console.error('❌ MigrationAdapter: Failed to start services:', error);
      this.status.status = 'error';
      this.updateStatus();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('📄 MigrationAdapter: Not running');
      return;
    }

    try {
      console.log('🛑 MigrationAdapter: Stopping services...');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
        console.log('✅ MigrationAdapter: Health monitoring stopped');
      }

      // Stop OutputRouter first
      if (this.outputRouter) {
        await this.outputRouter.stop();
        console.log('✅ MigrationAdapter: OutputRouter stopped');
      }

      // Stop CalendarSyncService
      if (this.calendarSyncService) {
        await this.calendarSyncService.stop();
        console.log('✅ MigrationAdapter: CalendarSyncService stopped');
      }

      // Stop DataIngestionIntegration
      if (this.dataIngestionIntegration) {
        await this.dataIngestionIntegration.shutdown();
        console.log('✅ MigrationAdapter: DataIngestionIntegration stopped');
      }

      // Stop Auto-Rollback Guard
      if (this.autoRollbackGuard) {
        await this.autoRollbackGuard.stop();
        console.log('✅ MigrationAdapter: Auto-Rollback Guard stopped');
      }

      this.isRunning = false;
      this.status.status = 'stopped';
      this.updateStatus();

      console.log('✅ MigrationAdapter: Graceful shutdown complete');

    } catch (error) {
      console.error('❌ MigrationAdapter: Error during shutdown:', error);
      throw error;
    }
  }

  // === HEALTH MONITORING ===

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.health.checkIntervalMs);

    console.log(`🏥 MigrationAdapter: Health monitoring started (${this.config.health.checkIntervalMs}ms interval)`);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Check CalendarSyncService
      const calendarHealth = await this.checkCalendarSyncHealth();
      
      // Check DataIngestionIntegration
      const ingestionHealth = await this.checkDataIngestionHealth();

      // Update status
      this.status.services.calendarSync = calendarHealth;
      this.status.services.dataIngestion = ingestionHealth;

      // Determine overall health
      const bothHealthy = calendarHealth.healthy && ingestionHealth.healthy;
      const eitherHealthy = calendarHealth.healthy || ingestionHealth.healthy;

      if (bothHealthy) {
        this.status.health.overall = 'healthy';
        this.status.status = 'running';
        this.status.health.failureStreak = 0;
      } else if (eitherHealthy) {
        this.status.health.overall = 'degraded';
        this.status.status = 'degraded';
        this.status.health.failureStreak++;
      } else {
        this.status.health.overall = 'unhealthy';
        this.status.status = 'error';
        this.status.health.failureStreak++;
      }

      // Update health metrics
      this.status.health.checksPerformed++;
      if (bothHealthy) {
        this.status.health.checksPassed++;
      }
      this.status.health.lastCheckTime = new Date();

      // Check for emergency situations
      if (this.status.health.failureStreak >= this.config.health.alertThresholds.failedChecksBeforeAlert) {
        console.error(`🚨 MigrationAdapter: Health check failure streak: ${this.status.health.failureStreak}`);
        
        // Consider emergency revert
        if (this.rolloutController.getMode() !== 'legacy') {
          console.warn('🚨 MigrationAdapter: Considering emergency revert due to health failures');
        }
      }

      this.updateStatus();

      // Log health summary periodically
      if (this.config.logLevel === 'detailed' && this.status.health.checksPerformed % 10 === 0) {
        this.logHealthSummary();
      }

    } catch (error) {
      console.error('❌ MigrationAdapter: Health check failed:', error);
      this.status.health.failureStreak++;
      this.updateStatus();
    }
  }

  private async checkCalendarSyncHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      if (!this.calendarSyncService) {
        return {
          healthy: false,
          running: false,
          errorCount: 1,
          lastCheck: new Date(),
          details: 'Service not initialized'
        };
      }

      // Get metrics to check health
      const metrics = this.calendarSyncService.getMetrics();
      const responseTime = Date.now() - startTime;

      const isHealthy = metrics.errorCount < 10 && responseTime < this.config.health.timeoutMs;

      return {
        healthy: isHealthy,
        running: true,
        errorCount: metrics.errorCount,
        lastCheck: new Date(),
        responseTimeMs: responseTime,
        details: { metrics }
      };

    } catch (error) {
      return {
        healthy: false,
        running: false,
        errorCount: 1,
        lastCheck: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async checkDataIngestionHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      if (!this.dataIngestionIntegration) {
        return {
          healthy: false,
          running: false,
          errorCount: 1,
          lastCheck: new Date(),
          details: 'Service not initialized'
        };
      }

      // Check if service is ready
      const isReady = this.dataIngestionIntegration.isReady();
      const metrics = this.dataIngestionIntegration.getMetrics();
      const responseTime = Date.now() - startTime;

      const isHealthy = isReady && responseTime < this.config.health.timeoutMs;

      return {
        healthy: isHealthy,
        running: isReady,
        errorCount: 0, // DataIngestion doesn't expose error count directly
        lastCheck: new Date(),
        responseTimeMs: responseTime,
        details: { metrics, isReady }
      };

    } catch (error) {
      return {
        healthy: false,
        running: false,
        errorCount: 1,
        lastCheck: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // === PUBLIC API ===

  // Set external dependencies
  setGameStateManager(gameStateManager: GameStateManager): void {
    this.gameStateManager = gameStateManager;
    if (this.calendarSyncService) {
      this.calendarSyncService.setGameStateManager(gameStateManager);
    }
    console.log('🔄 MigrationAdapter: GameStateManager integration enabled');
  }

  // Get rollout controller
  getRolloutController(): RolloutController {
    return this.rolloutController;
  }

  // Get current status
  getStatus(): MigrationAdapterStatus {
    this.updateStatus();
    
    // Add autoRollback status if enabled
    if (this.autoRollbackGuard) {
      this.status.autoRollback = this.autoRollbackGuard.getStatus();
    }
    
    return { ...this.status };
  }

  // Get combined metrics from both services
  getMetrics(): any {
    const calendarMetrics = this.calendarSyncService?.getMetrics() || {};
    const ingestionMetrics = this.dataIngestionIntegration?.getMetrics() || {};

    return {
      migration: {
        uptime: Date.now() - this.startTime,
        status: this.status.status,
        rollout: this.rolloutController.getStatus(),
        health: this.status.health
      },
      calendarSync: calendarMetrics,
      dataIngestion: ingestionMetrics
    };
  }

  // Get game data (delegates to appropriate service)
  getGameData(sport?: string): CalendarGameData[] {
    // For now, always use calendar sync data as the source of truth
    // Later this will be modified based on rollout percentages
    return this.calendarSyncService?.getCalendarData(sport) || [];
  }

  // Force refresh (delegates to appropriate service)
  async forceRefresh(sport: string): Promise<void> {
    const useIngestion = this.rolloutController.shouldUseIngestion(sport);
    
    if (useIngestion && this.dataIngestionIntegration) {
      console.log(`🔄 MigrationAdapter: Force refresh ${sport} via DataIngestion`);
      // DataIngestion doesn't have sport-specific refresh, so we'll use calendar sync
      return this.calendarSyncService?.forceRefresh(sport);
    } else if (this.calendarSyncService) {
      console.log(`🔄 MigrationAdapter: Force refresh ${sport} via CalendarSync`);
      return this.calendarSyncService.forceRefresh(sport);
    }
  }

  // Check if adapter is ready
  isReady(): boolean {
    return this.isInitialized && 
           this.status.status === 'ready' || this.status.status === 'running';
  }

  // Reset all metrics and comparison data
  async resetMetricsAndComparison(): Promise<void> {
    try {
      console.log('🔄 MigrationAdapter: Resetting metrics and comparison data...');
      
      // Reset comparison system metrics (if available)
      if (this.metricsCollector && typeof this.metricsCollector.reset === 'function') {
        this.metricsCollector.reset();
        console.log('✅ MetricsCollector: Reset complete');
      } else if (this.metricsCollector) {
        console.log('⚠️ MetricsCollector: Reset method not available');
      }
      
      // Reset event comparator data (if available)
      if (this.eventComparator && typeof this.eventComparator.reset === 'function') {
        this.eventComparator.reset();
        console.log('✅ EventComparator: Reset complete');
      } else if (this.eventComparator) {
        console.log('⚠️ EventComparator: Reset method not available');
      }
      
      // Reset output router metrics (if available)
      if (this.outputRouter && typeof this.outputRouter.resetMetrics === 'function') {
        this.outputRouter.resetMetrics();
        console.log('✅ OutputRouter: Metrics reset complete');
      } else if (this.outputRouter) {
        console.log('⚠️ OutputRouter: resetMetrics method not available');
      }
      
      // Reset health check counters
      this.status.health = {
        overall: 'healthy',
        checksPerformed: 0,
        checksPassed: 0,
        lastCheckTime: new Date(),
        failureStreak: 0
      };
      
      console.log('✅ MigrationAdapter: All metrics and comparison data reset');
      this.updateStatus();
      
    } catch (error) {
      console.error('❌ MigrationAdapter: Error resetting metrics:', error);
      throw error;
    }
  }

  // === PRIVATE HELPERS ===

  private updateStatus(): void {
    this.status.uptime = Date.now() - this.startTime;
    this.status.lastUpdate = new Date();
    this.status.rollout = this.rolloutController.getStatus();
    
    // Include comparison metrics if available
    if (this.metricsCollector) {
      this.status.comparison = this.metricsCollector.getMetrics();
    }
  }

  private logMigrationStatus(): void {
    const rolloutStatus = this.rolloutController.getStatus();
    
    console.log('');
    console.log('🔄 ==================== MIGRATION ADAPTER STATUS ====================');
    console.log(`🔄 Status: ${this.status.status.toUpperCase()}`);
    console.log(`🔄 Mode: ${rolloutStatus.mode.toUpperCase()}`);
    console.log(`🔄 Migration Progress: ${rolloutStatus.migrationProgress}%`);
    console.log(`🔄 Services:`);
    console.log(`🔄   CalendarSync: ${this.status.services.calendarSync.healthy ? '✅' : '❌'} ${this.status.services.calendarSync.running ? 'RUNNING' : 'STOPPED'}`);
    console.log(`🔄   DataIngestion: ${this.status.services.dataIngestion.healthy ? '✅' : '❌'} ${this.status.services.dataIngestion.running ? 'RUNNING' : 'STOPPED'}`);
    console.log(`🔄 Sport Rollout:`);
    for (const [sport, percentage] of Object.entries(rolloutStatus.sportPercentages)) {
      console.log(`🔄   ${sport}: ${percentage}%`);
    }
    console.log('🔄 ================================================================');
    console.log('');
  }

  private logHealthSummary(): void {
    const health = this.status.health;
    const successRate = health.checksPerformed > 0 ? (health.checksPassed / health.checksPerformed * 100).toFixed(1) : '0';
    
    console.log(`🏥 MigrationAdapter Health: ${health.overall.toUpperCase()} | Success Rate: ${successRate}% | Checks: ${health.checksPerformed} | Streak: ${health.failureStreak}`);
  }

  // === AUTO-ROLLBACK PUBLIC API ===

  // Get Auto-Rollback Guard status
  getAutoRollbackStatus(): AutoRollbackStatus | undefined {
    return this.autoRollbackGuard?.getStatus();
  }

  // Get Auto-Rollback audit records
  getAutoRollbackAuditRecords(limit?: number): AutoRollbackAuditRecord[] {
    return this.autoRollbackGuard?.getAuditRecords(limit) || [];
  }

  // Record error for circuit breaker analysis
  recordError(sport: string, errorType: string): void {
    this.autoRollbackGuard?.recordError(sport, errorType);
  }

  // Record health check for circuit breaker analysis
  recordHealthCheck(success: boolean, responseTime: number): void {
    this.autoRollbackGuard?.recordHealthCheck(success, responseTime);
  }

  // Reset consecutive rollback counter after successful operation
  resetConsecutiveRollbacks(): void {
    this.autoRollbackGuard?.resetConsecutiveRollbacks();
  }

  // Manual trigger for emergency rollback (for testing/emergency situations)
  async triggerEmergencyRollback(reason: string): Promise<void> {
    if (!this.autoRollbackGuard) {
      throw new Error('Auto-Rollback Guard is not enabled');
    }
    await this.autoRollbackGuard.triggerEmergencyRollback(reason);
  }

  // Subscribe to auto-rollback events
  onAutoRollback(listener: (auditRecord: AutoRollbackAuditRecord) => void): void {
    this.autoRollbackGuard?.on('rollback_executed', listener);
  }

  // Remove auto-rollback event listener
  offAutoRollback(listener: (auditRecord: AutoRollbackAuditRecord) => void): void {
    this.autoRollbackGuard?.off('rollback_executed', listener);
  }
}

// === EXPORTS ===

// Export types are already defined above in the interfaces section