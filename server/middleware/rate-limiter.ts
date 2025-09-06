import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export class EnhancedRateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly MAX_ENTRIES = 10000; // Prevent unlimited memory growth
  
  constructor(private options: RateLimitOptions) {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }
  
  private cleanup(): void {
    const now = Date.now();
    const windowMs = this.options.windowMs;
    let cleaned = 0;
    
    // Remove expired entries
    for (const [key, entry] of Array.from(this.requests.entries())) {
      if (now - entry.lastRequest > windowMs * 2) {
        this.requests.delete(key);
        cleaned++;
      }
    }
    
    // If still too many entries, remove oldest
    if (this.requests.size > this.MAX_ENTRIES) {
      const sortedEntries = Array.from(this.requests.entries())
        .sort((a, b) => a[1].lastRequest - b[1].lastRequest);
      
      const toRemove = sortedEntries.slice(0, sortedEntries.length - this.MAX_ENTRIES);
      toRemove.forEach(([key]) => {
        this.requests.delete(key);
        cleaned++;
      });
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Rate limiter cleanup: removed ${cleaned} entries, current size: ${this.requests.size}`);
    }
  }
  
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.options.keyGenerator ? 
        this.options.keyGenerator(req) : 
        `${req.ip}:${req.path}`;
      
      const now = Date.now();
      let entry = this.requests.get(key);
      
      if (!entry) {
        entry = {
          count: 1,
          firstRequest: now,
          lastRequest: now
        };
        this.requests.set(key, entry);
        return next();
      }
      
      // Check if window has expired
      if (now - entry.firstRequest > this.options.windowMs) {
        // Reset the window
        entry.count = 1;
        entry.firstRequest = now;
        entry.lastRequest = now;
        return next();
      }
      
      // Increment counter
      entry.count++;
      entry.lastRequest = now;
      
      // Check if limit exceeded
      if (entry.count > this.options.maxRequests) {
        const retryAfter = Math.ceil((entry.firstRequest + this.options.windowMs - now) / 1000);
        
        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(entry.firstRequest + this.options.windowMs).toISOString());
        
        if (this.options.onLimitReached) {
          this.options.onLimitReached(req, res);
        } else {
          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
            retryAfter
          });
        }
        return;
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.options.maxRequests - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(entry.firstRequest + this.options.windowMs).toISOString());
      
      next();
    };
  }
  
  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
  
  getStats(): { size: number; oldestEntry: number | null } {
    let oldest: number | null = null;
    const now = Date.now();
    
    for (const entry of Array.from(this.requests.values())) {
      if (oldest === null || entry.firstRequest < oldest) {
        oldest = entry.firstRequest;
      }
    }
    
    return {
      size: this.requests.size,
      oldestEntry: oldest ? now - oldest : null
    };
  }
}

// Pre-configured rate limiters for different endpoints
export const apiRateLimiter = new EnhancedRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  keyGenerator: (req) => `${req.ip}:api`
});

export const authRateLimiter = new EnhancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  keyGenerator: (req) => `${req.ip}:auth:${req.body?.username || 'unknown'}`
});

export const weatherRateLimiter = new EnhancedRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 weather requests per minute
  keyGenerator: (req) => `${req.ip}:weather`
});

export const gamesRateLimiter = new EnhancedRateLimiter({
  windowMs: 30 * 1000, // 30 seconds
  maxRequests: 20, // 20 game requests per 30 seconds
  keyGenerator: (req) => `${req.ip}:games`
});

// Cleanup on process exit
process.on('SIGTERM', () => {
  apiRateLimiter.destroy();
  authRateLimiter.destroy();
  weatherRateLimiter.destroy();
  gamesRateLimiter.destroy();
});