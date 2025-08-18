import type { Game, GameDay } from "@shared/schema";

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
      score?: string;
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

  // MLB Official Stats API for detailed game data including runners
  private readonly MLB_STATS_API = 'https://statsapi.mlb.com/api/v1';

  private async fetchESPNGames(sport: 'MLB' | 'NFL' | 'NBA' | 'NHL'): Promise<Game[]> {
    try {
      const url = this.ESPN_ENDPOINTS[sport];
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`ESPN API error for ${sport}: ${response.status}`);
      }

      const data: ESPNResponse = await response.json();
      
      if (!data.events || data.events.length === 0) {
        console.log(`No ${sport} games found for today`);
        return [];
      }

      return data.events.map((game: ESPNGame): Game | undefined => {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn(`Invalid team data for game ${game.id}`);
          return undefined;
        }

        return {
          id: `${sport.toLowerCase()}-${game.id}`,
          sport,
          homeTeam: {
            id: homeTeam.team.id,
            name: homeTeam.team.displayName,
            abbreviation: homeTeam.team.abbreviation,
            score: parseInt(homeTeam.score || '0', 10),
          },
          awayTeam: {
            id: awayTeam.team.id,
            name: awayTeam.team.displayName,
            abbreviation: awayTeam.team.abbreviation,
            score: parseInt(awayTeam.score || '0', 10),
          },
          startTime: game.date,
          status: this.mapESPNStatus(game.status),
          venue: competition.venue?.fullName || 'TBD',
          isSelected: false,
          score: {
            away: parseInt(awayTeam.score || '0', 10),
            home: parseInt(homeTeam.score || '0', 10),
          },
        };
      }).filter((game): game is Game => game !== undefined);
    } catch (error) {
      console.error(`Error fetching ${sport} games from ESPN:`, error);
      return [];
    }
  }

  private mapESPNStatus(status: ESPNGame['status']): 'scheduled' | 'live' | 'final' {
    const state = status.type.state.toLowerCase();
    const name = status.type.name.toLowerCase();
    
    if (status.type.completed) return 'final';
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

  // Get detailed MLB game data with runners and game state from MLB.com
  async getMLBGameDetails(gameId: string) {
    try {
      const response = await fetch(`${this.MLB_STATS_API}/game/${gameId}/liveData`);
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }
      const data = await response.json();
      return {
        runners: data.linescore?.runners || {},
        inning: data.linescore?.currentInning || 1,
        inningHalf: data.linescore?.inningHalf || 'Top',
        atBat: data.plays?.currentPlay,
        outs: data.linescore?.outs || 0
      };
    } catch (error) {
      console.error(`Error fetching MLB game details for ${gameId}:`, error);
      return null;
    }
  }

  // Check if runners are in scoring position (2nd or 3rd base)
  checkRunnersInScoringPosition(runners: any): { hasRISP: boolean; positions: string[] } {
    const positions: string[] = [];
    let hasRISP = false;

    if (runners?.second) {
      positions.push('2nd base');
      hasRISP = true;
    }
    if (runners?.third) {
      positions.push('3rd base');
      hasRISP = true;
    }
    if (runners?.first) {
      positions.push('1st base');
    }

    return { hasRISP, positions };
  }

  // NO LONGER USED - Removed problematic ESPN->MLB API mapping
  // Focus on predictive alerts with ESPN data only
  async getSimplifiedMLBGames(): Promise<Game[]> {
    try {
      return await this.fetchESPNGames('MLB');
    } catch (error) {
      console.error('Error fetching simplified MLB games:', error);
      return [];
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

  async getTodaysGames(sport?: string): Promise<GameDay> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let games: Game[] = [];

    if (!sport) {
      // Fetch all sports simultaneously
      const [mlbGames, nflGames, nbaGames, nhlGames] = await Promise.all([
        this.fetchESPNGames('MLB'),
        this.fetchESPNGames('NFL'),
        this.fetchESPNGames('NBA'),
        this.fetchESPNGames('NHL'),
      ]);
      games = [...mlbGames, ...nflGames, ...nbaGames, ...nhlGames];
    } else {
      // Fetch specific sport
      const sportCode = sport.toUpperCase() as 'MLB' | 'NFL' | 'NBA' | 'NHL';
      if (['MLB', 'NFL', 'NBA', 'NHL'].includes(sportCode)) {
        games = await this.fetchESPNGames(sportCode);
      } else {
        console.warn(`Unknown sport: ${sport}`);
      }
    }

    return {
      date: today,
      games,
    };
  }
}

export const liveSportsService = new LiveSportsService();