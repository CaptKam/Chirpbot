export class MLBApiService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      // Get date in Eastern Time (MLB's timezone) to ensure we get the correct games
      const easternDate = this.getEasternDate();
      const targetDate = date || easternDate;
      const url = `${this.baseUrl}/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
      console.log(`🔍 MLB API URL: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        return [];
      }

      const games = data.dates[0].games || [];
      
      return games.map((game: any) => ({
        gameId: game.gamePk.toString(),
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        homeScore: game.teams.home.score || 0,
        awayScore: game.teams.away.score || 0,
        status: this.mapGameStatus(game.status.detailedState),
        gameDate: game.gameDate,
        venue: game.venue.name,
        inning: game.linescore?.currentInning || null,
        inningState: game.linescore?.inningState || null,
        isLive: game.status.abstractGameState?.toLowerCase() === 'live' || 
                game.status.detailedState?.toLowerCase().includes('progress') ||
                game.status.detailedState?.toLowerCase().includes('inning')
      }));
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      return [];
    }
  }

  private getEasternDate(): string {
    // Create a date object for Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return easternTime.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  }

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