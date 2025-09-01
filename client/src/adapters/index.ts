import type { AlertUI } from '../types/AlertUI';
import { mlbAdapter } from './mlbAdapter';
import { nbaAdapter } from './nbaAdapter';
import { nflAdapter } from './nflAdapter';

export const sportAdapters: Record<string, (a: any) => AlertUI> = {
  MLB: mlbAdapter,
  NBA: nbaAdapter,
  NFL: nflAdapter,
  // NHL, NCAAF, CFL… add later
};

export function toAlertUI(alert: any): AlertUI {
  const fn = sportAdapters[alert.sport] || defaultAdapter;
  return fn(alert);
}

function defaultAdapter(alert: any): AlertUI {
  return {
    sport: alert.sport,
    matchup: `${alert.awayTeam ?? ''} @ ${alert.homeTeam ?? ''}`.trim(),
    typeLabel: (alert.type || '').replaceAll('_', ' '),
    message: alert.message ?? '',
    confidence: alert.confidence,
    createdAtISO: alert.createdAt ?? new Date().toISOString(),
    chips: [],
  };
}