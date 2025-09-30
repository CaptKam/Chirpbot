/**
 * ChirpBot V3 Game Lifecycle Service
 * Event-driven coordinator that owns game state and orchestrates data fetching and engine control
 * 
 * Architecture:
 * - Single source of truth for per-game state machine
 * - Delegates data fetching to CalendarDataSource
 * - Delegates engine control to EngineLifecycleManager (preserving mutex safety)
 * - Uses event-driven model for loose coupling
 * - Computes poll schedules based on game state
 */

import { RUNTIME, GameState, WeatherArmReason } from '../config/runtime';
import type { EngineLifecycleManager } from './engine-lifecycle-manager';
import type { BaseGameData } from './base-sport-api';

// === DOMAIN EVENTS ===

export interface CalendarUpdateEvent {
  type: 'calendar_update';
  gameId: string;
  sport: string;
  previousStatus: string | null;
  newStatus: string;
  gameData: BaseGameData;
  timestamp: Date;
}

export interface StateTransitionEvent {
  type: 'state_transition';
  gameId: string;
  sport: string;
  previousState: GameState;
  newState: GameState;
  timestamp: Date;
  engineAction?: 'start' | 'stop' | 'warmup' | 'pause' | 'terminate';
}

export interface EngineStateChangeEvent {
  type: 'engine_state_change';
  sport: string;
  engineState: string;
  gameId: string;
  timestamp: Date;
}

export interface WeatherArmedEvent {
  type: 'weather_armed';
  gameId: string;
  sport: string;
  reason: WeatherArmReason;
  timestamp: Date;
}

export type DomainEvent = CalendarUpdateEvent | StateTransitionEvent | EngineStateChangeEvent | WeatherArmedEvent;

// === CORE INTERFACES ===

export interface GameDescriptor {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  startTime: string;
  status: 'scheduled' | 'live' | 'final' | 'paused' | 'delayed';
  venue?: string;
  timezone?: string;
}

export interface GameStateInfo {
  // Core game data
  descriptor: GameDescriptor;
  
  // State machine
  currentState: GameState;
  previousState: GameState;
  stateChangedAt: Date;
  stateConfirmationCount: number;
  
  // Polling control
  lastPolled: Date;
  nextPollTime: Date;
  currentPollInterval: number;
  
  // Live confirmation logic
  pendingLiveConfirmation: boolean;
  liveConfirmationAttempts: number;
  liveConfirmationStartedAt?: Date;
  
  // User monitoring
  isUserMonitored: boolean;
  userIds: Set<string>;
  
  // Weather arming
  weatherArmed: boolean;
  weatherArmReason?: WeatherArmReason;
  weatherArmedAt?: Date;
  
  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  
  // Raw data cache
  rawGameData?: any;
}

export interface StateTransitionResult {
  success: boolean;
  previousState: GameState;
  newState: GameState;
  confirmationRequired: boolean;
  nextPollInterval: number;
  shouldStartEngines: boolean;
  shouldStopEngines: boolean;
  shouldWarmupEngines: boolean;
  shouldPauseEngines: boolean;
  shouldTerminateEngines: boolean;
  message: string;
}

// === DATA SOURCE INTERFACE ===

export interface ICalendarDataSource {
  fetchGameData(gameId: string, sport: string): Promise<BaseGameData>;
  fetchBatchGameData(gameIds: string[], sport: string): Promise<BaseGameData[]>;
  fetchTodayGames(sport: string): Promise<BaseGameData[]>;
}

// === EVENT BUS ===

type EventHandler<T = DomainEvent> = (event: T) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  subscribe<T extends DomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }
  
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    
    const promises = Array.from(handlers).map(handler => 
      Promise.resolve(handler(event)).catch(err => 
        console.error(`EventBus: Handler error for ${event.type}:`, err)
      )
    );
    
    await Promise.all(promises);
  }
}

// === GAME LIFECYCLE SERVICE ===

export class GameLifecycleService {
  private games = new Map<string, GameStateInfo>();
  private eventBus = new EventBus();
  private pollTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;
  
  // Per-game transition locks for concurrency safety
  private transitionLocks = new Map<string, Promise<any>>();
  
  // Service dependencies (injected)
  private dataSource?: ICalendarDataSource;
  private engineManager?: EngineLifecycleManager;
  private weatherService?: any; // WeatherService interface
  
