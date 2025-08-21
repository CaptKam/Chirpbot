import { fetchJson } from './http';
import { sportsDataService } from './sportsdata-api';
import type { Game } from '@shared/schema';

export interface DataSource {
  name: string;
  priority: number;
  reliability: number; // 0-100%
  speedScore: number; // 0-10
  enabled: boolean;
  lastFailure?: Date;
  failureCount: number;
  maxRetries: number;
}

export interface MLBSource extends DataSource {
  fetchGames: (date?: string) => Promise<Game[]>;
}

export interface NFLSource extends DataSource {
  fetchGames: (date?: string) => Promise<Game[]>;
}

// MLB Data Sources with your priority system
class MLBStatsAPIEnhanced implements MLBSource {
  name = 'MLB-StatsAPI-Enhanced';
  priority = 1;
  reliability = 98;
  speedScore = 10;
  enabled = true;
  failureCount = 0;
  maxRetries = 3;

  async fetchGames(date?: string): Promise<Game[]> {
    const today = date || new Date().toISOString().split('T')[0];
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=linescore,team,game(content(media(epg)))`;
    
    const data = await fetchJson(url, {
      headers: { 'User-Agent': 'ChirpBot-Enhanced/2.0' },
      timeoutMs: 8000
    });

    return this.processMLBData(data);
  }

  private processMLBData(data: any): Game[] {
    if (!data?.dates?.[0]?.games) return [];
    
    return data.dates[0].games.map((game: any) => ({
      id: `mlb-${game.gamePk}`,
      sport: 'MLB',
      homeTeam: {
        id: game.teams.home.team.id.toString(),
        name: game.teams.home.team.name,
        abbreviation: game.teams.home.team.abbreviation,
        score: game.teams.home.score || 0,
      },
      awayTeam: {
        id: game.teams.away.team.id.toString(), 
        name: game.teams.away.team.name,
        abbreviation: game.teams.away.team.abbreviation,
        score: game.teams.away.score || 0,
      },
      startTime: game.gameDate,
      status: this.mapMLBStatus(game.status.detailedState),
      venue: game.venue?.name || 'TBD',
      isSelected: false,
    }));
  }

  private mapMLBStatus(status: string): 'scheduled' | 'live' | 'final' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('final') || lowerStatus.includes('completed')) return 'final';
    if (lowerStatus.includes('live') || lowerStatus.includes('progress')) return 'live';
    return 'scheduled';
  }
}

class ESPNMLBSource implements MLBSource {
  name = 'ESPN-MLB';
  priority = 2;
  reliability = 85;
  speedScore = 8;
  enabled = true;
  failureCount = 0;
  maxRetries = 3;

  async fetchGames(date?: string): Promise<Game[]> {
    const today = date || new Date().toISOString().split('T')[0];
    const formattedDate = today.replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${formattedDate}`;
    
    const data = await fetchJson(url, {
      headers: { 'User-Agent': 'ChirpBot-ESPN/2.0' },
      timeoutMs: 10000
    });

    return this.processESPNData(data);
  }

  private processESPNData(data: any): Game[] {
    if (!data?.events) return [];
    
    return data.events.map((event: any) => ({
      id: `mlb-espn-${event.id}`,
      sport: 'MLB',
      homeTeam: {
        id: event.competitions[0].competitors[0].team.id,
        name: event.competitions[0].competitors[0].team.displayName,
        abbreviation: event.competitions[0].competitors[0].team.abbreviation,
        score: parseInt(event.competitions[0].competitors[0].score || '0'),
      },
      awayTeam: {
        id: event.competitions[0].competitors[1].team.id,
        name: event.competitions[0].competitors[1].team.displayName,
        abbreviation: event.competitions[0].competitors[1].team.abbreviation,
        score: parseInt(event.competitions[0].competitors[1].score || '0'),
      },
      startTime: event.date,
      status: this.mapESPNStatus(event.status.type.name),
      venue: event.competitions[0].venue?.fullName || 'TBD',
      isSelected: false,
    }));
  }

