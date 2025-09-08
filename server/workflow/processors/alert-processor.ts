import { EventEmitter } from 'events';
import { AlertResult } from '../../services/engines/base-engine';
import { storage } from '../../storage';

/**
 * Alert processor handles the complete lifecycle of alerts
 * from generation to delivery with proper error handling
 */

export interface ProcessedAlert {
  id: string;
  alertKey: string;
  type: string;
  sport: string;
  gameId: string;
  userId: string;
  message: string;
  context: any;
  priority: number;
  status: 'new' | 'processing' | 'delivered' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  deliveredAt?: Date;
  error?: string;
  retryCount: number;
}

export interface AlertProcessorConfig {
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  processingIntervalMs: number;
}

export class AlertProcessor extends EventEmitter {
  private config: AlertProcessorConfig;
  private processingQueue: ProcessedAlert[] = [];
  private isProcessing = false;
  private processingTimer?: NodeJS.Timeout;

  constructor(config: AlertProcessorConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the alert processor
   */
  start(): void {
    if (this.isProcessing) {
      console.log('⚠️ Alert processor already running');
      return;
    }

    this.isProcessing = true;
    console.log('🚀 Starting alert processor...');

    // Start processing timer
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);

    console.log('✅ Alert processor started');
  }

  /**
   * Stop the alert processor
   */
  stop(): void {
    if (!this.isProcessing) {
      return;
    }

    console.log('🛑 Stopping alert processor...');
    this.isProcessing = false;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    console.log('✅ Alert processor stopped');
  }

  /**
   * Queue an alert for processing
   */
  queueAlert(alert: AlertResult, gameContext: any): string {
    const processedAlert: ProcessedAlert = {
      id: this.generateAlertId(),
      alertKey: alert.alertKey,
      type: alert.type,
      sport: gameContext.sport,
      gameId: gameContext.gameId,
      userId: gameContext.userId,
      message: alert.message,
      context: alert.context,
      priority: alert.priority || 50,
      status: 'new',
      createdAt: new Date(),
      retryCount: 0
    };

    this.processingQueue.push(processedAlert);
    this.sortQueueByPriority();

    console.log(`📋 Queued alert ${processedAlert.id}: ${processedAlert.type}`);
    this.emit('alertQueued', processedAlert);

    return processedAlert.id;
  }

  /**
   * Process the alert queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    const batch = this.processingQueue.splice(0, this.config.batchSize);
    console.log(`🔄 Processing batch of ${batch.length} alerts`);

    const processPromises = batch.map(alert => this.processAlert(alert));
    await Promise.allSettled(processPromises);
  }

  /**
   * Process a single alert
   */
  private async processAlert(alert: ProcessedAlert): Promise<void> {
    alert.status = 'processing';
    alert.processedAt = new Date();

    try {
      console.log(`🔄 Processing alert ${alert.id}: ${alert.type}`);

      // Step 1: Save to database
      await this.saveAlertToDatabase(alert);

      // Step 2: Apply deduplication
      const shouldDeliver = await this.checkDeduplication(alert);
      if (!shouldDeliver) {
        console.log(`🚫 Alert ${alert.id} filtered by deduplication`);
        alert.status = 'delivered'; // Mark as delivered but filtered
        this.emit('alertFiltered', alert);
        return;
      }

      // Step 3: Enhance with AI if needed
      await this.enhanceWithAI(alert);

      // Step 4: Deliver alert
      await this.deliverAlert(alert);

      alert.status = 'delivered';
      alert.deliveredAt = new Date();

      console.log(`✅ Alert ${alert.id} processed successfully`);
      this.emit('alertProcessed', alert);

    } catch (error) {
      console.error(`❌ Error processing alert ${alert.id}:`, error);
      await this.handleAlertError(alert, error as Error);
    }
  }

  /**
   * Save alert to database
   */
  private async saveAlertToDatabase(alert: ProcessedAlert): Promise<void> {
    try {
      // Check if insertAlert method exists, create fallback if not
      if (typeof (storage as any).insertAlert === 'function') {
        await (storage as any).insertAlert({
          type: alert.type,
          sport: alert.sport,
          gameId: alert.gameId,
          userId: alert.userId,
          priority: alert.priority,
          message: alert.message,
          payload: JSON.stringify(alert.context),
          alertKey: alert.alertKey,
          state: 'NEW',
          createdAt: alert.createdAt
        });
      } else {
        // Fallback to direct database insert
        await this.insertAlertDirect(alert);
      }

      console.log(`💾 Saved alert ${alert.id} to database`);
    } catch (error) {
      console.error(`❌ Error saving alert ${alert.id} to database:`, error);
      throw error;
    }
  }

