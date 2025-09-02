import React from 'react';
import type { AlertUI } from './types';

export function nflAdapter(alert:any): AlertUI {
  const matchup = `${alert.awayTeam} @ ${alert.homeTeam}`;
  const score = (alert.awayScore!=null && alert.homeScore!=null) ? `${alert.awayScore}–${alert.homeScore}` : undefined;

  const pips = (alert.down!=null)
    ? [{ label: 'Down', filled: Math.min(alert.down ?? 0, 4), total: 4 }]
    : undefined;

  const people = [
    alert.qbName ? { label: 'QB', value: alert.qbName } : null,
    alert.rbName ? { label: 'RB', value: alert.rbName } : null,
    alert.wrName ? { label: 'WR', value: alert.wrName } : null,
  ].filter(Boolean) as {label:string; value:string}[];

  const chips: string[] = [];
  if (alert.periodLabel) chips.push(alert.periodLabel);   // "Q4 01:12"
  if (alert.yardsToGo!=null) chips.push(`${alert.yardsToGo} to go`);
  if (alert.redZone) chips.push('Red Zone');
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