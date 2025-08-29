/**
 * Enhanced MLB Alert Deduper - TypeScript Port
 * Based on proven Python dedup.py system with sophisticated multi-tier deduplication
 */

import crypto from 'crypto';

// Token bucket for per-game rate limiting
class TokenBucket {
  private capacity: number;
  private refillRate: number;
  private tokens: number;
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(n: number = 1): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
      this.lastRefill = now;
    }
    
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    
    return false;
  }
}

// Alert configuration interface
interface AlertConfig {
  window: number;
  scope: 'play' | 'plate_appearance' | 'half_inning' | 'game';
  content_fields: string[];
  realert_after_secs?: number;
}

// Default alert configurations (enhanced version from working system)
const DEFAULT_ALERT_CONFIG: Record<string, AlertConfig> = {
  // Power & Performance Alerts
  power_hitter: {
    window: 15,
    scope: 'plate_appearance',
    content_fields: ['batter_id', 'pa_id', 'prob_tier'],
    realert_after_secs: undefined
  },
  
  // Scoring Situation Alerts
  bases_loaded_no_outs: {
    window: 60,
    scope: 'plate_appearance', 
    content_fields: ['bases_hash', 'outs', 'batter_id'],
    realert_after_secs: 180
  },
  
  runners_23_no_outs: {
    window: 60,
    scope: 'plate_appearance',
    content_fields: ['bases_hash', 'outs', 'batter_id'], 
    realert_after_secs: 180
  },
  
  // Play-by-Play Alerts
  hit: {
    window: 15,
    scope: 'play',
    content_fields: ['play_id', 'description'],
    realert_after_secs: undefined
  },
  
  home_run: {
    window: 15,
    scope: 'play', 
    content_fields: ['play_id', 'description'],
    realert_after_secs: undefined
  },
  
  // Enhanced Situation Alert (Tier-based)
  enhanced_situation: {
    window: 30,
    scope: 'plate_appearance',
    content_fields: ['bases_hash', 'outs', 'batter_id', 'tier'],
    realert_after_secs: 90
  },
  
  // Hot Hitter Special Analysis
  hot_hitter_bases_loaded_ai: {
    window: 300,
    scope: 'plate_appearance',
    content_fields: ['batter_id', 'game_hrs', 'bases_loaded', 'inning'],
    realert_after_secs: undefined
  },
  
  // Default fallback
  default: {
    window: 15,
    scope: 'game',
    content_fields: ['digest'],
    realert_after_secs: undefined
  }
};

// Alert data interface
interface AlertData {
  game_id?: string;
  inning?: number;
  inning_top?: boolean;
  outs?: number;
  runners?: any[];
  batter_id?: string;
  at_bat_index?: number;
  pa_id?: string;
  play_id?: string;
  description?: string;
  tier?: number;
  prob_tier?: string;
  [key: string]: any;
}

export class AlertDeduper {
  private cfg: Record<string, AlertConfig>;
  private alertDedupWindow: number;
  private enableBuckets: boolean;
  private bucketCapacity: number;
  private bucketRefillSeconds: number;

  // Internal stores
  private recentAlerts: Map<string, number> = new Map();
  private gameStates: Map<string, string> = new Map();
  private lastSentBySimple: Map<string, number> = new Map();
  private buckets: Map<string, TokenBucket> = new Map();

  constructor(
    alertConfig?: Record<string, AlertConfig>,
    alertDedupWindow: number = 15,
    enableBuckets: boolean = true,
    bucketCapacity: number = 8,
    bucketRefillSeconds: number = 15
  ) {
    this.cfg = { ...DEFAULT_ALERT_CONFIG };
    if (alertConfig) {
      Object.assign(this.cfg, alertConfig);
    }
    
    this.alertDedupWindow = alertDedupWindow;
    this.enableBuckets = enableBuckets;
    this.bucketCapacity = bucketCapacity;
    this.bucketRefillSeconds = bucketRefillSeconds;
    
    this.validateAlertConfig();
  }

