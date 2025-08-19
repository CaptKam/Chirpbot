import type { Game } from "@shared/schema";

// MLB Stats API Interfaces (official MLB.com API)
interface MLBGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
    statusCode: string;
  };
  teams: {
    away: {
      team: {
        id: number;
        name: string;
        abbreviation: string;
      };
      score?: number;
    };
    home: {
      team: {
        id: number;
        name: string;
        abbreviation: string;
      };
      score?: number;
    };
  };
  venue: {
    id: number;
    name: string;
  };
  linescore?: {
    currentInning?: number;
    currentInningOrdinal?: string;
    inningState?: string;
    innings?: Array<{
      num: number;
      ordinalNum: string;
      home?: {
        runs?: number;
        hits?: number;
        errors?: number;
      };
      away?: {
        runs?: number;
        hits?: number;
        errors?: number;
      };
    }>;
  };
}

interface MLBScheduleResponse {
  dates: Array<{
    date: string;
    games: MLBGame[];
  }>;
}

interface MLBLiveFeedResponse {
  gameData: {
    game: {
      pk: number;
    };
    status: {
      abstractGameState: string;
      detailedState: string;
    };
    teams: {
      away: {
        id: number;
        name: string;
        abbreviation: string;
      };
      home: {
        id: number;
        name: string;
        abbreviation: string;
      };
    };
  };
  liveData: {
    linescore: {
      currentInning?: number;
      currentInningOrdinal?: string;
      inningState?: string;
      teams: {
        home: {
          runs?: number;
          hits?: number;
          errors?: number;
        };
        away: {
          runs?: number;
          hits?: number;
          errors?: number;
        };
      };
    };
  };
}

export class MLBApiService {
  private readonly BASE_URL = 'https://statsapi.mlb.com/api/v1';

  /**
   * Fetch today's MLB games from official MLB.com API
   */
  async getTodaysGames(): Promise<Game[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const url = `${this.BASE_URL}/schedule?sportId=1&date=${today}&hydrate=linescore,team`;
      
      console.log(`Fetching MLB games from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
      }

      const data: MLBScheduleResponse = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        console.log('No MLB games scheduled for today');
        return [];
      }

      const games = data.dates[0]?.games || [];
      console.log(`Found ${games.length} MLB games for today`);

      return games.map(this.transformMLBGame);
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      throw error;
    }
  }

  /**
   * Get live games only (games currently in progress)
   */
  async getLiveGames(): Promise<Game[]> {
    const allGames = await this.getTodaysGames();
    return allGames.filter(game => game.isLive);
  }

  /**
   * Get detailed live feed for a specific game
   */
  async getLiveFeed(gamePk: number): Promise<MLBLiveFeedResponse> {
    try {
      const url = `${this.BASE_URL}/game/${gamePk}/feed/live`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching live feed for game ${gamePk}:`, error);
      throw error;
    }
  }

  /**
   * Transform MLB API game data to our internal Game format
   */
  private transformMLBGame = (mlbGame: MLBGame): Game => {
    const isLive = mlbGame.status.abstractGameState === 'Live';
    const isCompleted = mlbGame.status.abstractGameState === 'Final';
    
    return {
      id: `mlb-${mlbGame.gamePk}`,
      sport: 'MLB',
      startTime: mlbGame.gameDate,
      status: isLive ? 'live' : (isCompleted ? 'final' : 'scheduled'),
      isLive,
      isCompleted,
      homeTeam: {
        id: mlbGame.teams.home.team.id.toString(),
        name: mlbGame.teams.home.team.name,
        abbreviation: mlbGame.teams.home.team.abbreviation,
        score: mlbGame.teams.home.score || 0
      },
      awayTeam: {
        id: mlbGame.teams.away.team.id.toString(),
        name: mlbGame.teams.away.team.name,
        abbreviation: mlbGame.teams.away.team.abbreviation,
        score: mlbGame.teams.away.score || 0
      },
      venue: mlbGame.venue.name,
      inning: mlbGame.linescore?.currentInning,
      inningState: mlbGame.linescore?.inningState,
      // Additional MLB-specific data
      gameState: mlbGame.status.abstractGameState,
      gamePk: mlbGame.gamePk
    };
  };

  /**
   * Get team logos (MLB teams have standardized logo URLs)
   */
  getTeamLogoUrl(teamId: string): string {
    return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  }
}

export const mlbApi = new MLBApiService();