import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import { WorkflowOrchestrator, WorkflowConfig, SportConfig } from './workflow-orchestrator';
import { MultiSportEngineManager } from './engines/multi-sport-engine-manager';
import { AlertProcessor, AlertProcessorConfig } from './processors/alert-processor';
import { DeduplicationProcessor, DeduplicationConfig } from './processors/deduplication-processor';
import { AIEnhancementServiceV2, AIEnhancementConfig } from './services/ai-enhancement-service-v2';
import { NotificationService, NotificationConfig } from './services/notification-service';

/**
 * Central manager for the entire rewritten workflow system
 * Coordinates all components and provides unified interface
 */

export interface WorkflowManagerConfig {
  workflow: WorkflowConfig;
  alertProcessor: AlertProcessorConfig;
  deduplication: DeduplicationConfig;
  aiEnhancement: AIEnhancementConfig;
  notification: NotificationConfig;
}

export class WorkflowManager extends EventEmitter {
  private config: WorkflowManagerConfig;
  private orchestrator: WorkflowOrchestrator;
  private engineManager: MultiSportEngineManager;
  private alertProcessor: AlertProcessor;
  private deduplicationProcessor: DeduplicationProcessor;
  private aiService: AIEnhancementServiceV2;
  private notificationService: NotificationService;
  private isInitialized = false;
  private isRunning = false;

  constructor(config: WorkflowManagerConfig) {
    super();
    this.config = config;

    // Initialize all components
    this.orchestrator = new WorkflowOrchestrator(config.workflow);
    this.engineManager = new MultiSportEngineManager();
    this.alertProcessor = new AlertProcessor(config.alertProcessor);
    this.deduplicationProcessor = new DeduplicationProcessor(config.deduplication);
    this.aiService = new AIEnhancementServiceV2(config.aiEnhancement);
    this.notificationService = new NotificationService(config.notification);

    this.setupEventHandling();
  }

  /**
   * Initialize the workflow manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ WorkflowManager already initialized');
      return;
    }

    console.log('🚀 Initializing WorkflowManager...');

    try {
      // Initialize engine manager
      await this.engineManager.initialize();

      // Register sports with orchestrator
      await this.registerSports();

      // Setup cross-component integration
      this.setupIntegrations();

      this.isInitialized = true;
      this.emit('initialized');
      console.log('✅ WorkflowManager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize WorkflowManager:', error);
      throw error;
    }
  }

  /**
   * Start the entire workflow system
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('WorkflowManager must be initialized before starting');
    }

    if (this.isRunning) {
      console.log('⚠️ WorkflowManager already running');
      return;
    }

    console.log('🎯 Starting WorkflowManager...');

    try {
      // Start processors
      this.deduplicationProcessor.start();
      this.alertProcessor.start();

      // Start orchestrator
      await this.orchestrator.start();

      this.isRunning = true;
      this.emit('started');
      console.log('✅ WorkflowManager started successfully');

    } catch (error) {
      console.error('❌ Failed to start WorkflowManager:', error);
      throw error;
    }
  }

  /**
   * Stop the workflow system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping WorkflowManager...');

    try {
      // Stop orchestrator first
      await this.orchestrator.stop();

      // Stop processors
      this.alertProcessor.stop();
      this.deduplicationProcessor.stop();

      // Dispose engine manager
      await this.engineManager.dispose();

      this.isRunning = false;
      this.emit('stopped');
      console.log('✅ WorkflowManager stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping WorkflowManager:', error);
    }
  }

  /**
   * Set WebSocket server for real-time communication
   */
  setWebSocketServer(wss: WebSocketServer): void {
    this.orchestrator.setWebSocketServer(wss);
    this.notificationService.setWebSocketServer(wss);
    console.log('📡 WebSocket server configured for WorkflowManager');
  }

  /**
   * Register sports with the orchestrator
   */
  private async registerSports(): Promise<void> {
    const registeredSports = this.engineManager.getRegisteredSports();

    for (const sport of registeredSports) {
      const engine = this.engineManager.getEngine(sport);
      if (!engine) continue;

      // Create sport configuration
      const sportConfig: SportConfig = {
        name: sport,
        enabled: true,
        apiService: (engine as any).apiService || null, // Access private apiService
        engine: engine,
        updateIntervalMs: 15000 // 15 seconds
      };

      this.orchestrator.registerSport(sportConfig);
      console.log(`✅ Registered ${sport} with orchestrator`);
    }
  }

