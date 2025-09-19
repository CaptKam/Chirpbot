/**
 * EventDeduper - Event Deduplication System
 * 
 * Generates unique event fingerprints and prevents duplicate event processing
 * when transitioning between legacy calendar sync and new data ingestion systems.
 * 
 * Features:
 * - Content-based event fingerprinting for deterministic deduplication
 * - Time-windowed duplicate detection to handle system transitions
 * - Configurable retention and cleanup policies
 * - Support for both calendar events and game state events
 * - Metrics tracking for monitoring deduplication effectiveness
 */

import type { CalendarUpdateEvent } from './calendar-sync-service';
import type { GameStateChangedEvent, AlertGeneratedEvent, UnifiedEvent } from './event-stream/types';
import { createHash } from 'crypto';

// === CORE INTERFACES ===

export interface EventFingerprint {
  id: string;
  fingerprint: string;
  eventType: string;
  gameId: string;
  sport: string;
  timestamp: number;
  source: string;
  contentHash: string;
  ttlMs: number;
  expiresAt: number;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  fingerprint: string;
  previousOccurrence?: EventFingerprint;
  action: 'allow' | 'skip' | 'replace';
  reason: string;
}

export interface EventDeduplicationConfig {
  enabled: boolean;
  defaultTtlMs: number;
  maxStoredFingerprints: number;
  cleanupIntervalMs: number;
  enableMetrics: boolean;
  logLevel: 'minimal' | 'detailed' | 'debug';
  
  // Per-event-type TTL overrides
  eventTypeTtls: Record<string, number>;
  
  // Deduplication strategies
  strategies: {
    calendar: 'content' | 'gameId' | 'hybrid';
    gameState: 'content' | 'gameId' | 'hybrid';
    alerts: 'content' | 'alertKey' | 'hybrid';
  };
}

export interface DeduplicationMetrics {
  totalEvents: number;
  duplicatesFound: number;
  uniqueEvents: number;
  duplicateRate: number;
  fingerprintsStored: number;
  cleanupRuns: number;
  lastCleanup: Date;
  averageFingerprintSize: number;
  memoryUsageMB: number;
}

// === EVENT DEDUPER IMPLEMENTATION ===

export class EventDeduper {
  private readonly config: EventDeduplicationConfig;
  private readonly fingerprints: Map<string, EventFingerprint> = new Map();
  private readonly metrics: DeduplicationMetrics;
  
  private cleanupInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(config: Partial<EventDeduplicationConfig> = {}) {
    this.config = {
      enabled: true,
      defaultTtlMs: 300_000, // 5 minutes
      maxStoredFingerprints: 10_000,
      cleanupIntervalMs: 60_000, // 1 minute
      enableMetrics: true,
      logLevel: 'minimal',
      eventTypeTtls: {
        'calendar_update': 300_000, // 5 minutes
        'game_state_changed': 180_000, // 3 minutes
        'alert_generated': 900_000, // 15 minutes
        'alert_sent': 3600_000, // 1 hour
      },
      strategies: {
        calendar: 'hybrid',
        gameState: 'hybrid',
        alerts: 'hybrid'
      },
      ...config
    };

    this.metrics = {
      totalEvents: 0,
      duplicatesFound: 0,
      uniqueEvents: 0,
      duplicateRate: 0,
      fingerprintsStored: 0,
      cleanupRuns: 0,
      lastCleanup: new Date(),
      averageFingerprintSize: 0,
      memoryUsageMB: 0
    };

    if (this.config.enabled) {
      this.startCleanupTimer();
      console.log(`🔍 EventDeduper: Initialized with ${this.config.maxStoredFingerprints} max fingerprints`);
    } else {
      console.log('🔍 EventDeduper: Disabled - all events will pass through');
    }
  }

  // === PUBLIC API ===

  /**
   * Check if an event is a duplicate and should be filtered
   */
  checkDuplicate(event: UnifiedEvent | CalendarUpdateEvent): DeduplicationResult {
    if (!this.config.enabled) {
      return {
        isDuplicate: false,
        fingerprint: 'disabled',
        action: 'allow',
        reason: 'deduplication disabled'
      };
    }

    this.metrics.totalEvents++;

    try {
      const fingerprint = this.generateFingerprint(event);
      const existing = this.fingerprints.get(fingerprint);

      if (existing) {
        // Check if existing fingerprint has expired
        if (Date.now() > existing.expiresAt) {
          this.fingerprints.delete(fingerprint);
          return this.recordUniqueEvent(event, fingerprint);
        }

        // Found duplicate
        this.metrics.duplicatesFound++;
        this.updateMetrics();

        if (this.config.logLevel === 'debug') {
          console.log(`🔍 EventDeduper: Duplicate detected - ${fingerprint} (${event.type})`);
        }

        return {
          isDuplicate: true,
          fingerprint,
          previousOccurrence: existing,
          action: 'skip',
          reason: `duplicate found from ${existing.source} at ${new Date(existing.timestamp).toISOString()}`
        };
      }

      // New unique event
      return this.recordUniqueEvent(event, fingerprint);

    } catch (error) {
      console.error('❌ EventDeduper: Error checking duplicate:', error);
      
      // On error, allow the event through to avoid blocking the system
      return {
        isDuplicate: false,
        fingerprint: 'error',
        action: 'allow',
        reason: `deduplication error: ${error.message}`
      };
    }
  }

