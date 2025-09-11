import { getPacificDate } from '../utils/timezone';
import { mlbApiCircuit, protectedFetch } from '../middleware/circuit-breaker';

export class MLBApiService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';
  private lastCall: { [key: string]: number } = {};
  private cache: { [key: string]: { data: any, timestamp: number, ttl: number } } = {};
  
  // Adaptive rate limiting based on game states
  private readonly RATE_LIMITS = {
    live: 200,        // 200ms for live games (high priority)
    scheduled: 5000,  // 5s for scheduled games
    final: 30000,     // 30s for final games
    delayed: 2000,    // 2s for delayed games
    default: 250      // Default fallback
  };

  // Adaptive cache TTL based on data type and game state
  private readonly CACHE_TTL = {
    live: 500,         // 500ms for live game data
    scheduled: 15000,  // 15s for scheduled games
    final: 120000,     // 2min for final games
    delayed: 5000,     // 5s for delayed games
    batch: 8000,       // 8s for batch requests
    default: 1000      // Default fallback
  };

  private canMakeCall(endpoint: string, gameState: string = 'default'): boolean {
    const now = Date.now();
    const lastCallTime = this.lastCall[endpoint] || 0;
    const rateLimit = this.RATE_LIMITS[gameState as keyof typeof this.RATE_LIMITS] || this.RATE_LIMITS.default;
    
    if (now - lastCallTime < rateLimit) {
      console.log(`🚫 MLB API: Rate limited ${endpoint} (${rateLimit}ms cooldown for ${gameState})`);
      return false;
    }
    
    this.lastCall[endpoint] = now;
    return true;
  }

  private getCached(key: string, forceCheck: boolean = false): any | null {
    const cached = this.cache[key];
    if (cached) {
      const age = Date.now() - cached.timestamp;
      const isExpired = age >= cached.ttl;
      
      if (!isExpired && !forceCheck) {
        console.log(`📋 MLB API: Using cached data for ${key} (${Math.round(age/1000)}s old, TTL: ${Math.round(cached.ttl/1000)}s)`);
        return cached.data;
      }
    }
    return null;
  }

  private setCache(key: string, data: any, cacheType: string = 'default'): void {
    const ttl = this.CACHE_TTL[cacheType as keyof typeof this.CACHE_TTL] || this.CACHE_TTL.default;
    this.cache[key] = { 
      data, 
      timestamp: Date.now(),
      ttl
    };
  }

  async getTodaysGames(date?: string, requestType: 'batch' | 'individual' = 'batch'): Promise<any[]> {
    const targetDate = date || getPacificDate();
    const cacheKey = `games_${targetDate}`;
    
    try {
      
      // Check cache first with appropriate TTL
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      // Rate limiting based on request type
      const gameState = requestType === 'batch' ? 'scheduled' : 'default';
      if (!this.canMakeCall('getTodaysGames', gameState)) {
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
        
        // Enhanced isLive detection - check multiple indicators of live game data
        const hasLinescore = !!game.linescore;
        const hasActiveInning = game.linescore?.currentInning > 0;
        const hasInningState = !!game.linescore?.inningState;
        const hasOuts = game.linescore?.outs !== undefined && game.linescore?.outs !== null;
        const hasRunners = game.linescore?.offense?.first || game.linescore?.offense?.second || game.linescore?.offense?.third;
        const hasActiveCount = game.linescore?.balls !== undefined || game.linescore?.strikes !== undefined;
        const statusIndicatesLive = game.status.abstractGameState === 'Live' || 
                                   game.status.detailedState?.toLowerCase().includes('progress') ||
                                   game.status.detailedState?.toLowerCase().includes('inning');
        
        // A game is live if:
        // 1. The abstractGameState says it's live OR
        // 2. We have rich live data indicators (linescore with active inning, outs data, etc.)
        const isLive = statusIndicatesLive || 
                      (hasLinescore && hasActiveInning && (hasInningState || hasOuts || hasRunners || hasActiveCount));
        
        if (isLive && !statusIndicatesLive) {
          console.log(`🔴 MLB: Game ${game.gamePk} marked as live due to live data indicators (abstractGameState: ${game.status.abstractGameState}, detailedState: ${game.status.detailedState})`);
        }
        
        // Compute initial status from API state
        const mappedStatus = this.mapGameStatus(game.status.detailedState);
        
        // Reconcile status with computed isLive (fixes status/isLive reconciliation issue)
        const finalStatus = isLive ? 'live' : mappedStatus;
        
        if (isLive && mappedStatus !== 'live') {
          console.log(`🔄 MLB: Game ${game.gamePk} status reconciled: ${mappedStatus} → live (isLive=true)`);
        }
        
        return {
          id: game.gamePk.toString(),
          homeTeam: { id: game.teams.home.team.id.toString(), name: game.teams.home.team.name, abbreviation: game.teams.home.team.abbreviation, score: homeScore },
          awayTeam: { id: game.teams.away.team.id.toString(), name: game.teams.away.team.name, abbreviation: game.teams.away.team.abbreviation, score: awayScore },
          status: finalStatus,
          startTime: game.gameDate,
          venue: game.venue.name,
          inning: game.linescore?.currentInning || null,
          inningState: game.linescore?.inningState || null,
          isLive: isLive
        };
      });

      // Cache the result with appropriate TTL
      this.setCache(cacheKey, processedGames, 'batch');
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

  async getEnhancedGameData(gameId: string, gameState: 'live' | 'scheduled' | 'final' | 'delayed' = 'live'): Promise<any> {
    const cacheKey = `enhanced_${gameId}`;
    
    try {
      
      // Check cache first with state-specific TTL
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
      
      // Rate limiting based on game state
      if (!this.canMakeCall(`getEnhancedGameData_${gameId}`, gameState)) {
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

      // Cache the result with state-specific TTL
      this.setCache(cacheKey, enhancedData, gameState);
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