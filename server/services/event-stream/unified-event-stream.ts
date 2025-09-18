/**
 * UnifiedEventStream - Core Event-Driven Architecture
 * 
 * Main event stream orchestrator that extends EventEmitter with:
 * - Shadow mode for safe parallel operation
 * - Circuit breaker integration
 * - Backpressure handling with queue limits  
 * - Metrics collection and health monitoring
 * - Multi-sport processor management
 * - Legacy system compatibility
 * 
 * Runs alongside existing unified-alert-generator.ts in shadow mode
 * to validate the new architecture before full migration.
 */

import { EventEmitter } from 'events';
import type { 
  UnifiedEvent,
  EventType,
  EventPriority,
  EventHandler,
  EventSubscription,
  EventStreamMetrics,
  QueueConfig,
  QueueStats,
  ShadowModeConfig,
  ProcessorConfig,
  GameStateChangedEvent,
  AlertGeneratedEvent,
  ProcessorErrorEvent,
  BackpressureTriggeredEvent,
  HealthCheckEvent
} from './types';
import { CircuitBreakerManager, circuitBreakerManager } from './circuit-breaker';
import type { GameState, AlertResult } from '../engines/base-engine';

export interface UnifiedEventStreamConfig {
  shadowMode: ShadowModeConfig;
  queues: QueueConfig[];
  maxConcurrency: number;
  healthCheckIntervalMs: number;
  metricsRetentionMs: number;
  enableDebugLogging: boolean;
}

// Priority queue implementation for event processing
class PriorityQueue<T> {
  private items: Array<{ priority: number; item: T }> = [];

  enqueue(item: T, priority: number): void {
    const queueItem = { priority, item };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (queueItem.priority < this.items[i].priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }
}

export class UnifiedEventStream extends EventEmitter {
  private readonly config: UnifiedEventStreamConfig;
  private readonly circuitBreakers: CircuitBreakerManager;
  
  // Event processing queues
  private readonly eventQueues = new Map<EventType, PriorityQueue<UnifiedEvent>>();
  private readonly queueConfigs = new Map<EventType, QueueConfig>();
  private readonly queueStats = new Map<EventType, QueueStats>();
  
  // Event handlers and subscriptions
  private readonly eventHandlers = new Map<EventType, EventHandler[]>();
  private readonly subscriptions = new Map<string, EventSubscription>();
  
  // Processing control
  private isProcessing = false;
  private readonly processingTasks = new Map<string, Promise<void>>();
  private currentConcurrency = 0;
  
  // Metrics and monitoring
  private readonly metrics: EventStreamMetrics;
  private metricsTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private startTime = Date.now();
  
  // Shadow mode state
  private shadowModeActive = true;
  private comparisonResults: Array<{ event: string; timestamp: number; differences: any }> = [];

  constructor(config: Partial<UnifiedEventStreamConfig> = {}) {
    super();
    
    this.config = {
      shadowMode: {
        enabled: true,
        logLevel: 'detailed',
        sampleRate: 1.0,
        compareWithLegacy: true,
        metricsEnabled: true,
        alertOnDifferences: false,
        ...config.shadowMode
      },
      queues: config.queues || this.getDefaultQueueConfigs(),
      maxConcurrency: config.maxConcurrency || 10,
      healthCheckIntervalMs: config.healthCheckIntervalMs || 30000,
      metricsRetentionMs: config.metricsRetentionMs || 3600000, // 1 hour
      enableDebugLogging: config.enableDebugLogging || true,
      ...config
    };
    
    this.circuitBreakers = circuitBreakerManager;
    this.shadowModeActive = this.config.shadowMode.enabled;
    
    // Initialize metrics
    this.metrics = {
      eventsProcessed: 0,
      eventsDropped: 0,
      averageProcessingTimeMs: 0,
      errorRate: 0,
      queueSizes: {},
      maxQueueSizes: {},
      backpressureCount: 0,
      processorStats: {},
      circuitBreakerStats: {},
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      uptimeMs: 0,
      lastMetricsUpdate: Date.now()
    };
    
    this.initializeQueues();
    this.startEventProcessing();
    this.startHealthMonitoring();
    
    if (this.shadowModeActive) {
      console.log('🌟 UnifiedEventStream started in SHADOW MODE - no user-facing changes');
    } else {
      console.log('🚀 UnifiedEventStream started in ACTIVE MODE');
    }
  }

