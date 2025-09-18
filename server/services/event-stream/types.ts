/**
 * UnifiedEventStream Core Types
 * 
 * Defines all event interfaces, discriminated unions, and type contracts
 * for the event-driven alert architecture. Maintains compatibility with
 * existing GameState and AlertResult while adding streaming capabilities.
 */

import type { GameState, AlertResult } from '../engines/base-engine';

// === CORE EVENT TYPES ===

export type EventType = 
  | 'game_state_changed'
  | 'alert_generated' 
  | 'alert_sent'
  | 'processor_error'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_closed'
  | 'backpressure_triggered'
  | 'health_check';

export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

// === BASE EVENT INTERFACE ===

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  priority: EventPriority;
  source: string;
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, any>;
}

// === SPECIFIC EVENT TYPES ===

export interface GameStateChangedEvent extends BaseEvent {
  type: 'game_state_changed';
  payload: {
    gameId: string;
    sport: string;
    previousState: GameState | null;
    currentState: GameState;
    changes: string[];
    isSignificantChange: boolean;
  };
}

export interface AlertGeneratedEvent extends BaseEvent {
  type: 'alert_generated';
  payload: {
    gameId: string;
    sport: string;
    alertResult: AlertResult;
    gameState: GameState;
    processorId: string;
    generationTimeMs: number;
  };
}

export interface AlertSentEvent extends BaseEvent {
  type: 'alert_sent';
  payload: {
    gameId: string;
    sport: string;
    alertId: string;
    alertKey: string;
    recipient: string;
    deliveryMethod: string;
    deliveryTimeMs: number;
    success: boolean;
    error?: string;
  };
}

export interface ProcessorErrorEvent extends BaseEvent {
  type: 'processor_error';
  payload: {
    processorId: string;
    gameId: string;
    sport: string;
    error: Error;
    gameState: GameState;
    attemptedOperation: string;
    errorCode: string;
  };
}

export interface CircuitBreakerEvent extends BaseEvent {
  type: 'circuit_breaker_opened' | 'circuit_breaker_closed';
  payload: {
    processorId: string;
    sport: string;
    state: 'open' | 'closed' | 'half_open';
    failureCount: number;
    lastFailureTime: number;
    nextRetryTime: number;
    errorRate: number;
  };
}

export interface BackpressureTriggeredEvent extends BaseEvent {
  type: 'backpressure_triggered';
  payload: {
    queueName: string;
    currentSize: number;
    maxSize: number;
    droppedEvents: number;
    backpressureLevel: 'warning' | 'critical';
  };
}

export interface HealthCheckEvent extends BaseEvent {
  type: 'health_check';
  payload: {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: EventStreamMetrics;
    lastCheck: number;
    responseTime: number;
  };
}

// === DISCRIMINATED UNION OF ALL EVENTS ===

export type UnifiedEvent = 
  | GameStateChangedEvent
  | AlertGeneratedEvent
  | AlertSentEvent
  | ProcessorErrorEvent
  | CircuitBreakerEvent
  | BackpressureTriggeredEvent
  | HealthCheckEvent;

// === PROCESSOR INTERFACES ===

export interface ProcessorConfig {
  id: string;
  sport: string;
  enabled: boolean;
  shadowMode: boolean;
  maxConcurrency: number;
  timeout: number;
  retryConfig: RetryConfig;
  circuitBreakerConfig: CircuitBreakerConfig;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  minimumRequests: number;
  errorRateThreshold: number;
}

// === PROCESSOR RESULT TYPES ===

export interface ProcessorResult {
  success: boolean;
  alerts: AlertResult[];
  processingTimeMs: number;
  error?: Error;
  metadata: Record<string, any>;
}

export interface ProcessorContext {
  gameId: string;
  sport: string;
  gameState: GameState;
  previousState?: GameState;
  settings: Record<string, boolean>;
  processorId: string;
  requestId: string;
  timestamp: number;
}

// === CIRCUIT BREAKER TYPES ===

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  requestCount: number;
  errorRate: number;
  lastFailureTime: number;
  nextRetryTime: number;
  stateChangedAt: number;
}

// === METRICS AND MONITORING ===

export interface EventStreamMetrics {
  // Event processing metrics
  eventsProcessed: number;
  eventsDropped: number;
  averageProcessingTimeMs: number;
  errorRate: number;
  
  // Queue metrics
  queueSizes: Record<string, number>;
  maxQueueSizes: Record<string, number>;
  backpressureCount: number;
  
  // Processor metrics
  processorStats: Record<string, ProcessorStats>;
  
  // Circuit breaker metrics
  circuitBreakerStats: Record<string, CircuitBreakerStats>;
  
  // System metrics
  memoryUsageMB: number;
  cpuUsagePercent: number;
  uptimeMs: number;
  lastMetricsUpdate: number;
}

export interface ProcessorStats {
  id: string;
  sport: string;
  enabled: boolean;
  shadowMode: boolean;
  requestsProcessed: number;
  requestsFailed: number;
  averageResponseTimeMs: number;
  lastProcessedAt: number;
  consecutiveFailures: number;
}

// === QUEUE MANAGEMENT ===

export interface QueueConfig {
  name: string;
  maxSize: number;
  priority: boolean;
  batchSize: number;
  flushIntervalMs: number;
  backpressureThreshold: number;
}

