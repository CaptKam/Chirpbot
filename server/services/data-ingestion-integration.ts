/**
 * DataIngestion Integration Layer
 * 
 * Provides integration between DataIngestionService and the main application.
 * Handles service initialization, shadow mode coordination, and graceful shutdown.
 * Runs alongside existing systems for validation and comparison.
 */

import { DataIngestionService } from './data-ingestion-service';
import { UnifiedEventStream } from './event-stream/unified-event-stream';
import { circuitBreakerManager } from './event-stream/circuit-breaker';

export interface DataIngestionIntegrationConfig {
  shadowMode: boolean;
  enableMetrics: boolean;
  healthCheckIntervalMs: number;
  logLevel: 'minimal' | 'detailed' | 'debug';
}

export class DataIngestionIntegration {
  private dataIngestionService?: DataIngestionService;
  private unifiedEventStream?: UnifiedEventStream;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  private isInitialized = false;

  constructor(private config: DataIngestionIntegrationConfig) {
    console.log(`🔧 DataIngestion Integration initialized in ${config.shadowMode ? 'SHADOW' : 'ACTIVE'} mode`);
  }

  /**
   * Initialize the data ingestion system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ DataIngestion Integration already initialized');
      return;
    }

    try {
      console.log('🚀 DataIngestion Integration: Starting initialization...');

      // Initialize circuit breakers for all sports
      this.initializeCircuitBreakers();

      // Initialize UnifiedEventStream first
      this.unifiedEventStream = new UnifiedEventStream({
        shadowMode: {
          enabled: this.config.shadowMode,
          logLevel: this.config.logLevel,
          sampleRate: 1.0,
          compareWithLegacy: true,
          metricsEnabled: this.config.enableMetrics,
          alertOnDifferences: false
        },
        enableDebugLogging: this.config.logLevel === 'debug'
      });

      // Initialize DataIngestionService
      this.dataIngestionService = new DataIngestionService({
        shadowMode: this.config.shadowMode,
        enableEventEmission: true,
        sports: ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL']
      });

      // Connect services
      this.dataIngestionService.setEventStream(this.unifiedEventStream);

      // Start services
      await this.dataIngestionService.start();

      // Start health monitoring
      if (this.config.enableMetrics) {
        this.startHealthMonitoring();
      }

      this.isInitialized = true;

      console.log(`✅ DataIngestion Integration: Successfully initialized in ${this.config.shadowMode ? 'SHADOW' : 'ACTIVE'} mode`);

      // Log comparison with legacy system
      if (this.config.shadowMode) {
        this.logShadowModeStatus();
      }

    } catch (error) {
      console.error('❌ DataIngestion Integration: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize circuit breakers for all sports
   */
  private initializeCircuitBreakers(): void {
    const sports = ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'];
    
    for (const sport of sports) {
      const breakerName = `data-ingestion-${sport.toLowerCase()}`;
      circuitBreakerManager.createBreaker(breakerName, {
        failureThreshold: 5,
        recoveryTimeoutMs: 30_000,
        monitoringWindowMs: 60_000,
        minimumRequests: 10,
        errorRateThreshold: 0.5
      }, sport);
    }

    console.log(`🔧 DataIngestion Integration: Circuit breakers initialized for ${sports.length} sports`);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);

    console.log(`🏥 DataIngestion Integration: Health monitoring started (${this.config.healthCheckIntervalMs}ms interval)`);
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthResults = {
        ingestionService: null as any,
        eventStream: null as any,
        circuitBreakers: null as any,
        integration: null as any
      };

      // Check DataIngestionService health
      if (this.dataIngestionService) {
        healthResults.ingestionService = await this.dataIngestionService.healthCheck();
      }

      // Check circuit breaker health
      healthResults.circuitBreakers = this.getCircuitBreakerHealth();

      // Check integration health
      healthResults.integration = {
        healthy: this.isInitialized,
        uptimeMs: Date.now() - this.startTime,
        shadowMode: this.config.shadowMode
      };

      // Log health summary
      if (this.config.logLevel === 'detailed' || this.config.logLevel === 'debug') {
        this.logHealthSummary(healthResults);
      }

