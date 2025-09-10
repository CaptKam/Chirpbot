import { getPacificDate } from '../utils/timezone';
import { mlbApiCircuit, protectedFetch } from '../middleware/circuit-breaker';

export class MLBApiService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';
  private lastCall: { [key: string]: number } = {};
  private cache: { [key: string]: { data: any, timestamp: number } } = {};
  private readonly RATE_LIMIT_MS = 250; // 250ms between calls for near real-time
  private readonly CACHE_TTL_MS = 1000; // 1 second cache for freshest data

  private canMakeCall(endpoint: string): boolean {
    const now = Date.now();
    const lastCallTime = this.lastCall[endpoint] || 0;
    
    if (now - lastCallTime < this.RATE_LIMIT_MS) {
      console.log(`🚫 MLB API: Rate limited ${endpoint} (${this.RATE_LIMIT_MS}ms cooldown)`);
      return false;
    }
    
    this.lastCall[endpoint] = now;
    return true;
  }

  private getCached(key: string): any | null {
    const cached = this.cache[key];
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      console.log(`📋 MLB API: Using cached data for ${key}`);
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache[key] = { data, timestamp: Date.now() };
  }

  async getTodaysGames(date?: string): Promise<any[]> {
    const targetDate = date || getPacificDate();
    const cacheKey = `games_${targetDate}`;
    
    try {
      
      // Check cache first
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      // Rate limiting
      if (!this.canMakeCall('getTodaysGames')) {
        return this.getCached(cacheKey) || [];
      }
      
      const url = `${this.baseUrl}/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
      console.log(`🔄 MLB API: Fetching today's games for ${targetDate}`);

      const response = await protectedFetch(mlbApiCircuit, url);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.dates || data.dates.length === 0) {
        return [];
      }

      const games = data.dates[0].games || [];

      const processedGames = games.map((game: any) => {
        
        // Extract live scores from linescore data for live games, fallback to team score for others
        const homeScore = game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0;
        const awayScore = game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0;
        
        return {
          id: game.gamePk.toString(),
          homeTeam: { id: game.teams.home.team.id.toString(), name: game.teams.home.team.name, abbreviation: game.teams.home.team.abbreviation, score: homeScore },
          awayTeam: { id: game.teams.away.team.id.toString(), name: game.teams.away.team.name, abbreviation: game.teams.away.team.abbreviation, score: awayScore },
          status: this.mapGameStatus(game.status.detailedState),
          startTime: game.gameDate,
          venue: game.venue.name,
          inning: game.linescore?.currentInning || null,
          inningState: game.linescore?.inningState || null,
          isLive: game.status.abstractGameState === 'Live'
        };
      });

      // Cache the result
      this.setCache(cacheKey, processedGames);
      return processedGames;
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      // Return cached data if available during error
      return this.getCached(cacheKey) || [];
    }
  }

  async getLiveFeed(gameId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/game/${gameId}/feed/live`;
      const response = await protectedFetch(mlbApiCircuit, url);
      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching live feed:', error);
      return null;
    }
  }

  async getEnhancedGameData(gameId: string): Promise<any> {
    const cacheKey = `enhanced_${gameId}`;
    
    try {
      
      // Check cache first
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      // Rate limiting
      if (!this.canMakeCall(`getEnhancedGameData_${gameId}`)) {
        return this.getCached(cacheKey) || this.getFallbackGameData();
      }

      console.log(`🔄 MLB API: Fetching enhanced data for game ${gameId}`);
      const response = await protectedFetch(
        mlbApiCircuit,
        `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`
      );

      if (!response.ok) {
        throw new Error(`MLB API request failed: ${response.status}`);
      }

      const data = await response.json();
      const liveData = data.liveData || {};
      const gameData = data.gameData || {};
      const linescore = liveData.linescore || {};
      const currentPlay = liveData.plays?.currentPlay;

      // Extract base runner information from current play or linescore
      const runners = { first: false, second: false, third: false };

      // First try current play runners
      if (currentPlay?.runners) {
        currentPlay.runners.forEach((runner: any) => {
          if (runner.movement?.end === '1B') runners.first = true;
          if (runner.movement?.end === '2B') runners.second = true;
          if (runner.movement?.end === '3B') runners.third = true;
        });
      }

      // Also check offense data for runners
      const offense = linescore.offense;
      if (offense) {
        if (offense.first) runners.first = true;
        if (offense.second) runners.second = true;
        if (offense.third) runners.third = true;
      }

      // Get count and outs
      const count = currentPlay?.count || {};
      const balls = count.balls || 0;
      const strikes = count.strikes || 0;
      const outs = linescore.outs || 0;

      // Get inning information
      const inning = linescore.currentInning || 1;
      const isTopInning = linescore.inningState === 'Top';

      // Extract live scores from the feed/live endpoint
      const homeScore = linescore?.teams?.home?.runs ?? 0;
      const awayScore = linescore?.teams?.away?.runs ?? 0;

      // Extract lineup and batter information for predictive analysis
      const lineupData = this.extractLineupData(liveData, gameData, isTopInning);
      const currentBatter = currentPlay?.batter?.fullName || null;
      const currentPitcher = currentPlay?.pitcher?.fullName || null;

      console.log(`🔍 Live data for game ${gameId}:`, {
        runners, balls, strikes, outs, inning, isTopInning, homeScore, awayScore, currentBatter, currentPitcher
      });

      const enhancedData = {
        runners,
        balls,
        strikes,
        outs,
        inning,
        isTopInning,
        homeScore,
        awayScore,
        gameState: liveData.gameState,
        lineupData,
        currentBatter,
        currentPitcher,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, enhancedData);
      return enhancedData;
    } catch (error) {
      console.error('Error fetching enhanced game data:', error);
      return this.getCached(cacheKey) || this.getFallbackGameData();
    }
  }

  private extractLineupData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      // Extract lineup information for the batting team
      const battingTeam = isTopInning ? 'away' : 'home';
      const probablePitchers = gameData.probablePitchers || {};
      const teams = gameData.teams || {};
      const offense = liveData.linescore?.offense || {};
      
      // Get current batting order position
      const battingOrder = offense.battingOrder || 1;
      
      // In a real implementation, this would extract full lineup data
      // For now, we'll provide deterministic batting order progression
      const lineupPosition = battingOrder;
      const nextBatterPosition = (battingOrder % 9) + 1;
      const onDeckPosition = ((battingOrder + 1) % 9) + 1;
      
      return {
        battingTeam,
        currentBatterOrder: lineupPosition,
        nextBatterOrder: nextBatterPosition,
        onDeckBatterOrder: onDeckPosition,
        // Deterministic lineup strength based on batting order position
        currentBatterStrength: this.getBatterStrengthByPosition(lineupPosition),
        nextBatterStrength: this.getBatterStrengthByPosition(nextBatterPosition),
        onDeckBatterStrength: this.getBatterStrengthByPosition(onDeckPosition)
      };
    } catch (error) {
      console.error('Error extracting lineup data:', error);
      return {
        battingTeam: isTopInning ? 'away' : 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      };
    }
  }

  private getBatterStrengthByPosition(position: number): 'elite' | 'strong' | 'average' | 'weak' {
    // Standard MLB batting order strength patterns (deterministic)
    if (position >= 1 && position <= 2) return 'elite';   // 1-2: Best contact/speed hitters
    if (position >= 3 && position <= 5) return 'strong';  // 3-5: Best power hitters
    if (position >= 6 && position <= 7) return 'average'; // 6-7: Average hitters
    return 'weak'; // 8-9: Weakest hitters (including pitcher in NL)
  }

  private getFallbackGameData() {
    return {
      runners: { first: false, second: false, third: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      isTopInning: true,
      lineupData: {
        battingTeam: 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      },
      currentBatter: null,
      currentPitcher: null,
      error: 'Failed to fetch live data'
    };
  }

  private mapGameStatus(detailedState: string): string {
    const lowerState = detailedState.toLowerCase();

    if (lowerState.includes('progress') || lowerState.includes('live') || lowerState.includes('inning')) {
      return 'live';
    }
    if (lowerState.includes('final') || lowerState.includes('completed')) {
      return 'final';
    }
    if (lowerState.includes('delayed') || lowerState.includes('postponed')) {
      return 'delayed';
    }

    return 'scheduled';
  }
}

// Export a singleton instance
export const mlbApiService = new MLBApiService();