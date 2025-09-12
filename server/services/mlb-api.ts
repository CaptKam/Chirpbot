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
    // Use 2024 season data if in future year
    const requestedDate = date || getPacificDate();
    const year = parseInt(requestedDate.split('-')[0]);
    
    // If year is 2025 or later, use 2024 season data with same month/day
    let targetDate = requestedDate;
    if (year >= 2025) {
      const [_, month, day] = requestedDate.split('-');
      targetDate = `2024-${month}-${day}`;
      console.log(`📅 MLB API: Using 2024 season data for date ${targetDate} (requested: ${requestedDate})`);
    }
    
    const cacheKey = `games_${targetDate}`;
    
    try {
      
      // Clear any mock cached data
      const cached = this.getCached(cacheKey);
      if (cached && cached.length > 0 && cached[0].id && !cached[0].id.startsWith('776')) {
        return cached;
      }
      
      // Rate limiting based on request type
      const gameState = requestType === 'batch' ? 'scheduled' : 'default';
      if (!this.canMakeCall('getTodaysGames', gameState)) {
        return [];
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
        
        // STRICT live detection - ONLY use official status, DO NOT use enhanced data
        const statusIndicatesLive = game.status.abstractGameState === 'Live' || 
                                   game.status.detailedState?.toLowerCase().includes('progress') ||
                                   game.status.detailedState?.toLowerCase().includes('inning');
        
        // Check if game is actually finished (respect final status)
        const isGameFinished = game.status.abstractGameState === 'Final' || 
                              game.status.detailedState?.toLowerCase().includes('final') ||
                              game.status.detailedState?.toLowerCase().includes('completed');
        
        // Check if game is in pre-game/scheduled state
        const isPreGameOrScheduled = game.status.abstractGameState === 'Preview' || 
                                   game.status.detailedState?.toLowerCase().includes('pre-game') ||
                                   game.status.detailedState?.toLowerCase().includes('scheduled') ||
                                   game.status.detailedState?.toLowerCase().includes('warmup');
        
        // ONLY mark as live if official status explicitly says so AND not in pre-game/final state
        const isLive = statusIndicatesLive && !isPreGameOrScheduled && !isGameFinished;
        
        // Use ONLY the mapped status from official API state - DO NOT override with isLive
        const finalStatus = this.mapGameStatus(game.status.detailedState);
        
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
      // Return empty array on error - no mock data
      return [];
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
        const cached = this.getCached(cacheKey);
        if (cached && !cached.error) return cached;
        throw new Error(`Rate limited for game ${gameId}`);
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
      
      // Enhanced player data extraction with multiple fallback strategies
      const playerData = this.extractPlayerData(liveData, gameData, isTopInning);
      const currentBatter = playerData.currentBatter;
      const currentPitcher = playerData.currentPitcher;
      const onDeckBatter = playerData.onDeckBatter;

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
        onDeckBatter,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result with state-specific TTL
      this.setCache(cacheKey, enhancedData, gameState);
      return enhancedData;
    } catch (error) {
      console.error('Error fetching enhanced game data:', error);
      // Return null instead of mock data
      return null;
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

  private extractPlayerData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      const currentPlay = liveData.plays?.currentPlay;
      const offense = liveData.linescore?.offense;
      const boxscore = liveData.boxscore;
      const teams = gameData.teams;
      
      let currentBatter = null;
      let currentPitcher = null;
      let onDeckBatter = null;
      
      // Strategy 1: Extract from current play data
      if (currentPlay) {
        currentBatter = currentPlay.batter?.fullName || currentPlay.matchup?.batter?.fullName;
        currentPitcher = currentPlay.pitcher?.fullName || currentPlay.matchup?.pitcher?.fullName;
      }
      
      // Strategy 2: Extract from offense data (linescore)
      if (!currentBatter && offense) {
        currentBatter = offense.batter?.fullName;
        currentPitcher = offense.pitcher?.fullName;
        onDeckBatter = offense.onDeck?.fullName;
      }
      
      // Strategy 3: Extract from boxscore lineup data
      if (boxscore && (!currentBatter || !onDeckBatter)) {
        const battingTeam = isTopInning ? 'away' : 'home';
        const teamBox = boxscore.teams?.[battingTeam];
        
        if (teamBox?.batters) {
          const batters = teamBox.batters;
          const battingOrder = offense?.battingOrder || 1;
          
          // Find current batter in lineup
          if (!currentBatter && batters.length > 0) {
            const currentBatterIndex = (battingOrder - 1) % batters.length;
            const batterId = batters[currentBatterIndex];
            const batterInfo = teamBox.players?.[`ID${batterId}`];
            currentBatter = batterInfo?.person?.fullName;
          }
          
          // Find on-deck batter
          if (!onDeckBatter && batters.length > 0) {
            const onDeckIndex = battingOrder % batters.length;
            const onDeckId = batters[onDeckIndex];
            const onDeckInfo = teamBox.players?.[`ID${onDeckId}`];
            onDeckBatter = onDeckInfo?.person?.fullName;
          }
        }
        
        // Extract pitching information
        if (!currentPitcher && teamBox) {
          const pitchingTeam = isTopInning ? 'home' : 'away';
          const pitchingBox = boxscore.teams?.[pitchingTeam];
          if (pitchingBox?.pitchers && pitchingBox.pitchers.length > 0) {
            // Get current pitcher (usually the last one in active pitchers)
            const activePitchers = pitchingBox.pitchers.filter((id: any) => {
              const pitcher = pitchingBox.players?.[`ID${id}`];
              return pitcher?.stats?.pitching?.inningsPitched !== "0.0";
            });
            
            if (activePitchers.length > 0) {
              const currentPitcherId = activePitchers[activePitchers.length - 1];
              const pitcherInfo = pitchingBox.players?.[`ID${currentPitcherId}`];
              currentPitcher = pitcherInfo?.person?.fullName;
            }
          }
        }
      }
      
      // Strategy 4: Generate player names from team rosters if still null
      if (!currentBatter || !currentPitcher || !onDeckBatter) {
        const fallbackData = this.generateFallbackPlayerData(gameData, isTopInning);
        currentBatter = currentBatter || fallbackData.currentBatter;
        currentPitcher = currentPitcher || fallbackData.currentPitcher;
        onDeckBatter = onDeckBatter || fallbackData.onDeckBatter;
      }
      
      return {
        currentBatter,
        currentPitcher,
        onDeckBatter
      };
    } catch (error) {
      console.error('Error extracting player data:', error);
      return this.generateFallbackPlayerData(gameData, isTopInning);
    }
  }

  private generateFallbackPlayerData(gameData: any, isTopInning: boolean): any {
    try {
      // Generate realistic player names from team data
      const battingTeam = isTopInning ? gameData.teams?.away : gameData.teams?.home;
      const pitchingTeam = isTopInning ? gameData.teams?.home : gameData.teams?.away;
      
      const teamName = battingTeam?.teamName || 'Team';
      const pitchingTeamName = pitchingTeam?.teamName || 'Team';
      
      // Extract real player names from API data
      const currentBatter = liveData.plays?.currentPlay?.matchup?.batter?.fullName || 
                           liveData.linescore?.offense?.batter?.fullName || 
                           null;
      const currentPitcher = liveData.plays?.currentPlay?.matchup?.pitcher?.fullName || 
                            liveData.linescore?.defense?.pitcher?.fullName || 
                            null;
      const onDeckBatter = liveData.linescore?.offense?.onDeck?.fullName || null;
      
      return {
        currentBatter,
        currentPitcher,
        onDeckBatter
      };
    } catch (error) {
      console.error('Error extracting player data:', error);
      return {
        currentBatter: null,
        currentPitcher: null, 
        onDeckBatter: null
      };
    }
  }

  // Removed getFallbackGameData - no more mock data generation

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