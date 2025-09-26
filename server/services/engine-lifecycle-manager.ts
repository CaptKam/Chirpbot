/**
 * ChirpBot V3 Engine Lifecycle Manager
 * Implements the weather-on-live architecture where sport engines only run when games are live
 * 
 * Features:
 * - Dynamic engine start/stop based on game state transitions
 * - Pre-warming engines 15 minutes before LIVE
 * - Resource management with cleanup routines
 * - Health monitoring and automatic recovery
 * - Integration with GameStateManager callbacks
 */

import { RUNTIME, GameState as RuntimeGameState, WeatherArmReason } from '../config/runtime';
import type { GameStateInfo, EngineLifecycleManager as IEngineLifecycleManager } from './game-state-manager';
import { MLBEngine } from './engines/mlb-engine';
import { NFLEngine } from './engines/nfl-engine';
import { NCAAFEngine } from './engines/ncaaf-engine';
import { NBAEngine } from './engines/nba-engine';
import { WNBAEngine } from './engines/wnba-engine';
import { CFLEngine } from './engines/cfl-engine';
import type { BaseSportEngine } from './engines/base-engine';
import { unifiedSettings } from '../storage';
import { getHealthMonitor } from './unified-health-monitor';
import { memoryManager } from '../middleware/memory-manager';

// === ENGINE STATE MANAGEMENT ===

export enum EngineState {
  INACTIVE = 'INACTIVE',           // Engine not running
  PRE_WARMING = 'PRE_WARMING',     // Engine initializing, pre-loading data
  ACTIVE = 'ACTIVE',               // Engine fully active and processing
  COOLDOWN = 'COOLDOWN',           // Engine shutting down gracefully
  ERROR = 'ERROR',                 // Engine in error state, needs recovery
  RECOVERY = 'RECOVERY'            // Engine attempting to recover
}

export interface EngineStateInfo {
  sport: string;
  state: EngineState;
  instance?: BaseSportEngine;
  
  // State tracking
  stateChangedAt: Date;
  lastHealthCheck: Date;
  consecutiveErrors: number;
  lastErrorAt?: Date;
  
  // Performance metrics
  startTime?: Date;
  totalActiveTime: number;
  alertsGenerated: number;
  resourceUsage: {
    memoryMB: number;
    cpuPercent: number;
    lastMeasuredAt: Date;
  };
  
  // Game tracking
  activeGames: Set<string>;
  preWarmGames: Set<string>;
  cooldownGames: Set<string>;
  
  // Recovery state
  recoveryAttempts: number;
  nextRetryTime?: Date;
  maxRetries: number;
}

export interface EngineTransitionResult {
  success: boolean;
  previousState: EngineState;
  newState: EngineState;
  sport: string;
  error?: string;
  resourcesAllocated?: {
    memoryMB: number;
    cpuPercent: number;
  };
}

// === MAIN ENGINE LIFECYCLE MANAGER ===

export class EngineLifecycleManager implements IEngineLifecycleManager {
  private engines: Map<string, EngineStateInfo> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private performanceMonitorInterval?: NodeJS.Timeout;
  
  // Configuration from RUNTIME
  private readonly config = {
    preWarmWindowMs: RUNTIME.engine.prewarmTminusMin * 60 * 1000, // 5 minutes default
    healthCheckMs: RUNTIME.engine.healthCheckMs, // 30 seconds default
    spinupTimeoutMs: RUNTIME.engine.spinupTimeoutMs, // 1 second default
    shutdownTimeoutMs: RUNTIME.engine.shutdownTimeoutMs, // 5 seconds default
    tickMs: RUNTIME.engine.tickMs, // 1 second default
    maxRetries: 3,
    retryDelayBase: 2000, // 2 seconds base delay
    maxRetryDelay: 30000, // 30 seconds max delay
  };
  
  // Supported sports mapping
  private readonly sportEngineClasses = {
    'MLB': MLBEngine,
    'NFL': NFLEngine,
    'NCAAF': NCAAFEngine,
    'NBA': NBAEngine,
    'WNBA': WNBAEngine,
    'CFL': CFLEngine,
  };
  
