import { db } from '../db';
import { outbox } from '@shared/schema';
import { eq, and, isNull, lt, not } from 'drizzle-orm';
import { sendTelegramAlert } from './telegram';

/**
 * OutboxWorker - Reliable delivery worker for outbox messages
 * Processes WebSocket and Telegram messages with retries and failure handling
 */
export class OutboxWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESS_INTERVAL = 2000; // 2 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 60000; // 1 minute

  start() {
    if (this.isRunning) {
      console.log('📬 OutboxWorker: Already running');
      return;
    }

    this.isRunning = true;
    console.log('📬 OutboxWorker: Starting reliable delivery worker...');
    
    this.intervalId = setInterval(() => {
      this.processOutbox().catch(error => {
        console.error('❌ OutboxWorker: Error processing outbox:', error);
      });
    }, this.PROCESS_INTERVAL);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('📬 OutboxWorker: Stopped');
  }

  private async processOutbox() {
    try {
      // Get unprocessed messages (not dispatched or failed recently)
      const cutoffTime = new Date(Date.now() - this.RETRY_DELAY);
      
      const messages = await db
        .select()
        .from(outbox)
        .where(
          and(
            isNull(outbox.dispatchedAt),
            lt(outbox.failureCount, this.MAX_RETRIES)
          )
        )
        .orderBy(outbox.createdAt)
        .limit(10);

      if (messages.length === 0) {
        return; // No messages to process
      }

      console.log(`📬 OutboxWorker: Processing ${messages.length} outbox messages`);

      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('❌ OutboxWorker: Failed to process outbox:', error);
    }
  }

  private async processMessage(message: any) {
    try {
      const payload = JSON.parse(message.payloadJson);
      let success = false;

      switch (message.kind) {
        case 'websocket':
          success = await this.sendWebSocket(payload);
          break;
        case 'telegram':
          success = await this.sendTelegram(payload);
          break;
        default:
          console.warn(`📬 OutboxWorker: Unknown message kind: ${message.kind}`);
          success = false;
      }

      if (success) {
        // Mark as dispatched
        await db
          .update(outbox)
          .set({
            dispatchedAt: new Date(),
            lastError: null,
          })
          .where(eq(outbox.id, message.id));
        
        console.log(`✅ OutboxWorker: Successfully dispatched ${message.kind} message ${message.id}`);
      } else {
        // Increment failure count
        await db
          .update(outbox)
          .set({
            failureCount: message.failureCount + 1,
            lastError: `Failed to send ${message.kind} message`,
          })
          .where(eq(outbox.id, message.id));
        
        console.log(`❌ OutboxWorker: Failed ${message.kind} message ${message.id} (attempt ${message.failureCount + 1}/${this.MAX_RETRIES})`);
      }
    } catch (error) {
      console.error(`❌ OutboxWorker: Error processing message ${message.id}:`, error);
      
      // Increment failure count on error
      await db
        .update(outbox)
        .set({
          failureCount: message.failureCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(outbox.id, message.id));
    }
  }

  private async sendWebSocket(payload: any): Promise<boolean> {
    try {
      // For now, WebSocket broadcasting is handled directly by engines
      console.log('📬 OutboxWorker: WebSocket broadcasts handled directly by engines');
      return true;
    } catch (error) {
      console.error('❌ OutboxWorker: WebSocket send failed:', error);
      return false;
    }
  }

  private async sendTelegram(payload: any): Promise<boolean> {
    try {
      // For now, skip Telegram in outbox - the tennis engine handles it directly
      console.log('📬 OutboxWorker: Telegram notifications handled directly by engines');
      return true;
    } catch (error) {
      console.error('❌ OutboxWorker: Telegram send failed:', error);
      return false;
    }
  }

  /**
   * Cleanup old dispatched messages to prevent table bloat
   */
  async cleanup() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await db
        .delete(outbox)
        .where(
          and(
            not(isNull(outbox.dispatchedAt)), // Only delete dispatched messages
            lt(outbox.dispatchedAt, cutoffTime)
          )
        );
      
      console.log(`🧹 OutboxWorker: Cleaned up old outbox messages`);
    } catch (error) {
      console.error('❌ OutboxWorker: Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const outboxWorker = new OutboxWorker();