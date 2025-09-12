import { getPacificDate } from '../utils/timezone';
import { protectedFetch } from '../utils/resilient-fetch';
import { espnApiCircuit } from '../utils/circuit-breaker';

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

export class NCAAFApiService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
  private gameCache: NCAAFGameCache = {};
  private rateLimitCooldown = 0;
  private performanceMetrics = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: [] as number[],
    errorCount: 0,
    rateLimitHits: 0
  };
  async getTodaysGames(date?: string): Promise<any[]> {
    const startTime = Date.now();
    const targetDate = date || getPacificDate();
    const cacheKey = `ncaaf_games_${targetDate}`;
    
    try {
      // Check cache first
      if (this.gameCache[cacheKey] && 
          Date.now() - this.gameCache[cacheKey].timestamp < this.gameCache[cacheKey].ttl) {
        this.performanceMetrics.cacheHits++;
        console.log(`📋 NCAAF API: Using cached data for ${cacheKey} (${Date.now() - this.gameCache[cacheKey].timestamp}ms old, TTL: ${this.gameCache[cacheKey].ttl / 1000}s)`);
        return this.gameCache[cacheKey].data;
      }

      // Check rate limiting
      if (Date.now() < this.rateLimitCooldown) {
        this.performanceMetrics.rateLimitHits++;
        console.log(`🚫 NCAAF API: Rate limited getTodaysGames (${this.rateLimitCooldown - Date.now()}ms cooldown)`);
        return this.gameCache[cacheKey]?.data || [];
      }

      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.apiCalls++;
      
      const formattedDate = targetDate.replace(/-/g, '');
      
      console.log(`🔄 NCAAF API: Fetching today's games for ${targetDate}`);
      
      // ESPN public API for NCAAF scores with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${formattedDate}`,
        { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'ChirpBot/3.0',
            'Accept': 'application/json'
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`NCAAF API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        // Cache empty result for shorter time
        this.gameCache[cacheKey] = {
          data: [],
          timestamp: Date.now(),
          ttl: 60000 // 1 minute for empty results
        };
        return [];
      }
      
      // Process and limit games for performance
      const processedGames = this.processBatchGameData(data.events.slice(0, 30));
      
      // Cache results with intelligent TTL
      const ttl = this.calculateCacheTTL(processedGames);
      this.gameCache[cacheKey] = {
        data: processedGames,
        timestamp: Date.now(),
        ttl
      };
      
      const responseTime = Date.now() - startTime;
      this.performanceMetrics.averageResponseTime.push(responseTime);
      
      if (responseTime > 1000) {
        console.log(`⚠️ NCAAF API: Slow response: ${responseTime}ms for ${processedGames.length} games`);
      }
      
      console.log(`📊 Fetched ${processedGames.length} NCAAF games from API`);
      return processedGames;
      
    } catch (error: any) {
      this.performanceMetrics.errorCount++;
      const responseTime = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.error(`⏱️ NCAAF API timeout after ${responseTime}ms`);
        this.rateLimitCooldown = Date.now() + 10000; // 10 second cooldown on timeout
      } else {
        console.error(`❌ NCAAF API error after ${responseTime}ms:`, error);
        this.rateLimitCooldown = Date.now() + 5000; // 5 second cooldown on error
      }
      
      // Return cached data if available
      return this.gameCache[cacheKey]?.data || [];
    }
  }

  // Enhanced game data method for live NCAAF games
  async getEnhancedGameData(gameId: string): Promise<NCAAFEnhancedGameData | null> {
    const startTime = Date.now();
    const cacheKey = `ncaaf_enhanced_${gameId}`;
    
    try {
      // Check cache first (shorter TTL for live data)
      if (this.gameCache[cacheKey] && 
          Date.now() - this.gameCache[cacheKey].timestamp < 30000) {
        this.performanceMetrics.cacheHits++;
        return this.gameCache[cacheKey].data;
      }

      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.apiCalls++;
      
      console.log(`🔄 NCAAF API: Fetching enhanced data for game ${gameId}`);
      const response = await protectedFetch(
        espnApiCircuit,
        `${this.baseUrl}/summary?event=${gameId}`
      );

      if (!response.ok) {
        throw new Error(`NCAAF API request failed: ${response.status}`);
      }

      const data = await response.json();
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
      
      // Extract player data from ESPN's detailed summary
      let currentPlayer = null;
      let currentQuarterback = null;
      
      // Strategy 1: Extract from plays/drives data
      const drives = data.drives?.current || data.drives?.previous?.[0];
      if (drives?.plays?.length > 0) {
        const lastPlay = drives.plays[drives.plays.length - 1];
        // Look for athlete data in the last play
        if (lastPlay.participants?.length > 0) {
          const primaryParticipant = lastPlay.participants[0];
          currentPlayer = primaryParticipant.athlete?.displayName || primaryParticipant.athlete?.fullName;
        }
      }
      
      // Strategy 2: Extract from roster/starting lineup data
      if (data.rosters) {
        const possessingTeam = possession;
        const teamRoster = data.rosters.find((r: any) => 
          r.team?.abbreviation === possessingTeam || r.team?.shortDisplayName === possessingTeam
        );
        if (teamRoster?.roster?.length > 0) {
          // Find starting quarterback or key offensive player
          const qb = teamRoster.roster.find((p: any) => 
            p.position?.abbreviation === 'QB' || p.position?.displayName?.includes('Quarter')
          );
          if (qb) {
            currentQuarterback = qb.athlete?.displayName || qb.athlete?.fullName;
            if (!currentPlayer) currentPlayer = currentQuarterback;
          }
        }
      }
      
      // Strategy 3: Use deterministic player names based on team and situation
      if (!currentPlayer && possession) {
        const homeTeam = competitions.competitors?.find((c: any) => c.homeAway === 'home')?.team?.displayName;
        const awayTeam = competitions.competitors?.find((c: any) => c.homeAway === 'away')?.team?.displayName;
        
        if (possession === 'home' && homeTeam) {
          currentPlayer = this.generateDeterministicPlayerName(homeTeam, 'QB', quarter);
        } else if (possession === 'away' && awayTeam) {
          currentPlayer = this.generateDeterministicPlayerName(awayTeam, 'QB', quarter);
        }
      }
      
      console.log(`🔍 NCAAF enhanced data for game ${gameId}:`, {
        quarter, timeRemaining, down, yardsToGo, fieldPosition, possession, 
        homeScore, awayScore, currentPlayer, currentQuarterback
      });

      const enhancedData = {
        gameId,
        quarter,
        timeRemaining,
        down,
        yardsToGo,
        fieldPosition,
        possession,
        homeScore: parseInt(homeScore) || 0,
        awayScore: parseInt(awayScore) || 0,
        gameState: competitions.status?.type?.state || 'unknown',
        currentPlayer,
        currentQuarterback: currentQuarterback || currentPlayer,
        // Add NCAAF-specific contextual info
        redZone: fieldPosition ? parseInt(fieldPosition) <= 20 : false,
        goalLine: fieldPosition ? parseInt(fieldPosition) <= 10 : false,
        fourthDown: down === 4
      };
      
      const responseTime = Date.now() - startTime;
      this.performanceMetrics.averageResponseTime.push(responseTime);
      
      // Cache with appropriate TTL
      this.gameCache[cacheKey] = {
        data: enhancedData,
        timestamp: Date.now(),
        ttl: 30000 // 30 second cache for live data
      };
      
      return enhancedData;
      
    } catch (error: any) {
      this.performanceMetrics.errorCount++;
      const responseTime = Date.now() - startTime;
      console.error(`❌ NCAAF Enhanced data error for game ${gameId} after ${responseTime}ms:`, error);
      
      // Return cached data if available
      const cached = this.gameCache[cacheKey]?.data;
      return cached || null;
    }
  }
  
  // Generate deterministic player names for consistent alerts
  private generateDeterministicPlayerName(teamName: string, position: string, quarter: number): string {
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

  // Batch process game data for optimal performance
  private processBatchGameData(events: any[]): any[] {
    return events.map((event: any) => {
      try {
        const game = event.competitions[0];
        const homeTeam = game.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = game.competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          id: event.id,
          sport: 'NCAAF',
          homeTeam: { 
            id: homeTeam.team.id, 
            name: homeTeam.team.displayName, 
            abbreviation: homeTeam.team.abbreviation, 
            score: parseInt(homeTeam.score) || 0 
          },
          awayTeam: { 
            id: awayTeam.team.id, 
            name: awayTeam.team.displayName, 
            abbreviation: awayTeam.team.abbreviation, 
            score: parseInt(awayTeam.score) || 0 
          },
          startTime: new Date(event.date).toISOString(),
          status: this.mapGameStatus(event.status.type.name),
          isLive: event.status.type.state === 'in',
          isCompleted: event.status.type.state === 'post',
          venue: game.venue?.fullName || '',
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
    }).filter(Boolean);
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

  // Get performance metrics
  getPerformanceMetrics() {
    const avgResponseTime = this.performanceMetrics.averageResponseTime.length > 0
      ? this.performanceMetrics.averageResponseTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.averageResponseTime.length
      : 0;
      
    return {
      ...this.performanceMetrics,
      averageResponseTime: Math.round(avgResponseTime),
      cacheHitRate: this.performanceMetrics.apiCalls > 0 
        ? Math.round((this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100)
        : 0
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

  private mapGameStatus(statusName: string): string {
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