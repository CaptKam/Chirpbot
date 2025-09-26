/**
 * ChirpBot V3 Calendar Sync Service
 * Lightweight calendar data synchronization for weather-on-live architecture
 * 
 * Features:
 * - Minimal data fetching (game IDs, teams, start time, status only)
 * - Multi-sport support (MLB, NFL, NCAAF, NBA, WNBA, CFL)
 * - Smart polling with proximity-based intervals
 * - GameStateManager integration for state transitions
 * - In-memory storage with efficient caching
 * - WebSocket broadcasting for real-time updates
 * - Performance optimized for continuous operation
 */

import { RUNTIME } from '../config/runtime';
import type { GameStateManager, GameStateInfo, CalendarSyncService as ICalendarSyncService } from './game-state-manager';
import type { BaseGameData } from './base-sport-api';
import { MLBApiService } from './mlb-api';
import { NFLApiService } from './nfl-api';
import { NCAAFApiService } from './ncaaf-api';
import { WNBAApiService } from './wnba-api';
import { CFLApiService } from './cfl-api';
import { NBAApiService } from './nba-api';
// WebSocket import removed - using HTTP polling architecture

// === CORE INTERFACES ===

// Lightweight calendar game data (minimal fields only)
export interface CalendarGameData {
  gameId: string;
  sport: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
  };
  startTime: string;
  status: 'scheduled' | 'live' | 'final' | 'paused' | 'delayed';
  venue?: string;
  
  // Metadata for polling optimization
  lastUpdated: Date;
  nextPollTime: Date;
  pollInterval: number;
  isUserMonitored: boolean;
}

// Calendar sync configuration
export interface CalendarSyncConfig {
  sports: string[];
  defaultPollInterval: number;
  preStartWindowMinutes: number;
  preStartPollInterval: number;
  maxGamesPerSport: number;
  cacheTtlMs: number;
  cleanupIntervalMs: number;
  enableMetrics: boolean;
}

// Calendar update event for WebSocket broadcasting
export interface CalendarUpdateEvent {
  type: 'calendar_update';
  sport: string;
  gameId: string;
  previousStatus: string;
  newStatus: string;
  gameData: CalendarGameData;
  timestamp: string;
}

// Performance metrics for monitoring
export interface CalendarSyncMetrics {
  pollCount: number;
  gameCount: number;
  statusChanges: number;
  errorCount: number;
  averagePollTime: number;
  cacheHitRate: number;
  lastPollTime?: Date;
  uptimeMs: number;
}

// Sport-specific polling state
interface SportPollingState {
  sport: string;
  games: Map<string, CalendarGameData>;
  lastPoll: Date;
  nextPoll: Date;
  pollInterval: number;
  errorCount: number;
  backoffMultiplier: number;
  isPolling: boolean;
}

// === CALENDAR SYNC SERVICE IMPLEMENTATION ===

// Process-wide singleton symbol
const CALENDAR_SYNC_SINGLETON_KEY = Symbol.for('calendarSyncService');

export class CalendarSyncService implements ICalendarSyncService {
  private readonly config: CalendarSyncConfig;
  private readonly apiServices: Map<string, any> = new Map();
  private readonly sportStates: Map<string, SportPollingState> = new Map();
  private readonly metrics: CalendarSyncMetrics;
  
  private gameStateManager?: GameStateManager;
  // WebSocket server removed - using HTTP polling architecture
  private pollTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;
  private startTime = Date.now();

  private constructor(config: Partial<CalendarSyncConfig> = {}) {
    this.config = {
      sports: ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL'],
      defaultPollInterval: RUNTIME.calendarPoll.defaultMs,
      preStartWindowMinutes: RUNTIME.calendarPoll.preStartWindowMin,
      preStartPollInterval: RUNTIME.calendarPoll.preStartPollMs,
      maxGamesPerSport: 50,
      cacheTtlMs: 300_000, // 5 minutes
      cleanupIntervalMs: 600_000, // 10 minutes
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      pollCount: 0,
      gameCount: 0,
      statusChanges: 0,
      errorCount: 0,
      averagePollTime: 0,
      cacheHitRate: 0,
      uptimeMs: 0
    };

    this.initializeApiServices();
    this.initializeSportStates();
  }

