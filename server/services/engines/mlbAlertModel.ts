// mlbAlertModel.ts
//
// This module implements a math‑driven scoring probability model for MLB and
// exposes convenience functions that map the model's severity into the
// existing Layered Alert levels (L1–L3).  It is intended to be imported
// by the sport logic engines so that the probability of scoring in the
// remainder of an inning can inform alert severity.

/**
 * Baseline probability of at least one run scoring in the remainder of the
 * inning for each base/out state.  Indexed by outs (0–2) then by a mask
 * that encodes which bases are occupied.  The mask uses bit 0 for 1B,
 * bit 1 for 2B, bit 2 for 3B.  These numbers are approximations for
 * contemporary MLB and can be tuned by season.
 */
const PROB_BASE: Record<0 | 1 | 2, Record<number, number>> = {
  0: {
    0: 0.29, // ---
    1: 0.41, // 1--
    2: 0.62, // -2-
    3: 0.66, // 12-
    4: 0.67, // --3
    5: 0.74, // 1-3
    6: 0.83, // -23
    7: 0.88, // 123
  },
  1: {
    0: 0.17,
    1: 0.26,
    2: 0.42,
    3: 0.48,
    4: 0.53,
    5: 0.58,
    6: 0.68,
    7: 0.73,
  },
  2: {
    0: 0.07,
    1: 0.11,
    2: 0.21,
    3: 0.19,
    4: 0.27,
    5: 0.24,
    6: 0.33,
    7: 0.34,
  },
};

// Interfaces describing the minimal game state required by the model.
export interface Bases {
  on1B: boolean;
  on2B: boolean;
  on3B: boolean;
}

export interface GameClock {
  inning: number;
  half: 'Top' | 'Bottom';
  outs: 0 | 1 | 2;
}

export interface Score {
  home: number;
  away: number;
}

export interface BatterLite {
  hrSeason?: number;
  sprintSpeed?: number;
  xwOBA?: number;
}

export interface PitcherLite {
  whip?: number;
  gbRate?: number;
  timesFacedOrder?: number;
}

export interface WeatherLite {
  windMph?: number;
  windToOutfield?: boolean;
  temperatureF?: number;
}

export interface ParkLite {
  hrFactor?: number;
  dome?: boolean;
}

// Minimal game state consumed by the scoring model.  Clients may embed
// this structure within richer objects.
export interface GameStateMLB {
  gameId: string;
  clock: GameClock;
  score: Score;
  bases: Bases;
  batter?: BatterLite;
  onDeck?: BatterLite;
  pitcher?: PitcherLite;
  weather?: WeatherLite;
  park?: ParkLite;
}

// LevelCheck mirrors the shape used by the overarching alert engine.  The
// `yes` flag determines whether this level should be considered true, and
// `priorityHint` can nudge the parent system's priority selection.
export interface LevelCheck {
  yes: boolean;
  reason?: string;
  priorityHint?: number;
}

// Result of the scoring probability model.  `p_base` is the baseline
// probability from the PROB_BASE table.  `p_adj` is the adjusted
// probability after modifiers.  `severity` is mapped into three bands
// (HIGH, MED, LOW) or NONE if below the minimum threshold.  `priority`
// suggests a corresponding alert priority.  `reason` lists the
// modifications that affected the adjustment.
export interface ScoringProbResult {
  p_base: number;
  p_adj: number;
  severity: 'HIGH' | 'MED' | 'LOW' | 'NONE';
  priority: number;
  reason: string[];
}

// Convert a Bases object into a mask used to index the PROB_BASE table.
function basesMask(b: Bases): number {
  return (b.on1B ? 1 : 0) | (b.on2B ? 2 : 0) | (b.on3B ? 4 : 0);
}

// Clamp a number into the [0, 0.95] range.  The upper cap avoids
// unrealistic 100% claims and helps dedup logic remain effective.
function clamp01(x: number): number {
  return Math.max(0, Math.min(0.95, x));
}

/**
 * Adjust the baseline probability using context modifiers.  Each
 * modifier adds or subtracts a small amount based on leverage
 * situations, power hitters, pitcher tendencies, weather, and park
 * factors.  Reasons are appended with human‑readable descriptions of
 * each adjustment.
 */