  /**
   * Initialize event queues based on configuration
   */
  private initializeQueues(): void {
    for (const queueConfig of this.config.queues) {
      const eventType = queueConfig.name as EventType;
      const queue = new PriorityQueue<UnifiedEvent>();
      
      this.eventQueues.set(eventType, queue);
      this.queueConfigs.set(eventType, queueConfig);
      this.queueStats.set(eventType, {
        name: queueConfig.name,
        size: 0,
        maxSize: queueConfig.maxSize,
        processed: 0,
        dropped: 0,
        averageWaitTimeMs: 0,
        oldestEventAge: 0
      });
      
      this.metrics.queueSizes[eventType] = 0;
      this.metrics.maxQueueSizes[eventType] = queueConfig.maxSize;
    }
    
    console.log(`🔧 Initialized ${this.eventQueues.size} event queues`);
  }

  /**
   * Emit an event into the stream
   */
  async emitEvent(event: UnifiedEvent): Promise<void> {
    if (this.shadowModeActive && this.shouldSampleEvent(event)) {
      await this.logShadowModeEvent(event);
    }
    
    const eventType = event.type;
    const queue = this.eventQueues.get(eventType);
    const queueConfig = this.queueConfigs.get(eventType);
    
    if (!queue || !queueConfig) {
      if (this.config.enableDebugLogging) {
        console.warn(`⚠️ No queue configured for event type: ${eventType}`);
      }
      return;
    }
    
    // Check backpressure
    if (queue.size() >= queueConfig.maxSize) {
      await this.handleBackpressure(eventType, queue.size(), queueConfig.maxSize);
      return;
    }
    
    // Enqueue event with priority mapping
    const priority = this.mapEventToPriority(event);
    queue.enqueue(event, priority);
    
    // Update queue metrics
    this.updateQueueMetrics(eventType);
    
    if (this.config.enableDebugLogging && event.priority === 'critical') {
      console.log(`🚨 Critical event queued: ${event.type} (${event.id})`);
    }
  }

  /**
   * Subscribe to specific event types
   */
  subscribe<T extends UnifiedEvent>(
    eventType: EventType,
    handler: EventHandler<T>,
    config: Partial<EventSubscription['config']> = {}
  ): string {
    const subscriptionId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      config: {
        priority: 'medium',
        maxConcurrency: 1,
        timeout: 30000,
        retries: 3,
        ...config
      }
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    // Add to handlers list
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler as EventHandler);
    
