/**
 * UNIFIED DEDUPLICATION SYSTEM
 * Consolidates 3 separate deduplication implementations into one system:
 * - Sports alert deduplication (game-context aware)
 * - HTTP request deduplication (middleware + caching)
 * - Fingerprint-based deduplication (lifecycle management)
 */

import { Request, Response, NextFunction } from 'express';

// === CORE INTERFACES ===

interface AlertKey {
  gameId: string;
  type: string;
  inning?: number;
  half?: string;
  outs?: number;
  bases?: string;
  batter?: string;
  paId?: string;
}

interface CachedAlert {
  timestamp: number;
  count: number;
  tier: string;
  lastContext: any;
}

interface CachedResponse {
  data: any;
  statusCode: number;
  timestamp: number;
  headers: Record<string, string>;
}

interface InflightRequest {
  promise: Promise<void>;
  subscribers: Array<{
    res: Response;
    resolve: () => void;
  }>;
}

interface Runners {
  first: boolean;
  second: boolean;
  third: boolean;
}

interface FrameLike {
  gamePk: string | number;
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  runners: Runners;
  batterId?: number | null;
  onDeckId?: number | null;
  windDir?: 'neutral' | 'out' | 'in' | 'cross' | null;
}

interface UnifiedDedupOptions {
  // Alert deduplication settings
  alertCleanupInterval?: number;
  alertMaxAge?: number;
  
  // Request deduplication settings
  requestCacheTTL?: number;
  requestDedupeWindow?: number;
  
  // Fingerprint deduplication settings
  namespace?: string;
  lifecycleTtlMs?: number;
  perTypeCooldownMs?: Record<string, number>;
  maxEntries?: number;
  sweepIntervalMs?: number;
}

type Entry = { at: number };

export class UnifiedDeduplicator {
  // === ALERT DEDUPLICATION ===
  private alertCache = new Map<string, CachedAlert>();
  private readonly alertCleanupInterval: number;
  private readonly alertMaxAge: number;
  private alertCleanupTimer!: NodeJS.Timeout;

  // === REQUEST DEDUPLICATION ===
  private requestCache = new Map<string, CachedResponse>();
  private inflightRequests = new Map<string, InflightRequest>();
  private readonly requestCacheTTL: number;
  private readonly requestDedupeWindow: number;
  private requestCleanupTimer!: NodeJS.Timeout;

  // === FINGERPRINT DEDUPLICATION ===
  private namespace: string;
  private lifecycleTtl: number;
  private cooldowns: Record<string, number>;
  private maxEntries: number;
  private fingerprintStore = new Map<string, Entry>();
  private sweepTimer!: NodeJS.Timeout;

  constructor(options: UnifiedDedupOptions = {}) {
    // Alert dedup settings
    this.alertCleanupInterval = options.alertCleanupInterval || 30000;
    this.alertMaxAge = options.alertMaxAge || 30000;
    
    // Request dedup settings
    this.requestCacheTTL = options.requestCacheTTL || 5000;
    this.requestDedupeWindow = options.requestDedupeWindow || 100;
    
    // Fingerprint dedup settings
    this.namespace = options.namespace || 'default';
    this.lifecycleTtl = options.lifecycleTtlMs || 10 * 60 * 1000;
    this.cooldowns = options.perTypeCooldownMs || {};
    this.maxEntries = options.maxEntries || 20000;

    // Initialize cleanup timers
    this.initializeCleanupTimers();
  }

  private initializeCleanupTimers(): void {
    // Alert cleanup
    this.alertCleanupTimer = setInterval(() => {
      try {
        this.cleanupAlerts();
      } catch (error) {
        console.error('⚠️ Non-critical error in alert dedup cleanup:', error);
      }
    }, this.alertCleanupInterval);

    // Request cleanup
    this.requestCleanupTimer = setInterval(() => {
      this.cleanupRequests();
    }, 60000);

    // Fingerprint sweep
    const sweepEvery = 60000;
    this.sweepTimer = setInterval(() => this.sweepFingerprints(), sweepEvery);
  }

  // === ALERT DEDUPLICATION METHODS ===

  buildAlertDedupKey(alert: AlertKey): string {
    const basesHash = [
      alert.bases || '',
      alert.outs || 0,
      alert.inning || 0,
      alert.half || ''
    ].join(':');

    return `alert:${alert.gameId}:${alert.type}:${alert.inning}:${alert.half}:${alert.outs}:${basesHash}:${alert.batter}:${alert.paId}`;
  }

