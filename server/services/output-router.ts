/**
 * OutputRouter - Event Routing and Dual-Write Architecture
 * 
 * Subscribes to both CalendarSyncService and DataIngestionService outputs,
 * routes authoritative events to production while capturing all non-authoritative
 * events in shadow streams for comparison monitoring.
 * 
 * Features:
 * - Dual subscription to both legacy and new data systems
 * - Rollout policy-based routing decisions
 * - Event deduplication to prevent duplicate user-visible events
 * - Dual-write architecture for comparison monitoring
 * - Integration with existing UnifiedEventStream and alert pipelines
 * - Comprehensive metrics and health monitoring
 */

import { EventEmitter } from 'events';
import type { CalendarSyncService, CalendarUpdateEvent } from './calendar-sync-service';
import type { UnifiedEventStream } from './event-stream/unified-event-stream';
import type { UnifiedEvent, GameStateChangedEvent, AlertGeneratedEvent } from './event-stream/types';
import { EventDeduper, type DeduplicationResult, type EventDeduplicationConfig } from './event-deduper';
import type { EventComparator, MetricsCollector } from './event-comparison-system';
import { v4 as uuidv4 } from 'uuid';

// === CORE INTERFACES ===

export interface OutputRouterConfig {
  enabled: boolean;
  enableDeduplication: boolean;
  enableShadowMode: boolean;
  enableMetrics: boolean;
  logLevel: 'minimal' | 'detailed' | 'debug';
  
  // Routing behavior
  defaultRoute: 'production' | 'shadow' | 'both';
  forceProductionSports: string[];
  forceShadowSports: string[];
  
  // Stream configuration
  productionStreamConfig: StreamConfig;
  shadowStreamConfig: StreamConfig;
  
  // Deduplication settings
  deduplication: Partial<EventDeduplicationConfig>;
  
  // Health monitoring
  healthCheck: {
    intervalMs: number;
    timeoutMs: number;
    maxErrorRate: number;
    maxBacklogSize: number;
  };
}

export interface StreamConfig {
  enabled: boolean;
  name: string;
  maxBacklog: number;
  batchSize: number;
  flushIntervalMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface RoutingDecision {
  route: 'production' | 'shadow' | 'both' | 'drop';
  source: 'calendar' | 'ingestion';
  isAuthoritative: boolean;
  reason: string;
  dedupResult?: DeduplicationResult;
}

export interface OutputRouterMetrics {
  eventsReceived: number;
  eventsRouted: number;
  eventsDropped: number;
  eventsDeduplicated: number;
  
  productionEvents: number;
  shadowEvents: number;
  bothEvents: number;
  
  calendarEvents: number;
  ingestionEvents: number;
  
  authoritativeEvents: number;
  nonAuthoritativeEvents: number;
  
  errorCount: number;
  lastErrorTime?: Date;
  
  deduplicationMetrics?: any;
  
  streamBacklogs: {
    production: number;
    shadow: number;
  };
  
  processingLatency: {
    averageMs: number;
    p95Ms: number;
    p99Ms: number;
  };
  
  uptimeMs: number;
  lastMetricsUpdate: Date;
}

export interface RouteableEvent {
  id: string;
  source: 'calendar' | 'ingestion';
  timestamp: number;
  gameId: string;
  sport: string;
  eventType: string;
  originalEvent: UnifiedEvent | CalendarUpdateEvent;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

// === OUTPUT ROUTER IMPLEMENTATION ===

export class OutputRouter extends EventEmitter {
  private readonly config: OutputRouterConfig;
  private readonly eventDeduper: EventDeduper;
  private readonly metrics: OutputRouterMetrics;
  
  // Service references
  private calendarSyncService?: CalendarSyncService;
  private productionStream?: UnifiedEventStream;
  private shadowStream?: UnifiedEventStream;
  
  // Comparison system
  private eventComparator?: EventComparator;
  private metricsCollector?: MetricsCollector;
  
