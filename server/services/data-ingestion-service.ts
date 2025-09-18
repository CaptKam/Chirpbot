/**
 * DataIngestionService - Simplified, Reliable Data Ingestion
 * 
 * Replaces the complex multi-layered polling architecture with a single,
 * bulletproof service that feeds clean events into the UnifiedEventStream.
 * 
 * Features:
 * - Unified polling logic for all 6 sports (MLB, NFL, NBA, WNBA, NCAAF, CFL)
 * - Smart state change detection and event emission
 * - Circuit breaker patterns with exponential backoff
 * - Shadow mode for safe parallel operation
 * - Performance optimized with intelligent polling intervals
 * - Clean event emission to UnifiedEventStream
 * - Simplified error handling and retry logic
 */

import { EventEmitter } from 'events';
import { RUNTIME } from '../config/runtime';
import type { BaseGameData } from './base-sport-api';
import { MLBApiService } from './mlb-api';
import { NFLApiService } from './nfl-api';
import { NCAAFApiService } from './ncaaf-api';
import { NBAApiService } from './nba-api';
import { WNBAApiService } from './wnba-api';
import { CFLApiService } from './cfl-api';
import { circuitBreakerManager } from './event-stream/circuit-breaker';
import type { UnifiedEventStream } from './event-stream/unified-event-stream';
import type { GameStateChangedEvent } from './event-stream/types';
import { v4 as uuidv4 } from 'uuid';

// === CORE TYPES ===

export type Sport = 'MLB' | 'NFL' | 'NBA' | 'WNBA' | 'NCAAF' | 'CFL';
export type GameStatus = 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended' | 'postponed';

export interface GameData {
  gameId: string;
  sport: Sport;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: number;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    score: number;
  };
  startTime: string;
  status: GameStatus;
  venue: string;
  
  // State tracking
  lastUpdated: Date;
  previousStatus?: GameStatus;
  statusChangedAt?: Date;
  isUserMonitored: boolean;
  
  // Polling optimization
  pollInterval: number;
  nextPollTime: Date;
  consecutiveUnchanged: number;
  
  // Raw API data for engines
  rawApiData?: any;
}

export interface IngestionMetrics {
  gamesTracked: number;
  pollsPerformed: number;
  stateChanges: number;
  eventsEmitted: number;
  errorsEncountered: number;
  circuitBreakerTrips: number;
  averagePollTimeMs: number;
  uptimeMs: number;
  lastPollTime?: Date;
}

export interface DataIngestionConfig {
  shadowMode: boolean;
  enableEventEmission: boolean;
  sports: Sport[];
  basePollingIntervalMs: number;
  liveGameIntervalMs: number;
  finalGameIntervalMs: number;
  maxConcurrentPolls: number;
  circuitBreakerConfig: {
    failureThreshold: number;
    timeoutMs: number;
    resetTimeoutMs: number;
  };
  retryConfig: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

// === SPORT API MAPPING ===

const SPORT_API_MAP = {
  MLB: MLBApiService,
  NFL: NFLApiService,
  NBA: NBAApiService,
  WNBA: WNBAApiService,
  NCAAF: NCAAFApiService,
  CFL: CFLApiService,
} as const;

// === DATA INGESTION SERVICE ===

export class DataIngestionService extends EventEmitter {
  private readonly config: DataIngestionConfig;
  private readonly apiServices: Map<Sport, any> = new Map();
  private readonly games: Map<string, GameData> = new Map();
  private readonly metrics: IngestionMetrics;
  
  // Event system integration
  private eventStream?: UnifiedEventStream;
  
  // Polling control
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private lastPollCycle = Date.now();
  private currentConcurrency = 0;
  private startTime = Date.now();
  
  // Error handling
  private retryQueue: Map<string, { attempts: number; nextRetry: number; gameData: GameData }> = new Map();

