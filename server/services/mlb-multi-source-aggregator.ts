import type { Game } from "@shared/schema";
import { fetchJson } from './http';

// Multi-Source MLB Data Aggregation System
// Priority-based fallback with performance tracking and reliability scoring

interface DataSource {
  id: string;
  name: string;
  priority: number;
  speedScore: number;
  reliabilityScore: number;
  baseUrl: string;
  timeout: number;
  isEnabled: boolean;
}

interface DataSourcePerformance {
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
}

interface MLBGameState {
  gameId: string;
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  balls: number;
  strikes: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  currentBatter?: any;
  currentPitcher?: any;
  weather?: WeatherData;
}

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
  condition: string;
  hrProbabilityBoost: number;
}

interface APIResponse {
  success: boolean;
  data?: any;
  source: string;
  responseTime: number;
  error?: string;
}

interface WeatherAPIResponse {
  main: {
    temp: number;
    humidity: number;
    pressure: number;
  };
  wind?: {
    speed: number;
    deg: number;
  };
  weather: Array<{
    main: string;
  }>;
}

export class MLBMultiSourceAggregator {
  private dataSources: Map<string, DataSource> = new Map();
  private performance: Map<string, DataSourcePerformance> = new Map();
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map();

  constructor() {
    this.initializeDataSources();
    this.initializePerformanceTracking();
  }

  private initializeDataSources() {
    const sources: DataSource[] = [
      {
        id: 'mlb-stats-enhanced',
        name: 'MLB-StatsAPI (Enhanced)',
        priority: 1,
        speedScore: 10,
        reliabilityScore: 98,
        baseUrl: 'https://statsapi.mlb.com/api/v1',
        timeout: 8000,
        isEnabled: true
      },
      {
        id: 'mlb-official',
        name: 'MLB Official API',
        priority: 2,
        speedScore: 9,
        reliabilityScore: 95,
        baseUrl: 'https://statsapi.mlb.com/api/v1',
        timeout: 6000,
        isEnabled: true
      },
      {
        id: 'api-sports',
        name: 'API-Sports',
        priority: 3,
        speedScore: 8,
        reliabilityScore: 90,
        baseUrl: 'https://v1.baseball.api-sports.io',
        timeout: 10000,
        isEnabled: !!process.env.RAPIDAPI_KEY
      },
      {
        id: 'espn-api',
        name: 'ESPN API',
        priority: 4,
        speedScore: 7,
        reliabilityScore: 85,
        baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
        timeout: 12000,
        isEnabled: true
      },
      {
        id: 'yahoo-sports',
        name: 'Yahoo Sports API',
        priority: 5,
        speedScore: 6,
        reliabilityScore: 80,
        baseUrl: 'https://api.sports.yahoo.com/v1/editorial/s/baseball/mlb',
        timeout: 15000,
        isEnabled: true
      },
      {
        id: 'thesportsdb',
        name: 'TheSportsDB',
        priority: 6,
        speedScore: 5,
        reliabilityScore: 75,
        baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
        timeout: 18000,
        isEnabled: true
      }
    ];

    sources.forEach(source => this.dataSources.set(source.id, source));
  }

  private initializePerformanceTracking() {
    this.dataSources.forEach((source, id) => {
      this.performance.set(id, {
        successCount: 0,
        failureCount: 0,
        avgResponseTime: 0,
        lastSuccess: null,
        lastFailure: null
      });
    });
  }

