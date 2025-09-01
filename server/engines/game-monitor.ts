// Game monitoring service that connects user selections to the alert system
import { storage } from '../storage';
import { MLBFetcher } from './mlb-fetcher';
import { NCAAFFetcher } from './ncaaf-fetcher';

interface MonitoredGame {
  userId: string;
  gameId: string;
  sport: string;
  homeTeamName: string;
  awayTeamName: string;
}

export class GameMonitor {
  private mlbFetcher = new MLBFetcher();
  private ncaafFetcher = new NCAAFFetcher();
  private activeMonitoring = new Map<string, NodeJS.Timeout>();

  async startMonitoring(): Promise<void> {
    console.log('🎯 Starting game monitoring system...');
    
    // Get all monitored games from database
    const monitoredGames = await storage.getAllMonitoredGames();
    
    if (monitoredGames.length === 0) {
      console.log('No games currently being monitored');
      return;
    }

    console.log(`Found ${monitoredGames.length} monitored games`);
    
    // Group by sport for efficient monitoring
    const gamesBySport = this.groupGamesBySport(monitoredGames);
    
    // Start monitoring for each sport
    for (const [sport, games] of gamesBySport) {
      await this.startSportMonitoring(sport, games);
    }
  }

  async stopMonitoring(): Promise<void> {
    console.log('⏹️ Stopping game monitoring...');
    
    // Clear all active monitoring intervals
    for (const [gameId, timer] of this.activeMonitoring) {
      clearInterval(timer);
      console.log(`Stopped monitoring game: ${gameId}`);
    }
    
    this.activeMonitoring.clear();
    console.log('All game monitoring stopped');
  }

  async addGameToMonitoring(userId: string, gameId: string, sport: string): Promise<void> {
    // Check if already monitored
    if (this.activeMonitoring.has(gameId)) {
      console.log(`Game ${gameId} already being monitored`);
      return;
    }

    // Start monitoring this specific game
    await this.startSportMonitoring(sport, [{ userId, gameId, sport, homeTeamName: '', awayTeamName: '' }]);
    console.log(`Started monitoring game: ${gameId} for user: ${userId}`);
  }

  async removeGameFromMonitoring(gameId: string): Promise<void> {
    const timer = this.activeMonitoring.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.activeMonitoring.delete(gameId);
      console.log(`Stopped monitoring game: ${gameId}`);
    }
  }

  private groupGamesBySport(games: MonitoredGame[]): Map<string, MonitoredGame[]> {
    const grouped = new Map<string, MonitoredGame[]>();
    
    for (const game of games) {
      if (!grouped.has(game.sport)) {
        grouped.set(game.sport, []);
      }
      grouped.get(game.sport)!.push(game);
    }
    
    return grouped;
  }

  private async startSportMonitoring(sport: string, games: MonitoredGame[]): Promise<void> {
    console.log(`🏃 Starting ${sport} monitoring for ${games.length} games`);
    
    switch (sport.toUpperCase()) {
      case 'MLB':
        await this.startMLBMonitoring(games);
        break;
      case 'NCAAF':
        await this.startNCAAFMonitoring(games);
        break;
      default:
        console.warn(`Sport ${sport} monitoring not implemented yet`);
    }
  }

  private async startMLBMonitoring(games: MonitoredGame[]): Promise<void> {
    // Monitor each MLB game individually
    for (const game of games) {
      if (!this.activeMonitoring.has(game.gameId)) {
        const timer = setInterval(async () => {
          try {
            await this.mlbFetcher.fetchGameData(parseInt(game.gameId));
          } catch (error) {
            console.error(`MLB monitoring error for game ${game.gameId}:`, error);
          }
        }, 30000); // Every 30 seconds
        
        this.activeMonitoring.set(game.gameId, timer);
      }
    }
  }

  private async startNCAAFMonitoring(games: MonitoredGame[]): Promise<void> {
    // Monitor each NCAAF game individually
    for (const game of games) {
      if (!this.activeMonitoring.has(game.gameId)) {
        const timer = setInterval(async () => {
          try {
            await this.ncaafFetcher.fetchGameData(game.gameId);
          } catch (error) {
            console.error(`NCAAF monitoring error for game ${game.gameId}:`, error);
          }
        }, 45000); // Every 45 seconds
        
        this.activeMonitoring.set(game.gameId, timer);
      }
    }
  }

  async refreshMonitoring(): Promise<void> {
    console.log('🔄 Refreshing game monitoring...');
    
    // Stop current monitoring
    await this.stopMonitoring();
    
    // Restart with fresh data
    await this.startMonitoring();
  }

  getActiveGames(): string[] {
    return Array.from(this.activeMonitoring.keys());
  }

  getMonitoringStats(): { activeGames: number; sports: string[] } {
    const games = this.getActiveGames();
    const sports = Array.from(new Set(games.map(gameId => {
      // Try to determine sport from gameId pattern
      if (/^\d+$/.test(gameId)) return 'MLB';
      return 'NCAAF';
    })));
    
    return {
      activeGames: games.length,
      sports
    };
  }
}

export const gameMonitor = new GameMonitor();