  shouldSendAlert(
    alertKey: AlertKey, 
    tier: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game' = 'plate-appearance'
  ): boolean {
    const key = this.buildAlertDedupKey(alertKey);
    const now = Date.now();
    const cached = this.alertCache.get(key);

    if (!cached) {
      console.log(`🟢 UNIFIED DEDUP: Allowing first occurrence of ${alertKey.type} for game ${alertKey.gameId}`);
      this.alertCache.set(key, {
        timestamp: now,
        count: 1,
        tier,
        lastContext: alertKey
      });
      return true;
    }

    // Check if this is truly the same event
    const isDuplicateEvent = (
      cached.lastContext.paId === alertKey.paId &&
      cached.lastContext.batter === alertKey.batter &&
      cached.lastContext.inning === alertKey.inning &&
      cached.lastContext.half === alertKey.half &&
      cached.lastContext.outs === alertKey.outs
    );

    if (!isDuplicateEvent) {
      console.log(`🟢 UNIFIED DEDUP: Allowing ${alertKey.type} - different context (new PA/batter)`);
      this.alertCache.set(key, {
        timestamp: now,
        count: cached.count + 1,
        tier,
        lastContext: alertKey
      });
      return true;
    }

    // Same event within 2 seconds = true duplicate, block it
    const timeSinceFirst = now - cached.timestamp;
    if (timeSinceFirst < 2000) {
      console.log(`🔴 UNIFIED DEDUP: Blocking duplicate ${alertKey.type} - same event within 2s`);
      return false;
    }

    console.log(`🟢 UNIFIED DEDUP: Allowing ${alertKey.type} - same event but >2s later`);
    this.alertCache.set(key, {
      timestamp: now,
      count: cached.count + 1,
      tier,
      lastContext: alertKey
    });
    return true;
  }

  // === REQUEST DEDUPLICATION METHODS ===

  private getRequestKey(req: Request): string {
    const query = JSON.stringify(req.query);
    const userId = (req.session as any)?.userId || 'anonymous';
    return `request:${req.method}:${req.path}:${query}:${userId}`;
  }

  requestMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only deduplicate GET requests to /api paths
      if (req.method !== 'GET' || !req.path.startsWith('/api/')) {
        return next();
      }

      // Skip deduplication for certain paths that should always be fresh
      const skipPaths = ['/api/auth/', '/api/admin/', '/api/alerts/live'];
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      const key = this.getRequestKey(req);
      const now = Date.now();

      // Check cache first
      const cached = this.requestCache.get(key);
      if (cached && (now - cached.timestamp) < this.requestCacheTTL) {
        res.status(cached.statusCode);
        Object.entries(cached.headers).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
        res.setHeader('X-Cache', 'UNIFIED-HIT');
        res.setHeader('X-Cache-Age', String(now - cached.timestamp));
        return res.json(cached.data);
      }

      // Check if request is already in flight
      const inflight = this.inflightRequests.get(key);
      if (inflight) {
        return new Promise<void>((resolve, reject) => {
          inflight.subscribers.push({ res, resolve });
          
          // Add timeout for waiting requests to prevent hanging
          setTimeout(() => {
            const index = inflight.subscribers.findIndex(sub => sub.res === res);
            if (index !== -1) {
              inflight.subscribers.splice(index, 1);
              reject(new Error('Request deduplication timeout'));
            }
          }, 30000); // 30 second timeout
        });
      }

      // Create new inflight request
      const inflightEntry: InflightRequest = {
        promise: Promise.resolve(),
        subscribers: []
      };
      this.inflightRequests.set(key, inflightEntry);

      // Set up cleanup function that works for all response scenarios
      const cleanup = (statusCode: number, data: any) => {
        // Cache successful responses only
        if (statusCode >= 200 && statusCode < 300) {
          const headers: Record<string, string> = {};
          
          ['content-type', 'etag', 'last-modified'].forEach(header => {
            const value = res.getHeader(header);
            if (value) headers[header] = String(value);
          });

          this.requestCache.set(key, {
            data,
            statusCode,
            timestamp: now,
            headers
          });
        }

        // Notify all waiting subscribers
        const subscribers = inflightEntry.subscribers.slice(); // Copy array
        this.inflightRequests.delete(key);

        subscribers.forEach(({ res: subscriberRes, resolve }) => {
          try {
            subscriberRes.status(statusCode);
            subscriberRes.setHeader('X-Cache', 'UNIFIED-DEDUPE');
            subscriberRes.json(data);
            resolve();
          } catch (error) {
            console.error('Error notifying subscriber:', error);
          }
        });
      };

