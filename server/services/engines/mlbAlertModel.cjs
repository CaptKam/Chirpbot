// mlbAlertModel.js
//
// A comprehensive MLB scoring probability model with tiered alert checks.
// This module provides functions to estimate the probability of at least one run
// scoring in the remainder of an inning based on base/out state and
// situational modifiers.  It also includes tiered alert checks (L1, L2, L3)
// to determine when an alert should be raised and the corresponding priority.

// Baseline probability of at least one run scoring in the remainder of
// the inning for each base/out state.  Keys are outs (0–2) and the
// base mask (0–7).  Values are adjusted to target 70% scoring probability.
const PROB_BASE = {
  0: { 0: 0.70, 1: 0.75, 2: 0.80, 3: 0.82, 4: 0.83, 5: 0.85, 6: 0.88, 7: 0.92 },
  1: { 0: 0.65, 1: 0.70, 2: 0.75, 3: 0.78, 4: 0.80, 5: 0.82, 6: 0.85, 7: 0.88 },
  2: { 0: 0.60, 1: 0.65, 2: 0.70, 3: 0.72, 4: 0.75, 5: 0.77, 6: 0.80, 7: 0.83 }
};

/**
 * Convert a bases object into a numeric mask for indexing PROB_BASE.
 * The mask is a bitmask where the least significant bit corresponds to
 * first base, the second bit to second base, and the third bit to third base.
 *
 * @param {Object} bases Object with boolean on1B/on2B/on3B properties.
 * @returns {number} Numeric mask representing which bases are occupied.
 */
function basesMask(bases) {
  return (bases.on1B ? 1 : 0) | (bases.on2B ? 2 : 0) | (bases.on3B ? 4 : 0);
}

/**
 * Clamp a probability value between 0 and 0.95 to avoid unrealistic extremes.
 *
 * @param {number} x Probability value.
 * @returns {number} Clamped probability.
 */
function clamp01(x) {
  return Math.max(0, Math.min(0.95, x));
}

/**
 * Apply situational modifiers to the base probability.  Factors include
 * late inning leverage, runners in scoring position, power hitters, pitcher
 * fatigue, ground ball double play risk, weather, and park factors.
 *
 * @param {Object} gs Game state.
 * @param {number} p Base probability.
 * @param {string[]} reasons Array to append human‑readable reasons.
 * @returns {number} Adjusted probability.
 */
function applyModifiers(gs, p, reasons) {
  const { clock, bases, batter, onDeck, pitcher, weather, park, score } = gs;
  const inning = clock.inning;
  const outs = clock.outs;

  // Late inning leverage: tie or one‑run game in 7th inning or later.
  const diff = Math.abs(score.home - score.away);
  if (inning >= 7 && diff <= 1) {
    p += 0.04;
    reasons.push('late‑inning leverage +0.04');
  }

  // Runner on 3rd with <2 outs.
  if (bases.on3B && outs < 2) {
    p += 0.02;
    reasons.push('runner on 3B, <2 outs +0.02');
  }

  // Power hitters: on deck or at bat, with extra weight if RISP.
  const hrNow = (batter && batter.hrSeason) ? batter.hrSeason : 0;
  const hrNext = (onDeck && onDeck.hrSeason) ? onDeck.hrSeason : 0;
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

  // Pitcher risk: high WHIP or third time through the order.
  if (pitcher && pitcher.whip >= 1.35) {
    p += 0.02;
    reasons.push('high WHIP pitcher +0.02');
  }
  if (pitcher && pitcher.timesFacedOrder >= 3) {
    p += 0.02;
    reasons.push('third time through order +0.02');
  }

  // Ground ball double play dampener.
  const gbHigh = pitcher && pitcher.gbRate >= 0.50;
  const slowRunner = batter && typeof batter.sprintSpeed === 'number' ? batter.sprintSpeed < 27 : false;
  if (bases.on1B && outs < 2 && gbHigh && slowRunner) {
    p -= 0.03;
    reasons.push('GB double play risk ‑0.03');
  }

  // Weather adjustments (skip domes).
  if (!(park && park.dome)) {
    if (weather && weather.windMph >= 10 && weather.windToOutfield) {
      p += 0.03;
      reasons.push('wind out ≥10 mph +0.03');
    }
    if (weather && weather.temperatureF >= 90) {
      p += 0.01;
      reasons.push('hot ≥90 °F +0.01');
    }
  }
  // Park factor.
  if (park && park.hrFactor && park.hrFactor > 1.05) {
    p += 0.01;
    reasons.push('HR‑friendly park +0.01');
  }
  return clamp01(p);
}

/**
 * Compute the scoring probability and classify it into severity bands.
 * The severity bands map to alert tiers (LOW, MED, HIGH) and suggest
 * a priority score.  A severity of 'NONE' indicates no alert should fire.
 *
 * @param {Object} gs Game state.  See README for field definitions.
 * @returns {Object} { p_base, p_adj, severity, priority, reasons }.
 */
function calcMLBScoringAlert(gs) {
  const mask = basesMask(gs.bases);
  const outs = gs.clock.outs;
  const p_base = (PROB_BASE[outs] && PROB_BASE[outs][mask]) || 0;
  const reasons = [`base/out baseline ${p_base.toFixed(2)}`];
  const p_adj = applyModifiers(gs, p_base, reasons);
  let severity = 'NONE';
  let priority = 60;
  if (p_adj >= 0.70) {
    severity = 'HIGH';
    priority = 95;
  } else if (p_adj >= 0.50) {
    severity = 'MED';
    priority = 85;
  } else if (p_adj >= 0.25) {
    severity = 'LOW';
    priority = 75;
  }
  return { p_base, p_adj, severity, priority, reasons };
}

/**
 * Simple check for scoring situations using the tier system.
 * Returns an object indicating whether an alert should fire,
 * the reasons for the alert, the suggested priority, and the severity.
 *
 * @param {Object} gs Game state.
 * @returns {Object} { shouldAlert, reasons, priority, probability, severity }.
 */
function checkScoringProbability(gs) {
  const result = calcMLBScoringAlert(gs);
  return {
    shouldAlert: result.severity !== 'NONE',
    reasons: result.reasons,
    priority: result.priority,
    probability: result.p_adj,
    severity: result.severity
  };
}

/**
 * L1 check: any probability above 0.65 qualifies as a low‑tier alert.
 * Returns an object indicating whether the condition is met,
 * a human‑readable reason, and a priority hint.
 *
 * @param {Object} gs Game state.
 * @returns {Object} { yes, reason, priorityHint }.
 */
function mlbL1WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'LOW' || r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

/**
 * L2 check: medium or high probability only.
 * Indicates a higher‑tier alert and returns a similar structure to L1.
 *
 * @param {Object} gs Game state.
 * @returns {Object} { yes, reason, priorityHint }.
 */
function mlbL2WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

/**
 * L3 check: high probability only.
 * Indicates the highest tier of alert (e.g. near‑certain scoring opportunity).
 *
 * @param {Object} gs Game state.
 * @returns {Object} { yes, reason, priorityHint }.
 */
function mlbL3WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

// Export functions for CommonJS consumers.  Note that these functions
// are intentionally exported using CommonJS semantics so that both
// TypeScript (via require) and plain JavaScript environments can
// consume them without transpilation.
module.exports = {
  calcMLBScoringAlert: calcMLBScoringAlert,
  checkScoringProbability: checkScoringProbability,
  mlbL1WithProb: mlbL1WithProb,
  mlbL2WithProb: mlbL2WithProb,
  mlbL3WithProb: mlbL3WithProb
};