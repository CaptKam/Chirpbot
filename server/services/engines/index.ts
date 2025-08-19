import { mlbEngine } from './mlb-engine';
import { nflEngine } from './nfl-engine';
import { nbaEngine } from './nba-engine';
import { nhlEngine } from './nhl-engine';
import { weatherEngine } from './weather-engine';
import { aiEngine } from './ai-engine';
import { BaseSportEngine } from './base-engine';

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
    // Register all engines
    this.addEngine('MLB', mlbEngine);
    this.addEngine('NFL', nflEngine);
    this.addEngine('NBA', nbaEngine);
    this.addEngine('NHL', nhlEngine);
    this.addEngine('WEATHER', weatherEngine);
    this.addEngine('AI_ANALYSIS', aiEngine);
  }
  
  addEngine(sport: string, engine: BaseSportEngine): void {
    this.engines.set(sport, engine);
  }
  
  getEngine(sport: string): BaseSportEngine | undefined {
    return this.engines.get(sport);
  }
  
  async startAllEngines(): Promise<void> {
    console.log('🚀 Starting all sport alert engines...');
    
    for (const [sport, engine] of Array.from(this.engines.entries())) {
      try {
        console.log(`Starting ${sport} engine with ${engine.monitoringInterval/1000}s interval`);
        
        // Start monitoring for this engine
        const intervalId = setInterval(async () => {
          await this.monitorSport(sport, engine);
        }, engine.monitoringInterval);
        
        this.intervalIds.set(sport, intervalId);
        
        console.log(`✅ ${sport} engine started successfully`);
      } catch (error) {
        console.error(`❌ Failed to start ${sport} engine:`, error);
      }
    }
  }
  
  private async monitorSport(sport: string, engine: BaseSportEngine): Promise<void> {
    try {
      // This would be implemented based on each sport's specific monitoring logic
      // For now, we'll call a generic monitoring method
      
      console.log(`🔍 Monitoring ${sport} games...`);
      // Generic monitoring logic would go here
      
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
export { mlbEngine, nflEngine, nbaEngine, nhlEngine, weatherEngine, aiEngine };
export { BaseSportEngine } from './base-engine';