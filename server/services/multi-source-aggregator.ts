import { fetchJson } from './http';
import { sportsDataService } from './sportsdata-api';
import type { Game } from '@shared/schema';

// V1-style normalized game structure at the edge
export type NormalizedGame = {
  gamePk: number;
  status: string;
  startTimeUtc: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  sport: string;
  // Raw fields for debugging
  rawStatus?: any;
};

// V1-style global live detection function
export function isLive(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s.includes('in progress') || s.includes('live') || s.includes('in play') ||
         s.includes('top ') || s.includes('bot ') || s.includes('middle ') ||
         s.includes('warmup') || s.includes('delayed');
}

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
    // Use America/New_York timezone like main MLB API (V1-style)
    const getMLBDate = (offsetDays = 0): string => {
      const now = new Date();
      const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      easternTime.setDate(easternTime.getDate() + offsetDays);
      return easternTime.toISOString().split('T')[0];
    };

    const today = date || getMLBDate(0);
    const yesterday = getMLBDate(-1);

    // Fetch both today's and yesterday's games to catch late-night West Coast games
    const [todayData, yesterdayData] = await Promise.all([
      fetchJson(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=linescore,team,game(content(media(epg)))`,
        { headers: { 'User-Agent': 'ChirpBot-Enhanced/2.0' }, timeoutMs: 8000 }
      ),
      fetchJson(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${yesterday}&hydrate=linescore,team,game(content(media(epg)))`,
        { headers: { 'User-Agent': 'ChirpBot-Enhanced/2.0' }, timeoutMs: 8000 }
      )
    ]);

    // Combine games from both days
    const todayGames = this.processMLBData(todayData);
    const yesterdayGames = this.processMLBData(yesterdayData);

    // Filter yesterday's games to only include live ones
    const liveYesterdayGames = yesterdayGames.filter(game => game.status === 'live');

    // Return all of today's games plus any live games from yesterday
    return [...todayGames, ...liveYesterdayGames];
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

  // V1-style broad status detection
  private mapMLBStatus(status: string): 'scheduled' | 'live' | 'final' {
    const s = (status || '').toLowerCase();
    if (s.includes('final') || s.includes('completed') || s.includes('game over')) return 'final';
    if (s.includes('live') || s.includes('in progress') || s.includes('in play') ||
        s.includes('top ') || s.includes('bot ') || s.includes('middle ') ||
        s.includes('end ')) return 'live';
    return 'scheduled';
  }
}

class ESPNMLBSource implements MLBSource {
  name = 'ESPN-MLB';
  priority = 2;
  reliability = 85;
  speedScore = 8;
  enabled = true; // ENABLED: Use for basic game listing
  failureCount = 0;
  maxRetries = 3;

  async fetchGames(date?: string): Promise<Game[]> {
    const today = date || new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const todayFormatted = today.replace(/-/g, '');
    const yesterdayFormatted = yesterdayStr.replace(/-/g, '');

    // Fetch both today's and yesterday's games
    const [todayData, yesterdayData] = await Promise.all([
      fetchJson(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${todayFormatted}`,
        { headers: { 'User-Agent': 'ChirpBot-ESPN/2.0' }, timeoutMs: 10000 }
      ),
      fetchJson(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${yesterdayFormatted}`,
        { headers: { 'User-Agent': 'ChirpBot-ESPN/2.0' }, timeoutMs: 10000 }
      )
    ]);

    // Process both days
    const todayGames = this.processESPNData(todayData);
    const yesterdayGames = this.processESPNData(yesterdayData);

    // Filter yesterday's games to only include live ones
    const liveYesterdayGames = yesterdayGames.filter(game => game.status === 'live');

    // Return all of today's games plus any live games from yesterday
    return [...todayGames, ...liveYesterdayGames];
  }

