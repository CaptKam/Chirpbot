import { EventEmitter } from 'events';
import { GameState, AlertResult, BaseAlertModule } from '../../services/engines/base-engine';
import { storage } from '../../storage';

/**
 * Unified interface for all sport engines
 * Simplified and standardized for better maintainability
 */
export interface SportEngineConfig {
  sport: string;
  apiService: any;
  alertModules: Map<string, BaseAlertModule>;
  enabledAlertTypes: string[];
  updateIntervalMs: number;
}

export interface EnhancedGameState extends GameState {
  probability?: number;
  context?: any;
  timestamp?: Date;
}

/**
 * Base class for all sport engines with standardized functionality
 */
export abstract class UnifiedSportEngine extends EventEmitter {
  protected sport: string;
  protected apiService: any;
  protected alertModules: Map<string, BaseAlertModule> = new Map();
  protected enabledAlertTypes: string[] = [];
  protected isInitialized = false;

  constructor(sport: string, apiService: any) {
    super();
    this.sport = sport;
    this.apiService = apiService;
  }

  /**
   * Initialize engine for a specific user
   */
  async initializeForUser(userId: string): Promise<void> {
    try {
      console.log(`🔧 Initializing ${this.sport} engine for user ${userId}`);

      // Get user's alert preferences for this sport
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, this.sport);
      this.enabledAlertTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      console.log(`✅ ${this.sport} enabled alerts for ${userId}:`, this.enabledAlertTypes);

      // Load alert modules for enabled types
      await this.loadAlertModules(this.enabledAlertTypes);

      this.isInitialized = true;
      this.emit('initialized', { userId, sport: this.sport });
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.sport} engine for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Load alert modules for specified types
   */
  private async loadAlertModules(alertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    for (const alertType of alertTypes) {
      try {
        const module = await this.loadSingleAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ Loaded ${this.sport} alert module: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load ${this.sport} module ${alertType}:`, error);
      }
    }

    console.log(`🔧 Loaded ${this.alertModules.size} alert modules for ${this.sport}`);
  }

  /**
   * Load a single alert module
   */
  private async loadSingleAlertModule(alertType: string): Promise<BaseAlertModule | null> {
    try {
      // Convert alert type to module filename
      const moduleFileName = alertType
        .toLowerCase()
        .replace(`${this.sport.toLowerCase()}_`, '')
        .replace(/_/g, '-') + '-module';

      const modulePath = `../services/engines/alert-cylinders/${this.sport.toLowerCase()}/${moduleFileName}`;
      const module = await import(modulePath);
      const ModuleClass = module.default;
      return new ModuleClass();
    } catch (error) {
      console.error(`❌ Failed to load alert module ${alertType}:`, error);
      return null;
    }
  }

  /**
   * Generate alerts for a game
   */
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    if (!this.isInitialized) {
      console.warn(`⚠️ ${this.sport} engine not initialized, skipping alert generation`);
      return [];
    }

    console.log(`🎯 Generating ${this.sport} alerts for game ${gameState.gameId} with ${this.alertModules.size} modules`);

    const enhancedGameState = await this.enhanceGameState(gameState);
    const alerts: AlertResult[] = [];

    for (const [alertType, module] of this.alertModules) {
      try {
        if (await this.shouldProcessAlert(alertType, enhancedGameState)) {
          if (module.isTriggered(enhancedGameState)) {
            const alert = module.generateAlert(enhancedGameState);
            if (alert) {
              // Add sport-specific enhancements
              const enhancedAlert = await this.enhanceAlert(alert, enhancedGameState);
              alerts.push(enhancedAlert);
              console.log(`📢 Generated ${this.sport} alert: ${alert.type}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${alertType} module:`, error);
      }
    }

    console.log(`📊 Generated ${alerts.length} ${this.sport} alerts for game ${gameState.gameId}`);
    this.emit('alertsGenerated', { gameId: gameState.gameId, alerts });

    return alerts;
  }

  /**
   * Enhance game state with sport-specific data
   */
  protected async enhanceGameState(gameState: GameState): Promise<EnhancedGameState> {
    const enhanced: EnhancedGameState = {
      ...gameState,
      timestamp: new Date()
    };

    try {
      // Add probability calculation
      enhanced.probability = await this.calculateProbability(gameState);

      // Add sport-specific context
      enhanced.context = await this.buildGameContext(gameState);

      // Get fresh API data if game is live
      if (gameState.isLive && this.apiService?.getGameState) {
        const freshData = await this.apiService.getGameState(gameState.gameId);
        if (freshData) {
          Object.assign(enhanced, freshData);
        }
      }
    } catch (error) {
      console.error(`❌ Error enhancing ${this.sport} game state:`, error);
    }

    return enhanced;
  }

  /**
   * Enhance alert with sport-specific data
   */
  protected async enhanceAlert(alert: AlertResult, gameState: EnhancedGameState): Promise<AlertResult> {
    return {
      ...alert,
      context: {
        ...alert.context,
        sport: this.sport,
        gameId: gameState.gameId,
        timestamp: new Date().toISOString(),
        probability: gameState.probability || 0
      }
    };
  }

  /**
   * Check if alert should be processed (deduplication, rate limiting, etc.)
   */
  protected async shouldProcessAlert(alertType: string, gameState: GameState): Promise<boolean> {
    // Basic enabled check
    if (!this.enabledAlertTypes.includes(alertType)) {
      return false;
    }

    // Game must be live
    if (!gameState.isLive) {
      return false;
    }

    // Add sport-specific filtering
    return await this.sportSpecificFiltering(alertType, gameState);
  }

  /**
   * Build context for the game
   */
  protected async buildGameContext(gameState: GameState): Promise<any> {
    return {
      sport: this.sport,
      gameId: gameState.gameId,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      status: gameState.status,
      isLive: gameState.isLive
    };
  }

  /**
   * Abstract methods that must be implemented by sport-specific engines
   */
  abstract calculateProbability(gameState: GameState): Promise<number>;
  abstract sportSpecificFiltering(alertType: string, gameState: GameState): Promise<boolean>;
  
  /**
   * Get available alert types for this sport
   */
  async getAvailableAlertTypes(): Promise<string[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const cylinderPath = path.join(currentDir, `../../services/engines/alert-cylinders/${this.sport.toLowerCase()}`);
      
      if (!fs.existsSync(cylinderPath)) {
        console.warn(`⚠️ No cylinder directory found for ${this.sport}`);
        return [];
      }

      const files = fs.readdirSync(cylinderPath);
      const alertTypes = files
        .filter(file => file.endsWith('-module.ts'))
        .map(file => {
          const alertName = file
            .replace('-module.ts', '')
            .replace(/-/g, '_')
            .toUpperCase();
          return `${this.sport}_${alertName}`;
        });

      return alertTypes;
    } catch (error) {
      console.error(`❌ Error getting available alert types for ${this.sport}:`, error);
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.alertModules.clear();
    this.enabledAlertTypes = [];
    this.isInitialized = false;
    console.log(`🧹 Disposed ${this.sport} engine`);
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      sport: this.sport,
      isInitialized: this.isInitialized,
      enabledAlertTypes: this.enabledAlertTypes,
      loadedModules: Array.from(this.alertModules.keys()),
      moduleCount: this.alertModules.size
    };
  }
}