/**
 * Event Comparison System for MigrationAdapter
 * 
 * Provides EventComparator and MetricsCollector components for comparing
 * production vs shadow streams from OutputRouter. Tracks divergence rates,
 * latency differences, and error rates to inform rollout decisions.
 * 
 * Features:
 * - Event matching by gameId, sport, and alert type
 * - Content difference detection and timing divergence calculation
 * - Lightweight in-memory metrics collection
 * - Per-sport statistics for granular rollout decisions
 * - Integration with MigrationAdapter lifecycle
 */

import { EventEmitter } from 'events';
import type { UnifiedEvent, AlertGeneratedEvent, GameStateChangedEvent } from './event-stream/types';
import type { RouteableEvent } from './output-router';
import { v4 as uuidv4 } from 'uuid';

// === CORE INTERFACES ===

export interface EventComparisonConfig {
  enabled: boolean;
  matchingTimeWindowMs: number; // How long to wait for matching events
  contentDiffThreshold: number; // 0-1, similarity threshold for content
  enableDetailedLogging: boolean;
  logLevel: 'minimal' | 'detailed' | 'debug';
  
  // Matching criteria
  strictMatching: boolean; // Require exact gameId/sport/type match
  enableFuzzyMatching: boolean; // Allow close-time matches
  fuzzyMatchWindowMs: number; // Time window for fuzzy matching
  
  // Performance settings
  maxPendingEvents: number;
  cleanupIntervalMs: number;
  metricsFlushIntervalMs: number;
  
  // Memory controls
  maxComparisonResults: number;
  maxTimingSamples: number;
  maxLatencySamples: number;
}

export interface ComparisonResult {
  id: string;
  timestamp: number;
  matchType: 'exact' | 'fuzzy' | 'missing_production' | 'missing_shadow' | 'no_match';
  
  // Event identification
  gameId: string;
  sport: string;
  eventType: string;
  
  // Comparison details
  contentMatch: boolean;
  contentSimilarity: number; // 0-1
  timingDifference: number; // milliseconds
  
  // Event references
  productionEvent?: RouteableEvent;
  shadowEvent?: RouteableEvent;
  
  // Difference analysis
  differences: ContentDifference[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  metadata: Record<string, any>;
}

export interface ContentDifference {
  field: string;
  productionValue: any;
  shadowValue: any;
  differenceType: 'missing_field' | 'different_value' | 'type_mismatch' | 'structural_change';
  impact: 'low' | 'medium' | 'high';
}

export interface ComparisonMetrics {
  // Event counts
  totalComparisons: number;
  exactMatches: number;
  fuzzyMatches: number;
  missingProductionEvents: number;
  missingShadowEvents: number;
  noMatches: number;
  
  // Quality metrics
  averageContentSimilarity: number;
  averageTimingDifference: number;
  divergenceRate: number; // Percentage of events that differ
  matchSuccessRate: number; // Percentage of events successfully matched
  
  // Per-sport breakdown
  sportMetrics: Record<string, SportComparisonMetrics>;
  
  // Error tracking
  comparisonErrors: number;
  lastError?: string;
  lastErrorTime?: Date;
  
  // Performance metrics
  averageComparisonTimeMs: number;
  pendingComparisons: number;
  
  // Timing metrics
  latencyDifferences: LatencyMetrics;
  
  uptimeMs: number;
  lastUpdate: Date;
}

export interface SportComparisonMetrics {
  sport: string;
  totalEvents: number;
  matchedEvents: number;
  divergentEvents: number;
  averageLatencyDifference: number;
  errorRate: number;
  
  // Alert-specific metrics
  alertTypeMetrics: Record<string, AlertTypeMetrics>;
  
  lastProcessedTime: Date;
}

export interface AlertTypeMetrics {
  alertType: string;
  totalAlerts: number;
  matchedAlerts: number;
  contentDifferences: number;
  averageTimingDifference: number;
  criticalDifferences: number;
}

export interface LatencyMetrics {
  averageMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  samples: number[];
}

export interface EventMatchingKey {
  gameId: string;
  sport: string;
  eventType: string;
  alertType?: string; // For alert events
}

// === EVENT COMPARATOR ===

export class EventComparator extends EventEmitter {
  private readonly config: EventComparisonConfig;
  private readonly pendingProductionEvents = new Map<string, RouteableEvent>();
  private readonly pendingShadowEvents = new Map<string, RouteableEvent>();
  private readonly comparisonResults: ComparisonResult[] = [];
  private readonly comparisonTimes: number[] = [];
  