  /**
   * Main deduplication method - returns true if alert should be sent
   */
  isNewAlert(gameId: string, alertType: string, data: AlertData): boolean {
    const now = Date.now();
    const cfg = this.cfg[alertType] || this.cfg.default;

    const simpleKey = this.makeSimpleKey(gameId, alertType, cfg.scope, data);
    const dedupKey = this.makeDedupKey(gameId, alertType, cfg.content_fields, data);
    const state = this.normalizedState(alertType, data);

    // 1) Time-based throttle on dedup key
    const lastTs = this.recentAlerts.get(dedupKey);
    if (lastTs && (now - lastTs) < cfg.window * 1000) {
      console.log(`🔄 ENHANCED DEDUP: Waiting ${Math.round((cfg.window * 1000 - (now - lastTs)) / 1000)}s for ${alertType}`);
      return false;
    }

    // 2) State-based check (block if unchanged unless re-alert window hit)
    const prevState = this.gameStates.get(simpleKey);
    if (prevState === state) {
      const realertSecs = cfg.realert_after_secs;
      if (!realertSecs) {
        console.log(`🔄 ENHANCED DEDUP: Same state, no realert configured for ${alertType}`);
        return false;
      }
      
      const lastSent = this.lastSentBySimple.get(simpleKey) || 0;
      if ((now - lastSent) < realertSecs * 1000) {
        console.log(`🔄 ENHANCED DEDUP: Realert window not met for ${alertType}`);
        return false;
      }
      
      // Re-alert allowed - refresh timers before returning true
      this.recentAlerts.set(dedupKey, now);
      this.lastSentBySimple.set(simpleKey, now);
      
      if (this.enableBuckets && !this.consumeBucket(gameId)) {
        console.log(`🔄 ENHANCED DEDUP: Token bucket exhausted for game ${gameId}`);
        return false;
      }
      
      console.log(`✅ ENHANCED DEDUP: Realert allowed for ${alertType}`);
      return true;
    }

    // 3) New state - accept and update
    this.gameStates.set(simpleKey, state);
    this.recentAlerts.set(dedupKey, now);
    this.lastSentBySimple.set(simpleKey, now);
    
    if (this.enableBuckets && !this.consumeBucket(gameId)) {
      console.log(`🔄 ENHANCED DEDUP: Token bucket exhausted for game ${gameId}`);
      return false;
    }
    
    console.log(`✅ ENHANCED DEDUP: New alert allowed for ${alertType} (scope: ${cfg.scope})`);
    return true;
  }

  /**
   * Cleanup old entries - call periodically
   */
  cleanupOldAlerts(): void {
    const now = Date.now();
    
    // Clean recent alerts
    const toDeleteRecent: string[] = [];
    this.recentAlerts.forEach((timestamp, key) => {
      const parts = key.split(':');
      const alertType = parts[1];
      const cfg = this.cfg[alertType] || this.cfg.default;
      const ttl = (cfg.window + 10) * 1000; // Add 10s buffer
      
      if (now - timestamp > ttl) {
        toDeleteRecent.push(key);
      }
    });
    
    toDeleteRecent.forEach(key => {
      this.recentAlerts.delete(key);
    });
    
    // Clean old simple keys (1 hour TTL)
    const toDeleteSimple: string[] = [];
    this.lastSentBySimple.forEach((timestamp, key) => {
      if (now - timestamp > 3600000) {
        toDeleteSimple.push(key);
      }
    });
    
    toDeleteSimple.forEach(key => {
      this.lastSentBySimple.delete(key);
    });
    
    console.log(`🧹 ENHANCED DEDUP: Cleaned up old entries (${this.recentAlerts.size} recent, ${this.lastSentBySimple.size} simple)`);
  }

  // Private helper methods
  private consumeBucket(gameId: string): boolean {
    if (!this.enableBuckets) return true;
    
    let bucket = this.buckets.get(gameId);
    if (!bucket) {
      const refillRate = this.bucketCapacity / this.bucketRefillSeconds;
      bucket = new TokenBucket(this.bucketCapacity, refillRate);
      this.buckets.set(gameId, bucket);
    }
    
    return bucket.consume(1);
  }

