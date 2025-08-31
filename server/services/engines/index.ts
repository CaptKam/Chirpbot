
import { storage } from '../../storage';

export interface AlertEngineManager {
  startAllEngines(): Promise<void>;
  stopAllEngines(): void;
  handleGameStateChange(gameId: string, sport: string, newStatus: string): Promise<void>;
}

class AlertEngineManagerImpl implements AlertEngineManager {
  private intervalIds = new Map<string, NodeJS.Timeout>();
  private activeEngines = new Map<string, any>();
  private onAlert?: (alert: any) => void;

  constructor() {
    console.log('🎯 Dynamic Sport Engine Manager initialized');
    
    // Set up the main alert callback to integrate sport-specific settings with global Telegram credentials
    this.onAlert = async (alert: any) => {
      try {
        await this.processAlert(alert);
      } catch (error) {
        console.error('🚨 Error processing alert:', error);
      }
    };
  }

  async startAllEngines(): Promise<void> {
    console.log('🎯 Starting Dynamic Sport Engine System...');
    
    // Stop all running engines first
    this.stopAllEngines();
    
    // Start monitoring for game state changes
    await this.startGameStateMonitoring();
    
    console.log('✅ Dynamic Sport Engine System ready');
  }

  private async startGameStateMonitoring(): Promise<void> {
    // Monitor all sports for live games every 30 seconds
    const intervalId = setInterval(async () => {
      try {
        await this.checkAllSportsForLiveGames();
      } catch (error) {
        console.error('🚨 Game state monitoring error:', error);
      }
    }, 30000); // 30 seconds - check game states

    this.intervalIds.set('GAME_STATE_MONITOR', intervalId);
    console.log('✅ Game state monitoring started with 30-second interval');
  }

  private async checkAllSportsForLiveGames(): Promise<void> {
    const sports = ['MLB', 'NFL', 'NBA', 'NHL', 'CFL', 'NCAAF'];
    
    for (const sport of sports) {
      try {
        const hasMonitoredGames = await this.hasMonitoredGamesForSport(sport);
        if (!hasMonitoredGames) continue;

        // Temporary fix for NCAAF: Skip getTodaysGamesForSport and directly process monitored games
        if (sport === 'NCAAF') {
          console.log('🏈 NCAAF: Using direct monitoring bypass...');
          const monitoredGames = await storage.getAllMonitoredGames();
          const ncaafGames = monitoredGames.filter(game => game.sport === 'NCAAF');
          
          for (const game of ncaafGames) {
            // For monitored NCAAF games, force start engines and process alerts
            console.log(`🏈 NCAAF: Force starting engine for monitored game ${game.gameId}`);
            const engineKey = `${sport}_${game.gameId}`;
            
            if (!this.activeEngines.has(engineKey)) {
              await this.startEngineForGame(sport, game.gameId);
            }
          }
          continue;
        }

        const games = await this.getTodaysGamesForSport(sport);
        
        for (const game of games) {
          const isMonitored = await this.isGameMonitored(game.gameId);
          if (!isMonitored) continue;

          await this.handleGameStateChange(game.gameId, sport, game.status);
        }
      } catch (error) {
        console.error(`❌ Error checking ${sport} games:`, error);
      }
    }
  }

  async handleGameStateChange(gameId: string, sport: string, newStatus: string): Promise<void> {
    const isLive = this.isGameLive(newStatus);
    const isFinal = this.isGameFinal(newStatus);
    const engineKey = `${sport}_${gameId}`;

    if (isLive && !this.activeEngines.has(engineKey)) {
      // Game went live - start engine for this specific game
      console.log(`🔴 Game ${gameId} is now LIVE - starting ${sport} engine`);
      await this.startEngineForGame(sport, gameId);
    } else if (isFinal && this.activeEngines.has(engineKey)) {
      // Game finished - stop engine and remove from monitoring
      console.log(`🏁 Game ${gameId} is FINAL - stopping ${sport} engine`);
      await this.stopEngineForGame(sport, gameId);
      await this.removeGameFromMonitoring(gameId);
    }
  }

  private async startEngineForGame(sport: string, gameId: string): Promise<void> {
    try {
      const engine = await this.createEngineForSport(sport);
      if (!engine) return;

      const engineKey = `${sport}_${gameId}`;
      
      // Set up alert callback
      engine.onAlert = (alert: any) => {
        if (this.onAlert) {
          this.onAlert(alert);
        }
      };

      // Start monitoring this specific game
      const intervalId = setInterval(async () => {
        try {
          await engine.processSpecificGame(gameId);
        } catch (error) {
          console.error(`🚨 ${sport} engine error for game ${gameId}:`, error);
        }
      }, 15000); // 15 seconds for live game monitoring

      this.intervalIds.set(engineKey, intervalId);
      this.activeEngines.set(engineKey, engine);
      
      console.log(`✅ ${sport} engine started for game ${gameId}`);
    } catch (error) {
      console.error(`❌ Failed to start ${sport} engine for game ${gameId}:`, error);
    }
  }

  private async stopEngineForGame(sport: string, gameId: string): Promise<void> {
    const engineKey = `${sport}_${gameId}`;
    
    const intervalId = this.intervalIds.get(engineKey);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(engineKey);
    }
    
