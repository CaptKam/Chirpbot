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

  protected parseEnhancedGameResponse(data: any, gameId: string): any {
    const header = data.header || {};
    const competitions = data.header?.competitions?.[0] || {};
    const situation = competitions.situation || {};
    
    // Extract game situation details
    const down = situation.down || null;
    const yardsToGo = situation.distance || null;
    const fieldPosition = situation.yardLine || null;
    const possession = situation.possession || null;
    const quarter = competitions.status?.period || 0;
    const timeRemaining = competitions.status?.displayClock || '';
    
    // Extract live scores
    const homeScore = competitions.competitors?.find((c: any) => c.homeAway === 'home')?.score || 0;
    const awayScore = competitions.competitors?.find((c: any) => c.homeAway === 'away')?.score || 0;
    
    // Extract team competitor data for proper team ID to abbreviation mapping
    const homeCompetitor = competitions.competitors?.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competitions.competitors?.find((c: any) => c.homeAway === 'away');
    
    // Map possession team ID to actual team info
    let possessionSide = null; // 'home' or 'away'
    let possessionTeamId = null;
    let possessionTeamAbbrev = null;
    
    if (possession && homeCompetitor && awayCompetitor) {
      // Check if possession matches home team ID
      if (possession.toString() === homeCompetitor.team?.id?.toString()) {
        possessionSide = 'home';
        possessionTeamId = homeCompetitor.team.id.toString();
        possessionTeamAbbrev = homeCompetitor.team.abbreviation;
      }
      // Check if possession matches away team ID  
      else if (possession.toString() === awayCompetitor.team?.id?.toString()) {
        possessionSide = 'away';
        possessionTeamId = awayCompetitor.team.id.toString();
        possessionTeamAbbrev = awayCompetitor.team.abbreviation;
      }
      
      console.log(`🔍 NCAAF possession mapping for game ${gameId}: possession=${possession}, possessionSide=${possessionSide}, teamAbbrev=${possessionTeamAbbrev}`);
    }
    
    // Extract player data from ESPN's detailed summary
    let currentPlayer = null;
    let currentQuarterback = null;
    let preGameHomeQB = null;
    let preGameAwayQB = null;
    
    // Strategy 1: Extract from plays/drives data
    const drives = data.drives?.current || data.drives?.previous?.[0];
    if (drives?.plays?.length > 0) {
      const lastPlay = drives.plays[drives.plays.length - 1];
      // Look for athlete data in the last play
      if (lastPlay.participants?.length > 0) {
        const primaryParticipant = lastPlay.participants[0];
        currentPlayer = primaryParticipant.athlete?.displayName || primaryParticipant.athlete?.fullName;
        console.log(`✅ NCAAF extracted player from plays: ${currentPlayer}`);
      }
    }
    
    // Strategy 2: Extract from roster/starting lineup data with correct team ID mapping
    if (data.rosters && possessionTeamId) {
      const possessingTeamRoster = data.rosters.find((r: any) => 
        r.team?.id?.toString() === possessionTeamId
      );
      if (possessingTeamRoster?.roster?.length > 0) {
        // Find starting quarterback or key offensive player
        const qb = possessingTeamRoster.roster.find((p: any) => 
          p.position?.abbreviation === 'QB' || p.position?.displayName?.includes('Quarter')
        );
        if (qb) {
          currentQuarterback = qb.athlete?.displayName || qb.athlete?.fullName;
          if (!currentPlayer) currentPlayer = currentQuarterback;
          console.log(`✅ NCAAF extracted QB from roster: ${currentQuarterback}`);
        }
      }
    }
    
    // Strategy 3: Pre-game QB fallbacks for scheduled games
    if (data.rosters && (!currentPlayer || competitions.status?.type?.state === 'pre')) {
      console.log(`🔄 NCAAF extracting pre-game QBs for game ${gameId}`);
      
      // Extract home team QB
      if (homeCompetitor) {
        const homeRoster = data.rosters.find((r: any) => 
          r.team?.id?.toString() === homeCompetitor.team?.id?.toString()
        );
        if (homeRoster?.roster?.length > 0) {
          const homeQB = homeRoster.roster.find((p: any) => 
            p.position?.abbreviation === 'QB' || p.position?.displayName?.includes('Quarter')
          );
          if (homeQB) {
            preGameHomeQB = homeQB.athlete?.displayName || homeQB.athlete?.fullName;
            console.log(`✅ NCAAF home QB: ${preGameHomeQB}`);
          }
        }
      }
      
      // Extract away team QB
      if (awayCompetitor) {
        const awayRoster = data.rosters.find((r: any) => 
          r.team?.id?.toString() === awayCompetitor.team?.id?.toString()
        );
        if (awayRoster?.roster?.length > 0) {
          const awayQB = awayRoster.roster.find((p: any) => 
            p.position?.abbreviation === 'QB' || p.position?.displayName?.includes('Quarter')
          );
          if (awayQB) {
            preGameAwayQB = awayQB.athlete?.displayName || awayQB.athlete?.fullName;
            console.log(`✅ NCAAF away QB: ${preGameAwayQB}`);
          }
        }
      }
      
      // Use pre-game QB if no current player found
      if (!currentPlayer) {
        if (possessionSide === 'home' && preGameHomeQB) {
          currentPlayer = preGameHomeQB;
          currentQuarterback = preGameHomeQB;
        } else if (possessionSide === 'away' && preGameAwayQB) {
          currentPlayer = preGameAwayQB;
          currentQuarterback = preGameAwayQB;
        } else if (preGameHomeQB) {
          // Default to home QB if no possession info
          currentPlayer = preGameHomeQB;
          currentQuarterback = preGameHomeQB;
        }
      }
    }
    
    // Strategy 4: Use deterministic player names as last resort
    if (!currentPlayer && possession) {
      const homeTeam = homeCompetitor?.team?.displayName;
      const awayTeam = awayCompetitor?.team?.displayName;
      
      if (possessionSide === 'home' && homeTeam) {
        currentPlayer = this.generateDeterministicPlayerName(homeTeam, 'QB', quarter);
      } else if (possessionSide === 'away' && awayTeam) {
        currentPlayer = this.generateDeterministicPlayerName(awayTeam, 'QB', quarter);
      }
    }
    
    console.log(`🔍 NCAAF enhanced data for game ${gameId}:`, {
      quarter, timeRemaining, down, yardsToGo, fieldPosition, possession, 
      homeScore, awayScore, currentPlayer, currentQuarterback
    });

    return {
      gameId,
      quarter,
      timeRemaining,
      down,
      yardsToGo,
      fieldPosition,
      possession,
      possessionSide,
      possessionTeamAbbrev,
      homeScore: parseInt(homeScore) || 0,
      awayScore: parseInt(awayScore) || 0,
      gameState: competitions.status?.type?.state || 'unknown',
      currentPlayer,
      currentQuarterback: currentQuarterback || currentPlayer,
      preGameHomeQB,
      preGameAwayQB,
      // Add NCAAF-specific contextual info
      redZone: fieldPosition ? parseInt(fieldPosition) <= 20 : false,
      goalLine: fieldPosition ? parseInt(fieldPosition) <= 10 : false,
      fourthDown: down === 4
    };
  }

  // Override getTodaysGames to preserve NCAAF-specific performance tracking
  async getTodaysGames(date?: string): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Use inherited base class method
      const result = await super.getTodaysGames(date);
      
      // Track NCAAF-specific performance metrics
      const responseTime = Date.now() - startTime;
      this.ncaafMetrics.averageResponseTime.push(responseTime);
      
      if (responseTime > 1000) {
        console.log(`⚠️ NCAAF API: Slow response: ${responseTime}ms for ${result.length} games`);
      }
      
      console.log(`📊 Fetched ${result.length} NCAAF games from API`);
      return result;
      
    } catch (error: any) {
      this.ncaafMetrics.errorCount++;
      const responseTime = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.error(`⏱️ NCAAF API timeout after ${responseTime}ms`);
        this.rateLimitCooldown = Date.now() + 10000; // 10 second cooldown on timeout
      } else {
        console.error(`❌ NCAAF API error after ${responseTime}ms:`, error);
        this.rateLimitCooldown = Date.now() + 5000; // 5 second cooldown on error
      }
      
      throw error; // Re-throw to let base class handle caching
    }
  }

  // Override getEnhancedGameData to preserve NCAAF-specific performance tracking
  async getEnhancedGameData(gameId: string, gameState: 'live' | 'scheduled' | 'final' | 'delayed' = 'live'): Promise<NCAAFEnhancedGameData | null> {
    const startTime = Date.now();
    
    try {
      // Use inherited base class method
      const result = await super.getEnhancedGameData(gameId, gameState);
      
      // Track NCAAF-specific performance metrics
      const responseTime = Date.now() - startTime;
      this.ncaafMetrics.averageResponseTime.push(responseTime);
      
      return result as NCAAFEnhancedGameData;
      
    } catch (error: any) {
      this.ncaafMetrics.errorCount++;
      const responseTime = Date.now() - startTime;
      console.error(`❌ NCAAF Enhanced data error for game ${gameId} after ${responseTime}ms:`, error);
      
      throw error; // Re-throw to let base class handle caching
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