// Advanced alert deduplication system with context-aware scoping
// Prevents spam while allowing legitimate notifications

export interface AlertKey {
  type: string;
  gameId: string;
  playerId?: string;
  inning?: number;
  situation?: string;
  timestamp: number;
}

export interface AlertScope {
  level: 'play' | 'plate-appearance' | 'inning' | 'game';
  timeWindow: number; // milliseconds
  maxAlerts: number;
}

export interface DeduplicationRule {
  alertType: string;
  scope: AlertScope;
  escalationOnly: boolean; // Only alert when tier improves (e.g., B→A)
  contextFactors: string[]; // Additional factors for uniqueness
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export class AlertDeduplication {
  
  // Memory-safe tracking with automatic cleanup
  private recentAlerts = new Map<string, { timestamp: number; tier?: string; count: number }>();
  private tokenBuckets = new Map<string, TokenBucket>();
  
  // Deduplication rules for different alert types
  private readonly DEDUP_RULES: DeduplicationRule[] = [
    {
      alertType: 'power-hitter',
      scope: { level: 'plate-appearance', timeWindow: 30000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['batter', 'pitcher', 'tier']
    },
    {
      alertType: 'elite-clutch',
      scope: { level: 'plate-appearance', timeWindow: 45000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: ['batter', 'inning', 'leverage']
    },
    {
      alertType: 'rbi-machine',
      scope: { level: 'inning', timeWindow: 300000, maxAlerts: 2 },
      escalationOnly: false,
      contextFactors: ['batter', 'bases-loaded']
    },
    {
      alertType: 'inning-change',
      scope: { level: 'inning', timeWindow: 60000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: ['inning']
    },
    {
      alertType: 'game-start',
      scope: { level: 'game', timeWindow: 600000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: []
    },
    {
      alertType: 'pitcher-fatigue',
      scope: { level: 'inning', timeWindow: 180000, maxAlerts: 2 },
      escalationOnly: true,
      contextFactors: ['pitcher', 'fatigue-level']
    },
    {
      alertType: 'control-loss',
      scope: { level: 'plate-appearance', timeWindow: 120000, maxAlerts: 3 },
      escalationOnly: false,
      contextFactors: ['pitcher', 'severity']
    },
    {
      alertType: 'Hybrid RE24+AI Analysis',
      scope: { level: 'plate-appearance', timeWindow: 3000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: ['batter', 'inning', 'pitcher']
    },
    // Tennis alert deduplication rules
    {
      alertType: 'TENNIS_BREAK_POINT',
      scope: { level: 'plate-appearance', timeWindow: 15000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['matchId', 'stablePointKey']
    },
    {
      alertType: 'TENNIS_DOUBLE_BREAK_POINT',
      scope: { level: 'plate-appearance', timeWindow: 15000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['matchId', 'stablePointKey']
    },
    {
      alertType: 'TENNIS_SET_POINT',
      scope: { level: 'plate-appearance', timeWindow: 15000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['matchId', 'stablePointKey']
    },
    {
      alertType: 'TENNIS_MATCH_POINT',
      scope: { level: 'plate-appearance', timeWindow: 15000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['matchId', 'stablePointKey']
    },
    {
      alertType: 'TENNIS_TIEBREAK_START',
      scope: { level: 'game', timeWindow: 30000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: ['matchId', 'set']
    },
    {
      alertType: 'TENNIS_MOMENTUM_SURGE',
      scope: { level: 'inning', timeWindow: 60000, maxAlerts: 1 },
      escalationOnly: false,
      contextFactors: ['matchId', 'set', 'side']
    },
    {
      alertType: 'TENNIS_AI_OPPORTUNITY',
      scope: { level: 'point', timeWindow: 20000, maxAlerts: 1 },
      escalationOnly: true,
      contextFactors: ['matchId', 'set', 'game', 'server', 'stablePointKey']
    }
  ];

  /**
   * Check if an alert should be sent based on deduplication rules
   */
  shouldSendAlert(
    alertType: string,
    gameId: string,
    context: Record<string, any>,
    tier?: string
  ): { allowed: boolean; reason?: string; debugInfo: any } {
    
    const rule = this.DEDUP_RULES.find(r => r.alertType === alertType);
    if (!rule) {
      return { 
        allowed: true, 
        reason: 'No deduplication rule found',
        debugInfo: { rule: null }
      };
    }

    // Generate context-aware key
    const alertKey = this.generateAlertKey(alertType, gameId, context, rule);
    const keyString = this.serializeAlertKey(alertKey);
    
    // Check token bucket for rate limiting
    if (!this.checkTokenBucket(alertType, rule)) {
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        debugInfo: { key: keyString, rule, tokenBucket: 'exhausted' }
      };
    }

    // Check deduplication history
    const existing = this.recentAlerts.get(keyString);
    const now = Date.now();

    if (existing) {
      // Check if within time window
      if (now - existing.timestamp < rule.scope.timeWindow) {
        
        // For escalation-only alerts, check if tier improved
        if (rule.escalationOnly && tier) {
          const tierImproved = this.checkTierEscalation(existing.tier, tier);
          if (!tierImproved) {
            return { 
              allowed: false, 
              reason: `No tier escalation (${existing.tier} → ${tier})`,
              debugInfo: { key: keyString, rule, existing, tierImproved: false }
            };
          }
        } else {
          // Check max alerts limit
          if (existing.count >= rule.scope.maxAlerts) {
            return { 
              allowed: false, 
              reason: `Max alerts reached (${existing.count}/${rule.scope.maxAlerts})`,
              debugInfo: { key: keyString, rule, existing }
            };
          }
        }
      }
    }

    // Update tracking
    this.updateAlertTracking(keyString, tier, existing);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.1) { // 10% chance
      this.cleanupOldAlerts();
    }

    return { 
      allowed: true, 
      reason: 'Passed all deduplication checks',
      debugInfo: { key: keyString, rule, existing: existing || null }
    };
  }

  /**
   * Generate context-aware alert key using tuple-based approach
   */
  private generateAlertKey(
    alertType: string,
    gameId: string,
    context: Record<string, any>,
    rule: DeduplicationRule
  ): AlertKey {
    
    const key: AlertKey = {
      type: alertType,
      gameId,
      timestamp: this.getMonotonicTime()
    };

    // Add context factors based on rule
    rule.contextFactors.forEach(factor => {
      switch (factor) {
        case 'batter':
          key.playerId = context.batterId;
          break;
        case 'pitcher':
          key.playerId = context.pitcherId;
          break;
        case 'inning':
          key.inning = context.inning;
          break;
        case 'tier':
        case 'fatigue-level':
        case 'severity':
        case 'leverage':
        case 'bases-loaded':
          key.situation = context[factor];
          break;
      }
    });

    // Scope-based adjustments
    switch (rule.scope.level) {
      case 'play':
        key.situation = `${key.situation || ''}-play-${context.playId || Date.now()}`;
        break;
      case 'plate-appearance':
        key.situation = `${key.situation || ''}-pa-${context.atBatId || context.playerId}`;
        break;
      case 'inning':
        key.inning = context.inning;
        break;
      case 'game':
        // Game-level scoping (key remains as-is)
        break;
    }

    return key;
  }

  /**
   * Serialize alert key to string using stable tuple format
   */
  private serializeAlertKey(key: AlertKey): string {
    const parts = [
      key.type,
      key.gameId,
      key.playerId || 'null',
      key.inning?.toString() || 'null',
      key.situation || 'null'
    ];
    return parts.join('::');
  }

  /**
   * Check if tier escalation occurred (B→A, C→B, etc.)
   */
  private checkTierEscalation(oldTier?: string, newTier?: string): boolean {
    if (!oldTier || !newTier) return true;
    
    const tierValues: Record<string, number> = { 'D': 1, 'C': 2, 'B': 3, 'A': 4 };
    return tierValues[newTier] > tierValues[oldTier];
  }

  /**
   * Check token bucket for rate limiting
   */
  private checkTokenBucket(alertType: string, rule: DeduplicationRule): boolean {
    let bucket = this.tokenBuckets.get(alertType);
    
    if (!bucket) {
      // Create bucket with capacity based on rule
      const capacity = rule.scope.maxAlerts * 2;
      const refillRate = capacity / (rule.scope.timeWindow / 1000); // tokens per second
      bucket = new TokenBucket(capacity, refillRate);
      this.tokenBuckets.set(alertType, bucket);
    }
    
    return bucket.consume();
  }

  /**
   * Update alert tracking with new occurrence
   */
  private updateAlertTracking(keyString: string, tier?: string, existing?: any): void {
    const now = Date.now();
    
    if (existing) {
      existing.timestamp = now;
      existing.count += 1;
      if (tier) existing.tier = tier;
    } else {
      this.recentAlerts.set(keyString, {
        timestamp: now,
        tier,
        count: 1
      });
    }
  }

  /**
   * Get monotonic time to prevent issues with clock changes
   */
  private getMonotonicTime(): number {
    // Use performance.now() for monotonic time, fallback to Date.now()
    return typeof performance !== 'undefined' ? 
      performance.now() : Date.now();
  }

  /**
   * Memory-safe cleanup of expired alert tracking
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour max retention
    let cleanedCount = 0;
    
    this.recentAlerts.forEach((alert, key) => {
      if (now - alert.timestamp > maxAge) {
        this.recentAlerts.delete(key);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired alert entries`);
    }
  }

  /**
   * Simplified method for edge-triggered alerts (used by Tennis engine)
   */
  shouldAllow(
    alertType: string,
    gameId: string,
    dedupKey: string,
    options: { escalationOnly?: boolean; timeWindow?: number } = {}
  ): boolean {
    const rule = this.DEDUP_RULES.find(r => r.alertType === alertType);
    const timeWindow = options.timeWindow || rule?.scope.timeWindow || 15000;
    
    const existing = this.recentAlerts.get(dedupKey);
    const now = Date.now();

    if (existing && (now - existing.timestamp < timeWindow)) {
      return false; // Still within dedup window
    }

    // Update tracking
    this.recentAlerts.set(dedupKey, {
      timestamp: now,
      count: existing ? existing.count + 1 : 1
    });

    return true;
  }

  /**
   * Get current deduplication statistics for monitoring
   */
  getDeduplicationStats(): {
    activeAlerts: number;
    ruleCount: number;
    tokenBuckets: Record<string, { tokens: number; capacity: number }>;
  } {
    const tokenBucketStats: Record<string, { tokens: number; capacity: number }> = {};
    
    this.tokenBuckets.forEach((bucket, alertType) => {
      tokenBucketStats[alertType] = {
        tokens: Math.floor((bucket as any).tokens),
        capacity: (bucket as any).capacity
      };
    });
    
    return {
      activeAlerts: this.recentAlerts.size,
      ruleCount: this.DEDUP_RULES.length,
      tokenBuckets: tokenBucketStats
    };
  }

  /**
   * Force reset for testing or emergency situations
   */
  reset(): void {
    this.recentAlerts.clear();
    this.tokenBuckets.clear();
    console.log('🔄 Alert deduplication system reset');
  }
}

export const alertDeduplication = new AlertDeduplication();