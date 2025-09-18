/**
 * Circuit Breaker Implementation for UnifiedEventStream
 * 
 * Provides fault tolerance by tracking failures and preventing cascading
 * failures in event processors. Implements the classic circuit breaker
 * pattern with closed/open/half_open states.
 * 
 * Features:
 * - Three-state circuit breaker (closed/open/half_open)
 * - Configurable failure thresholds and timeouts
 * - Exponential backoff with jitter
 * - Metrics collection and monitoring
 * - Event emission for state changes
 */

import { EventEmitter } from 'events';
import type { 
  CircuitBreakerState, 
  CircuitBreakerStats, 
  CircuitBreakerConfig,
  CircuitBreakerEvent,
  CircuitBreakerOpenError
} from './types';

export interface CircuitBreakerOptions extends CircuitBreakerConfig {
  name: string;
  sport?: string;
}

export class CircuitBreaker extends EventEmitter {
  private readonly name: string;
  private readonly sport: string;
  private readonly config: CircuitBreakerConfig;
  
  // State tracking
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private lastFailureTime = 0;
  private nextRetryTime = 0;
  private stateChangedAt = Date.now();
  
  // Monitoring window for error rate calculation
  private readonly requestTimestamps: number[] = [];
  private readonly failureTimestamps: number[] = [];
  
  // Backoff configuration
  private consecutiveFailures = 0;
  private baseRetryDelay = 1000;
  
  constructor(options: CircuitBreakerOptions) {
    super();
    this.name = options.name;
    this.sport = options.sport || 'unknown';
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeoutMs: options.recoveryTimeoutMs || 30000,
      monitoringWindowMs: options.monitoringWindowMs || 60000,
      minimumRequests: options.minimumRequests || 10,
      errorRateThreshold: options.errorRateThreshold || 0.5,
      ...options
    };
    
