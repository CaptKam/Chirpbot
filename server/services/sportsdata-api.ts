
import { fetchJson } from './http';
import type { Game } from '@shared/schema';

// SportsData.io API Interfaces
interface SportsDataTeam {
  TeamID: number;
  Key: string;
  Active: boolean;
  City: string;
  Name: string;
  StadiumID?: number;
  Conference?: string;
  Division?: string;
  PrimaryColor?: string;
  SecondaryColor?: string;
  TertiaryColor?: string;
  QuaternaryColor?: string;
}

interface SportsDataScore {
  GameID: number;
  Season: number;
  SeasonType: number;
  Status: string;
  Day: string;
  DateTime: string;
  AwayTeam: string;
  HomeTeam: string;
  AwayTeamID: number;
  HomeTeamID: number;
  StadiumID?: number;
  Channel?: string;
  Attendance?: number;
  AwayTeamScore?: number;
  HomeTeamScore?: number;
  Updated: string;
  Quarter?: string;
  TimeRemainingMinutes?: number;
  TimeRemainingSeconds?: number;
  PointSpread?: number;
  OverUnder?: number;
  AwayTeamMoneyLine?: number;
  HomeTeamMoneyLine?: number;
  GlobalGameID: number;
  GlobalAwayTeamID: number;
  GlobalHomeTeamID: number;
  PointSpreadAwayTeamMoneyLine?: number;
  PointSpreadHomeTeamMoneyLine?: number;
  LastPlay?: string;
  IsClosed: boolean;
  GameEndDateTime?: string;
  HomeRotationNumber?: number;
  AwayRotationNumber?: number;
  NeutralVenue?: boolean;
}

class SportsDataService {
  private readonly BASE_URL = 'https://api.sportsdata.io';
  private readonly apiKey = process.env.SPORTSDATA_API_KEY;

  private readonly ENDPOINTS = {
    NFL: `/v3/nfl/scores/json/ScoresByDate`,
    NBA: `/v3/nba/scores/json/ScoresByDate`, 
    NHL: `/v3/nhl/scores/json/ScoresByDate`,
    MLB: `/v3/mlb/scores/json/ScoresByDate`
  };

  // Cache data for 30 seconds to reduce API calls
  private cache = new Map<string, { data: Game[], timestamp: number }>();
  private CACHE_TTL = 30000; // 30 seconds

  private async fetchSportsDataGames(sport: 'NFL' | 'NBA' | 'NHL' | 'MLB', date?: string): Promise<Game[]> {
    if (!this.apiKey || this.apiKey === 'your_sportsdata_api_key_here') {
      console.log(`🏈 SportsData.io API key not configured for ${sport}, skipping`);
      return [];
    }

    const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheKey = `${sport}-${targetDate}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`📦 Using cached ${sport} data for ${targetDate}`);
      return cached.data;
    }

    try {
      const endpoint = this.ENDPOINTS[sport];
      const url = `${this.BASE_URL}${endpoint}/${targetDate}?key=${this.apiKey}`;
      
      console.log(`🏈 Fetching ${sport} games from SportsData.io for ${targetDate}...`);
      
      const data = await fetchJson<SportsDataScore[]>(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0'
        },
        timeoutMs: 10000
      });
      
      if (!data || data.length === 0) {
        console.log(`No ${sport} games found for ${targetDate}`);
        return [];
      }

      const games = data.map((game: SportsDataScore): Game => {
        const gameStatus = this.mapSportsDataStatus(game.Status, game.IsClosed);
        
        return {
          id: `${sport.toLowerCase()}-sd-${game.GameID}`,
          sport,
          homeTeam: {
            id: game.HomeTeamID.toString(),
            name: game.HomeTeam,
            abbreviation: game.HomeTeam, // SportsData uses team names as keys
            score: game.HomeTeamScore || 0,
          },
          awayTeam: {
            id: game.AwayTeamID.toString(),
            name: game.AwayTeam,
            abbreviation: game.AwayTeam,
            score: game.AwayTeamScore || 0,
          },
          startTime: game.DateTime,
          status: gameStatus,
          venue: `Stadium ID: ${game.StadiumID || 'TBD'}`,
          isSelected: false,
          // Add sport-specific data
          ...(sport === 'NFL' && { quarter: game.Quarter }),
          ...(sport === 'NBA' && { quarter: game.Quarter }),
          ...(sport === 'NHL' && { period: game.Quarter }),
        };
      }).filter(game => game !== null);
      
      // Cache the results
      this.cache.set(cacheKey, { data: games, timestamp: Date.now() });
      
      console.log(`✅ Fetched ${games.length} ${sport} games from SportsData.io`);
      return games;
    } catch (error) {
      console.error(`❌ Error fetching ${sport} games from SportsData.io:`, error);
      return [];
    }
  }

  private mapSportsDataStatus(status: string, isClosed: boolean): 'scheduled' | 'live' | 'final' {
    if (isClosed || status.toLowerCase().includes('final')) {
      return 'final';
    }
    
    const lowerStatus = status.toLowerCase();
    
    // Live game indicators
    if (lowerStatus.includes('inprogress') || 
        lowerStatus.includes('1st') || 
        lowerStatus.includes('2nd') || 
        lowerStatus.includes('3rd') || 
        lowerStatus.includes('4th') || 
        lowerStatus.includes('ot') || 
        lowerStatus.includes('overtime') ||
        lowerStatus.includes('halftime')) {
      return 'live';
    }
    
    return 'scheduled';
  }

  async getNFLGames(date?: string): Promise<Game[]> {
    return this.fetchSportsDataGames('NFL', date);
  }

  async getNBAGames(date?: string): Promise<Game[]> {
    return this.fetchSportsDataGames('NBA', date);
  }

  async getNHLGames(date?: string): Promise<Game[]> {
    return this.fetchSportsDataGames('NHL', date);
  }

  async getMLBGames(date?: string): Promise<Game[]> {
    return this.fetchSportsDataGames('MLB', date);
  }

  async getAllGames(date?: string): Promise<Game[]> {
    const [nflGames, nbaGames, nhlGames] = await Promise.all([
      this.getNFLGames(date),
      this.getNBAGames(date),
      this.getNHLGames(date),
    ]);
    
    return [...nflGames, ...nbaGames, ...nhlGames];
  }

  // Clear cache method for testing
  clearCache(): void {
    this.cache.clear();
  }
}

export const sportsDataService = new SportsDataService();
