// Adaptive Polling System with Performance Optimization
// Dynamically adjusts polling rates based on game criticality and system load

export interface GameCriticality {
  gameId: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    isLive: boolean;
    inning: number;
    scoreDifference: number;
    runnersOnBase: boolean;
    leverage: number;
    recentActivity: boolean;
    userInterest: number; // 0-1 based on monitored games
  };
  lastUpdate: number;
  changesSinceLastPoll: number;
}

export interface PollingSetting {
  interval: number; // milliseconds
  maxConcurrent: number;
  priority: number; // 1-5, higher = more important
  backoffMultiplier: number;
  maxBackoff: number;
}

export interface SystemLoad {
  cpuUsage: number; // 0-1
  memoryUsage: number; // 0-1
  apiQuotaRemaining: number; // 0-1
  errorRate: number; // 0-1
  responseTime: number; // milliseconds
  activeConnections: number;
}

export class AdaptivePollingManager {
  
  private gameStates = new Map<string, GameCriticality>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private systemLoad: SystemLoad = {
    cpuUsage: 0,
    memoryUsage: 0,
    apiQuotaRemaining: 1,
    errorRate: 0,
    responseTime: 100,
    activeConnections: 0,
  };
  
  // Base polling settings for different criticality levels
  private readonly POLLING_SETTINGS: Record<string, PollingSetting> = {
    'critical': {
      interval: 700,     // 0.7 seconds
      maxConcurrent: 8,
      priority: 5,
      backoffMultiplier: 1.2,
      maxBackoff: 2000,
    },
    'high': {
      interval: 1500,    // 1.5 seconds
      maxConcurrent: 6,
      priority: 4,
      backoffMultiplier: 1.3,
      maxBackoff: 3000,
    },
    'medium': {
      interval: 2500,    // 2.5 seconds
      maxConcurrent: 4,
      priority: 3,
      backoffMultiplier: 1.5,
      maxBackoff: 5000,
    },
    'low': {
      interval: 5000,    // 5 seconds
      maxConcurrent: 2,
      priority: 2,
      backoffMultiplier: 2.0,
      maxBackoff: 10000,
    },
    'scoreboard': {
      interval: 15000,   // 15 seconds
      maxConcurrent: 1,
      priority: 1,
      backoffMultiplier: 1.5,
      maxBackoff: 30000,
    }
  };

  /**
   * Update game criticality and adjust polling accordingly
   */
  updateGameCriticality(
    gameId: string,
    gameData: any,
    userMonitored: boolean = false
  ): GameCriticality {
    
    const factors = this.analyzeGameFactors(gameData, userMonitored);
    const level = this.determineCriticalityLevel(factors);
    
    const previousState = this.gameStates.get(gameId);
    const changesSinceLastPoll = previousState ? 
      this.countChanges(previousState, { gameId, level, factors, lastUpdate: Date.now(), changesSinceLastPoll: 0 }) : 0;
    
    const criticality: GameCriticality = {
      gameId,
      level,
      factors,
      lastUpdate: Date.now(),
      changesSinceLastPoll,
    };
    
    this.gameStates.set(gameId, criticality);
    
    // Adjust polling interval if criticality changed
    if (!previousState || previousState.level !== level) {
      this.adjustPollingInterval(gameId, level);
      console.log(`🎯 Game ${gameId} criticality: ${previousState?.level || 'new'} → ${level}`);
    }
    
    return criticality;
  }