    this.activeEngines.delete(engineKey);
    console.log(`⏹️ ${sport} engine stopped for game ${gameId}`);
  }

  private async createEngineForSport(sport: string): Promise<any> {
    try {
      switch (sport) {
        case 'MLB':
          const { MLBEngine } = await import('./mlb-engine');
          return new MLBEngine();
        case 'NFL':
          const { NFLEngine } = await import('./nfl-engine');
          return new NFLEngine();
        case 'NBA':
          const { NBAEngine } = await import('./nba-engine');
          return new NBAEngine();
        case 'NHL':
          const { NHLEngine } = await import('./nhl-engine');
          return new NHLEngine();
        case 'CFL':
          const { cflEngine } = await import('./cfl-engine');
          return cflEngine;
        case 'NCAAF':
          const { NCAAFEngine } = await import('./ncaaf-engine');
          return new NCAAFEngine();
        default:
          console.warn(`No engine available for sport: ${sport}`);
          return null;
      }
    } catch (error) {
      console.error(`Error creating ${sport} engine:`, error);
      return null;
    }
  }

  private async getTodaysGamesForSport(sport: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      switch (sport) {
        case 'MLB':
          const { MLBEngine } = await import('./mlb-engine');
          const mlbEngine = new MLBEngine();
          return await mlbEngine.getTodaysGames(today);
        case 'NFL':
          const { NFLEngine } = await import('./nfl-engine');
          const nflEngine = new NFLEngine();
          return await nflEngine.getTodaysGames(today);
        case 'NBA':
          const { NBAEngine } = await import('./nba-engine');
          const nbaEngine = new NBAEngine();
          return await nbaEngine.getTodaysGames(today);
        case 'NHL':
          const { NHLEngine } = await import('./nhl-engine');
          const nhlEngine = new NHLEngine();
          return await nhlEngine.getTodaysGames(today);
        case 'CFL':
          const { cflEngine } = await import('./cfl-engine');
          return await cflEngine.getTodaysGames(today);
        case 'NCAAF':
          const { NCAAEngine } = await import('./ncaaf-engine');
          const ncaafEngine = new NCAAEngine();
          return await ncaafEngine.getTodaysGames(today);
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error getting ${sport} games:`, error);
      return [];
    }
  }

  private isGameLive(status: string): boolean {
    return (
      status.includes('Progress') || 
      status.includes('Live') ||
      status.toLowerCase().includes('inning') ||
      status.toLowerCase().includes('quarter') ||
      status.toLowerCase().includes('period') ||
      status.toLowerCase().includes('half')
    );
  }

  private isGameFinal(status: string): boolean {
    return (
      status.includes('Final') ||
      status.includes('Completed') ||
      status.toLowerCase().includes('final')
    );
  }

  private async isGameMonitored(gameId: string): Promise<boolean> {
    try {
      const monitoredGames = await storage.getAllMonitoredGames();
      return monitoredGames.some(game => game.gameId === gameId);
    } catch (error) {
      console.error('Error checking if game is monitored:', error);
      return false;
    }
  }

  private async removeGameFromMonitoring(gameId: string): Promise<void> {
    try {
      await storage.removeGameFromAllUsers(gameId);
      console.log(`🗑️ Game ${gameId} removed from monitoring (game finished)`);
    } catch (error) {
      console.error(`Error removing game ${gameId} from monitoring:`, error);
    }
  }

  private async hasMonitoredGamesForSport(sport: string): Promise<boolean> {
    try {
      const allMonitoredGames = await this.getAllMonitoredGames();
      return allMonitoredGames.some(game => game.sport === sport);
    } catch (error) {
      console.error(`Error checking monitored games for ${sport}:`, error);
      return false;
    }
  }
  
  private async getAllMonitoredGames(): Promise<any[]> {
    try {
      return await storage.getAllMonitoredGames();
    } catch (error) {
      console.error('Error fetching all monitored games:', error);
      return [];
    }
  }

  stopAllEngines(): void {
    console.log('🛑 Stopping all sport alert engines...');

    for (const [key, intervalId] of Array.from(this.intervalIds.entries())) {
      clearInterval(intervalId);
      console.log(`✅ ${key} engine stopped`);
    }

    this.intervalIds.clear();
    this.activeEngines.clear();
  }

  setAlertCallback(callback: (alert: any) => void): void {
    this.onAlert = callback;
  }

  /**
   * Process alert and integrate sport-specific settings with global Telegram credentials
   */
  private async processAlert(alert: any): Promise<void> {
    try {
      console.log(`🔔 Processing alert: ${alert.sport} - ${alert.type} (Priority: ${alert.priority})`);
      
      // Get sport-specific settings for this alert
      const sportSettings = await storage.getUserSettings('', alert.sport); // TODO: Get actual user ID
      if (!sportSettings) {
        console.log(`⚠️ No sport settings found for ${alert.sport}`);
        return;
      }

      // Check if Telegram is enabled for this sport
      if (!sportSettings.telegramEnabled) {
        console.log(`📵 Telegram disabled for ${alert.sport} - skipping notification`);
        return;
      }

      // Get global user Telegram credentials
      const users = await storage.getAllUsers();
      const user = users[0]; // TODO: Get actual user for this alert
      if (!user || !user.telegramBotToken || !user.telegramChatId) {
        console.log(`🚫 Global Telegram credentials not configured - skipping notification`);
        return;
      }

      // Send Telegram notification
      const { sendTelegramAlert } = await import('../telegram');
      const telegramConfig = {
        botToken: user.telegramBotToken,
        chatId: user.telegramChatId
      };
      
      const success = await sendTelegramAlert(telegramConfig, alert);
      if (success) {
        console.log(`✅ Telegram notification sent for ${alert.sport} alert`);
      } else {
        console.log(`❌ Failed to send Telegram notification for ${alert.sport} alert`);
      }
      
    } catch (error) {
      console.error('🚨 Error processing alert for Telegram:', error);
    }
  }
}

export const alertEngineManager = new AlertEngineManagerImpl();
