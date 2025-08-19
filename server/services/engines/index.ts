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
    console.log('🚀 Starting all sport engines...');

    // Start all engines
    await mlbEngine.startMonitoring();
    await nflEngine.startMonitoring();
    await nbaEngine.startMonitoring();
    await nhlEngine.startMonitoring();
    await weatherEngine.startMonitoring();
    await aiEngine.startMonitoring();

    console.log('✅ All sport engines started successfully');
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
export { mlbEngine, nflEngine, nbaEngine, nhlEngine, weatherEngine, aiEngine };
export { BaseSportEngine } from './base-engine';