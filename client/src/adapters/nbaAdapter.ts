import type { AlertUI } from '../types/AlertUI';

export function nbaAdapter(alert: any): AlertUI {
  const matchup = `${alert.awayTeam} @ ${alert.homeTeam}`;
  const score = (alert.awayScore != null && alert.homeScore != null) ? `${alert.awayScore}–${alert.homeScore}` : undefined;

  const pips = (alert.teamFouls != null || alert.turnovers != null)
    ? [
        { label: 'Fouls', filled: Math.min(alert.teamFouls ?? 0, 5), total: 5 },
        { label: 'TO',    filled: Math.min(alert.turnovers ?? 0, 5), total: 5 },
      ]
    : undefined;

  const people = [
    alert.shooterName   ? { label: 'Shooter',  value: alert.shooterName } : null,
    alert.defenderName  ? { label: 'Defender', value: alert.defenderName } : null,
  ].filter(Boolean) as {label:string; value:string}[];

  const chips: string[] = [];
  if (alert.periodLabel) chips.push(alert.periodLabel);      // e.g., "Q4 2:18"
  if (alert.clock) chips.push(`⏱ ${alert.clock}`);
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