export interface QueueStats {
  name: string;
  size: number;
  maxSize: number;
  processed: number;
  dropped: number;
  averageWaitTimeMs: number;
  oldestEventAge: number;
}

// === SHADOW MODE CONFIGURATION ===

export interface ShadowModeConfig {
  enabled: boolean;
  logLevel: 'minimal' | 'detailed' | 'verbose';
  sampleRate: number; // 0.0 to 1.0
  compareWithLegacy: boolean;
  metricsEnabled: boolean;
  alertOnDifferences: boolean;
}

// === INTEGRATION INTERFACES ===

export interface LegacyBridgeConfig {
  enabled: boolean;
  forwardEvents: boolean;
  enableComparison: boolean;
  comparisonTimeout: number;
  logDifferences: boolean;
}

export interface HealthCheckConfig {
  intervalMs: number;
  timeoutMs: number;
  failureThreshold: number;
  components: string[];
}

// === EVENT HANDLER TYPES ===

export type EventHandler<T extends UnifiedEvent = UnifiedEvent> = (event: T) => Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: EventType;
  handler: EventHandler;
  config: {
    priority: EventPriority;
    maxConcurrency: number;
    timeout: number;
    retries: number;
  };
}

// === ERROR TYPES ===

export class EventStreamError extends Error {
  constructor(
    message: string,
    public code: string,
    public processorId?: string,
    public eventId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'EventStreamError';
  }
}

export class CircuitBreakerOpenError extends EventStreamError {
  constructor(processorId: string, nextRetryTime: number) {
    super(
      `Circuit breaker is open for processor ${processorId}. Next retry at ${new Date(nextRetryTime).toISOString()}`,
      'CIRCUIT_BREAKER_OPEN',
      processorId
    );
  }
}

export class BackpressureError extends EventStreamError {
  constructor(queueName: string, currentSize: number, maxSize: number) {
    super(
      `Backpressure triggered for queue ${queueName}: ${currentSize}/${maxSize}`,
      'BACKPRESSURE_TRIGGERED'
    );
  }
}

// === UTILITY TYPES ===

export interface EventFilter {
  eventTypes?: EventType[];
  sports?: string[];
  priorities?: EventPriority[];
  processors?: string[];
  since?: number;
  until?: number;
}

export interface EventQuery {
  filter: EventFilter;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

// === TYPE GUARDS ===

export function isGameStateChangedEvent(event: UnifiedEvent): event is GameStateChangedEvent {
  return event.type === 'game_state_changed';
}

export function isAlertGeneratedEvent(event: UnifiedEvent): event is AlertGeneratedEvent {
  return event.type === 'alert_generated';
}

export function isAlertSentEvent(event: UnifiedEvent): event is AlertSentEvent {
  return event.type === 'alert_sent';
}

export function isProcessorErrorEvent(event: UnifiedEvent): event is ProcessorErrorEvent {
  return event.type === 'processor_error';
}

export function isCircuitBreakerEvent(event: UnifiedEvent): event is CircuitBreakerEvent {
  return event.type === 'circuit_breaker_opened' || event.type === 'circuit_breaker_closed';
}

export function isBackpressureEvent(event: UnifiedEvent): event is BackpressureTriggeredEvent {
  return event.type === 'backpressure_triggered';
}

export function isHealthCheckEvent(event: UnifiedEvent): event is HealthCheckEvent {
  return event.type === 'health_check';
}

// === COMPATIBILITY LAYER ===

/**
 * Legacy compatibility - maps existing GameState to our event system
 */
export function gameStateToEvent(
  gameState: GameState,
  previousState: GameState | null,
  changes: string[]
): GameStateChangedEvent {
  return {
    id: `game_state_${gameState.gameId}_${Date.now()}`,
    type: 'game_state_changed',
    timestamp: Date.now(),
    priority: changes.length > 3 ? 'high' : 'medium',
    source: `${gameState.sport.toLowerCase()}_engine`,
    retryCount: 0,
    maxRetries: 3,
    metadata: {
      sport: gameState.sport,
      gameId: gameState.gameId,
      changeCount: changes.length
    },
    payload: {
      gameId: gameState.gameId,
      sport: gameState.sport,
      previousState,
      currentState: gameState,
      changes,
      isSignificantChange: changes.length > 2 || changes.some(c => 
        c.includes('score') || c.includes('inning') || c.includes('runner')
      )
    }
  };
}

/**
 * Legacy compatibility - maps AlertResult to our event system
 */
export function alertResultToEvent(
  alertResult: AlertResult,
  gameState: GameState,
  processorId: string
): AlertGeneratedEvent {
  return {
    id: `alert_${alertResult.alertKey}_${Date.now()}`,
    type: 'alert_generated',
    timestamp: Date.now(),
    priority: alertResult.priority > 80 ? 'critical' : 
              alertResult.priority > 60 ? 'high' : 'medium',
    source: processorId,
    retryCount: 0,
    maxRetries: 2,
    metadata: {
      sport: gameState.sport,
      gameId: gameState.gameId,
      alertType: alertResult.type,
      priority: alertResult.priority
    },
    payload: {
      gameId: gameState.gameId,
      sport: gameState.sport,
      alertResult,
      gameState,
      processorId,
      generationTimeMs: 0 // Will be populated by processor
    }
  };
}