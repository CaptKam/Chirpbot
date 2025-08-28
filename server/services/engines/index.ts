import { mlbEngine } from './mlb-engine';
import { MLBEngineV3 } from './mlb-engine-v3';
import { nflEngine } from './nfl-engine';
import { nbaEngine } from './nba-engine';
import { nhlEngine } from './nhl-engine';
import { weatherEngine } from './weather-engine';
// AI engine has been removed
import { BaseSportEngine } from './base-engine';

// V3 Engine Wrapper to make it compatible with the existing system
class MLBEngineV3Wrapper extends BaseSportEngine {
  sport = 'MLB';
  alertConfigs: any[] = [];
  monitoringInterval = 1500;
  private v3Engine = new MLBEngineV3();

  constructor() {
    super();
    // Pass the alert callback to the v3 engine
    this.v3Engine.onAlert = (alert: any) => {
      if (this.onAlert) {
        this.onAlert(alert);
      }
    };
  }

  async monitor(): Promise<void> {
    try {
      await this.v3Engine.processLiveGamesOnly();
    } catch (error) {
      console.error('Error in V3 engine monitoring:', error);
    }
  }

  async extractGameState(apiData: any): any {
    // This method is required by BaseSportEngine but not used in v3
    return apiData;
  }
}
import { storage } from '../../storage';

export interface AlertEngineManager {
  engines: Map<string, BaseSportEngine>;
  startAllEngines(): Promise<void>;
  stopAllEngines(): void;
  getEngine(sport: string): BaseSportEngine | undefined;
  addEngine(sport: string, engine: BaseSportEngine): void;
}

class AlertEngineManagerImpl implements AlertEngineManager {
  engines = new Map<string, BaseSportEngine>();
  private intervalIds = new Map<string, NodeJS.Timeout>();

  constructor() {
    // Register all engines - using v3 MLB engine for enhanced tier analysis
    const mlbEngineV3Wrapper = new MLBEngineV3Wrapper();
    this.addEngine('MLB', mlbEngineV3Wrapper);
    this.addEngine('NFL', nflEngine);
    this.addEngine('NBA', nbaEngine);
    this.addEngine('NHL', nhlEngine);
    this.addEngine('WEATHER', weatherEngine);
    // AI engine has been removed
  }

  addEngine(sport: string, engine: BaseSportEngine): void {
    this.engines.set(sport, engine);
  }

  getEngine(sport: string): BaseSportEngine | undefined {
    return this.engines.get(sport);
  }

  async startAllEngines(): Promise<void> {
    console.log('🎯 Starting Game Situations alerts system...');
    
    // Stop all running engines first
    this.stopAllEngines();
    
    // Enable only MLB engine for Game Situations
    const hasMonitoredGames = await this.hasMonitoredGamesForSport('MLB');
    if (hasMonitoredGames) {
      console.log('🔧 Starting MLB engine for Game Situations alerts');
      this.startEngine('MLB', this.engines.get('MLB')!);
    } else {
      console.log('⏸️ No monitored MLB games found');
    }
    
    console.log('✅ Game Situations alert system ready');
  }
  
  private startEngine(sport: string, engine: BaseSportEngine): void {
    console.log(`🔧 Starting ${sport} engine with ${engine.monitoringInterval}ms interval`);
    
    // Set up periodic monitoring
    const intervalId = setInterval(async () => {
      try {
        await engine.monitor();
      } catch (error) {
        console.error(`Error in ${sport} monitoring:`, error);
      }
    }, engine.monitoringInterval);

    this.intervalIds.set(sport, intervalId);
  }
  
  private async hasMonitoredGamesForSport(sport: string): Promise<boolean> {
    try {
      const allMonitoredGames = await this.getAllMonitoredGames();
      
      // For weather engine, check if there are ANY monitored games (weather applies to all sports)
      if (sport === 'WEATHER') {
        return allMonitoredGames.length > 0;
      }
      
      return allMonitoredGames.some(game => game.sport === sport);
    } catch (error) {
      console.error(`Error checking monitored games for ${sport}:`, error);
      return false;
    }
  }
  
  private async getAllMonitoredGames(): Promise<any[]> {
    try {
      // Get all monitored games across all users
      // This is a simplified approach - in a real system you might want to cache this
      return await storage.getAllMonitoredGames();
    } catch (error) {
      console.error('Error fetching all monitored games:', error);
      return [];
    }
  }
  
  private async checkAndUpdateEngines(): Promise<void> {
    for (const [sport, engine] of Array.from(this.engines.entries())) {
      
      const hasMonitoredGames = await this.hasMonitoredGamesForSport(sport);
      const isRunning = this.intervalIds.has(sport);
      
      if (hasMonitoredGames && !isRunning) {
        console.log(`🔄 Starting ${sport} engine - new monitored games detected`);
        this.startEngine(sport, engine);
      } else if (!hasMonitoredGames && isRunning) {
        console.log(`🔄 Stopping ${sport} engine - no monitored games`);
        this.stopEngine(sport);
      }
    }
  }
  
  private stopEngine(sport: string): void {
    const intervalId = this.intervalIds.get(sport);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(sport);
      console.log(`⏹️ ${sport} engine stopped`);
    }
  }

  private async monitorSport(sport: string, engine: any): Promise<void> {
    try {
      console.log(`🔍 Monitoring ${sport} games...`);

      // Call the engine's specific monitoring method if it exists
      if (engine.monitor && typeof engine.monitor === 'function') {
        await engine.monitor();
      } else if (engine.startMonitoring && typeof engine.startMonitoring === 'function' && !engine.monitoringStarted) {
        // For engines with their own monitoring (MLB), just mark as started
        engine.monitoringStarted = true;
      }

    } catch (error) {
      console.error(`Error monitoring ${sport}:`, error);
    }
  }

  stopAllEngines(): void {
    console.log('🛑 Stopping all sport alert engines...');

    for (const [sport, intervalId] of Array.from(this.intervalIds.entries())) {
      clearInterval(intervalId);
      console.log(`✅ ${sport} engine stopped`);
    }

    this.intervalIds.clear();
  }

  // Set alert callback for all engines
  setAlertCallback(callback: (alert: any) => void): void {
    for (const engine of Array.from(this.engines.values())) {
      engine.onAlert = callback;
    }
  }
}

export const alertEngineManager = new AlertEngineManagerImpl();

// Export individual engines for direct access if needed
export { mlbEngine, nflEngine, nbaEngine, nhlEngine, weatherEngine };
export { BaseSportEngine } from './base-engine';