  // Singleton factory method
  static getInstance(config?: Partial<CalendarSyncConfig>): CalendarSyncService {
    const globalSymbols = globalThis as any;
    
    if (!globalSymbols[CALENDAR_SYNC_SINGLETON_KEY]) {
      console.log('📅 Creating new CalendarSyncService singleton instance');
      globalSymbols[CALENDAR_SYNC_SINGLETON_KEY] = new CalendarSyncService(config);
    } else {
      console.log('📅 Using existing CalendarSyncService singleton instance');
    }
    
    return globalSymbols[CALENDAR_SYNC_SINGLETON_KEY];
  }

  // Static method to get existing instance
  static getExistingInstance(): CalendarSyncService | null {
    const globalSymbols = globalThis as any;
    return globalSymbols[CALENDAR_SYNC_SINGLETON_KEY] || null;
  }

  // === INITIALIZATION ===

  private initializeApiServices(): void {
    this.apiServices.set('MLB', new MLBApiService());
    this.apiServices.set('NFL', new NFLApiService());
    this.apiServices.set('NCAAF', new NCAAFApiService());
    this.apiServices.set('NBA', new NBAApiService());
    this.apiServices.set('WNBA', new WNBAApiService());
    this.apiServices.set('CFL', new CFLApiService());

    console.log(`📅 Calendar Sync: Initialized API services for ${this.config.sports.join(', ')}`);
  }

  private initializeSportStates(): void {
    for (const sport of this.config.sports) {
      this.sportStates.set(sport, {
        sport,
        games: new Map(),
        lastPoll: new Date(0),
        nextPoll: new Date(),
        pollInterval: this.config.defaultPollInterval,
        errorCount: 0,
        backoffMultiplier: 1,
        isPolling: false
      });
    }

    console.log(`📅 Calendar Sync: Initialized sport states for ${this.config.sports.join(', ')}`);
  }