  // Configuration
  private readonly config = {
    pollIntervalMs: RUNTIME.calendarPoll.defaultMs,
    preStartWindowMin: RUNTIME.calendarPoll.preStartWindowMin,
    preStartPollMs: RUNTIME.calendarPoll.preStartPollMs,
    livePollMs: RUNTIME.calendarPoll.criticalPollMs,
    confirmedLivePollMs: RUNTIME.calendarPoll.liveConfirmMs,
    liveConfirmationMaxAttempts: 5,
    liveConfirmationWindowMs: 120_000, // 2 minutes
    pausedPollMs: RUNTIME.calendarPoll.pausedPollMs,
    finalPollMs: RUNTIME.calendarPoll.finalConfirmMs,
    cleanupIntervalMs: 600_000, // 10 minutes
    staleGameThresholdMs: 86400_000, // 24 hours
  };
  
  constructor() {
    console.log('🎯 GameLifecycleService: Initializing coordinator');
  }
  
  // === DEPENDENCY INJECTION ===
  
  setDataSource(dataSource: ICalendarDataSource): void {
    this.dataSource = dataSource;
    console.log('📡 GameLifecycleService: Calendar data source connected');
  }
  
  setEngineManager(engineManager: EngineLifecycleManager): void {
    this.engineManager = engineManager;
    console.log('🔧 GameLifecycleService: Engine manager connected');
  }
  
  setWeatherService(weatherService: any): void {
    this.weatherService = weatherService;
    console.log('🌤️ GameLifecycleService: Weather service connected');
  }
  
  // === EVENT SUBSCRIPTION ===
  