  private mapESPNStatus(status: string): 'scheduled' | 'live' | 'final' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('final')) return 'final';
    if (lowerStatus.includes('progress') || lowerStatus.includes('live')) return 'live';
    return 'scheduled';
  }
}

class YahooSportsMLB implements MLBSource {
  name = 'Yahoo-Sports-MLB';
  priority = 3;
  reliability = 80;
  speedScore = 7;
  enabled = true;
  failureCount = 0;
  maxRetries = 2;

  async fetchGames(date?: string): Promise<Game[]> {
    // Yahoo Sports API implementation
    // Note: Yahoo requires OAuth, this is a simplified version
    throw new Error('Yahoo Sports API requires authentication setup');
  }
}

class TheSportsDBMLB implements MLBSource {
  name = 'TheSportsDB-MLB';
  priority = 4;
  reliability = 75;
  speedScore = 6;
  enabled = true;
  failureCount = 0;
  maxRetries = 2;

  async fetchGames(date?: string): Promise<Game[]> {
    const today = date || new Date().toISOString().split('T')[0];
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${today}&l=mlb`;
    
    const data = await fetchJson(url, {
      headers: { 'User-Agent': 'ChirpBot-SportsDB/2.0' },
      timeoutMs: 12000
    });

    return this.processSportsDBData(data);
  }

  private processSportsDBData(data: any): Game[] {
    if (!data?.events) return [];
    
    return data.events
      .filter((event: any) => event.strSport === 'Baseball')
      .map((event: any) => ({
        id: `mlb-sportsdb-${event.idEvent}`,
        sport: 'MLB',
        homeTeam: {
          id: event.idHomeTeam,
          name: event.strHomeTeam,
          abbreviation: event.strHomeTeam.substring(0, 3).toUpperCase(),
          score: parseInt(event.intHomeScore || '0'),
        },
        awayTeam: {
          id: event.idAwayTeam,
          name: event.strAwayTeam,
          abbreviation: event.strAwayTeam.substring(0, 3).toUpperCase(),
          score: parseInt(event.intAwayScore || '0'),
        },
        startTime: `${event.dateEvent}T${event.strTime}:00Z`,
        status: this.mapSportsDBStatus(event.strStatus),
        venue: event.strVenue || 'TBD',
        isSelected: false,
      }));
  }

  private mapSportsDBStatus(status: string): 'scheduled' | 'live' | 'final' {
    if (!status) return 'scheduled';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('final') || lowerStatus.includes('ft')) return 'final';
    if (lowerStatus.includes('live') || lowerStatus.includes('progress')) return 'live';
    return 'scheduled';
  }
}

// NFL Sources with SportsData.io primary and ESPN fallback  
class SportsDataNFLSource implements NFLSource {
  name = 'SportsData.io-NFL';
  priority = 1;
  reliability = 95;
  speedScore = 9;
  enabled = true;
  failureCount = 0;
  maxRetries = 3;

  async fetchGames(date?: string): Promise<Game[]> {
    return await sportsDataService.getNFLGames();
  }
}

class ESPNNFLSource implements NFLSource {
  name = 'ESPN-NFL';
  priority = 2;
  reliability = 88;
  speedScore = 8;
  enabled = true;
  failureCount = 0;
  maxRetries = 3;

  async fetchGames(date?: string): Promise<Game[]> {
    const today = date || new Date().toISOString().split('T')[0];
    const formattedDate = today.replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${formattedDate}`;
    
    const data = await fetchJson(url, {
      headers: { 'User-Agent': 'ChirpBot-ESPN-NFL/2.0' },
      timeoutMs: 10000
    });

    return this.processESPNNFLData(data);
  }

  private processESPNNFLData(data: any): Game[] {
    if (!data?.events) return [];
    
    return data.events.map((event: any) => ({
      id: `nfl-espn-${event.id}`,
      sport: 'NFL',
      homeTeam: {
        id: event.competitions[0].competitors[0].team.id,
        name: event.competitions[0].competitors[0].team.displayName,
        abbreviation: event.competitions[0].competitors[0].team.abbreviation,
        score: parseInt(event.competitions[0].competitors[0].score || '0'),
      },
      awayTeam: {
        id: event.competitions[0].competitors[1].team.id,
        name: event.competitions[0].competitors[1].team.displayName,
        abbreviation: event.competitions[0].competitors[1].team.abbreviation,
        score: parseInt(event.competitions[0].competitors[1].score || '0'),
      },
      startTime: event.date,
      status: this.mapESPNStatus(event.status.type.name),
      venue: event.competitions[0].venue?.fullName || 'TBD',
      isSelected: false,
    }));
  }

