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
      const modulePath = `./alert-cylinders/${this.sport.toLowerCase()}/${alertType.toLowerCase()}-module`;
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
  protected alertModules: Map<string, BaseAlertModule> = new Map();

  constructor(sport: string) {
    this.sport = sport;
  }

  abstract calculateProbability(gameState: GameState): Promise<number>;

  // Discover all available alert cylinders for this sport
  async discoverAvailableAlerts(): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const cylinderDir = path.join(__dirname, 'alert-cylinders', this.sport.toLowerCase());
      
      try {
        const files = await fs.readdir(cylinderDir);
        const alertTypes = files
          .filter(file => file.endsWith('-module.ts'))
          .map(file => file.replace('-module.ts', '').toUpperCase().replace('-', '_'));
        
        console.log(`🔍 Discovered ${alertTypes.length} alert cylinders for ${this.sport}:`, alertTypes);
        return alertTypes;
      } catch (error) {
        console.log(`📁 No alert cylinders directory found for ${this.sport}`);
        return [];
      }
    } catch (error) {
      console.error(`❌ Error discovering alert cylinders for ${this.sport}:`, error);
      return [];
    }
  }

  // Generate live alerts using loaded modules
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    console.log(`🔍 Generating alerts for game ${gameState.gameId} with ${this.alertModules.size} loaded modules`);
    
    for (const [alertType, module] of this.alertModules) {
      try {
        console.log(`🧪 Checking ${alertType} module for game ${gameState.gameId}`);
        
        if (module.isTriggered(gameState)) {
          console.log(`✅ ${alertType} triggered for game ${gameState.gameId}`);
          
          const alert = module.generateAlert(gameState);
          if (alert) {
            console.log(`📢 Generated ${alertType} alert: ${alert.message}`);
            alerts.push(alert);
          }
        } else {
          console.log(`⏸️ ${alertType} not triggered for game ${gameState.gameId}`);
        }
      } catch (error) {
        console.error(`❌ Error generating ${alertType} alert:`, error);
      }
    }

    console.log(`📊 Generated ${alerts.length} alerts for game ${gameState.gameId}`);
    return alerts;
  }

  // Load alert modules dynamically
  async loadAlertModule(alertType: string): Promise<BaseAlertModule | null> {
    try {
      const modulePath = `./alert-cylinders/${this.sport.toLowerCase()}/${alertType.toLowerCase().replace('_', '-')}-module`;
      const module = await import(modulePath);
      const ModuleClass = module.default;
      return new ModuleClass();
    } catch (error) {
      console.error(`Failed to load alert module ${alertType} for ${this.sport}:`, error);
      return null;
    }
  }

  // Initialize alert modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded alert module: ${alertType}`);
      }
    }
  }
}