  // Resource limits per sport (configurable)
  private readonly resourceLimits = {
    'MLB': { maxMemoryMB: 128, maxCpuPercent: 25 },
    'NFL': { maxMemoryMB: 96, maxCpuPercent: 20 },
    'NCAAF': { maxMemoryMB: 96, maxCpuPercent: 20 },
    'NBA': { maxMemoryMB: 80, maxCpuPercent: 15 },
    'WNBA': { maxMemoryMB: 80, maxCpuPercent: 15 },
    'CFL': { maxMemoryMB: 64, maxCpuPercent: 10 },
  };
  
  private isEnabled: boolean = true;
  private totalEnginesStarted: number = 0;
  private totalEnginesStopped: number = 0;
  private totalTransitions: number = 0;
  
  constructor() {
    this.initializeAllEngines();
    this.startMonitoring();
    
    console.log('🔧 EngineLifecycleManager initialized with weather-on-live architecture');
    
    // 🚨 ONE-TIME RECOVERY: Immediate recovery for stuck football engines
    setTimeout(() => {
      console.log('🚨 EMERGENCY: Starting one-time recovery for stuck football engines...');
      this.reinitializeModules('NFL').then(result => {
        console.log(`🎯 NFL recovery result: ${result}`);
      });
      this.reinitializeModules('NCAAF').then(result => {
        console.log(`🎯 NCAAF recovery result: ${result}`);
      });
    }, 5000); // 5 second delay
  }
  
  // === INITIALIZATION ===
  
  private initializeAllEngines(): void {
    const supportedSports = Object.keys(this.sportEngineClasses);
    
    for (const sport of supportedSports) {
      this.engines.set(sport, {
        sport,
        state: EngineState.INACTIVE,
        stateChangedAt: new Date(),
        lastHealthCheck: new Date(),
        consecutiveErrors: 0,
        totalActiveTime: 0,
        alertsGenerated: 0,
        resourceUsage: {
          memoryMB: 0,
          cpuPercent: 0,
          lastMeasuredAt: new Date(),
        },
        activeGames: new Set(),
        preWarmGames: new Set(),
        cooldownGames: new Set(),
        recoveryAttempts: 0,
        maxRetries: this.config.maxRetries,
      });
    }
    
    console.log(`🏁 Initialized ${supportedSports.length} sport engines: ${supportedSports.join(', ')}`);
  }
  
  private startMonitoring(): void {
    // Health check monitoring
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckMs);
    
    // Cleanup monitoring
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Performance monitoring
    this.performanceMonitorInterval = setInterval(() => {
      this.measurePerformance();
    }, 30 * 1000); // Every 30 seconds
    