  /**
   * Force clear a specific event fingerprint (for testing or manual intervention)
   */
  clearFingerprint(fingerprint: string): boolean {
    const existed = this.fingerprints.has(fingerprint);
    this.fingerprints.delete(fingerprint);
    
    if (existed && this.config.logLevel === 'debug') {
      console.log(`🔍 EventDeduper: Manually cleared fingerprint ${fingerprint}`);
    }
    
    return existed;
  }

  /**
   * Get current metrics
   */
  getMetrics(): DeduplicationMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Perform manual cleanup
   */
  performCleanup(): void {
    const startCount = this.fingerprints.size;
    const now = Date.now();
    let cleaned = 0;

    for (const [fingerprint, eventFingerprint] of this.fingerprints.entries()) {
      if (now > eventFingerprint.expiresAt) {
        this.fingerprints.delete(fingerprint);
        cleaned++;
      }
    }

    this.metrics.cleanupRuns++;
    this.metrics.lastCleanup = new Date();

    if (this.config.logLevel === 'detailed' || this.config.logLevel === 'debug') {
      console.log(`🔍 EventDeduper: Cleanup complete - removed ${cleaned} expired fingerprints (${startCount} -> ${this.fingerprints.size})`);
    }
  }

  /**
   * Stop the deduper and cleanup resources
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.fingerprints.clear();
    console.log('🔍 EventDeduper: Stopped and cleaned up');
  }

  // === PRIVATE IMPLEMENTATION ===

  /**
   * Generate deterministic fingerprint for an event
   */
  private generateFingerprint(event: UnifiedEvent | CalendarUpdateEvent): string {
    // Determine event category and strategy
    let strategy: string;
    let content: any;

    if ('type' in event && event.type === 'calendar_update') {
      strategy = this.config.strategies.calendar;
      content = this.extractCalendarContent(event as CalendarUpdateEvent);
    } else if ('type' in event) {
      const unifiedEvent = event as UnifiedEvent;
      if (unifiedEvent.type === 'game_state_changed') {
        strategy = this.config.strategies.gameState;
        content = this.extractGameStateContent(unifiedEvent);
      } else if (unifiedEvent.type === 'alert_generated') {
        strategy = this.config.strategies.alerts;
        content = this.extractAlertContent(unifiedEvent);
      } else {
        strategy = 'content';
        content = this.extractGenericContent(unifiedEvent);
      }
    } else {
      // Fallback for unknown event types
      strategy = 'content';
      content = event;
    }

    // Generate fingerprint based on strategy
    const fingerprintData = this.applyStrategy(strategy, content, event);
    const contentHash = createHash('sha256').update(JSON.stringify(fingerprintData)).digest('hex');
    
    // Create deterministic fingerprint ID
    const eventType = 'type' in event ? event.type : 'unknown';
    const gameId = this.extractGameId(event);
    const timestamp = 'timestamp' in event ? event.timestamp : Date.now();
    
    return `${eventType}_${gameId}_${contentHash.substring(0, 12)}`;
  }

  /**
   * Apply deduplication strategy to generate consistent fingerprint data
   */
  private applyStrategy(strategy: string, content: any, event: any): any {
    switch (strategy) {
      case 'gameId':
        return {
          gameId: this.extractGameId(event),
          type: event.type || 'unknown',
          sport: this.extractSport(event)
        };

      case 'content':
        return {
          content: this.normalizeContent(content),
          type: event.type || 'unknown'
        };

      case 'hybrid':
      default:
        return {
          gameId: this.extractGameId(event),
          type: event.type || 'unknown',
          sport: this.extractSport(event),
          contentHash: createHash('md5').update(JSON.stringify(this.normalizeContent(content))).digest('hex')
        };
    }
  }

  /**
   * Extract calendar-specific content for fingerprinting
   */
  private extractCalendarContent(event: CalendarUpdateEvent): any {
    return {
      gameId: event.gameId,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      homeTeam: event.gameData.homeTeam.name,
      awayTeam: event.gameData.awayTeam.name,
      homeScore: event.gameData.homeTeam.score,
      awayScore: event.gameData.awayTeam.score
    };
  }

  /**
   * Extract game state content for fingerprinting
   */
  private extractGameStateContent(event: GameStateChangedEvent): any {
    return {
      gameId: event.payload.gameId,
      sport: event.payload.sport,
      changes: [...event.payload.changes].sort(), // Copy before sort to prevent mutation
      isSignificantChange: event.payload.isSignificantChange,
      currentStateHash: this.hashGameState(event.payload.currentState)
    };
  }

  /**
   * Extract alert content for fingerprinting
   */
  private extractAlertContent(event: AlertGeneratedEvent): any {
    return {
      gameId: event.payload.gameId,
      sport: event.payload.sport,
      alertType: event.payload.alertResult.type,
      alertKey: event.payload.alertResult.alertKey,
      priority: event.payload.alertResult.priority,
      processorId: event.payload.processorId
    };
  }

