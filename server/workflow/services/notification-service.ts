import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';

/**
 * Unified notification service for all delivery channels
 */

export interface NotificationConfig {
  enableWebSocket: boolean;
  enableTelegram: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface NotificationPayload {
  id: string;
  type: 'alert' | 'status' | 'system';
  sport: string;
  gameId?: string;
  userId?: string;
  title: string;
  message: string;
  priority: number;
  data: any;
  timestamp: Date;
}

export interface DeliveryResult {
  channel: string;
  success: boolean;
  error?: string;
  deliveryTime: number;
}

export class NotificationService extends EventEmitter {
  private config: NotificationConfig;
  private wss?: WebSocketServer;
  private activeDeliveries: Map<string, Promise<DeliveryResult[]>> = new Map();

  constructor(config: NotificationConfig) {
    super();
    this.config = config;
  }

  /**
   * Set WebSocket server
   */
  setWebSocketServer(wss: WebSocketServer): void {
    this.wss = wss;
    console.log('📡 WebSocket server configured for notifications');
  }

  /**
   * Send notification through all enabled channels
   */
  async sendNotification(payload: NotificationPayload): Promise<DeliveryResult[]> {
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    console.log(`📤 Sending notification ${payload.id} via ${deliveryId}`);

    // Check if already being delivered
    const existingDelivery = this.activeDeliveries.get(payload.id);
    if (existingDelivery) {
      console.log(`⏳ Notification ${payload.id} already being delivered`);
      return await existingDelivery;
    }

    // Create delivery promise
    const deliveryPromise = this.executeDelivery(payload);
    this.activeDeliveries.set(payload.id, deliveryPromise);

    try {
      const results = await deliveryPromise;
      
      // Log results
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      console.log(`📊 Notification ${payload.id} delivered: ${successful} success, ${failed} failed`);
      
      this.emit('notificationDelivered', { payload, results });
      return results;
      
    } finally {
      this.activeDeliveries.delete(payload.id);
    }
  }

  /**
   * Execute delivery through all channels
   */
  private async executeDelivery(payload: NotificationPayload): Promise<DeliveryResult[]> {
    const deliveryPromises: Promise<DeliveryResult>[] = [];

    // WebSocket delivery
    if (this.config.enableWebSocket && this.wss) {
      deliveryPromises.push(this.deliverViaWebSocket(payload));
    }

    // Telegram delivery
    if (this.config.enableTelegram) {
      deliveryPromises.push(this.deliverViaTelegram(payload));
    }

    // Execute all deliveries in parallel
    const results = await Promise.allSettled(deliveryPromises);
    
    return results.map((result, index) => {
      const channel = index === 0 ? 'websocket' : 'telegram';
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          channel,
          success: false,
          error: result.reason?.message || 'Unknown error',
          deliveryTime: 0
        };
      }
    });
  }

  /**
   * Deliver via WebSocket
   */
  private async deliverViaWebSocket(payload: NotificationPayload): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.wss) {
        throw new Error('WebSocket server not configured');
      }

      const message = JSON.stringify({
        type: payload.type,
        id: payload.id,
        sport: payload.sport,
        gameId: payload.gameId,
        title: payload.title,
        message: payload.message,
        priority: payload.priority,
        data: payload.data,
        timestamp: payload.timestamp.toISOString()
      });

      let deliveredCount = 0;
      
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          try {
            client.send(message);
            deliveredCount++;
          } catch (error) {
            console.error('❌ WebSocket send error:', error);
          }
        }
      });

      const deliveryTime = Date.now() - startTime;

      if (deliveredCount === 0) {
        throw new Error('No active WebSocket connections');
      }

      console.log(`📡 WebSocket delivered to ${deliveredCount} clients in ${deliveryTime}ms`);

      return {
        channel: 'websocket',
        success: true,
        deliveryTime
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      console.error('❌ WebSocket delivery failed:', error);
      
      return {
        channel: 'websocket',
        success: false,
        error: (error as Error).message,
        deliveryTime
      };
    }
  }

  /**
   * Deliver via Telegram
   */
  private async deliverViaTelegram(payload: NotificationPayload): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Only send high-priority alerts via Telegram to avoid spam
      if (payload.priority < 80) {
        return {
          channel: 'telegram',
          success: true,
          deliveryTime: 0
        };
      }

      const { sendTelegramAlert } = await import('../../services/telegram');
      
      await sendTelegramAlert({
        message: `${payload.title}\n${payload.message}`,
        sport: payload.sport,
        gameId: payload.gameId || '',
        type: payload.type,
        priority: payload.priority
      });

      const deliveryTime = Date.now() - startTime;
      console.log(`📱 Telegram delivered in ${deliveryTime}ms`);

      return {
        channel: 'telegram',
        success: true,
        deliveryTime
      };

    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      
      console.error('❌ Telegram delivery failed:', error);
      
      return {
        channel: 'telegram',
        success: false,
        error: (error as Error).message,
        deliveryTime
      };
    }
  }

  /**
   * Broadcast system status
   */
  async broadcastSystemStatus(status: any): Promise<void> {
    const payload: NotificationPayload = {
      id: `status_${Date.now()}`,
      type: 'system',
      sport: 'SYSTEM',
      title: 'System Status Update',
      message: `System status: ${status.isRunning ? 'Running' : 'Stopped'}`,
      priority: 30,
      data: status,
      timestamp: new Date()
    };

    await this.sendNotification(payload);
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<DeliveryResult[]> {
    const payload: NotificationPayload = {
      id: `test_${Date.now()}`,
      type: 'system',
      sport: 'TEST',
      title: 'Test Notification',
      message: 'This is a test notification from the new workflow system',
      priority: 50,
      data: { test: true },
      timestamp: new Date()
    };

    return await this.sendNotification(payload);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      config: this.config,
      hasWebSocket: !!this.wss,
      activeDeliveries: this.activeDeliveries.size,
      webSocketClients: this.wss?.clients.size || 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ Notification service config updated');
  }
}