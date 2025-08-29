import { MLBEngineV3 } from './mlb-engine';

// V3 Engine runs independently for optimal performance
import { storage } from '../../storage';

export interface AlertEngineManager {
  startAllEngines(): Promise<void>;
  stopAllEngines(): void;
}

class AlertEngineManagerImpl implements AlertEngineManager {
  private intervalIds = new Map<string, NodeJS.Timeout>();
  private onAlert?: (alert: any) => void;

  constructor() {
    // All engines disabled - V3 MLB engine runs independently for superior performance
    // Other sport engines disabled to prevent interference with V3 AI system
    // AI engine has been removed
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
      const { MLBEngineV3 } = await import('./mlb-engine');
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
  // V3 system manages its own engine starting
  
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
  
  // V3 system manages its own monitoring - this method is no longer needed
  
  private stopEngine(sport: string): void {
    const intervalId = this.intervalIds.get(sport);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(sport);
      console.log(`⏹️ ${sport} engine stopped`);
    }
  }

  // V3 system handles its own monitoring

  stopAllEngines(): void {
    console.log('🛑 Stopping all sport alert engines...');

    for (const [sport, intervalId] of Array.from(this.intervalIds.entries())) {
      clearInterval(intervalId);
      console.log(`✅ ${sport} engine stopped`);
    }

    this.intervalIds.clear();
  }

  // Set alert callback for V3 system
  setAlertCallback(callback: (alert: any) => void): void {
    this.onAlert = callback;
    // V3 system handles its own callback management
  }
}

export const alertEngineManager = new AlertEngineManagerImpl();

// V3 system - only MLBEngineV3 is used