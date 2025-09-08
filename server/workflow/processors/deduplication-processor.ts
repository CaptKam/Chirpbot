import { EventEmitter } from 'events';

/**
 * High-performance deduplication processor
 * Completely rewritten for better efficiency and accuracy
 */

export interface DeduplicationRule {
  sport: string;
  alertType: string;
  cooldownMs: number;
  realertAfterMs?: number;
  contextKey: string; // Key to use for context-based deduplication
  scoping: 'global' | 'game' | 'user-game' | 'plate-appearance';
}

export interface DeduplicationEntry {
  key: string;
  sport: string;
  alertType: string;
  gameId: string;
  userId?: string;
  contextHash: string;
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;
  nextRealertTime?: Date;
}

export interface DeduplicationConfig {
  maxCacheSize: number;
  cleanupIntervalMs: number;
  defaultCooldownMs: number;
  enableContextualDeduplication: boolean;
}

export class DeduplicationProcessor extends EventEmitter {
  private config: DeduplicationConfig;
  private rules: Map<string, DeduplicationRule> = new Map();
  private cache: Map<string, DeduplicationEntry> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: DeduplicationConfig) {
    super();
    this.config = config;
    this.initializeDefaultRules();
  }

  /**
   * Start the deduplication processor
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Deduplication processor already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting deduplication processor...');

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupIntervalMs);

    console.log('✅ Deduplication processor started');
  }

  /**
   * Stop the deduplication processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping deduplication processor...');
    this.isRunning = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('✅ Deduplication processor stopped');
  }

  /**
   * Check if an alert is a duplicate
   */
  isDuplicate(alertKey: string, sport: string, gameId: string, alertType: string, userId?: string, context?: any): boolean {
    const rule = this.getRule(sport, alertType);
    const deduplicationKey = this.generateDeduplicationKey(rule, gameId, userId, context);
    const entry = this.cache.get(deduplicationKey);

    if (!entry) {
      // First occurrence - not a duplicate
      this.recordAlert(deduplicationKey, sport, alertType, gameId, userId, context);
      return false;
    }

    const now = new Date();
    const timeSinceLastOccurrence = now.getTime() - entry.lastOccurrence.getTime();

    // Check if cooldown has expired
    if (timeSinceLastOccurrence >= rule.cooldownMs) {
      // Check if we should allow a realert
      if (rule.realertAfterMs && entry.nextRealertTime && now >= entry.nextRealertTime) {
        console.log(`🔄 Realert allowed for ${alertType} after ${rule.realertAfterMs}ms`);
        this.updateAlert(entry, now, rule);
        return false;
      }

      // Cooldown expired but no realert - allow through
      this.updateAlert(entry, now, rule);
      return false;
    }

    // Still within cooldown period - duplicate
    entry.occurrenceCount++;
    entry.lastOccurrence = now;
    
    console.log(`🚫 Duplicate ${alertType} filtered (cooldown: ${timeSinceLastOccurrence}ms < ${rule.cooldownMs}ms)`);
    this.emit('duplicateFiltered', { alertType, sport, gameId, timeSinceLastOccurrence });
    
    return true;
  }

  /**
   * Add or update a deduplication rule
   */
  addRule(rule: DeduplicationRule): void {
    const ruleKey = `${rule.sport}:${rule.alertType}`;
    this.rules.set(ruleKey, rule);
    console.log(`📋 Added deduplication rule: ${ruleKey} (cooldown: ${rule.cooldownMs}ms)`);
  }

  /**
   * Get rule for sport and alert type
   */
  private getRule(sport: string, alertType: string): DeduplicationRule {
    const ruleKey = `${sport}:${alertType}`;
    const rule = this.rules.get(ruleKey);
    
    if (rule) {
      return rule;
    }

    // Return default rule
    return {
      sport,
      alertType,
      cooldownMs: this.config.defaultCooldownMs,
      contextKey: 'basic',
      scoping: 'game'
    };
  }

  /**
   * Generate deduplication key based on rule
   */
  private generateDeduplicationKey(rule: DeduplicationRule, gameId: string, userId?: string, context?: any): string {
    let key = `${rule.sport}:${rule.alertType}`;

    switch (rule.scoping) {
      case 'global':
        // No additional scope
        break;
      case 'game':
        key += `:${gameId}`;
        break;
      case 'user-game':
        key += `:${gameId}:${userId || 'anonymous'}`;
        break;
      case 'plate-appearance':
        if (context) {
          const contextHash = this.generateContextHash(context, rule.contextKey);
          key += `:${gameId}:${contextHash}`;
        }
        break;
    }

    return key;
  }

  /**
   * Generate context hash for contextual deduplication
   */
  private generateContextHash(context: any, contextKey: string): string {
    if (!this.config.enableContextualDeduplication) {
      return 'simple';
    }

    try {
      switch (contextKey) {
        case 'mlb-plate-appearance':
          return `${context.gamePk || ''}:${context.inning || ''}:${context.halfInning || ''}:${context.outs || ''}:${context.batterId || ''}:${context.plateAppearanceId || ''}`;

        case 'mlb-base-situation':
          const bases = `${context.hasFirst ? '1' : '0'}${context.hasSecond ? '2' : '0'}${context.hasThird ? '3' : '0'}`;
          return `${context.gameId || ''}:${context.inning || ''}:${context.halfInning || ''}:${bases}:${context.outs || ''}`;

        case 'game-situation':
          return `${context.gameId || ''}:${context.homeScore || 0}:${context.awayScore || 0}:${context.period || context.inning || 1}`;

        default:
          return 'basic';
      }
    } catch (error) {
      console.error('❌ Error generating context hash:', error);
      return 'error';
    }
  }

  /**
   * Record new alert occurrence
   */
  private recordAlert(key: string, sport: string, alertType: string, gameId: string, userId?: string, context?: any): void {
    const now = new Date();
    const rule = this.getRule(sport, alertType);
    
    const entry: DeduplicationEntry = {
      key,
      sport,
      alertType,
      gameId,
      userId,
      contextHash: context ? this.generateContextHash(context, rule.contextKey) : 'none',
      firstOccurrence: now,
      lastOccurrence: now,
      occurrenceCount: 1,
      nextRealertTime: rule.realertAfterMs ? new Date(now.getTime() + rule.realertAfterMs) : undefined
    };

    this.cache.set(key, entry);
    this.emit('alertRecorded', entry);

    // Cleanup if cache is too large
    if (this.cache.size > this.config.maxCacheSize) {
      this.cleanupOldestEntries();
    }
  }

  /**
   * Update existing alert occurrence
   */
  private updateAlert(entry: DeduplicationEntry, now: Date, rule: DeduplicationRule): void {
    entry.lastOccurrence = now;
    entry.occurrenceCount++;
    entry.nextRealertTime = rule.realertAfterMs ? new Date(now.getTime() + rule.realertAfterMs) : undefined;
    
    this.emit('alertUpdated', entry);
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const rule = this.getRule(entry.sport, entry.alertType);
      const age = now.getTime() - entry.lastOccurrence.getTime();
      
      // Remove if older than realert time or 10x cooldown (whichever is longer)
      const maxAge = Math.max(rule.realertAfterMs || 0, rule.cooldownMs * 10);
      
      if (age > maxAge) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired deduplication entries`);
      this.emit('entriesCleanedUp', removedCount);
    }
  }

  /**
   * Cleanup oldest entries when cache is full
   */
  private cleanupOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastOccurrence.getTime() - b[1].lastOccurrence.getTime());
    
    const removeCount = Math.floor(this.config.maxCacheSize * 0.1); // Remove 10%
    
    for (let i = 0; i < removeCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`🧹 Removed ${removeCount} oldest deduplication entries (cache size: ${this.cache.size})`);
  }

  /**
   * Initialize default deduplication rules
   */
  private initializeDefaultRules(): void {
    // MLB rules - sophisticated contextual deduplication
    this.addRule({
      sport: 'MLB',
      alertType: 'MLB_BASES_LOADED_NO_OUTS',
      cooldownMs: 90000, // 90 seconds
      realertAfterMs: 300000, // 5 minutes
      contextKey: 'mlb-base-situation',
      scoping: 'plate-appearance'
    });

    this.addRule({
      sport: 'MLB',
      alertType: 'MLB_RUNNER_ON_THIRD_NO_OUTS',
      cooldownMs: 60000, // 60 seconds
      realertAfterMs: 180000, // 3 minutes
      contextKey: 'mlb-base-situation',
      scoping: 'plate-appearance'
    });

    this.addRule({
      sport: 'MLB',
      alertType: 'MLB_GAME_START',
      cooldownMs: 300000, // 5 minutes
      contextKey: 'game-situation',
      scoping: 'game'
    });

    // NFL rules
    this.addRule({
      sport: 'NFL',
      alertType: 'NFL_TWO_MINUTE_WARNING',
      cooldownMs: 120000, // 2 minutes
      contextKey: 'game-situation',
      scoping: 'game'
    });

    console.log(`✅ Initialized ${this.rules.size} default deduplication rules`);
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cacheSize: this.cache.size,
      rulesCount: this.rules.size,
      config: this.config
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const sportStats: Record<string, number> = {};
    const alertTypeStats: Record<string, number> = {};

    for (const entry of this.cache.values()) {
      sportStats[entry.sport] = (sportStats[entry.sport] || 0) + 1;
      alertTypeStats[entry.alertType] = (alertTypeStats[entry.alertType] || 0) + 1;
    }

    return {
      totalEntries: this.cache.size,
      bySport: sportStats,
      byAlertType: alertTypeStats
    };
  }

  /**
   * Clear all cache entries (for testing/debugging)
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cleared ${size} deduplication cache entries`);
    this.emit('cacheCleared', size);
  }
}