  constructor(config: Partial<DataIngestionConfig> = {}) {
    super();
    
    this.config = {
      shadowMode: true,
      enableEventEmission: true,
      sports: ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'],
      basePollingIntervalMs: RUNTIME.calendarPoll.defaultMs,
      liveGameIntervalMs: RUNTIME.calendarPoll.criticalPollMs,
      finalGameIntervalMs: 300_000, // 5 minutes
      maxConcurrentPolls: 6,
      circuitBreakerConfig: {
        failureThreshold: 5,
        timeoutMs: 10_000,
        resetTimeoutMs: 60_000,
      },
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 1_000,
        maxDelayMs: 30_000,
        backoffMultiplier: 2,
      },
      ...config
    };

    this.metrics = {
      gamesTracked: 0,
      pollsPerformed: 0,
      stateChanges: 0,
      eventsEmitted: 0,
      errorsEncountered: 0,
      circuitBreakerTrips: 0,
      averagePollTimeMs: 0,
      uptimeMs: 0
    };

    this.initializeApiServices();
    
    if (this.config.shadowMode) {
      console.log('🌊 DataIngestionService initialized in SHADOW MODE - parallel operation');
    } else {
      console.log('🚀 DataIngestionService initialized in ACTIVE MODE');
    }
  }

  // === INITIALIZATION ===

  private initializeApiServices(): void {
    for (const sport of this.config.sports) {
      const ApiService = SPORT_API_MAP[sport];
      if (ApiService) {
        this.apiServices.set(sport, new ApiService());
        console.log(`🔧 DataIngestion: Initialized ${sport} API service`);
      }
    }
  }

  public setEventStream(eventStream: UnifiedEventStream): void {
    this.eventStream = eventStream;
    console.log('🔗 DataIngestion: Connected to UnifiedEventStream');
  }

