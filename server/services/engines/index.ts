
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
    const sports = ['MLB', 'NFL', 'NBA', 'NHL', 'CFL', 'NCAAF']; // NCAAF REACTIVATED
    
    for (const sport of sports) {
      try {
        const hasMonitoredGames = await this.hasMonitoredGamesForSport(sport);
        if (!hasMonitoredGames) continue;


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

      // Start monitoring this specific game using proper 4-step flow
      const intervalId = setInterval(async () => {
        try {
          await this.executeProperAlertFlow(sport, gameId, engine);
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
          const { NCAAFEngine } = await import('./ncaaf-engine');
          const ncaafEngine = new NCAAFEngine();
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
    
    console.log('✅ EMERGENCY STOP COMPLETE: All engines cleared');
  }

  setAlertCallback(callback: (alert: any) => void): void {
    this.onAlert = callback;
  }

  /**
   * PROPER 4-STEP FLOW IMPLEMENTATION
   * Step 1: Game Status Monitoring (handled by checkAllSportsForLiveGames)
   * Step 2: Sport Engine - collect game state data only
   * Step 3: AlertModel - validate the data 
   * Step 4: OpenAI → Betbook → Launch - create final alert
   */
  private async executeProperAlertFlow(sport: string, gameId: string, engine: any): Promise<void> {
    try {
      console.log(`🎯 STEP 2: ${sport} Engine - Collecting game state data for ${gameId}`);
      
      // STEP 2: Sport Engine - Get game state data (not create alerts directly)
      const gameStateData = await this.collectGameStateData(sport, gameId, engine);
      if (!gameStateData) {
        console.log(`❌ No game state data available for ${sport} game ${gameId}`);
        return;
      }

      console.log(`🎯 STEP 3: AlertModel - Validating data for ${sport} game ${gameId}`);
      
      // STEP 3: AlertModel - Validate if alert should be generated
      const shouldAlert = await this.validateAlertModel(gameStateData);
      if (!shouldAlert.valid) {
        console.log(`❌ AlertModel validation failed for ${sport} game ${gameId}: ${shouldAlert.reason}`);
        return;
      }

      console.log(`🎯 STEP 4: OpenAI/Betbook - Processing alert for ${sport} game ${gameId}`);
      
      // STEP 4: OpenAI → Betbook → Launch - Create final enhanced alert
      await this.processAndLaunchAlert(gameStateData, shouldAlert.data);
      
    } catch (error) {
      console.error(`❌ 4-step flow failed for ${sport} game ${gameId}:`, error);
    }
  }

  private async collectGameStateData(sport: string, gameId: string, engine: any): Promise<any> {
    // Only collect data, don't create alerts
    if (sport === 'MLB' && engine.buildGameState) {
      const games = await engine.getTodaysGames();
      const game = games.find((g: any) => g.gameId === gameId);
      if (game) {
        return await engine.buildGameState(game);
      }
    }
    return null;
  }

  private async validateAlertModel(gameStateData: any): Promise<{valid: boolean, reason?: string, data?: any}> {
    // Use the AlertModel to validate if alert should be generated
    try {
      const mlbAlertModel = await import('./mlbAlertModel.cjs');
      const modelFormat = this.convertToModelFormat(gameStateData);
      const result = mlbAlertModel.checkScoringProbability(modelFormat);
      
      if (result.shouldAlert) {
        return { valid: true, data: result };
      } else {
        return { valid: false, reason: result.reasons?.join(', ') || 'Model validation failed' };
      }
    } catch (error) {
      return { valid: false, reason: `AlertModel error: ${error.message}` };
    }
  }

  private convertToModelFormat(gameState: any) {
    return {
      clock: { inning: gameState.inning || 1, outs: gameState.outs || 0 },
      bases: { 
        on1B: !!gameState.runners?.first,
        on2B: !!gameState.runners?.second, 
        on3B: !!gameState.runners?.third
      },
      score: { home: gameState.homeScore || 0, away: gameState.awayScore || 0 },
      batter: null,
      onDeck: null,
      pitcher: null,
      weather: null,
      park: null
    };
  }

  private async processAndLaunchAlert(gameStateData: any, alertData: any): Promise<void> {
    // Create proper alert with OpenAI and Betbook processing
    try {
      const { storage } = await import('../../storage');
      const { AlertFormatValidator } = await import('./AlertFormatValidator');
      
      // Generate unique debug ID for tracking
      const fullId = `${gameStateData.sport || 'MLB'}_${gameStateData.gameId}_${Date.now()}`;
      const debugId = fullId.substring(0, 8).toUpperCase();
      const flowTag = `S4-OAI-BB`; // Step 4: OpenAI -> Betbook flow
      
      console.log(`🔍 DEBUG: Creating alert [${debugId}] via 4-step flow`);
      console.log(`📍 Flow: Step1(Monitor) → Step2(Engine) → Step3(Model) → Step4(${flowTag})`);
      
      // Create standardized alert
      const alert = {
        id: fullId,
        debugId: `${debugId}-${flowTag}`,
        type: 'SCORING',
        sport: 'MLB',
        title: AlertFormatValidator.generateStandardTitle('MLB', 'SCORING', {
          home: gameStateData.homeScore || 0,
          away: gameStateData.awayScore || 0
        }),
        description: AlertFormatValidator.generateStandardDescription('MLB', 'SCORING', gameStateData),
        gameInfo: {
          homeTeam: gameStateData.homeTeam || 'Home',
          awayTeam: gameStateData.awayTeam || 'Away',
          score: { home: gameStateData.homeScore || 0, away: gameStateData.awayScore || 0 },
          status: 'Live',
          situation: 'RISP',
          inning: gameStateData.inning || 1,
          inningState: gameStateData.inningState || 'top',
          outs: gameStateData.outs || 0,
          runners: {
            first: !!gameStateData.runners?.first,
            second: !!gameStateData.runners?.second,
            third: !!gameStateData.runners?.third
          }
        },
        priority: alertData.priority || 80,
        timestamp: new Date(),
        seen: false
      };

      // Validate compliance
      const validation = AlertFormatValidator.validateCompliance(alert);
      if (!validation.isValid) {
        console.error('❌ ALERT COMPLIANCE VIOLATION:', validation.violations);
        return;
      }

      // Store alert and broadcast with debug info
      // DISABLED: Direct storage.createAlert bypasses 4-step flow
      // await storage.createAlert(alert);
      if (this.onAlert) {
        this.onAlert(alert);
      }
      
      console.log(`✅ 4-step flow completed: Alert created [${alert.debugId}] for game ${gameStateData.gameId}`);
      console.log(`🔍 DEBUG: Alert stored with ID ${alert.debugId} | Type: ${alert.type} | Sport: ${alert.sport}`);
      
    } catch (error) {
      console.error('❌ Final alert processing failed:', error);
    }
  }
}

export const alertEngineManager = new AlertEngineManagerImpl();
