import { Deduper } from "./dedup";

// Global deduplication system for all sport engines
export const dedup = new Deduper({
  namespace: process.env.ADVANCED_MLB_ALERTS === "1" ? "advanced" : "legacy",
  lifecycleTtlMs: 10 * 60 * 1000, // 10 minutes per unique situation
  maxEntries: 50_000,
});

interface LiveGameData {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  gameState: any;
  weatherData?: any;
}

class EngineCoordinator {
  private static instance: EngineCoordinator;
  private liveGameCache: Map<string, LiveGameData> = new Map();
  private lastUpdate: number = 0;
  
  static getInstance(): EngineCoordinator {
    if (!EngineCoordinator.instance) {
      EngineCoordinator.instance = new EngineCoordinator();
    }
    return EngineCoordinator.instance;
  }
  
  async getAllLiveGames(): Promise<LiveGameData[]> {
    // Cache results for 30 seconds to avoid duplicate API calls
    const now = Date.now();
    if (now - this.lastUpdate < 30000 && this.liveGameCache.size > 0) {
      return Array.from(this.liveGameCache.values());
    }
    
    const allGames: LiveGameData[] = [];
    
    try {
      // Get MLB games
      // Removed mlb-api import and call
      const mlbGames: any[] = [];
      
      for (const game of mlbGames) {
        const gameData: LiveGameData = {
          gameId: game.id,
          sport: 'MLB',
          homeTeam: game.homeTeam.name,
          awayTeam: game.awayTeam.name,
          gameState: {
            inning: game.inning,
            homeScore: game.homeTeam.score,
            awayScore: game.awayTeam.score,
            status: game.status
          }
        };
        
        allGames.push(gameData);
        this.liveGameCache.set(game.id, gameData);
      }
      
      // TODO: Add other sports when APIs are ready
      
    } catch (error) {
      console.error('Error collecting all live games:', error);
    }
    
    this.lastUpdate = now;
    console.log(`📊 Engine Coordinator found ${allGames.length} total live games`);
    return allGames;
  }
  
  async getGamesByTeam(teamName: string): Promise<LiveGameData[]> {
    const allGames = await this.getAllLiveGames();
    return allGames.filter(game => 
      game.homeTeam === teamName || game.awayTeam === teamName
    );
  }
  
  async getGamesBySport(sport: string): Promise<LiveGameData[]> {
    const allGames = await this.getAllLiveGames();
    return allGames.filter(game => game.sport === sport);
  }
}

export const engineCoordinator = EngineCoordinator.getInstance();