  /**
   * Setup integrations between components
   */
  private setupIntegrations(): void {
    // Connect alert processor to deduplication
    this.alertProcessor.on('alertQueued', async (alert) => {
      // The alert processor will handle deduplication internally
      console.log(`🔗 Alert queued for processing: ${alert.type}`);
    });

    // Connect orchestrator to alert processor
    this.orchestrator.on('alertGenerated', async ({ alert, job }) => {
      // Queue the alert for processing
      this.alertProcessor.queueAlert(alert, {
        sport: job.sport,
        gameId: job.gameId,
        userId: job.userId
      });
    });

    // Connect alert processor to notification service
    this.alertProcessor.on('webSocketDelivery', async (alertData) => {
      // Forward to notification service for WebSocket broadcast
      const payload = {
        id: alertData.alert.id,
        type: 'alert' as const,
        sport: alertData.alert.sport,
        gameId: alertData.alert.gameId,
        title: `${alertData.alert.sport} Alert`,
        message: alertData.alert.message,
        priority: alertData.alert.priority,
        data: alertData.alert,
        timestamp: new Date()
      };

      await this.notificationService.sendNotification(payload);
    });

    console.log('🔗 Component integrations configured');
  }

  /**
   * Setup event handling between components
   */
  private setupEventHandling(): void {
    // Forward important events from components
    this.orchestrator.on('jobCompleted', (job) => {
      this.emit('jobCompleted', job);
    });

    this.orchestrator.on('alertGenerated', (data) => {
      this.emit('alertGenerated', data);
    });

    this.engineManager.on('alertsGenerated', (data) => {
      this.emit('engineAlertsGenerated', data);
    });

    this.alertProcessor.on('alertProcessed', (alert) => {
      this.emit('alertProcessed', alert);
    });

    this.notificationService.on('notificationDelivered', (data) => {
      this.emit('notificationDelivered', data);
    });
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      orchestrator: this.orchestrator.getStatus(),
      engines: this.engineManager.getEnginesStatus(),
      alertProcessor: this.alertProcessor.getStatus(),
      deduplicationProcessor: this.deduplicationProcessor.getStatus(),
      aiService: this.aiService.getStatus(),
      notificationService: this.notificationService.getStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    return {
      orchestrator: this.orchestrator.getMetrics(),
      engines: this.engineManager.getMetrics(),
      alertProcessor: this.alertProcessor.getQueueStats(),
      deduplication: this.deduplicationProcessor.getStatistics()
    };
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<any> {
    return await this.notificationService.sendTestNotification();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WorkflowManagerConfig>): void {
    if (newConfig.workflow) {
      // Note: Orchestrator config updates would require restart
      console.log('⚠️ Workflow config updates require system restart');
    }

    if (newConfig.aiEnhancement) {
      this.aiService.updateConfig(newConfig.aiEnhancement);
    }

    if (newConfig.notification) {
      this.notificationService.updateConfig(newConfig.notification);
    }

    console.log('✅ WorkflowManager configuration updated');
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): WorkflowManagerConfig {
    return {
      workflow: {
        enabled: true,
        intervalMs: 5000, // 5 seconds
        maxConcurrentJobs: 10,
        retryAttempts: 3,
        timeoutMs: 30000 // 30 seconds
      },
      alertProcessor: {
        maxRetries: 3,
        retryDelayMs: 2000,
        batchSize: 5,
        processingIntervalMs: 1000 // 1 second
      },
      deduplication: {
        maxCacheSize: 10000,
        cleanupIntervalMs: 300000, // 5 minutes
        defaultCooldownMs: 30000, // 30 seconds
        enableContextualDeduplication: true
      },
      aiEnhancement: {
        enableOpenAI: false, // Disabled by default to save resources
        maxEnhancementsPerMinute: 10,
        priorityThreshold: 70,
        cacheSize: 500,
        timeoutMs: 5000
      },
      notification: {
        enableWebSocket: true,
        enableTelegram: false, // Disabled by default
        maxRetries: 2,
        retryDelayMs: 1000
      }
    };
  }
}