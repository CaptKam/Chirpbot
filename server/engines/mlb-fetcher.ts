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
        if (response.status === 404) {
          console.log(`MLB game ${gamePk} not found (likely completed or invalid) - removing from monitoring`);
          // Remove this game from active monitoring
          this.activeGames.delete(gamePk);
          return;
        }
        throw new Error(`MLB API error: ${response.status}`);
      }
      
      const gameData: MLBGame = await response.json();
      
      // Check if game is final/completed
      if (gameData.gameData?.status?.statusCode === '3' || 
          gameData.gameData?.status?.statusCode === 'F') {
        console.log(`MLB game ${gamePk} is final - removing from monitoring`);
        this.activeGames.delete(gamePk);
        return;
      }
      
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
    
    // Parse base runners
    const runners = liveData.plays.currentPlay?.runners || [];
    const on1 = runners.some(r => r.movement?.end === '1B');
    const on2 = runners.some(r => r.movement?.end === '2B');
    const on3 = runners.some(r => r.movement?.end === '3B');
    
    return {
      gamePk: game.gamePk,
      status: game.gameData.status.detailedState,
      homeScore: liveData.linescore.teams.home.runs || 0,
      awayScore: liveData.linescore.teams.away.runs || 0,
      inning: liveData.linescore.currentInning ? {
        half: liveData.linescore.inningHalf === 'top' ? 'T' : 'B',
        num: liveData.linescore.currentInning
      } : { half: 'T', num: 1 },
      outs: currentPlay?.count.outs || 0,
      on1,
      on2,
      on3,
      batterId: currentPlay?.matchup.batter.id || 'unknown',
      batterHrRate: this.calculateHrRate(currentPlay?.matchup.batter.stats),
      batterOps: this.calculateOps(currentPlay?.matchup.batter.stats),
      venue: {
        lat: game.gameData.venue.location.latitude || 40.8296,
        lon: game.gameData.venue.location.longitude || -73.9262,
        roof: this.determineRoofType(game.gameData.venue.name)
      },
      weatherBucket: 'CALM' // Would get from weather service
    };
  }

  private calculateHrRate(stats: any): number {
    if (!stats?.season?.hitting) return 0.025;
    const atBats = stats.season.hitting.atBats || 1;
    const homeRuns = stats.season.hitting.homeRuns || 0;
    return homeRuns / atBats;
  }

  private calculateOps(stats: any): number {
    if (!stats?.season?.hitting) return 0.750;
    const { onBasePercentage = 0.300, sluggingPercentage = 0.450 } = stats.season.hitting;
    return onBasePercentage + sluggingPercentage;
  }

  private determineRoofType(venueName: string): string {
    const domes = ['Tropicana Field', 'Minute Maid Park', 'Rogers Centre', 'Globe Life Field', 'Marlins Park'];
    return domes.some(dome => venueName?.includes(dome.split(' ')[0])) ? 'DOME' : 'OPEN';
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