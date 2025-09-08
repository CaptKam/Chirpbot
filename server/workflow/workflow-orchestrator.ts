import { EventEmitter } from 'events';
import { storage } from '../storage';
import { GameState, AlertResult } from '../services/engines/base-engine';
import { WebSocketServer } from 'ws';

// Core workflow interfaces
export interface WorkflowConfig {
  enabled: boolean;
  intervalMs: number;
  maxConcurrentJobs: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface SportConfig {
  name: string;
  enabled: boolean;
  apiService: any;
  engine: any;
  updateIntervalMs: number;
}

export interface WorkflowJob {
  id: string;
  sport: string;
  gameId: string;
  userId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}

export interface WorkflowMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  averageProcessingTime: number;
  alertsGenerated: number;
}

/**
 * Next-generation workflow orchestrator
 * Completely rewritten for better performance, maintainability, and scalability
 */
export class WorkflowOrchestrator extends EventEmitter {
  private config: WorkflowConfig;
  private sportConfigs: Map<string, SportConfig> = new Map();
  private activeJobs: Map<string, WorkflowJob> = new Map();
  private jobQueue: WorkflowJob[] = [];
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout;
  private metrics: WorkflowMetrics;
  private wss?: WebSocketServer;

  constructor(config: WorkflowConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      averageProcessingTime: 0,
      alertsGenerated: 0
    };

