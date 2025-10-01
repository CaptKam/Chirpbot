export type HalfInning = { frame: 'Top'|'Bot'; inning: number };
export type Bases = { on1B: boolean; on2B: boolean; on3B: boolean };
export type WindDir = 'out'|'in'|'left'|'right'|'cross'|'unknown';

export interface MLBState {
  gameId: string;
  score: { away: number; home: number };
  half: HalfInning;
  outs: 0|1|2;
  bases: Bases;
  batter?: {
    name?: string;
    iso?: number;
    hardHit?: number;
    handedness?: 'L'|'R'|'S';
  };
  pitcher?: {
    hrPer9?: number;
    gbRate?: number;
    handedness?: 'L'|'R';
  };
  matchup?: { platoonAdv?: boolean };
  park?: { hrFactor?: number };
  weather?: { windMph?: number; windDir?: WindDir; tempF?: number };
  market?: { liveWinProbHome?: number };
}

export type MLBAlertVariant =
  | 'MLB_RISP'
  | 'MLB_BASES_LOADED'
  | 'MLB_FULL_COUNT_RISP'
  | 'MLB_LATE_PRESSURE'
  | 'MLB_HR_THREAT';

export interface MathOutput {
  p_event: number;
  leverage: number;
  confidence: number;
  priority: 'P90'|'P75'|'P50'|'P25';
}

export interface MLBAlertScore extends MathOutput {
  variant: MLBAlertVariant;
  aiText: string;
  dedupeKey: string;
}

const clamp01 = (x:number) => Math.max(0, Math.min(1, x));
const round = (x:number, d=2) => Math.round(x * 10**d) / 10**d;

function inningNumber(h: HalfInning) {
  return Math.max(1, h.inning);
}

function scoreDiffAbs(score: MLBState['score']) {
  return Math.abs((score.home ?? 0) - (score.away ?? 0));
}

function hasRISP(b: Bases) {
  return !!(b.on2B || b.on3B);
}

function basesLoaded(b: Bases) {
  return !!(b.on1B && b.on2B && b.on3B);
}

function rispString(b: Bases) {
  if (basesLoaded(b)) return 'Bases loaded';
  if (b.on2B && b.on3B) return 'Runners on 2nd & 3rd';
  if (b.on3B) return 'Runner on 3rd';
  if (b.on2B) return 'Runner on 2nd';
  return 'Runners on';
}

function windOutComponent(w?: MLBState['weather']) {
  if (!w || w.windMph == null) return 0;
  const mph = Math.max(0, w.windMph);
  const dir = w.windDir ?? 'unknown';
  const dirMult =
    dir === 'out' ? 1 :
    dir === 'cross' || dir === 'left' || dir === 'right' ? 0.35 :
    dir === 'in' ? -0.7 : 0;
  return clamp01((mph / 20) * dirMult);
}

function batterPowerZ(b?: MLBState['batter']) {
  if (!b || b.iso == null) return 0;
  const z = (b.iso - 0.170) / 0.060;
  return Math.max(-2.5, Math.min(3, z));
}

function pitcherHRZ(p?: MLBState['pitcher']) {
  if (!p || p.hrPer9 == null) return 0;
  const z = (p.hrPer9 - 1.10) / 0.40;
  return Math.max(-2.5, Math.min(3, z));
}

function parkHRFactor(park?: MLBState['park']) {
  return park?.hrFactor != null ? clamp01((park.hrFactor - 0.9) / 0.5) : 0;
}

function lateCloseWeight(h: HalfInning, score: MLBState['score']) {
  const inn = inningNumber(h);
  const late = inn >= 7 ? 1 : inn >= 6 ? 0.7 : 0.3;
  const close = scoreDiffAbs(score) <= 1 ? 1 : scoreDiffAbs(score) === 2 ? 0.6 : 0.25;
  return clamp01(0.6*late + 0.4*close);
}

function stateHash(s: MLBState) {
  const b = s.bases;
  return [
    s.half.frame, s.half.inning,
    s.outs,
    b.on1B ? 1 : 0, b.on2B ? 1 : 0, b.on3B ? 1 : 0,
    s.score.away, s.score.home
  ].join('|');
}

function probRunNextPA(state: MLBState): number {
  const b = state.bases;
  const isR = hasRISP(b) ? 1 : 0;
  const isBL = basesLoaded(b) ? 1 : 0;

  const zISO = batterPowerZ(state.batter);
  const zHR9 = pitcherHRZ(state.pitcher);
  const wind = windOutComponent(state.weather);
  const park = parkHRFactor(state.park);

  const outsPenalty = state.outs * 0.25;

  let logit =
    -0.35 +
    0.85 * isR +
    0.35 * isBL +
    0.22 * zISO +
    0.18 * zHR9 +
    0.30 * wind +
    0.15 * park -
    outsPenalty;

  if (state.matchup?.platoonAdv) logit += 0.08;

  const p = 1 / (1 + Math.exp(-logit));
  return clamp01(p * 0.98);
}

function probHRThisPA(state: MLBState): number {
  const zISO = batterPowerZ(state.batter);
  const zHR9 = pitcherHRZ(state.pitcher);
  const wind = windOutComponent(state.weather);
  const park = parkHRFactor(state.park);

  let logit =
    -3.65 +
    0.55 * zISO +
    0.40 * zHR9 +
    0.60 * wind +
    0.25 * park;

  if (state.matchup?.platoonAdv) logit += 0.10;

  const p = 1 / (1 + Math.exp(-logit));
  return clamp01(p);
}