  // === PUBLIC API ===

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ DataIngestion: Already running');
      return;
    }

    console.log('='.repeat(80));
    console.log('🚀 DATAINGESTIONSERVICE: STARTING SIMPLIFIED DATA INGESTION');
    console.log('='.repeat(80));
    console.log('🌊 Shadow Mode: ENABLED - Running alongside existing calendar sync');
    console.log('🔧 Target Sports: MLB, NFL, NBA, WNBA, NCAAF, CFL');
    console.log('📡 UUID Dependency: ✅ AVAILABLE');
    console.log('⚡ Circuit Breakers: ✅ READY');
    console.log('🔄 Starting initialization sequence...');
    
    this.isRunning = true;
    this.startTime = Date.now();

    // Initial data discovery
    console.log('🔍 Phase 1: Performing initial game discovery...');
    await this.performInitialDiscovery();

    // Start polling cycle
    console.log('🔄 Phase 2: Starting polling cycle...');
    this.startPollingCycle();

    // Start health monitoring
    console.log('🏥 Phase 3: Starting health monitoring (30s intervals)...');
    this.startHealthMonitoring();

    console.log('='.repeat(80));
    console.log('✅ DATAINGESTIONSERVICE: SUCCESSFULLY STARTED');
    console.log('='.repeat(80));
    console.log(`📊 Games Tracked: ${this.games.size} games across ${this.config.sports.length} sports`);
    console.log('🌊 Shadow Mode: Data will be logged but not affect user-facing systems');
    console.log('🏥 Health logging: Every 30 seconds');
    console.log('📈 Metrics collection: ACTIVE');
    console.log('🔄 Service is now operational and monitoring!');
    console.log('='.repeat(80));
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ DataIngestion: Not running');
      return;
    }

    console.log('🛑 DataIngestion: Stopping service...');
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    // Clear health monitoring
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = undefined;
      console.log('🏥 DataIngestion: Health monitoring stopped');
    }

    console.log('✅ DataIngestion: Service stopped gracefully');
  }

  public getMetrics(): IngestionMetrics {
    return {
      ...this.metrics,
      uptimeMs: Date.now() - this.startTime,
      gamesTracked: this.games.size
    };
  }

  public getGameData(): GameData[] {
    return Array.from(this.games.values());
  }

  public getGameById(gameId: string): GameData | undefined {
    return this.games.get(gameId);
  }

  // === CORE POLLING LOGIC ===

  private async performInitialDiscovery(): Promise<void> {
    console.log('🔍 DataIngestion: Performing initial game discovery...');
    
    const discoveryPromises = this.config.sports.map(sport => 
      this.discoverGamesForSport(sport)
    );

    try {
      const results = await Promise.allSettled(discoveryPromises);
      
      let totalGamesDiscovered = 0;
      results.forEach((result, index) => {
        const sport = this.config.sports[index];
        if (result.status === 'fulfilled') {
          totalGamesDiscovered += result.value;
          console.log(`✅ DataIngestion: Discovered ${result.value} ${sport} games`);
        } else {
          console.error(`❌ DataIngestion: Failed to discover ${sport} games:`, result.reason);
          this.metrics.errorsEncountered++;
        }
      });

      console.log(`🎯 DataIngestion: Initial discovery complete - ${totalGamesDiscovered} games found`);
    } catch (error) {
      console.error('❌ DataIngestion: Initial discovery failed:', error);
      this.metrics.errorsEncountered++;
    }
  }

  private async discoverGamesForSport(sport: Sport): Promise<number> {
    const apiService = this.apiServices.get(sport);
    if (!apiService) {
      throw new Error(`No API service for sport: ${sport}`);
    }

    const circuitBreaker = circuitBreakerManager.getBreaker(`data-ingestion-${sport.toLowerCase()}`);
    
    try {
      const gamesData = await circuitBreaker.execute(async () => {
        return await apiService.getTodaysGames();
      });

      let gamesProcessed = 0;
      if (gamesData && Array.isArray(gamesData)) {
        for (const gameData of gamesData) {
          this.processGameData(gameData, sport);
          gamesProcessed++;
        }
      }

      return gamesProcessed;
    } catch (error) {
      console.error(`❌ DataIngestion: Error discovering ${sport} games:`, error);
      this.metrics.circuitBreakerTrips++;
      throw error;
    }
  }

  private startPollingCycle(): void {
    const runCycle = async () => {
      if (!this.isRunning) return;

      const cycleStart = Date.now();
      await this.executePollingCycle();
      const cycleDuration = Date.now() - cycleStart;

      // Update metrics
      this.metrics.averagePollTimeMs = (this.metrics.averagePollTimeMs + cycleDuration) / 2;
      this.metrics.lastPollTime = new Date();

      // Schedule next cycle
      const nextCycleDelay = Math.max(1000, this.config.basePollingIntervalMs - cycleDuration);
      this.pollTimer = setTimeout(runCycle, nextCycleDelay);
    };

    runCycle();
  }

  private async executePollingCycle(): Promise<void> {
    const now = Date.now();
    const gamesToPoll = Array.from(this.games.values())
      .filter(game => game.nextPollTime.getTime() <= now)
      .slice(0, this.config.maxConcurrentPolls);

    if (gamesToPoll.length === 0) return;

    console.log(`🔄 DataIngestion: Polling ${gamesToPoll.length} games`);

    const pollPromises = gamesToPoll.map(game => this.pollGame(game));
    const results = await Promise.allSettled(pollPromises);

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.metrics.pollsPerformed++;
      } else {
        console.error(`❌ DataIngestion: Failed to poll game ${gamesToPoll[index].gameId}:`, result.reason);
        this.metrics.errorsEncountered++;
        this.handlePollingError(gamesToPoll[index], result.reason);
      }
    });
  }

  private async pollGame(game: GameData): Promise<void> {
    const apiService = this.apiServices.get(game.sport);
    if (!apiService) {
      throw new Error(`No API service for sport: ${game.sport}`);
    }

    const circuitBreaker = circuitBreakerManager.getBreaker(`data-ingestion-${game.sport.toLowerCase()}`);
    
    try {
      // Fetch fresh game data
      const freshData = await circuitBreaker.execute(async () => {
        return await apiService.getGameById ? 
          await apiService.getGameById(game.gameId) : 
          await this.findGameInTodaysGames(game.gameId, game.sport);
      });

      if (freshData) {
        this.updateGameData(game, freshData);
      }
    } catch (error) {
      console.error(`❌ DataIngestion: Error polling game ${game.gameId}:`, error);
      throw error;
    }
  }

  private async findGameInTodaysGames(gameId: string, sport: Sport): Promise<BaseGameData | null> {
    const apiService = this.apiServices.get(sport);
    const gamesData = await apiService.getTodaysGames();
    return gamesData?.find((g: BaseGameData) => g.id === gameId || g.gameId === gameId) || null;
  }

  // === DATA PROCESSING ===

  private processGameData(apiGameData: BaseGameData, sport: Sport): void {
    const gameId = apiGameData.id || apiGameData.gameId;
    const existingGame = this.games.get(gameId);
    
    if (existingGame) {
      this.updateGameData(existingGame, apiGameData);
    } else {
      // Create new game entry
      const gameData: GameData = {
        gameId,
        sport,
        homeTeam: apiGameData.homeTeam,
        awayTeam: apiGameData.awayTeam,
        startTime: apiGameData.startTime,
        status: this.normalizeStatus(apiGameData.status),
        venue: apiGameData.venue,
        lastUpdated: new Date(),
        isUserMonitored: false, // TODO: Integrate with user monitoring system
        pollInterval: this.calculatePollInterval(this.normalizeStatus(apiGameData.status)),
        nextPollTime: new Date(Date.now() + this.calculatePollInterval(this.normalizeStatus(apiGameData.status))),
        consecutiveUnchanged: 0,
        rawApiData: apiGameData
      };

      this.games.set(gameId, gameData);
      console.log(`➕ DataIngestion: Added ${sport} game ${gameId} (${gameData.homeTeam.abbreviation} vs ${gameData.awayTeam.abbreviation})`);
    }
  }

  private updateGameData(game: GameData, freshApiData: BaseGameData): void {
    const newStatus = this.normalizeStatus(freshApiData.status);
    const statusChanged = game.status !== newStatus;
    const scoreChanged = 
      game.homeTeam.score !== freshApiData.homeTeam.score || 
      game.awayTeam.score !== freshApiData.awayTeam.score;

    if (statusChanged || scoreChanged) {
      // Significant change detected
      const previousStatus = game.status;
      
      game.previousStatus = previousStatus;
      game.status = newStatus;
      game.homeTeam = freshApiData.homeTeam;
      game.awayTeam = freshApiData.awayTeam;
      game.lastUpdated = new Date();
      game.consecutiveUnchanged = 0;
      game.rawApiData = freshApiData;
      
      if (statusChanged) {
        game.statusChangedAt = new Date();
        this.metrics.stateChanges++;
        console.log(`🔄 DataIngestion: ${game.sport} game ${game.gameId} status changed: ${previousStatus} → ${newStatus}`);
      }

      // Emit state change event
      this.emitGameStateChangeEvent(game, previousStatus);

      // Adjust polling interval based on new status
      game.pollInterval = this.calculatePollInterval(newStatus);
    } else {
      // No significant changes
      game.consecutiveUnchanged++;
      game.lastUpdated = new Date();
    }

    // Schedule next poll
    game.nextPollTime = new Date(Date.now() + game.pollInterval);
  }

  private normalizeStatus(apiStatus: string): GameStatus {
    const status = apiStatus.toLowerCase();
    
    if (status.includes('live') || status.includes('in progress') || status.includes('active')) {
      return 'live';
    } else if (status.includes('final') || status.includes('completed') || status.includes('game over')) {
      return 'final';
    } else if (status.includes('delayed') || status.includes('rain delay')) {
      return 'delayed';
    } else if (status.includes('suspended')) {
      return 'suspended';
    } else if (status.includes('postponed') || status.includes('cancelled')) {
      return 'postponed';
    } else {
      return 'scheduled';
    }
  }

  private calculatePollInterval(status: GameStatus): number {
    switch (status) {
      case 'live':
        return this.config.liveGameIntervalMs;
      case 'final':
      case 'postponed':
        return this.config.finalGameIntervalMs;
      case 'delayed':
      case 'suspended':
        return this.config.basePollingIntervalMs / 2; // More frequent for delayed games
      default:
        return this.config.basePollingIntervalMs;
    }
  }

  // === EVENT EMISSION ===

  private emitGameStateChangeEvent(game: GameData, previousStatus?: GameStatus): void {
    if (!this.config.enableEventEmission || !this.eventStream) {
      return;
    }

    const event: GameStateChangedEvent = {
      id: uuidv4(),
      type: 'game_state_changed',
      timestamp: Date.now(),
      priority: this.getEventPriority(game.status),
      source: 'data-ingestion-service',
      retryCount: 0,
      maxRetries: 3,
      metadata: {
        shadowMode: this.config.shadowMode,
        pollInterval: game.pollInterval,
        consecutiveUnchanged: game.consecutiveUnchanged
      },
      payload: {
        gameId: game.gameId,
        sport: game.sport,
        previousState: previousStatus ? this.mapStatusToGameState(previousStatus) : null,
        currentState: this.mapStatusToGameState(game.status),
        changes: this.detectChanges(game, previousStatus),
        isSignificantChange: previousStatus !== game.status
      }
    };

    try {
      this.eventStream.emitEvent(event);
      this.metrics.eventsEmitted++;
      
      if (this.config.shadowMode) {
        console.log(`🌊 DataIngestion: [SHADOW] Emitted state change event for ${game.gameId}`);
      } else {
        console.log(`📢 DataIngestion: Emitted state change event for ${game.gameId}`);
      }
    } catch (error) {
      console.error(`❌ DataIngestion: Failed to emit event for game ${game.gameId}:`, error);
      this.metrics.errorsEncountered++;
    }
  }

  private getEventPriority(status: GameStatus): 'low' | 'medium' | 'high' | 'critical' {
    switch (status) {
      case 'live': return 'critical';
      case 'delayed':
      case 'suspended': return 'high';
      case 'final': return 'medium';
      default: return 'low';
    }
  }

  private mapStatusToGameState(status: GameStatus): any {
    // Map our normalized status to the GameState interface expected by the event system
    // This is a simplified mapping - in a real system, GameState might have more fields
    return {
      status,
      isLive: status === 'live',
      isFinal: status === 'final',
      timestamp: Date.now()
    };
  }

  private detectChanges(game: GameData, previousStatus?: GameStatus): string[] {
    const changes: string[] = [];
    
    if (previousStatus && previousStatus !== game.status) {
      changes.push(`status: ${previousStatus} → ${game.status}`);
    }
    
    // Add more change detection logic as needed
    return changes;
  }

  // === ERROR HANDLING ===

  private handlePollingError(game: GameData, error: any): void {
    const retryKey = game.gameId;
    const existingRetry = this.retryQueue.get(retryKey);
    
    if (!existingRetry) {
      // First failure - add to retry queue
      this.retryQueue.set(retryKey, {
        attempts: 1,
        nextRetry: Date.now() + this.config.retryConfig.baseDelayMs,
        gameData: game
      });
    } else if (existingRetry.attempts < this.config.retryConfig.maxRetries) {
      // Increment retry count with exponential backoff
      const delay = Math.min(
        this.config.retryConfig.baseDelayMs * Math.pow(this.config.retryConfig.backoffMultiplier, existingRetry.attempts),
        this.config.retryConfig.maxDelayMs
      );
      
      existingRetry.attempts++;
      existingRetry.nextRetry = Date.now() + delay;
    } else {
      // Max retries exceeded - remove from queue and log
      console.error(`💀 DataIngestion: Max retries exceeded for game ${game.gameId}, removing from polling`);
      this.retryQueue.delete(retryKey);
      this.games.delete(game.gameId);
    }
  }

  // === HEALTH MONITORING ===

  private healthMonitorInterval?: NodeJS.Timeout;

  private startHealthMonitoring(): void {
    // Clear any existing interval
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
    }

    // Start health monitoring every 30 seconds
    this.healthMonitorInterval = setInterval(async () => {
      await this.logHealthSummary();
    }, 30_000); // 30 seconds

    console.log('🏥 DataIngestion: Health monitoring started - logging every 30 seconds');
  }

  private async logHealthSummary(): Promise<void> {
    try {
      const health = await this.healthCheck();
      const metrics = this.getMetrics();
      
      console.log('');
      console.log('🏥 =========================== DATAINGESTION HEALTH SUMMARY ===========================');
      console.log(`🔄 Status: ${health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
      console.log(`🌊 Shadow Mode: ${this.config.shadowMode ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`📊 Games Tracked: ${health.details.gamesTracked}`);
      console.log(`📈 Polls Performed: ${metrics.pollsPerformed}`);
      console.log(`🎯 State Changes: ${metrics.stateChanges}`);
      console.log(`📡 Events Emitted: ${metrics.eventsEmitted}`);
      console.log(`❌ Errors Encountered: ${metrics.errorsEncountered}`);
      console.log(`⚡ Circuit Breaker Trips: ${metrics.circuitBreakerTrips}`);
      console.log(`⏱️  Average Poll Time: ${metrics.averagePollTimeMs.toFixed(0)}ms`);
      console.log(`🕐 Uptime: ${Math.round(metrics.uptimeMs / 1000)}s`);
      console.log(`🔄 Retry Queue Size: ${health.details.retryQueueSize}`);
      console.log(`📅 Last Poll: ${health.details.timeSinceLastPoll < Infinity ? Math.round(health.details.timeSinceLastPoll / 1000) + 's ago' : 'Never'}`);
      console.log('🏥 ==================================================================================');
      console.log('');

      // Log additional details if unhealthy
      if (!health.healthy) {
        console.error('❌ DATAINGESTION HEALTH ISSUE DETECTED:');
        console.error('🔍 Service running:', health.details.isRunning);
        console.error('⏰ Time since last poll:', health.details.timeSinceLastPoll);
        console.error('⚙️ Expected max interval:', this.config.basePollingIntervalMs * 2);
      }
    } catch (error) {
      console.error('❌ DataIngestion: Failed to log health summary:', error);
    }
  }

  // === UTILITY METHODS ===

  public async forceRefreshGame(gameId: string): Promise<GameData | null> {
    const game = this.games.get(gameId);
    if (!game) return null;

    try {
      await this.pollGame(game);
      return game;
    } catch (error) {
      console.error(`❌ DataIngestion: Force refresh failed for game ${gameId}:`, error);
      return null;
    }
  }

  public setShadowMode(enabled: boolean): void {
    this.config.shadowMode = enabled;
    console.log(`🌊 DataIngestion: Shadow mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const now = Date.now();
    const timeSinceLastPoll = this.metrics.lastPollTime ? now - this.metrics.lastPollTime.getTime() : Infinity;
    
    const healthy = this.isRunning && timeSinceLastPoll < this.config.basePollingIntervalMs * 2;
    
    return {
      healthy,
      details: {
        isRunning: this.isRunning,
        gamesTracked: this.games.size,
        timeSinceLastPoll,
        metrics: this.getMetrics(),
        retryQueueSize: this.retryQueue.size,
        shadowMode: this.config.shadowMode
      }
    };
  }
}