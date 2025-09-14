// BACKUP: Original settings-cache.ts before unified settings consolidation
// This file is preserved for reference during the consolidation process

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

  // ... rest of original implementation preserved for reference
}