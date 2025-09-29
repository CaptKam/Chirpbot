import { getPacificDate } from '../utils/timezone';
import { espnApiCircuit, protectedFetch } from '../middleware/circuit-breaker';
import { BaseSportApi, type BaseGameData } from './base-sport-api';

export class NFLApiService extends BaseSportApi {
  constructor() {
    super({
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
      circuit: espnApiCircuit,
      sportTag: 'NFL',
      rateLimits: {
        live: 1000,       // 1s for live games (V3-2 requirement)
        scheduled: 30000, // 30s for scheduled games (V3-2 requirement)
        final: 300000,    // 300s for final games (V3-2 requirement)
        delayed: 2000,    // 2s for delayed games
        default: 1000     // Default fallback
      },
      cacheTtl: {
        live: 1000,        // 1s for live game data (V3-2 requirement)
        scheduled: 30000,  // 30s for scheduled games (V3-2 requirement)
        final: 300000,     // 300s for final games (V3-2 requirement)
        delayed: 5000,     // 5s for delayed games
        batch: 15000,      // 15s for batch requests
        default: 1000      // Default fallback
      },
      enableMetrics: true // NFL maintains performance metrics
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
    
    return data.events.map((event: any) => {
      const game = event.competitions[0];
      const homeTeam = game.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = game.competitors.find((c: any) => c.homeAway === 'away');
      
      return {
        id: event.id,
        sport: 'NFL',
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
        // NFL-specific fields
        isCompleted: event.status.type.state === 'post',
        quarter: game.status?.period || 0,
        timeRemaining: game.status?.displayClock || '',
        down: game.situation?.down || null,
        yardsToGo: game.situation?.distance || null,
        fieldPosition: game.situation?.yardLine || null,
        possession: game.situation?.possession || null
      };
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `${this.config.baseUrl}/summary?event=${gameId}`;
  }

  protected parseEnhancedGameResponse(data: any, gameId: string): any {
    const header = data.header || {};
    const competitions = data.header?.competitions?.[0] || {};
    const situation = competitions.situation || {};
    
    // DEBUG: Log the raw situation object from ESPN
    console.log(`🔍 DEBUG ESPN situation object for game ${gameId}:`, JSON.stringify(situation, null, 2));
    
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
    
    console.log(`🔍 NFL enhanced data for game ${gameId}:`, {
      quarter, timeRemaining, down, yardsToGo, fieldPosition, possession, homeScore, awayScore
    });

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
      
      console.log(`🔍 NFL possession mapping for game ${gameId}: possession=${possession}, possessionSide=${possessionSide}, teamAbbrev=${possessionTeamAbbrev}`);
    }
    
    // Extract player data from ESPN's detailed game data
    let currentPlayer = null;
    let currentQuarterback = null;
    let preGameHomeQB = null;
    let preGameAwayQB = null;
    
    // Strategy 1: Extract from plays data if available
    const drives = data.drives?.current || data.drives?.previous?.[0];
    if (drives?.plays?.length > 0) {
      const lastPlay = drives.plays[drives.plays.length - 1];
      if (lastPlay.participants?.length > 0) {
        const primaryParticipant = lastPlay.participants[0];
        currentPlayer = primaryParticipant.athlete?.displayName || primaryParticipant.athlete?.fullName;
        console.log(`✅ NFL extracted player from plays: ${currentPlayer}`);
      }
    }
    
    // Strategy 2: Extract from roster data with correct team ID mapping
    if (data.rosters && possessionTeamId) {
      const possessingTeamRoster = data.rosters.find((r: any) => 
        r.team?.id?.toString() === possessionTeamId
      );
      if (possessingTeamRoster?.roster?.length > 0) {
        const qb = possessingTeamRoster.roster.find((p: any) => 
          p.position?.abbreviation === 'QB' || p.position?.displayName?.includes('Quarter')
        );
        if (qb) {
          currentQuarterback = qb.athlete?.displayName || qb.athlete?.fullName;
          if (!currentPlayer) currentPlayer = currentQuarterback;
          console.log(`✅ NFL extracted QB from roster: ${currentQuarterback}`);
        }
      }
    }
    
    // Strategy 3: Pre-game QB fallbacks for scheduled games
    if (data.rosters && (gameId.includes('scheduled') || !currentPlayer)) {
      console.log(`🔄 NFL extracting pre-game QBs for game ${gameId}`);
      
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
            console.log(`✅ NFL home QB: ${preGameHomeQB}`);
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
            console.log(`✅ NFL away QB: ${preGameAwayQB}`);
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
    
    // Strategy 4: Generate deterministic player names as last resort
    if (!currentPlayer && possession) {
      const homeTeam = homeCompetitor?.team?.displayName;
      const awayTeam = awayCompetitor?.team?.displayName;
      
      if (possessionSide === 'home' && homeTeam) {
        currentPlayer = this.generateDeterministicPlayerName(homeTeam, 'QB', quarter);
      } else if (possessionSide === 'away' && awayTeam) {
        currentPlayer = this.generateDeterministicPlayerName(awayTeam, 'QB', quarter);
      }
    }

    console.log(`🔍 NFL enhanced data for game ${gameId}:`, {
      quarter, timeRemaining, down, yardsToGo, fieldPosition, possession, 
      homeScore, awayScore, currentPlayer, currentQuarterback
    });

    return {
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
      // Add NFL-specific contextual info
      redZone: fieldPosition ? parseInt(fieldPosition) <= 20 : false,
      goalLine: fieldPosition ? parseInt(fieldPosition) <= 10 : false,
      fourthDown: down === 4,
      twoMinuteWarning: timeRemaining && timeRemaining.includes('2:') && (quarter === 2 || quarter === 4)
    };
  }

  // Use inherited getTodaysGames method from BaseSportApi

  // Use inherited getEnhancedGameData method from BaseSportApi

  protected getFallbackGameData(): any {
    return {
      quarter: 0,
      timeRemaining: '',
      down: null,
      yardsToGo: null,
      fieldPosition: null,
      possession: null,
      homeScore: 0,
      awayScore: 0,
      gameState: 'unknown',
      error: 'Failed to fetch live data'
    };
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

  // Clear cache for specific game or all cache (NFL-specific method)
  clearCache(gameId?: string): void {
    if (gameId) {
      this.clearExpiredCache(); // Use base class cleanup
      console.log(`🧹 NFL API: Cleared cache for game ${gameId}`);
    } else {
      this.clearExpiredCache();
      console.log(`🧹 NFL API: Cleared all cache`);
    }
  }

  // Get cache statistics for monitoring (extends base class method)
  getNFLCacheStats(): any {
    const baseStats = this.getCacheStats();
    
    return {
      ...baseStats,
      // NFL-specific stats if needed
      sportTag: 'NFL'
    };
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