function probMultiRunHalfInning(state: MLBState): number {
  const b = state.bases;
  const baseWeight =
    (b.on3B ? 0.55 : 0) + (b.on2B ? 0.42 : 0) + (b.on1B ? 0.28 : 0);
  const outsFactor = [0.55, 0.33, 0.12][state.outs];
  const zISO = batterPowerZ(state.batter);
  const zHR9 = pitcherHRZ(state.pitcher);
  const wind = windOutComponent(state.weather);
  const park = parkHRFactor(state.park);

  let logit =
    -1.60 +
    1.25 * baseWeight +
    0.35 * zISO +
    0.20 * zHR9 +
    0.40 * wind +
    0.18 * park +
    0.95 * outsFactor;

  const p = 1 / (1 + Math.exp(-logit));
  return clamp01(p);
}

function leverageScore(state: MLBState, variant: MLBAlertVariant): number {
  let L = lateCloseWeight(state.half, state.score);

  if (variant === 'MLB_BASES_LOADED') L = clamp01(L + 0.10);
  if (variant === 'MLB_FULL_COUNT_RISP') L = clamp01(L + 0.08);
  return L;
}

function calibratedConfidence(p_event: number, state: MLBState): number {
  let p = p_event;

  let missing = 0;
  if (!state.batter?.iso) missing++;
  if (!state.pitcher?.hrPer9) missing++;
  if (state.weather && state.weather.windMph == null) missing++;
  const penalty = 1 - Math.min(0.15 * missing, 0.30);
  p = clamp01(p * penalty);

  p = 0.05 + 0.90 * p;
  return Math.round(100 * p);
}

function priorityBucket(p_event: number, leverage: number, confPct: number) {
  const score = 0.45 * p_event + 0.35 * leverage + 0.20 * (confPct / 100);
  if (score >= 0.80) return 'P90';
  if (score >= 0.65) return 'P75';
  if (score >= 0.50) return 'P50';
  return 'P25';
}

export function scoreMlbAlert(state: MLBState): MLBAlertScore | null {
  const hasBL = basesLoaded(state.bases);
  const has_risp = hasRISP(state.bases);

  let variant: MLBAlertVariant | null = null;
  let p_event = 0;

  if (hasBL) {
    variant = 'MLB_BASES_LOADED';
    p_event = probRunNextPA(state);
  } else if (has_risp && state.outs !== undefined) {
    variant = 'MLB_RISP';
    p_event = probRunNextPA(state);
  }

  const p_hr = probHRThisPA(state);
  if (p_hr >= 0.08 && (!variant || p_hr > p_event + 0.06)) {
    variant = 'MLB_HR_THREAT';
    p_event = p_hr;
  }

  const isLateClose = lateCloseWeight(state.half, state.score) >= 0.75;
  if (!variant && isLateClose) {
    variant = 'MLB_LATE_PRESSURE';
    p_event = probMultiRunHalfInning(state);
  }

  if (!variant) return null;

  const leverage = leverageScore(state, variant);
  const confidence = calibratedConfidence(p_event, state);
  const priority = priorityBucket(p_event, leverage, confidence);

  const aiText = composeMlbOneLiner(state, variant, p_event, leverage, confidence);
  const dedupeKey = `MLB:${state.gameId}:${variant}:${stateHash(state)}`;

  return { variant, p_event: round(p_event, 3), leverage: round(leverage, 3), confidence, priority, aiText, dedupeKey };
}

function composeMlbOneLiner(
  s: MLBState,
  variant: MLBAlertVariant,
  p: number,
  L: number,
  conf: number
): string {
  const inningTag = `${s.half.frame} ${s.half.inning}`;
  const risp = rispString(s.bases);
  const name = s.batter?.name;
  const wind = windOutComponent(s.weather);
  const windEmoji = wind > 0.25 ? '🌬️' : '';

  switch (variant) {
    case 'MLB_BASES_LOADED':
      return trim25(
        `⚾ Bases loaded, ${inningTag}! ${name ? name + ' up — ' : ''}run chance live (${Math.round(p*100)}%). ${windEmoji}`
      );
    case 'MLB_RISP':
      return trim25(
        `⚾ ${risp}, ${s.outs} out — ${inningTag}. ${name ? name + ' at bat. ' : ''}Pressure spot (${Math.round(p*100)}%).`
      );
    case 'MLB_FULL_COUNT_RISP':
      return trim25(
        `⚾ Full count with RISP — ${inningTag}. ${name ? name + ' ready. ' : ''}Edge ${conf}% 🔥`
      );
    case 'MLB_HR_THREAT':
      return trim25(
        `🚀 HR threat this at-bat — ${ inningTag }. ${name ? name + ' has pop. ' : ''}${windEmoji}Park/Wind boost. (${Math.round(p*100)}%)`
      );
    case 'MLB_LATE_PRESSURE':
      return trim25(
        `🏟️ Late pressure — ${inningTag}, close game. Big inning risk (${Math.round(p*100)}%), leverage ${Math.round(L*100)}%.`
      );
  }
}

function trim25(s: string) {
  const words = s.trim().split(/\s+/);
  if (words.length <= 25) return s.trim();
  return words.slice(0, 25).join(' ') + '…';
}
