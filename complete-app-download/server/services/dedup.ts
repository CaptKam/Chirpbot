// server/services/dedup.ts
// Lightweight, zero‑delay dedup for real‑time alerts.
// - One alert per unique "situation fingerprint" (no global cooldown).
// - Optional short per-type cooldowns for noisy categories (e.g., weather).
// - Auto-eviction to keep memory small for long-running processes.

type HalfInning = "top" | "bottom";
type WindBucket = "neutral" | "out" | "in" | "cross";

export interface Runners {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface FrameLike {
  gamePk: string | number;
  inning: number;
  half: HalfInning;
  outs: number;
  runners: Runners;
  batterId?: number | null;
  onDeckId?: number | null;
  windDir?: WindBucket | null; // bucketized; see bucketWind()
}

export interface DedupOptions {
  /** Namespace to separate versions/environments (e.g., "legacy" vs "advanced") */
  namespace?: string;
  /** Default TTL for a situation lifecycle (ms). After TTL, fingerprint may fire again (safety). Default: 10 minutes */
  lifecycleTtlMs?: number;
  /** Per-type cooldowns (ms) for noisy categories (weather, win-prob shifts, etc.) */
  perTypeCooldownMs?: Record<string, number>;
  /** Max entries before LRU-like soft evict */
  maxEntries?: number;
  /** Eviction sweep interval (ms). Default: 60s */
  sweepIntervalMs?: number;
}

type Entry = { at: number };

export class Deduper {
  private namespace: string;
  private lifecycleTtl: number;
  private cooldowns: Record<string, number>;
  private maxEntries: number;
  private store = new Map<string, Entry>(); // key -> timestamp
  private sweepTimer: NodeJS.Timeout;

  constructor(opts?: DedupOptions) {
    this.namespace = opts?.namespace ?? "default";
    this.lifecycleTtl = opts?.lifecycleTtlMs ?? 10 * 60 * 1000; // 10m
    this.cooldowns = opts?.perTypeCooldownMs ?? {};
    this.maxEntries = opts?.maxEntries ?? 20_000;

    const sweepEvery = opts?.sweepIntervalMs ?? 60_000;
    this.sweepTimer = setInterval(() => this.sweep(), sweepEvery).unref?.();
  }

  /** Build a stable runners key like "1-0-1" (1B & 3B occupied) */
  static runnersKey(r: Runners) {
    return `${r.first ? 1 : 0}-${r.second ? 1 : 0}-${r.third ? 1 : 0}`;
  }

  /** Optional: Bucketize wind to avoid spam on tiny changes */
  static bucketWind(dir?: string | null, mph?: number | null): WindBucket {
    if (!dir || !mph) return "neutral";
    if (mph < 6) return "neutral";
    const d = dir.toLowerCase();
    if (d.includes("out")) return "out";
    if (d.includes("in")) return "in";
    return "cross";
  }

  /** Generate a situation fingerprint (the heart of dedup) */
  fingerprint(alertType: string, f: FrameLike): string {
    const key = {
      ns: this.namespace,
      a: alertType,              // alert kind (e.g., "Level 3 • R2+R3 + Wind OUT")
      g: f.gamePk,               // game id
      i: f.inning,               // inning number
      h: f.half,                 // top/bottom
      o: f.outs,                 // outs
      r: Deduper.runnersKey(f.runners),
      b: f.batterId ?? null,     // stabilize per-PA
      d: f.onDeckId ?? null,     // include if your logic uses on-deck
      w: f.windDir ?? "neutral", // wind bucket
    };
    // Stable, compact JSON:
    return JSON.stringify(key);
  }

  /** True if this fingerprint has not been sent recently (no duplicate). */
  shouldEmitFingerprint(fingerprint: string, type?: string): boolean {
    const now = Date.now();
    const lifekey = `L:${fingerprint}`;                 // lifecycle guard
    const cooldownKey = type ? `C:${type}:${fingerprint}` : null; // per-type cooldown

    // Per-type cooldown (only for noisy categories)
    if (cooldownKey && this.cooldowns[type!]) {
      const last = this.store.get(cooldownKey)?.at ?? 0;
      if (now - last < this.cooldowns[type!]) {
        return false; // still cooling
      }
      this.store.set(cooldownKey, { at: now });
    }

    // Situation lifecycle: allow only once per unique situation
    const lastLife = this.store.get(lifekey)?.at ?? 0;
    if (now - lastLife < this.lifecycleTtl) {
      return false; // already active in lifecycle
    }

    // Record lifecycle start
    this.store.set(lifekey, { at: now });

    // Soft capacity control
    if (this.store.size > this.maxEntries) this.softEvict();

    return true;
  }

  /** Convenience: compute fingerprint from frame + type and test */
  shouldEmit(alertType: string, frame: FrameLike, typeForCooldown?: string): boolean {
    return this.shouldEmitFingerprint(this.fingerprint(alertType, frame), typeForCooldown);
  }

  /** Manually clear a fingerprint (e.g., on game reset) */
  clearFingerprint(fingerprint: string) {
    this.store.delete(`L:${fingerprint}`);
  }

  /** Clear everything (e.g., on server restart signal) */
  reset() {
    this.store.clear();
  }

  /** Evict old entries (lifecycle TTL applies to L: keys; cooldown keys use max type cooldown) */
  private sweep() {
    const now = Date.now();
    const maxCooldown = Math.max(0, ...Object.values(this.cooldowns), 30_000); // default 30s
    for (const [k, v] of Array.from(this.store.entries())) {
      if (k.startsWith("L:")) {
        if (now - v.at > this.lifecycleTtl) this.store.delete(k);
      } else if (k.startsWith("C:")) {
        if (now - v.at > maxCooldown) this.store.delete(k);
      }
    }
  }

  /** Remove ~10% oldest keys if capacity exceeded */
  private softEvict() {
    const target = Math.floor(this.maxEntries * 0.9);
    const arr = Array.from(this.store.entries()).sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < Math.max(0, this.store.size - target); i++) {
      this.store.delete(arr[i][0]);
    }
  }
}