  // Processing queues
  private readonly productionQueue: RouteableEvent[] = [];
  private readonly shadowQueue: RouteableEvent[] = [];
  
  // State management
  private outputRouterRunning = false;
  private subscriptions: string[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;
  private startTime = Date.now();
  
  // Performance tracking
  private processingTimes: number[] = [];
  private readonly maxProcessingTimes = 1000;

  constructor(config: Partial<OutputRouterConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      enableDeduplication: true,
      enableShadowMode: true,
      enableMetrics: true,
      logLevel: 'detailed',
      defaultRoute: 'both',
      forceProductionSports: [],
      forceShadowSports: [],
      productionStreamConfig: {
        enabled: true,
        name: 'production',
        maxBacklog: 10000,
        batchSize: 100,
        flushIntervalMs: 1000,
        retryAttempts: 3,
        retryDelayMs: 1000
      },
      shadowStreamConfig: {
        enabled: true,
        name: 'shadow',
        maxBacklog: 20000,
        batchSize: 200,
        flushIntervalMs: 2000,
        retryAttempts: 1,
        retryDelayMs: 5000
      },
      deduplication: {
        enabled: true,
        defaultTtlMs: 300_000,
        maxStoredFingerprints: 50_000,
        logLevel: 'minimal'
      },
      healthCheck: {
        intervalMs: 30_000,
        timeoutMs: 5_000,
        maxErrorRate: 0.05,
        maxBacklogSize: 50000
      },
      ...config
    };

    // Initialize event deduper
    this.eventDeduper = new EventDeduper({
      enabled: this.config.enableDeduplication,
      ...this.config.deduplication
    });

    // Initialize metrics
    this.metrics = {
      eventsReceived: 0,
      eventsRouted: 0,
      eventsDropped: 0,
      eventsDeduplicated: 0,
      productionEvents: 0,
      shadowEvents: 0,
      bothEvents: 0,
      calendarEvents: 0,
      ingestionEvents: 0,
      authoritativeEvents: 0,
      nonAuthoritativeEvents: 0,
      errorCount: 0,
      streamBacklogs: {
        production: 0,
        shadow: 0
      },
      processingLatency: {
        averageMs: 0,
        p95Ms: 0,
        p99Ms: 0
      },
      uptimeMs: 0,
      lastMetricsUpdate: new Date()
    };

    this.logInitialization();
  }

  // === INITIALIZATION AND SETUP ===

  /**
   * Set rollout controller for routing decisions
   */
  // Simplified architecture - no rollout controller needed

  /**
   * Set calendar sync service for event subscription
   */
  setCalendarSyncService(calendarSyncService: CalendarSyncService): void {
    this.calendarSyncService = calendarSyncService;
    console.log('📤 OutputRouter: CalendarSyncService integration enabled');
  }

  /**
   * Set data ingestion service for event subscription
   */
  // Simplified architecture - CalendarSyncService only

  /**
   * Set production stream for authoritative events
   */
  setProductionStream(productionStream: UnifiedEventStream): void {
    this.productionStream = productionStream;
    console.log('📤 OutputRouter: ProductionStream integration enabled');
  }

  /**
   * Set shadow stream for comparison monitoring
   */
  setShadowStream(shadowStream: UnifiedEventStream): void {
    this.shadowStream = shadowStream;
    console.log('📤 OutputRouter: ShadowStream integration enabled');
  }

  /**
   * Set event comparator for production vs shadow comparison
   */
  setEventComparator(eventComparator: EventComparator): void {
    this.eventComparator = eventComparator;
    console.log('📤 OutputRouter: EventComparator integration enabled');
  }

  /**
   * Set metrics collector for comparison metrics
   */
  setMetricsCollector(metricsCollector: MetricsCollector): void {
    this.metricsCollector = metricsCollector;
    console.log('📤 OutputRouter: MetricsCollector integration enabled');
  }

  // === LIFECYCLE MANAGEMENT ===