  private mapESPNStatus(status: string): 'scheduled' | 'live' | 'final' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('final')) return 'final';
    if (lowerStatus.includes('progress') || lowerStatus.includes('live')) return 'live';
    return 'scheduled';
  }
}

export class MultiSourceAggregator {
  private mlbSources: MLBSource[] = [
    new MLBStatsAPIEnhanced(),
    new ESPNMLBSource(),
    // new YahooSportsMLB(), // Disabled until OAuth setup
    new TheSportsDBMLB(),
  ];

  private nflSources: NFLSource[] = [
    new SportsDataNFLSource(),
    new ESPNNFLSource(),
  ];

  async getMLBGames(date?: string): Promise<Game[]> {
    return this.fetchWithFallback(this.mlbSources, date);
  }

  async getNFLGames(date?: string): Promise<Game[]> {
    return this.fetchWithFallback(this.nflSources, date);
  }

  private async fetchWithFallback<T extends DataSource & { fetchGames: (date?: string) => Promise<Game[]> }>(
    sources: T[], 
    date?: string
  ): Promise<Game[]> {
    const sortedSources = sources
      .filter(source => source.enabled)
      .sort((a, b) => a.priority - b.priority);

    console.log(`🔄 Trying ${sortedSources.length} data sources in priority order...`);

    for (const source of sortedSources) {
      try {
        // Skip if too many recent failures
        if (source.failureCount >= source.maxRetries) {
          const timeSinceLastFailure = source.lastFailure ? Date.now() - source.lastFailure.getTime() : 0;
          if (timeSinceLastFailure < 300000) { // 5 minutes cooldown
            console.log(`⏸️ Skipping ${source.name} - too many failures, cooling down`);
            continue;
          } else {
            // Reset failure count after cooldown
            source.failureCount = 0;
          }
        }

        console.log(`🎯 Trying ${source.name} (Priority ${source.priority}, ${source.reliability}% reliable)`);
        const startTime = Date.now();
        
        const games = await source.fetchGames(date);
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ ${source.name} success: ${games.length} games, ${responseTime}ms response time`);
        
        // Reset failure count on success
        source.failureCount = 0;
        
        return games;
      } catch (error) {
        source.failureCount++;
        source.lastFailure = new Date();
        
        console.log(`❌ ${source.name} failed (attempt ${source.failureCount}/${source.maxRetries}):`, error instanceof Error ? error.message : String(error));
        
        // Disable source if max retries exceeded
        if (source.failureCount >= source.maxRetries) {
          console.log(`🚫 ${source.name} disabled due to repeated failures`);
        }
      }
    }

    console.log(`💥 All data sources failed, returning empty array`);
    return [];
  }

  // Get reliability status for monitoring
  getSourceStatus() {
    return {
      mlb: this.mlbSources.map(source => ({
        name: source.name,
        priority: source.priority,
        reliability: source.reliability,
        enabled: source.enabled,
        failureCount: source.failureCount,
        lastFailure: source.lastFailure,
      })),
      nfl: this.nflSources.map(source => ({
        name: source.name,
        priority: source.priority,
        reliability: source.reliability,
        enabled: source.enabled,
        failureCount: source.failureCount,
        lastFailure: source.lastFailure,
      })),
    };
  }

  // Re-enable a disabled source
  enableSource(sourceName: string) {
    const allSources = [...this.mlbSources, ...this.nflSources];
    const source = allSources.find(s => s.name === sourceName);
    if (source) {
      source.enabled = true;
      source.failureCount = 0;
      console.log(`✅ Re-enabled data source: ${sourceName}`);
    }
  }
}

export const multiSourceAggregator = new MultiSourceAggregator();