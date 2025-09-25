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
  // Enhanced context fields for better deduplication
  homeScore?: number;
  awayScore?: number;
  quarter?: number;
  timeRemaining?: string;
  fieldPosition?: string;
  possession?: string;
  timestamp?: number;
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
    // Alert dedup settings - Increased to 2 minutes for better coverage
    this.alertCleanupInterval = options.alertCleanupInterval || 60000; // Check every minute
    this.alertMaxAge = options.alertMaxAge || 120000; // 2 minutes window
    
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
    // Build a more specific key including scores and time context
    const contextParts = [
      alert.gameId,
      alert.type,
      alert.inning || alert.quarter || 0,
      alert.half || '',
      alert.outs || 0,
      alert.bases || '',
      alert.batter || '',
      alert.paId || '',
      // Add score context to detect score changes
      alert.homeScore !== undefined ? `h${alert.homeScore}` : '',
      alert.awayScore !== undefined ? `a${alert.awayScore}` : '',
      // Add time context for time-sensitive sports
      alert.timeRemaining || '',
      alert.fieldPosition || '',
      alert.possession || ''
    ].filter(p => p !== ''); // Remove empty parts

    const key = `alert:${contextParts.join(':')}`;
    
    // Debug log the key generation
    console.log(`🔑 DEDUP KEY: ${key}`);
    
    return key;
  }

  shouldSendAlert(
    alertKey: AlertKey, 
    tier: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game' = 'plate-appearance'
  ): boolean {
    const key = this.buildAlertDedupKey(alertKey);
    const now = Date.now();
    const cached = this.alertCache.get(key);

    // First occurrence - always allow
    if (!cached) {
      console.log(`✅ DEDUP: First occurrence of ${alertKey.type} for game ${alertKey.gameId}`);
      console.log(`   📊 Context: Score ${alertKey.homeScore || 0}-${alertKey.awayScore || 0}, Inning/Q ${alertKey.inning || alertKey.quarter || 0}`);
      this.alertCache.set(key, {
        timestamp: now,
        count: 1,
        tier,
        lastContext: { ...alertKey, timestamp: now }
      });
      return true;
    }

    // Calculate time since last alert
    const timeSinceFirst = now - cached.timestamp;
    const minutesSince = Math.floor(timeSinceFirst / 60000);
    const secondsSince = Math.floor((timeSinceFirst % 60000) / 1000);

    // Enhanced duplicate detection with multiple checks
    const isSameGameState = (
      cached.lastContext.paId === alertKey.paId &&
      cached.lastContext.batter === alertKey.batter &&
      cached.lastContext.inning === alertKey.inning &&
      cached.lastContext.quarter === alertKey.quarter &&
      cached.lastContext.half === alertKey.half &&
      cached.lastContext.outs === alertKey.outs &&
      cached.lastContext.bases === alertKey.bases &&
      cached.lastContext.homeScore === alertKey.homeScore &&
      cached.lastContext.awayScore === alertKey.awayScore &&
      cached.lastContext.timeRemaining === alertKey.timeRemaining
    );

    // Block if exact same game state within 30 seconds
    if (isSameGameState && timeSinceFirst < 30000) {
      console.log(`🚫 DEDUP: Blocking duplicate ${alertKey.type} - exact same game state`);
      console.log(`   ⏱️  Time since last: ${secondsSince}s`);
      console.log(`   📊 Duplicate count: ${cached.count + 1} for this key`);
      return false;
    }

    // Check if significant context has changed
    const hasScoreChanged = (
      cached.lastContext.homeScore !== alertKey.homeScore ||
      cached.lastContext.awayScore !== alertKey.awayScore
    );
    
    const hasTimeChanged = (
      cached.lastContext.timeRemaining !== alertKey.timeRemaining &&
      alertKey.timeRemaining // Only if time is actually provided
    );
    
    const hasInningChanged = (
      cached.lastContext.inning !== alertKey.inning ||
      cached.lastContext.quarter !== alertKey.quarter ||
      cached.lastContext.half !== alertKey.half
    );

    // Allow if significant change occurred
    if (hasScoreChanged || hasInningChanged) {
      console.log(`✅ DEDUP: Allowing ${alertKey.type} - significant change detected`);
      console.log(`   📊 Score changed: ${hasScoreChanged}, Inning changed: ${hasInningChanged}`);
      console.log(`   ⏱️  Time since last: ${minutesSince}m ${secondsSince}s`);
      
      // Update cache with new context
      this.alertCache.set(key, {
        timestamp: now,
        count: cached.count + 1,
        tier,
        lastContext: { ...alertKey, timestamp: now }
      });
      return true;
    }

    // For time-sensitive alerts, allow if enough time has passed
    const minTimeBetweenAlerts = this.getMinTimeBetweenAlerts(alertKey.type, tier);
    if (timeSinceFirst >= minTimeBetweenAlerts) {
      console.log(`✅ DEDUP: Allowing ${alertKey.type} - sufficient time passed`);
      console.log(`   ⏱️  Time since last: ${minutesSince}m ${secondsSince}s (min: ${minTimeBetweenAlerts / 1000}s)`);
      
      this.alertCache.set(key, {
        timestamp: now,
        count: cached.count + 1,
        tier,
        lastContext: { ...alertKey, timestamp: now }
      });
      return true;
    }

    // Default: Block the duplicate
    console.log(`🚫 DEDUP: Blocking ${alertKey.type} - too soon since last alert`);
    console.log(`   ⏱️  Time since last: ${minutesSince}m ${secondsSince}s`);
    console.log(`   📊 Total duplicates blocked: ${cached.count}`);
    return false;
  }

  // Helper method to determine minimum time between alerts based on type
  private getMinTimeBetweenAlerts(alertType: string, tier: string): number {
    // Weather alerts need longer gaps
    if (alertType.toLowerCase().includes('weather') || alertType.toLowerCase().includes('wind')) {
      return 60000; // 1 minute for weather changes
    }
    
    // Game start/end events
    if (alertType.toLowerCase().includes('start') || alertType.toLowerCase().includes('final')) {
      return 120000; // 2 minutes for game phase changes
    }
    
    // Critical moments need shorter gaps
    if (alertType.toLowerCase().includes('red_zone') || alertType.toLowerCase().includes('two_minute')) {
      return 15000; // 15 seconds for critical situations
    }
    
    // Default based on tier
    switch (tier) {
      case 'plate-appearance':
        return 10000; // 10 seconds
      case 'half-inning':
        return 30000; // 30 seconds
      case 'full-inning':
        return 60000; // 1 minute
      case 'game':
        return 120000; // 2 minutes
      default:
        return 20000; // 20 seconds default
    }
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

      // Skip deduplication for paths that should always be fresh (especially user preferences)
      const skipPaths = [
        '/api/auth/', 
        '/api/admin/', 
        '/api/alerts/live',
        '/api/user/',           // CRITICAL: All user endpoints must be fresh
        '/api/global-alert-settings/', // Settings must be fresh
        '/api/environment-status'      // Diagnostics must be fresh
      ];
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
    let kept = 0;

    // More aggressive cleanup - remove old entries
    for (const [key, alert] of Array.from(this.alertCache.entries())) {
      const age = now - alert.timestamp;
      
      // Remove entries older than the max age (2 minutes)
      if (age > this.alertMaxAge) {
        this.alertCache.delete(key);
        deleted++;
      } else {
        kept++;
      }
    }
    
    // Log cleanup results
    if (deleted > 0 || kept > 10) {
      console.log(`🧹 DEDUP CLEANUP: Removed ${deleted} expired entries, kept ${kept} active`);
      
      // If cache is getting large, be more aggressive
      if (kept > 100) {
        console.log(`⚠️  DEDUP: Cache size large (${kept}), consider reducing alert frequency`);
        // Remove oldest 25% of entries if cache is too large
        const entries = Array.from(this.alertCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = Math.floor(entries.length * 0.25);
        
        for (let i = 0; i < toRemove; i++) {
          this.alertCache.delete(entries[i][0]);
          deleted++;
        }
        
        if (toRemove > 0) {
          console.log(`🧹 DEDUP: Aggressively cleaned ${toRemove} oldest entries`);
        }
      }
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
  // Alert settings optimized for sports - 2 minute window
  alertCleanupInterval: 60000, // Cleanup every minute
  alertMaxAge: 120000, // Keep alerts for 2 minutes
  
  // Request settings for API efficiency
  requestCacheTTL: 5000,
  requestDedupeWindow: 100,
  
  // Fingerprint settings for advanced deduplication - use consistent namespace
  namespace: 'chirpbot-alerts', // Fixed namespace to ensure consistency across environments
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