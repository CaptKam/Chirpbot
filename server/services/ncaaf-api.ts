import { getPacificDate } from '../utils/timezone';
import { espnApiCircuit, protectedFetch } from '../middleware/circuit-breaker';
import { BaseSportApi, type BaseGameData } from './base-sport-api';

interface NCAAFGameCache {
  [key: string]: {
    data: any;
    timestamp: number;
    ttl: number;
  };
}

interface NCAAFEnhancedGameData {
  gameId: string;
  quarter: number;
  timeRemaining: string;
  down?: number;
  yardsToGo?: number;
  fieldPosition?: number;
  possession?: string;
  homeScore: number;
  awayScore: number;
  homeRank?: number;
  awayRank?: number;
  error?: string;
}

export class NCAAFApiService extends BaseSportApi {
  private gameCache: NCAAFGameCache = {};
  private rateLimitCooldown = 0;
  private ncaafMetrics = {
    apiCalls: 0,
    averageResponseTime: [] as number[],
    errorCount: 0,
    rateLimitHits: 0
  };
  
  constructor() {
    super({
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football',
      circuit: espnApiCircuit,
      sportTag: 'NCAAF',
      rateLimits: {
        live: 8000,       // 8s for live games (NCAAF uses longer intervals)
        scheduled: 30000, // 30s for scheduled games
        final: 300000,    // 300s for final games
        delayed: 10000,   // 10s for delayed games
        default: 8000     // Default to 8s
      },
      cacheTtl: {
        live: 8000,        // 8s for live game data
        scheduled: 30000,  // 30s for scheduled games
        final: 300000,     // 300s for final games
        delayed: 10000,    // 10s for delayed games
        batch: 30000,      // 30s for batch requests
        default: 8000      // Default to 8s
      },
      enableMetrics: true // NCAAF maintains performance metrics
    });
  }
  // Abstract method implementations for BaseSportApi
  protected buildTodaysGamesUrl(targetDate: string): string {
    const formattedDate = targetDate.replace(/-/g, '');
    return `${this.config.baseUrl}/scoreboard?dates=${formattedDate}`;
  }

  protected parseGamesResponse(data: any): BaseGameData[] {
    if (!data.events || data.events.length === 0) {
      return [];
    }
    
    // Process and limit games for performance
    return this.processBatchGameData(data.events.slice(0, 30));
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `${this.config.baseUrl}/summary?event=${gameId}`;
  }