      // Intercept all possible response methods
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalEnd = res.end.bind(res);
      const originalStatus = res.status.bind(res);
      let statusCode = 200;
      let responseHandled = false;
      
      res.status = function(code: number) {
        statusCode = code;
        return originalStatus(code);
      };

      res.json = (data: any) => {
        if (!responseHandled) {
          responseHandled = true;
          cleanup(statusCode, data);
          res.setHeader('X-Cache', 'UNIFIED-MISS');
        }
        return originalJson(data);
      };

      res.send = (data: any) => {
        if (!responseHandled) {
          responseHandled = true;
          cleanup(statusCode, data);
          res.setHeader('X-Cache', 'UNIFIED-MISS');
        }
        return originalSend(data);
      };

      res.end = (data?: any) => {
        if (!responseHandled) {
          responseHandled = true;
          cleanup(statusCode, data);
          res.setHeader('X-Cache', 'UNIFIED-MISS');
        }
        return originalEnd(data);
      };

      // Handle errors and ensure cleanup always happens
      const originalWrite = res.write.bind(res);
      res.write = function(chunk: any) {
        if (!responseHandled) {
          // If writing starts, we consider response handled to prevent duplicate cleanup
          responseHandled = true;
        }
        return originalWrite(chunk);
      };

      // Cleanup on connection close/error
      req.on('close', () => {
        if (!responseHandled) {
          responseHandled = true;
          this.inflightRequests.delete(key);
        }
      });

      req.on('error', () => {
        if (!responseHandled) {
          responseHandled = true;
          this.inflightRequests.delete(key);
        }
      });

      // Set a safety timeout to prevent memory leaks
      const timeoutId = setTimeout(() => {
        if (!responseHandled) {
          responseHandled = true;
          console.warn(`Request deduplication timeout for ${key}`);
          this.inflightRequests.delete(key);
        }
      }, 60000); // 60 second safety timeout

      // Clear timeout when response finishes
      res.on('finish', () => {
        clearTimeout(timeoutId);
      });