    console.log(`🔧 Circuit Breaker initialized: ${this.name} (sport: ${this.sport})`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextRetryTime) {
        throw new CircuitBreakerOpenError(this.name, this.nextRetryTime);
      }
      // Transition to half-open to test if service has recovered
      this.transitionToHalfOpen();
    }

    this.recordRequest();
    
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Check if circuit breaker allows execution
   */
  canExecute(): boolean {
    if (this.state === 'closed' || this.state === 'half_open') {
      return true;
    }
    
    // Check if we should transition from open to half-open
    if (this.state === 'open' && Date.now() >= this.nextRetryTime) {
      return true;
    }
    
    return false;
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(): void {
    this.successCount++;
    this.consecutiveFailures = 0;
    
    if (this.state === 'half_open') {
      // Service seems to have recovered
      this.transitionToClosed();
    }
    
    this.cleanupOldTimestamps();
  }

  /**
   * Record a failed execution
   */
  private recordFailure(error: Error): void {
    const now = Date.now();
    this.failureCount++;
    this.consecutiveFailures++;
    this.lastFailureTime = now;
    this.failureTimestamps.push(now);
    
    console.error(`❌ Circuit Breaker [${this.name}] recorded failure:`, error.message);
    
    // Check if we should trip the circuit breaker
    if (this.shouldTrip()) {
      this.transitionToOpen();
    }
    
    this.cleanupOldTimestamps();
  }

  /**
   * Record a request attempt
   */
  private recordRequest(): void {
    this.requestCount++;
    this.requestTimestamps.push(Date.now());
    this.cleanupOldTimestamps();
  }

  /**
   * Determine if circuit breaker should trip to open state
   */
  private shouldTrip(): boolean {
    // Check consecutive failure threshold
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      console.log(`🔥 Circuit Breaker [${this.name}] tripping: ${this.consecutiveFailures} consecutive failures`);
      return true;
    }
    
    // Check error rate threshold
    const recentRequests = this.getRecentRequestCount();
    const recentFailures = this.getRecentFailureCount();
    
    if (recentRequests >= this.config.minimumRequests) {
      const errorRate = recentFailures / recentRequests;
      if (errorRate >= this.config.errorRateThreshold) {
        console.log(`🔥 Circuit Breaker [${this.name}] tripping: ${(errorRate * 100).toFixed(1)}% error rate`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    if (this.state === 'open') return;
    
    console.log(`🔓 Circuit Breaker [${this.name}] opening`);
    this.state = 'open';
    this.stateChangedAt = Date.now();
    this.nextRetryTime = Date.now() + this.calculateRetryDelay();
    
    this.emitStateChangeEvent('circuit_breaker_opened');
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    console.log(`🔀 Circuit Breaker [${this.name}] transitioning to half-open`);
    this.state = 'half_open';
    this.stateChangedAt = Date.now();
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    if (this.state === 'closed') return;
    
    console.log(`✅ Circuit Breaker [${this.name}] closing - service recovered`);
    this.state = 'closed';
    this.stateChangedAt = Date.now();
    this.consecutiveFailures = 0;
    this.nextRetryTime = 0;
    
    this.emitStateChangeEvent('circuit_breaker_closed');
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(): number {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, Math.min(this.consecutiveFailures - 1, 10));
    const maxDelay = Math.min(exponentialDelay, this.config.recoveryTimeoutMs);
    
    // Add jitter (±25%)
    const jitter = 1 + (Math.random() - 0.5) * 0.5;
    return Math.floor(maxDelay * jitter);
  }

  /**
   * Get count of recent requests within monitoring window
   */
  private getRecentRequestCount(): number {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    return this.requestTimestamps.filter(timestamp => timestamp > cutoff).length;
  }

  /**
   * Get count of recent failures within monitoring window
   */
  private getRecentFailureCount(): number {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    return this.failureTimestamps.filter(timestamp => timestamp > cutoff).length;
  }

  /**
   * Clean up timestamps outside monitoring window
   */
  private cleanupOldTimestamps(): void {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    
    // Clean up request timestamps
    let i = 0;
    while (i < this.requestTimestamps.length && this.requestTimestamps[i] <= cutoff) {
      i++;
    }
    if (i > 0) {
      this.requestTimestamps.splice(0, i);
    }
    
    // Clean up failure timestamps
    i = 0;
    while (i < this.failureTimestamps.length && this.failureTimestamps[i] <= cutoff) {
      i++;
    }
    if (i > 0) {
      this.failureTimestamps.splice(0, i);
    }
  }

  /**
   * Emit circuit breaker state change event
   */
  private emitStateChangeEvent(type: 'circuit_breaker_opened' | 'circuit_breaker_closed'): void {
    const event: CircuitBreakerEvent = {
      id: `cb_${this.name}_${type}_${Date.now()}`,
      type,
      timestamp: Date.now(),
      priority: 'high',
      source: `circuit_breaker_${this.name}`,
      retryCount: 0,
      maxRetries: 0,
      metadata: {
        processorId: this.name,
        sport: this.sport
      },
      payload: {
        processorId: this.name,
        sport: this.sport,
        state: this.state,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        nextRetryTime: this.nextRetryTime,
        errorRate: this.getErrorRate()
      }
    };
    
    this.emit('state_changed', event);
    this.emit(type, event);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorRate: this.getErrorRate(),
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      stateChangedAt: this.stateChangedAt
    };
  }

  /**
   * Get current error rate
   */
  private getErrorRate(): number {
    const recentRequests = this.getRecentRequestCount();
    const recentFailures = this.getRecentFailureCount();
    
    if (recentRequests === 0) return 0;
    return recentFailures / recentRequests;
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force circuit breaker to open state (for testing/emergency)
   */
  forceOpen(): void {
    console.log(`🚨 Circuit Breaker [${this.name}] forced open`);
    this.transitionToOpen();
  }

  /**
   * Force circuit breaker to closed state (for testing/recovery)
   */
  forceClosed(): void {
    console.log(`🔧 Circuit Breaker [${this.name}] forced closed`);
    this.consecutiveFailures = 0;
    this.transitionToClosed();
  }

  /**
   * Reset circuit breaker statistics
   */
  reset(): void {
    console.log(`🔄 Circuit Breaker [${this.name}] reset`);
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.requestTimestamps.length = 0;
    this.failureTimestamps.length = 0;
    this.transitionToClosed();
  }

  /**
   * Check if circuit breaker is healthy (closed or low error rate)
   */
  isHealthy(): boolean {
    if (this.state === 'closed') {
      return this.getErrorRate() < this.config.errorRateThreshold * 0.5;
    }
    return false;
  }

  /**
   * Get time until next retry (if in open state)
   */
  getTimeUntilRetry(): number {
    if (this.state !== 'open') return 0;
    return Math.max(0, this.nextRetryTime - Date.now());
  }
}

/**
 * Circuit Breaker Manager - manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    monitoringWindowMs: 60000,
    minimumRequests: 10,
    errorRateThreshold: 0.5
  };

  /**
   * Get or create a circuit breaker for a processor
   */
  getCircuitBreaker(processorId: string, sport: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    const key = `${sport}_${processorId}`;
    
    if (!this.circuitBreakers.has(key)) {
      const circuitBreaker = new CircuitBreaker({
        name: processorId,
        sport,
        ...this.defaultConfig,
        ...config
      });
      
      // Forward circuit breaker events
      circuitBreaker.on('state_changed', (event) => {
        this.emit('circuit_breaker_state_changed', event);
      });
      
      this.circuitBreakers.set(key, circuitBreaker);
      console.log(`🔧 Created circuit breaker for ${key}`);
    }
    
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [key, cb] of this.circuitBreakers) {
      stats[key] = cb.getStats();
    }
    
    return stats;
  }

  /**
   * Get healthy circuit breakers
   */
  getHealthyCircuitBreakers(): string[] {
    const healthy: string[] = [];
    
    for (const [key, cb] of this.circuitBreakers) {
      if (cb.isHealthy()) {
        healthy.push(key);
      }
    }
    
    return healthy;
  }

  /**
   * Get unhealthy circuit breakers
   */
  getUnhealthyCircuitBreakers(): string[] {
    const unhealthy: string[] = [];
    
    for (const [key, cb] of this.circuitBreakers) {
      if (!cb.isHealthy()) {
        unhealthy.push(key);
      }
    }
    
    return unhealthy;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    console.log('🔄 Resetting all circuit breakers');
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
  }

  /**
   * Force all circuit breakers closed (emergency recovery)
   */
  forceAllClosed(): void {
    console.log('🚨 Forcing all circuit breakers closed');
    for (const cb of this.circuitBreakers.values()) {
      cb.forceClosed();
    }
  }

  /**
   * Get circuit breakers by state
   */
  getCircuitBreakersByState(state: CircuitBreakerState): string[] {
    const result: string[] = [];
    
    for (const [key, cb] of this.circuitBreakers) {
      if (cb.getState() === state) {
        result.push(key);
      }
    }
    
    return result;
  }

  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(processorId: string, sport: string): boolean {
    const key = `${sport}_${processorId}`;
    const removed = this.circuitBreakers.delete(key);
    
    if (removed) {
      console.log(`🗑️ Removed circuit breaker for ${key}`);
    }
    
    return removed;
  }

  /**
   * Event emitter functionality
   */
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in circuit breaker event listener:`, error);
        }
      }
    }
  }
}

// Singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();