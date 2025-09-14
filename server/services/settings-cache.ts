/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file provides backward compatibility for existing SettingsCache usage.
 * All functionality has been moved to unified-settings.ts and is exported from storage.ts.
 * 
 * The SettingsCache class now extends UnifiedSettings to maintain API compatibility
 * while providing all the enhanced functionality of the unified system.
 */

import { UnifiedSettings } from './unified-settings';
import { unifiedSettings } from '../storage';

// Re-export types for backward compatibility
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

/**
 * SettingsCache - Backward Compatible Wrapper
 * 
 * Extends UnifiedSettings to provide the same API that existing code expects.
 * All methods delegate to the unified settings system while preserving the original interface.
 */
export class SettingsCache extends UnifiedSettings {
  // Constructor maintains the same signature for backward compatibility
  constructor(storageInstance: any) {
    super(storageInstance);
  }

  // Backward compatibility methods that map to the new unified settings API
  
  /**
   * Legacy clearAll() method - maps to invalidateCache() for backward compatibility
   */
  async clearAll(): Promise<void> {
    await this.invalidateCache();
  }

  /**
   * Legacy clearCache() method - maps to invalidateCache() for backward compatibility
   */
  async clearCache(sport?: string): Promise<void> {
    await this.invalidateCache(sport);
  }

  // All other methods are inherited from UnifiedSettings
  // No additional wrapper methods needed - UnifiedSettings provides all functionality
  // while maintaining backward compatibility with the original SettingsCache API
}

// Re-export the unified settings and types for backward compatibility
export { UnifiedSettings } from './unified-settings';
export { unifiedSettings };