import type { Game, GameDay } from "@shared/schema";
import { mlbApi } from "./mlb-api";
import { sportsDataService } from "./sportsdata-api";
import { fetchJson } from './http';

// ESPN API Interfaces
interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    venue?: {
      fullName: string;
    };
    competitors: Array<{
      id: string;
      homeAway: 'home' | 'away';
      team: {
        id: string;
        name: string;
        displayName: string;
        abbreviation: string;
      };
    }>;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
}

class LiveSportsService {
  private readonly ESPN_ENDPOINTS = {
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard'
  };

  // Cache ESPN data for 5 seconds to reduce API calls
  private espnCache = new Map<string, { data: Game[], timestamp: number }>();
  private CACHE_TTL = 5000; // 5 seconds

  private async fetchESPNGames(sport: 'MLB' | 'NFL' | 'NBA' | 'NHL'): Promise<Game[]> {
    // Clear cache to ensure fresh data with updated filtering
    this.espnCache.delete(sport);

    try {
      const url = this.ESPN_ENDPOINTS[sport];
      const data = await fetchJson<ESPNResponse>(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0'
        },
        timeoutMs: 8000
      });

      if (!data.events || data.events.length === 0) {
        console.log(`No ${sport} games found for today`);
        return [];
      }

      const games = data.events.map((game: ESPNGame): Game => {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn(`Invalid team data for game ${game.id}`);
          return null as any;
        }

        const gameStatus = this.mapESPNStatus(game.status);

        return {
          id: `${sport.toLowerCase()}-${game.id}`,
          sport,
          homeTeam: {
            id: homeTeam.team.id,
            name: homeTeam.team.displayName,
            abbreviation: homeTeam.team.abbreviation,
          },
          awayTeam: {
            id: awayTeam.team.id,
            name: awayTeam.team.displayName,
            abbreviation: awayTeam.team.abbreviation,
          },
          startTime: game.date,
          status: gameStatus,
          venue: competition.venue?.fullName || 'TBD',
          isSelected: false,
        };
      }).filter((game): game is Game => game !== null);

      // Cache the results
      this.espnCache.set(sport, { data: games, timestamp: Date.now() });
      return games;
    } catch (error) {
      console.error(`Error fetching ${sport} games from ESPN:`, error);
      return [];
    }
  }

  private mapESPNStatus(status: ESPNGame['status']): 'scheduled' | 'live' | 'final' {
    const state = status.type.state.toLowerCase();
    const name = status.type.name.toLowerCase();

    // More comprehensive final status detection
    if (status.type.completed || 
        name.includes('final') || 
        state === 'post') {
      return 'final';
    }

    if (state === 'in' || name.includes('halftime') || name.includes('break')) return 'live';
    return 'scheduled';
  }

  private mapMLBStatus(status: string): 'scheduled' | 'live' | 'final' {
    switch (status) {
      case 'P': // Preview
        return 'scheduled';
      case 'L': // Live
        return 'live';
      case 'F': // Final
        return 'final';
      default:
        return 'scheduled';
    }
  }

  private getMockMLBGames(): Game[] {
    return [
      {
        id: 'mlb-mock-1',
        sport: 'MLB',
        homeTeam: {
          id: '119',
          name: 'Los Angeles Dodgers',
          abbreviation: 'LAD',
        },
        awayTeam: {
          id: '137',
          name: 'San Francisco Giants',
          abbreviation: 'SF',
        },
        startTime: new Date().toISOString(),
        status: 'live',
        venue: 'Dodger Stadium',
        isSelected: false,
      },
      {
        id: 'mlb-mock-2',
        sport: 'MLB',
        homeTeam: {
          id: '147',
          name: 'New York Yankees',
          abbreviation: 'NYY',
        },
        awayTeam: {
          id: '111',
          name: 'Boston Red Sox',
          abbreviation: 'BOS',
        },
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
        status: 'scheduled',
        venue: 'Yankee Stadium',
        isSelected: false,
      },
    ];
  }

  private getMockNFLGames(): Game[] {
    return [
      {
        id: 'nfl-mock-1',
        sport: 'NFL',
        homeTeam: {
          id: '22',
          name: 'Kansas City Chiefs',
          abbreviation: 'KC',
        },
        awayTeam: {
          id: '2',
          name: 'Buffalo Bills',
          abbreviation: 'BUF',
        },
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        status: 'scheduled',
        venue: 'Arrowhead Stadium',
        isSelected: false,
      },
    ];
  }

  private getMockNBAGames(): Game[] {
    return [
      {
        id: 'nba-mock-1',
        sport: 'NBA',
        homeTeam: {
          id: '1610612747',
          name: 'Los Angeles Lakers',
          abbreviation: 'LAL',
        },
        awayTeam: {
          id: '1610612738',
          name: 'Boston Celtics',
          abbreviation: 'BOS',
        },
        startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        status: 'scheduled',
        venue: 'Crypto.com Arena',
        isSelected: false,
      },
    ];
  }

  private getMockNHLGames(): Game[] {
    return [
      {
        id: 'nhl-mock-1',
        sport: 'NHL',
        homeTeam: {
          id: '26',
          name: 'Los Angeles Kings',
          abbreviation: 'LAK',
        },
        awayTeam: {
          id: '24',
          name: 'Anaheim Ducks',
          abbreviation: 'ANA',
        },
        startTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
        status: 'scheduled',
        venue: 'Crypto.com Arena',
        isSelected: false,
      },
    ];
  }

  /**
   * Get only MLB games from official MLB.com API
   */
  async getMLBGames(date?: string): Promise<GameDay> {
    try {
      const mlbGames = await mlbApi.getTodaysGames();
      const targetDate = date || new Date().toISOString().split('T')[0];

      console.log(`Fetched ${mlbGames.length} MLB games from official MLB.com API`);

      return {
        date: targetDate,
        games: mlbGames,
      };
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      throw error;
    }
  }

  async getTodaysGames(sport?: string): Promise<{ date: string; games: Game[] }> {
    const today = new Date().toISOString().split('T')[0];

    try {
      let games: Game[] = [];

      if (!sport || sport === 'MLB') {
        // Get real MLB games from official API
        const mlbGames = await mlbApi.getTodaysGames();
        games = games.concat(mlbGames);
      }

      if (!sport || sport === 'NFL') {
        // Get real NFL games from SportsData.io
        const nflGames = await sportsDataService.getNFLGames();
        games = games.concat(nflGames);
      }

      if (!sport || sport === 'NBA') {
        // Get real NBA games from SportsData.io
        const nbaGames = await sportsDataService.getNBAGames();
        games = games.concat(nbaGames);
      }

      if (!sport || sport === 'NHL') {
        // Get real NHL games from SportsData.io
        const nhlGames = await sportsDataService.getNHLGames();
        games = games.concat(nhlGames);
      }

      return {
        date: today,
        games: sport ? games.filter(game => game.sport === sport) : games,
      };
    } catch (error) {
      console.error(`Error fetching ${sport || 'all'} games:`, error);

      // Return empty array instead of mock data on error
      return {
        date: today,
        games: [],
      };
    }
  }
}

export const liveSportsService = new LiveSportsService();