  private makeSimpleKey(gameId: string, alertType: string, scope: string, data: AlertData): string {
    const parts = [gameId, alertType];
    
    switch (scope) {
      case 'play':
        parts.push('play', data.play_id || 'unknown');
        break;
      case 'plate_appearance':
        parts.push('pa', this.halfInningKey(data), data.pa_id || this.plateAppearanceId(data));
        break;
      case 'half_inning':
        parts.push('half', this.halfInningKey(data));
        break;
      case 'game':
        parts.push('game');
        break;
      default:
        parts.push('unknown');
    }
    
    return parts.join(':');
  }

  private makeDedupKey(gameId: string, alertType: string, contentFields: string[], data: AlertData): string {
    const chunks: string[] = [];
    
    for (const field of contentFields) {
      if (field === 'bases_hash') {
        chunks.push(this.basesHash(data.runners || []));
      } else {
        chunks.push(String(data[field] || ''));
      }
    }
    
    const digest = crypto.createHash('blake2b256')
      .update(chunks.join('|'))
      .digest('hex')
      .substring(0, 24);
    
    return `${gameId}:${alertType}:${digest}`;
  }

  private normalizedState(alertType: string, data: AlertData): string {
    const cfg = this.cfg[alertType] || this.cfg.default;
    const base: Record<string, any> = {
      half: this.halfInningKey(data),
      outs: data.outs
    };
    
    for (const field of cfg.content_fields) {
      if (field === 'bases_hash') {
        base.bases = this.basesHash(data.runners || []);
      } else {
        base[field] = data[field];
      }
    }
    
    // Convert to stable string representation
    return JSON.stringify(base, Object.keys(base).sort());
  }

  private basesHash(runners: any[]): string {
    if (!runners || runners.length === 0) {
      return 'EMPTY';
    }
    
    const normalized: string[] = [];
    
    for (const runner of runners) {
      if (typeof runner === 'string') {
        normalized.push(runner.endsWith('B') ? runner : `${runner}B`);
      } else if (typeof runner === 'number') {
        normalized.push(`${runner}B`);
      } else if (typeof runner === 'object' && runner.base) {
        const base = runner.base;
        if (typeof base === 'number') {
          normalized.push(`${base}B`);
        } else if (typeof base === 'string') {
          normalized.push(base.endsWith('B') ? base : `${base}B`);
        }
      }
    }
    
    if (normalized.length === 0) {
      return 'EMPTY';
    }
    
    // ES5 compatible deduplication
    const unique: string[] = [];
    for (const item of normalized) {
      if (unique.indexOf(item) === -1) {
        unique.push(item);
      }
    }
    
    return unique.sort().join('_');
  }

  private plateAppearanceId(data: AlertData): string {
    return [
      data.game_id,
      this.halfInningKey(data),
      data.batter_id || 'unknown',
      data.at_bat_index !== undefined ? data.at_bat_index : data.play_index
    ].join('|');
  }

  private halfInningKey(data: AlertData): string {
    const inning = data.inning || 0;
    const half = data.inning_top ? 'top' : 'bottom';
    return `inning_${inning}_${half}`;
  }

  private validateAlertConfig(): void {
    const validScopes = ['play', 'plate_appearance', 'half_inning', 'game'];
    
    for (const [type, config] of Object.entries(this.cfg)) {
      if (type === 'default') continue;
      
      if (!config.window || typeof config.window !== 'number') {
        throw new Error(`ALERT_CONFIG[${type}] missing/invalid window`);
      }
      
      if (!config.scope || validScopes.indexOf(config.scope) === -1) {
        throw new Error(`ALERT_CONFIG[${type}] invalid scope '${config.scope}'`);
      }
      
      if (!Array.isArray(config.content_fields)) {
        throw new Error(`ALERT_CONFIG[${type}] missing/invalid content_fields`);
      }
    }
  }
}