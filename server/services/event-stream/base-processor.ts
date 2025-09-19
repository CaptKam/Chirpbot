/**
 * BaseProcessor - Stateless Alert Processor Interface
 * 
 * Defines the contract for all sport-specific event processors in the
 * UnifiedEventStream architecture. Processors are stateless, focusing
 * on pure alert generation logic that can be easily tested and scaled.
 * 
 * Features:
 * - Stateless design for horizontal scaling
 * - Circuit breaker integration for fault tolerance
 * - Settings integration for alert filtering
 * - Performance metrics collection
 * - Legacy compatibility layer
 * - Shadow mode support
 */

import type { GameState, AlertResult } from '../engines/base-engine';
import type { 
  ProcessorConfig,
  ProcessorResult,
  ProcessorContext,
  ProcessorStats,
  UnifiedEvent,
  GameStateChangedEvent,
  AlertGeneratedEvent
} from './types';
import { CircuitBreaker } from './circuit-breaker';

/**
 * Core interface that all sport processors must implement
 */
export interface IAlertProcessor {
  readonly id: string;
  readonly sport: string;
  readonly version: string;
  
  // Core processing method
  processGameState(context: ProcessorContext): Promise<ProcessorResult>;
  
  // Configuration and lifecycle
  configure(config: ProcessorConfig): Promise<void>;
  isEnabled(): boolean;
  getStats(): ProcessorStats;
  
  // Health and diagnostics
  healthCheck(): Promise<boolean>;
  validateGameState(gameState: GameState): boolean;
  
  // Legacy compatibility
  getAlertTypes(): string[];
  isAlertTypeEnabled(alertType: string): Promise<boolean>;
}

/**
 * Abstract base class providing common functionality for all processors
 */
export abstract class BaseProcessor implements IAlertProcessor {
  public readonly id: string;
  public readonly sport: string;
  public readonly version = '1.0.0';
  
  protected config: ProcessorConfig;
  protected circuitBreaker?: CircuitBreaker;
  protected stats: ProcessorStats;
  
  // Abstract methods that subclasses must implement
  protected abstract generateAlerts(gameState: GameState, context: ProcessorContext): Promise<AlertResult[]>;
  protected abstract getDefaultConfig(): Partial<ProcessorConfig>;
  protected abstract getSupportedAlertTypes(): string[];
  
  constructor(id: string, sport: string) {
    this.id = id;
    this.sport = sport;
    
    // Initialize with default config
    this.config = {
      id,
      sport,
      enabled: true,
      shadowMode: true, // Default to shadow mode
      maxConcurrency: 5,
      timeout: 30000,
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitter: true
      },
      circuitBreakerConfig: {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        monitoringWindowMs: 300000,
        minimumRequests: 10,
        errorRateThreshold: 0.3
      },
      ...this.getDefaultConfig()
    };
    
