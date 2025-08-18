import type { Game, GameDay } from "@shared/schema";

interface MLBGameData {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameCode: string;
    codedGameState: string;
    statusCode: string;
  };
  teams: {
    home: {
      team: {
        id: number;
        name: string;
        abbreviation: string;
      };
    };
    away: {
      team: {
        id: number;
        name: string;
        abbreviation: string;
      };
    };
  };
  venue: {
    name: string;
  };
}

interface MLBScheduleResponse {
  dates: {
    date: string;
    games: MLBGameData[];
  }[];
}

class LiveSportsService {
  private async fetchMLBGames(date: string): Promise<Game[]> {
    try {
      const url = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${date}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }

      const data: MLBScheduleResponse = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        return [];
      }

      return data.dates[0].games.map((game: MLBGameData): Game => ({
        id: `mlb-${game.gamePk}`,
        sport: 'MLB',
        homeTeam: {
          id: game.teams.home.team.id.toString(),
          name: game.teams.home.team.name,
          abbreviation: game.teams.home.team.abbreviation,
        },
        awayTeam: {
          id: game.teams.away.team.id.toString(),
          name: game.teams.away.team.name,
          abbreviation: game.teams.away.team.abbreviation,
        },
        startTime: game.gameDate,
        status: this.mapMLBStatus(game.status.abstractGameCode),
        venue: game.venue.name,
        isSelected: false,
      }));
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      return this.getMockMLBGames();
    }
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

  async getTodaysGames(sport?: string): Promise<GameDay> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let games: Game[] = [];

    if (!sport || sport === 'MLB') {
      const mlbGames = await this.fetchMLBGames(today);
      games.push(...mlbGames);
    }

    // For NFL, NBA, NHL - use mock data for now (APIs would be similar)
    if (!sport || sport === 'NFL') {
      games.push(...this.getMockNFLGames());
    }

    if (!sport || sport === 'NBA') {
      games.push(...this.getMockNBAGames());
    }

    if (!sport || sport === 'NHL') {
      games.push(...this.getMockNHLGames());
    }

    // Filter by sport if specified
    if (sport) {
      games = games.filter(game => game.sport === sport);
    }

    return {
      date: today,
      games,
    };
  }
}

export const liveSportsService = new LiveSportsService();