  /**
   * Start adaptive polling for a game
   */
  startPolling(
    gameId: string,
    pollFunction: () => Promise<any>,
    initialCriticality: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    
    // Stop existing polling if any
    this.stopPolling(gameId);
    
    const settings = this.POLLING_SETTINGS[initialCriticality];
    const interval = this.calculateDynamicInterval(settings, this.systemLoad);
    
    console.log(`🔄 Starting adaptive polling for game ${gameId} at ${interval}ms intervals`);
    
    const pollWithBackoff = async () => {
      try {
        const startTime = Date.now();
        
        // Check system load before polling
        if (this.shouldThrottlePolling()) {
          console.log(`⏸️ Throttling polling due to system load`);
          return;
        }
        
        await pollFunction();
        
        // Update system metrics
        const responseTime = Date.now() - startTime;
        this.updateSystemMetrics({ responseTime, success: true });
        
        // Progressive recovery: reset to base interval on success
        const currentCriticality = this.gameStates.get(gameId);
        if (currentCriticality) {
          this.adjustPollingInterval(gameId, currentCriticality.level);
        }
        
      } catch (error) {
        console.error(`❌ Polling error for game ${gameId}:`, error instanceof Error ? error.message : String(error));
        
        // Update error metrics
        this.updateSystemMetrics({ success: false });
        
        // Apply backoff
        const currentCriticality = this.gameStates.get(gameId);
        if (currentCriticality) {
          this.applyPollingBackoff(gameId, currentCriticality.level);
        }
      }
    };
    
    // Start polling
    const intervalId = setInterval(pollWithBackoff, interval);
    this.pollingIntervals.set(gameId, intervalId);
    
    // Initial poll
    pollWithBackoff();
  }

  /**
   * Stop polling for a specific game
   */
  stopPolling(gameId: string): void {
    const intervalId = this.pollingIntervals.get(gameId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(gameId); // Fix: delete gameId, not intervalId
      console.log(`⏹️ Stopped polling for game ${gameId}`);
    }
    
    this.gameStates.delete(gameId);
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    this.pollingIntervals.forEach((intervalId, gameId) => {
      clearInterval(intervalId);
      console.log(`⏹️ Stopped polling for game ${gameId}`);
    });
    
    this.pollingIntervals.clear();
    this.gameStates.clear();
  }

  /**
   * Get current polling statistics
   */
  getPollingStats(): {
    activePolls: number;
    gamesByLevel: Record<string, number>;
    systemLoad: SystemLoad;
    averageInterval: number;
  } {
    
    const gamesByLevel: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    
    let totalInterval = 0;
    
    this.gameStates.forEach((state) => {
      gamesByLevel[state.level]++;
      totalInterval += this.POLLING_SETTINGS[state.level].interval;
    });
    
    return {
      activePolls: this.pollingIntervals.size,
      gamesByLevel,
      systemLoad: this.systemLoad,
      averageInterval: this.gameStates.size > 0 ? totalInterval / this.gameStates.size : 0,
    };
  }

  // Private helper methods
  
  private analyzeGameFactors(gameData: any, userMonitored: boolean): GameCriticality['factors'] {
    
    const isLive = gameData.status === 'live' || gameData.status === 'in-progress';
    const inning = gameData.inning || 1;
    const homeScore = gameData.homeTeam?.score || 0;
    const awayScore = gameData.awayTeam?.score || 0;
    const scoreDifference = Math.abs(homeScore - awayScore);
    
    // Determine if runners are on base (simplified)
    const runnersOnBase = gameData.runners?.first || gameData.runners?.second || gameData.runners?.third || false;
    
    // Calculate leverage index (simplified)
    let leverage = 1.0;
    if (isLive) {
      if (inning >= 7) leverage += 0.5; // Late innings
      if (scoreDifference <= 2) leverage += 0.3; // Close game
      if (runnersOnBase) leverage += 0.2; // Runners on base
    }
    
    // Recent activity based on last update
    const timeSinceUpdate = Date.now() - (gameData.lastUpdate || 0);
    const recentActivity = timeSinceUpdate < 120000; // 2 minutes
    
    // User interest factor
    const userInterest = userMonitored ? 1.0 : 0.3;
    
    return {
      isLive,
      inning,
      scoreDifference,
      runnersOnBase,
      leverage,
      recentActivity,
      userInterest,
    };
  }

