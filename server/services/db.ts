import type { AlertCandidate } from '../models/contracts';
import { buildAlertKey } from '../models/alert-key';
import { db } from '../db';
import { alerts, plays, alertCooldowns } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import cooldowns from '../../config/cooldowns.json';

export async function savePlay(sport: string, gameId: string, ts: string, payload: any): Promise<void> {
  try {
    await db.insert(plays).values({
      sport,
      gameId,
      ts: new Date(ts),
      payload
    });
  } catch (error) {
    console.error('Failed to save play:', error);
  }
}

export async function tryInsertAlert(a: AlertCandidate): Promise<boolean> {
  const alertKey = buildAlertKey(a);
  
  try {
    await db.insert(alerts).values({
      alertKey,
      sport: a.sport,
      gameId: a.gameId,
      type: a.type,
      score: a.score,
      payload: a
    });
    return true;
  } catch (error) {
    // If unique constraint fails, this is a duplicate
    if (error instanceof Error && error.message.includes('duplicate')) {
      return false;
    }
    console.error('Failed to insert alert:', error);
    return false;
  }
}

export async function isInCooldown(a: AlertCandidate): Promise<boolean> {
  try {
    const result = await db
      .select({ until: alertCooldowns.until })
      .from(alertCooldowns)
      .where(
        and(
          eq(alertCooldowns.sport, a.sport),
          eq(alertCooldowns.gameId, a.gameId),
          eq(alertCooldowns.type, a.type)
        )
      )
      .limit(1);

    if (result.length === 0) return false;
    
    return new Date() < result[0].until;
  } catch (error) {
    console.error('Failed to check cooldown:', error);
    return false;
  }
}

export async function setCooldown(a: AlertCandidate): Promise<void> {
  const cooldownSeconds = (cooldowns as any)[a.type] || 60; // default 60 seconds
  const until = new Date(Date.now() + cooldownSeconds * 1000);

  try {
    await db
      .insert(alertCooldowns)
      .values({
        sport: a.sport,
        gameId: a.gameId,
        type: a.type,
        until
      })
      .onConflictDoUpdate({
        target: [alertCooldowns.sport, alertCooldowns.gameId, alertCooldowns.type],
        set: { until }
      });
  } catch (error) {
    console.error('Failed to set cooldown:', error);
  }
}