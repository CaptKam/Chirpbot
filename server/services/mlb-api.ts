import { getPacificDate } from '../utils/timezone';

export class MLBApiService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || getPacificDate();
      const url = `${this.baseUrl}/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
      
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
        id: game.gamePk.toString(),
        gameId: game.gamePk.toString(), // Keep both for compatibility
        sport: 'MLB',
        homeTeam: {
          id: game.teams.home.team.id?.toString(),
          name: game.teams.home.team.name,
          abbreviation: game.teams.home.team.abbreviation || game.teams.home.team.teamCode,
          score: game.teams.home.score || 0
        },
        awayTeam: {
          id: game.teams.away.team.id?.toString(),
          name: game.teams.away.team.name,
          abbreviation: game.teams.away.team.abbreviation || game.teams.away.team.teamCode,
          score: game.teams.away.score || 0
        },
        status: this.mapGameStatus(game.status.detailedState),
        startTime: game.gameDate,
        venue: game.venue.name,
        inning: game.linescore?.currentInning || null,
        inningState: game.linescore?.inningState || null,
        isLive: game.status.abstractGameState === 'Live'
      }));
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      return [];
    }
  }

  async getLiveFeed(gameId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/game/${gameId}/feed/live`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching live feed:', error);
      return null;
    }
  }

  async getEnhancedGameState(gameId: string): Promise<any> {
    try {
      const liveFeed = await this.getLiveFeed(gameId);
      if (!liveFeed) return null;

      const liveData = liveFeed.liveData || {};
      const gameData = liveFeed.gameData || {};
      const linescore = liveData.linescore || {};
      const currentPlay = liveData.plays?.currentPlay;

      // Extract base runner information
      const runners = { first: false, second: false, third: false };
      
      // Check offense data for runners
      const offense = linescore.offense;
      if (offense) {
        if (offense.first) runners.first = true;
        if (offense.second) runners.second = true;
        if (offense.third) runners.third = true;
      }

      // Get count and outs
      const count = currentPlay?.count || {};
      const balls = count.balls || 0;
      const strikes = count.strikes || 0;
      const outs = linescore.outs || 0;

      // Get inning information
      const inning = linescore.currentInning || 1;
      const isTopInning = linescore.inningState === 'Top';

      // Get weather from game data
      const weather = gameData.weather || {};
      const wind = weather.wind || '';
      const temperature = weather.temp || null;
      
      // Parse wind (e.g., "9 mph, In From LF")
      let windSpeed = 0;
      let windDirection = 'N';
      if (wind) {
        const windMatch = wind.match(/(\d+)\s*mph/i);
        if (windMatch) windSpeed = parseInt(windMatch[1]);
        
        const directionMap: Record<string, string> = {
          'RF': 'E', 'LF': 'W', 'CF': 'N',
          'Right': 'E', 'Left': 'W', 'Center': 'N',
          'In': 'N', 'Out': 'S'
        };
        
        for (const [key, value] of Object.entries(directionMap)) {
          if (wind.includes(key)) {
            windDirection = value;
            break;
          }
        }
      }

      return {
        gameId,
        inning,
        isTopInning,
        outs,
        balls,
        strikes,
        runners,
        weather: {
          temperature: temperature ? parseInt(temperature) : null,
          windSpeed,
          windDirection,
          condition: weather.condition || 'Clear'
        }
      };
    } catch (error) {
      console.error('Error fetching enhanced game state:', error);
      return null;
    }
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