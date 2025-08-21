// server/services/batter-power.ts
import { assertRealBatter, BatterProfile } from "./provenance";

export type BatterPower = "low" | "avg" | "high" | null;

/**
 * Compute power tier ONLY from trusted MLB data.
 * If data isn't present/valid, return null (caller must handle).
 */
export function powerTierFrom(profile: BatterProfile | null | undefined): BatterPower {
  const stats = assertRealBatter(profile, {
    maxAgeMs: 12 * 60 * 60 * 1000,                 // 12 hours
    requireFields: ["seasonHr"],                   // minimum
  });
  if (!stats) return null;

  const hr = Number(stats.seasonHr ?? 0);
  if (hr >= 25) return "high";
  if (hr >= 12) return "avg";
  return "low";
}

/**
 * Check if batter has high average (300+) from real data only
 */
export function isHighAvgBatter(profile: BatterProfile | null | undefined): boolean {
  const stats = assertRealBatter(profile, {
    maxAgeMs: 12 * 60 * 60 * 1000,
    requireFields: ["seasonAvg"],
  });
  if (!stats) return false;
  
  const avg = Number(stats.seasonAvg ?? 0);
  return avg >= 0.300;
}

/**
 * Check if batter has high OPS from real data only  
 */
export function isEliteBatter(profile: BatterProfile | null | undefined): boolean {
  const stats = assertRealBatter(profile, {
    maxAgeMs: 12 * 60 * 60 * 1000,
    requireFields: ["seasonOps"],
  });
  if (!stats) return false;
  
  const ops = Number(stats.seasonOps ?? 0);
  return ops >= 0.850;
}

/**
 * Check if batter is RBI machine from real data only
 */
export function isRbiMachine(profile: BatterProfile | null | undefined): boolean {
  const stats = assertRealBatter(profile, {
    maxAgeMs: 12 * 60 * 60 * 1000,
    requireFields: ["seasonRbi"],
  });
  if (!stats) return false;
  
  const rbi = Number(stats.seasonRbi ?? 0);
  return rbi >= 80;
}