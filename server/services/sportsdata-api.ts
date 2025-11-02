
import { protectedFetch, espnApiCircuit } from '../middleware/circuit-breaker';

interface SportsDataTimeoutData {
  GameKey: string;
  HomeTeamTimeoutsRemaining?: number;
  AwayTeamTimeoutsRemaining?: number;
  Quarter?: number;
  TimeRemaining?: string;
}

export class SportsDataApiService {
  private apiKey: string;
  private baseUrls = {
    NFL: 'https://api.sportsdata.io/v3/nfl/scores/json',
    NCAAF: 'https://api.sportsdata.io/v3/cfb/scores/json',
    CFL: 'https://api.sportsdata.io/v3/cfl/scores/json'
  };
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5000; // 5 second cache

  constructor() {
    this.apiKey = process.env.SPORTSDATA_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ SportsData.io API key not configured - timeout data will use ESPN only');
    }
  }

  private getCacheKey(sport: string, gameId: string): string {
    return `${sport}_${gameId}`;
  }

  private getCached(sport: string, gameId: string): any | null {
    const key = this.getCacheKey(sport, gameId);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    
    return null;
  }

  private setCache(sport: string, gameId: string, data: any): void {
    const key = this.getCacheKey(sport, gameId);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getTimeoutData(sport: 'NFL' | 'NCAAF' | 'CFL', gameId: string): Promise<{
    homeTimeoutsRemaining: number | null;
    awayTimeoutsRemaining: number | null;
    quarter: number | null;
    source: 'sportsdata' | 'error';
  }> {
    if (!this.apiKey) {
      return {
        homeTimeoutsRemaining: null,
        awayTimeoutsRemaining: null,
        quarter: null,
        source: 'error'
      };
    }

    // Check cache first
    const cached = this.getCached(sport, gameId);
    if (cached) {
      console.log(`📋 SportsData.io: Using cached timeout data for ${sport} game ${gameId}`);
      return cached;
    }

    try {
      const baseUrl = this.baseUrls[sport];
      const url = `${baseUrl}/GameByGameID/${gameId}?key=${this.apiKey}`;
      
      console.log(`🔄 SportsData.io: Fetching timeout data for ${sport} game ${gameId}`);
      
      const response = await protectedFetch(espnApiCircuit, url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`SportsData.io API error: ${response.status}`);
      }

      const data = await response.json();

      const result = {
        homeTimeoutsRemaining: data.HomeTimeoutsRemaining ?? null,
        awayTimeoutsRemaining: data.AwayTimeoutsRemaining ?? null,
        quarter: data.Quarter ?? null,
        source: 'sportsdata' as const
      };

      // Cache the result
      this.setCache(sport, gameId, result);

      console.log(`✅ SportsData.io: Got timeout data for ${sport} game ${gameId} - Home: ${result.homeTimeoutsRemaining}, Away: ${result.awayTimeoutsRemaining}`);

      return result;
    } catch (error) {
      console.error(`❌ SportsData.io: Error fetching timeout data for ${sport} game ${gameId}:`, error);
      return {
        homeTimeoutsRemaining: null,
        awayTimeoutsRemaining: null,
        quarter: null,
        source: 'error'
      };
    }
  }

  // Get current week's games with timeout data (for batch operations)
  async getCurrentWeekGames(sport: 'NFL' | 'NCAAF' | 'CFL'): Promise<any[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const baseUrl = this.baseUrls[sport];
      const url = `${baseUrl}/ScoresCurrentWeek?key=${this.apiKey}`;
      
      const response = await protectedFetch(espnApiCircuit, url);
      
      if (!response.ok) {
        throw new Error(`SportsData.io API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ SportsData.io: Error fetching current week games for ${sport}:`, error);
      return [];
    }
  }

  // Clear cache for a specific game
  clearCache(sport: string, gameId: string): void {
    const key = this.getCacheKey(sport, gameId);
    this.cache.delete(key);
  }

  // Clear all cache
  clearAllCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let sportsDataApiInstance: SportsDataApiService | null = null;

export function getSportsDataApi(): SportsDataApiService {
  if (!sportsDataApiInstance) {
    sportsDataApiInstance = new SportsDataApiService();
  }
  return sportsDataApiInstance;
}