function applyModifiers(gs: GameStateMLB, p: number, reasons: string[]): number {
  const { clock, bases, batter, onDeck, pitcher, weather, park, score } = gs;
  const inning = clock.inning;
  const outs = clock.outs;

  // Late inning leverage: tie or one‑run game in the 7th inning or later.
  const diff = Math.abs(score.home - score.away);
  if (inning >= 7 && diff <= 1) {
    p += 0.04;
    reasons.push('late‑inning leverage +0.04');
  }

  // Runner on 3rd with less than two outs – high sac fly/wild pitch odds.
  if (bases.on3B && outs < 2) {
    p += 0.02;
    reasons.push('runner on 3B, <2 outs +0.02');
  }

  // Power hitter at bat or on deck.  More weight if runners are in scoring position.
  const hrNow = batter?.hrSeason ?? 0;
  const hrNext = onDeck?.hrSeason ?? 0;
  const risp = bases.on2B || bases.on3B;
  if (risp && hrNow >= 20) {
    p += 0.04;
    reasons.push('power bat (RISP) +0.04');
  } else if (!risp && hrNow >= 20) {
    p += 0.02;
    reasons.push('power bat (no RISP) +0.02');
  }
  if (risp && hrNext >= 20) {
    p += 0.02;
    reasons.push('power on‑deck +0.02');
  }

  // Pitcher risk factors.  High WHIP or facing lineup the third time.
  if ((pitcher?.whip ?? 0) >= 1.35) {
    p += 0.02;
    reasons.push('high WHIP pitcher +0.02');
  }
  if ((pitcher?.timesFacedOrder ?? 1) >= 3) {
    p += 0.02;
    reasons.push('third time through order +0.02');
  }

  // Ground ball double‑play dampener: runner on first, less than two outs,
  // pitcher has high ground ball rate, and batter is slow.  Subtract.
  const gbHigh = (pitcher?.gbRate ?? 0) >= 0.50;
  const slowRunner = (batter?.sprintSpeed ?? 0) > 0 ? (batter!.sprintSpeed! < 27) : false;
  if (bases.on1B && outs < 2 && gbHigh && slowRunner) {
    p -= 0.03;
    reasons.push('GB double play risk ‑0.03');
  }

  // Weather adjustments (skip if domed stadium).  Wind blowing out and heat both
  // bump scoring odds slightly.
  if (!(park?.dome)) {
    if ((weather?.windMph ?? 0) >= 10 && weather?.windToOutfield) {
      p += 0.03;
      reasons.push('wind out ≥10 mph +0.03');
    }
    if ((weather?.temperatureF ?? 0) >= 90) {
      p += 0.01;
      reasons.push('hot ≥90 °F +0.01');
    }
  }

  // Park factor bump for home run friendly parks.
  if ((park?.hrFactor ?? 1) > 1.05) {
    p += 0.01;
    reasons.push('HR‑friendly park +0.01');
  }
  return clamp01(p);
}

/**
 * Compute the adjusted probability of scoring in the remainder of the inning
 * and classify it into one of four severities: NONE (<0.65), LOW
 * (0.65–0.699…), MED (0.70–0.799…), or HIGH (≥0.80).  Also returns
 * a suggested priority for downstream alerting and a list of reasons.
 */
export function calcMLBScoringAlert(gs: GameStateMLB): ScoringProbResult {
  const mask = basesMask(gs.bases) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const p_base = PROB_BASE[gs.clock.outs][mask] ?? 0;
  const reasons: string[] = [`base/out baseline ${p_base.toFixed(2)}`];
  const p_adj = applyModifiers(gs, p_base, reasons);
  let severity: ScoringProbResult['severity'] = 'NONE';
  let priority = 60;
  if (p_adj >= 0.80) {
    severity = 'HIGH';
    priority = 95;
  } else if (p_adj >= 0.70) {
    severity = 'MED';
    priority = 85;
  } else if (p_adj >= 0.65) {
    severity = 'LOW';
    priority = 75;
  }
  return { p_base, p_adj, severity, priority, reason: reasons };
}

/**
 * Derive a Level 1 check from the scoring model.  Any adjusted
 * probability at or above 0.65 counts as a positive L1.  A short
 * reason summarises the severity and probability.  This function can
 * replace or augment the existing mlbL1 implementation.  Clients should
 * ensure that higher levels (L2 and L3) still incorporate their own
 * triggers or defer to the scoring model via the sister functions
 * defined below.
 */
export function mlbL1WithProb(gs: GameStateMLB): LevelCheck {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'LOW' || r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

/**
 * Derive a Level 2 check from the scoring model.  Only medium or
 * high probability (≥0.70) passes.  This can be used to overlay the
 * math‑driven severity onto other L2 triggers, such as power hitter
 * on deck.  If the math does not meet the L2 threshold, callers can
 * fall back to their traditional L2 logic.
 */
export function mlbL2WithProb(gs: GameStateMLB): LevelCheck {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

/**
 * Derive a Level 3 check from the scoring model.  Only a high
 * probability (≥0.80) passes.  This can be used in place of or in
 * combination with weather/environmental triggers to elevate alerts
 * when the math indicates an extreme scoring likelihood.
 */
export function mlbL3WithProb(gs: GameStateMLB): LevelCheck {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

// End of mlbAlertModel.ts