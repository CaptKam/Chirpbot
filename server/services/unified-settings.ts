/**
 * Unified Settings Management System
 * 
 * Consolidates all scattered database preference queries into a single, cached system.
 * Extends the existing settings-cache.ts functionality with comprehensive settings operations.
 * 
 * Features:
 * - Smart caching with 5-minute TTL
 * - Emergency fallbacks and defaults
 * - Force override capabilities
 * - Diagnostics and admin operations
 * - Route-level settings support
 * - Backward compatibility
 */

import { db } from '../db';
import { sql, eq, and, count } from 'drizzle-orm';
import { globalAlertSettings, settings } from '../../shared/schema';

// ===================================
// INTERFACES AND TYPES
// ===================================

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

interface SettingsStats {
  totalCount: number;
  enabledCount: number;
  sportBreakdown: Record<string, { total: number; enabled: number }>;
}

interface DiagnosticsResult {
  settingsCount: number;
  globalAlertSettingsCount: number;
  userAlertPreferencesCount: number;
  enabledGlobalAlerts: number;
}

// ===================================
// UNIFIED SETTINGS CLASS
// ===================================

export class UnifiedSettings {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50;
  private storage: any;

  // Performance tracking
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: 0,
    cacheEvictions: 0,
    settingsRequests: 0
  };

  constructor(storageInstance: any) {
    this.storage = storageInstance;
  }

  // Initialize storage for singleton pattern
  initializeStorage(storageInstance: any) {
    this.storage = storageInstance;
  }

  // ===================================
  // CORE SETTINGS METHODS (Enhanced)
  // ===================================

  /**
   * Get settings with smart caching - Enhanced from original SettingsCache
   * 🔧 CACHE FIX: Normalize sport keys to lowercase for consistency
   */
  async getGlobalSettings(sport: string): Promise<Record<string, boolean>> {
    // 🔧 CACHE FIX: Normalize sport to lowercase for consistent cache keys
    const canonicalSport = sport.toLowerCase();
    const now = Date.now();
    const cached = this.cache.get(canonicalSport);
    
    this.metrics.settingsRequests++;

    // Return cached if fresh
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      this.metrics.cacheHits++;
      return cached.data;
    }

    this.metrics.cacheMisses++;
    this.metrics.databaseQueries++;

    // Fetch fresh data
    try {
      const freshData = await this.storage.getGlobalAlertSettings(canonicalSport);
      
      // 🔧 CACHE FIX: Cache with normalized key
      this.cache.set(canonicalSport, {
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
      console.error(`Unified Settings cache error for ${canonicalSport}:`, error);
      
      // Return stale cache if available, otherwise emergency defaults
      if (cached) {
        console.log(`⚠️ Using stale cache for ${canonicalSport} due to error`);
        return cached.data;
      }
      
      // CRITICAL FIX: Return fallback defaults for key alert types instead of empty {}
      return this.getDefaultAlertSettings(canonicalSport);
    }
  }

  /**
   * Check if specific alert type is enabled (with caching)
   * 🔧 CACHE FIX: Sport normalization handled in getGlobalSettings
   */
  async isAlertEnabled(sport: string, alertType: string): Promise<boolean> {
    // FORCE ENABLE OVERRIDE - bypass all caching for emergency recovery
    if (process.env.CHIRPBOT_ALERTS_FORCE_ENABLE === 'true') {
      console.log(`🚨 FORCE ENABLE: ${alertType} (emergency override active)`);
      return true;
    }

    const settings = await this.getGlobalSettings(sport);
    const isEnabled = settings[alertType] !== false; // Default to enabled
    
    // Debug logging for suppressed alerts
    if (!isEnabled) {
      console.log(`❌ Alert suppressed by settings: ${alertType} (${sport.toLowerCase()})`);
    }
    
    return isEnabled;
  }

  /**
   * Pre-filter disabled alert types to skip processing entirely
   */
  async getEnabledAlertTypes(sport: string): Promise<string[]> {
    const settings = await this.getGlobalSettings(sport);
    return Object.entries(settings)
      .filter(([_, enabled]) => enabled !== false)
      .map(([alertType, _]) => alertType);
  }

  // ===================================
  // NEW: ROUTE-LEVEL SETTINGS SUPPORT
  // ===================================

  /**
   * Get settings formatted for API routes
   */
  async getSettingsForRoute(sport: string): Promise<any> {
    const settings = await this.getGlobalSettings(sport);
    
    // Convert to frontend-expected format with metadata
    return {
      sport: sport.toUpperCase(),
      settings,
      enabledCount: Object.values(settings).filter(enabled => enabled).length,
      totalCount: Object.keys(settings).length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Bulk get settings for multiple sports (optimized for routes)
   */
  async bulkGetSettings(sports: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    // Use Promise.all for parallel fetching
    const settingsPromises = sports.map(async (sport) => {
      const settings = await this.getGlobalSettings(sport);
      return { sport, settings };
    });

    const allSettings = await Promise.all(settingsPromises);
    
    for (const { sport, settings } of allSettings) {
      results[sport] = {
        settings,
        enabledCount: Object.values(settings).filter(enabled => enabled).length,
        totalCount: Object.keys(settings).length
      };
    }

    return results;
  }

  // ===================================
  // NEW: DIAGNOSTICS METHODS
  // ===================================

  /**
   * Get comprehensive settings statistics for diagnostics
   */
  async getSettingsStats(): Promise<SettingsStats> {
    try {
      // Get global alert settings count
      const globalResult = await db.execute(sql`SELECT COUNT(*) as count FROM global_alert_settings`);
      const globalCount = parseInt(String(globalResult.rows[0]?.count || '0'));

      // Get enabled global alerts count
      const enabledResult = await db.execute(sql`SELECT COUNT(*) as count FROM global_alert_settings WHERE enabled = true`);
      const enabledCount = parseInt(String(enabledResult.rows[0]?.count || '0'));

      // Get sport breakdown
      const sportBreakdownResult = await db.execute(sql`
        SELECT 
          sport,
          COUNT(*) as total,
          SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled
        FROM global_alert_settings 
        GROUP BY sport
      `);

      const sportBreakdown: Record<string, { total: number; enabled: number }> = {};
      for (const row of sportBreakdownResult.rows) {
        const sport = String(row.sport);
        sportBreakdown[sport] = {
          total: parseInt(String(row.total)),
          enabled: parseInt(String(row.enabled))
        };
      }

      return {
        totalCount: globalCount,
        enabledCount: enabledCount,
        sportBreakdown
      };
    } catch (error) {
      console.error('Error getting settings stats:', error);
      return {
        totalCount: 0,
        enabledCount: 0,
        sportBreakdown: {}
      };
    }
  }

  /**
   * Get settings count by sport for diagnostics
   */
  async getSettingsCountBySport(): Promise<Record<string, number>> {
    try {
      const result = await db.execute(sql`
        SELECT sport, COUNT(*) as count 
        FROM global_alert_settings 
        GROUP BY sport
      `);

      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[String(row.sport)] = parseInt(String(row.count));
      }

      return counts;
    } catch (error) {
      console.error('Error getting settings count by sport:', error);
      return {};
    }
  }

  /**
   * Get comprehensive diagnostics data used by unified-diagnostics.ts
   */
  async getDiagnosticsData(): Promise<DiagnosticsResult> {
    try {
      // Settings table count
      const settingsResult = await db.execute(sql`SELECT COUNT(*) as count FROM settings`);
      const settingsCount = parseInt(String(settingsResult.rows[0]?.count || '0'));

      // Global alert settings count
      const globalResult = await db.execute(sql`SELECT COUNT(*) as count FROM global_alert_settings`);
      const globalAlertSettingsCount = parseInt(String(globalResult.rows[0]?.count || '0'));

      // User alert preferences count
      const userPrefsResult = await db.execute(sql`SELECT COUNT(*) as count FROM user_alert_preferences`);
      const userAlertPreferencesCount = parseInt(String(userPrefsResult.rows[0]?.count || '0'));

      // Enabled global alerts count
      const enabledResult = await db.execute(sql`SELECT COUNT(*) as count FROM global_alert_settings WHERE enabled = true`);
      const enabledGlobalAlerts = parseInt(String(enabledResult.rows[0]?.count || '0'));

      return {
        settingsCount,
        globalAlertSettingsCount,
        userAlertPreferencesCount,
        enabledGlobalAlerts
      };
    } catch (error) {
      console.error('Error getting diagnostics data:', error);
      return {
        settingsCount: 0,
        globalAlertSettingsCount: 0,
        userAlertPreferencesCount: 0,
        enabledGlobalAlerts: 0
      };
    }
  }

  // ===================================
  // NEW: ADMIN OPERATIONS
  // ===================================

  /**
   * Bulk enable multiple alert types for a sport
   * 🔧 CACHE FIX: Use consistent lowercase normalization
   */
  async bulkEnableAlerts(sport: string, alertTypes: string[]): Promise<void> {
    try {
      // 🔧 CACHE FIX: Normalize sport consistently
      const canonicalSport = sport.toLowerCase();
      
      for (const alertType of alertTypes) {
        await db.execute(sql`
          INSERT INTO global_alert_settings (sport, alert_type, enabled) 
          VALUES (${canonicalSport}, ${alertType}, true)
          ON CONFLICT (sport, alert_type) 
          DO UPDATE SET enabled = true, updated_at = NOW()
        `);
      }

      // 🔧 CACHE FIX: Invalidate cache using proper method
      await this.invalidateCache(canonicalSport);
      console.log(`✅ Bulk enabled ${alertTypes.length} alerts for ${canonicalSport}`);
    } catch (error) {
      console.error(`Error bulk enabling alerts for ${sport}:`, error);
      throw error;
    }
  }

  /**
   * Bulk disable multiple alert types for a sport
   * 🔧 CACHE FIX: Use consistent lowercase normalization
   */
  async bulkDisableAlerts(sport: string, alertTypes: string[]): Promise<void> {
    try {
      // 🔧 CACHE FIX: Normalize sport consistently
      const canonicalSport = sport.toLowerCase();
      
      for (const alertType of alertTypes) {
        await db.execute(sql`
          INSERT INTO global_alert_settings (sport, alert_type, enabled) 
          VALUES (${canonicalSport}, ${alertType}, false)
          ON CONFLICT (sport, alert_type) 
          DO UPDATE SET enabled = false, updated_at = NOW()
        `);
      }

      // 🔧 CACHE FIX: Invalidate cache using proper method
      await this.invalidateCache(canonicalSport);
      console.log(`❌ Bulk disabled ${alertTypes.length} alerts for ${canonicalSport}`);
    } catch (error) {
      const canonicalSport = sport.toLowerCase();
      console.error(`Error bulk disabling alerts for ${canonicalSport}:`, error);
      throw error;
    }
  }

  /**
   * Reset sport settings to defaults
   * 🔧 CACHE FIX: Use consistent lowercase normalization
   */
  async resetToDefaults(sport: string): Promise<void> {
    try {
      // 🔧 CACHE FIX: Normalize sport consistently
      const canonicalSport = sport.toLowerCase();
      
      // Clear existing settings for sport
      await db.execute(sql`DELETE FROM global_alert_settings WHERE sport = ${canonicalSport}`);

      // Get default settings and insert them
      const defaults = this.getDefaultAlertSettings(canonicalSport);
      for (const [alertType, enabled] of Object.entries(defaults)) {
        await db.execute(sql`
          INSERT INTO global_alert_settings (sport, alert_type, enabled) 
          VALUES (${canonicalSport}, ${alertType}, ${enabled})
        `);
      }

      // 🔧 CACHE FIX: Invalidate cache using proper method
      await this.invalidateCache(canonicalSport);
      console.log(`🔄 Reset ${canonicalSport} settings to defaults`);
    } catch (error) {
      const canonicalSport = sport.toLowerCase();
      console.error(`Error resetting ${canonicalSport} to defaults:`, error);
      throw error;
    }
  }

  // ===================================
  // NEW: CACHE MANAGEMENT
  // ===================================

  /**
   * Invalidate cache for specific sport or all sports
   * 🔧 CACHE FIX: Normalize sport and clear both canonical and legacy variants
   */
  async invalidateCache(sport?: string): Promise<void> {
    if (sport) {
      // 🔧 CACHE FIX: Normalize to lowercase and clear both variants
      const canonicalSport = sport.toLowerCase();
      const legacySport = sport.toUpperCase();
      
      // Clear canonical (lowercase) key
      const canonicalDeleted = this.cache.delete(canonicalSport);
      
      // Clear legacy (uppercase) key if it exists
      const legacyDeleted = this.cache.delete(legacySport);
      
      // Clear original key if different from both
      const originalDeleted = (sport !== canonicalSport && sport !== legacySport) 
        ? this.cache.delete(sport) 
        : false;
      
      console.log(`🗑️ Cache invalidated for ${canonicalSport} (canonical: ${canonicalDeleted}, legacy: ${legacyDeleted}, original: ${originalDeleted})`);
    } else {
      this.cache.clear();
      console.log(`🗑️ All settings cache cleared`);
    }
  }

  /**
   * Warm cache for multiple sports
   */
  async warmCache(sports: string[]): Promise<void> {
    console.log(`🔥 Warming settings cache for ${sports.length} sports...`);
    
    const warmPromises = sports.map(sport => this.getGlobalSettings(sport));
    await Promise.all(warmPromises);
    
    console.log(`✅ Settings cache warmed for: ${sports.join(', ')}`);
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: this.metrics.settingsRequests > 0 
        ? (this.metrics.cacheHits / this.metrics.settingsRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // ===================================
  // PRIVATE HELPER METHODS
  // ===================================

  /**
   * EMERGENCY DEFAULTS - Critical alert modules that should ALWAYS be enabled
   * 🔧 CACHE FIX: Normalize sport input to lowercase
   */
  private getDefaultAlertSettings(sport: string): Record<string, boolean> {
    const canonicalSport = sport.toLowerCase();
    
    if (canonicalSport === 'mlb') {
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
    } else if (canonicalSport === 'nfl') {
      return {
        'NFL_GAME_START': true,
        'NFL_RED_ZONE': true,
        'NFL_FOURTH_DOWN': true,
        'NFL_TWO_MINUTE_WARNING': true,
        'NFL_MASSIVE_WEATHER': true,
        'NFL_TURNOVER_LIKELIHOOD': true,
        'NFL_RED_ZONE_OPPORTUNITY': true,
        'NFL_SECOND_HALF_KICKOFF': true
      };
    } else if (canonicalSport === 'nba') {
      return {
        'NBA_GAME_START': true,
        'NBA_FOURTH_QUARTER': true,
        'NBA_OVERTIME': true,
        'NBA_CLUTCH_PERFORMANCE': true,
        'NBA_FINAL_MINUTES': true,
        'NBA_TWO_MINUTE_WARNING': true,
        'NBA_CHAMPIONSHIP_IMPLICATIONS': true,
        'NBA_PLAYOFF_INTENSITY': true,
        'NBA_SUPERSTAR_ANALYTICS': true
      };
    } else if (canonicalSport === 'ncaaf') {
      return {
        'NCAAF_GAME_START': true,
        'NCAAF_TWO_MINUTE_WARNING': true,
        'NCAAF_RED_ZONE': true,
        'NCAAF_FOURTH_DOWN_DECISION': true,
        'NCAAF_UPSET_OPPORTUNITY': true,
        'NCAAF_RED_ZONE_EFFICIENCY': true,
        'NCAAF_COMEBACK_POTENTIAL': true,
        'NCAAF_SECOND_HALF_KICKOFF': true,
        'NCAAF_MASSIVE_WEATHER': true
      };
    } else if (canonicalSport === 'wnba') {
      return {
        'WNBA_GAME_START': true,
        'WNBA_FOURTH_QUARTER': true,
        'WNBA_FINAL_MINUTES': true,
        'WNBA_CLUTCH_TIME_OPPORTUNITY': true,
        'WNBA_COMEBACK_POTENTIAL': true,
        'WNBA_TWO_MINUTE_WARNING': true,
        'WNBA_WNBA_CHAMPIONSHIP_IMPLICATIONS': true,
        'WNBA_HIGH_SCORING_QUARTER': true,
        'WNBA_LOW_SCORING_QUARTER': true,
        'WNBA_CRUNCH_TIME_DEFENSE': true
      };
    } else if (canonicalSport === 'cfl') {
      return {
        'CFL_GAME_START': true,
        'CFL_FOURTH_QUARTER': true,
        'CFL_FINAL_MINUTES': true,
        'CFL_OVERTIME': true,
        'CFL_TWO_MINUTE_WARNING': true,
        'CFL_GREY_CUP_IMPLICATIONS': true,
        'CFL_ROUGE_OPPORTUNITY': true,
        'CFL_THIRD_DOWN_SITUATION': true,
        'CFL_SECOND_HALF_KICKOFF': true,
        'CFL_MASSIVE_WEATHER': true
      };
    }
    
    // Default fallback for unknown sports
    return {};
  }

  /**
   * Cleanup old cache entries to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const cutoffTime = now - (this.CACHE_DURATION * 2); // Remove entries older than 2x cache duration
    
    for (const [sport, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.cache.delete(sport);
        this.metrics.cacheEvictions++;
      }
    }
  }
}

// ===================================
// SINGLETON INSTANCE
// ===================================

// Import storage here to avoid circular dependencies
let unifiedSettingsInstance: UnifiedSettings | null = null;

export function getUnifiedSettings(): UnifiedSettings {
  if (!unifiedSettingsInstance) {
    // Import storage dynamically to avoid circular dependency
    // We'll initialize this from the storage module directly when needed
    unifiedSettingsInstance = new UnifiedSettings(null);
  }
  return unifiedSettingsInstance;
}

// The singleton instance will be exported from storage.ts to avoid circular dependencies