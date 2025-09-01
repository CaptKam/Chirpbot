import type { AlertUI } from '../types/AlertUI';

export function mlbAdapter(alert: any): AlertUI {
  const matchup = `${alert.awayTeam} @ ${alert.homeTeam}`;
  const score = (alert.awayScore != null && alert.homeScore != null) ? `${alert.awayScore}–${alert.homeScore}` : undefined;

  const bases = (alert.hasFirst || alert.hasSecond || alert.hasThird)
    ? { on1: !!alert.hasFirst, on2: !!alert.hasSecond, on3: !!alert.hasThird }
    : undefined;

  const pips = (alert.balls != null || alert.strikes != null || alert.outs != null)
    ? [
        { label: 'B', filled: alert.balls ?? 0,   total: 3 },
        { label: 'S', filled: alert.strikes ?? 0, total: 2 },
        { label: 'O', filled: alert.outs ?? 0,    total: 2 },
      ]
    : undefined;

  const people = [
    alert.batterName   ? { label: 'Batter',  value: alert.batterName } : null,
    alert.onDeckName   ? { label: 'On-Deck', value: alert.onDeckName } : null,
    alert.pitcherName  ? { label: 'P',       value: alert.pitcherName } : null,
  ].filter(Boolean) as {label:string; value:string}[];

  const chips: string[] = [];
  if (alert.inning != null) chips.push(`${alert.isTopInning ? 'Top' : 'Bot'} ${alert.inning}`);
  if (alert.clock) chips.push(`⏱ ${alert.clock}`);
  if (alert.windMph != null && alert.windDirDeg != null) chips.push(`Wind ${arrow(alert.windDirDeg)} ${alert.windMph} mph`);
  if (alert.venue) chips.push(alert.venue);

  return {
    sport: alert.sport,
    matchup,
    score,
    typeLabel: (alert.type || '').replaceAll('_',' '),
    confidence: alert.confidence,
    message: alert.message,
    bases,
    pips,
    people: people.length ? people : undefined,
    chips,
    createdAtISO: alert.createdAt,
  };
}

function arrow(deg: number) { 
  return degToArrow(Math.round(deg / 45) % 8); 
}

function degToArrow(i: number) {
  return ['↑','↗','→','↘','↓','↙','←','↖'][i] ?? '↑';
}