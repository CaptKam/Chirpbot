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

  // Check if alert should be sent - REAL-TIME MODE (no delays)
  shouldSendAlert(alertKey: AlertKey, tier: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game' = 'plate-appearance'): boolean {
    const key = this.buildDedupKey(alertKey);
    const now = Date.now();
    const cached = this.recentAlerts.get(key);

    // For real-time sports alerts, we only prevent EXACT duplicates
    // Different plate appearances, different batters, etc. should always go through

    if (!cached) {
      // First occurrence - always allow
      console.log(`🟢 DEDUP: Allowing first occurrence of ${alertKey.type} for game ${alertKey.gameId}`);
      this.recentAlerts.set(key, {
        timestamp: now,
        count: 1,
        tier,
        lastContext: alertKey
      });
      return true;
    }

    // Check if this is truly the same event (same PA, same context)
    const isDuplicateEvent = (
      cached.lastContext.paId === alertKey.paId &&
      cached.lastContext.batter === alertKey.batter &&
      cached.lastContext.inning === alertKey.inning &&
      cached.lastContext.half === alertKey.half &&
      cached.lastContext.outs === alertKey.outs
    );

    if (!isDuplicateEvent) {
      // Different context - allow immediately
      console.log(`🟢 DEDUP: Allowing ${alertKey.type} - different context (new PA/batter)`);
      this.recentAlerts.set(key, {
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
      console.log(`🔴 DEDUP: Blocking duplicate ${alertKey.type} - same event within 2s`);
      return false;
    }

    // After 2 seconds, even same event is allowed (data might have updated)
    console.log(`🟢 DEDUP: Allowing ${alertKey.type} - same event but >2s later`);
    this.recentAlerts.set(key, {
      timestamp: now,
      count: cached.count + 1,
      tier,
      lastContext: alertKey
    });
    return true;
  }

  // Clean up old entries - more aggressive for real-time
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds only - we want fresh data

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

  // Helper to determine if game state has changed significantly
  private hasSignificantGameStateChange(prevAlertContext: AlertKey, currentAlertKey: AlertKey): boolean {
    if (prevAlertContext.inning !== currentAlertKey.inning || prevAlertContext.half !== currentAlertKey.half) {
      return true; // Inning or half changed
    }
    if (prevAlertContext.outs !== currentAlertKey.outs) {
      return true; // Outs changed
    }
    if (prevAlertContext.bases !== currentAlertKey.bases) {
      return true; // Bases changed
    }
    // Consider score changes if available in context (assuming context has score info)
    // Example: if (prevAlertContext.score !== currentAlertKey.score) return true;
    return false;
  }
}