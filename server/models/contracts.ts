export type Sport = 'MLB'|'NCAAF';

export type GameTick = {
  sport: Sport;
  gameId: string;
  ts: string;                // ISO
  state: CanonicalState;
  diff: Partial<CanonicalState>;
};

export type CanonicalState = {
  status: 'SCHEDULED'|'LIVE'|'FINAL'|'DELAYED';
  venue: { lat?: number; lon?: number; roof?: 'OPEN'|'CLOSED' };
  score: { home: number; away: number };
  // MLB
  inning?: { half: 'T'|'B'; num: number };
  outs?: 0|1|2;
  bases?: { first: boolean; second: boolean; third: boolean };
  batterId?: string;
  batterStats?: { hrRate?: number; ops?: number };
  // Football
  clock?: { period: number; time?: string };      // period=1..4
  fieldPos?: { yardline?: number; side?: 'HOME'|'AWAY' };
  downDist?: { down?: 1|2|3|4; toGo?: number };
  possession?: 'HOME'|'AWAY';
  situationalFlags?: string[];
  weatherBucket?: string; // e.g., OUT_TO_CF_10_15, INDOOR, CALM
};

export type AlertCandidate = {
  sport: Sport;
  gameId: string;
  type: 'HIGH_SCORING_OPP'|'NINTH_TIE'|'RED_ZONE';
  phase: string;            // "T7" or "Q4_02:15"
  situation: string;        // compact code
  playerId?: string;
  weatherBucket?: string;
  ruleVersion: string;
  score: number;            // priority 0..100
  context: Record<string, unknown>;
};