  // === PUBLIC API ===

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Calendar Sync: Already running (idempotent start)');
      return;
    }

    console.log('📅 Calendar Sync: Starting lightweight calendar synchronization (singleton)...');
    this.isRunning = true;
    this.startTime = Date.now();

    // Start polling loop
    this.scheduleNextPoll();

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldGames();
    }, this.config.cleanupIntervalMs);

    console.log('📅 Calendar Sync: Service started successfully (singleton)');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('📅 Calendar Sync: Not running');
      return;
    }

    console.log('📅 Calendar Sync: Stopping service...');
    this.isRunning = false;

    // Clear timers
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('📅 Calendar Sync: Service stopped');
  }

  // Set external dependencies
  setGameStateManager(gameStateManager: GameStateManager): void {
    this.gameStateManager = gameStateManager;
    console.log('📅 Calendar Sync: GameStateManager integration enabled');
  }

  // WebSocket server setup removed - using HTTP polling architecture
  // No longer needed with HTTP polling architecture

  // Get calendar data for UI
  getCalendarData(sport?: string): CalendarGameData[] {
    const allGames: CalendarGameData[] = [];
    
    const sportsToFetch = sport ? [sport] : this.config.sports;
    
    for (const sportName of sportsToFetch) {
      const sportState = this.sportStates.get(sportName);
      if (sportState) {
        allGames.push(...Array.from(sportState.games.values()));
      }
    }

    // Sort by start time
    return allGames.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  // Get specific game data
  getGameData(gameId: string): CalendarGameData | null {
    for (const sportState of this.sportStates.values()) {
      const game = sportState.games.get(gameId);
      if (game) return game;
    }
    return null;
  }

  // Get performance metrics
  getMetrics(): CalendarSyncMetrics {
    const uptime = Date.now() - this.startTime;
    return {
      ...this.metrics,
      uptimeMs: uptime,
      lastPollTime: this.getLastPollTime()
    };
  }

  // Force refresh of specific sport
  async forceRefresh(sport: string): Promise<void> {
    const sportState = this.sportStates.get(sport);
    if (!sportState) {
      throw new Error(`Sport ${sport} not supported`);
    }

    if (sportState.isPolling) {
      console.log(`📅 Calendar Sync: ${sport} is already polling, skipping force refresh`);
      return;
    }

    console.log(`📅 Calendar Sync: Force refreshing ${sport} calendar data...`);
    await this.pollSport(sport);
  }

  // === IMPLEMENTATION OF CalendarSyncService INTERFACE ===

  async fetchGameData(gameId: string, sport: string): Promise<BaseGameData> {
    const apiService = this.apiServices.get(sport);
    if (!apiService) {
      throw new Error(`API service for sport ${sport} not found`);
    }

    // For calendar sync, we only fetch basic game data
    const games = await apiService.getTodaysGames();
    const game = games.find((g: BaseGameData) => g.id === gameId || g.gameId === gameId);
    
    if (!game) {
      console.warn(`⚠️ Game ${gameId} not found in current ${sport} API response - may be cancelled/postponed`);
      throw new Error(`Game ${gameId} not found for sport ${sport}`);
    }

    return game;
  }

  async fetchBatchGameData(gameIds: string[], sport: string): Promise<BaseGameData[]> {
    const apiService = this.apiServices.get(sport);
    if (!apiService) {
      throw new Error(`API service for sport ${sport} not found`);
    }

    // Fetch all games for the sport and filter by requested IDs
    const allGames = await apiService.getTodaysGames();
    return allGames.filter((game: BaseGameData) => 
      gameIds.includes(game.id) || gameIds.includes(game.gameId)
    );
  }

  // === PRIVATE IMPLEMENTATION ===

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    // Calculate next poll time based on earliest sport needs
    let nextPollMs = this.config.defaultPollInterval;
    
    for (const sportState of this.sportStates.values()) {
      const timeUntilNext = sportState.nextPoll.getTime() - Date.now();
      if (timeUntilNext < nextPollMs && timeUntilNext > 0) {
        nextPollMs = timeUntilNext;
      }
    }

    // Ensure minimum interval
    nextPollMs = Math.max(nextPollMs, 1000);

    this.pollTimer = setTimeout(async () => {
      await this.executePollCycle();
      this.scheduleNextPoll();
    }, nextPollMs);
  }

  private async executePollCycle(): Promise<void> {
    const startTime = Date.now();
    let pollCount = 0;

    try {
      // Poll sports that are due for updates
      const pollPromises: Promise<void>[] = [];
      
      for (const [sport, sportState] of this.sportStates.entries()) {
        if (Date.now() >= sportState.nextPoll.getTime() && !sportState.isPolling) {
          pollPromises.push(this.pollSport(sport));
          pollCount++;
        }
      }

      await Promise.all(pollPromises);

      // Update metrics
      const pollTime = Date.now() - startTime;
      this.updateMetrics(pollCount, pollTime, false);

    } catch (error) {
      console.error('📅 Calendar Sync: Error in poll cycle:', error);
      this.updateMetrics(pollCount, Date.now() - startTime, true);
    }
  }

  private async pollSport(sport: string): Promise<void> {
    const sportState = this.sportStates.get(sport);
    if (!sportState || sportState.isPolling) return;

    sportState.isPolling = true;

    try {
      const apiService = this.apiServices.get(sport);
      if (!apiService) {
        throw new Error(`API service for ${sport} not found`);
      }

      // Fetch today's games (lightweight - no enhanced data)
      const games = await apiService.getTodaysGames();
      
      // Process games and detect changes
      await this.processGamesUpdate(sport, games);

      // Update sport state for successful poll
      sportState.lastPoll = new Date();
      sportState.errorCount = 0;
      sportState.backoffMultiplier = 1;
      sportState.pollInterval = this.calculatePollInterval(sport);
      sportState.nextPoll = new Date(Date.now() + sportState.pollInterval);

      console.log(`📅 Calendar Sync: ${sport} poll completed - ${games.length} games, next poll in ${Math.round(sportState.pollInterval/1000)}s`);

    } catch (error) {
      console.error(`📅 Calendar Sync: Error polling ${sport}:`, error);
      
      // Apply exponential backoff
      sportState.errorCount++;
      sportState.backoffMultiplier = Math.min(sportState.backoffMultiplier * 2, 8);
      sportState.pollInterval = this.config.defaultPollInterval * sportState.backoffMultiplier;
      sportState.nextPoll = new Date(Date.now() + sportState.pollInterval);
      
    } finally {
      sportState.isPolling = false;
    }
  }

  private async processGamesUpdate(sport: string, games: BaseGameData[]): Promise<void> {
    const sportState = this.sportStates.get(sport);
    if (!sportState) return;

    let statusChanges = 0;

    for (const gameData of games.slice(0, this.config.maxGamesPerSport)) {
      const gameId = gameData.id || gameData.gameId;
      if (!gameId) continue;

      const existingGame = sportState.games.get(gameId);
      const newCalendarGame: CalendarGameData = {
        gameId,
        sport,
        homeTeam: {
          name: gameData.homeTeam.name,
          abbreviation: gameData.homeTeam.abbreviation,
          score: gameData.homeTeam.score || 0
        },
        awayTeam: {
          name: gameData.awayTeam.name,
          abbreviation: gameData.awayTeam.abbreviation,
          score: gameData.awayTeam.score || 0
        },
        startTime: gameData.startTime,
        status: this.mapToCalendarStatus(gameData.status),
        venue: gameData.venue,
        lastUpdated: new Date(),
        nextPollTime: new Date(Date.now() + this.calculateGamePollInterval(gameData)),
        pollInterval: this.calculateGamePollInterval(gameData),
        isUserMonitored: false // TODO: Check with user monitoring system
      };

      // Detect status changes
      if (existingGame && existingGame.status !== newCalendarGame.status) {
        statusChanges++;
        
        // Notify GameStateManager of status change
        if (this.gameStateManager) {
          // Convert CalendarGameData to GameStateInfo format
          const gameStateInfo: GameStateInfo = {
            gameId: newCalendarGame.gameId,
            sport: newCalendarGame.sport,
            homeTeam: newCalendarGame.homeTeam.name,
            awayTeam: newCalendarGame.awayTeam.name,
            homeScore: newCalendarGame.homeTeam.score,
            awayScore: newCalendarGame.awayTeam.score,
            startTime: newCalendarGame.startTime,
            venue: newCalendarGame.venue,
            timezone: this.getTimezoneForVenue(newCalendarGame.venue),
            
            // Convert calendar status to runtime state
            currentState: this.mapCalendarStatusToRuntimeState(newCalendarGame.status),
            previousState: this.mapCalendarStatusToRuntimeState(existingGame.status),
            stateChangedAt: new Date(),
            stateConfirmationCount: 1,
            
            // Polling metadata
            lastPolled: new Date(),
            nextPollTime: newCalendarGame.nextPollTime,
            currentPollInterval: newCalendarGame.pollInterval,
            
            // Live confirmation (not used for calendar sync)
            pendingLiveConfirmation: false,
            liveConfirmationAttempts: 0,
            
            // User monitoring
            isUserMonitored: newCalendarGame.isUserMonitored,
            userIds: new Set<string>(), // TODO: Get from user monitoring system
            
            // Weather arming (not used for calendar sync)
            weatherArmed: false,
            
            // Metadata
            createdAt: new Date(),
            lastUpdated: new Date(),
            
            // Raw game data
            rawGameData: gameData
          };
          
          try {
            // Add or update the game in GameStateManager
            console.log(`📅 Calendar Sync: Notifying GameStateManager of ${sport} game ${gameId} state transition: ${existingGame.status} → ${newCalendarGame.status}`);
            
            // Check if game exists in GameStateManager
            const existingGameState = this.gameStateManager.getGameState(gameId);
            if (existingGameState) {
              // Game exists - force evaluate to process the state change
              console.log(`🔄 Force evaluating GameStateManager for game ${gameId} (using cached data)`);
              await this.gameStateManager.forceEvaluate(gameId, gameData.sport, gameData);
            } else {
              // Add new game to GameStateManager for monitoring
              console.log(`➕ Adding game ${gameId} to GameStateManager`);
              await this.gameStateManager.addGame(gameData, []);
            }
          } catch (error) {
            console.error(`📅 Calendar Sync: Error notifying GameStateManager:`, error);
          }
        }

        // Broadcast update via WebSocket
        this.broadcastCalendarUpdate({
          type: 'calendar_update',
          sport,
          gameId,
          previousStatus: existingGame.status,
          newStatus: newCalendarGame.status,
          gameData: newCalendarGame,
          timestamp: new Date().toISOString()
        });

        console.log(`📅 Calendar Sync: ${sport} game ${gameId} status changed: ${existingGame.status} → ${newCalendarGame.status}`);
      }

      // Handle ALL live games (not just transitions) - architect recommended
      if (newCalendarGame.status === 'live' && this.gameStateManager) {
        try {
          const existingGameState = this.gameStateManager.getGameState(gameId);
          if (!existingGameState) {
            // Add live game that wasn't tracked before
            console.log(`📅 Calendar Sync: Adopting existing live game ${gameId}`);
            await this.gameStateManager.addGame(gameData, []);
            await this.gameStateManager.forceEvaluate(gameId, gameData.sport, gameData);
          } else {
            // Force evaluate existing live game to ensure engines are running
            await this.gameStateManager.forceEvaluate(gameId, gameData.sport, gameData);
          }
        } catch (error) {
          console.error(`📅 Calendar Sync: Error handling live game ${gameId}:`, error);
        }
      }

      // Update game in memory
      sportState.games.set(gameId, newCalendarGame);
    }

    this.metrics.statusChanges += statusChanges;
    this.metrics.gameCount = this.getTotalGameCount();
  }

  private mapToCalendarStatus(apiStatus: string): 'scheduled' | 'live' | 'final' | 'paused' | 'delayed' {
    const status = apiStatus.toLowerCase();
    
    if (status.includes('live') || status.includes('progress')) return 'live';
    if (status.includes('final') || status.includes('completed')) return 'final';
    if (status.includes('paused') || status.includes('suspended')) return 'paused';
    if (status.includes('delayed') || status.includes('postponed')) return 'delayed';
    
    return 'scheduled';
  }

  private calculatePollInterval(sport: string): number {
    const sportState = this.sportStates.get(sport);
    if (!sportState) return this.config.defaultPollInterval;

    // Count games by proximity to start with tiered cadence
    let liveCount = 0;
    let criticalWindowCount = 0;
    let preStartCount = 0;
    
    for (const game of sportState.games.values()) {
      if (game.status === 'live') {
        liveCount++;
      } else {
        const timeToStart = new Date(game.startTime).getTime() - Date.now();
        const minutesToStart = timeToStart / (1000 * 60);
        
        if (minutesToStart <= RUNTIME.calendarPoll.criticalWindowMin && minutesToStart > -5) {
          criticalWindowCount++;
        } else if (minutesToStart <= this.config.preStartWindowMinutes && minutesToStart > RUNTIME.calendarPoll.criticalWindowMin) {
          preStartCount++;
        }
      }
    }

    // Tiered polling cadence for guaranteed ≤5s detection
    if (liveCount > 0) {
      return Math.min(RUNTIME.calendarPoll.preStartPollMs, this.config.defaultPollInterval / 2);
    } else if (criticalWindowCount > 0) {
      // Critical window (T-2m to T+5m): 3-second polling for detection guarantee
      return RUNTIME.calendarPoll.criticalPollMs;
    } else if (preStartCount > 0) {
      // Normal pre-start window (T-10m to T-2m): 10-second polling
      return RUNTIME.calendarPoll.preStartPollMs;
    }

    return this.config.defaultPollInterval;
  }

  private calculateGamePollInterval(gameData: BaseGameData): number {
    if (gameData.isLive || gameData.status === 'live') {
      return RUNTIME.calendarPoll.preStartPollMs;
    }
    
    const startTime = new Date(gameData.startTime);
    const timeToStart = startTime.getTime() - Date.now();
    const minutesToStart = timeToStart / (1000 * 60);
    
    // Tiered cadence for guaranteed ≤5s detection
    if (minutesToStart <= RUNTIME.calendarPoll.criticalWindowMin && minutesToStart > -5) {
      // Critical window (T-2m to T+5m): 3-second polling for ≤5s detection guarantee
      return RUNTIME.calendarPoll.criticalPollMs;
    } else if (minutesToStart <= this.config.preStartWindowMinutes && minutesToStart > RUNTIME.calendarPoll.criticalWindowMin) {
      // Normal pre-start window (T-10m to T-2m): 10-second polling
      return this.config.preStartPollInterval;
    }
    
    return this.config.defaultPollInterval;
  }

  private isGameNearStart(game: CalendarGameData): boolean {
    const startTime = new Date(game.startTime);
    const timeToStart = startTime.getTime() - Date.now();
    const minutesToStart = timeToStart / (1000 * 60);
    
    return minutesToStart <= this.config.preStartWindowMinutes && minutesToStart > -5;
  }

  private isGameInCriticalWindow(game: CalendarGameData): boolean {
    const startTime = new Date(game.startTime);
    const timeToStart = startTime.getTime() - Date.now();
    const minutesToStart = timeToStart / (1000 * 60);
    
    return minutesToStart <= RUNTIME.calendarPoll.criticalWindowMin && minutesToStart > -5;
  }

  private broadcastCalendarUpdate(update: CalendarUpdateEvent): void {
    // WebSocket broadcasting removed - using HTTP polling architecture
    // This method is kept as no-op to maintain API compatibility
    return;
  }

  private cleanupOldGames(): void {
    const cutoffTime = Date.now() - this.config.cacheTtlMs;
    let removedCount = 0;

    for (const sportState of this.sportStates.values()) {
      for (const [gameId, game] of sportState.games.entries()) {
        // Remove games that are old and final
        if (game.status === 'final' && game.lastUpdated.getTime() < cutoffTime) {
          sportState.games.delete(gameId);
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      console.log(`📅 Calendar Sync: Cleaned up ${removedCount} old games`);
      this.metrics.gameCount = this.getTotalGameCount();
    }
  }

  private updateMetrics(pollCount: number, pollTimeMs: number, hadError: boolean): void {
    this.metrics.pollCount += pollCount;
    
    if (hadError) {
      this.metrics.errorCount++;
    }

    // Update average poll time
    if (pollTimeMs > 0) {
      const totalPollTime = (this.metrics.averagePollTime * (this.metrics.pollCount - pollCount)) + pollTimeMs;
      this.metrics.averagePollTime = totalPollTime / this.metrics.pollCount;
    }
  }

  private getTotalGameCount(): number {
    let total = 0;
    for (const sportState of this.sportStates.values()) {
      total += sportState.games.size;
    }
    return total;
  }

  private getLastPollTime(): Date | undefined {
    let lastPoll: Date | undefined;
    
    for (const sportState of this.sportStates.values()) {
      if (!lastPoll || sportState.lastPoll > lastPoll) {
        lastPoll = sportState.lastPoll;
      }
    }
    
    return lastPoll && lastPoll.getTime() > 0 ? lastPoll : undefined;
  }

  // === MISSING UTILITY METHODS ===

  private getTimezoneForVenue(venue?: string): string {
    if (!venue) return 'America/New_York';
    
    // Basic venue to timezone mapping
    const venueTimezones: Record<string, string> = {
      'Dodger Stadium': 'America/Los_Angeles',
      'Angel Stadium': 'America/Los_Angeles', 
      'Oracle Park': 'America/Los_Angeles',
      'Fenway Park': 'America/New_York',
      'Yankee Stadium': 'America/New_York',
      'Citi Field': 'America/New_York',
      'Wrigley Field': 'America/Chicago',
      'Minute Maid Park': 'America/Chicago',
      'Coors Field': 'America/Denver',
      'Chase Field': 'America/Phoenix'
    };

    return venueTimezones[venue] || 'America/New_York';
  }

  private mapCalendarStatusToRuntimeState(status: string): any {
    // Import the actual enum from runtime config
    const statusMap = {
      'scheduled': 'SCHEDULED',
      'live': 'LIVE', 
      'final': 'FINAL',
      'paused': 'PAUSED',
      'delayed': 'DELAYED'
    };
    
    return statusMap[status as keyof typeof statusMap] || 'SCHEDULED';
  }
}

// === SINGLETON INSTANCE ===

// Singleton instance managed by static getInstance() method

export function getCalendarSyncService(config?: Partial<CalendarSyncConfig>): CalendarSyncService {
  return CalendarSyncService.getInstance(config);
}

export function resetCalendarSyncService(): void {
  const instance = CalendarSyncService.getInstance();
  if (instance) {
    instance.stop();
    // Reset the global singleton
    const globalSymbols = globalThis as any;
    delete globalSymbols[Symbol.for('calendarSyncService')];
  }
}