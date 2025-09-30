import { getPacificDate } from '../utils/timezone';
import { BaseSportApi, type BaseGameData } from './base-sport-api';
import { espnApiCircuit } from '../middleware/circuit-breaker';

export class CFLApiService extends BaseSportApi {
  constructor() {
    super({
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/cfl',
      circuit: espnApiCircuit,
      sportTag: 'CFL',
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
        sport: 'CFL',
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
        // CFL-specific fields
        isCompleted: event.status.type.state === 'post',
        quarter: game.status?.period || 0,
        timeRemaining: game.status?.displayClock || ''
      };
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `${this.config.baseUrl}/summary?event=${gameId}`;
  }

  protected async parseEnhancedGameResponse(data: any, gameId: string): Promise<any> {
    // CFL enhanced data - basic structure for Canadian Football League
    const competition = data.header?.competitions?.[0];
    
    return {
      gameId,
      homeScore: competition?.competitors?.find((c: any) => c.homeAway === 'home')?.score || 0,
      awayScore: competition?.competitors?.find((c: any) => c.homeAway === 'away')?.score || 0,
      quarter: competition?.status?.period || 0,
      timeRemaining: competition?.status?.displayClock || '',
      isLive: competition?.status?.type?.state === 'in',
      // CFL-specific context
      period: competition?.status?.period || 0,
      clock: competition?.status?.displayClock || '',
      situation: data.situation || {}
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