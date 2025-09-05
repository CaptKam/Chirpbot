
export interface GameState {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  isLive: boolean;
  [key: string]: any; // Allow sport-specific fields
}

export interface AlertResult {
  alertKey: string;
  type: string;
  message: string;
  context: any;
  priority: number;
}

// Base class for individual alert modules
export abstract class BaseAlertModule {
  abstract alertType: string;
  abstract sport: string;
  
  abstract isTriggered(gameState: GameState): boolean;
  abstract generateAlert(gameState: GameState): AlertResult | null;
  abstract calculateProbability(gameState: GameState): number;
}

// Alert module manager for each sport
export class AlertModuleManager {
  private activeModules: Map<string, BaseAlertModule> = new Map();
  private sport: string;

  constructor(sport: string) {
    this.sport = sport;
  }

  // Dynamically load alert module when user enables it
  async loadAlertModule(alertType: string): Promise<void> {
    if (this.activeModules.has(alertType)) {
      return; // Already loaded
    }

    try {
      // Dynamic import based on sport and alert type
      const modulePath = `./alert-modules/${this.sport.toLowerCase()}/${alertType.toLowerCase()}-module`;
      const { default: AlertModule } = await import(modulePath);
      const module = new AlertModule();
      
      this.activeModules.set(alertType, module);
      console.log(`✅ Loaded ${alertType} module for ${this.sport}`);
    } catch (error) {
      console.error(`❌ Failed to load ${alertType} module for ${this.sport}:`, error);
    }
  }

  // Unload alert module when user disables it
  unloadAlertModule(alertType: string): void {
    if (this.activeModules.has(alertType)) {
      this.activeModules.delete(alertType);
      console.log(`🗑️ Unloaded ${alertType} module for ${this.sport}`);
    }
  }

  // Process all active modules for this game state
  processAlerts(gameState: GameState): AlertResult[] {
    const alerts: AlertResult[] = [];

    for (const [alertType, module] of this.activeModules) {
      try {
        if (module.isTriggered(gameState)) {
          const alert = module.generateAlert(gameState);
          if (alert) {
            alerts.push(alert);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${alertType} module:`, error);
      }
    }

    return alerts;
  }

  // Get list of currently active alert types
  getActiveAlertTypes(): string[] {
    return Array.from(this.activeModules.keys());
  }
}

export abstract class BaseSportEngine {
  protected sport: string;
  protected alertManager: AlertModuleManager;

  constructor(sport: string) {
    this.sport = sport;
    this.alertManager = new AlertModuleManager(sport);
  }

  // Load alert modules based on user preferences
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Clear existing modules
    const currentTypes = this.alertManager.getActiveAlertTypes();
    for (const type of currentTypes) {
      if (!enabledAlertTypes.includes(type)) {
        this.alertManager.unloadAlertModule(type);
      }
    }

    // Load new modules
    for (const alertType of enabledAlertTypes) {
      await this.alertManager.loadAlertModule(alertType);
    }
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    return this.alertManager.processAlerts(gameState);
  }

  abstract calculateProbability(gameState: GameState): Promise<number>;
}