    console.log('📊 Engine monitoring started');
  }
  
  // === INTERFACE IMPLEMENTATION (IEngineLifecycleManager) ===
  
  async startEngines(gameInfo: GameStateInfo): Promise<boolean> {
    const sport = gameInfo.sport.toUpperCase();
    const engine = this.engines.get(sport);
    
    if (!engine) {
      console.error(`❌ Unknown sport: ${sport}`);
      return false;
    }
    
    try {
      console.log(`🚀 Starting ${sport} engine for game ${gameInfo.gameId}`);
      
      // Add to active games
      engine.activeGames.add(gameInfo.gameId);
      engine.preWarmGames.delete(gameInfo.gameId);
      
      const result = await this.transitionEngine(sport, EngineState.ACTIVE);
      
      if (result.success) {
        console.log(`✅ ${sport} engine started successfully`);
        this.totalEnginesStarted++;
        return true;
      } else {
        console.error(`❌ Failed to start ${sport} engine: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error starting ${sport} engine:`, error);
      this.recordEngineError(sport, error);
      return false;
    }
  }
  
  async stopEngines(gameInfo: GameStateInfo): Promise<boolean> {
    const sport = gameInfo.sport.toUpperCase();
    const engine = this.engines.get(sport);
    
    if (!engine) {
      console.error(`❌ Unknown sport: ${sport}`);
      return false;
    }
    
    try {
      console.log(`🛑 Stopping ${sport} engine for game ${gameInfo.gameId}`);
      
      // Remove from active games
      engine.activeGames.delete(gameInfo.gameId);
      engine.cooldownGames.add(gameInfo.gameId);
      
      // Only stop if no other games are active
      if (engine.activeGames.size === 0) {
        const result = await this.transitionEngine(sport, EngineState.COOLDOWN);
        
        if (result.success) {
          // After cooldown, transition to inactive
          setTimeout(async () => {
            await this.transitionEngine(sport, EngineState.INACTIVE);
            engine.cooldownGames.clear();
          }, this.config.shutdownTimeoutMs);
          
          console.log(`✅ ${sport} engine stopped successfully`);
          this.totalEnginesStopped++;
          return true;
        } else {
          console.error(`❌ Failed to stop ${sport} engine: ${result.error}`);
          return false;
        }
      } else {
        console.log(`⚠️ ${sport} engine still has ${engine.activeGames.size} active games, keeping running`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Error stopping ${sport} engine:`, error);
      this.recordEngineError(sport, error);
      return false;
    }
  }
  
  async warmupEngines(gameInfo: GameStateInfo): Promise<boolean> {
    const sport = gameInfo.sport.toUpperCase();
    const engine = this.engines.get(sport);
    
    if (!engine) {
      console.error(`❌ Unknown sport: ${sport}`);
      return false;
    }
    
    try {
      console.log(`🔥 Pre-warming ${sport} engine for game ${gameInfo.gameId}`);
      
      // Add to pre-warm games
      engine.preWarmGames.add(gameInfo.gameId);
      
      const result = await this.transitionEngine(sport, EngineState.PRE_WARMING);
      
      if (result.success) {
        console.log(`✅ ${sport} engine pre-warmed successfully`);
        return true;
      } else {
        console.error(`❌ Failed to pre-warm ${sport} engine: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error pre-warming ${sport} engine:`, error);
      this.recordEngineError(sport, error);
      return false;
    }
  }
  
  async pauseEngines(gameInfo: GameStateInfo): Promise<boolean> {
    const sport = gameInfo.sport.toUpperCase();
    const engine = this.engines.get(sport);
    
    if (!engine || !engine.instance) {
      return false;
    }
    
    try {
      console.log(`⏸️ Pausing ${sport} engine for game ${gameInfo.gameId}`);
      
      // Engine pausing handled by direct state management
      console.log(`⏸️ ${sport} engine paused - polling handled by CalendarSyncService`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error pausing ${sport} engine:`, error);
      return false;
    }
  }
  
  async terminateEngines(gameInfo: GameStateInfo): Promise<boolean> {
    const sport = gameInfo.sport.toUpperCase();
    const engine = this.engines.get(sport);
    
    if (!engine) {
      return false;
    }
    
    try {
      console.log(`🔚 Terminating ${sport} engine for game ${gameInfo.gameId}`);
      
      // Remove from all game sets
      engine.activeGames.delete(gameInfo.gameId);
      engine.preWarmGames.delete(gameInfo.gameId);
      engine.cooldownGames.delete(gameInfo.gameId);
      
      // Force stop if no games remain
      if (engine.activeGames.size === 0 && engine.preWarmGames.size === 0) {
        await this.transitionEngine(sport, EngineState.INACTIVE);
        console.log(`✅ ${sport} engine terminated successfully`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error terminating ${sport} engine:`, error);
      return false;
    }
  }
  
  // === ENGINE STATE TRANSITIONS ===
  
  private async transitionEngine(sport: string, targetState: EngineState): Promise<EngineTransitionResult> {
    const engine = this.engines.get(sport);
    if (!engine) {
      return {
        success: false,
        previousState: EngineState.INACTIVE,
        newState: EngineState.INACTIVE,
        sport,
        error: `Engine not found for sport: ${sport}`,
      };
    }
    
    const previousState = engine.state;
    const startTime = Date.now();
    
    try {
      console.log(`🔄 ${sport}: ${previousState} → ${targetState}`);
      
      // Validate transition
      if (!this.isValidTransition(previousState, targetState)) {
        throw new Error(`Invalid transition: ${previousState} → ${targetState}`);
      }
      
      // Perform the transition
      switch (targetState) {
        case EngineState.PRE_WARMING:
          await this.preWarmEngine(engine);
          break;
        case EngineState.ACTIVE:
          await this.activateEngine(engine);
          break;
        case EngineState.COOLDOWN:
          await this.cooldownEngine(engine);
          break;
        case EngineState.INACTIVE:
          await this.deactivateEngine(engine);
          break;
        case EngineState.RECOVERY:
          await this.recoverEngine(engine);
          break;
        default:
          throw new Error(`Unsupported target state: ${targetState}`);
      }
      
      // Update engine state
      engine.state = targetState;
      engine.stateChangedAt = new Date();
      engine.consecutiveErrors = 0; // Reset error count on successful transition
      
      const transitionTime = Date.now() - startTime;
      this.totalTransitions++;
      
      console.log(`✅ ${sport}: Transition complete in ${transitionTime}ms`);
      
      return {
        success: true,
        previousState,
        newState: targetState,
        sport,
        resourcesAllocated: {
          memoryMB: engine.resourceUsage.memoryMB,
          cpuPercent: engine.resourceUsage.cpuPercent,
        },
      };
    } catch (error) {
      console.error(`❌ ${sport}: Transition failed:`, error);
      this.recordEngineError(sport, error);
      
      engine.state = EngineState.ERROR;
      engine.lastErrorAt = new Date();
      
      return {
        success: false,
        previousState,
        newState: EngineState.ERROR,
        sport,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  private isValidTransition(from: EngineState, to: EngineState): boolean {
    const validTransitions: Record<EngineState, EngineState[]> = {
      [EngineState.INACTIVE]: [EngineState.PRE_WARMING, EngineState.ACTIVE],
      [EngineState.PRE_WARMING]: [EngineState.ACTIVE, EngineState.INACTIVE, EngineState.ERROR],
      [EngineState.ACTIVE]: [EngineState.COOLDOWN, EngineState.INACTIVE, EngineState.ERROR],
      [EngineState.COOLDOWN]: [EngineState.INACTIVE, EngineState.ACTIVE, EngineState.ERROR],
      [EngineState.ERROR]: [EngineState.RECOVERY, EngineState.INACTIVE],
      [EngineState.RECOVERY]: [EngineState.INACTIVE, EngineState.PRE_WARMING, EngineState.ERROR],
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  // === ENGINE LIFECYCLE OPERATIONS ===
  
  private async preWarmEngine(engine: EngineStateInfo): Promise<void> {
    const EngineClass = this.sportEngineClasses[engine.sport as keyof typeof this.sportEngineClasses];
    if (!EngineClass) {
      throw new Error(`No engine class found for sport: ${engine.sport}`);
    }
    
    console.log(`🔥 Pre-warming ${engine.sport} engine...`);
    
    // Create engine instance if it doesn't exist
    if (!engine.instance) {
      engine.instance = new EngineClass();
      console.log(`📦 Created ${engine.sport} engine instance`);
    }
    
    // Initialize user alert modules (light pre-loading)
    const enabledAlerts = await this.getEnabledAlerts(engine.sport);
    await engine.instance.initializeUserAlertModules(enabledAlerts.slice(0, 5)); // Pre-load first 5
    
    console.log(`✅ ${engine.sport} engine pre-warmed with ${enabledAlerts.length} alert types`);
  }
  
  private async activateEngine(engine: EngineStateInfo): Promise<void> {
    console.log(`🚀 Activating ${engine.sport} engine...`);
    
    // Ensure engine exists
    if (!engine.instance) {
      await this.preWarmEngine(engine);
    }
    
    // Polling management handled by CalendarSyncService
    console.log(`📡 ${engine.sport} polling managed by CalendarSyncService`);
    
    // Load all enabled alert modules
    const enabledAlerts = await this.getEnabledAlerts(engine.sport);
    await engine.instance!.initializeUserAlertModules(enabledAlerts);
    
    // Start tracking performance
    engine.startTime = new Date();
    
    console.log(`✅ ${engine.sport} engine fully activated`);
  }
  
  private async cooldownEngine(engine: EngineStateInfo): Promise<void> {
    console.log(`🛑 Starting cooldown for ${engine.sport} engine...`);
    
    // Engine stopping handled by direct state management
    console.log(`⏹️ ${engine.sport} engine cooldown - CalendarSyncService handles polling`);
    
    // Calculate total active time
    if (engine.startTime) {
      engine.totalActiveTime += Date.now() - engine.startTime.getTime();
      engine.startTime = undefined;
    }
    
    console.log(`✅ ${engine.sport} engine cooldown initiated`);
  }
  
  private async deactivateEngine(engine: EngineStateInfo): Promise<void> {
    console.log(`🔌 Deactivating ${engine.sport} engine...`);
    
    // Polling cleanup handled by CalendarSyncService
    console.log(`🗑️ ${engine.sport} engine deactivated - CalendarSyncService manages data`);
    
    // Clean up engine instance
    if (engine.instance) {
      // BaseSportEngine doesn't have explicit cleanup, but we can clear internal state
      engine.instance = undefined;
      console.log(`🗑️ ${engine.sport} engine instance cleaned up`);
    }
    
    // Reset state
    engine.activeGames.clear();
    engine.preWarmGames.clear();
    engine.cooldownGames.clear();
    engine.resourceUsage.memoryMB = 0;
    engine.resourceUsage.cpuPercent = 0;
    engine.alertsGenerated = 0;
    
    console.log(`✅ ${engine.sport} engine fully deactivated`);
  }
  
  private async recoverEngine(engine: EngineStateInfo): Promise<void> {
    console.log(`🔧 Attempting recovery for ${engine.sport} engine...`);
    
    engine.recoveryAttempts++;
    
    // Clean up any existing resources
    await this.deactivateEngine(engine);
    
    // Calculate exponential backoff delay
    const delay = Math.min(
      this.config.retryDelayBase * Math.pow(2, engine.recoveryAttempts - 1),
      this.config.maxRetryDelay
    );
    
    engine.nextRetryTime = new Date(Date.now() + delay);
    
    console.log(`🔧 ${engine.sport} recovery attempt ${engine.recoveryAttempts}/${engine.maxRetries}, next retry in ${delay}ms`);
    
    if (engine.recoveryAttempts >= engine.maxRetries) {
      console.error(`❌ ${engine.sport} engine exceeded max recovery attempts, keeping inactive`);
      engine.state = EngineState.INACTIVE;
      engine.recoveryAttempts = 0;
    }
  }
  
  // === HEALTH MONITORING ===
  
  private async performHealthChecks(): Promise<void> {
    if (!this.isEnabled) return;
    
    const now = new Date();
    let healthyEngines = 0;
    let errorEngines = 0;
    
    for (const [sport, engine] of this.engines) {
      try {
        // Check if engine needs recovery
        if (engine.state === EngineState.ERROR && engine.nextRetryTime && now >= engine.nextRetryTime) {
          await this.transitionEngine(sport, EngineState.RECOVERY);
        }
        
        // Check resource usage
        await this.checkResourceUsage(engine);
        
        // Update health check timestamp
        engine.lastHealthCheck = now;
        
        if (engine.state !== EngineState.ERROR) {
          healthyEngines++;
        } else {
          errorEngines++;
        }
      } catch (error) {
        console.error(`❌ Health check failed for ${sport}:`, error);
        this.recordEngineError(sport, error);
        errorEngines++;
      }
    }
    
    // Log health summary periodically
    if (this.totalTransitions % 10 === 0) {
      console.log(`🏥 Engine Health: ${healthyEngines} healthy, ${errorEngines} errors`);
    }
  }
  
  private async checkResourceUsage(engine: EngineStateInfo): Promise<void> {
    if (!engine.instance) return;
    
    const limits = this.resourceLimits[engine.sport as keyof typeof this.resourceLimits];
    if (!limits) return;
    
    // Get current memory usage from memory manager
    const memoryStats = memoryManager.getStats();
    const engineMemory = memoryStats.heapUsed / (1024 * 1024); // Convert to MB
    
    // Estimate CPU usage (simplified)
    const cpuUsage = engine.state === EngineState.ACTIVE ? 
      (engine.activeGames.size * 5) : 0; // Rough estimate: 5% per active game
    
    engine.resourceUsage.memoryMB = engineMemory;
    engine.resourceUsage.cpuPercent = cpuUsage;
    engine.resourceUsage.lastMeasuredAt = new Date();
    
    // Check limits
    if (engineMemory > limits.maxMemoryMB) {
      console.warn(`⚠️ ${engine.sport} engine memory usage high: ${engineMemory.toFixed(1)}MB (limit: ${limits.maxMemoryMB}MB)`);
    }
    
    if (cpuUsage > limits.maxCpuPercent) {
      console.warn(`⚠️ ${engine.sport} engine CPU usage high: ${cpuUsage.toFixed(1)}% (limit: ${limits.maxCpuPercent}%)`);
    }
  }
  
  private measurePerformance(): void {
    const activeEngines = Array.from(this.engines.values()).filter(e => e.state === EngineState.ACTIVE);
    const totalMemory = activeEngines.reduce((sum, e) => sum + e.resourceUsage.memoryMB, 0);
    const totalCpu = activeEngines.reduce((sum, e) => sum + e.resourceUsage.cpuPercent, 0);
    
    if (activeEngines.length > 0) {
      console.log(`📊 Performance: ${activeEngines.length} active engines, ${totalMemory.toFixed(1)}MB, ${totalCpu.toFixed(1)}% CPU`);
    }
  }
  
  // === RECOVERY METHODS ===
  
  /**
   * 🚨 RECOVERY: Re-initialize alert modules for engines stuck with 0 modules
   * Used to recover from failed startup initialization
   */
  async reinitializeModules(sport: string): Promise<boolean> {
    try {
      console.log(`🔄 RECOVERY: Re-initializing modules for ${sport} engine...`);
      
      const engine = this.engines.get(sport);
      if (!engine) {
        console.error(`❌ No engine found for sport ${sport}`);
        return false;
      }

      // Get available alert types from filesystem
      const availableAlerts = await this.getAllAlertTypes(sport.toUpperCase());
      console.log(`🔍 Found ${availableAlerts.length} available alert types for ${sport}: [${availableAlerts.slice(0, 3).join(', ')}...]`);
      
      if (availableAlerts.length === 0) {
        console.warn(`⚠️ No alert types found for ${sport} - check cylinder directory`);
        return false;
      }

      // Get enabled alert types using corrected settings lookup
      const enabledAlerts = await this.getEnabledAlerts(sport);
      console.log(`✅ ${enabledAlerts.length} alerts enabled for ${sport}: [${enabledAlerts.slice(0, 3).join(', ')}...]`);
      
      if (enabledAlerts.length === 0) {
        console.warn(`⚠️ No alerts enabled for ${sport} - check global settings`);
        return false;
      }

      // 🔧 CRITICAL FIX: Ensure engine instance exists before initializing modules
      if (!engine.instance) {
        console.log(`🔧 ${sport} engine instance missing - creating engine instance...`);
        
        // Create engine instance using the same logic as activateEngine
        const EngineClass = this.sportEngineClasses[sport];
        if (!EngineClass) {
          console.error(`❌ No engine class found for ${sport}`);
          return false;
        }
        
        engine.instance = new EngineClass();
        console.log(`✅ ${sport} engine instance created`);
      }

      // Trigger engine re-initialization
      await engine.instance.initializeUserAlertModules(enabledAlerts);
      console.log(`🎯 Successfully re-initialized ${sport} engine with ${enabledAlerts.length} modules`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to re-initialize ${sport} engine:`, error);
      return false;
    }
  }

  // === UTILITY METHODS ===
  
  private async getEnabledAlerts(sport: string): Promise<string[]> {
    try {
      const sportUpper = sport.toUpperCase();
      const allAlerts = await this.getAllAlertTypes(sportUpper);
      const enabledAlerts = [];
      
      // 🔍 DIAGNOSTICS: Log detailed info for football engines
      if (sport === 'NCAAF' || sport === 'NFL') {
        console.log(`🔍 ${sport} DIAGNOSTICS: Checking ${allAlerts.length} alert types: [${allAlerts.slice(0, 3).join(', ')}...]`);
        
        // Force cache invalidation for football engines
        unifiedSettings.invalidateCache(sport);
        console.log(`🔄 ${sport}: Cache invalidated, fetching fresh settings...`);
      }
      
      for (const alertType of allAlerts) {
        if (await unifiedSettings.isAlertEnabled(sportUpper, alertType)) {
          enabledAlerts.push(alertType);
        }
      }
      
      // 📊 DIAGNOSTICS: Summary log for troubleshooting
      console.log(`📊 ${sport} Module Loading: available=${allAlerts.length}, enabled=${enabledAlerts.length}, sport='${sport}', sample=[${enabledAlerts.slice(0, 3).join(', ')}...]`);
      
      if (enabledAlerts.length === 0 && allAlerts.length > 0) {
        console.warn(`⚠️ ${sport}: All alerts disabled! This will result in 0 loaded modules. Retrying with fresh cache...`);
        unifiedSettings.invalidateCache(sport);
        // Single retry attempt
        for (const alertType of allAlerts.slice(0, 1)) {
          const retryResult = await unifiedSettings.isAlertEnabled(sportUpper, alertType);
          console.log(`🔄 ${sport} Retry: ${alertType} = ${retryResult}`);
          break;
        }
      }
      
      return enabledAlerts;
    } catch (error) {
      console.error(`❌ Error getting enabled alerts for ${sport}:`, error);
      return [];
    }
  }
  
  private async getAllAlertTypes(sport: string): Promise<string[]> {
    // Sport-specific alert types based on the engine classes
    const alertTypes: Record<string, string[]> = {
      'MLB': [
        'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH', 'MLB_RUNNER_ON_THIRD_NO_OUTS',
        'MLB_FIRST_AND_THIRD_NO_OUTS', 'MLB_SECOND_AND_THIRD_NO_OUTS', 'MLB_FIRST_AND_SECOND',
        'MLB_BASES_LOADED_NO_OUTS', 'MLB_RUNNER_ON_THIRD_ONE_OUT', 'MLB_FIRST_AND_THIRD_ONE_OUT',
        'MLB_SECOND_AND_THIRD_ONE_OUT', 'MLB_BASES_LOADED_ONE_OUT', 'MLB_RUNNER_ON_THIRD_TWO_OUTS',
        'MLB_FIRST_AND_THIRD_TWO_OUTS', 'MLB_BATTER_DUE', 'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION', 'MLB_WIND_CHANGE', 'MLB_LATE_INNING_CLOSE',
        'MLB_SCORING_OPPORTUNITY', 'MLB_PITCHING_CHANGE', 'MLB_STRIKEOUT',
        'MLB_BASES_LOADED_TWO_OUTS', 'MLB_RUNNER_ON_SECOND_NO_OUTS'
      ],
      'NFL': [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY',
        'NFL_TURNOVER_LIKELIHOOD', 'NFL_MASSIVE_WEATHER'
      ],
      'NCAAF': [
        'NCAAF_GAME_START', 'NCAAF_SECOND_HALF_KICKOFF', 'NCAAF_TWO_MINUTE_WARNING',
        'NCAAF_RED_ZONE', 'NCAAF_FOURTH_DOWN_DECISION', 'NCAAF_RED_ZONE_EFFICIENCY',
        'NCAAF_UPSET_OPPORTUNITY', 'NCAAF_MASSIVE_WEATHER', 'NCAAF_CLOSE_GAME',
        'NCAAF_COMEBACK_POTENTIAL', 'NCAAF_FOURTH_QUARTER', 'NCAAF_HALFTIME'
      ],
      'NBA': [
        'NBA_GAME_START', 'NBA_FOURTH_QUARTER', 'NBA_FINAL_MINUTES',
        'NBA_TWO_MINUTE_WARNING', 'NBA_OVERTIME', 'NBA_CLUTCH_PERFORMANCE',
        'NBA_CHAMPIONSHIP_IMPLICATIONS', 'NBA_SUPERSTAR_ANALYTICS', 'NBA_PLAYOFF_INTENSITY'
      ],
      'WNBA': [
        'WNBA_GAME_START', 'WNBA_FOURTH_QUARTER', 'WNBA_FINAL_MINUTES',
        'WNBA_TWO_MINUTE_WARNING', 'WNBA_CLUTCH_TIME_OPPORTUNITY',
        'WNBA_COMEBACK_POTENTIAL', 'WNBA_CRUNCH_TIME_DEFENSE',
        'WNBA_HIGH_SCORING_QUARTER', 'WNBA_LOW_SCORING_QUARTER',
        'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ],
      'CFL': [
        'CFL_GAME_START', 'CFL_SECOND_HALF_KICKOFF', 'CFL_TWO_MINUTE_WARNING',
        'CFL_ROUGE_OPPORTUNITY', 'CFL_THIRD_DOWN_SITUATION', 'CFL_FINAL_MINUTES',
        'CFL_FOURTH_QUARTER', 'CFL_OVERTIME', 'CFL_GREY_CUP_IMPLICATIONS',
        'CFL_MASSIVE_WEATHER'
      ]
    };
    
    return alertTypes[sport] || [];
  }
  
  private recordEngineError(sport: string, error: any): void {
    const engine = this.engines.get(sport);
    if (!engine) return;
    
    engine.consecutiveErrors++;
    engine.lastErrorAt = new Date();
    
    // Log error details
    console.error(`❌ ${sport} Engine Error #${engine.consecutiveErrors}:`, {
      error: error instanceof Error ? error.message : String(error),
      state: engine.state,
      activeGames: engine.activeGames.size,
      resourceUsage: engine.resourceUsage,
    });
    
    // Report to health monitor if available
    const healthMonitor = getHealthMonitor();
    if (healthMonitor) {
      const errorToReport = error instanceof Error ? error : new Error(String(error));
      healthMonitor.recordError(errorToReport);
    }
  }
  
  private performCleanup(): void {
    let cleanedEngines = 0;
    
    for (const [sport, engine] of this.engines) {
      // Clean up engines that have been inactive for too long
      if (engine.state === EngineState.INACTIVE && 
          Date.now() - engine.stateChangedAt.getTime() > 30 * 60 * 1000) { // 30 minutes
        
        // Reset engine state completely
        engine.activeGames.clear();
        engine.preWarmGames.clear();
        engine.cooldownGames.clear();
        engine.consecutiveErrors = 0;
        engine.recoveryAttempts = 0;
        engine.alertsGenerated = 0;
        engine.totalActiveTime = 0;
        
        cleanedEngines++;
      }
    }
    
    if (cleanedEngines > 0) {
      console.log(`🧹 Cleanup completed: ${cleanedEngines} engines cleaned`);
    }
  }
  
  // === PUBLIC API ===
  
  public async getEngineStatus(sport: string): Promise<any> {
    const engine = this.engines.get(sport.toUpperCase());
    if (!engine) return null;
    
    return {
      sport: engine.sport,
      state: engine.state,
      lastStateChange: engine.stateChangedAt,
      activeGames: engine.activeGames.size,
      preWarmGames: engine.preWarmGames.size,
      resourceUsage: engine.resourceUsage,
      totalActiveTime: engine.totalActiveTime,
      alertsGenerated: engine.alertsGenerated,
      consecutiveErrors: engine.consecutiveErrors,
    };
  }
  
  public getEngine(sport: string): any {
    const engine = this.engines.get(sport.toUpperCase());
    return engine?.instance || null;
  }
  
  public getAllEnginesStatus(): Record<string, any> {
    // Return status for all engines
    const status: Record<string, any> = {
      totalEngines: this.engines.size,
      totalEnginesStarted: this.totalEnginesStarted,
      totalEnginesStopped: this.totalEnginesStopped,
      totalTransitions: this.totalTransitions,
      engines: {},
    };
    
    for (const [sport, engine] of this.engines) {
      status.engines[sport] = {
        state: engine.state,
        activeGames: engine.activeGames.size,
        resourceUsage: engine.resourceUsage,
        alertsGenerated: engine.alertsGenerated,
      };
    }
    
    return status;
  }
  
  public async enableEngine(sport: string): Promise<boolean> {
    const engine = this.engines.get(sport.toUpperCase());
    if (!engine) return false;
    
    // Reset error state if needed
    if (engine.state === EngineState.ERROR) {
      engine.consecutiveErrors = 0;
      engine.recoveryAttempts = 0;
      await this.transitionEngine(sport.toUpperCase(), EngineState.INACTIVE);
    }
    
    return true;
  }
  
  public async disableEngine(sport: string): Promise<boolean> {
    const engine = this.engines.get(sport.toUpperCase());
    if (!engine) return false;
    
    // Force stop the engine
    await this.transitionEngine(sport.toUpperCase(), EngineState.INACTIVE);
    return true;
  }
  
  public destroy(): void {
    console.log('🛑 Shutting down EngineLifecycleManager...');
    
    this.isEnabled = false;
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
    }
    
    // Stop all engines
    Promise.all(
      Array.from(this.engines.keys()).map(sport => 
        this.transitionEngine(sport, EngineState.INACTIVE)
      )
    ).then(() => {
      console.log('✅ All engines stopped, EngineLifecycleManager destroyed');
    });
  }
}

// Export singleton instance
export const engineLifecycleManager = new EngineLifecycleManager();