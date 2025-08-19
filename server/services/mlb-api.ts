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
      // Get both today and yesterday in case games are still ongoing from previous day
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`Fetching MLB games for today (${today}) and yesterday (${yesterday})`);
      
      // Fetch both today's and yesterday's games to catch any ongoing games
      const [todayResponse, yesterdayResponse] = await Promise.all([
        fetch(`${this.BASE_URL}/schedule?sportId=1&date=${today}&hydrate=linescore,team`, {
          headers: { 'User-Agent': 'ChirpBot/2.0', 'Accept': 'application/json' }
        }),
        fetch(`${this.BASE_URL}/schedule?sportId=1&date=${yesterday}&hydrate=linescore,team`, {
          headers: { 'User-Agent': 'ChirpBot/2.0', 'Accept': 'application/json' }
        })
      ]);

      if (!todayResponse.ok) {
        throw new Error(`MLB API error: ${todayResponse.status} ${todayResponse.statusText}`);
      }

      const [todayData, yesterdayData]: [MLBScheduleResponse, MLBScheduleResponse] = await Promise.all([
        todayResponse.json(),
        yesterdayResponse.ok ? yesterdayResponse.json() : { dates: [] }
      ]);
      
      // Combine all games and filter for live ones or those scheduled for today
      const allGames: MLBGame[] = [];
      
      // Add today's games
      if (todayData.dates && todayData.dates.length > 0) {
        allGames.push(...(todayData.dates[0]?.games || []));
      }
      
      // Add yesterday's games that are still live
      if (yesterdayData.dates && yesterdayData.dates.length > 0) {
        const yesterdayLiveGames = (yesterdayData.dates[0]?.games || []).filter(game => 
          game.status.abstractGameState === 'Live'
        );
        allGames.push(...yesterdayLiveGames);
      }

      console.log(`Found ${allGames.length} total MLB games (today: ${todayData.dates?.[0]?.games?.length || 0}, yesterday live: ${yesterdayData.dates?.[0]?.games?.filter(g => g.status.abstractGameState === 'Live').length || 0})`);

      return allGames.map(this.transformMLBGame);
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
  async getLiveFeed(gamePk: number): Promise<any> {
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

      const data = await response.json();
      
      // Enhanced live feed with play-by-play data
      return {
        gameData: data.gameData,
        liveData: {
          linescore: {
            ...data.liveData.linescore,
            outs: data.liveData.linescore?.outs || 0,
            balls: data.liveData.linescore?.balls || 0,
            strikes: data.liveData.linescore?.strikes || 0,
            offense: data.liveData.linescore?.offense || {},
            defense: data.liveData.linescore?.defense || {}
          },
          plays: data.liveData.plays
        }
      };
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