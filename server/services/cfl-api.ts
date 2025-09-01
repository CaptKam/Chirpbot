export class CFLApiService {
  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const formattedDate = targetDate.replace(/-/g, '');
      
      // ESPN public API for CFL scores
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/cfl/scoreboard?dates=${formattedDate}`);
      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        return [];
      }
      
      return data.events.map((event: any) => {
        const game = event.competitions[0];
        const homeTeam = game.competitors.find((c: any) => c.homeAway === 'home');
        const awayTeam = game.competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          gameId: event.id,
          sport: 'CFL',
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0,
          startTime: new Date(event.date).toISOString(),
          status: event.status.type.name,
          isLive: event.status.type.state === 'in',
          isCompleted: event.status.type.state === 'post',
          venue: game.venue?.fullName || '',
          quarter: game.status?.period || 0,
          timeRemaining: game.status?.displayClock || ''
        };
      });
    } catch (error) {
      console.error('Error fetching CFL games:', error);
      return [];
    }
  }
}