    console.log(`📝 Subscribed to ${eventType} events: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;
    
    const handlers = this.eventHandlers.get(subscription.eventType);
    if (handlers) {
      const index = handlers.indexOf(subscription.handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
    
    this.subscriptions.delete(subscriptionId);
    console.log(`🗑️ Unsubscribed: ${subscriptionId}`);
    return true;
  }

  /**
   * Start event processing loop
   */
  private startEventProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('⚡ Starting event processing loop');
    
    // Process events continuously
    setImmediate(() => this.processEventLoop());
  }

  /**
   * Main event processing loop
   */
  private async processEventLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        // Check if we're under concurrency limit
        if (this.currentConcurrency >= this.config.maxConcurrency) {
          await new Promise(resolve => setTimeout(resolve, 10));
          continue;
        }
        
        // Find next event to process across all queues
        const nextEvent = this.getNextEventToProcess();
        if (!nextEvent) {
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }
        
        // Process event asynchronously
        this.currentConcurrency++;
        const processPromise = this.processEvent(nextEvent)
          .finally(() => this.currentConcurrency--);
        
        // Don't await - allow concurrent processing
        this.processingTasks.set(nextEvent.id, processPromise);
        processPromise.finally(() => this.processingTasks.delete(nextEvent.id));
        
      } catch (error) {
        console.error('💥 Error in event processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Get next event to process from all queues
   */
  private getNextEventToProcess(): UnifiedEvent | null {
    let highestPriorityEvent: UnifiedEvent | null = null;
    let highestPriority = -1;
    let selectedQueue: PriorityQueue<UnifiedEvent> | null = null;
    
    for (const [eventType, queue] of this.eventQueues) {
      if (!queue.isEmpty()) {
        const event = queue.peek();
        if (event) {
          const priority = this.mapEventToPriority(event);
          if (priority > highestPriority) {
            highestPriority = priority;
            highestPriorityEvent = event;
            selectedQueue = queue;
          }
        }
      }
    }
    
    if (selectedQueue && highestPriorityEvent) {
      selectedQueue.dequeue();
      return highestPriorityEvent;
    }
    
    return null;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: UnifiedEvent): Promise<void> {
    const startTime = Date.now();
    const handlers = this.eventHandlers.get(event.type) || [];
    
    if (handlers.length === 0) {
      if (this.config.enableDebugLogging) {
        console.log(`📭 No handlers for event type: ${event.type}`);
      }
      return;
    }
    
    try {
      // Process with each handler
      const handlerPromises = handlers.map(async (handler) => {
        const processorId = `${event.source}_${event.type}`;
        const circuitBreaker = this.circuitBreakers.getCircuitBreaker(
          processorId, 
          event.metadata.sport || 'unknown'
        );
        
        try {
          await circuitBreaker.execute(async () => {
            await handler(event);
          });
        } catch (error) {
          console.error(`❌ Handler error for ${event.type}:`, error);
          
          // Emit processor error event
          const errorEvent: ProcessorErrorEvent = {
            id: `error_${event.id}_${Date.now()}`,
            type: 'processor_error',
            timestamp: Date.now(),
            priority: 'high',
            source: processorId,
            retryCount: 0,
            maxRetries: 0,
            metadata: {
              originalEvent: event.id,
              processorId
            },
            payload: {
              processorId,
              gameId: event.metadata.gameId || '',
              sport: event.metadata.sport || 'unknown',
              error: error as Error,
              gameState: {} as GameState, // Would need to be passed in
              attemptedOperation: `handle_${event.type}`,
              errorCode: 'HANDLER_ERROR'
            }
          };
          
          // Don't await to prevent cascade failures
          setImmediate(() => this.emitEvent(errorEvent));
        }
      });
      
      await Promise.allSettled(handlerPromises);
      
      this.metrics.eventsProcessed++;
      
    } catch (error) {
      console.error(`💥 Critical error processing event ${event.id}:`, error);
      this.metrics.eventsDropped++;
    } finally {
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);
    }
  }

  /**
   * Handle backpressure when queues are full
   */
  private async handleBackpressure(
    eventType: EventType, 
    currentSize: number, 
    maxSize: number
  ): Promise<void> {
    this.metrics.backpressureCount++;
    
    const backpressureEvent: BackpressureTriggeredEvent = {
      id: `backpressure_${eventType}_${Date.now()}`,
      type: 'backpressure_triggered',
      timestamp: Date.now(),
      priority: 'high',
      source: 'unified_event_stream',
      retryCount: 0,
      maxRetries: 0,
      metadata: {
        eventType,
        queueName: eventType
      },
      payload: {
        queueName: eventType,
        currentSize,
        maxSize,
        droppedEvents: 1,
        backpressureLevel: currentSize >= maxSize * 0.9 ? 'critical' : 'warning'
      }
    };
    
    // Emit backpressure event (but don't queue it to avoid recursion)
    this.emit('backpressure', backpressureEvent);
    
    console.warn(`🚰 Backpressure triggered for ${eventType}: ${currentSize}/${maxSize}`);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
    
    this.metricsTimer = setInterval(() => {
      this.updateSystemMetrics();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check queue health
      let unhealthyQueues = 0;
      for (const [eventType, queue] of this.eventQueues) {
        const config = this.queueConfigs.get(eventType);
        if (config && queue.size() >= config.maxSize * 0.8) {
          unhealthyQueues++;
        }
      }
      
      // Check circuit breaker health
      const circuitBreakerStats = this.circuitBreakers.getAllStats();
      const openCircuitBreakers = Object.values(circuitBreakerStats)
        .filter(stats => stats.state === 'open').length;
      
      // Determine overall health status
      const status = unhealthyQueues === 0 && openCircuitBreakers === 0 ? 'healthy' :
                    unhealthyQueues <= 1 && openCircuitBreakers <= 2 ? 'degraded' : 'unhealthy';
      
      const healthEvent: HealthCheckEvent = {
        id: `health_${Date.now()}`,
        type: 'health_check',
        timestamp: Date.now(),
        priority: status === 'unhealthy' ? 'critical' : 'low',
        source: 'unified_event_stream',
        retryCount: 0,
        maxRetries: 0,
        metadata: {
          component: 'unified_event_stream',
          unhealthyQueues,
          openCircuitBreakers
        },
        payload: {
          component: 'unified_event_stream',
          status,
          metrics: this.metrics,
          lastCheck: Date.now(),
          responseTime: Date.now() - startTime
        }
      };
      
      this.emit('health_check', healthEvent);
      
      if (this.config.enableDebugLogging && status !== 'healthy') {
        console.warn(`🏥 Health check: ${status} (queues: ${unhealthyQueues}, circuit breakers: ${openCircuitBreakers})`);
      }
      
    } catch (error) {
      console.error('💥 Health check error:', error);
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    // Update queue sizes
    for (const [eventType, queue] of this.eventQueues) {
      this.metrics.queueSizes[eventType] = queue.size();
    }
    
    // Update circuit breaker stats
    this.metrics.circuitBreakerStats = this.circuitBreakers.getAllStats();
    
    // Update uptime
    this.metrics.uptimeMs = Date.now() - this.startTime;
    this.metrics.lastMetricsUpdate = Date.now();
    
    // Memory usage (approximate)
    if (process.memoryUsage) {
      this.metrics.memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }
  }

  /**
   * Shadow mode event logging
   */
  private async logShadowModeEvent(event: UnifiedEvent): Promise<void> {
    if (this.config.shadowMode.logLevel === 'minimal') return;
    
    const logEntry = {
      timestamp: Date.now(),
      eventType: event.type,
      eventId: event.id,
      priority: event.priority,
      source: event.source,
      metadata: event.metadata
    };
    
    if (this.config.shadowMode.logLevel === 'verbose') {
      console.log(`🌟 [Shadow Mode] Event: ${JSON.stringify(logEntry, null, 2)}`);
    } else if (this.config.shadowMode.logLevel === 'detailed' && event.priority === 'critical') {
      console.log(`🌟 [Shadow Mode] Critical Event: ${event.type} (${event.id})`);
    }
  }

  /**
   * Helper methods
   */
  private shouldSampleEvent(event: UnifiedEvent): boolean {
    return Math.random() < this.config.shadowMode.sampleRate;
  }

  private mapEventToPriority(event: UnifiedEvent): number {
    const priorityMap = { low: 1, medium: 2, high: 3, critical: 4 };
    return priorityMap[event.priority] || 2;
  }

  private updateQueueMetrics(eventType: EventType): void {
    const stats = this.queueStats.get(eventType);
    if (stats) {
      const queue = this.eventQueues.get(eventType);
      if (queue) {
        stats.size = queue.size();
        this.metrics.queueSizes[eventType] = stats.size;
      }
    }
  }

  private updateProcessingMetrics(processingTime: number): void {
    // Simple moving average for processing time
    const currentAvg = this.metrics.averageProcessingTimeMs;
    const processed = this.metrics.eventsProcessed;
    this.metrics.averageProcessingTimeMs = 
      (currentAvg * (processed - 1) + processingTime) / processed;
  }

  private getDefaultQueueConfigs(): QueueConfig[] {
    return [
      {
        name: 'game_state_changed',
        maxSize: 10000,
        priority: true,
        batchSize: 100,
        flushIntervalMs: 1000,
        backpressureThreshold: 0.8
      },
      {
        name: 'alert_generated',
        maxSize: 5000,
        priority: true,
        batchSize: 50,
        flushIntervalMs: 500,
        backpressureThreshold: 0.8
      },
      {
        name: 'processor_error',
        maxSize: 1000,
        priority: true,
        batchSize: 10,
        flushIntervalMs: 100,
        backpressureThreshold: 0.9
      },
      {
        name: 'circuit_breaker_opened',
        maxSize: 100,
        priority: true,
        batchSize: 5,
        flushIntervalMs: 100,
        backpressureThreshold: 0.9
      },
      {
        name: 'health_check',
        maxSize: 100,
        priority: false,
        batchSize: 10,
        flushIntervalMs: 30000,
        backpressureThreshold: 0.9
      }
    ];
  }

  /**
   * Public API methods
   */
  
  getMetrics(): EventStreamMetrics {
    return { ...this.metrics };
  }

  getQueueStats(): Record<string, QueueStats> {
    const stats: Record<string, QueueStats> = {};
    for (const [eventType, queueStats] of this.queueStats) {
      stats[eventType] = { ...queueStats };
    }
    return stats;
  }

  isShadowModeActive(): boolean {
    return this.shadowModeActive;
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping UnifiedEventStream...');
    
    this.isProcessing = false;
    
    // Wait for current processing to complete
    if (this.processingTasks.size > 0) {
      console.log(`⏳ Waiting for ${this.processingTasks.size} tasks to complete...`);
      await Promise.allSettled(Array.from(this.processingTasks.values()));
    }
    
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    console.log('✅ UnifiedEventStream stopped');
  }
}

// Singleton instance for global access
export let unifiedEventStream: UnifiedEventStream | null = null;

export function getUnifiedEventStream(config?: Partial<UnifiedEventStreamConfig>): UnifiedEventStream {
  if (!unifiedEventStream) {
    unifiedEventStream = new UnifiedEventStream(config);
  }
  return unifiedEventStream;
}