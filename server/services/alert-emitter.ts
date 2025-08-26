import crypto from 'crypto';
import { db } from '../db';
import { alerts, outbox } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface AlertCandidate {
  id: string;
  type: string;
  sport: string;
  title: string;
  description: string;
  priority: number;
  gameInfo: any;
  dedupHash?: string;
  userId?: string;
  sentToTelegram?: boolean;
  seen?: boolean;
}

export interface OutboxMessage {
  kind: 'websocket' | 'telegram';
  payload: any;
}

/**
 * AlertEmitter - Central module for reliable alert processing
 * Implements the workflow pattern: validate → persist → broadcast → notify
 */
export class AlertEmitter {
  
  /**
   * Emit an alert through the reliable delivery pipeline
   * Steps: Guard() → Persist() → Broadcast() → Notify()
   */
  async emit(candidate: AlertCandidate): Promise<string> {
    try {
      // Step 1: Guard - validate and compute dedup hash
      const validatedAlert = this.guard(candidate);
      
      // Step 2: Persist - UPSERT to database
      const alertId = await this.persist(validatedAlert);
      
      // Step 3: Broadcast - add to outbox for reliable delivery
      await this.broadcast(validatedAlert);
      
      console.log(`📧 AlertEmitter: Successfully emitted ${validatedAlert.type} alert (${alertId})`);
      return alertId;
      
    } catch (error) {
      console.error('❌ AlertEmitter: Failed to emit alert:', error);
      throw error;
    }
  }
  
  /**
   * Guard - Validate fields and compute dedup hash
   */
  private guard(candidate: AlertCandidate): AlertCandidate {
    // Validate required fields
    if (!candidate.type || !candidate.sport || !candidate.title || !candidate.description) {
      throw new Error('AlertEmitter: Missing required fields (type, sport, title, description)');
    }
    
    // Compute deterministic dedup hash if not provided
    if (!candidate.dedupHash) {
      const hashInput = JSON.stringify({
        type: candidate.type,
        sport: candidate.sport,
        gameInfo: candidate.gameInfo,
        // Include key identifying info for dedup
        homeTeam: candidate.gameInfo?.homeTeam,
        awayTeam: candidate.gameInfo?.awayTeam,
        matchId: candidate.gameInfo?.matchId,
        inning: candidate.gameInfo?.inning,
        period: candidate.gameInfo?.period,
      });
      candidate.dedupHash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 32);
    }
    
    return candidate;
  }
  
  /**
   * Persist - UPSERT alert to database using dedup hash
   */
  private async persist(alert: AlertCandidate): Promise<string> {
    try {
      // Check if alert already exists
      const existing = await db
        .select()
        .from(alerts)
        .where(eq(alerts.dedupHash, alert.dedupHash!))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`🔄 AlertEmitter: Updating existing alert ${existing[0].id} (dedup: ${alert.dedupHash})`);
        
        // Update existing alert
        await db
          .update(alerts)
          .set({
            title: alert.title,
            description: alert.description,
            priority: alert.priority,
            gameInfo: alert.gameInfo,
          })
          .where(eq(alerts.id, existing[0].id));
        
        return existing[0].id;
      } else {
        console.log(`✨ AlertEmitter: Creating new alert (dedup: ${alert.dedupHash})`);
        
        // Insert new alert
        const [newAlert] = await db
          .insert(alerts)
          .values({
            id: alert.id,
            type: alert.type,
            sport: alert.sport,
            title: alert.title,
            description: alert.description,
            priority: alert.priority,
            gameInfo: alert.gameInfo,
            dedupHash: alert.dedupHash,
            sentToTelegram: alert.sentToTelegram ?? false,
            seen: alert.seen ?? false,
          })
          .returning();
        
        return newAlert.id;
      }
    } catch (error) {
      console.error('❌ AlertEmitter: Database persist failed:', error);
      throw error;
    }
  }
  
  /**
   * Broadcast - Add WebSocket and Telegram messages to outbox
   */
  private async broadcast(alert: AlertCandidate): Promise<void> {
    try {
      const messages: OutboxMessage[] = [
        // WebSocket broadcast
        {
          kind: 'websocket',
          payload: {
            type: 'alert',
            data: alert
          }
        }
      ];
      
      // Add Telegram message if enabled
      if (alert.sentToTelegram !== false) {
        messages.push({
          kind: 'telegram',
          payload: alert
        });
      }
      
      // Insert all messages into outbox
      for (const msg of messages) {
        await db.insert(outbox).values({
          kind: msg.kind,
          payloadJson: JSON.stringify(msg.payload),
        });
      }
      
      console.log(`📤 AlertEmitter: Queued ${messages.length} outbox messages for ${alert.type}`);
      
    } catch (error) {
      console.error('❌ AlertEmitter: Broadcast failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const alertEmitter = new AlertEmitter();