import { MLBApiService } from './mlb-api';
import { NFLApiService } from './nfl-api';

export type Sport = 'MLB' | 'NFL';

export interface GamePollingState {
  gameId: string;
  sport: Sport;
  currentState: 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended';
  lastPolled: number;
  pollInterval: number;
  stateChangeCount: number;
  lastStateChange: number;
  isUserMonitored: boolean;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  quarter?: number; // For NFL games
  timeRemaining?: string; // For time-based sports
}

export interface PollingConfig {
  scheduled: { interval: number; cacheTTL: number };
  live: { interval: number; cacheTTL: number };
  final: { interval: number; cacheTTL: number };
  delayed: { interval: number; cacheTTL: number };
  suspended: { interval: number; cacheTTL: number };
}

export interface SportApiServices {
  MLB?: MLBApiService;
  NFL?: NFLApiService;
}

export class AdaptivePollingManager {
  private gameStates: Map<string, GamePollingState> = new Map();
  private apiServices: SportApiServices;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastBatchPoll: number = 0;
  private isEnabled: boolean = true;
  private sport: Sport;

  // Sport-specific intelligent polling intervals
  private readonly SPORT_POLLING_CONFIGS: Record<Sport, PollingConfig> = {
    MLB: {
      scheduled: { interval: 10000, cacheTTL: 30000 },    // 10s for pre-game
      live: { interval: 250, cacheTTL: 1000 },            // 250ms for live games
      final: { interval: 60000, cacheTTL: 300000 },       // 1min for completed games  
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    NFL: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-2)
      live: { interval: 1000, cacheTTL: 2000 },           // 1s for live games (V3-2)
      final: { interval: 300000, cacheTTL: 600000 },      // 300s for completed games (V3-2)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    }
  };

  // Criticality-based adjustments
  private readonly CRITICALITY_MULTIPLIERS = {
    low: 2.0,      // 2x slower for blowouts
    medium: 1.5,   // 1.5x slower for moderate games
    high: 1.0,     // Standard rate for competitive games
    critical: 0.5  // 2x faster for clutch situations
  };

  constructor(sport: Sport, apiServices: SportApiServices) {
    this.sport = sport;
    this.apiServices = apiServices;
    console.log(`🎯 AdaptivePollingManager initialized for ${sport} with intelligent intervals`);
  }

  /**
   * Initialize polling for a set of games with their current states
   */
  async initializeGamePolling(games: any[], userMonitoredGameIds: Set<string>): Promise<void> {
    console.log(`🔧 Initializing adaptive polling for ${games.length} games`);
    
    for (const game of games) {
      const gameId = game.id || game.gameId;
      const gameState = this.analyzeGameState(game);
      const isUserMonitored = userMonitoredGameIds.has(gameId);
      
      // Calculate initial criticality
      const criticality = this.calculateGameCriticality(game);
      
      const pollingState: GamePollingState = {
        gameId,
        sport: this.sport,
        currentState: gameState,
        lastPolled: 0,
        pollInterval: this.calculatePollInterval(gameState, criticality, isUserMonitored),
        stateChangeCount: 0,
        lastStateChange: Date.now(),
        isUserMonitored,
        criticality,
        quarter: this.sport === 'NFL' ? (game.quarter || 1) : undefined,
        timeRemaining: game.timeRemaining || undefined
      };

      this.gameStates.set(gameId, pollingState);
      
      // Only start individual polling for live/critical games
      if (gameState === 'live' || criticality === 'critical') {
        await this.startIndividualPolling(gameId);
      }
    }

    // Start batch polling for non-live games
    this.startBatchPolling();
    
    console.log(`✅ Adaptive polling initialized: ${this.gameStates.size} games tracked`);
    this.logPollingStatistics();
  }

  /**
   * Analyze game to determine current state
   */
  private analyzeGameState(game: any): 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended' {
    const status = game.status?.toLowerCase() || '';
    
    if (game.isLive || status.includes('live') || status.includes('progress')) {
      return 'live';
    }
    
    if (status.includes('final') || status.includes('completed')) {
      return 'final';
    }
    
    if (status.includes('delayed') || status.includes('postponed')) {
      return 'delayed';
    }
    
    if (status.includes('suspended')) {
      return 'suspended';
    }
    
