import { getPacificDate } from '../utils/timezone';

export class NBAApiService {
  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || getPacificDate();
      const formattedDate = targetDate.replace(/-/g, '');
      
      // ESPN public API for NBA scores
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${formattedDate}`);
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
          sport: 'NBA',
          homeTeam: { id: homeTeam.team.id, name: homeTeam.team.displayName, abbreviation: homeTeam.team.abbreviation, score: parseInt(homeTeam.score) || 0 },
          awayTeam: { id: awayTeam.team.id, name: awayTeam.team.displayName, abbreviation: awayTeam.team.abbreviation, score: parseInt(awayTeam.score) || 0 },
          startTime: new Date(event.date).toISOString(),
          status: this.mapGameStatus(event.status.type.name),
          isLive: event.status.type.state === 'in',
          isCompleted: event.status.type.state === 'post',
          venue: game.venue?.fullName || '',
          quarter: game.status?.period || 0,
          timeRemaining: game.status?.displayClock || ''
        };
      });
    } catch (error) {
      console.error('Error fetching NBA games:', error);
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

  // Get enhanced game data for live monitoring (V3 optimization pattern)
  async getEnhancedGameData(gameId: string): Promise<any> {
    try {
      console.log(`🔄 NBA API: Fetching enhanced data for game ${gameId}`);
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`);
      
      if (!response.ok) {
        throw new Error(`NBA API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract game information similar to WNBA pattern but for NBA
      const competition = data.header?.competitions?.[0];
      const boxscore = data.boxscore?.teams || [];
      const homeTeam = boxscore.find((t: any) => t.homeAway === 'home');
      const awayTeam = boxscore.find((t: any) => t.homeAway === 'away');
      
      // NBA-specific enhanced data structure
      const enhancedData = {
        gameId,
        homeScore: parseInt(homeTeam?.statistics?.find((s: any) => s.name === 'points')?.displayValue) || 0,
        awayScore: parseInt(awayTeam?.statistics?.find((s: any) => s.name === 'points')?.displayValue) || 0,
        quarter: competition?.status?.period || 0,
        timeRemaining: competition?.status?.displayClock || '',
        isLive: competition?.status?.type?.state === 'in',
        // NBA-specific fields
        period: competition?.status?.period || 0,
        clock: competition?.status?.displayClock || '',
        possession: data.situation?.possession || null,
        situation: data.situation || {},
        plays: data.plays || [],
        // Professional basketball context
        shotClock: data.situation?.shotClock || 24, // NBA shot clock
        fouls: {
          home: homeTeam?.statistics?.find((s: any) => s.name === 'fouls')?.displayValue || 0,
          away: awayTeam?.statistics?.find((s: any) => s.name === 'fouls')?.displayValue || 0
        },
        // NBA star player tracking (if available)
        starPlayerStats: data.boxscore?.players || {}
      };

      console.log(`🔍 NBA Enhanced data for game ${gameId}:`, {
        homeScore: enhancedData.homeScore,
        awayScore: enhancedData.awayScore,
        quarter: enhancedData.quarter,
        timeRemaining: enhancedData.timeRemaining,
        isLive: enhancedData.isLive
      });

      return enhancedData;
    } catch (error) {
      console.error(`❌ Error fetching enhanced NBA data for game ${gameId}:`, error);
      return { error: true, message: error.message };
    }
  }
}