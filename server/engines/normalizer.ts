import type { CanonicalState, GameTick } from '../models/contracts';

export function normalizeMLB(raw: any): GameTick {
  const cs: CanonicalState = {
    status: mapStatus(raw),
    score: { home: raw.homeScore ?? 0, away: raw.awayScore ?? 0 },
    inning: raw.inning ? { half: raw.inning.half, num: raw.inning.num } : undefined,
    outs: raw.outs ?? 0,
    bases: { first: !!raw.on1, second: !!raw.on2, third: !!raw.on3 },
    batterId: raw.batterId,
    batterStats: { hrRate: raw.batterHrRate, ops: raw.batterOps },
    venue: { lat: raw.venue?.lat, lon: raw.venue?.lon, roof: raw.venue?.roof },
    weatherBucket: raw.weatherBucket
  };
  return { sport: 'MLB', gameId: String(raw.gamePk), ts: new Date().toISOString(), state: cs, diff: {} };
}

export function normalizeNCAAF(raw: any): GameTick {
  const cs: CanonicalState = {
    status: mapStatus(raw),
    score: { home: raw.home, away: raw.away },
    clock: { period: raw.period, time: raw.clock }, // "02:15"
    possession: raw.poss,
    fieldPos: { yardline: raw.yardline, side: raw.side },
    downDist: { down: raw.down, toGo: raw.toGo },
    venue: { lat: raw.venue?.lat, lon: raw.venue?.lon, roof: 'OPEN' }
  };
  return { sport: 'NCAAF', gameId: String(raw.id), ts: new Date().toISOString(), state: cs, diff: {} };
}

function mapStatus(r: any): CanonicalState['status'] {
  if (r.status === 'Final') return 'FINAL';
  if (r.status?.includes('Live')) return 'LIVE';
  if (r.status?.includes('Delay')) return 'DELAYED';
  return 'SCHEDULED';
}