  protected async parseEnhancedGameResponse(data: any, gameId: string): Promise<any> {
    const competitions = data.header?.competitions?.[0] || {};
    const situation = competitions.situation || {};
    
    // Extract game situation details (optimized for speed)
    const down = situation.down || null;
    const yardsToGo = situation.distance || null;
    const fieldPosition = situation.yardLine || null;
    const possession = situation.possession || null;
    const quarter = competitions.status?.period || 0;
    const timeRemaining = competitions.status?.displayClock || '';
    
    // OPTIMIZED: Extract live scores and competitors in one pass (performance optimization)
    const competitors = competitions.competitors || [];
    let homeScore = 0, awayScore = 0, homeCompetitor = null, awayCompetitor = null;
    
    for (const competitor of competitors) {
      if (competitor.homeAway === 'home') {
        homeScore = parseInt(competitor.score) || 0;
        homeCompetitor = competitor;
      } else if (competitor.homeAway === 'away') {
        awayScore = parseInt(competitor.score) || 0;
        awayCompetitor = competitor;
      }
    }
    
    // OPTIMIZED: Map possession team ID to actual team info (reduced logging)
    let possessionSide = null;
    let possessionTeamId = null;
    let possessionTeamAbbrev = null;
    
    if (possession && homeCompetitor?.team && awayCompetitor?.team) {
      const homeTeamId = homeCompetitor.team.id?.toString();
      const awayTeamId = awayCompetitor.team.id?.toString();
      const possessionStr = possession.toString();
      
      if (possessionStr === homeTeamId) {
        possessionSide = 'home';
        possessionTeamId = homeTeamId;
        possessionTeamAbbrev = homeCompetitor.team.abbreviation;
      } else if (possessionStr === awayTeamId) {
        possessionSide = 'away';
        possessionTeamId = awayTeamId;
        possessionTeamAbbrev = awayCompetitor.team.abbreviation;
      }
    }
    
    // OPTIMIZED: Streamlined player extraction (fast single-pass approach)
    let currentPlayer = null;
    let currentQuarterback = null;
    let preGameHomeQB = null;
    let preGameAwayQB = null;
    
    // Fast extraction: Try plays data first (most common case for live games)
    const drives = data.drives?.current || data.drives?.previous?.[0];
    if (drives?.plays?.length > 0) {
      const lastPlay = drives.plays[drives.plays.length - 1];
      if (lastPlay.participants?.[0]?.athlete) {
        currentPlayer = lastPlay.participants[0].athlete.displayName || lastPlay.participants[0].athlete.fullName;
      }
    }
    
    // OPTIMIZED: Only proceed with roster lookup if we don't have a player and have roster data
    if (!currentPlayer && data.rosters) {
      // Create team roster map for faster lookups (single pass)
      const rosterMap = new Map();
      for (const roster of data.rosters) {
        if (roster.team?.id) {
          rosterMap.set(roster.team.id.toString(), roster);
        }
      }
      
      // Extract QBs efficiently
      const homeTeamId = homeCompetitor?.team?.id?.toString();
      const awayTeamId = awayCompetitor?.team?.id?.toString();
      
      // Get possessing team QB first (priority for live games)
      if (possessionTeamId && rosterMap.has(possessionTeamId)) {
        const possessingRoster = rosterMap.get(possessionTeamId);
        const qb = possessingRoster.roster?.find((p: any) => 
          p.position?.abbreviation === 'QB'
        );
        if (qb?.athlete) {
          currentPlayer = qb.athlete.displayName || qb.athlete.fullName;
          currentQuarterback = currentPlayer;
        }
      }
      
      // Extract pre-game QBs for fallback (single pass)
      if (homeTeamId && rosterMap.has(homeTeamId)) {
        const homeQB = rosterMap.get(homeTeamId).roster?.find((p: any) => p.position?.abbreviation === 'QB');
        if (homeQB?.athlete) preGameHomeQB = homeQB.athlete.displayName || homeQB.athlete.fullName;
      }
      
      if (awayTeamId && rosterMap.has(awayTeamId)) {
        const awayQB = rosterMap.get(awayTeamId).roster?.find((p: any) => p.position?.abbreviation === 'QB');
        if (awayQB?.athlete) preGameAwayQB = awayQB.athlete.displayName || awayQB.athlete.fullName;
      }
      
      // Use pre-game QBs as fallback
      if (!currentPlayer) {
        currentPlayer = possessionSide === 'home' ? preGameHomeQB : 
                       possessionSide === 'away' ? preGameAwayQB : 
                       (preGameHomeQB || preGameAwayQB);
        if (currentPlayer) currentQuarterback = currentPlayer;
      }
    }
    
    // Fast deterministic fallback (only if absolutely necessary)
    if (!currentPlayer && possession) {
      const teamName = possessionSide === 'home' ? homeCompetitor?.team?.displayName : awayCompetitor?.team?.displayName;
      if (teamName) {
        currentPlayer = this.generateDeterministicPlayerName(teamName, 'QB', quarter);
      }
    }

    // OPTIMIZED: Pre-calculate common values to avoid repeated operations
    const fieldPos = fieldPosition !== null && fieldPosition !== undefined ? parseInt(fieldPosition) : null;
    
    return {
      gameId,
      quarter,
      timeRemaining,
      down,
      yardsToGo,
      fieldPosition: fieldPos,
      possession,
      possessionSide,
      possessionTeamAbbrev,
      homeScore,
      awayScore,
      gameState: competitions.status?.type?.state || 'unknown',
      currentPlayer,
      currentQuarterback: currentQuarterback || currentPlayer,
      preGameHomeQB,
      preGameAwayQB,
      // Add NCAAF-specific contextual info (optimized calculations)
      redZone: fieldPos !== null && fieldPos <= 20,
      goalLine: fieldPos !== null && fieldPos <= 10,
      fourthDown: down === 4
    };
  }

  // OPTIMIZED: Reduced logging overhead in hot path
  async getTodaysGames(date?: string): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const result = await super.getTodaysGames(date);
      
      // Streamlined performance tracking (reduced overhead)
      const responseTime = Date.now() - startTime;
      this.ncaafMetrics.averageResponseTime.push(responseTime);
      
      // Only log if significantly slow (reduced console output)
      if (responseTime > 2000) {
        console.log(`⚠️ NCAAF API: Very slow response: ${responseTime}ms for ${result.length} games`);
      }
      
