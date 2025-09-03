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

export class AlertDeduplication {
  private recentAlerts = new Map<string, CachedAlert>();
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Cleanup old alerts periodically
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  // Build deduplication key with rich context
  buildDedupKey(alert: AlertKey): string {
    const basesHash = [
      alert.bases || '',
      alert.outs || 0,
      alert.inning || 0,
      alert.half || ''
    ].join(':');
    
    return `${alert.gameId}:${alert.type}:${alert.inning}:${alert.half}:${alert.outs}:${basesHash}:${alert.batter}:${alert.paId}`;
  }

  // Check if alert should be sent
  shouldSendAlert(alertKey: AlertKey, tier: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game' = 'plate-appearance'): boolean {
    const key = this.buildDedupKey(alertKey);
    const now = Date.now();
    const cached = this.recentAlerts.get(key);

    // Define timeframes based on tier and type
    const getTimeframe = (type: string, tier: string): { initial: number; realert: number } => {
      switch (type) {
        case 'RISP':
        case 'RUNNERS_1ST_2ND':
          return { initial: 60000, realert: 180000 }; // 1 min / 3 min
        case 'BASES_LOADED':
          return { initial: 90000, realert: 300000 }; // 1.5 min / 5 min
        case 'CLOSE_GAME':
        case 'CLOSE_GAME_LIVE':
          return { initial: 180000, realert: 600000 }; // 3 min / 10 min
        case 'STRIKEOUT':
        case 'FULL_COUNT':
          return { initial: 30000, realert: 120000 }; // 30s / 2 min
        case 'HOME_RUN_LIVE':
          return { initial: 0, realert: 0 }; // Always allow
        default:
          return { initial: 60000, realert: 300000 }; // 1 min / 5 min
      }
    };

    const timeframe = getTimeframe(alertKey.type, tier);

    if (!cached) {
      // First occurrence - allow
      this.recentAlerts.set(key, {
        timestamp: now,
        count: 1,
        tier,
        lastContext: alertKey
      });
      return true;
    }

    const timeSinceFirst = now - cached.timestamp;
    
    // Check if enough time has passed for realert
    if (timeSinceFirst >= timeframe.realert) {
      // Update cache for realert
      this.recentAlerts.set(key, {
        timestamp: now,
        count: cached.count + 1,
        tier,
        lastContext: alertKey
      });
      return true;
    }

    // Within initial timeframe - block
    if (timeSinceFirst < timeframe.initial) {
      return false;
    }

    return false; // Default to blocking
  }

  // Clean up old entries
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 600000; // 10 minutes
    
    for (const [key, alert] of Array.from(this.recentAlerts.entries())) {
      if (now - alert.timestamp > maxAge) {
        this.recentAlerts.delete(key);
      }
    }
  }

  // Get statistics
  getStats() {
    return {
      cachedAlerts: this.recentAlerts.size,
      oldestAlert: Math.min(...Array.from(this.recentAlerts.values()).map(a => a.timestamp))
    };
  }

  // Clear cache (for testing)
  clearCache(): void {
    this.recentAlerts.clear();
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.recentAlerts.clear();
  }
}