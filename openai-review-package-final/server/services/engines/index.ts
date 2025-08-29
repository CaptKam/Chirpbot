import { MLBEngineV3 } from './mlb-engine-v3';
import { nflEngine } from './nfl-engine';
import { nbaEngine } from './nba-engine';
import { nhlEngine } from './nhl-engine';
import { weatherEngine } from './weather-engine';
// AI engine has been removed
import { BaseSportEngine } from './base-engine';

// V3 Engine runs independently for optimal performance
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
  private onAlert?: (alert: any) => void;

  constructor() {
    // All engines disabled - V3 MLB engine runs independently for superior performance
    // Other sport engines disabled to prevent interference with V3 AI system
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
    
    // Start V3 MLB engine with proper monitoring loop
    console.log('🔧 Starting MLB V3 engine with AI enhancement...');
    await this.startV3Engine();
    
    console.log('✅ Game Situations alert system ready');
  }

  private async startV3Engine(): Promise<void> {
    try {
      const { MLBEngineV3 } = await import('./mlb-engine-v3');
      const v3Engine = new MLBEngineV3();
      
      // Set up alert callback for V3 engine
      v3Engine.onAlert = (alert: any) => {
        if (this.onAlert) {
          this.onAlert(alert);
        }
      };

      // Start V3 monitoring with 15-second interval for optimal performance
      const intervalId = setInterval(async () => {
        try {
          await v3Engine.processLiveGamesOnly();
        } catch (error) {
          console.error('🚨 V3 Engine monitoring error:', error);
        }
      }, 15000); // 15 seconds - optimal for live game monitoring

      this.intervalIds.set('MLB_V3', intervalId);
      console.log('✅ MLB V3 engine started with 15-second monitoring interval');
      
    } catch (error) {
      console.error('❌ Failed to start V3 engine:', error);
    }
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
    this.onAlert = callback;
    for (const engine of Array.from(this.engines.values())) {
      engine.onAlert = callback;
    }
  }
}

export const alertEngineManager = new AlertEngineManagerImpl();

// Export individual engines for direct access if needed  
export { nflEngine, nbaEngine, nhlEngine, weatherEngine };
export { BaseSportEngine } from './base-engine';