  /**
   * Extract generic content for unknown event types
   */
  private extractGenericContent(event: UnifiedEvent): any {
    return {
      type: event.type,
      source: event.source,
      priority: event.priority,
      metadata: event.metadata,
      payloadHash: createHash('md5').update(JSON.stringify(event.payload || {})).digest('hex')
    };
  }

  /**
   * Extract gameId from various event types
   */
  private extractGameId(event: any): string {
    if (event.gameId) return event.gameId;
    if (event.payload?.gameId) return event.payload.gameId;
    if (event.gameData?.gameId) return event.gameData.gameId;
    if (event.metadata?.gameId) return event.metadata.gameId;
    return 'unknown';
  }

  /**
   * Extract sport from various event types
   */
  private extractSport(event: any): string {
    if (event.sport) return event.sport;
    if (event.payload?.sport) return event.payload.sport;
    if (event.gameData?.sport) return event.gameData.sport;
    if (event.metadata?.sport) return event.metadata.sport;
    return 'unknown';
  }

  /**
   * Create a hash of game state for fingerprinting
   */
  private hashGameState(gameState: any): string {
    const relevantFields = {
      gameId: gameState.gameId,
      status: gameState.status,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      inning: gameState.inning || gameState.quarter || gameState.period,
      isTopInning: gameState.isTopInning,
      outs: gameState.outs,
      balls: gameState.balls,
      strikes: gameState.strikes
    };

    return createHash('md5').update(JSON.stringify(relevantFields)).digest('hex');
  }

  /**
   * Normalize content for consistent fingerprinting
   */
  private normalizeContent(content: any): any {
    if (typeof content !== 'object' || content === null) {
      return content;
    }

    // Sort object keys for consistency
    const sorted = {};
    for (const key of Object.keys(content).sort()) {
      sorted[key] = this.normalizeContent(content[key]);
    }

    return sorted;
  }

  /**
   * Record a unique event and store its fingerprint
   */
  private recordUniqueEvent(event: any, fingerprint: string): DeduplicationResult {
    const gameId = this.extractGameId(event);
    const sport = this.extractSport(event);
    const eventType = event.type || 'unknown';
    const source = event.source || 'unknown';
    const timestamp = event.timestamp || Date.now();
    
    // Determine TTL for this event type
    const ttl = this.config.eventTypeTtls[eventType] || this.config.defaultTtlMs;
    
    const eventFingerprint: EventFingerprint = {
      id: fingerprint,
      fingerprint,
      eventType,
      gameId,
      sport,
      timestamp,
      source,
      contentHash: fingerprint, // Already contains content hash
      ttlMs: ttl,
      expiresAt: Date.now() + ttl
    };

    // Store fingerprint
    this.fingerprints.set(fingerprint, eventFingerprint);
    this.metrics.uniqueEvents++;

    // Perform size-based cleanup if needed
    if (this.fingerprints.size > this.config.maxStoredFingerprints) {
      this.performSizeBasedCleanup();
    }

    this.updateMetrics();

    if (this.config.logLevel === 'debug') {
      console.log(`🔍 EventDeduper: Recorded unique event - ${fingerprint} (${eventType})`);
    }

    return {
      isDuplicate: false,
      fingerprint,
      action: 'allow',
      reason: 'unique event'
    };
  }

  /**
   * Remove oldest fingerprints when storage limit is exceeded
   */
  private performSizeBasedCleanup(): void {
    const excess = this.fingerprints.size - this.config.maxStoredFingerprints;
    if (excess <= 0) return;

    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(this.fingerprints.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries
    for (let i = 0; i < excess; i++) {
      this.fingerprints.delete(entries[i][0]);
    }

    if (this.config.logLevel === 'detailed' || this.config.logLevel === 'debug') {
      console.log(`🔍 EventDeduper: Size-based cleanup - removed ${excess} oldest fingerprints`);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);

    if (this.config.logLevel === 'detailed' || this.config.logLevel === 'debug') {
      console.log(`🔍 EventDeduper: Started cleanup timer (${this.config.cleanupIntervalMs}ms interval)`);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.fingerprintsStored = this.fingerprints.size;
    this.metrics.duplicateRate = this.metrics.totalEvents > 0 ? 
      (this.metrics.duplicatesFound / this.metrics.totalEvents) * 100 : 0;

    // Calculate average fingerprint size (approximate)
    if (this.fingerprints.size > 0) {
      const sampleSize = Math.min(10, this.fingerprints.size);
      const samples = Array.from(this.fingerprints.values()).slice(0, sampleSize);
      const totalSize = samples.reduce((sum, fp) => sum + JSON.stringify(fp).length, 0);
      this.metrics.averageFingerprintSize = totalSize / sampleSize;
    }

    // Approximate memory usage
    this.metrics.memoryUsageMB = Math.round(
      (this.fingerprints.size * this.metrics.averageFingerprintSize) / 1024 / 1024
    );
  }
}