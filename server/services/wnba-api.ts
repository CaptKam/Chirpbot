
import { getPacificDate } from '../utils/timezone';
import { BaseSportApi, type BaseGameData } from './base-sport-api';
import { espnApiCircuit } from '../middleware/circuit-breaker';

export class WNBAApiService extends BaseSportApi {
  constructor() {
    super({
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba',
      circuit: espnApiCircuit,
      sportTag: 'WNBA',
      rateLimits: {
        live: 1000,       // 1s for live games
        scheduled: 30000, // 30s for scheduled games
        final: 300000,    // 300s for final games
        delayed: 5000,    // 5s for delayed games
        default: 1000     // Default fallback
      },
      cacheTtl: {
        live: 1000,        // 1s for live game data
        scheduled: 30000,  // 30s for scheduled games
        final: 300000,     // 300s for final games
        delayed: 5000,     // 5s for delayed games
        batch: 15000,      // 15s for batch requests
        default: 1000      // Default fallback
      }
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
        sport: 'WNBA',
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
        // WNBA specific fields preserved
        gameId: event.id,
        homeScore: parseInt(homeTeam.score) || 0,
        awayScore: parseInt(awayTeam.score) || 0,
        isCompleted: event.status.type.state === 'post',
        quarter: game.status?.period || 0,
        timeRemaining: game.status?.displayClock || '',
        period: game.status?.period || 0,
        clock: game.status?.displayClock || '',
        possession: game.situation?.possession || null
      };
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `${this.config.baseUrl}/summary?event=${gameId}`;
  }

  protected parseEnhancedGameResponse(data: any, gameId: string): any {
    const game = data.boxscore?.teams || [];
    const homeTeam = game.find((t: any) => t.homeAway === 'home');
    const awayTeam = game.find((t: any) => t.homeAway === 'away');
    
    return {
      gameId,
      homeScore: homeTeam?.statistics?.find((s: any) => s.name === 'points')?.displayValue || 0,
      awayScore: awayTeam?.statistics?.find((s: any) => s.name === 'points')?.displayValue || 0,
      quarter: data.header?.competitions?.[0]?.status?.period || 0,
      timeRemaining: data.header?.competitions?.[0]?.status?.displayClock || '',
      isLive: data.header?.competitions?.[0]?.status?.type?.state === 'in',
      situation: data.situation || {},
      plays: data.plays || []
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

  // Use inherited getEnhancedGameData method from BaseSportApi
}