  /**
   * Direct database insert fallback
   */
  private async insertAlertDirect(alert: ProcessedAlert): Promise<void> {
    try {
      const { db } = await import('../../db');
      const { alerts } = await import('../../../shared/schema');
      
      await db.insert(alerts).values({
        type: alert.type,
        sport: alert.sport,
        gameId: alert.gameId,
        priority: alert.priority,
        message: alert.message,
        payload: JSON.stringify(alert.context),
        alertKey: alert.alertKey,
        state: 'NEW',
        createdAt: alert.createdAt
      });

      console.log(`💾 Direct insert successful for alert ${alert.id}`);
    } catch (error) {
      console.error(`❌ Direct insert failed for alert ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * Check deduplication rules
   */
  private async checkDeduplication(alert: ProcessedAlert): Promise<boolean> {
    try {
      // Import deduplication service
      const { AlertDeduplication } = await import('../../services/alert-deduplication');
      const deduplication = new AlertDeduplication();

      // Check if this alert should be filtered
      const isDuplicate = await deduplication.isDuplicate(
        alert.alertKey,
        alert.sport,
        alert.gameId,
        alert.type
      );

      return !isDuplicate;
    } catch (error) {
      console.error(`❌ Deduplication check failed for alert ${alert.id}:`, error);
      // If deduplication fails, allow the alert through
      return true;
    }
  }

  /**
   * Enhance alert with AI
   */
  private async enhanceWithAI(alert: ProcessedAlert): Promise<void> {
    try {
      // Only enhance high-priority alerts to save resources
      if (alert.priority < 70) {
        return;
      }

      const { AIEnhancementService } = await import('../../services/ai-enhancements');
      const aiService = new AIEnhancementService();

      const enhancement = await aiService.enhanceAlert({
        type: alert.type,
        sport: alert.sport,
        context: alert.context,
        message: alert.message
      });

      if (enhancement) {
        alert.context = {
          ...alert.context,
          aiEnhancement: enhancement
        };
        console.log(`🤖 Enhanced alert ${alert.id} with AI`);
      }
    } catch (error) {
      console.error(`❌ AI enhancement failed for alert ${alert.id}:`, error);
      // Continue without enhancement
    }
  }

  /**
   * Deliver alert through various channels
   */
  private async deliverAlert(alert: ProcessedAlert): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    // WebSocket delivery
    deliveryPromises.push(this.deliverViaWebSocket(alert));

    // Telegram delivery (if configured)
    deliveryPromises.push(this.deliverViaTelegram(alert));

    // Wait for all deliveries
    const results = await Promise.allSettled(deliveryPromises);
    
    // Log delivery results
    results.forEach((result, index) => {
      const channel = index === 0 ? 'WebSocket' : 'Telegram';
      if (result.status === 'rejected') {
        console.error(`❌ ${channel} delivery failed for alert ${alert.id}:`, result.reason);
      } else {
        console.log(`✅ ${channel} delivery successful for alert ${alert.id}`);
      }
    });
  }

  /**
   * Deliver alert via WebSocket
   */
  private async deliverViaWebSocket(alert: ProcessedAlert): Promise<void> {
    try {
      const alertData = {
        type: 'alert',
        alert: {
          id: alert.id,
          alertKey: alert.alertKey,
          type: alert.type,
          sport: alert.sport,
          gameId: alert.gameId,
          message: alert.message,
          context: alert.context,
          priority: alert.priority,
          timestamp: alert.createdAt.toISOString()
        }
      };

      // Emit event for WebSocket broadcasting
      this.emit('webSocketDelivery', alertData);
    } catch (error) {
      throw new Error(`WebSocket delivery failed: ${error}`);
    }
  }

  /**
   * Deliver alert via Telegram
   */
  private async deliverViaTelegram(alert: ProcessedAlert): Promise<void> {
    try {
      // Only deliver high-priority alerts via Telegram
      if (alert.priority < 80) {
        return;
      }

      const { sendTelegramAlert } = await import('../../services/telegram');
      
      await sendTelegramAlert({
        message: alert.message,
        sport: alert.sport,
        gameId: alert.gameId,
        type: alert.type,
        priority: alert.priority
      });
    } catch (error) {
      throw new Error(`Telegram delivery failed: ${error}`);
    }
  }

  /**
   * Handle alert processing error
   */
  private async handleAlertError(alert: ProcessedAlert, error: Error): Promise<void> {
    alert.error = error.message;
    alert.retryCount++;

    if (alert.retryCount <= this.config.maxRetries) {
      console.log(`🔄 Retrying alert ${alert.id} (attempt ${alert.retryCount}/${this.config.maxRetries})`);
      
      // Add back to queue with delay
      setTimeout(() => {
        alert.status = 'new';
        this.processingQueue.unshift(alert); // Add to front for priority
        this.sortQueueByPriority();
      }, this.config.retryDelayMs * alert.retryCount);
    } else {
      alert.status = 'failed';
      console.error(`❌ Alert ${alert.id} failed permanently after ${alert.retryCount} attempts`);
      this.emit('alertFailed', alert);
    }
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueueByPriority(): void {
    this.processingQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      config: this.config
    };
  }

  /**
   * Get queue stats
   */
  getQueueStats() {
    const statusCounts = this.processingQueue.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.processingQueue.length,
      byStatus: statusCounts,
      averagePriority: this.processingQueue.length > 0 
        ? this.processingQueue.reduce((sum, alert) => sum + alert.priority, 0) / this.processingQueue.length
        : 0
    };
  }
}