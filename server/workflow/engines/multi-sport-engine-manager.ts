import { EventEmitter } from 'events';
import { UnifiedSportEngine } from './unified-sport-engine';
import { MLBEngineV4 } from './mlb-engine-v4';

// Import other engines as we rewrite them
// import { NFLEngineV4 } from './nfl-engine-v4';
// import { NBAEngineV4 } from './nba-engine-v4';

/**
 * Manages all sport engines with unified interface
 */
export class MultiSportEngineManager extends EventEmitter {
  private engines: Map<string, UnifiedSportEngine> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize all sport engines
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ MultiSportEngineManager already initialized');
      return;
    }

    console.log('🚀 Initializing MultiSportEngineManager...');

    try {
      // Initialize MLB engine
      const mlbEngine = new MLBEngineV4();
      this.engines.set('MLB', mlbEngine);
      console.log('✅ MLB Engine V4 registered');

      // TODO: Initialize other engines as we rewrite them
      /*
      const nflEngine = new NFLEngineV4();
      this.engines.set('NFL', nflEngine);

      const nbaEngine = new NBAEngineV4();
      this.engines.set('NBA', nbaEngine);
      */

      // Set up event forwarding
      this.setupEventForwarding();

      this.initialized = true;
      this.emit('initialized');
      console.log('✅ MultiSportEngineManager initialized with', this.engines.size, 'engines');

    } catch (error) {
      console.error('❌ Failed to initialize MultiSportEngineManager:', error);
      throw error;
    }
  }

  /**
   * Get engine for a specific sport
   */
  getEngine(sport: string): UnifiedSportEngine | null {
    const engine = this.engines.get(sport.toUpperCase());
    if (!engine) {
      console.warn(`⚠️ No engine found for sport: ${sport}`);
    }
    return engine || null;
  }

  /**
   * Get all registered sports
   */
  getRegisteredSports(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Initialize engine for a specific user and sport
   */
  async initializeEngineForUser(sport: string, userId: string): Promise<void> {
    const engine = this.getEngine(sport);
    if (!engine) {
      throw new Error(`No engine available for sport: ${sport}`);
    }

    await engine.initializeForUser(userId);
    console.log(`✅ ${sport} engine initialized for user ${userId}`);
  }

  /**
   * Generate alerts for a specific sport and game
   */
  async generateAlertsForGame(sport: string, gameState: any): Promise<any[]> {
    const engine = this.getEngine(sport);
    if (!engine) {
      console.warn(`⚠️ No engine available for ${sport}, skipping alerts`);
      return [];
    }

    try {
      const alerts = await engine.generateLiveAlerts(gameState);
      console.log(`📊 Generated ${alerts.length} alerts for ${sport} game ${gameState.gameId}`);
      return alerts;
    } catch (error) {
      console.error(`❌ Error generating alerts for ${sport} game ${gameState.gameId}:`, error);
      return [];
    }
  }

  /**
   * Get live games for a specific sport
   */
  async getLiveGamesForSport(sport: string): Promise<Array<{ gameId: string; priority?: number }>> {
    const engine = this.getEngine(sport);
    if (!engine) {
      return [];
    }

    try {
      // Check if engine has getLiveGames method
      if (typeof (engine as any).getLiveGames === 'function') {
        return await (engine as any).getLiveGames();
      }

      console.warn(`⚠️ ${sport} engine doesn't implement getLiveGames method`);
      return [];
    } catch (error) {
      console.error(`❌ Error getting live games for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Get status of all engines
   */
  getEnginesStatus() {
    const status: any = {};

    for (const [sport, engine] of this.engines) {
      status[sport] = engine.getStatus();
    }

    return {
      initialized: this.initialized,
      engineCount: this.engines.size,
      registeredSports: this.getRegisteredSports(),
      engines: status
    };
  }

  /**
   * Dispose all engines
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing MultiSportEngineManager...');

    for (const [sport, engine] of this.engines) {
      try {
        await engine.dispose();
        console.log(`✅ Disposed ${sport} engine`);
      } catch (error) {
        console.error(`❌ Error disposing ${sport} engine:`, error);
      }
    }

    this.engines.clear();
    this.initialized = false;
    console.log('✅ MultiSportEngineManager disposed');
  }

  /**
   * Set up event forwarding from individual engines
   */
  private setupEventForwarding(): void {
    for (const [sport, engine] of this.engines) {
      // Forward engine events with sport context
      engine.on('initialized', (data) => {
        this.emit('engineInitialized', { sport, ...data });
      });

      engine.on('alertsGenerated', (data) => {
        this.emit('alertsGenerated', { sport, ...data });
      });

      engine.on('error', (error) => {
        this.emit('engineError', { sport, error });
      });
    }
  }

  /**
   * Get available alert types for a sport
   */
  async getAvailableAlertTypes(sport: string): Promise<string[]> {
    const engine = this.getEngine(sport);
    if (!engine) {
      return [];
    }

    try {
      return await engine.getAvailableAlertTypes();
    } catch (error) {
      console.error(`❌ Error getting available alert types for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Check if a sport is supported
   */
  isSportSupported(sport: string): boolean {
    return this.engines.has(sport.toUpperCase());
  }

  /**
   * Get engine metrics
   */
  getMetrics() {
    const metrics: any = {
      totalEngines: this.engines.size,
      initialized: this.initialized,
      sports: {}
    };

    for (const [sport, engine] of this.engines) {
      metrics.sports[sport] = engine.getStatus();
    }

    return metrics;
  }
}