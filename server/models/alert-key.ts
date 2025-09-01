import { createHash } from 'crypto';
import type { AlertCandidate } from './contracts';

export function buildAlertKey(a: AlertCandidate): string {
  const base = [
    a.sport, a.gameId, a.phase, a.type, a.situation,
    a.playerId ?? '', a.weatherBucket ?? '', a.ruleVersion
  ].join('|');
  return createHash('sha256').update(base).digest('hex').slice(0, 24);
}