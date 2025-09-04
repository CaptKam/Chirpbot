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

      return games.map((game: any) => {
        // Extract live scores from linescore data for live games, fallback to team score for others
        const homeScore = game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0;
        const awayScore = game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0;
        
        return {
          id: game.gamePk.toString(),
          homeTeam: { id: game.teams.home.team.id.toString(), name: game.teams.home.team.name, abbreviation: game.teams.home.team.abbreviation, score: homeScore },
          awayTeam: { id: game.teams.away.team.id.toString(), name: game.teams.away.team.name, abbreviation: game.teams.away.team.abbreviation, score: awayScore },
          status: this.mapGameStatus(game.status.detailedState),
          startTime: game.gameDate,
          venue: game.venue.name,
          inning: game.linescore?.currentInning || null,
          inningState: game.linescore?.inningState || null,
          isLive: game.status.abstractGameState === 'Live'
        };
      });
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

  async getEnhancedGameData(gameId: string): Promise<any> {
    try {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`
      );

      if (!response.ok) {
        throw new Error(`MLB API request failed: ${response.status}`);
      }

      const data = await response.json();
      const liveData = data.liveData || {};
      const gameData = data.gameData || {};
      const linescore = liveData.linescore || {};
      const currentPlay = liveData.plays?.currentPlay;

      // Extract base runner information from current play or linescore
      const runners = { first: false, second: false, third: false };

      // First try current play runners
      if (currentPlay?.runners) {
        currentPlay.runners.forEach((runner: any) => {
          if (runner.movement?.end === '1B') runners.first = true;
          if (runner.movement?.end === '2B') runners.second = true;
          if (runner.movement?.end === '3B') runners.third = true;
        });
      }

      // Also check offense data for runners
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

      console.log(`🔍 Live data for game ${gameId}:`, {
        runners, balls, strikes, outs, inning, isTopInning
      });

      return {
        runners,
        balls,
        strikes,
        outs,
        inning,
        isTopInning,
        gameState: liveData.gameState,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching enhanced game data:', error);
      return {
        runners: { first: false, second: false, third: false },
        balls: 0,
        strikes: 0,
        outs: 0,
        inning: 1,
        isTopInning: true,
        error: 'Failed to fetch live data'
      };
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