  private isRunning = false;
  private cleanupTimer?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(config: Partial<EventComparisonConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      matchingTimeWindowMs: 30_000, // 30 seconds to match events
      contentDiffThreshold: 0.8,
      enableDetailedLogging: false, // Reduced verbosity by default
      logLevel: 'minimal', // Reduced verbosity by default
      strictMatching: true,
      enableFuzzyMatching: true,
      fuzzyMatchWindowMs: 60_000,
      maxPendingEvents: 1_000, // Reduced for better memory control
      cleanupIntervalMs: 60_000,
      metricsFlushIntervalMs: 30_000,
      maxComparisonResults: 1_000,
      maxTimingSamples: 1_000,
      maxLatencySamples: 1_000,
      ...config
    };

    console.log(`🔍 EventComparator: Initialized with ${this.config.matchingTimeWindowMs}ms match window`);
  }

  // === LIFECYCLE MANAGEMENT ===

  start(): void {
    if (!this.config.enabled) {
      console.log('🔍 EventComparator: Disabled');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ EventComparator: Already running');
      return;
    }

    console.log('🚀 EventComparator: Starting event comparison system...');
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEvents();
    }, this.config.cleanupIntervalMs);
    
    console.log('✅ EventComparator: Started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('🔍 EventComparator: Not running');
      return;
    }

    console.log('🛑 EventComparator: Stopping...');
    
    this.isRunning = false;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Clear pending events
    this.pendingProductionEvents.clear();
    this.pendingShadowEvents.clear();
    
    console.log('✅ EventComparator: Stopped successfully');
  }

  // === EVENT PROCESSING ===

  /**
   * Process production event for comparison
   */
  processProductionEvent(event: RouteableEvent): void {
    if (!this.isRunning) return;

    const startTime = Date.now();
    
    try {
      const matchingKey = this.generateMatchingKey(event);
      const keyStr = this.keyToString(matchingKey);

      if (this.config.logLevel === 'debug') {
        console.log(`🔍 EventComparator: Processing production event ${event.id} (${keyStr})`);
      }

      // Look for matching shadow event
      const shadowMatch = this.pendingShadowEvents.get(keyStr);
      
      if (shadowMatch) {
        // Found exact match
        this.pendingShadowEvents.delete(keyStr);
        this.performComparison(event, shadowMatch, 'exact');
      } else if (this.config.enableFuzzyMatching) {
        // Look for fuzzy match
        const fuzzyMatch = this.findFuzzyMatch(event, this.pendingShadowEvents);
        
        if (fuzzyMatch) {
          this.pendingShadowEvents.delete(fuzzyMatch.key);
          this.performComparison(event, fuzzyMatch.event, 'fuzzy');
        } else {
          // Store for later matching
          this.addPendingEvent(this.pendingProductionEvents, keyStr, event, 'production');
        }
      } else {
        // Store for later matching
        this.addPendingEvent(this.pendingProductionEvents, keyStr, event, 'production');
      }

    } catch (error) {
      console.error('❌ EventComparator: Error processing production event:', error);
      this.emit('comparison_error', { event, error, type: 'production' });
    } finally {
      this.recordComparisonTime(Date.now() - startTime);
    }
  }

  /**
   * Process shadow event for comparison
   */
  processShadowEvent(event: RouteableEvent): void {
    if (!this.isRunning) return;

    const startTime = Date.now();
    
    try {
      const matchingKey = this.generateMatchingKey(event);
      const keyStr = this.keyToString(matchingKey);

      if (this.config.logLevel === 'debug') {
        console.log(`🔍 EventComparator: Processing shadow event ${event.id} (${keyStr})`);
      }

      // Look for matching production event
      const productionMatch = this.pendingProductionEvents.get(keyStr);
      
      if (productionMatch) {
        // Found exact match
        this.pendingProductionEvents.delete(keyStr);
        this.performComparison(productionMatch, event, 'exact');
      } else if (this.config.enableFuzzyMatching) {
        // Look for fuzzy match
        const fuzzyMatch = this.findFuzzyMatch(event, this.pendingProductionEvents);
        
        if (fuzzyMatch) {
          this.pendingProductionEvents.delete(fuzzyMatch.key);
          this.performComparison(fuzzyMatch.event, event, 'fuzzy');
        } else {
          // Store for later matching
          this.addPendingEvent(this.pendingShadowEvents, keyStr, event, 'shadow');
        }
      } else {
        // Store for later matching
        this.addPendingEvent(this.pendingShadowEvents, keyStr, event, 'shadow');
      }

    } catch (error) {
      console.error('❌ EventComparator: Error processing shadow event:', error);
      this.emit('comparison_error', { event, error, type: 'shadow' });
    } finally {
      this.recordComparisonTime(Date.now() - startTime);
    }
  }

  // === COMPARISON LOGIC ===

  private performComparison(
    productionEvent: RouteableEvent,
    shadowEvent: RouteableEvent,
    matchType: 'exact' | 'fuzzy'
  ): void {
    const timingDifference = Math.abs(productionEvent.timestamp - shadowEvent.timestamp);
    const differences = this.calculateContentDifferences(productionEvent, shadowEvent);
    const contentSimilarity = this.calculateContentSimilarity(productionEvent, shadowEvent);
    const contentMatch = contentSimilarity >= this.config.contentDiffThreshold;

    const result: ComparisonResult = {
      id: uuidv4(),
      timestamp: Date.now(),
      matchType,
      gameId: productionEvent.gameId,
      sport: productionEvent.sport,
      eventType: productionEvent.eventType,
      contentMatch,
      contentSimilarity,
      timingDifference,
      productionEvent,
      shadowEvent,
      differences,
      severity: this.calculateSeverity(differences, timingDifference),
      metadata: {
        productionSource: productionEvent.source,
        shadowSource: shadowEvent.source,
        productionPriority: productionEvent.priority,
        shadowPriority: shadowEvent.priority
      }
    };

    this.addComparisonResult(result);
    
    // Emit comparison result
    this.emit('comparison_complete', result);

    if (this.config.logLevel === 'detailed' || 
        (this.config.logLevel === 'minimal' && !contentMatch)) {
      console.log(`🔍 EventComparator: ${matchType} match - Game ${result.gameId}, ` +
                  `Content: ${contentMatch ? '✅' : '❌'} (${(contentSimilarity * 100).toFixed(1)}%), ` +
                  `Timing: ${timingDifference}ms`);
    }

    // Log significant differences
    if (differences.length > 0 && this.config.enableDetailedLogging) {
      console.log(`🔍 EventComparator: Found ${differences.length} differences:`, 
                  differences.map(d => `${d.field}: ${d.differenceType}`));
    }
  }

  private calculateContentDifferences(
    productionEvent: RouteableEvent,
    shadowEvent: RouteableEvent
  ): ContentDifference[] {
    const differences: ContentDifference[] = [];

    // Compare main event properties
    const productionContent = this.extractComparableContent(productionEvent);
    const shadowContent = this.extractComparableContent(shadowEvent);

    this.compareObjects(productionContent, shadowContent, '', differences);

    return differences;
  }

  private compareObjects(
    production: any,
    shadow: any,
    fieldPath: string,
    differences: ContentDifference[]
  ): void {
    const productionKeys = new Set(Object.keys(production || {}));
    const shadowKeys = new Set(Object.keys(shadow || {}));
    const allKeys = new Set([...productionKeys, ...shadowKeys]);

    for (const key of allKeys) {
      const currentPath = fieldPath ? `${fieldPath}.${key}` : key;
      const productionValue = production?.[key];
      const shadowValue = shadow?.[key];

      if (!productionKeys.has(key)) {
        differences.push({
          field: currentPath,
          productionValue: undefined,
          shadowValue,
          differenceType: 'missing_field',
          impact: this.assessFieldImpact(key)
        });
      } else if (!shadowKeys.has(key)) {
        differences.push({
          field: currentPath,
          productionValue,
          shadowValue: undefined,
          differenceType: 'missing_field',
          impact: this.assessFieldImpact(key)
        });
      } else if (typeof productionValue !== typeof shadowValue) {
        differences.push({
          field: currentPath,
          productionValue,
          shadowValue,
          differenceType: 'type_mismatch',
          impact: this.assessFieldImpact(key)
        });
      } else if (typeof productionValue === 'object' && productionValue !== null) {
        this.compareObjects(productionValue, shadowValue, currentPath, differences);
      } else if (productionValue !== shadowValue) {
        differences.push({
          field: currentPath,
          productionValue,
          shadowValue,
          differenceType: 'different_value',
          impact: this.assessFieldImpact(key)
        });
      }
    }
  }

  private extractComparableContent(event: RouteableEvent): any {
    // Extract relevant fields for comparison, excluding timestamps and IDs
    const content: any = {
      gameId: event.gameId,
      sport: event.sport,
      eventType: event.eventType,
      priority: event.priority
    };

    // Include original event payload if it's an alert
    if (event.originalEvent && 'payload' in event.originalEvent) {
      const payload = (event.originalEvent as any).payload;
      if (payload.alertResult) {
        content.alert = {
          type: payload.alertResult.type,
          message: payload.alertResult.message,
          priority: payload.alertResult.priority,
          contextData: payload.alertResult.contextData
        };
      }
      if (payload.gameState) {
        content.gameState = this.extractGameStateFields(payload.gameState);
      }
    }

    return content;
  }

  private extractGameStateFields(gameState: any): any {
    // Extract comparable game state fields, excluding timing-specific ones
    return {
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      inning: gameState.inning,
      isTopInning: gameState.isTopInning,
      balls: gameState.balls,
      strikes: gameState.strikes,
      outs: gameState.outs,
      hasFirst: gameState.hasFirst,
      hasSecond: gameState.hasSecond,
      hasThird: gameState.hasThird,
      currentBatter: gameState.currentBatter,
      currentPitcher: gameState.currentPitcher
    };
  }

  private calculateContentSimilarity(
    productionEvent: RouteableEvent,
    shadowEvent: RouteableEvent
  ): number {
    const productionContent = this.extractComparableContent(productionEvent);
    const shadowContent = this.extractComparableContent(shadowEvent);

    return this.calculateObjectSimilarity(productionContent, shadowContent);
  }

  private calculateObjectSimilarity(obj1: any, obj2: any): number {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = new Set([...keys1, ...keys2]);

    if (allKeys.size === 0) return 1.0;

    let matchingFields = 0;
    for (const key of allKeys) {
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (val1 === val2) {
        matchingFields++;
      } else if (typeof val1 === 'object' && typeof val2 === 'object' && 
                 val1 !== null && val2 !== null) {
        // Recursive similarity for nested objects
        const nestedSimilarity = this.calculateObjectSimilarity(val1, val2);
        matchingFields += nestedSimilarity;
      }
    }

    return matchingFields / allKeys.size;
  }

  private assessFieldImpact(fieldName: string): 'low' | 'medium' | 'high' {
    // Critical fields that affect user experience
    const highImpactFields = ['message', 'type', 'priority', 'gameId', 'sport'];
    const mediumImpactFields = ['score', 'inning', 'outs', 'contextData'];

    if (highImpactFields.some(field => fieldName.includes(field))) return 'high';
    if (mediumImpactFields.some(field => fieldName.includes(field))) return 'medium';
    return 'low';
  }

  private calculateSeverity(
    differences: ContentDifference[],
    timingDifference: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (differences.length === 0 && timingDifference < 1000) return 'low';
    
    const highImpactDiffs = differences.filter(d => d.impact === 'high').length;
    const mediumImpactDiffs = differences.filter(d => d.impact === 'medium').length;

    if (highImpactDiffs > 0 || timingDifference > 30_000) return 'critical';
    if (mediumImpactDiffs > 2 || timingDifference > 10_000) return 'high';
    if (differences.length > 3 || timingDifference > 5_000) return 'medium';
    return 'low';
  }

  // === MATCHING UTILITIES ===

  private generateMatchingKey(event: RouteableEvent): EventMatchingKey {
    const key: EventMatchingKey = {
      gameId: event.gameId,
      sport: event.sport,
      eventType: event.eventType
    };

    // For alert events, include alert type for more precise matching
    if (event.originalEvent && 'payload' in event.originalEvent) {
      const payload = (event.originalEvent as any).payload;
      if (payload.alertResult?.type) {
        key.alertType = payload.alertResult.type;
      }
    }

    return key;
  }

  private keyToString(key: EventMatchingKey): string {
    return `${key.gameId}:${key.sport}:${key.eventType}${key.alertType ? `:${key.alertType}` : ''}`;
  }

  private findFuzzyMatch(
    event: RouteableEvent,
    pendingEvents: Map<string, RouteableEvent>
  ): { key: string; event: RouteableEvent } | null {
    const eventKey = this.generateMatchingKey(event);

    for (const [key, pendingEvent] of pendingEvents) {
      const pendingKey = this.generateMatchingKey(pendingEvent);
      
      // Check if it's a potential match
      if (eventKey.gameId === pendingKey.gameId &&
          eventKey.sport === pendingKey.sport &&
          eventKey.eventType === pendingKey.eventType) {
        
        // Check timing window
        const timeDiff = Math.abs(event.timestamp - pendingEvent.timestamp);
        if (timeDiff <= this.config.fuzzyMatchWindowMs) {
          return { key, event: pendingEvent };
        }
      }
    }

    return null;
  }

  // === MEMORY MANAGEMENT ===

  /**
   * Add pending event with memory limits enforcement
   */
  private addPendingEvent(
    pendingMap: Map<string, RouteableEvent>, 
    key: string, 
    event: RouteableEvent, 
    type: 'production' | 'shadow'
  ): void {
    // Check if we're at the limit
    if (pendingMap.size >= this.config.maxPendingEvents) {
      // Remove oldest event (first one in Map)
      const firstKey = pendingMap.keys().next().value;
      if (firstKey) {
        const removedEvent = pendingMap.get(firstKey);
        pendingMap.delete(firstKey);
        
        if (this.config.logLevel === 'debug') {
          console.log(`🗑️ EventComparator: Dropped oldest ${type} event due to memory limit: ${firstKey}`);
        }
        
        // Emit missed event due to memory pressure
        this.emit(`missing_${type === 'production' ? 'shadow' : 'production'}_event`, removedEvent);
      }
    }
    
    pendingMap.set(key, event);
  }

  /**
   * Add comparison result with ring buffer behavior
   */
  private addComparisonResult(result: ComparisonResult): void {
    this.comparisonResults.push(result);
    
    // Enforce ring buffer limit
    if (this.comparisonResults.length > this.config.maxComparisonResults) {
      this.comparisonResults.splice(0, this.comparisonResults.length - this.config.maxComparisonResults);
    }
  }

  /**
   * Add timing sample with ring buffer behavior
   */
  private addTimingSample(timeMs: number): void {
    this.comparisonTimes.push(timeMs);
    
    // Enforce ring buffer limit
    if (this.comparisonTimes.length > this.config.maxTimingSamples) {
      this.comparisonTimes.splice(0, this.comparisonTimes.length - this.config.maxTimingSamples);
    }
  }

  // === CLEANUP AND MAINTENANCE ===

  private cleanupExpiredEvents(): void {
    const now = Date.now();
    const expireTime = now - this.config.matchingTimeWindowMs;
    
    let cleanedProduction = 0;
    let cleanedShadow = 0;

    // Clean expired production events
    for (const [key, event] of this.pendingProductionEvents) {
      if (event.timestamp < expireTime) {
        this.pendingProductionEvents.delete(key);
        cleanedProduction++;
        
        // Emit missing shadow event
        this.emit('missing_shadow_event', event);
      }
    }

    // Clean expired shadow events
    for (const [key, event] of this.pendingShadowEvents) {
      if (event.timestamp < expireTime) {
        this.pendingShadowEvents.delete(key);
        cleanedShadow++;
        
        // Emit missing production event
        this.emit('missing_production_event', event);
      }
    }

    if (cleanedProduction > 0 || cleanedShadow > 0) {
      console.log(`🧹 EventComparator: Cleaned ${cleanedProduction} production, ${cleanedShadow} shadow expired events`);
    }

    // Memory cleanup is now handled by ring buffers in addComparisonResult() and addTimingSample()
    // But we should still enforce overall memory health
    if (this.comparisonResults.length > this.config.maxComparisonResults) {
      this.comparisonResults.splice(0, this.comparisonResults.length - this.config.maxComparisonResults);
      console.log(`🧹 EventComparator: Pruned comparison results to ${this.config.maxComparisonResults} limit`);
    }
    
    if (this.comparisonTimes.length > this.config.maxTimingSamples) {
      this.comparisonTimes.splice(0, this.comparisonTimes.length - this.config.maxTimingSamples);
      console.log(`🧹 EventComparator: Pruned timing samples to ${this.config.maxTimingSamples} limit`);
    }
  }

  private recordComparisonTime(timeMs: number): void {
    this.addTimingSample(timeMs);
  }

  // === STATUS AND METRICS ===

  getStatus(): {
    running: boolean;
    pendingComparisons: number;
    totalComparisons: number;
    averageComparisonTimeMs: number;
    uptimeMs: number;
  } {
    const averageTime = this.comparisonTimes.length > 0 
      ? this.comparisonTimes.reduce((sum, time) => sum + time, 0) / this.comparisonTimes.length
      : 0;

    return {
      running: this.isRunning,
      pendingComparisons: this.pendingProductionEvents.size + this.pendingShadowEvents.size,
      totalComparisons: this.comparisonResults.length,
      averageComparisonTimeMs: Math.round(averageTime),
      uptimeMs: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  getRecentResults(limit: number = 100): ComparisonResult[] {
    return this.comparisonResults.slice(-limit);
  }

  // Get results for specific sport or game
  getResultsForSport(sport: string, limit: number = 100): ComparisonResult[] {
    return this.comparisonResults
      .filter(result => result.sport === sport)
      .slice(-limit);
  }

  getResultsForGame(gameId: string): ComparisonResult[] {
    return this.comparisonResults.filter(result => result.gameId === gameId);
  }
}

// === METRICS COLLECTOR ===

export class MetricsCollector extends EventEmitter {
  private metrics: ComparisonMetrics;
  private readonly latencySamples = new Map<string, number[]>(); // sport -> latency samples
  private readonly startTime = Date.now();
  private flushTimer?: NodeJS.Timeout;

  constructor(private flushIntervalMs: number = 30_000, private maxLatencySamples: number = 1_000) {
    super();
    
    this.metrics = this.createInitialMetrics();
    
    // Start metrics flush timer
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, flushIntervalMs);

    console.log('📊 MetricsCollector: Initialized with in-memory storage');
  }

  private createInitialMetrics(): ComparisonMetrics {
    return {
      totalComparisons: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      missingProductionEvents: 0,
      missingShadowEvents: 0,
      noMatches: 0,
      averageContentSimilarity: 0,
      averageTimingDifference: 0,
      divergenceRate: 0,
      matchSuccessRate: 0,
      sportMetrics: {},
      comparisonErrors: 0,
      averageComparisonTimeMs: 0,
      pendingComparisons: 0,
      latencyDifferences: {
        averageMs: 0,
        medianMs: 0,
        p95Ms: 0,
        p99Ms: 0,
        minMs: 0,
        maxMs: 0,
        samples: []
      },
      uptimeMs: 0,
      lastUpdate: new Date()
    };
  }

  // === EVENT HANDLERS ===

  recordComparison(result: ComparisonResult): void {
    this.metrics.totalComparisons++;
    
    // Update match counts
    switch (result.matchType) {
      case 'exact':
        this.metrics.exactMatches++;
        break;
      case 'fuzzy':
        this.metrics.fuzzyMatches++;
        break;
      case 'missing_production':
        this.metrics.missingProductionEvents++;
        break;
      case 'missing_shadow':
        this.metrics.missingShadowEvents++;
        break;
      case 'no_match':
        this.metrics.noMatches++;
        break;
    }

    // Update quality metrics
    this.updateQualityMetrics(result);
    
    // Update sport-specific metrics
    this.updateSportMetrics(result);
    
    // Record latency sample
    this.recordLatencySample(result.sport, result.timingDifference);
    
    this.updateDerivedMetrics();
    this.metrics.lastUpdate = new Date();
  }

  recordMissingEvent(event: RouteableEvent, type: 'production' | 'shadow'): void {
    if (type === 'production') {
      this.metrics.missingProductionEvents++;
    } else {
      this.metrics.missingShadowEvents++;
    }
    
    // Update sport metrics
    this.ensureSportMetrics(event.sport);
    this.metrics.sportMetrics[event.sport].totalEvents++;
    
    this.updateDerivedMetrics();
    this.metrics.lastUpdate = new Date();
  }

  recordError(error: any): void {
    this.metrics.comparisonErrors++;
    this.metrics.lastError = error.message || String(error);
    this.metrics.lastErrorTime = new Date();
    this.metrics.lastUpdate = new Date();
  }

  // === METRICS CALCULATION ===

  private updateQualityMetrics(result: ComparisonResult): void {
    const { totalComparisons } = this.metrics;
    
    // Update running averages
    this.metrics.averageContentSimilarity = 
      ((this.metrics.averageContentSimilarity * (totalComparisons - 1)) + result.contentSimilarity) / totalComparisons;
    
    this.metrics.averageTimingDifference = 
      ((this.metrics.averageTimingDifference * (totalComparisons - 1)) + result.timingDifference) / totalComparisons;
  }

  private updateSportMetrics(result: ComparisonResult): void {
    this.ensureSportMetrics(result.sport);
    const sportMetrics = this.metrics.sportMetrics[result.sport];
    
    sportMetrics.totalEvents++;
    
    if (result.matchType === 'exact' || result.matchType === 'fuzzy') {
      sportMetrics.matchedEvents++;
    }
    
    if (!result.contentMatch || result.differences.length > 0) {
      sportMetrics.divergentEvents++;
    }
    
    // Update average latency
    const totalLatency = (sportMetrics.averageLatencyDifference * (sportMetrics.totalEvents - 1)) + result.timingDifference;
    sportMetrics.averageLatencyDifference = totalLatency / sportMetrics.totalEvents;
    
    // Update alert type metrics
    if (result.productionEvent?.originalEvent && 'payload' in result.productionEvent.originalEvent) {
      const payload = (result.productionEvent.originalEvent as any).payload;
      if (payload.alertResult?.type) {
        this.updateAlertTypeMetrics(sportMetrics, payload.alertResult.type, result);
      }
    }
    
    sportMetrics.lastProcessedTime = new Date();
  }

  private updateAlertTypeMetrics(
    sportMetrics: SportComparisonMetrics,
    alertType: string,
    result: ComparisonResult
  ): void {
    if (!sportMetrics.alertTypeMetrics[alertType]) {
      sportMetrics.alertTypeMetrics[alertType] = {
        alertType,
        totalAlerts: 0,
        matchedAlerts: 0,
        contentDifferences: 0,
        averageTimingDifference: 0,
        criticalDifferences: 0
      };
    }
    
    const alertMetrics = sportMetrics.alertTypeMetrics[alertType];
    alertMetrics.totalAlerts++;
    
    if (result.matchType === 'exact' || result.matchType === 'fuzzy') {
      alertMetrics.matchedAlerts++;
    }
    
    if (result.differences.length > 0) {
      alertMetrics.contentDifferences++;
    }
    
    if (result.severity === 'critical') {
      alertMetrics.criticalDifferences++;
    }
    
    // Update average timing
    const totalTiming = (alertMetrics.averageTimingDifference * (alertMetrics.totalAlerts - 1)) + result.timingDifference;
    alertMetrics.averageTimingDifference = totalTiming / alertMetrics.totalAlerts;
  }

  private ensureSportMetrics(sport: string): void {
    if (!this.metrics.sportMetrics[sport]) {
      this.metrics.sportMetrics[sport] = {
        sport,
        totalEvents: 0,
        matchedEvents: 0,
        divergentEvents: 0,
        averageLatencyDifference: 0,
        errorRate: 0,
        alertTypeMetrics: {},
        lastProcessedTime: new Date()
      };
    }
  }

  private recordLatencySample(sport: string, latencyMs: number): void {
    if (!this.latencySamples.has(sport)) {
      this.latencySamples.set(sport, []);
    }
    
    const samples = this.latencySamples.get(sport)!;
    samples.push(latencyMs);
    
    // Keep only recent samples (ring buffer)
    if (samples.length > this.maxLatencySamples) {
      samples.splice(0, samples.length - this.maxLatencySamples);
    }
  }

  private updateDerivedMetrics(): void {
    const { totalComparisons, exactMatches, fuzzyMatches, missingShadowEvents, missingProductionEvents } = this.metrics;
    
    if (totalComparisons > 0) {
      const successfulMatches = exactMatches + fuzzyMatches;
      this.metrics.matchSuccessRate = (successfulMatches / totalComparisons) * 100;
      
      const divergentEvents = missingShadowEvents + missingProductionEvents;
      this.metrics.divergenceRate = (divergentEvents / totalComparisons) * 100;
    }
    
    // Update latency metrics
    this.updateLatencyMetrics();
    
    // Update sport error rates
    for (const [sport, sportMetrics] of Object.entries(this.metrics.sportMetrics)) {
      if (sportMetrics.totalEvents > 0) {
        sportMetrics.errorRate = (sportMetrics.divergentEvents / sportMetrics.totalEvents) * 100;
      }
    }
    
    this.metrics.uptimeMs = Date.now() - this.startTime;
  }

  private updateLatencyMetrics(): void {
    const allSamples: number[] = [];
    
    for (const samples of this.latencySamples.values()) {
      allSamples.push(...samples);
    }
    
    if (allSamples.length === 0) return;
    
    allSamples.sort((a, b) => a - b);
    
    this.metrics.latencyDifferences = {
      averageMs: Math.round(allSamples.reduce((sum, val) => sum + val, 0) / allSamples.length),
      medianMs: this.calculatePercentile(allSamples, 50),
      p95Ms: this.calculatePercentile(allSamples, 95),
      p99Ms: this.calculatePercentile(allSamples, 99),
      minMs: allSamples[0],
      maxMs: allSamples[allSamples.length - 1],
      samples: allSamples.slice(-100) // Keep recent samples for debugging
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  // === METRICS ACCESS ===

  getMetrics(): ComparisonMetrics {
    this.updateDerivedMetrics(); // Ensure up-to-date
    return { ...this.metrics }; // Return copy to prevent external modification
  }

  getSportMetrics(sport: string): SportComparisonMetrics | null {
    return this.metrics.sportMetrics[sport] || null;
  }

  getAlertTypeMetrics(sport: string, alertType: string): AlertTypeMetrics | null {
    const sportMetrics = this.getSportMetrics(sport);
    return sportMetrics?.alertTypeMetrics[alertType] || null;
  }

  // Get metrics summary for rollout decisions
  getRolloutMetrics(sport?: string): {
    divergenceRate: number;
    matchSuccessRate: number;
    averageLatencyDifference: number;
    errorRate: number;
    criticalDifferences: number;
    recommendation: 'proceed' | 'caution' | 'stop';
  } {
    if (sport) {
      const sportMetrics = this.getSportMetrics(sport);
      if (!sportMetrics) {
        return {
          divergenceRate: 0,
          matchSuccessRate: 0,
          averageLatencyDifference: 0,
          errorRate: 0,
          criticalDifferences: 0,
          recommendation: 'stop'
        };
      }
      
      const criticalDifferences = Object.values(sportMetrics.alertTypeMetrics)
        .reduce((sum, metrics) => sum + metrics.criticalDifferences, 0);
      
      return {
        divergenceRate: sportMetrics.errorRate,
        matchSuccessRate: sportMetrics.totalEvents > 0 ? 
          (sportMetrics.matchedEvents / sportMetrics.totalEvents) * 100 : 0,
        averageLatencyDifference: sportMetrics.averageLatencyDifference,
        errorRate: sportMetrics.errorRate,
        criticalDifferences,
        recommendation: this.calculateRecommendation(sportMetrics.errorRate, criticalDifferences)
      };
    }
    
    // Global metrics
    const totalCriticalDifferences = Object.values(this.metrics.sportMetrics)
      .reduce((sum, sport) => 
        sum + Object.values(sport.alertTypeMetrics)
          .reduce((sportSum, alert) => sportSum + alert.criticalDifferences, 0), 0);
    
    return {
      divergenceRate: this.metrics.divergenceRate,
      matchSuccessRate: this.metrics.matchSuccessRate,
      averageLatencyDifference: this.metrics.averageTimingDifference,
      errorRate: this.metrics.divergenceRate, // Using divergence as error rate
      criticalDifferences: totalCriticalDifferences,
      recommendation: this.calculateRecommendation(this.metrics.divergenceRate, totalCriticalDifferences)
    };
  }

  private calculateRecommendation(errorRate: number, criticalDifferences: number): 'proceed' | 'caution' | 'stop' {
    if (criticalDifferences > 5 || errorRate > 20) return 'stop';
    if (criticalDifferences > 2 || errorRate > 10) return 'caution';
    return 'proceed';
  }

  // === LIFECYCLE ===

  private flushMetrics(): void {
    // Could implement persistence here if needed
    // For now, just emit metrics for monitoring
    this.emit('metrics_flush', this.getMetrics());
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    console.log('📊 MetricsCollector: Stopped');
  }

  // Reset metrics (useful for testing or clean starts)
  reset(): void {
    this.metrics = this.createInitialMetrics();
    this.latencySamples.clear();
    console.log('📊 MetricsCollector: Metrics reset');
  }
}

// === FACTORY FUNCTION ===

export function createEventComparisonSystem(config: {
  comparator?: Partial<EventComparisonConfig>;
  metricsFlushIntervalMs?: number;
}): { comparator: EventComparator; metricsCollector: MetricsCollector } {
  const comparator = new EventComparator(config.comparator);
  const metricsCollector = new MetricsCollector(config.metricsFlushIntervalMs);
  
  // Wire comparator events to metrics collector
  comparator.on('comparison_complete', (result: ComparisonResult) => {
    metricsCollector.recordComparison(result);
  });
  
  comparator.on('missing_production_event', (event: RouteableEvent) => {
    metricsCollector.recordMissingEvent(event, 'production');
  });
  
  comparator.on('missing_shadow_event', (event: RouteableEvent) => {
    metricsCollector.recordMissingEvent(event, 'shadow');
  });
  
  comparator.on('comparison_error', (error: any) => {
    metricsCollector.recordError(error);
  });
  
  console.log('🏗️ EventComparisonSystem: Created integrated comparator and metrics collector');
  
  return { comparator, metricsCollector };
}