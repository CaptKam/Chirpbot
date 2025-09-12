import { Request, Response, NextFunction } from 'express';

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

export class RequestDeduplicator {
  private cache = new Map<string, CachedResponse>();
  private inflight = new Map<string, InflightRequest>();
  private readonly cacheTTL: number;
  private readonly dedupeWindow: number;

  constructor(options: { cacheTTL?: number; dedupeWindow?: number } = {}) {
    this.cacheTTL = options.cacheTTL || 5000; // 5 seconds default
    this.dedupeWindow = options.dedupeWindow || 100; // 100ms window for deduplication
    
    // Cleanup old cache entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private getRequestKey(req: Request): string {
    // Create unique key based on method, path, query params, and user session
    const query = JSON.stringify(req.query);
    const userId = (req.session as any)?.userId || 'anonymous';
    return `${req.method}:${req.path}:${query}:${userId}`;
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean cache
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
    
    // Clean stale inflight requests (shouldn't happen normally)
    for (const [key, value] of this.inflight.entries()) {
      if (value.subscribers.length === 0) {
        this.inflight.delete(key);
      }
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only deduplicate GET requests to /api paths
      if (req.method !== 'GET' || !req.path.startsWith('/api/')) {
        return next();
      }

      // Skip deduplication for certain paths that should always be fresh
      const skipPaths = ['/api/auth/', '/api/admin/', '/api/alerts'];
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      const key = this.getRequestKey(req);
      const now = Date.now();

      // Check cache first
      const cached = this.cache.get(key);
      if (cached && (now - cached.timestamp) < this.cacheTTL) {
        // Return cached response
        res.status(cached.statusCode);
        Object.entries(cached.headers).forEach(([name, value]) => {
          res.setHeader(name, value);
        });
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', String(now - cached.timestamp));
        return res.json(cached.data);
      }

      // Check if request is already in flight
      const inflight = this.inflight.get(key);
      if (inflight) {
        // Subscribe to existing request
        return new Promise<void>((resolve) => {
          inflight.subscribers.push({ res, resolve });
        });
      }

      // Create new inflight request
      const inflightEntry: InflightRequest = {
        promise: Promise.resolve(),
        subscribers: []
      };
      this.inflight.set(key, inflightEntry);

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      let statusCode = 200;
      
      res.status = function(code: number) {
        statusCode = code;
        return originalStatus(code);
      };

      res.json = (data: any) => {
        // Cache successful responses only
        if (statusCode >= 200 && statusCode < 300) {
          const headers: Record<string, string> = {};
          
          // Capture important headers
          ['content-type', 'etag', 'last-modified'].forEach(header => {
            const value = res.getHeader(header);
            if (value) headers[header] = String(value);
          });

          this.cache.set(key, {
            data,
            statusCode,
            timestamp: now,
            headers
          });
        }

        // Notify all waiting subscribers
        const subscribers = inflightEntry.subscribers;
        this.inflight.delete(key);

        subscribers.forEach(({ res: subscriberRes, resolve }) => {
          subscriberRes.status(statusCode);
          subscriberRes.setHeader('X-Cache', 'DEDUPE');
          subscriberRes.json(data);
          resolve();
        });

        // Send original response
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    };
  }

  // Get cache statistics for monitoring
  getStats() {
    return {
      cacheSize: this.cache.size,
      inflightRequests: this.inflight.size,
      cacheTTL: this.cacheTTL,
      dedupeWindow: this.dedupeWindow
    };
  }

  // Clear cache manually if needed
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
export const requestDeduplicator = new RequestDeduplicator({
  cacheTTL: 5000,  // Cache for 5 seconds
  dedupeWindow: 100 // Dedupe requests within 100ms
});