  private processESPNData(data: any): Game[] {
    if (!data?.events) return [];

    // Filter for MLB/baseball sports only
    const mlbEvents = data.events.filter((event: any) => {
      const sport = event.competitions?.[0]?.type?.name?.toLowerCase() || '';
      return sport.includes('baseball') || sport.includes('mlb');
    });

    return mlbEvents.map((event: any) => ({
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

  // V1-style broad status detection
  private mapESPNStatus(status: string): 'scheduled' | 'live' | 'final' {
    const s = (status || '').toLowerCase();
    if (s.includes('final') || s.includes('completed')) return 'final';
    if (s.includes('live') || s.includes('in progress') || s.includes('in play')) return 'live';
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
  enabled = true; // Re-enabled with improved rate limiting and error handling
  failureCount = 0;
  maxRetries = 2; // Allow 2 retries with backoff

  async fetchGames(date?: string): Promise<Game[]> {
    // Progressive delay based on failure count to avoid rate limits
    const delay = Math.min(1000 + (this.failureCount * 2000), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    const today = date || new Date().toISOString().split('T')[0];
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${today}&l=4424`; // MLB league ID

    const data = await fetchJson(url, {
      headers: {
        'User-Agent': 'ChirpBot-SportsDB/2.0',
        'Accept': 'application/json'
      },
      timeoutMs: 15000
    });

    return this.processSportsDBData(data);
  }

  private processSportsDBData(data: any): Game[] {
    if (!data?.events) return [];

    return data.events
      .filter((event: any) => {
        // Filter for baseball only
        return event.strSport === 'Baseball' || event.strLeague?.includes('MLB');
      })
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

  // V1-style broad status detection
  private mapSportsDBStatus(status: string): 'scheduled' | 'live' | 'final' {
    if (!status) return 'scheduled';
    const s = status.toLowerCase();
    if (s.includes('final') || s.includes('ft') || s.includes('completed')) return 'final';
    if (s.includes('live') || s.includes('progress') || s.includes('in play')) return 'live';
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

  // V1-style broad status detection
  private mapESPNStatus(status: string): 'scheduled' | 'live' | 'final' {
    const s = (status || '').toLowerCase();
    if (s.includes('final') || s.includes('completed')) return 'final';
    if (s.includes('live') || s.includes('in progress') || s.includes('in play')) return 'live';
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
    console.log(`🔍 Multi-source aggregator fetching MLB games for ${date || 'today'}`);

    const results = await Promise.allSettled([
      this.getMLBFromAPI(date),
      this.getMLBFromESPN(date)
    ]);

    let allGames: Game[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = i === 0 ? 'MLB API' : 'ESPN';

      if (result.status === 'fulfilled') {
        console.log(`✅ ${source}: Found ${result.value.length} games`);
        if (result.value.length > 0) {
          // Log first game from each source for debugging
          const firstGame = result.value[0];
          console.log(`   Sample game: ${firstGame.awayTeam?.name || firstGame.awayTeam} @ ${firstGame.homeTeam?.name || firstGame.homeTeam} (${firstGame.status})`);
        }
        allGames = allGames.concat(result.value);
      } else {
        console.log(`❌ ${source} failed:`, result.reason?.message || 'Unknown error');
      }
    }

    // Deduplicate games based on team matchups
    const uniqueGames = this.deduplicateGames(allGames);
    console.log(`🎯 Multi-source aggregator: ${uniqueGames.length} unique games from ${results.length} sources`);

    // Log all unique games for debugging
    uniqueGames.forEach(game => {
      console.log(`   Game: ${game.awayTeam?.name || game.awayTeam} @ ${game.homeTeam?.name || game.homeTeam} - Status: ${game.status}`);
    });

    return uniqueGames;
  }

  async getNFLGames(date?: string): Promise<Game[]> {
    return this.fetchWithFallback(this.nflSources, date);
  }

  // Helper function to abstract fetching from multiple sources
  private async getMLBFromAPI(date?: string): Promise<Game[]> {
    try {
      const source = new MLBStatsAPIEnhanced();
      return await source.fetchGames(date);
    } catch (error) {
      console.error("Error fetching from MLBStatsAPIEnhanced:", error);
      return [];
    }
  }

  private async getMLBFromESPN(date?: string): Promise<Game[]> {
    try {
      const source = new ESPNMLBSource();
      return await source.fetchGames(date);
    } catch (error) {
      console.error("Error fetching from ESPNMLBSource:", error);
      return [];
    }
  }

  // Deduplicate games based on a simple heuristic (awayTeam vs homeTeam)
  private deduplicateGames(games: Game[]): Game[] {
    const gameMap = new Map<string, Game>();
    games.forEach(game => {
      const key = `${game.awayTeam.name}-${game.homeTeam.name}`;
      // If a game already exists, keep the one with more up-to-date info (e.g., score, status)
      if (!gameMap.has(key) || (game.status !== 'scheduled' && gameMap.get(key)!.status === 'scheduled')) {
        gameMap.set(key, game);
      }
    });
    return Array.from(gameMap.values());
  }

  // Advanced parallel fetching with speed optimization and cross-validation
  private async fetchWithParallelOptimization<T extends DataSource & { fetchGames: (date?: string) => Promise<Game[]> }>(
    sources: T[],
    date?: string
  ): Promise<Game[]> {
    const enabledSources = sources.filter(source => {
      // Skip if too many recent failures
      if (source.failureCount >= source.maxRetries) {
        const timeSinceLastFailure = source.lastFailure ? Date.now() - source.lastFailure.getTime() : 0;
        if (timeSinceLastFailure < 300000) { // 5 minutes cooldown
          return false;
        } else {
          source.failureCount = 0; // Reset after cooldown
        }
      }
      return source.enabled;
    });

    if (enabledSources.length === 0) {
      console.log(`💥 No available data sources`);
      return [];
    }

    console.log(`🚀 Testing ${enabledSources.length} sources simultaneously for optimal speed...`);

    // Test all sources in parallel with response time tracking
    const sourcePromises = enabledSources.map(async (source) => {
      const startTime = Date.now();
      try {
        const games = await source.fetchGames(date);
        const responseTime = Date.now() - startTime;

        // Reset failure count on success
        source.failureCount = 0;

        return {
          source,
          games,
          responseTime,
          success: true,
          error: null,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        source.failureCount++;
        source.lastFailure = new Date();

        return {
          source,
          games: [] as Game[],
          responseTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Wait for all sources to complete
    const results = await Promise.all(sourcePromises);

    // Filter successful results and sort by response time
    const successfulResults = results
      .filter(result => result.success && result.games.length > 0)
      .sort((a, b) => a.responseTime - b.responseTime);

    // Log all results for monitoring
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.source.name}: ${result.games.length} games, ${result.responseTime}ms (${result.source.reliability}% reliable)`);
      } else {
        console.log(`❌ ${result.source.name}: failed in ${result.responseTime}ms - ${result.error}`);
      }
    });

    if (successfulResults.length === 0) {
      console.log(`💥 All ${enabledSources.length} sources failed or returned no data`);
      return [];
    }

    // For alert systems, use only the fastest single source to prevent conflicts
    const fastest = successfulResults[0];
    console.log(`⚡ Using single fastest source: ${fastest.source.name} (${fastest.responseTime}ms)`);
    console.log(`📊 Skipping cross-validation to prevent alert conflicts`);
    return fastest.games;
  }

  // Cross-validation logic to ensure data accuracy across sources
  private crossValidateGameData(results: Array<{source: any, games: Game[], responseTime: number}>): Game[] {
    console.log(`🔍 Cross-validating data from ${results.length} sources...`);

    const allGames = results.flatMap(result => result.games);
    const gameMap = new Map<string, Game[]>();

    // Group games by a normalized key (team names + date)
    allGames.forEach(game => {
      const key = this.normalizeGameKey(game);
      if (!gameMap.has(key)) {
        gameMap.set(key, []);
      }
      gameMap.get(key)!.push(game);
    });

    const validatedGames: Game[] = [];

    gameMap.forEach((gameVersions, key) => {
      if (gameVersions.length >= 2) {
        // Multiple sources agree - high confidence
        const bestVersion = this.selectBestGameVersion(gameVersions);
        validatedGames.push(bestVersion);
        console.log(`✅ Cross-validated: ${bestVersion.awayTeam.name} @ ${bestVersion.homeTeam.name}`);
      } else if (gameVersions.length === 1) {
        // Single source - accept but with lower confidence
        validatedGames.push(gameVersions[0]);
        console.log(`⚠️ Single source: ${gameVersions[0].awayTeam.name} @ ${gameVersions[0].homeTeam.name}`);
      }
    });

    console.log(`🎯 Cross-validation complete: ${validatedGames.length} validated games`);
    return validatedGames;
  }

  private normalizeGameKey(game: Game): string {
    // Create normalized key for cross-validation
    const awayTeam = game.awayTeam.name.toLowerCase().replace(/[^a-z]/g, '');
    const homeTeam = game.homeTeam.name.toLowerCase().replace(/[^a-z]/g, '');
    const date = new Date(game.startTime).toISOString().split('T')[0];
    return `${awayTeam}-${homeTeam}-${date}`;
  }

  private selectBestGameVersion(versions: Game[]): Game {
    // Prefer versions with more complete data
    return versions.reduce((best, current) => {
      const currentScore = this.calculateDataCompleteness(current);
      const bestScore = this.calculateDataCompleteness(best);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateDataCompleteness(game: Game): number {
    let score = 0;
    if (game.homeTeam.score !== undefined) score += 1;
    if (game.awayTeam.score !== undefined) score += 1;
    if (game.venue && game.venue !== 'TBD') score += 1;
    if (game.status && game.status !== 'scheduled') score += 1;
    return score;
  }

  // Legacy fallback method for backwards compatibility
  private async fetchWithFallback<T extends DataSource & { fetchGames: (date?: string) => Promise<Game[]> }>(
    sources: T[],
    date?: string
  ): Promise<Game[]> {
    return this.fetchWithParallelOptimization(sources, date);
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