      return result;
      
    } catch (error: any) {
      this.ncaafMetrics.errorCount++;
      const responseTime = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        this.rateLimitCooldown = Date.now() + 10000;
      } else {
        this.rateLimitCooldown = Date.now() + 5000;
      }
      
      throw error;
    }
  }

  // OPTIMIZED: Streamlined enhanced data fetching with reduced overhead
  async getEnhancedGameData(gameId: string, gameState: 'live' | 'scheduled' | 'final' | 'delayed' = 'live'): Promise<NCAAFEnhancedGameData | null> {
    const startTime = Date.now();
    
    try {
      const result = await super.getEnhancedGameData(gameId, gameState);
      
      // Lightweight performance tracking
      const responseTime = Date.now() - startTime;
      this.ncaafMetrics.averageResponseTime.push(responseTime);
      
      // Only log if critically slow (reduced from previous thresholds)
      if (responseTime > 200) {
        console.log(`⚠️ NCAAF Slow game state enhancement: ${responseTime}ms for game ${gameId}`);
      }
      
      return result as NCAAFEnhancedGameData;
    } catch (error: any) {
      throw error;
    }
  }
  
  // Generate deterministic player names for consistent alerts
  public generateDeterministicPlayerName(teamName: string, position: string, quarter: number): string {
    // Create deterministic names based on team and context
    const teamAbbrev = teamName.split(' ').pop() || teamName.slice(0, 4);
    const quarterSuffix = quarter > 4 ? 'OT' : `Q${quarter}`;
    
    if (position === 'QB') {
      return `${teamAbbrev} ${quarterSuffix} Quarterback`;
    } else if (position === 'RB') {
      return `${teamAbbrev} ${quarterSuffix} Running Back`;
    } else if (position === 'WR') {
      return `${teamAbbrev} ${quarterSuffix} Receiver`;
    }
    
    return `${teamAbbrev} ${quarterSuffix} Player`;
  }

  // Batch process game data for optimal performance (NCAAF-specific method)
  private processBatchGameData(events: any[]): BaseGameData[] {
    return events.map((event: any) => {
      try {
        const game = event.competitions[0];
        const homeTeam = game.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = game.competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          id: event.id,
          sport: 'NCAAF',
          homeTeam: { 
            id: homeTeam.team.id.toString(), 
            name: homeTeam.team.displayName, 
            abbreviation: homeTeam.team.abbreviation, 
            score: parseInt(homeTeam.score) || 0 
          },
          awayTeam: { 
            id: awayTeam.team.id.toString(), 
            name: awayTeam.team.displayName, 
            abbreviation: awayTeam.team.abbreviation, 
            score: parseInt(awayTeam.score) || 0 
          },
          startTime: new Date(event.date).toISOString(),
          status: this.mapGameStatus(event.status.type.name),
          isLive: this.isGameLive(event, 'espn'),
          venue: game.venue?.fullName || '',
          // NCAAF-specific fields
          isCompleted: event.status.type.state === 'post',
          quarter: game.status?.period || 0,
          timeRemaining: game.status?.displayClock || '',
          down: game.status?.down || null,
          yardsToGo: game.status?.distance || null,
          fieldPosition: game.status?.yardLine || null,
          possession: game.status?.possessionTeam?.abbreviation || null,
          homeRank: homeTeam.curatedRank?.current || 0,
          awayRank: awayTeam.curatedRank?.current || 0
        };
      } catch (error) {
        console.error(`❌ NCAAF Error processing game ${event.id}:`, error);
        return null;
      }
    }).filter((game) => game !== null) as BaseGameData[];
  }

  // Calculate intelligent cache TTL based on game states
  private calculateCacheTTL(games: any[]): number {
    const liveGames = games.filter(game => game.isLive);
    
    if (liveGames.length > 0) {
      return 8000; // 8 seconds for live games
    } else {
      return 30000; // 30 seconds for scheduled/completed games
    }
  }

  // Get NCAAF-specific performance metrics
  getNCAAFPerformanceMetrics() {
    const avgResponseTime = this.ncaafMetrics.averageResponseTime.length > 0
      ? this.ncaafMetrics.averageResponseTime.reduce((a, b) => a + b, 0) / this.ncaafMetrics.averageResponseTime.length
      : 0;
      
    return {
      ...this.ncaafMetrics,
      averageResponseTime: Math.round(avgResponseTime)
    };
  }

  // Clear old cache entries
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of Object.entries(this.gameCache)) {
      if (now - entry.timestamp > entry.ttl) {
        delete this.gameCache[key];
      }
    }
  }

  protected mapGameStatus(statusName: string): string {
    const lowerStatus = statusName.toLowerCase();
    
    if (lowerStatus.includes('in_progress') || lowerStatus.includes('live') || lowerStatus.includes('status_in_progress')) {
      return 'live';
    }
    if (lowerStatus.includes('final') || lowerStatus.includes('status_final')) {
      return 'final';
    }
    if (lowerStatus.includes('postponed') || lowerStatus.includes('delayed') || lowerStatus.includes('status_postponed')) {
      return 'delayed';
    }
    
    return 'scheduled';
  }
}