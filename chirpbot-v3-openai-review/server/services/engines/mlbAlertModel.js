// mlbAlertModel.js
//
// A JavaScript port of mlbAlertModel.ts so that environments that do
// not support TypeScript natively (e.g. Replit without ts-node) can
// consume the scoring probability model directly.  The logic is
// identical to the TypeScript version, but type annotations have been
// stripped and it uses CommonJS exports.

// Baseline probability of at least one run scoring in the remainder of
// the inning for each base/out state.  Keys are outs (0–2) and the
// base mask (0–7).  Values are approximate probabilities based on
// modern MLB data.
const PROB_BASE = {
  0: { 0: 0.29, 1: 0.41, 2: 0.62, 3: 0.66, 4: 0.67, 5: 0.74, 6: 0.83, 7: 0.88 },
  1: { 0: 0.17, 1: 0.26, 2: 0.42, 3: 0.48, 4: 0.53, 5: 0.58, 6: 0.68, 7: 0.73 },
  2: { 0: 0.07, 1: 0.11, 2: 0.21, 3: 0.19, 4: 0.27, 5: 0.24, 6: 0.33, 7: 0.34 }
};

// Convert a bases object into a numeric mask for indexing PROB_BASE.
function basesMask(bases) {
  return (bases.on1B ? 1 : 0) | (bases.on2B ? 2 : 0) | (bases.on3B ? 4 : 0);
}

// Clamp probability between 0 and 0.95.
function clamp01(x) {
  return Math.max(0, Math.min(0.95, x));
}

// Apply situational modifiers to the base probability.  Returns the
// adjusted probability and appends human‑readable reasons to the
// provided array.
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
 *
 * @param {Object} gs Game state.  See README for fields.
 * @returns {Object} { p_base, p_adj, severity, priority, reason }.
 */
function calcMLBScoringAlert(gs) {
  const mask = basesMask(gs.bases);
  const outs = gs.clock.outs;
  const p_base = (PROB_BASE[outs] && PROB_BASE[outs][mask]) || 0;
  const reasons = [`base/out baseline ${p_base.toFixed(2)}`];
  const p_adj = applyModifiers(gs, p_base, reasons);
  let severity = 'NONE';
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

// L1 check: any probability above 0.65 counts.  Returns { yes, reason, priorityHint }.
function mlbL1WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'LOW' || r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

// L2 check: medium or high probability only.
function mlbL2WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'MED' || r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

// L3 check: high probability only.
function mlbL3WithProb(gs) {
  const r = calcMLBScoringAlert(gs);
  if (r.severity === 'HIGH') {
    const msg = `Scoring prob ${(r.p_adj * 100).toFixed(0)}% (${r.severity})`;
    return { yes: true, reason: msg, priorityHint: r.priority };
  }
  return { yes: false };
}

// Export functions for CommonJS consumers.
module.exports = {
  calcMLBScoringAlert: calcMLBScoringAlert,
  mlbL1WithProb: mlbL1WithProb,
  mlbL2WithProb: mlbL2WithProb,
  mlbL3WithProb: mlbL3WithProb
};