  on<T extends DomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    return this.eventBus.subscribe(eventType, handler);
  }
  
  // === LIFECYCLE MANAGEMENT ===
  
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ GameLifecycleService: Already running');
      return;
    }
    
    if (!this.dataSource || !this.engineManager) {
      throw new Error('GameLifecycleService: Missing required dependencies (dataSource or engineManager)');
    }
    
    this.isRunning = true;
    
    // Start polling scheduler
    this.startPollingScheduler();
    
    // Start cleanup routine
    this.startCleanupRoutine();
    
    console.log('✅ GameLifecycleService: Started successfully');
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    console.log('🛑 GameLifecycleService: Stopped');
  }
  
  // === PER-GAME TRANSITION MUTEX ===
  
  private async acquireTransitionLock(gameId: string): Promise<() => void> {
    // Queue-based mutex: wait for tail of queue, then become the new tail
    const tail = this.transitionLocks.get(gameId) || Promise.resolve();
    let release: () => void;
    const next = tail.then(() => new Promise<void>(r => (release = r)));
    this.transitionLocks.set(gameId, next);
    await tail;
    
    // Return release function that resolves the promise for next waiter
    return () => {
      release!();
      // Clean up if this was the last in queue
      if (this.transitionLocks.get(gameId) === next) {
        this.transitionLocks.delete(gameId);
      }
    };
  }
  
  // === POLLING SCHEDULER ===
  
  private startPollingScheduler(): void {
    const scheduleNextPoll = () => {
      if (!this.isRunning) return;
      
      // Find next game to poll
      const now = Date.now();
      let nextPollTime = now + this.config.pollIntervalMs;
      let gameToPoll: GameStateInfo | null = null;
      
      for (const game of this.games.values()) {
        if (game.nextPollTime.getTime() <= now) {
          // Poll immediately
          this.pollGame(game.descriptor.gameId).catch(err =>
            console.error(`Poll error for ${game.descriptor.gameId}:`, err)
          );
        } else if (game.nextPollTime.getTime() < nextPollTime) {
          nextPollTime = game.nextPollTime.getTime();
          gameToPoll = game;
        }
      }
      
      // Schedule next poll
      const delay = Math.max(1000, nextPollTime - now); // At least 1 second
      this.pollTimer = setTimeout(scheduleNextPoll, delay);
    };
    
    scheduleNextPoll();
  }
  
  private startCleanupRoutine(): void {
    const runCleanup = () => {
      if (!this.isRunning) return;
      
      this.cleanupStaleGames();
      
      this.cleanupTimer = setTimeout(runCleanup, this.config.cleanupIntervalMs);
    };
    
    runCleanup();
  }
  
  // === GAME POLLING ===
  
  private async pollGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;
    
    try {
      // Fetch latest data
      const gameData = await this.dataSource!.fetchGameData(gameId, game.descriptor.sport);
      
      // Update game descriptor
      const previousStatus = game.descriptor.status;
      game.descriptor = {
        gameId: gameData.gameId,
        sport: gameData.sport,
        homeTeam: typeof gameData.homeTeam === 'string' ? gameData.homeTeam : gameData.homeTeam.name,
        awayTeam: typeof gameData.awayTeam === 'string' ? gameData.awayTeam : gameData.awayTeam.name,
        homeScore: gameData.homeScore,
        awayScore: gameData.awayScore,
        startTime: gameData.scheduledStartTime,
        status: this.mapApiStatusToDescriptorStatus(gameData.gameStatus),
        venue: gameData.venue,
        timezone: gameData.timezone,
      };
      
      game.lastPolled = new Date();
      game.lastUpdated = new Date();
      game.rawGameData = gameData;
      
      // Emit calendar update event
      await this.eventBus.publish({
        type: 'calendar_update',
        gameId,
        sport: game.descriptor.sport,
        previousStatus,
        newStatus: game.descriptor.status,
        gameData,
        timestamp: new Date(),
      });
      
      // Process state transition if needed
      await this.processGameUpdate(game);
      
    } catch (error) {
      console.error(`❌ Poll failed for ${gameId}:`, error);
    }
  }
  
  private mapApiStatusToDescriptorStatus(apiStatus: string): GameDescriptor['status'] {
    const status = apiStatus.toLowerCase();
    if (status.includes('live') || status.includes('in progress') || status.includes('active')) {
      return 'live';
    }
    if (status.includes('final') || status.includes('completed')) {
      return 'final';
    }
    if (status.includes('paused') || status.includes('halftime') || status.includes('intermission')) {
      return 'paused';
    }
    if (status.includes('delayed') || status.includes('postponed')) {
      return 'delayed';
    }
    return 'scheduled';
  }
  
  // === STATE MACHINE ===
  
  private async processGameUpdate(game: GameStateInfo): Promise<void> {
    const releaseLock = await this.acquireTransitionLock(game.descriptor.gameId);
    
    try {
      // Determine target state based on descriptor status
      let targetState = game.currentState;
      
      switch (game.descriptor.status) {
        case 'scheduled':
          targetState = this.shouldPrewarm(game) ? GameState.PREWARM : GameState.SCHEDULED;
          break;
        case 'live':
          targetState = GameState.LIVE;
          break;
        case 'paused':
          targetState = GameState.PAUSED;
          break;
        case 'final':
          targetState = GameState.FINAL;
          break;
        case 'delayed':
          // Stay in current state or revert to scheduled
          targetState = game.currentState === GameState.LIVE ? GameState.PAUSED : GameState.SCHEDULED;
          break;
      }
      
      // Transition if needed
      if (targetState !== game.currentState) {
        await this.transitionGame(game, targetState);
      } else {
        // Update poll interval based on current state
        this.updatePollSchedule(game);
      }
      
    } finally {
      releaseLock();
    }
  }
  
  private shouldPrewarm(game: GameStateInfo): boolean {
    const startTime = new Date(game.descriptor.startTime).getTime();
    const now = Date.now();
    const minutesUntilStart = (startTime - now) / 60000;
    
    return minutesUntilStart > 0 && minutesUntilStart <= this.config.preStartWindowMin;
  }
  
  private async transitionGame(game: GameStateInfo, targetState: GameState): Promise<void> {
    const previousState = game.currentState;
    
    // Validate transition
    if (!this.isValidTransition(previousState, targetState)) {
      console.warn(`⚠️ Invalid transition ${previousState} → ${targetState} for game ${game.descriptor.gameId}`);
      return;
    }
    
    console.log(`🔄 ${game.descriptor.sport} game ${game.descriptor.gameId}: ${previousState} → ${targetState}`);
    
    // Perform engine actions
    await this.executeEngineActions(game, previousState, targetState);
    
    // Update state
    game.previousState = previousState;
    game.currentState = targetState;
    game.stateChangedAt = new Date();
    game.stateConfirmationCount = 0;
    
    // Update poll schedule
    this.updatePollSchedule(game);
    
    // Emit state transition event
    await this.eventBus.publish({
      type: 'state_transition',
      gameId: game.descriptor.gameId,
      sport: game.descriptor.sport,
      previousState,
      newState: targetState,
      timestamp: new Date(),
    });
  }
  
  private isValidTransition(from: GameState, to: GameState): boolean {
    const validTransitions: Record<GameState, GameState[]> = {
      [GameState.SCHEDULED]: [GameState.PREWARM, GameState.LIVE, GameState.TERMINATED],
      [GameState.PREWARM]: [GameState.LIVE, GameState.SCHEDULED, GameState.TERMINATED],
      [GameState.LIVE]: [GameState.PAUSED, GameState.FINAL, GameState.TERMINATED],
      [GameState.PAUSED]: [GameState.LIVE, GameState.FINAL, GameState.TERMINATED],
      [GameState.FINAL]: [GameState.TERMINATED],
      [GameState.TERMINATED]: [],
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  private async executeEngineActions(game: GameStateInfo, previousState: GameState, newState: GameState): Promise<void> {
    if (!this.engineManager) return;
    
    const gameInfo = this.toEngineGameInfo(game);
    
    // Determine engine action based on transition
    if (previousState === GameState.SCHEDULED && newState === GameState.PREWARM) {
      await this.engineManager.warmupEngines(gameInfo);
    } else if (newState === GameState.LIVE && previousState !== GameState.PAUSED) {
      await this.engineManager.startEngines(gameInfo);
    } else if (newState === GameState.PAUSED && previousState === GameState.LIVE) {
      await this.engineManager.pauseEngines(gameInfo);
    } else if (newState === GameState.FINAL) {
      await this.engineManager.stopEngines(gameInfo);
    } else if (newState === GameState.TERMINATED) {
      await this.engineManager.terminateEngines(gameInfo);
    }
  }
  
  private toEngineGameInfo(game: GameStateInfo): any {
    return {
      gameId: game.descriptor.gameId,
      sport: game.descriptor.sport,
      homeTeam: game.descriptor.homeTeam,
      awayTeam: game.descriptor.awayTeam,
      homeScore: game.descriptor.homeScore,
      awayScore: game.descriptor.awayScore,
      startTime: game.descriptor.startTime,
      venue: game.descriptor.venue,
      timezone: game.descriptor.timezone,
      currentState: game.currentState,
      previousState: game.previousState,
      stateChangedAt: game.stateChangedAt,
      stateConfirmationCount: game.stateConfirmationCount,
      lastPolled: game.lastPolled,
      nextPollTime: game.nextPollTime,
      currentPollInterval: game.currentPollInterval,
      pendingLiveConfirmation: game.pendingLiveConfirmation,
      liveConfirmationAttempts: game.liveConfirmationAttempts,
      liveConfirmationStartedAt: game.liveConfirmationStartedAt,
      isUserMonitored: game.isUserMonitored,
      userIds: game.userIds,
      weatherArmed: game.weatherArmed,
      weatherArmReason: game.weatherArmReason,
      weatherArmedAt: game.weatherArmedAt,
      createdAt: game.createdAt,
      lastUpdated: game.lastUpdated,
      rawGameData: game.rawGameData,
    };
  }
  
  private updatePollSchedule(game: GameStateInfo): void {
    let pollInterval: number;
    
    switch (game.currentState) {
      case GameState.SCHEDULED:
        pollInterval = this.config.pollIntervalMs;
        break;
      case GameState.PREWARM:
        pollInterval = this.config.preStartPollMs;
        break;
      case GameState.LIVE:
        pollInterval = game.stateConfirmationCount > 0 
          ? this.config.confirmedLivePollMs 
          : this.config.livePollMs;
        break;
      case GameState.PAUSED:
        pollInterval = this.config.pausedPollMs;
        break;
      case GameState.FINAL:
        pollInterval = this.config.finalPollMs;
        break;
      case GameState.TERMINATED:
        pollInterval = Infinity; // No more polling
        break;
      default:
        pollInterval = this.config.pollIntervalMs;
    }
    
    game.currentPollInterval = pollInterval;
    game.nextPollTime = new Date(Date.now() + pollInterval);
  }
  
  // === PUBLIC API ===
  
  async registerGame(gameData: BaseGameData): Promise<void> {
    const gameId = gameData.gameId;
    
    if (this.games.has(gameId)) {
      console.log(`Game ${gameId} already registered, updating...`);
      // Update existing game
      const game = this.games.get(gameId)!;
      await this.pollGame(gameId);
      return;
    }
    
    const game: GameStateInfo = {
      descriptor: {
        gameId: gameData.gameId,
        sport: gameData.sport,
        homeTeam: typeof gameData.homeTeam === 'string' ? gameData.homeTeam : gameData.homeTeam.name,
        awayTeam: typeof gameData.awayTeam === 'string' ? gameData.awayTeam : gameData.awayTeam.name,
        homeScore: gameData.homeScore,
        awayScore: gameData.awayScore,
        startTime: gameData.scheduledStartTime,
        status: this.mapApiStatusToDescriptorStatus(gameData.gameStatus),
        venue: gameData.venue,
        timezone: gameData.timezone,
      },
      currentState: GameState.SCHEDULED,
      previousState: GameState.SCHEDULED,
      stateChangedAt: new Date(),
      stateConfirmationCount: 0,
      lastPolled: new Date(),
      nextPollTime: new Date(Date.now() + this.config.pollIntervalMs),
      currentPollInterval: this.config.pollIntervalMs,
      pendingLiveConfirmation: false,
      liveConfirmationAttempts: 0,
      isUserMonitored: false,
      userIds: new Set(),
      weatherArmed: false,
      createdAt: new Date(),
      lastUpdated: new Date(),
      rawGameData: gameData,
    };
    
    this.games.set(gameId, game);
    console.log(`✅ Registered game ${gameId} (${game.descriptor.sport})`);
  }
  
  async unregisterGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Terminate engines
    if (this.engineManager) {
      await this.engineManager.terminateEngines(this.toEngineGameInfo(game));
    }
    
    this.games.delete(gameId);
    console.log(`✅ Unregistered game ${gameId}`);
  }
  
  async seedFromTodayCalendars(sports: string[] = ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL']): Promise<void> {
    if (!this.dataSource) {
      console.error('❌ Cannot seed: data source not available');
      return;
    }
    
    console.log(`🌱 Seeding coordinator with today's games for: ${sports.join(', ')}`);
    let totalGamesSeeded = 0;
    
    for (const sport of sports) {
      try {
        const games = await this.dataSource.fetchTodayGames(sport);
        console.log(`📅 Found ${games.length} games for ${sport}`);
        
        for (const gameData of games) {
          await this.registerGame(gameData);
          totalGamesSeeded++;
        }
      } catch (error) {
        console.error(`❌ Failed to seed ${sport} games:`, error);
      }
    }
    
    console.log(`✅ Coordinator seeded with ${totalGamesSeeded} games`);
    console.log(`📊 Games by state: ${JSON.stringify(this.getMetrics().gamesByState)}`);
  }
  
  getGame(gameId: string): GameStateInfo | undefined {
    return this.games.get(gameId);
  }
  
  getAllGames(): GameStateInfo[] {
    return Array.from(this.games.values());
  }
  
  getGamesBySport(sport: string): GameStateInfo[] {
    return Array.from(this.games.values()).filter(g => 
      g.descriptor.sport.toUpperCase() === sport.toUpperCase()
    );
  }
  
  getGamesByState(state: GameState): GameStateInfo[] {
    return Array.from(this.games.values()).filter(g => g.currentState === state);
  }
  
  // === CLEANUP ===
  
  private cleanupStaleGames(): void {
    const now = Date.now();
    const staleThreshold = now - this.config.staleGameThresholdMs;
    
    for (const [gameId, game] of this.games.entries()) {
      if (game.currentState === GameState.TERMINATED && game.stateChangedAt.getTime() < staleThreshold) {
        this.games.delete(gameId);
        console.log(`🧹 Cleaned up terminated game ${gameId}`);
      }
    }
  }
  
  // === METRICS ===
  
  getMetrics() {
    return {
      totalGames: this.games.size,
      gamesByState: {
        scheduled: this.getGamesByState(GameState.SCHEDULED).length,
        prewarm: this.getGamesByState(GameState.PREWARM).length,
        live: this.getGamesByState(GameState.LIVE).length,
        paused: this.getGamesByState(GameState.PAUSED).length,
        final: this.getGamesByState(GameState.FINAL).length,
        terminated: this.getGamesByState(GameState.TERMINATED).length,
      },
      gamesBySport: Object.fromEntries(
        ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL'].map(sport => [
          sport,
          this.getGamesBySport(sport).length
        ])
      ),
    };
  }
}