  /**
   * Start the output router
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('📤 OutputRouter: Disabled - events will pass through without routing');
      return;
    }

    if (this.outputRouterRunning) {
      console.log('⚠️ OutputRouter: Already running');
      return;
    }

    try {
      console.log('🚀 OutputRouter: Starting event routing system...');
      
      // Validate dependencies
      this.validateDependencies();
      
      // Subscribe to event sources
      await this.subscribeToSources();
      
      // Start processing loops
      this.startProcessingLoops();
      
      // Start health monitoring
      if (this.config.enableMetrics) {
        this.startHealthMonitoring();
      }
      
      this.outputRouterRunning = true;
      this.startTime = Date.now();
      
      console.log('✅ OutputRouter: Started successfully');
      this.logRouterStatus();

    } catch (error) {
      console.error('❌ OutputRouter: Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the output router
   */
  async stop(): Promise<void> {
    if (!this.outputRouterRunning) {
      console.log('📤 OutputRouter: Not running');
      return;
    }

    try {
      console.log('🛑 OutputRouter: Stopping...');
      
      this.outputRouterRunning = false;
      
      // Clear timers
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }
      
      // Unsubscribe from sources
      this.unsubscribeFromSources();
      
      // Flush remaining events
      await this.flushAllQueues();
      
      // Stop deduper
      this.eventDeduper.stop();
      
      console.log('✅ OutputRouter: Stopped successfully');

    } catch (error) {
      console.error('❌ OutputRouter: Error during shutdown:', error);
      throw error;
    }
  }

  // === EVENT PROCESSING ===

  /**
   * Process calendar sync event
   */
  private async processCalendarEvent(event: CalendarUpdateEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.metrics.eventsReceived++;
      this.metrics.calendarEvents++;

      // Convert to routable event
      const routeableEvent: RouteableEvent = {
        id: uuidv4(),
        source: 'calendar',
        timestamp: Date.now(),
        gameId: event.gameId,
        sport: event.sport,
        eventType: 'calendar_update',
        originalEvent: event,
        priority: this.determineEventPriority(event),
        metadata: {
          previousStatus: event.previousStatus,
          newStatus: event.newStatus,
          venue: event.gameData.venue
        }
      };

      await this.routeEvent(routeableEvent);
      
    } catch (error) {
      this.handleProcessingError('calendar', event, error);
    } finally {
      this.recordProcessingTime(Date.now() - startTime);
    }
  }

