// server/services/engines/power-hitter.ts
export type Hand = "L" | "R" | "S" | "U";

export type BatterStats = {
  id: number;
  name: string;
  handedness: Hand;
  // season batting
  seasonHR?: number;     // total HR this season
  seasonPA?: number;     // plate appearances (fallback to AB)
  ISO?: number;
  SLG?: number;
  // recent window (optional)
  recentHR?: number;
  recentPA?: number;
};

export type PitcherStats = {
  id: number;
  handedness: Hand;
  hrPer9?: number;     // HR/9 allowed (season)
  tbf?: number;        // total batters faced (season)
  hrPerPA?: number;    // direct if available
};

export type Context = {
  parkHrFactor?: number;          // ~1.00 (0.8..1.25 clamp)
  windMph?: number;               // optional; if absent, multiplier=1
  // If you later add stadium CF azimuth + wind direction in degrees,
  // switch wind multiplier to a proper vector projection.
  inning: number;
  half: "top" | "bottom";
  outs: number;
  risp: boolean;
  scoreDiffAbs: number;
};

const P0 = 0.036; // league HR/PA baseline

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function shrink(observed: number, n: number, prior = P0, strength = 100) {
  return (n * observed + strength * prior) / (n + strength);
}

function parkMult(parkHrFactor?: number) {
  return clamp(parkHrFactor ?? 1.0, 0.80, 1.25);
}

function platoonMult(bh: Hand, ph: Hand) {
  const adv = (bh === "R" && ph === "L") || (bh === "L" && ph === "R") || bh === "S";
  return adv ? 1.10 : 0.92;
}

function pitcherMult(p: PitcherStats) {
  const hrpa = p.hrPerPA ?? ((p.hrPer9 ?? 1.2) / 27);
  const tbf = p.tbf ?? 400;
  const stab = shrink(hrpa, tbf, P0, 200);
  return clamp(stab / P0, 0.85, 1.25);
}

// Simple, conservative wind multiplier when you only know speed (no direction)
function windMultFromSpeedOnly(mph?: number) {
  if (!mph || mph < 6) return 1;           // ignore light wind
  const bump = Math.min(0.12, (mph - 5) * 0.01); // +1% per mph over 5, cap +12%
  return 1 + bump;
}

export function estimateHRProbability(
  batter: BatterStats,
  pitcher: PitcherStats,
  ctx: Context
) {
  const seasonPA = Math.max(1, batter.seasonPA ?? 0);
  const seasonHRPA = (batter.seasonHR ?? 0) / seasonPA;

  const recentPA = Math.max(1, batter.recentPA ?? 0);
  const recentHRPA = (batter.recentHR ?? 0) / recentPA;

  const bSeason = shrink(seasonHRPA, seasonPA, P0, 400);
  const bRecent = shrink(recentHRPA, batter.recentPA ?? 0, P0, 100);
  const batterProp = 0.6 * bSeason + 0.4 * bRecent;

  const mult =
    platoonMult(batter.handedness, pitcher.handedness) *
    parkMult(ctx.parkHrFactor) *
    pitcherMult(pitcher) *
    windMultFromSpeedOnly(ctx.windMph);

  return clamp(batterProp * mult, 0.005, 0.50);
}

export type PowerTier = "A" | "B" | "C" | null;
export function classifyTier(p: number): PowerTier {
  if (p >= 0.045) return "A";
  if (p >= 0.030) return "B";
  if (p >= 0.018) return "C";
  return null;
}