    return 'scheduled';
  }

  /**
   * Calculate game criticality based on sport, score, and game situation
   */
  private calculateGameCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    if (this.sport === 'NFL') {
      return this.calculateNFLCriticality(game);
    } else {
      return this.calculateMLBCriticality(game);
    }
  }

  /**
   * Calculate MLB game criticality based on score, inning, and situation
   */
  private calculateMLBCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const inning = game.inning || 1;
    const totalScore = homeScore + awayScore;

    // Critical: Close games in late innings
    if (scoreDiff <= 2 && inning >= 7) {
      return 'critical';
    }

    // High: Close games or late innings
    if (scoreDiff <= 3 || inning >= 6) {
      return 'high';
    }

    // Medium: Moderate competition
    if (scoreDiff <= 6 && totalScore > 3) {
      return 'medium';
    }

    // Low: Blowouts or very early games
    return 'low';
  }

  /**
   * Calculate NFL game criticality based on score, quarter, and game situation
   */
  private calculateNFLCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || 1;
    const timeRemaining = game.timeRemaining || '';
    const fieldPosition = game.fieldPosition;
    const down = game.down;

    // Parse time remaining in seconds
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 7) {
      return 'critical';
    }

    // Critical: Two-minute warning situations
    if (quarter >= 4 && timeSeconds <= 120) {
      return 'critical';
    }

    // Critical: Red zone situations (within 20 yards)
    if (fieldPosition && fieldPosition <= 20) {
      return 'critical';
    }

    // Critical: Fourth down situations
    if (down === 4) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 10) {
      return 'high';
    }

    // High: Close to scoring territory
    if (fieldPosition && fieldPosition <= 40) {
      return 'high';
    }

    // Medium: Competitive games
    if (scoreDiff <= 14) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Parse time string to seconds for NFL games
   */
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  /**
   * Calculate optimal polling interval for a game using sport-specific config
   */
  private calculatePollInterval(
    gameState: 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended',
    criticality: 'low' | 'medium' | 'high' | 'critical',
    isUserMonitored: boolean
  ): number {
    const sportConfig = this.SPORT_POLLING_CONFIGS[this.sport];
    let baseInterval = sportConfig[gameState].interval;
    
    // Apply criticality multiplier
    const multiplier = this.CRITICALITY_MULTIPLIERS[criticality];
    baseInterval = Math.round(baseInterval * multiplier);
    
    // User-monitored games get priority (25% faster)
    if (isUserMonitored) {
      baseInterval = Math.round(baseInterval * 0.75);
    }
    
    // Enforce sport-specific minimum intervals for safety
    const minimums = this.sport === 'NFL' ? {
      live: 1000,    // 1s minimum for NFL live (V3-2)
      scheduled: 15000, // 15s minimum for NFL scheduled
      final: 60000,    // 1min minimum for NFL final
      delayed: 3000,
      suspended: 3000
    } : {
      live: 200,     // 200ms minimum for MLB live
      scheduled: 5000,
      final: 30000,
      delayed: 3000,
      suspended: 3000
    };
    
    return Math.max(baseInterval, minimums[gameState]);
  }

  /**
   * Start individual high-frequency polling for critical games
   */
  private async startIndividualPolling(gameId: string): Promise<void> {
    const state = this.gameStates.get(gameId);
    if (!state) return;

    // Clear any existing timer
    const existingTimer = this.pollingTimers.get(gameId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const poll = async () => {
      try {
        await this.pollIndividualGame(gameId);
        
        // Schedule next poll if still needed
        const updatedState = this.gameStates.get(gameId);
        if (updatedState && (updatedState.currentState === 'live' || updatedState.criticality === 'critical')) {
          const timer = setTimeout(poll, updatedState.pollInterval);
          this.pollingTimers.set(gameId, timer);
        }
      } catch (error) {
        console.error(`❌ Individual polling error for game ${gameId}:`, error);
        // Retry with exponential backoff
        const retryDelay = Math.min(state.pollInterval * 2, 10000);
        const timer = setTimeout(poll, retryDelay);
        this.pollingTimers.set(gameId, timer);
      }
    };

    // Start polling immediately
    await poll();
    
    console.log(`🚀 Individual polling started for game ${gameId} (${state.pollInterval}ms)`);
  }

  /**
   * Poll a single game with enhanced data using sport-specific API
   */
  private async pollIndividualGame(gameId: string): Promise<void> {
    const state = this.gameStates.get(gameId);
    if (!state) return;

    const now = Date.now();
    if (now - state.lastPolled < state.pollInterval) {
      return; // Too soon
    }

    try {
      let enhancedData = null;
      
      // Use sport-specific API service
      if (this.sport === 'MLB' && this.apiServices.MLB) {
        enhancedData = await this.apiServices.MLB.getEnhancedGameData(gameId);
      } else if (this.sport === 'NFL' && this.apiServices.NFL) {
        enhancedData = await this.apiServices.NFL.getEnhancedGameData(gameId, 'live');
      }
      
      if (enhancedData && !enhancedData.error) {
        // Update game state and detect transitions
        await this.updateGameState(gameId, enhancedData);
        state.lastPolled = now;
        
        console.log(`🔄 ${this.sport} Individual poll: Game ${gameId} (${state.currentState}/${state.criticality})`);
      }
    } catch (error) {
      console.error(`❌ ${this.sport} Individual game polling failed for ${gameId}:`, error);
    }
  }

  /**
   * Start batch polling for non-critical games
   */
  private startBatchPolling(): void {
    const BATCH_INTERVAL = 8000; // 8 second batch cycles

    const batchPoll = async () => {
      try {
        await this.batchPollGames();
      } catch (error) {
        console.error('❌ Batch polling error:', error);
      }
      
      // Schedule next batch
      setTimeout(batchPoll, BATCH_INTERVAL);
    };

    // Start batch polling
    batchPoll();
    console.log(`🔄 Batch polling started (${BATCH_INTERVAL}ms cycles)`);
  }

  /**
   * Poll multiple non-critical games in batches using sport-specific API
   */
  private async batchPollGames(): Promise<void> {
    const now = Date.now();
    
    // Find games ready for batch polling
    const gamesToPoll = Array.from(this.gameStates.entries())
      .filter(([gameId, state]) => {
        // Don't batch poll live/critical games (they have individual polling)
        if (state.currentState === 'live' || state.criticality === 'critical') {
          return false;
        }
        
        // Check if it's time to poll this game
        return (now - state.lastPolled) >= state.pollInterval;
      })
      .map(([gameId]) => gameId);

    if (gamesToPoll.length === 0) {
      return;
    }

    try {
      let allGames = [];
      
      // Use sport-specific API service for batch fetching
      if (this.sport === 'MLB' && this.apiServices.MLB) {
        allGames = await this.apiServices.MLB.getTodaysGames();
      } else if (this.sport === 'NFL' && this.apiServices.NFL) {
        allGames = await this.apiServices.NFL.getTodaysGames();
      }
      
      const gameMap = new Map(allGames.map(game => [game.id, game]));
      
      console.log(`📦 ${this.sport} Batch polling ${gamesToPoll.length} games`);
      
      for (const gameId of gamesToPoll) {
        const gameData = gameMap.get(gameId);
        if (gameData) {
          await this.updateGameState(gameId, gameData);
          const state = this.gameStates.get(gameId);
          if (state) {
            state.lastPolled = now;
          }
        }
      }
      
      this.lastBatchPoll = now;
    } catch (error) {
      console.error(`❌ ${this.sport} Batch polling failed:`, error);
    }
  }

  /**
   * Update game state and detect transitions
   */
  private async updateGameState(gameId: string, gameData: any): Promise<void> {
    const currentState = this.gameStates.get(gameId);
    if (!currentState) return;

    const newState = this.analyzeGameState(gameData);
    const newCriticality = this.calculateGameCriticality(gameData);
    
    // Detect state transitions
    if (newState !== currentState.currentState) {
      console.log(`🔄 Game ${gameId}: ${currentState.currentState} → ${newState}`);
      
      currentState.currentState = newState;
      currentState.stateChangeCount++;
      currentState.lastStateChange = Date.now();
      
      // Recalculate polling interval
      const newInterval = this.calculatePollInterval(newState, newCriticality, currentState.isUserMonitored);
      currentState.pollInterval = newInterval;
      
      // Handle transition logic
      await this.handleStateTransition(gameId, currentState.currentState, newState);
    }

    // Update criticality
    if (newCriticality !== currentState.criticality) {
      console.log(`🎯 Game ${gameId} criticality: ${currentState.criticality} → ${newCriticality}`);
      currentState.criticality = newCriticality;
      
      // Recalculate interval with new criticality
      const newInterval = this.calculatePollInterval(newState, newCriticality, currentState.isUserMonitored);
      currentState.pollInterval = newInterval;
    }
  }

  /**
   * Handle game state transitions
   */
  private async handleStateTransition(gameId: string, oldState: string, newState: string): Promise<void> {
    // Game going live - start individual polling
    if (newState === 'live' && oldState !== 'live') {
      console.log(`🚀 Game ${gameId} went live - starting individual polling`);
      await this.startIndividualPolling(gameId);
    }
    
    // Game finished - stop individual polling
    if (newState === 'final' && oldState === 'live') {
      console.log(`🏁 Game ${gameId} finished - stopping individual polling`);
      const timer = this.pollingTimers.get(gameId);
      if (timer) {
        clearTimeout(timer);
        this.pollingTimers.delete(gameId);
      }
    }
  }

  /**
   * Get current polling statistics
   */
  getPollingStatistics(): { [key: string]: number } {
    const stats = {
      totalGames: this.gameStates.size,
      liveGames: 0,
      scheduledGames: 0,
      finalGames: 0,
      delayedGames: 0,
      suspendedGames: 0,
      criticalGames: 0,
      highPriorityGames: 0,
      individualPollingActive: this.pollingTimers.size
    };

    for (const state of this.gameStates.values()) {
      // Type-safe game state counting
      switch (state.currentState) {
        case 'live':
          stats.liveGames++;
          break;
        case 'scheduled':
          stats.scheduledGames++;
          break;
        case 'final':
          stats.finalGames++;
          break;
        case 'delayed':
          stats.delayedGames++;
          break;
        case 'suspended':
          stats.suspendedGames++;
          break;
      }
      
      if (state.criticality === 'critical') stats.criticalGames++;
      if (state.criticality === 'high' || state.criticality === 'critical') stats.highPriorityGames++;
    }

    return stats;
  }

  /**
   * Log polling statistics for monitoring
   */
  private logPollingStatistics(): void {
    const stats = this.getPollingStatistics();
    console.log(`📊 Polling Stats: ${stats.liveGames} live, ${stats.scheduledGames} scheduled, ${stats.finalGames} final, ${stats.criticalGames} critical`);
    console.log(`⚡ Individual polling: ${stats.individualPollingActive} games, Batch polling: ${stats.totalGames - stats.individualPollingActive} games`);
  }

  /**
   * Update user monitoring preferences
   */
  updateUserMonitoring(gameId: string, isMonitored: boolean): void {
    const state = this.gameStates.get(gameId);
    if (state && state.isUserMonitored !== isMonitored) {
      state.isUserMonitored = isMonitored;
      
      // Recalculate polling interval
      const newInterval = this.calculatePollInterval(state.currentState, state.criticality, isMonitored);
      state.pollInterval = newInterval;
      
      console.log(`👤 Game ${gameId} monitoring updated: ${isMonitored} (${newInterval}ms interval)`);
    }
  }

  /**
   * Get games ready for alert processing
   */
  getGamesReadyForProcessing(): string[] {
    const now = Date.now();
    return Array.from(this.gameStates.entries())
      .filter(([gameId, state]) => {
        // Always process live games
        if (state.currentState === 'live') return true;
        
        // Process critical games regardless of state
        if (state.criticality === 'critical') return true;
        
        // Process user-monitored games more frequently
        if (state.isUserMonitored && (now - state.lastPolled) >= state.pollInterval) return true;
        
        return false;
      })
      .map(([gameId]) => gameId);
  }

  /**
   * Clean up resources
   */
  shutdown(): void {
    console.log('🛑 Shutting down AdaptivePollingManager');
    
    // Clear all timers
    for (const timer of this.pollingTimers.values()) {
      clearTimeout(timer);
    }
    this.pollingTimers.clear();
    
    // Clear game states
    this.gameStates.clear();
    
    console.log('✅ AdaptivePollingManager shutdown complete');
  }
}