  /**
   * Process data ingestion event
   */
  private async processIngestionEvent(event: UnifiedEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.metrics.eventsReceived++;
      this.metrics.ingestionEvents++;

      // Convert to routable event
      const routeableEvent: RouteableEvent = {
        id: event.id,
        source: 'ingestion',
        timestamp: event.timestamp,
        gameId: this.extractGameId(event),
        sport: this.extractSport(event),
        eventType: event.type,
        originalEvent: event,
        priority: event.priority,
        metadata: event.metadata
      };

      await this.routeEvent(routeableEvent);
      
    } catch (error) {
      this.handleProcessingError('ingestion', event, error);
    } finally {
      this.recordProcessingTime(Date.now() - startTime);
    }
  }

  /**
   * Route event based on rollout policy and deduplication
   */
  private async routeEvent(event: RouteableEvent): Promise<void> {
    // Make routing decision
    const decision = await this.makeRoutingDecision(event);
    
    if (decision.route === 'drop') {
      this.metrics.eventsDropped++;
      if (this.config.logLevel === 'debug') {
        console.log(`📤 OutputRouter: Dropped event ${event.id} - ${decision.reason}`);
      }
      return;
    }

    // Update metrics based on decision
    this.updateRoutingMetrics(decision);

    // Route to appropriate streams
    await this.executeRouting(event, decision);
    
    this.metrics.eventsRouted++;
    
    if (this.config.logLevel === 'debug') {
      console.log(`📤 OutputRouter: Routed event ${event.id} to ${decision.route} (${decision.reason})`);
    }
  }

  /**
   * Make routing decision based on rollout policy and deduplication
   */
  private async makeRoutingDecision(event: RouteableEvent): Promise<RoutingDecision> {
    // Check deduplication first
    let dedupResult: DeduplicationResult | undefined;
    
    if (this.config.enableDeduplication) {
      dedupResult = this.eventDeduper.checkDuplicate(event.originalEvent);
      
      if (dedupResult.isDuplicate && dedupResult.action === 'skip') {
        this.metrics.eventsDeduplicated++;
        return {
          route: 'drop',
          source: event.source,
          isAuthoritative: false,
          reason: `duplicate: ${dedupResult.reason}`,
          dedupResult
        };
      }
    }

    // Check force routing rules first
    if (this.config.forceProductionSports.includes(event.sport)) {
      return {
        route: 'production',
        source: event.source,
        isAuthoritative: true,
        reason: `force production for sport ${event.sport}`,
        dedupResult
      };
    }

    if (this.config.forceShadowSports.includes(event.sport)) {
      return {
        route: 'shadow',
        source: event.source,
        isAuthoritative: false,
        reason: `force shadow for sport ${event.sport}`,
        dedupResult
      };
    }

    // Use rollout controller to determine authoritative source
    if (!this.rolloutController) {
      return {
        route: this.config.defaultRoute,
        source: event.source,
        isAuthoritative: event.source === 'calendar', // Default to calendar as authoritative
        reason: 'no rollout controller - using default',
        dedupResult
      };
    }

    // Determine if this source should be authoritative for this sport/game
    const shouldUseIngestion = this.rolloutController.shouldUseIngestion(event.sport, event.gameId);
    const isAuthoritative = (event.source === 'ingestion' && shouldUseIngestion) || 
                           (event.source === 'calendar' && !shouldUseIngestion);

    // Route based on authorization and shadow mode settings
    if (isAuthoritative) {
      return {
        route: this.config.enableShadowMode ? 'both' : 'production',
        source: event.source,
        isAuthoritative: true,
        reason: `authoritative ${event.source} for ${event.sport} (rollout: ${shouldUseIngestion ? 'ingestion' : 'calendar'})`,
        dedupResult
      };
    } else {
      return {
        route: 'shadow',
        source: event.source,
        isAuthoritative: false,
        reason: `non-authoritative ${event.source} for ${event.sport} (rollout: ${shouldUseIngestion ? 'ingestion' : 'calendar'})`,
        dedupResult
      };
    }
  }

  /**
   * Execute the routing decision
   */
  private async executeRouting(event: RouteableEvent, decision: RoutingDecision): Promise<void> {
    switch (decision.route) {
      case 'production':
        await this.queueForProduction(event, decision);
        break;
        
      case 'shadow':
        await this.queueForShadow(event, decision);
        break;
        
      case 'both':
        await this.queueForProduction(event, decision);
        await this.queueForShadow(event, decision);
        break;
        
      default:
        console.warn(`📤 OutputRouter: Unknown route ${decision.route} for event ${event.id}`);
    }
  }

  /**
   * Queue event for production stream
   */
  private async queueForProduction(event: RouteableEvent, decision: RoutingDecision): Promise<void> {
    if (!this.config.productionStreamConfig.enabled || !this.productionStream) {
      if (this.config.logLevel === 'debug') {
        console.log(`📤 OutputRouter: Production stream disabled for event ${event.id}`);
      }
      return;
    }

    // Check backlog limit
    if (this.productionQueue.length >= this.config.productionStreamConfig.maxBacklog) {
      console.warn(`📤 OutputRouter: Production queue full (${this.productionQueue.length}), dropping event ${event.id}`);
      this.metrics.eventsDropped++;
      return;
    }

    this.productionQueue.push(event);
    this.scheduleFlush('production');
    
    // Notify event comparator about production event
    if (this.eventComparator) {
      this.eventComparator.processProductionEvent(event);
    }
  }

  /**
   * Queue event for shadow stream
   */
  private async queueForShadow(event: RouteableEvent, decision: RoutingDecision): Promise<void> {
    if (!this.config.shadowStreamConfig.enabled || !this.shadowStream) {
      if (this.config.logLevel === 'debug') {
        console.log(`📤 OutputRouter: Shadow stream disabled for event ${event.id}`);
      }
      return;
    }

    // Check backlog limit
    if (this.shadowQueue.length >= this.config.shadowStreamConfig.maxBacklog) {
      if (this.config.logLevel === 'detailed') {
        console.warn(`📤 OutputRouter: Shadow queue full (${this.shadowQueue.length}), dropping event ${event.id}`);
      }
      this.metrics.eventsDropped++;
      return;
    }

    this.shadowQueue.push(event);
    this.scheduleFlush('shadow');
    
    // Notify event comparator about shadow event
    if (this.eventComparator) {
      this.eventComparator.processShadowEvent(event);
    }
  }

  // === QUEUE PROCESSING ===

  /**
   * Schedule queue flush
   */
  private scheduleFlush(streamType: 'production' | 'shadow'): void {
    const config = streamType === 'production' ? 
      this.config.productionStreamConfig : 
      this.config.shadowStreamConfig;
    
    // Don't schedule if already scheduled or if queue is small
    const queue = streamType === 'production' ? this.productionQueue : this.shadowQueue;
    if (queue.length < config.batchSize && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushQueue(streamType);
        this.flushTimer = undefined;
      }, config.flushIntervalMs);
    } else if (queue.length >= config.batchSize) {
      // Immediate flush for large batches
      setImmediate(() => this.flushQueue(streamType));
    }
  }

  /**
   * Flush queue to stream
   */
  private async flushQueue(streamType: 'production' | 'shadow'): Promise<void> {
    const queue = streamType === 'production' ? this.productionQueue : this.shadowQueue;
    const stream = streamType === 'production' ? this.productionStream : this.shadowStream;
    const config = streamType === 'production' ? 
      this.config.productionStreamConfig : 
      this.config.shadowStreamConfig;

    if (queue.length === 0 || !stream) return;

    const batch = queue.splice(0, config.batchSize);
    
    try {
      // Convert events back to UnifiedEvents and emit to stream
      for (const routeableEvent of batch) {
        await stream.emitEvent(routeableEvent.originalEvent as UnifiedEvent);
      }

      if (streamType === 'production') {
        this.metrics.productionEvents += batch.length;
      } else {
        this.metrics.shadowEvents += batch.length;
      }

      if (this.config.logLevel === 'debug') {
        console.log(`📤 OutputRouter: Flushed ${batch.length} events to ${streamType} stream`);
      }

    } catch (error) {
      console.error(`❌ OutputRouter: Error flushing ${streamType} queue:`, error);
      this.metrics.errorCount++;
      
      // Re-queue events for retry (if configured)
      if (config.retryAttempts > 0) {
        // Add retry logic here
        queue.unshift(...batch);
      }
    }

    // Update backlog metrics
    this.metrics.streamBacklogs[streamType] = queue.length;
  }

  /**
   * Flush all queues
   */
  private async flushAllQueues(): Promise<void> {
    await Promise.all([
      this.flushQueue('production'),
      this.flushQueue('shadow')
    ]);
  }

  // === HELPER METHODS ===

  private validateDependencies(): void {
    if (!this.rolloutController) {
      console.warn('⚠️ OutputRouter: No rollout controller set - using default routing');
    }
    
    if (!this.calendarSyncService && !this.dataIngestionService) {
      throw new Error('OutputRouter: At least one event source must be configured');
    }

    if (!this.productionStream && !this.shadowStream) {
      throw new Error('OutputRouter: At least one output stream must be configured');
    }
  }

  private async subscribeToSources(): Promise<void> {
    // Subscribe to calendar sync events
    if (this.calendarSyncService) {
      // CalendarSyncService doesn't expose event subscription in the interface we saw
      // We'll need to add this functionality or use a different approach
      console.log('📤 OutputRouter: Calendar sync event subscription needs implementation');
    }

    // Subscribe to data ingestion events
    if (this.dataIngestionService) {
      // DataIngestionService extends EventEmitter
      this.dataIngestionService.on('game_state_changed', (event: GameStateChangedEvent) => {
        this.processIngestionEvent(event);
      });
      
      this.dataIngestionService.on('alert_generated', (event: AlertGeneratedEvent) => {
        this.processIngestionEvent(event);
      });

      console.log('📤 OutputRouter: Subscribed to DataIngestionService events');
    }
  }

  private unsubscribeFromSources(): void {
    // Remove all subscriptions
    this.subscriptions.forEach(id => {
      // Implementation depends on how subscriptions are managed
    });
    this.subscriptions = [];
  }

  private startProcessingLoops(): void {
    // Start periodic queue flushing
    const flushBoth = () => {
      if (this.outputRouterRunning) {
        this.flushQueue('production');
        this.flushQueue('shadow');
        setTimeout(flushBoth, 1000); // Process every second
      }
    };
    
    setTimeout(flushBoth, 1000);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheck.intervalMs);
  }

  private performHealthCheck(): void {
    try {
      // Update metrics
      this.updateLatencyMetrics();
      this.metrics.uptimeMs = Date.now() - this.startTime;
      this.metrics.lastMetricsUpdate = new Date();
      
      // Get deduplication metrics
      this.metrics.deduplicationMetrics = this.eventDeduper.getMetrics();
      
      // Check health status
      const errorRate = this.metrics.eventsReceived > 0 ? 
        (this.metrics.errorCount / this.metrics.eventsReceived) : 0;
      
      const totalBacklog = this.metrics.streamBacklogs.production + this.metrics.streamBacklogs.shadow;
      
      const isHealthy = errorRate <= this.config.healthCheck.maxErrorRate && 
                       totalBacklog <= this.config.healthCheck.maxBacklogSize;

      if (!isHealthy) {
        console.warn(`🏥 OutputRouter: Health check failed - error rate: ${(errorRate * 100).toFixed(2)}%, backlog: ${totalBacklog}`);
      }

      // Emit health check event
      this.emit('health_check', {
        healthy: isHealthy,
        metrics: this.getMetrics(),
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ OutputRouter: Health check error:', error);
    }
  }

  private determineEventPriority(event: CalendarUpdateEvent): 'low' | 'medium' | 'high' | 'critical' {
    // Status change events are higher priority
    if (event.previousStatus !== event.newStatus) {
      if (event.newStatus === 'live' || event.previousStatus === 'live') {
        return 'high';
      }
      return 'medium';
    }
    return 'low';
  }

  private extractGameId(event: UnifiedEvent): string {
    if (event.metadata?.gameId) return event.metadata.gameId;
    if ('payload' in event && event.payload && typeof event.payload === 'object' && 'gameId' in event.payload) {
      return event.payload.gameId as string;
    }
    return 'unknown';
  }

  private extractSport(event: UnifiedEvent): string {
    if (event.metadata?.sport) return event.metadata.sport;
    if ('payload' in event && event.payload && typeof event.payload === 'object' && 'sport' in event.payload) {
      return event.payload.sport as string;
    }
    return 'unknown';
  }

  private updateRoutingMetrics(decision: RoutingDecision): void {
    if (decision.isAuthoritative) {
      this.metrics.authoritativeEvents++;
    } else {
      this.metrics.nonAuthoritativeEvents++;
    }

    switch (decision.route) {
      case 'production':
        // Will be updated in queue flush
        break;
      case 'shadow':
        // Will be updated in queue flush
        break;
      case 'both':
        this.metrics.bothEvents++;
        break;
    }
  }

  private recordProcessingTime(timeMs: number): void {
    this.processingTimes.push(timeMs);
    if (this.processingTimes.length > this.maxProcessingTimes) {
      this.processingTimes.shift();
    }
  }

  private updateLatencyMetrics(): void {
    if (this.processingTimes.length === 0) return;

    const sorted = [...this.processingTimes].sort((a, b) => a - b);
    const average = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.metrics.processingLatency = {
      averageMs: Math.round(average),
      p95Ms: sorted[p95Index] || 0,
      p99Ms: sorted[p99Index] || 0
    };
  }

  private handleProcessingError(source: string, event: any, error: any): void {
    this.metrics.errorCount++;
    this.metrics.lastErrorTime = new Date();
    
    console.error(`❌ OutputRouter: Error processing ${source} event:`, {
      eventId: event.id || 'unknown',
      eventType: event.type || 'unknown',
      error: error.message
    });

    // Emit error event for monitoring
    this.emit('processing_error', {
      source,
      event,
      error,
      timestamp: Date.now()
    });
  }

  private logInitialization(): void {
    console.log('📤 OutputRouter: Initialized with configuration:');
    console.log(`📤   Enabled: ${this.config.enabled}`);
    console.log(`📤   Deduplication: ${this.config.enableDeduplication}`);
    console.log(`📤   Shadow Mode: ${this.config.enableShadowMode}`);
    console.log(`📤   Default Route: ${this.config.defaultRoute}`);
    console.log(`📤   Production Stream: ${this.config.productionStreamConfig.enabled ? 'enabled' : 'disabled'}`);
    console.log(`📤   Shadow Stream: ${this.config.shadowStreamConfig.enabled ? 'enabled' : 'disabled'}`);
  }

  private logRouterStatus(): void {
    console.log('');
    console.log('📤 ==================== OUTPUT ROUTER STATUS ====================');
    console.log(`📤 Status: RUNNING`);
    console.log(`📤 Deduplication: ${this.config.enableDeduplication ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📤 Shadow Mode: ${this.config.enableShadowMode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📤 Connected Services:`);
    console.log(`📤   Calendar Sync: ${this.calendarSyncService ? '✅' : '❌'}`);
    console.log(`📤   Data Ingestion: ${this.dataIngestionService ? '✅' : '❌'}`);
    console.log(`📤   Production Stream: ${this.productionStream ? '✅' : '❌'}`);
    console.log(`📤   Shadow Stream: ${this.shadowStream ? '✅' : '❌'}`);
    console.log(`📤   Rollout Controller: ${this.rolloutController ? '✅' : '❌'}`);
    console.log('📤 ===============================================================');
    console.log('');
  }

  // === PUBLIC API ===

  /**
   * Get current metrics
   */
  getMetrics(): OutputRouterMetrics {
    this.updateLatencyMetrics();
    this.metrics.uptimeMs = Date.now() - this.startTime;
    this.metrics.lastMetricsUpdate = new Date();
    this.metrics.streamBacklogs.production = this.productionQueue.length;
    this.metrics.streamBacklogs.shadow = this.shadowQueue.length;
    
    return { ...this.metrics };
  }

  /**
   * Check if router is healthy
   */
  isHealthy(): boolean {
    const errorRate = this.metrics.eventsReceived > 0 ? 
      (this.metrics.errorCount / this.metrics.eventsReceived) : 0;
    const totalBacklog = this.metrics.streamBacklogs.production + this.metrics.streamBacklogs.shadow;
    
    return errorRate <= this.config.healthCheck.maxErrorRate && 
           totalBacklog <= this.config.healthCheck.maxBacklogSize;
  }

  /**
   * Check if router is running
   */
  isRunning(): boolean {
    return this.outputRouterRunning;
  }

  /**
   * Force flush all queues
   */
  async flush(): Promise<void> {
    await this.flushAllQueues();
  }
}