    // Initialize stats
    this.stats = {
      id: this.id,
      sport: this.sport,
      enabled: this.config.enabled,
      shadowMode: this.config.shadowMode,
      requestsProcessed: 0,
      requestsFailed: 0,
      averageResponseTimeMs: 0,
      lastProcessedAt: 0,
      consecutiveFailures: 0
    };
  }

  /**
   * Configure the processor
   */
  async configure(config: ProcessorConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.stats.enabled = this.config.enabled;
    this.stats.shadowMode = this.config.shadowMode;
    
    console.log(`🔧 Configured processor ${this.id} for ${this.sport}`);
  }

  /**
   * Main processing entry point
   */
  async processGameState(context: ProcessorContext): Promise<ProcessorResult> {
    if (!this.isEnabled()) {
      return this.createEmptyResult('Processor disabled');
    }
    
    if (!this.validateGameState(context.gameState)) {
      return this.createEmptyResult('Invalid game state');
    }
    
    const startTime = Date.now();
    
    try {
      let alerts: AlertResult[] = [];
      let filteredAlerts: AlertResult[] = [];
      
      // CRITICAL FIX: Only generate alerts if NOT in shadow mode
      // This prevents duplicate alert generation when running parallel systems
      if (!this.config.shadowMode) {
        // Generate alerts using subclass implementation
        alerts = await this.generateAlerts(context.gameState, context);
        
        // Filter alerts based on settings
        filteredAlerts = await this.filterAlertsBySettings(alerts, context);
        
        this.log('info', `Generated ${filteredAlerts.length} alerts for game ${context.gameId}`);
      } else {
        // In shadow mode: process for comparison but don't generate user-facing alerts
        this.log('debug', `Shadow mode: Skipping alert generation for game ${context.gameId}`);
      }
      
      // Update stats
      this.updateSuccessStats(Date.now() - startTime);
      
      return {
        success: true,
        alerts: filteredAlerts,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          processorId: this.id,
          sport: this.sport,
          alertsGenerated: alerts.length,
          alertsFiltered: filteredAlerts.length,
          shadowMode: this.config.shadowMode,
          alertGenerationSkipped: this.config.shadowMode,
          timestamp: Date.now()
        }
      };
      
    } catch (error) {
      this.updateFailureStats();
      
      return {
        success: false,
        alerts: [],
        processingTimeMs: Date.now() - startTime,
        error: error as Error,
        metadata: {
          processorId: this.id,
          sport: this.sport,
          errorType: (error as Error).name,
          errorMessage: (error as Error).message,
          shadowMode: this.config.shadowMode,
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Check if processor is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get processor statistics
   */
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  /**
   * Validate game state structure
   */
  validateGameState(gameState: GameState): boolean {
    if (!gameState) return false;
    
    // Check required fields
    const requiredFields = ['gameId', 'sport', 'homeTeam', 'awayTeam', 'status'];
    for (const field of requiredFields) {
      if (!(field in gameState) || gameState[field] === undefined || gameState[field] === null) {
        console.warn(`⚠️ Missing required field in game state: ${field}`);
        return false;
      }
    }
    
    // Sport-specific validation
    if (gameState.sport.toUpperCase() !== this.sport.toUpperCase()) {
      console.warn(`⚠️ Sport mismatch: expected ${this.sport}, got ${gameState.sport}`);
      return false;
    }
    
    return true;
  }

  /**
   * Health check - verify processor is working correctly
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can process a mock game state
      const mockGameState: GameState = this.createMockGameState();
      const mockContext: ProcessorContext = this.createMockContext(mockGameState);
      
      const result = await this.processGameState(mockContext);
      return result.success || result.error?.message.includes('disabled');
      
    } catch (error) {
      console.error(`❌ Health check failed for processor ${this.id}:`, error);
      return false;
    }
  }

  /**
   * Get supported alert types
   */
  getAlertTypes(): string[] {
    return this.getSupportedAlertTypes();
  }

  /**
   * Check if specific alert type is enabled via settings
   */
  async isAlertTypeEnabled(alertType: string): Promise<boolean> {
    // This would integrate with the settings system
    // For now, return true if processor is enabled
    return this.isEnabled();
  }

  // === PROTECTED UTILITY METHODS ===

  /**
   * Filter alerts based on user settings
   */
  protected async filterAlertsBySettings(
    alerts: AlertResult[],
    context: ProcessorContext
  ): Promise<AlertResult[]> {
    if (!this.config.enabled) return [];
    
    const filteredAlerts: AlertResult[] = [];
    
    for (const alert of alerts) {
      // Check if this alert type is enabled in settings
      const isEnabled = context.settings[alert.type] !== false;
      
      if (isEnabled) {
        filteredAlerts.push(alert);
      } else {
        console.log(`🚫 Alert filtered by settings: ${alert.type}`);
      }
    }
    
    return filteredAlerts;
  }

  /**
   * Create empty result for early returns
   */
  protected createEmptyResult(reason: string): ProcessorResult {
    return {
      success: true,
      alerts: [],
      processingTimeMs: 0,
      metadata: {
        processorId: this.id,
        sport: this.sport,
        reason,
        shadowMode: this.config.shadowMode,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Update success statistics
   */
  protected updateSuccessStats(processingTimeMs: number): void {
    this.stats.requestsProcessed++;
    this.stats.lastProcessedAt = Date.now();
    this.stats.consecutiveFailures = 0;
    
    // Update average response time (simple moving average)
    const totalRequests = this.stats.requestsProcessed;
    this.stats.averageResponseTimeMs = 
      (this.stats.averageResponseTimeMs * (totalRequests - 1) + processingTimeMs) / totalRequests;
  }

  /**
   * Update failure statistics
   */
  protected updateFailureStats(): void {
    this.stats.requestsFailed++;
    this.stats.consecutiveFailures++;
    this.stats.lastProcessedAt = Date.now();
  }

  /**
   * Create mock game state for health checks
   */
  protected createMockGameState(): GameState {
    return {
      gameId: `mock_${this.sport.toLowerCase()}_${Date.now()}`,
      sport: this.sport,
      homeTeam: 'MockHome',
      awayTeam: 'MockAway',
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
      isLive: false
    };
  }

  /**
   * Create mock processor context
   */
  protected createMockContext(gameState: GameState): ProcessorContext {
    return {
      gameId: gameState.gameId,
      sport: gameState.sport,
      gameState,
      settings: {},
      processorId: this.id,
      requestId: `mock_request_${Date.now()}`,
      timestamp: Date.now()
    };
  }

  /**
   * Utility method to safely extract team names from objects or strings
   */
  protected getTeamName(team: any): string {
    if (!team) return 'Unknown';
    
    if (typeof team === 'string') return team;
    
    if (typeof team === 'object') {
      return team.name || team.abbreviation || team.displayName || team.shortName || 'Unknown';
    }
    
    return 'Unknown';
  }

  /**
   * Utility method to calculate priority based on game situation
   */
  protected calculateAlertPriority(
    baseValue: number,
    gameState: GameState,
    factors: { isLive?: boolean; isCloseGame?: boolean; isLateGame?: boolean } = {}
  ): number {
    let priority = baseValue;
    
    if (factors.isLive) priority += 10;
    if (factors.isCloseGame) priority += 15;
    if (factors.isLateGame) priority += 10;
    
    return Math.min(priority, 100);
  }

  /**
   * Check if game is in a close score situation
   */
  protected isCloseGame(gameState: GameState, threshold = 3): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return scoreDiff <= threshold;
  }

  /**
   * Create standardized alert key for deduplication
   */
  protected createAlertKey(
    gameId: string,
    alertType: string,
    ...identifiers: (string | number)[]
  ): string {
    const suffix = identifiers.length > 0 ? `_${identifiers.join('_')}` : '';
    return `${gameId}_${alertType}${suffix}`;
  }

  /**
   * Log processor activity (respects shadow mode)
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const prefix = this.config.shadowMode ? '[Shadow]' : '';
    const fullMessage = `${prefix}[${this.id}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(fullMessage, ...args);
        break;
      case 'info':
        console.info(fullMessage, ...args);
        break;
      case 'warn':
        console.warn(fullMessage, ...args);
        break;
      case 'error':
        console.error(fullMessage, ...args);
        break;
    }
  }
}

/**
 * Processor Factory - Creates and manages processor instances
 */
export class ProcessorFactory {
  private static processors = new Map<string, new(id: string, sport: string) => BaseProcessor>();
  
  /**
   * Register a processor class
   */
  static registerProcessor(sport: string, processorClass: new(id: string, sport: string) => BaseProcessor): void {
    this.processors.set(sport.toUpperCase(), processorClass);
    console.log(`🏭 Registered processor for ${sport}`);
  }

  /**
   * Create a processor instance
   */
  static createProcessor(sport: string, id?: string): BaseProcessor | null {
    const ProcessorClass = this.processors.get(sport.toUpperCase());
    if (!ProcessorClass) {
      console.warn(`⚠️ No processor registered for sport: ${sport}`);
      return null;
    }

    const processorId = id || `${sport.toLowerCase()}_processor`;
    return new ProcessorClass(processorId, sport);
  }

  /**
   * Get all registered sports
   */
  static getRegisteredSports(): string[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Check if processor is available for sport
   */
  static hasProcessor(sport: string): boolean {
    return this.processors.has(sport.toUpperCase());
  }
}

/**
 * Processor Manager - Manages multiple processor instances
 */
export class ProcessorManager {
  private processors = new Map<string, BaseProcessor>();
  private defaultConfig: Partial<ProcessorConfig> = {
    enabled: true,
    shadowMode: true,
    maxConcurrency: 5
  };

  /**
   * Add a processor
   */
  addProcessor(processor: BaseProcessor, config?: Partial<ProcessorConfig>): void {
    const key = `${processor.sport}_${processor.id}`;
    this.processors.set(key, processor);
    
    if (config) {
      processor.configure({ ...processor.getStats(), ...this.defaultConfig, ...config } as ProcessorConfig);
    }
    
    console.log(`➕ Added processor: ${key}`);
  }

  /**
   * Remove a processor
   */
  removeProcessor(sport: string, id: string): boolean {
    const key = `${sport}_${id}`;
    const removed = this.processors.delete(key);
    
    if (removed) {
      console.log(`➖ Removed processor: ${key}`);
    }
    
    return removed;
  }

  /**
   * Get processor by sport and ID
   */
  getProcessor(sport: string, id: string): BaseProcessor | null {
    const key = `${sport}_${id}`;
    return this.processors.get(key) || null;
  }

  /**
   * Get all processors for a sport
   */
  getProcessorsForSport(sport: string): BaseProcessor[] {
    const result: BaseProcessor[] = [];
    
    for (const [key, processor] of this.processors) {
      if (processor.sport.toUpperCase() === sport.toUpperCase()) {
        result.push(processor);
      }
    }
    
    return result;
  }

  /**
   * Get all processor statistics
   */
  getAllStats(): Record<string, ProcessorStats> {
    const stats: Record<string, ProcessorStats> = {};
    
    for (const [key, processor] of this.processors) {
      stats[key] = processor.getStats();
    }
    
    return stats;
  }

  /**
   * Perform health checks on all processors
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    const healthChecks = Array.from(this.processors.entries()).map(async ([key, processor]) => {
      try {
        const healthy = await processor.healthCheck();
        results[key] = healthy;
      } catch (error) {
        console.error(`💥 Health check error for ${key}:`, error);
        results[key] = false;
      }
    });
    
    await Promise.all(healthChecks);
    return results;
  }

  /**
   * Enable/disable all processors
   */
  async setAllEnabled(enabled: boolean): Promise<void> {
    const configUpdates = Array.from(this.processors.values()).map(async (processor) => {
      const currentStats = processor.getStats();
      await processor.configure({ ...currentStats, enabled } as ProcessorConfig);
    });
    
    await Promise.all(configUpdates);
    console.log(`${enabled ? '✅ Enabled' : '❌ Disabled'} all processors`);
  }

  /**
   * Set shadow mode for all processors
   */
  async setShadowMode(shadowMode: boolean): Promise<void> {
    const configUpdates = Array.from(this.processors.values()).map(async (processor) => {
      const currentStats = processor.getStats();
      await processor.configure({ ...currentStats, shadowMode } as ProcessorConfig);
    });
    
    await Promise.all(configUpdates);
    console.log(`${shadowMode ? '🌟 Enabled' : '🚀 Disabled'} shadow mode for all processors`);
  }

  /**
   * Get healthy processors
   */
  async getHealthyProcessors(): Promise<string[]> {
    const healthResults = await this.healthCheckAll();
    return Object.entries(healthResults)
      .filter(([_, healthy]) => healthy)
      .map(([key, _]) => key);
  }

  /**
   * Get count of processors by state
   */
  getProcessorCounts(): { total: number; enabled: number; shadowMode: number } {
    let enabled = 0;
    let shadowMode = 0;
    
    for (const processor of this.processors.values()) {
      const stats = processor.getStats();
      if (stats.enabled) enabled++;
      if (stats.shadowMode) shadowMode++;
    }
    
    return {
      total: this.processors.size,
      enabled,
      shadowMode
    };
  }
}

// Export singleton manager
export const processorManager = new ProcessorManager();