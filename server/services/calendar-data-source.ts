/**
 * ChirpBot V3 Calendar Data Source
 * Slim data fetching layer with no state management
 * 
 * Responsibilities:
 * - Fetch game data from sport API services
 * - Provide simple pull API (fetchGameData, fetchBatchGameData, fetchTodayGames)
 * - Maintain lightweight caching for performance
 * - No state transitions, no decision making - pure data provider
 */

import type { ICalendarDataSource } from './game-lifecycle-service';
import type { BaseGameData } from './base-sport-api';
import { MLBApiService } from './mlb-api';
import { NFLApiService } from './nfl-api';
import { NCAAFApiService } from './ncaaf-api';
import { WNBAApiService } from './wnba-api';
import { CFLApiService } from './cfl-api';
import { NBAApiService } from './nba-api';

// === CONFIGURATION ===

interface CacheEntry {
  data: BaseGameData;
  fetchedAt: Date;
  expiresAt: Date;
}

interface CalendarDataSourceConfig {
  cacheTtlMs: number;
  enableCache: boolean;
}

// === CALENDAR DATA SOURCE ===

export class CalendarDataSource implements ICalendarDataSource {
  private readonly apiServices: Map<string, any> = new Map();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly config: CalendarDataSourceConfig;
  
  constructor(config: Partial<CalendarDataSourceConfig> = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? 30_000, // 30 seconds default
      enableCache: config.enableCache ?? true,
    };
    
    this.initializeApiServices();
    console.log('📡 CalendarDataSource: Initialized');
  }
  
  // === INITIALIZATION ===
  
  private initializeApiServices(): void {
    this.apiServices.set('MLB', new MLBApiService());
    this.apiServices.set('NFL', new NFLApiService());
    this.apiServices.set('NCAAF', new NCAAFApiService());
    this.apiServices.set('NBA', new NBAApiService());
    this.apiServices.set('WNBA', new WNBAApiService());
    this.apiServices.set('CFL', new CFLApiService());
    
    console.log('📡 CalendarDataSource: API services initialized for MLB, NFL, NCAAF, NBA, WNBA, CFL');
  }
  
  // === CACHE MANAGEMENT ===
  
  private getCacheKey(gameId: string, sport: string): string {
    return `${sport.toUpperCase()}:${gameId}`;
  }
  
  private getFromCache(gameId: string, sport: string): BaseGameData | null {
    if (!this.config.enableCache) return null;
    
    const key = this.getCacheKey(gameId, sport);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private setCache(gameId: string, sport: string, data: BaseGameData): void {
    if (!this.config.enableCache) return;
    
    const key = this.getCacheKey(gameId, sport);
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      fetchedAt: new Date(),
      expiresAt: new Date(now + this.config.cacheTtlMs),
    });
  }
  
  private invalidateCache(gameId: string, sport: string): void {
    const key = this.getCacheKey(gameId, sport);
    this.cache.delete(key);
  }
  
  // === PUBLIC API ===
  
  async fetchGameData(gameId: string, sport: string): Promise<BaseGameData> {
    // Check cache first
    const cached = this.getFromCache(gameId, sport);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    const sportUpper = sport.toUpperCase();
    const apiService = this.apiServices.get(sportUpper);
    
    if (!apiService) {
      throw new Error(`No API service found for sport: ${sport}`);
    }
    
    try {
      const gameData = await apiService.fetchGameById(gameId);
      
      // Cache the result
      this.setCache(gameId, sport, gameData);
      
      return gameData;
    } catch (error) {
      console.error(`❌ CalendarDataSource: Failed to fetch game ${gameId} (${sport}):`, error);
      throw error;
    }
  }
  
  async fetchBatchGameData(gameIds: string[], sport: string): Promise<BaseGameData[]> {
    const sportUpper = sport.toUpperCase();
    const apiService = this.apiServices.get(sportUpper);
    
    if (!apiService) {
      throw new Error(`No API service found for sport: ${sport}`);
    }
    
    // Try to fulfill from cache first
    const results: BaseGameData[] = [];
    const uncachedIds: string[] = [];
    
    for (const gameId of gameIds) {
      const cached = this.getFromCache(gameId, sport);
      if (cached) {
        results.push(cached);
      } else {
        uncachedIds.push(gameId);
      }
    }
    
    // Fetch uncached games
    if (uncachedIds.length > 0) {
      try {
        // Check if API supports batch fetching
        if (apiService.fetchBatchGames) {
          const batchData = await apiService.fetchBatchGames(uncachedIds);
          for (const gameData of batchData) {
            this.setCache(gameData.gameId, sport, gameData);
            results.push(gameData);
          }
        } else {
          // Fall back to individual fetches
          const promises = uncachedIds.map(id => this.fetchGameData(id, sport));
          const fetchedData = await Promise.allSettled(promises);
          
          for (const result of fetchedData) {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            }
          }
        }
      } catch (error) {
        console.error(`❌ CalendarDataSource: Failed to fetch batch games for ${sport}:`, error);
      }
    }
    
    return results;
  }
  
  async fetchTodayGames(sport: string): Promise<BaseGameData[]> {
    const sportUpper = sport.toUpperCase();
    const apiService = this.apiServices.get(sportUpper);
    
    if (!apiService) {
      throw new Error(`No API service found for sport: ${sport}`);
    }
    
    try {
      const games = await apiService.fetchTodayGames();
      
      // Cache all games
      for (const game of games) {
        this.setCache(game.gameId, sport, game);
      }
      
      return games;
    } catch (error) {
      console.error(`❌ CalendarDataSource: Failed to fetch today's ${sport} games:`, error);
      throw error;
    }
  }
  
  // === CACHE CONTROL ===
  
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 CalendarDataSource: Cache cleared');
  }
  
  clearCacheForGame(gameId: string, sport: string): void {
    this.invalidateCache(gameId, sport);
  }
  
  clearCacheForSport(sport: string): void {
    const sportUpper = sport.toUpperCase();
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sportUpper}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    console.log(`🧹 CalendarDataSource: Cache cleared for ${sport} (${keysToDelete.length} entries)`);
  }
  
  // === METRICS ===
  
  getMetrics() {
    return {
      cacheSize: this.cache.size,
      cacheEnabled: this.config.enableCache,
      cacheTtlMs: this.config.cacheTtlMs,
      apiServices: Array.from(this.apiServices.keys()),
    };
  }
}
