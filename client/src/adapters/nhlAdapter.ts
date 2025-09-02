import React from 'react';
import type { AlertUI } from './types';

export function nhlAdapter(alert: any): AlertUI {
  const matchup = `${alert.awayTeam} @ ${alert.homeTeam}`;
  const score = (alert.awayScore!=null && alert.homeScore!=null) ? `${alert.awayScore}–${alert.homeScore}` : undefined;

  const pips = (alert.penalties!=null)
    ? [{ label: 'PIM', filled: Math.min(alert.penalties ?? 0, 10), total: 10 }]
    : undefined;

  const people = [
    alert.goalieNames ? { label: 'Goalie', value: alert.goalieNames } : null,
    alert.scorerName ? { label: 'Scorer', value: alert.scorerName } : null,
  ].filter(Boolean) as {label:string; value:string}[];

  const chips: string[] = [];
  if (alert.periodLabel) chips.push(alert.periodLabel);   // "P3 12:34"
  if (alert.clock) chips.push(`⏱ ${alert.clock}`);
  if (alert.powerPlay) chips.push('Power Play');
  if (alert.emptyNet) chips.push('Empty Net');
  if (alert.venue) chips.push(alert.venue);

  return {
    sport: alert.sport,
    matchup,
    score,
    typeLabel: (alert.type || '').replaceAll('_',' '),
    confidence: alert.confidence,
    message: alert.message,
    pips,
    people: people.length ? people : undefined,
    chips,
    createdAtISO: alert.createdAt,
  };
}