// server/services/provenance.ts
// Single source of truth for "real vs synthetic" data checks.

export type Provenance =
  | "mlb_api_live"      // live /feed/live
  | "mlb_api_box"       // /linescore, /boxscore
  | "mlb_api_cached"    // your persisted copy of MLB API
  | "user_uploaded"     // user-supplied (never use for batter stats)
  | "synthetic"         // fixtures, demos, simulators (NEVER ALLOWED)
  | "unknown";

export interface Provenanced<T> {
  data: T;
  source: Provenance;
  fetchedAt: number;     // epoch ms
  signature?: string;    // optional hash of payload for audit
}

export interface BatterStats {
  id: number;
  name: string;
  batSide: string;
  seasonHr?: number | null;
  seasonOps?: number | null;
  seasonAvg?: number | null;
  seasonRbi?: number | null;
  // add other real fields you use
}

export interface BatterProfile extends Provenanced<BatterStats> {}

export interface ValidationOptions {
  maxAgeMs: number;                 // freshness window (e.g., 12h)
  requireFields?: (keyof BatterStats)[]; // fields that must exist to use
}

// Runtime switch to absolutely forbid synthetic anywhere
export const NO_SYNTHETIC = process.env.NO_SYNTHETIC === "1" || process.env.NODE_ENV === "production";

export function isTrustedSource(p: Provenance): boolean {
  return p === "mlb_api_live" || p === "mlb_api_box" || p === "mlb_api_cached";
}

export function assertRealBatter(
  profile: BatterProfile | null | undefined,
  opts: ValidationOptions
): BatterStats | null {
  if (!profile) return null;

  const { source, fetchedAt, data } = profile;

  // 1) Never allow synthetic/user/unknown
  if (NO_SYNTHETIC && (!isTrustedSource(source))) {
    // hard fail closed — do not use
    console.log(`🚫 Rejecting batter data from untrusted source: ${source}`);
    return null;
  }

  if (!isTrustedSource(source)) {
    // Even if NO_SYNTHETIC=0, don't use for batter stats
    console.log(`⚠️ Skipping batter data from non-MLB source: ${source}`);
    return null;
  }

  // 2) Freshness
  const age = Date.now() - (fetchedAt || 0);
  if (age < 0 || age > opts.maxAgeMs) {
    console.log(`⏰ Rejecting stale batter data (age: ${age}ms, max: ${opts.maxAgeMs}ms)`);
    return null;
  }

  // 3) Completeness
  if (opts.requireFields?.length) {
    for (const k of opts.requireFields) {
      const v = (data as any)[k];
      if (v === undefined || v === null) {
        console.log(`❌ Missing required field '${k}' in batter data`);
        return null;
      }
    }
  }

  console.log(`✅ Validated real batter data: ${data.name} from ${source}`);
  return data;
}