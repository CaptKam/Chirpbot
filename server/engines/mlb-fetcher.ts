// MLB data fetcher from MLB.com official API
import { processRawTick } from './engine-coordinator';

interface MLBGame {
  gamePk: number;
  gameData: {
    status: {
      statusCode: string;
      detailedState: string;
    };
    teams: {
      home: { name: string; id: number };
      away: { name: string; id: number };
    };
    venue: {
      name: string;
      location: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
  liveData: {
    linescore: {
      currentInning?: number;
      inningState?: string;
      inningHalf?: string;
      teams: {
        home: { runs: number };
        away: { runs: number };
      };
    };
    plays: {
      currentPlay?: {
        count: { outs: number };
        matchup: {
          batter: { id: number; stats?: any };
        };
      };
    };
    boxscore: {
      teams: {
        home: { players: any };
        away: { players: any };
      };
    };
  };
}

export class MLBFetcher {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';
  private activeGames = new Set<number>();

  async fetchTodaysGames(): Promise<number[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${this.baseUrl}/schedule?sportId=1&date=${today}`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }
      
      const data = await response.json();
      const gameIds: number[] = [];
      
      for (const date of data.dates || []) {
        for (const game of date.games || []) {
          if (game.status?.statusCode === '2') { // Live games
            gameIds.push(game.gamePk);
          }
        }
      }
      
      return gameIds;
    } catch (error) {
      console.error('Failed to fetch MLB games:', error);
      return [];
    }
  }

  async fetchGameData(gamePk: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/game/${gamePk}/feed/live`);
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status}`);
      }
      
      const gameData: MLBGame = await response.json();
      
      // Transform to our format
      const transformedData = this.transformMLBData(gameData);
      
      // Process through our engine
      await processRawTick('MLB', String(gamePk), transformedData);
      
    } catch (error) {
      console.error(`Failed to fetch MLB game ${gamePk}:`, error);
    }
  }

  private transformMLBData(game: MLBGame) {
    const liveData = game.liveData;
    const currentPlay = liveData.plays.currentPlay;
    
    return {
      gamePk: game.gamePk,
      status: game.gameData.status.detailedState,
      homeScore: liveData.linescore.teams.home.runs,
      awayScore: liveData.linescore.teams.away.runs,
      inning: liveData.linescore.currentInning ? {
        half: liveData.linescore.inningHalf === 'top' ? 'T' : 'B',
        num: liveData.linescore.currentInning
      } : undefined,
      outs: currentPlay?.count.outs || 0,
      on1: false, // Would need to parse runner data
      on2: false,
      on3: false,
      batterId: currentPlay?.matchup.batter.id,
      batterHrRate: 0.025, // Would calculate from stats
      batterOps: 0.750,
      venue: {
        lat: game.gameData.venue.location.latitude,
        lon: game.gameData.venue.location.longitude,
        roof: 'OPEN' // Would need venue data
      },
      weatherBucket: 'CALM' // Would get from weather service
    };
  }

  async startMonitoring(): Promise<void> {
    console.log('⚾ Starting MLB game monitoring...');
    
    const checkGames = async () => {
      try {
        const gameIds = await this.fetchTodaysGames();
        console.log(`Found ${gameIds.length} live MLB games`);
        
        for (const gameId of gameIds) {
          this.activeGames.add(gameId);
          await this.fetchGameData(gameId);
        }
      } catch (error) {
        console.error('MLB monitoring error:', error);
      }
    };
    
    // Check immediately and then every 30 seconds
    await checkGames();
    setInterval(checkGames, 30000);
  }
}