
import { getPacificDate } from '../utils/timezone';

export class WNBAApiService {
  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || getPacificDate();
      const formattedDate = targetDate.replace(/-/g, '');
      
      // ESPN public API for WNBA scores
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${formattedDate}`);
      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        return [];
      }
      
      return data.events.map((event: any) => {
        const game = event.competitions[0];
        const homeTeam = game.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = game.competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          id: event.id,
          gameId: event.id,
          sport: 'WNBA',
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
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0,
          startTime: new Date(event.date).toISOString(),
          status: this.mapGameStatus(event.status.type.name),
          isLive: event.status.type.state === 'in',
          isCompleted: event.status.type.state === 'post',
          venue: game.venue?.fullName || '',
          quarter: game.status?.period || 0,
          timeRemaining: game.status?.displayClock || '',
          // WNBA specific fields
          period: game.status?.period || 0,
          clock: game.status?.displayClock || '',
          possession: game.situation?.possession || null
        };
      });
    } catch (error) {
      console.error('Error fetching WNBA games:', error);
      return [];
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

  // Get enhanced game data for live monitoring
  async getEnhancedGameData(gameId: string): Promise<any> {
    try {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event=${gameId}`);
      const data = await response.json();
      
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
    } catch (error) {
      console.error(`Error fetching enhanced WNBA data for game ${gameId}:`, error);
      return null;
    }
  }
}
