// Global Settings Cache Manager - Eliminates database spam
// Caches global alert settings and refreshes intelligently

interface CachedSettings {
  [sport: string]: {
    [alertType: string]: boolean;
  };
}

interface CacheEntry {
  data: CachedSettings[string];
  timestamp: number;
  lastRefresh: number;
}

export class SettingsCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50;
  private storage: any;

  constructor(storageInstance: any) {
    this.storage = storageInstance;
  }

  // Get settings with smart caching
  async getGlobalSettings(sport: string): Promise<Record<string, boolean>> {
    const now = Date.now();
    const cached = this.cache.get(sport);

    // Return cached if fresh
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    // Fetch fresh data
    try {
      const freshData = await this.storage.getGlobalAlertSettings(sport);
      
      // Cache the result
      this.cache.set(sport, {
        data: freshData,
        timestamp: now,
        lastRefresh: now
      });

      // Cleanup old cache entries
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        this.cleanupOldEntries();
      }

      return freshData;
    } catch (error) {
      console.error(`Settings cache error for ${sport}:`, error);
      
      // Return stale cache if available, otherwise empty
      if (cached) {
        console.log(`⚠️ Using stale cache for ${sport} due to error`);
        return cached.data;
      }
      
      // 🔥 CRITICAL FIX: Return fallback defaults for key alert types instead of empty {}
      return this.getDefaultAlertSettings(sport);
    }
  }

  // 🔥 EMERGENCY DEFAULTS - Critical alert modules that should ALWAYS be enabled
  private getDefaultAlertSettings(sport: string): Record<string, boolean> {
    if (sport === 'MLB') {
      return {
        'MLB_GAME_START': true,
        'MLB_SEVENTH_INNING_STRETCH': true,
        'MLB_RUNNER_ON_THIRD_NO_OUTS': true,
        'MLB_FIRST_AND_THIRD_NO_OUTS': true,
        'MLB_SECOND_AND_THIRD_NO_OUTS': true,
        'MLB_FIRST_AND_SECOND': true,
        'MLB_BASES_LOADED_NO_OUTS': true,
        'MLB_RUNNER_ON_THIRD_ONE_OUT': true,
        'MLB_SECOND_AND_THIRD_ONE_OUT': true,
        'MLB_BASES_LOADED_ONE_OUT': true,
        'MLB_BATTER_DUE': true,
        'MLB_STEAL_LIKELIHOOD': true,
        'MLB_ON_DECK_PREDICTION': true,
        'MLB_WIND_CHANGE': true
      };
    }
    // Add defaults for other sports
    return {};
  }

  // Check if specific alert type is enabled (with caching)
  async isAlertEnabled(sport: string, alertType: string): Promise<boolean> {
    // 🔥 FORCE ENABLE OVERRIDE - bypass all caching for emergency recovery
    if (process.env.CHIRPBOT_ALERTS_FORCE_ENABLE === 'true') {
      console.log(`🚨 FORCE ENABLE: ${alertType} (emergency override active)`);
      return true;
    }

    const settings = await this.getGlobalSettings(sport);
    const isEnabled = settings[alertType] !== false; // Default to enabled
    
    // Debug logging for suppressed alerts
    if (!isEnabled) {
      console.log(`❌ Alert suppressed by settings: ${alertType} (${sport})`);
    }
    
    return isEnabled;
  }

  // Pre-filter disabled alert types to skip processing entirely
  async getEnabledAlertTypes(sport: string): Promise<string[]> {
    const settings = await this.getGlobalSettings(sport);
    return Object.keys(settings).filter(type => settings[type] !== false);
  }

  // Force refresh for a specific sport
  async refreshSport(sport: string): Promise<void> {
    this.cache.delete(sport);
    await this.getGlobalSettings(sport);
  }

  // Clear all cache
  clearAll(): void {
    this.cache.clear();
  }

  // Cleanup old entries
  private cleanupOldEntries(): void {
    const now = Date.now();
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 25%
    const toRemove = Math.floor(sortedEntries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(sortedEntries[i][0]);
    }
  }

  // Get cache stats for debugging
  getCacheStats() {
    const now = Date.now();
    const stats = {
      size: this.cache.size,
      entries: [] as any[]
    };

    for (const [sport, entry] of Array.from(this.cache.entries())) {
      stats.entries.push({
        sport,
        age: Math.round((now - entry.timestamp) / 1000) + 's',
        fresh: (now - entry.timestamp) < this.CACHE_DURATION
      });
    }

    return stats;
  }
}