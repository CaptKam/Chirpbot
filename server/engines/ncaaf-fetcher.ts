// NCAAF data fetcher from ESPN API
import { processRawTick } from './engine-coordinator';

interface ESPNGame {
  id: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
    };
  };
  competitions: [{
    competitors: [{
      team: { id: string; displayName: string };
      score: string;
      homeAway: string;
    }];
    situation?: {
      downDistanceText?: string;
      possessionText?: string;
      isRedZone?: boolean;
      yardLine?: number;
      down?: number;
      distance?: number;
    };
    status: {
      period: number;
      displayClock: string;
    };
    venue: {
      address: {
        latitude?: number;
        longitude?: number;
      };
    };
  }];
}

export class NCAAFFetcher {
  private baseUrl = 'https://sports.espn.com/college-football/scoreboard';
  private activeGames = new Set<string>();

  async fetchTodaysGames(): Promise<string[]> {
    try {
      // ESPN API endpoint for college football
      const response = await fetch(`${this.baseUrl}/_/format/json`);
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      
      const data = await response.json();
      const gameIds: string[] = [];
      
      for (const event of data.events || []) {
        if (event.status?.type?.state === 'in') { // Live games
          gameIds.push(event.id);
        }
      }
      
      return gameIds;
    } catch (error) {
      console.error('Failed to fetch NCAAF games:', error);
      return [];
    }
  }

  async fetchGameData(gameId: string): Promise<void> {
    try {
      const response = await fetch(`https://sports.espn.com/college-football/game/_/gameId/${gameId}`);
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      
      // This would need to parse the ESPN game page or use their API
      // For now, we'll use mock data
      const mockGameData = this.createMockNCAAFData(gameId);
      
      // Process through our engine
      await processRawTick('NCAAF', gameId, mockGameData);
      
    } catch (error) {
      console.error(`Failed to fetch NCAAF game ${gameId}:`, error);
    }
  }

  private createMockNCAAFData(gameId: string) {
    // Mock data for demonstration
    return {
      id: gameId,
      status: 'Live',
      home: Math.floor(Math.random() * 35),
      away: Math.floor(Math.random() * 35),
      period: Math.floor(Math.random() * 4) + 1,
      clock: `${Math.floor(Math.random() * 15)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      poss: Math.random() > 0.5 ? 'HOME' : 'AWAY',
      yardline: Math.floor(Math.random() * 100),
      side: Math.random() > 0.5 ? 'HOME' : 'AWAY',
      down: Math.floor(Math.random() * 4) + 1,
      toGo: Math.floor(Math.random() * 10) + 1,
      venue: {
        lat: 35.2078,
        lon: -101.8313,
        roof: 'OPEN'
      }
    };
  }

  async startMonitoring(): Promise<void> {
    console.log('🏈 Starting NCAAF game monitoring...');
    
    const checkGames = async () => {
      try {
        const gameIds = await this.fetchTodaysGames();
        console.log(`Found ${gameIds.length} live NCAAF games`);
        
        for (const gameId of gameIds) {
          this.activeGames.add(gameId);
          await this.fetchGameData(gameId);
        }
      } catch (error) {
        console.error('NCAAF monitoring error:', error);
      }
    };
    
    // Check immediately and then every 45 seconds
    await checkGames();
    setInterval(checkGames, 45000);
  }
}