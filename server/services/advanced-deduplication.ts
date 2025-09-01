import type { AlertCandidate } from '../models/contracts';
import { db } from '../db';
import { alerts } from '../../shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

export interface DeduplicationRule {
  windowSeconds: number;
  scope: 'plate-appearance' | 'half-inning' | 'full-inning' | 'game' | 'global';
  realertAfterSeconds?: number;
  contentFactors: string[]; // Fields to include in dedup key
}

// Advanced deduplication rules by alert type (similar to Python system)
const DEDUPLICATION_RULES: Record<string, DeduplicationRule> = {
  'HIGH_SCORING_OPP': {
    windowSeconds: 60,
    scope: 'half-inning',
    realertAfterSeconds: 180,
    contentFactors: ['sport', 'gameId', 'type', 'phase', 'bases', 'outs']
  },
  'RED_ZONE': {
    windowSeconds: 90,
    scope: 'full-inning',
    realertAfterSeconds: 300,
    contentFactors: ['sport', 'gameId', 'type', 'yardline', 'down', 'toGo']
  },
  'HOME_RUN': {
    windowSeconds: 30,
    scope: 'plate-appearance',
    realertAfterSeconds: 120,
    contentFactors: ['sport', 'gameId', 'type', 'batterId', 'inning']
  },
  'BASES_LOADED': {
    windowSeconds: 90,
    scope: 'half-inning',
    realertAfterSeconds: 300,
    contentFactors: ['sport', 'gameId', 'type', 'inning', 'outs']
  },
  'CLOSE_GAME': {
    windowSeconds: 180,
    scope: 'game',
    realertAfterSeconds: 600,
    contentFactors: ['sport', 'gameId', 'type', 'scoreDiff', 'timeRemaining']
  },
  'TOUCHDOWN': {
    windowSeconds: 45,
    scope: 'full-inning',
    realertAfterSeconds: 180,
    contentFactors: ['sport', 'gameId', 'type', 'quarter', 'scoringTeam']
  }
};

export function buildAdvancedDedupKey(alert: AlertCandidate): string {
  const rule = DEDUPLICATION_RULES[alert.type];
  if (!rule) {
    // Fallback to simple key
    return `${alert.sport}:${alert.gameId}:${alert.type}:${alert.phase}`;
  }

  const keyParts: string[] = [];
  
  // Always include base identifiers
  keyParts.push(alert.sport, alert.gameId, alert.type);
  
  // Add scope-specific context
  switch (rule.scope) {
    case 'plate-appearance':
      if (alert.context.batterId) keyParts.push(`pa:${alert.context.batterId}`);
      if (alert.context.inning) keyParts.push(`inn:${alert.context.inning}`);
      if (alert.context.outs !== undefined) keyParts.push(`outs:${alert.context.outs}`);
      break;
      
    case 'half-inning':
      if (alert.context.inning) keyParts.push(`inn:${alert.context.inning}`);
      if (alert.context.inningState) keyParts.push(`half:${alert.context.inningState}`);
      break;
      
    case 'full-inning':
      if (alert.context.inning) keyParts.push(`inn:${alert.context.inning}`);
      if (alert.context.quarter) keyParts.push(`q:${alert.context.quarter}`);
      break;
      
    case 'game':
      // Game-level scoping - minimal context
      break;
      
    case 'global':
      // Global scoping across games
      keyParts.push('global');
      break;
  }
  
  // Add content-specific factors
  for (const factor of rule.contentFactors) {
    if (alert.context[factor] !== undefined) {
      keyParts.push(`${factor}:${alert.context[factor]}`);
    }
  }
  
  return keyParts.join(':');
}

export async function shouldSendAdvancedAlert(alert: AlertCandidate): Promise<boolean> {
  const rule = DEDUPLICATION_RULES[alert.type];
  if (!rule) {
    // Fallback to simple time-based check
    return await isNotInSimpleCooldown(alert);
  }

  const dedupKey = buildAdvancedDedupKey(alert);
  const windowStart = new Date(Date.now() - rule.windowSeconds * 1000);
  
  // Check for recent alerts with same dedup key
  const recentAlerts = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.dedupKey, dedupKey),
        gte(alerts.createdAt, windowStart)
      )
    )
    .orderBy(desc(alerts.createdAt))
    .limit(1);

  if (recentAlerts.length === 0) {
    return true; // No recent duplicate, allow
  }

  const lastAlert = recentAlerts[0];
  const timeSinceLastAlert = Date.now() - lastAlert.createdAt.getTime();
  
  // Check if we're in re-alert window
  if (rule.realertAfterSeconds && timeSinceLastAlert >= rule.realertAfterSeconds * 1000) {
    console.log(`Re-alert allowed for ${alert.type} after ${timeSinceLastAlert/1000}s (threshold: ${rule.realertAfterSeconds}s)`);
    return true;
  }
  
  // Suppressed by deduplication
  console.log(`Alert suppressed by advanced dedup: ${dedupKey}, last seen ${timeSinceLastAlert/1000}s ago`);
  return false;
}

async function isNotInSimpleCooldown(alert: AlertCandidate): Promise<boolean> {
  // Simple 60-second cooldown for unknown alert types
  const windowStart = new Date(Date.now() - 60 * 1000);
  
  const recentAlerts = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.sport, alert.sport),
        eq(alerts.gameId, alert.gameId),
        eq(alerts.type, alert.type),
        gte(alerts.createdAt, windowStart)
      )
    )
    .limit(1);

  return recentAlerts.length === 0;
}

export function getDeduplicationRule(alertType: string): DeduplicationRule | null {
  return DEDUPLICATION_RULES[alertType] || null;
}

export function calculatePriority(alert: AlertCandidate): number {
  // Enhanced priority calculation similar to Python system
  let basePriority = alert.score || 50;
  
  // Context-based priority adjustments
  const context = alert.context;
  
  // High-impact situations get priority boost
  if (alert.type === 'HOME_RUN' && context.grandSlam) {
    basePriority = Math.min(100, basePriority + 30);
  }
  
  if (alert.type === 'RED_ZONE' && context.yardline && context.yardline <= 10) {
    basePriority = Math.min(100, basePriority + 15);
  }
  
  if (alert.type === 'CLOSE_GAME' && context.scoreDiff && context.scoreDiff <= 3) {
    basePriority = Math.min(100, basePriority + 20);
  }
  
  // Late game situations get priority boost
  if (context.isLateGame) {
    basePriority = Math.min(100, basePriority + 10);
  }
  
  // Weather impact (favorable conditions for offense)
  if (alert.weatherBucket && alert.weatherBucket.includes('FAVORABLE')) {
    basePriority = Math.min(100, basePriority + 5);
  }
  
  return Math.max(1, Math.min(100, Math.round(basePriority)));
}