  private updatePerformanceMetrics(sourceId: string, success: boolean, responseTime: number) {
    const perf = this.performance.get(sourceId);
    if (!perf) return;

    if (success) {
      perf.successCount++;
      perf.lastSuccess = new Date();
    } else {
      perf.failureCount++;
      perf.lastFailure = new Date();
    }

    // Update average response time
    const totalRequests = perf.successCount + perf.failureCount;
    perf.avgResponseTime = ((perf.avgResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  private getSortedSources(): DataSource[] {
    return Array.from(this.dataSources.values())
      .filter(source => source.isEnabled)
      .sort((a, b) => a.priority - b.priority);
  }

  private isDataFresh(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  // Data Source Adapters

  private async fetchFromMLBStatsEnhanced(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('mlb-stats-enhanced')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'User-Agent': 'ChirpBot/2.0', 
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('mlb-stats-enhanced', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('mlb-stats-enhanced', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  private async fetchFromMLBOfficial(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('mlb-official')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'User-Agent': 'ChirpBot/2.0', 
          'Accept': 'application/json'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('mlb-official', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('mlb-official', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  private async fetchFromAPISports(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('api-sports')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'v1.baseball.api-sports.io',
          'Accept': 'application/json'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('api-sports', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('api-sports', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  private async fetchFromESPN(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('espn-api')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChirpBot/2.0'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('espn-api', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('espn-api', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  private async fetchFromYahooSports(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('yahoo-sports')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChirpBot/2.0'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('yahoo-sports', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('yahoo-sports', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  private async fetchFromTheSportsDB(endpoint: string): Promise<APIResponse> {
    const startTime = Date.now();
    const source = this.dataSources.get('thesportsdb')!;
    
    try {
      console.log(`🏈 Fetching from ${source.name} (Priority ${source.priority}): ${endpoint}`);
      
      const data = await fetchJson(`${source.baseUrl}${endpoint}`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'ChirpBot/2.0'
        },
        timeoutMs: source.timeout
      });

      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('thesportsdb', true, responseTime);
      
      console.log(`✅ ${source.name} SUCCESS (${responseTime}ms)`);
      return { success: true, data, source: source.name, responseTime };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics('thesportsdb', false, responseTime);
      console.log(`❌ ${source.name} FAILED (${responseTime}ms): ${error}`);
      return { success: false, source: source.name, responseTime, error: String(error) };
    }
  }

  // Weather Integration
  private async fetchWeatherData(venue: string, gameId: string): Promise<WeatherData | null> {
    const cacheKey = `weather-${venue}`;
    const cached = this.weatherCache.get(cacheKey);
    
    if (cached && this.isDataFresh(cached.timestamp, 300000)) { // 5 minutes cache
      return cached.data;
    }

    const apiKey = process.env.ACCUWEATHER_API_KEY;
    if (!apiKey) {
      console.log('⚠️ AccuWeather API key not available');
      return null;
    }

    try {
      console.log(`🌤️ Fetching weather data for venue: ${venue}`);
      
      // Map MLB venue names to coordinates (you'd expand this with all MLB stadiums)
      const venueCoordinates: { [key: string]: { lat: number; lon: number } } = {
        "Yankee Stadium": { lat: 40.8296, lon: -73.9262 },
        "Fenway Park": { lat: 42.3467, lon: -71.0972 },
        "Wrigley Field": { lat: 41.9484, lon: -87.6553 },
        "Dodger Stadium": { lat: 34.0739, lon: -118.2400 },
        "Target Field": { lat: 44.9817, lon: -93.2776 }, // Minnesota Twins
        // Add more venues as needed
      };

      const coords = venueCoordinates[venue];
      if (!coords) {
        console.log(`⚠️ No coordinates found for venue: ${venue}`);
        return null;
      }

      // AccuWeather requires location key first, then current conditions
      const locationData = await fetchJson<any[]>(`https://dataservice.accuweather.com/locations/v1/search?apikey=${apiKey}&q=${encodeURIComponent(venue)}`, {
        timeoutMs: 5000
      });

      if (!locationData || locationData.length === 0) {
        console.log(`⚠️ No AccuWeather location found for venue: ${venue}`);
        return null;
      }

      const locationKey = locationData[0].Key;
      
      // Get current conditions using the location key
      const currentConditions = await fetchJson<any[]>(`https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`, {
        timeoutMs: 5000
      });

      if (!currentConditions || currentConditions.length === 0) {
        console.log(`⚠️ No AccuWeather current conditions for venue: ${venue}`);
        return null;
      }

      const weatherData = currentConditions[0];

      const weather: WeatherData = {
        temperature: weatherData.Temperature?.Imperial?.Value || 70,
        windSpeed: weatherData.Wind?.Speed?.Imperial?.Value || 0,
        windDirection: this.convertWindDirectionToNumber(weatherData.Wind?.Direction?.Degrees || 0),
        humidity: weatherData.RelativeHumidity || 50,
        pressure: weatherData.Pressure?.Imperial?.Value || 30,
        condition: weatherData.WeatherText || 'Clear',
        hrProbabilityBoost: this.calculateHRBoost(
          weatherData.Wind?.Speed?.Imperial?.Value || 0, 
          weatherData.Wind?.Direction?.Degrees || 0, 
          weatherData.Temperature?.Imperial?.Value || 70
        )
      };

      this.weatherCache.set(cacheKey, { data: weather, timestamp: Date.now() });
      console.log(`✅ Weather data updated for ${venue}: ${weather.temperature}°F, Wind: ${weather.windSpeed}mph, HR Boost: ${weather.hrProbabilityBoost}%`);
      
      return weather;
    } catch (error) {
      console.error(`❌ Error fetching weather data for ${venue}:`, error);
      return null;
    }
  }

  private convertWindDirectionToNumber(degrees: number): number {
    return degrees || 0;
  }

  private calculateHRBoost(windSpeed: number, windDirection: number, temperature: number): number {
    // Simplified HR probability calculation based on weather conditions
    let boost = 0;
    
    // Temperature boost (hot weather helps baseballs carry)
    if (temperature > 80) boost += 5;
    if (temperature > 90) boost += 5;
    
    // Wind boost (tailwind helps, headwind hurts)
    if (windSpeed > 10) {
      // Assuming wind direction 180-360 is tailwind (simplified)
      if (windDirection >= 180 && windDirection <= 360) {
        boost += Math.min(windSpeed * 0.5, 10);
      } else {
        boost -= Math.min(windSpeed * 0.3, 8);
      }
    }
    
    return Math.round(Math.max(-10, Math.min(20, boost)));
  }

  // Main aggregation methods
  public async getTodaysGames(): Promise<Game[]> {
    const cacheKey = 'todays-games';
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isDataFresh(cached.timestamp, cached.ttl)) {
      console.log(`📦 Using cached today's games data`);
      return cached.data;
    }

    console.log('🔄 Fetching today\'s MLB games with multi-source aggregation...');
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const sources = this.getSortedSources();
    let games: Game[] = [];
    let successfulSource: string | null = null;
    
    for (const source of sources) {
      try {
        let response: APIResponse;
        
        switch (source.id) {
          case 'mlb-stats-enhanced':
          case 'mlb-official':
            response = await this.fetchFromMLBStatsEnhanced(`/schedule?sportId=1&date=${today}&hydrate=linescore,team`);
            if (response.success) {
              games = await this.transformMLBStatsGames(response.data);
              // Also fetch yesterday's live games
              const yesterdayResponse = await this.fetchFromMLBStatsEnhanced(`/schedule?sportId=1&date=${yesterday}&hydrate=linescore,team`);
              if (yesterdayResponse.success) {
                const yesterdayGames = await this.transformMLBStatsGames(yesterdayResponse.data);
                const liveYesterdayGames = yesterdayGames.filter(game => game.isLive);
                games.push(...liveYesterdayGames);
              }
            }
            break;
            
          case 'espn-api':
            response = await this.fetchFromESPN('/scoreboard');
            if (response.success) {
              games = await this.transformESPNGames(response.data);
            }
            break;
            
          case 'api-sports':
            response = await this.fetchFromAPISports(`/games?date=${today}&league=1&season=2025`);
            if (response.success) {
              games = await this.transformAPISportsGames(response.data);
            }
            break;
            
          case 'yahoo-sports':
            response = await this.fetchFromYahooSports(`/games?date=${today}`);
            if (response.success) {
              games = await this.transformYahooGames(response.data);
            }
            break;
            
          case 'thesportsdb':
            response = await this.fetchFromTheSportsDB(`/eventsday.php?d=${today}&l=4424`);
            if (response.success) {
              games = await this.transformSportsDBGames(response.data);
            }
            break;
            
          default:
            continue;
        }
        
        if (games.length > 0) {
          successfulSource = source.name;
          console.log(`✅ Successfully fetched ${games.length} games from ${source.name}`);
          break;
        }
        
      } catch (error) {
        console.log(`❌ Source ${source.name} failed: ${error}`);
        continue;
      }
    }
    
    if (games.length === 0) {
      console.error('❌ All MLB data sources failed to fetch games');
      throw new Error('All MLB data sources are currently unavailable');
    }
    
    console.log(`📊 Multi-source aggregation complete: ${games.length} games from ${successfulSource}`);
    
    // Cache the results for 2 minutes
    this.cache.set(cacheKey, { data: games, timestamp: Date.now(), ttl: 120000 });
    
    return games;
  }

  public async getLiveGames(): Promise<Game[]> {
    const allGames = await this.getTodaysGames();
    const liveGames = allGames.filter(game => game.isLive);
    
    console.log(`🎯 Found ${liveGames.length} live games out of ${allGames.length} total games`);
    return liveGames;
  }

  public async getLiveFeed(gamePk: number, venue?: string): Promise<any> {
    const cacheKey = `live-feed-${gamePk}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isDataFresh(cached.timestamp, cached.ttl)) {
      return cached.data;
    }

    console.log(`🔄 Fetching live feed for game ${gamePk} with multi-source aggregation...`);
    
    const sources = this.getSortedSources();
    let liveFeed: any = null;
    let successfulSource: string | null = null;
    
    for (const source of sources) {
      try {
        let response: APIResponse;
        
        switch (source.id) {
          case 'mlb-stats-enhanced':
          case 'mlb-official':
            // Try multiple endpoints in parallel (including v1.1 linescore for runner data)
            const feedUrl = `/game/${gamePk}/feed/live?hydrate=plays,currentPlay,team`;
            const playByPlayUrl = `/game/${gamePk}/playByPlay`;
            const linescoreUrl = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
            
            const [feedResponse, playResponse, linescoreResponse] = await Promise.all([
              this.fetchFromMLBStatsEnhanced(feedUrl).catch(() => ({ success: false, source: source.name, responseTime: 0 })),
              this.fetchFromMLBStatsEnhanced(playByPlayUrl).catch(() => ({ success: false, source: source.name, responseTime: 0 })),
              // Fetch v1.1 API directly for linescore with runner data
              fetchJson(linescoreUrl, { timeoutMs: 5000 }).then(
                data => ({ success: true, data }),
                () => ({ success: false })
              )
            ]);
            
            // Extract data from v1.1 API if available
            let v11LiveData = null;
            if (linescoreResponse.success && 'data' in linescoreResponse) {
              const v11Data = linescoreResponse.data as any;
              v11LiveData = v11Data?.liveData || null;
            }
            
            if (feedResponse.success || playResponse.success || v11LiveData) {
              const baseFeed = feedResponse.success && 'data' in feedResponse ? feedResponse.data : null;
              const playData = playResponse.success && 'data' in playResponse ? playResponse.data : null;
              
              // Start with base feed/play data merge
              liveFeed = this.mergeLiveFeedData(baseFeed, playData, gamePk);
              
              // Override with v1.1 data if available (has runner and batter data)
              if (v11LiveData && liveFeed) {
                // Merge v1.1 linescore data (contains offense with batter/runner info)
                if (v11LiveData.linescore) {
                  liveFeed.liveData.linescore = {
                    ...liveFeed.liveData.linescore,
                    ...v11LiveData.linescore,
                    offense: v11LiveData.linescore.offense || liveFeed.liveData.linescore.offense || {},
                    defense: v11LiveData.linescore.defense || liveFeed.liveData.linescore.defense || {}
                  };
                }
                
                // Merge plays data if v1.1 has it
                if (v11LiveData.plays && !liveFeed.liveData.plays?.currentPlay) {
                  liveFeed.liveData.plays = v11LiveData.plays;
                }
              }
              
              successfulSource = source.name;
            }
            break;
            
          case 'espn-api':
            response = await this.fetchFromESPN(`/summary?gameId=${gamePk}`);
            if (response.success) {
              liveFeed = await this.transformESPNLiveFeed(response.data, gamePk);
              successfulSource = source.name;
            }
            break;
            
          default:
            // Other sources don't have live feed equivalents, skip
            continue;
        }
        
        if (liveFeed) {
          break;
        }
        
      } catch (error) {
        console.log(`❌ Live feed source ${source.name} failed: ${error}`);
        continue;
      }
    }
    
    if (!liveFeed) {
      console.error(`❌ All sources failed to fetch live feed for game ${gamePk}`);
      return null;
    }
    
    // Add weather data if venue is provided
    if (venue) {
      const weather = await this.fetchWeatherData(venue, `game-${gamePk}`);
      if (weather) {
        liveFeed.weather = weather;
      }
    }
    
    console.log(`✅ Live feed fetched successfully from ${successfulSource} for game ${gamePk}`);
    
    // Cache for 30 seconds (live data changes frequently)
    this.cache.set(cacheKey, { data: liveFeed, timestamp: Date.now(), ttl: 30000 });
    
    return liveFeed;
  }

  // Data transformation methods for different sources
  private async transformMLBStatsGames(data: any): Promise<Game[]> {
    if (!data.dates || data.dates.length === 0) return [];
    
    const games: Game[] = [];
    for (const dateData of data.dates) {
      for (const mlbGame of dateData.games || []) {
        const isLive = mlbGame.status.abstractGameState === 'Live';
        const isCompleted = mlbGame.status.abstractGameState === 'Final';
        
        games.push({
          id: `mlb-${mlbGame.gamePk}`,
          sport: 'MLB',
          startTime: mlbGame.gameDate,
          status: isLive ? 'live' : (isCompleted ? 'final' : 'scheduled'),
          isLive,
          isCompleted,
          homeTeam: {
            id: mlbGame.teams.home.team.id.toString(),
            name: mlbGame.teams.home.team.name,
            abbreviation: mlbGame.teams.home.team.abbreviation,
            score: mlbGame.teams.home.score || 0
          },
          awayTeam: {
            id: mlbGame.teams.away.team.id.toString(),
            name: mlbGame.teams.away.team.name,
            abbreviation: mlbGame.teams.away.team.abbreviation,
            score: mlbGame.teams.away.score || 0
          },
          venue: mlbGame.venue.name,
          inning: mlbGame.linescore?.currentInning,
          inningState: mlbGame.linescore?.inningState,
          gameState: mlbGame.status.abstractGameState,
          gamePk: mlbGame.gamePk
        });
      }
    }
    
    return games;
  }

  private async transformESPNGames(data: any): Promise<Game[]> {
    // ESPN API transformation logic
    if (!data.events) return [];
    
    const games: Game[] = [];
    for (const event of data.events) {
      const isLive = event.status?.type?.state === 'in';
      const isCompleted = event.status?.type?.completed;
      
      games.push({
        id: `mlb-espn-${event.id}`,
        sport: 'MLB',
        startTime: event.date,
        status: isLive ? 'live' : (isCompleted ? 'final' : 'scheduled'),
        isLive,
        isCompleted,
        homeTeam: {
          id: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.id || '',
          name: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.name || 'Home',
          abbreviation: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.abbreviation || 'HOM',
          score: parseInt(event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.score || '0')
        },
        awayTeam: {
          id: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.id || '',
          name: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.name || 'Away',
          abbreviation: event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.abbreviation || 'AWY',
          score: parseInt(event.competitions[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.score || '0')
        },
        venue: event.competitions[0]?.venue?.fullName || 'Unknown Venue',
        inning: event.competitions[0]?.status?.period,
        inningState: event.competitions[0]?.situation?.isRedZone ? 'bottom' : 'top', // Simplified
        gameState: event.status?.type?.description || 'Unknown'
      });
    }
    
    return games;
  }

  private async transformAPISportsGames(data: any): Promise<Game[]> {
    // API-Sports transformation logic
    if (!data.response) return [];
    
    const games: Game[] = [];
    for (const game of data.response) {
      const isLive = game.status?.short === 'LIVE';
      const isCompleted = game.status?.short === 'FT';
      
      games.push({
        id: `mlb-apisports-${game.id}`,
        sport: 'MLB',
        startTime: game.date,
        status: isLive ? 'live' : (isCompleted ? 'final' : 'scheduled'),
        isLive,
        isCompleted,
        homeTeam: {
          id: game.teams?.home?.id?.toString() || '',
          name: game.teams?.home?.name || 'Home',
          abbreviation: game.teams?.home?.code || 'HOM',
          score: game.scores?.home?.total || 0
        },
        awayTeam: {
          id: game.teams?.away?.id?.toString() || '',
          name: game.teams?.away?.name || 'Away',
          abbreviation: game.teams?.away?.code || 'AWY',
          score: game.scores?.away?.total || 0
        },
        venue: game.venue || 'Unknown Venue',
        inning: game.periods?.current,
        gameState: game.status?.long || 'Unknown'
      });
    }
    
    return games;
  }

  private async transformYahooGames(data: any): Promise<Game[]> {
    // Yahoo Sports transformation logic (placeholder)
    return [];
  }

  private async transformSportsDBGames(data: any): Promise<Game[]> {
    // TheSportsDB transformation logic (placeholder)
    return [];
  }

  private mergeLiveFeedData(feedData: any, playData: any, gamePk: number): any {
    if (!feedData && !playData) return null;
    
    let liveData = feedData?.liveData || {};
    
    // Merge play-by-play data if available
    if (playData?.liveData?.plays && !liveData.plays?.currentPlay) {
      liveData.plays = playData.liveData.plays;
    }
    
    // If playData has linescore (from v1.1 API), use it instead
    if (playData && !liveData.linescore) {
      liveData.linescore = playData;
    }
    
    return {
      gameData: feedData?.gameData || { game: { pk: gamePk } },
      liveData: {
        linescore: {
          ...liveData.linescore,
          outs: liveData.linescore?.outs || playData?.outs || 0,
          balls: liveData.linescore?.balls || playData?.balls || 0,
          strikes: liveData.linescore?.strikes || playData?.strikes || 0,
          offense: liveData.linescore?.offense || playData?.offense || {},
          defense: liveData.linescore?.defense || playData?.defense || {}
        },
        plays: liveData.plays || playData?.allPlays ? { allPlays: playData.allPlays, currentPlay: playData.currentPlay } : {},
        boxscore: liveData.boxscore
      }
    };
  }

  private async transformESPNLiveFeed(data: any, gamePk: number): Promise<any> {
    // ESPN live feed transformation logic
    return {
      gameData: { game: { pk: gamePk } },
      liveData: {
        linescore: {
          outs: data.situation?.outs || 0,
          balls: data.situation?.balls || 0,
          strikes: data.situation?.strikes || 0,
          currentInning: data.status?.period || 1,
          inningState: data.situation?.isRedZone ? 'Bottom' : 'Top'
        }
      }
    };
  }

  // Performance and monitoring methods
  public getPerformanceReport(): any {
    const report: any = {};
    
    this.dataSources.forEach((source, id) => {
      const perf = this.performance.get(id);
      if (perf) {
        const totalRequests = perf.successCount + perf.failureCount;
        const successRate = totalRequests > 0 ? (perf.successCount / totalRequests * 100) : 0;
        
        report[id] = {
          name: source.name,
          priority: source.priority,
          reliabilityScore: source.reliabilityScore,
          speedScore: source.speedScore,
          actualSuccessRate: Math.round(successRate * 100) / 100,
          avgResponseTime: Math.round(perf.avgResponseTime),
          totalRequests,
          successCount: perf.successCount,
          failureCount: perf.failureCount,
          lastSuccess: perf.lastSuccess,
          lastFailure: perf.lastFailure,
          isEnabled: source.isEnabled
        };
      }
    });
    
    return report;
  }
}

export const mlbMultiSourceAggregator = new MLBMultiSourceAggregator();