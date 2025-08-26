import { mlbEngine } from './mlb-engine';
import { nflEngine } from './nfl-engine';
import { nbaEngine } from './nba-engine';
import { nhlEngine } from './nhl-engine';
import { weatherEngine } from './weather-engine';
import { TennisEngine } from './tennis-engine';
import { tennisApi } from '../tennis-api';
// AI engine has been removed
import { BaseSportEngine } from './base-engine';
import { storage } from '../../storage';
import { outboxWorker } from '../outbox-worker';

// Create tennis engine instance
const tennisEngine = new TennisEngine({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID
});

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

  // Assigning engines directly for easier access within startAllEngines
  private mlbEngine = mlbEngine;
  private nflEngine = nflEngine;
  private nbaEngine = nbaEngine;
  private nhlEngine = nhlEngine;
  private weatherEngine = weatherEngine;
  private tennisEngine = tennisEngine;


  constructor() {
    // Register all engines
    this.addEngine('MLB', mlbEngine);
    this.addEngine('NFL', nflEngine);
    this.addEngine('NBA', nbaEngine);
    this.addEngine('NHL', nhlEngine);
    this.addEngine('TENNIS', tennisEngine);
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
    console.log('🔧 Starting all alert engines...');

    // Check which sports are enabled
    const enabledSports = process.env.SPORTS_ENABLED?.split(',').map(s => s.trim().toUpperCase()) || ['MLB', 'TENNIS'];
    console.log(`🎯 Enabled sports: ${enabledSports.join(', ')}`);

    const engines = [
      { name: 'MLB', engine: this.mlbEngine, interval: 1500, enabled: enabledSports.includes('MLB') },
      { name: 'NFL', engine: this.nflEngine, interval: 30000, enabled: enabledSports.includes('NFL') },
      { name: 'NBA', engine: this.nbaEngine, interval: 20000, enabled: enabledSports.includes('NBA') },
      { name: 'NHL', engine: this.nhlEngine, interval: 15000, enabled: enabledSports.includes('NHL') },
      { name: 'TENNIS', engine: this.tennisEngine, interval: 2000, enabled: enabledSports.includes('TENNIS') },
      { name: 'WEATHER', engine: this.weatherEngine, interval: 300000, enabled: true }
    ];

    for (const { name, engine, interval, enabled } of engines) {
      try {
        if (!enabled) {
          console.log(`⏸️ ${name} engine disabled - skipping`);
          continue;
        }

        if (!this.intervalIds.has(name)) {
          console.log(`🔧 Starting ${name} engine with ${interval}ms interval`);

          // Test engine first
          try {
            await engine.monitor();
            console.log(`✅ ${name} engine test successful`);
          } catch (testError) {
            console.error(`❌ ${name} engine test failed:`, testError);
            continue; // Skip this engine if test fails
          }

          const intervalId = setInterval(async () => {
            try {
              await engine.monitor();
            } catch (error) {
              console.error(`❌ ${name} engine monitor error:`, error);
            }
          }, interval);

          this.intervalIds.set(name, intervalId);
          console.log(`✅ ${name} engine started successfully`);
        } else {
          console.log(`⚠️ ${name} engine already running`);
        }
      } catch (error) {
        console.error(`❌ Failed to start ${name} engine:`, error);
      }
    }

    console.log(`🏁 Engine startup complete. Active engines: ${this.intervalIds.size}`);
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