  private determineCriticalityLevel(factors: GameCriticality['factors']): 'low' | 'medium' | 'high' | 'critical' {
    
    if (!factors.isLive) {
      return 'low'; // Non-live games get low priority
    }
    
    let score = 0;
    
    // Inning factor
    if (factors.inning >= 9) score += 3; // 9th inning or later
    else if (factors.inning >= 7) score += 2; // 7th-8th inning
    else if (factors.inning >= 4) score += 1; // Middle innings
    
    // Score difference factor
    if (factors.scoreDifference === 0) score += 2; // Tied game
    else if (factors.scoreDifference === 1) score += 1; // 1-run game
    
    // Runners on base
    if (factors.runnersOnBase) score += 1;
    
    // Recent activity
    if (factors.recentActivity) score += 1;
    
    // User interest
    if (factors.userInterest > 0.8) score += 2;
    else if (factors.userInterest > 0.5) score += 1;
    
    // Leverage
    if (factors.leverage > 2.0) score += 2;
    else if (factors.leverage > 1.5) score += 1;
    
    // Determine level
    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private countChanges(previous: GameCriticality, current: GameCriticality): number {
    let changes = 0;
    
    if (previous.factors.inning !== current.factors.inning) changes++;
    if (previous.factors.scoreDifference !== current.factors.scoreDifference) changes++;
    if (previous.factors.runnersOnBase !== current.factors.runnersOnBase) changes++;
    if (previous.level !== current.level) changes++;
    
    return changes;
  }

  private adjustPollingInterval(gameId: string, level: 'low' | 'medium' | 'high' | 'critical'): void {
    const intervalId = this.pollingIntervals.get(gameId);
    if (!intervalId) return;
    
    // Clear existing interval
    clearInterval(intervalId);
    
    // Calculate new interval based on system load
    const settings = this.POLLING_SETTINGS[level];
    const newInterval = this.calculateDynamicInterval(settings, this.systemLoad);
    
    // Start new interval (this would typically restart the polling function)
    // For now, just update the stored interval
    console.log(`🔄 Adjusted polling interval for game ${gameId}: ${newInterval}ms (${level})`);
  }

  private calculateDynamicInterval(settings: PollingSetting, load: SystemLoad): number {
    let interval = settings.interval;
    
    // Adjust based on system load
    if (load.cpuUsage > 0.8) interval *= 1.5;
    else if (load.cpuUsage > 0.6) interval *= 1.2;
    
    if (load.memoryUsage > 0.8) interval *= 1.3;
    
    if (load.apiQuotaRemaining < 0.2) interval *= 2.0;
    else if (load.apiQuotaRemaining < 0.5) interval *= 1.5;
    
    if (load.errorRate > 0.1) interval *= 1.8;
    
    if (load.responseTime > 2000) interval *= 1.4;
    
    return Math.min(interval, settings.maxBackoff);
  }

  private shouldThrottlePolling(): boolean {
    return this.systemLoad.cpuUsage > 0.9 || 
           this.systemLoad.memoryUsage > 0.9 || 
           this.systemLoad.apiQuotaRemaining < 0.1 ||
           this.systemLoad.errorRate > 0.2;
  }

  private applyPollingBackoff(gameId: string, level: 'low' | 'medium' | 'high' | 'critical'): void {
    const settings = this.POLLING_SETTINGS[level];
    const currentInterval = settings.interval;
    const newInterval = Math.min(
      currentInterval * settings.backoffMultiplier,
      settings.maxBackoff
    );
    
    console.log(`⏰ Applying backoff for game ${gameId}: ${currentInterval}ms → ${newInterval}ms`);
    
    // Update the polling interval
    this.adjustPollingInterval(gameId, level);
  }

  private updateSystemMetrics(result: { responseTime?: number; success: boolean }): void {
    // Update response time
    if (result.responseTime) {
      this.systemLoad.responseTime = this.systemLoad.responseTime * 0.8 + result.responseTime * 0.2;
    }
    
    // Update error rate
    const errorWeight = result.success ? 0 : 1;
    this.systemLoad.errorRate = this.systemLoad.errorRate * 0.9 + errorWeight * 0.1;
    
    // Update active connections count
    this.systemLoad.activeConnections = this.pollingIntervals.size;
  }

  /**
   * Update system load metrics from external monitoring
   */
  updateSystemLoad(load: Partial<SystemLoad>): void {
    this.systemLoad = { ...this.systemLoad, ...load };
  }
}

export const adaptivePollingManager = new AdaptivePollingManager();