    console.log('🚀 New WorkflowOrchestrator initialized with config:', config);
  }

  /**
   * Register a sport with its configuration
   */
  registerSport(sportConfig: SportConfig): void {
    this.sportConfigs.set(sportConfig.name, sportConfig);
    console.log(`✅ Registered sport: ${sportConfig.name}`);
  }

  /**
   * Set WebSocket server for real-time updates
   */
  setWebSocketServer(wss: WebSocketServer): void {
    this.wss = wss;
    console.log('📡 WebSocket server configured for real-time alerts');
  }

  /**
   * Start the workflow orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Workflow orchestrator already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Starting workflow orchestrator...');

    // Start the main processing loop
    this.processingTimer = setInterval(() => {
      this.processJobQueue();
    }, this.config.intervalMs);

    // Start sport-specific monitoring
    for (const [sportName, sportConfig] of this.sportConfigs) {
      if (sportConfig.enabled) {
        this.startSportMonitoring(sportName);
      }
    }

    this.emit('started');
    console.log('✅ Workflow orchestrator started successfully');
  }

  /**
   * Stop the workflow orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping workflow orchestrator...');
    this.isRunning = false;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    // Wait for active jobs to complete or timeout
    const activeJobsArray = Array.from(this.activeJobs.values());
    if (activeJobsArray.length > 0) {
      console.log(`⏳ Waiting for ${activeJobsArray.length} active jobs to complete...`);
      
      const timeout = setTimeout(() => {
        console.log('⚠️ Timeout reached, forcing shutdown');
        this.activeJobs.clear();
      }, 10000); // 10 second timeout

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.activeJobs.size === 0) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });
    }

    this.emit('stopped');
    console.log('✅ Workflow orchestrator stopped');
  }

  /**
   * Add a job to the processing queue
   */
  enqueueJob(job: Omit<WorkflowJob, 'id' | 'status' | 'createdAt' | 'retryCount'>): string {
    const fullJob: WorkflowJob = {
      ...job,
      id: this.generateJobId(),
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0
    };

    this.jobQueue.push(fullJob);
    this.jobQueue.sort((a, b) => b.priority - a.priority); // Sort by priority (higher first)
    this.metrics.totalJobs++;

    console.log(`📋 Enqueued job ${fullJob.id} for ${fullJob.sport} game ${fullJob.gameId}`);
    return fullJob.id;
  }

  /**
   * Process the job queue
   */
  private async processJobQueue(): Promise<void> {
    if (!this.isRunning || this.activeJobs.size >= this.config.maxConcurrentJobs) {
      return;
    }

    const job = this.jobQueue.shift();
    if (!job) {
      return;
    }

    job.status = 'processing';
    job.startedAt = new Date();
    this.activeJobs.set(job.id, job);
    this.metrics.activeJobs = this.activeJobs.size;

    console.log(`🔄 Processing job ${job.id}: ${job.sport} game ${job.gameId} for user ${job.userId}`);

    try {
      await this.executeJob(job);
      this.completeJob(job);
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      await this.handleJobError(job, error as Error);
    }
  }

  /**
   * Execute a specific job
   */
  private async executeJob(job: WorkflowJob): Promise<void> {
    const sportConfig = this.sportConfigs.get(job.sport);
    if (!sportConfig) {
      throw new Error(`Sport ${job.sport} not configured`);
    }

    // Get live game data
    const gameData = await this.fetchGameData(job.sport, job.gameId);
    if (!gameData) {
      throw new Error(`No game data available for ${job.gameId}`);
    }

    // Initialize sport engine for the user
    await sportConfig.engine.initializeForUser(job.userId);

    // Generate alerts
    const alerts = await sportConfig.engine.generateLiveAlerts(gameData);
    
    if (alerts.length > 0) {
      await this.processAlerts(alerts, job);
      this.metrics.alertsGenerated += alerts.length;
      console.log(`📢 Generated ${alerts.length} alerts for job ${job.id}`);
    }
  }

  /**
   * Fetch game data for a specific sport and game
   */
  private async fetchGameData(sport: string, gameId: string): Promise<GameState | null> {
    const sportConfig = this.sportConfigs.get(sport);
    if (!sportConfig) {
      return null;
    }

    try {
      // Each API service should have a standardized method
      if (sportConfig.apiService && typeof sportConfig.apiService.getGameState === 'function') {
        return await sportConfig.apiService.getGameState(gameId);
      }

      // Fallback for existing API services
      if (sport === 'MLB' && sportConfig.apiService.getEnhancedGameData) {
        const data = await sportConfig.apiService.getEnhancedGameData(gameId);
        return this.convertToGameState(data, sport);
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching ${sport} game data for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Convert API response to standard GameState format
   */
  private convertToGameState(apiData: any, sport: string): GameState {
    return {
      gameId: apiData.gameId || apiData.gamePk,
      sport: sport,
      homeTeam: apiData.homeTeam || apiData.teams?.home?.team?.name || 'Unknown',
      awayTeam: apiData.awayTeam || apiData.teams?.away?.team?.name || 'Unknown', 
      homeScore: apiData.homeScore || apiData.teams?.home?.score || 0,
      awayScore: apiData.awayScore || apiData.teams?.away?.score || 0,
      status: apiData.status || 'Unknown',
      isLive: apiData.isLive || apiData.status === 'Live' || apiData.gameState === 'Live',
      // Add sport-specific fields
      inning: apiData.inning,
      outs: apiData.outs,
      hasFirst: apiData.runners?.first || false,
      hasSecond: apiData.runners?.second || false,
      hasThird: apiData.runners?.third || false,
      balls: apiData.balls,
      strikes: apiData.strikes,
      isTopInning: apiData.isTopInning
    };
  }

  /**
   * Process and broadcast alerts
   */
  private async processAlerts(alerts: AlertResult[], job: WorkflowJob): Promise<void> {
    for (const alert of alerts) {
      try {
        // Save alert to database
        await this.saveAlert(alert, job);

        // Broadcast via WebSocket
        if (this.wss) {
          this.broadcastAlert(alert, job);
        }

        // Emit event for other listeners
        this.emit('alertGenerated', { alert, job });

      } catch (error) {
        console.error(`❌ Error processing alert ${alert.alertKey}:`, error);
      }
    }
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: AlertResult, job: WorkflowJob): Promise<void> {
    try {
      await storage.insertAlert({
        type: alert.type,
        sport: job.sport,
        gameId: job.gameId,
        userId: job.userId,
        priority: alert.priority,
        message: alert.message,
        payload: JSON.stringify(alert.context),
        alertKey: alert.alertKey,
        state: 'NEW',
        createdAt: new Date()
      });
      
      console.log(`💾 Saved alert ${alert.alertKey} to database`);
    } catch (error) {
      console.error(`❌ Error saving alert ${alert.alertKey}:`, error);
    }
  }

  /**
   * Broadcast alert via WebSocket
   */
  private broadcastAlert(alert: AlertResult, job: WorkflowJob): void {
    if (!this.wss) return;

    const alertData = {
      type: 'alert',
      alert: {
        ...alert,
        sport: job.sport,
        gameId: job.gameId,
        userId: job.userId,
        timestamp: new Date().toISOString()
      }
    };

    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(alertData));
      }
    });

    console.log(`📡 Broadcasted alert ${alert.alertKey} via WebSocket`);
  }

  /**
   * Start monitoring for a specific sport
   */
  private startSportMonitoring(sportName: string): void {
    const sportConfig = this.sportConfigs.get(sportName);
    if (!sportConfig) return;

    console.log(`🎯 Starting monitoring for ${sportName} (interval: ${sportConfig.updateIntervalMs}ms)`);

    const monitoringInterval = setInterval(async () => {
      try {
        await this.scheduleSportJobs(sportName);
      } catch (error) {
        console.error(`❌ Error in ${sportName} monitoring:`, error);
      }
    }, sportConfig.updateIntervalMs);

    // Store interval reference for cleanup
    (sportConfig as any).monitoringInterval = monitoringInterval;
  }

  /**
   * Schedule jobs for a specific sport
   */
  private async scheduleSportJobs(sportName: string): Promise<void> {
    const sportConfig = this.sportConfigs.get(sportName);
    if (!sportConfig) return;

    // Get active users for this sport
    const users = await this.getActiveUsersForSport(sportName);
    if (users.length === 0) {
      return;
    }

    // Get live games for this sport
    const liveGames = await this.getLiveGamesForSport(sportName);
    if (liveGames.length === 0) {
      return;
    }

    console.log(`🎮 Found ${liveGames.length} live ${sportName} games for ${users.length} users`);

    // Create jobs for each user and game combination
    for (const user of users) {
      for (const game of liveGames) {
        const existingJob = this.findExistingJob(sportName, game.gameId, user.id);
        if (!existingJob) {
          this.enqueueJob({
            sport: sportName,
            gameId: game.gameId,
            userId: user.id,
            priority: this.calculateJobPriority(game)
          });
        }
      }
    }
  }

  /**
   * Get active users for a sport
   */
  private async getActiveUsersForSport(sport: string): Promise<Array<{ id: string }>> {
    try {
      const users = await storage.getUsersWithSportAlerts(sport);
      return users.map(u => ({ id: u.id }));
    } catch (error) {
      console.error(`❌ Error getting users for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Get live games for a sport
   */
  private async getLiveGamesForSport(sport: string): Promise<Array<{ gameId: string; priority?: number }>> {
    const sportConfig = this.sportConfigs.get(sport);
    if (!sportConfig || !sportConfig.apiService) {
      return [];
    }

    try {
      // Each API service should implement getLiveGames()
      if (typeof sportConfig.apiService.getLiveGames === 'function') {
        return await sportConfig.apiService.getLiveGames();
      }

      // Fallback for existing API services
      if (sport === 'MLB' && sportConfig.apiService.getLiveGames) {
        const games = await sportConfig.apiService.getLiveGames();
        return games.map((g: any) => ({ gameId: g.gameId || g.gamePk }));
      }

      return [];
    } catch (error) {
      console.error(`❌ Error getting live games for ${sport}:`, error);
      return [];
    }
  }

  /**
   * Find existing job in queue or active jobs
   */
  private findExistingJob(sport: string, gameId: string, userId: string): WorkflowJob | null {
    // Check active jobs
    for (const job of this.activeJobs.values()) {
      if (job.sport === sport && job.gameId === gameId && job.userId === userId) {
        return job;
      }
    }

    // Check queued jobs
    return this.jobQueue.find(job => 
      job.sport === sport && job.gameId === gameId && job.userId === userId
    ) || null;
  }

  /**
   * Calculate job priority based on game context
   */
  private calculateJobPriority(game: any): number {
    let priority = 50; // Base priority

    // Add priority based on game situation
    if (game.inning >= 7) priority += 20; // Late innings
    if (game.scoreDifference <= 3) priority += 15; // Close game
    if (game.hasRunners) priority += 10; // Runners on base

    return Math.min(priority, 100);
  }

  /**
   * Complete a job successfully
   */
  private completeJob(job: WorkflowJob): void {
    job.status = 'completed';
    job.completedAt = new Date();
    
    const processingTime = job.completedAt.getTime() - (job.startedAt?.getTime() || job.createdAt.getTime());
    
    // Update metrics
    this.metrics.completedJobs++;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.completedJobs - 1) + processingTime) / 
      this.metrics.completedJobs;

    this.activeJobs.delete(job.id);
    this.metrics.activeJobs = this.activeJobs.size;

    console.log(`✅ Job ${job.id} completed in ${processingTime}ms`);
    this.emit('jobCompleted', job);
  }

  /**
   * Handle job error and retry if needed
   */
  private async handleJobError(job: WorkflowJob, error: Error): Promise<void> {
    job.error = error.message;
    job.retryCount++;

    if (job.retryCount <= this.config.retryAttempts) {
      console.log(`🔄 Retrying job ${job.id} (attempt ${job.retryCount}/${this.config.retryAttempts})`);
      
      // Add back to queue with lower priority
      job.status = 'pending';
      job.priority = Math.max(job.priority - 10, 1);
      this.jobQueue.unshift(job); // Add to front for faster retry
      
      this.activeJobs.delete(job.id);
      this.metrics.activeJobs = this.activeJobs.size;
    } else {
      job.status = 'failed';
      job.completedAt = new Date();
      
      this.metrics.failedJobs++;
      this.activeJobs.delete(job.id);
      this.metrics.activeJobs = this.activeJobs.size;
      
      console.error(`❌ Job ${job.id} failed permanently after ${job.retryCount} attempts: ${error.message}`);
      this.emit('jobFailed', job);
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current workflow metrics
   */
  getMetrics(): WorkflowMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length,
      registeredSports: Array.from(this.sportConfigs.keys()),
      metrics: this.getMetrics()
    };
  }
}