      // Emit health check event
      if (this.unifiedEventStream) {
        await this.unifiedEventStream.emitEvent({
          id: `health-${Date.now()}`,
          type: 'health_check',
          timestamp: Date.now(),
          priority: 'low',
          source: 'data-ingestion-integration',
          retryCount: 0,
          maxRetries: 0,
          metadata: { shadowMode: this.config.shadowMode },
          payload: {
            component: 'data-ingestion-integration',
            status: this.determineOverallHealth(healthResults),
            metrics: this.dataIngestionService?.getMetrics() || {},
            lastCheck: Date.now(),
            responseTime: Date.now() // Placeholder for response time calculation
          }
        });
      }

    } catch (error) {
      console.error('❌ DataIngestion Integration: Health check failed:', error);
    }
  }

  /**
   * Get circuit breaker health status
   */
  private getCircuitBreakerHealth(): any {
    const sports = ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'];
    const breakerHealth: any = {};

    for (const sport of sports) {
      const breakerName = `data-ingestion-${sport.toLowerCase()}`;
      const breaker = circuitBreakerManager.getBreaker(breakerName);
      if (breaker) {
        breakerHealth[sport] = {
          canExecute: breaker.canExecute(),
          stats: breaker.getStats()
        };
      }
    }

    return breakerHealth;
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(healthResults: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (!healthResults.ingestionService?.healthy) {
      return 'unhealthy';
    }

    // Check circuit breaker states
    const breakerStates = Object.values(healthResults.circuitBreakers || {});
    const openBreakers = breakerStates.filter((b: any) => !b.canExecute).length;
    
    if (openBreakers > 2) {
      return 'unhealthy';
    } else if (openBreakers > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Log health summary
   */
  private logHealthSummary(healthResults: any): void {
    console.log(`🏥 DataIngestion Health Summary:`);
    console.log(`   Ingestion Service: ${healthResults.ingestionService?.healthy ? '✅' : '❌'}`);
    console.log(`   Games Tracked: ${healthResults.ingestionService?.details?.gamesTracked || 0}`);
    console.log(`   Circuit Breakers: ${Object.keys(healthResults.circuitBreakers).length} sports`);
    console.log(`   Shadow Mode: ${this.config.shadowMode ? '🌊 ENABLED' : '🚀 DISABLED'}`);
    console.log(`   Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
  }

  /**
   * Log shadow mode status
   */
  private logShadowModeStatus(): void {
    console.log('');
    console.log('🌊 ================== SHADOW MODE STATUS ==================');
    console.log('🌊 DataIngestionService is running in SHADOW MODE');
    console.log('🌊 - Parallel operation alongside existing calendar sync');
    console.log('🌊 - Events are logged but do not affect user-facing systems');
    console.log('🌊 - Comparing performance with legacy polling managers');
    console.log('🌊 - Ready for validation and performance comparison');
    console.log('🌊 ======================================================');
    console.log('');
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): any {
    if (!this.isInitialized) return null;

    return {
      ingestion: this.dataIngestionService?.getMetrics() || {},
      circuitBreakers: this.getCircuitBreakerHealth(),
      integration: {
        initialized: this.isInitialized,
        uptimeMs: Date.now() - this.startTime,
        shadowMode: this.config.shadowMode,
        healthChecks: this.healthCheckInterval ? 'active' : 'inactive'
      }
    };
  }

  /**
   * Get current game data
   */
  getGameData(): any[] {
    return this.dataIngestionService?.getGameData() || [];
  }

  /**
   * Get specific game by ID
   */
  getGameById(gameId: string): any {
    return this.dataIngestionService?.getGameById(gameId);
  }

  /**
   * Force refresh specific game
   */
  async forceRefreshGame(gameId: string): Promise<any> {
    return this.dataIngestionService?.forceRefreshGame(gameId);
  }

  /**
   * Toggle shadow mode
   */
  setShadowMode(enabled: boolean): void {
    this.config.shadowMode = enabled;
    this.dataIngestionService?.setShadowMode(enabled);
    
    console.log(`🌊 DataIngestion Integration: Shadow mode ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
      this.logShadowModeStatus();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 DataIngestion Integration: Starting graceful shutdown...');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Stop DataIngestionService
      if (this.dataIngestionService) {
        await this.dataIngestionService.stop();
      }

      // Note: UnifiedEventStream shutdown is handled elsewhere if needed

      this.isInitialized = false;

      console.log('✅ DataIngestion Integration: Graceful shutdown complete');
    } catch (error) {
      console.error('❌ DataIngestion Integration: Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    return this.isInitialized && 
           this.dataIngestionService !== undefined && 
           this.unifiedEventStream !== undefined;
  }
}

// Export singleton instance for application use
export const dataIngestionIntegration = new DataIngestionIntegration({
  shadowMode: true, // Start in shadow mode for safety
  enableMetrics: true,
  healthCheckIntervalMs: 30_000,
  logLevel: 'detailed'
});