      next();
    };
  }

  // === FINGERPRINT DEDUPLICATION METHODS ===

  static runnersKey(r: Runners): string {
    return `${r.first ? 1 : 0}-${r.second ? 1 : 0}-${r.third ? 1 : 0}`;
  }

  static bucketWind(dir?: string | null, mph?: number | null): 'neutral' | 'out' | 'in' | 'cross' {
    if (!dir || !mph) return 'neutral';
    if (mph < 6) return 'neutral';
    const d = dir.toLowerCase();
    if (d.includes('out')) return 'out';
    if (d.includes('in')) return 'in';
    return 'cross';
  }

  generateFingerprint(alertType: string, frame: FrameLike): string {
    const key = {
      ns: this.namespace,
      a: alertType,
      g: frame.gamePk,
      i: frame.inning,
      h: frame.half,
      o: frame.outs,
      r: UnifiedDeduplicator.runnersKey(frame.runners),
      b: frame.batterId ?? null,
      d: frame.onDeckId ?? null,
      w: frame.windDir ?? 'neutral',
    };
    return `fingerprint:${JSON.stringify(key)}`;
  }

  shouldEmitFingerprint(fingerprint: string, type?: string): boolean {
    const now = Date.now();
    const lifekey = `L:${fingerprint}`;
    const cooldownKey = type ? `C:${type}:${fingerprint}` : null;

    // Per-type cooldown (only for noisy categories)
    if (cooldownKey && this.cooldowns[type!]) {
      const last = this.fingerprintStore.get(cooldownKey)?.at ?? 0;
      if (now - last < this.cooldowns[type!]) {
        return false;
      }
      this.fingerprintStore.set(cooldownKey, { at: now });
    }

    // Situation lifecycle: allow only once per unique situation
    const lastLife = this.fingerprintStore.get(lifekey)?.at ?? 0;
    if (now - lastLife < this.lifecycleTtl) {
      return false;
    }

    this.fingerprintStore.set(lifekey, { at: now });

    // Soft capacity control
    if (this.fingerprintStore.size > this.maxEntries) this.softEvict();

    return true;
  }

  shouldEmitByFrame(alertType: string, frame: FrameLike, typeForCooldown?: string): boolean {
    return this.shouldEmitFingerprint(this.generateFingerprint(alertType, frame), typeForCooldown);
  }

  // === CLEANUP METHODS ===

  private cleanupAlerts(): void {
    const now = Date.now();
    let deleted = 0;

    for (const [key, alert] of Array.from(this.alertCache.entries())) {
      if (now - alert.timestamp > this.alertMaxAge) {
        this.alertCache.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      console.log(`🧹 UNIFIED DEDUP: Cleaned ${deleted} expired alert entries`);
    }
  }

  private cleanupRequests(): void {
    const now = Date.now();
    
    // Clean request cache
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.requestCacheTTL) {
        this.requestCache.delete(key);
      }
    }
    
    // Clean stale inflight requests
    for (const [key, value] of this.inflightRequests.entries()) {
      if (value.subscribers.length === 0) {
        this.inflightRequests.delete(key);
      }
    }
  }

  private sweepFingerprints(): void {
    const now = Date.now();
    const maxCooldown = Math.max(0, ...Object.values(this.cooldowns), 30000);
    
    for (const [k, v] of this.fingerprintStore.entries()) {
      if (k.startsWith('L:')) {
        if (now - v.at > this.lifecycleTtl) this.fingerprintStore.delete(k);
      } else if (k.startsWith('C:')) {
        if (now - v.at > maxCooldown) this.fingerprintStore.delete(k);
      }
    }
  }

  private softEvict(): void {
    const target = Math.floor(this.maxEntries * 0.9);
    const arr = Array.from(this.fingerprintStore.entries()).sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < Math.max(0, this.fingerprintStore.size - target); i++) {
      this.fingerprintStore.delete(arr[i][0]);
    }
  }

  // === UTILITY METHODS ===

  getStats() {
    return {
      alerts: {
        cached: this.alertCache.size,
        oldestAlert: this.alertCache.size > 0 ? 
          Math.min(...Array.from(this.alertCache.values()).map(a => a.timestamp)) : null
      },
      requests: {
        cached: this.requestCache.size,
        inflight: this.inflightRequests.size,
        cacheTTL: this.requestCacheTTL,
        dedupeWindow: this.requestDedupeWindow,
        cacheSize: this.requestCache.size // Add compatibility property
      },
      fingerprints: {
        stored: this.fingerprintStore.size,
        lifecycleTtl: this.lifecycleTtl,
        namespace: this.namespace
      },
      // Legacy compatibility properties
      cacheSize: this.requestCache.size,
      inflightRequests: this.inflightRequests.size,
      alertsCached: this.alertCache.size
    };
  }

  clearCache(type?: 'alerts' | 'requests' | 'fingerprints'): void {
    if (!type || type === 'alerts') {
      this.alertCache.clear();
    }
    if (!type || type === 'requests') {
      this.requestCache.clear();
      this.inflightRequests.clear();
    }
    if (!type || type === 'fingerprints') {
      this.fingerprintStore.clear();
    }
  }

  clearFingerprint(fingerprint: string): void {
    this.fingerprintStore.delete(`L:${fingerprint}`);
  }

  destroy(): void {
    if (this.alertCleanupTimer) clearInterval(this.alertCleanupTimer);
    if (this.requestCleanupTimer) clearInterval(this.requestCleanupTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.clearCache();
  }
}

// === SINGLETON EXPORTS ===

// Create singleton instance for sports alerts
export const unifiedDeduplicator = new UnifiedDeduplicator({
  // Alert settings optimized for sports
  alertCleanupInterval: 30000,
  alertMaxAge: 30000,
  
  // Request settings for API efficiency
  requestCacheTTL: 5000,
  requestDedupeWindow: 100,
  
  // Fingerprint settings for advanced deduplication
  namespace: process.env.NODE_ENV || 'development',
  lifecycleTtlMs: 10 * 60 * 1000, // 10 minutes
  perTypeCooldownMs: {
    weather: 10000,
    windShift: 15000,
    'win-probability': 5000,
  },
  maxEntries: 50000,
});

// Export interfaces for other modules
export type { AlertKey, FrameLike, Runners, UnifiedDedupOptions };