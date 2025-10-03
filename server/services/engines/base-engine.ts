/**
 * V3.1 Improvements
 * - Stronger typing + safer fallbacks
 * - Dynamic import with multi-extension resolution (.ts/.js/.mjs) and exponential backoff
 * - Optional, context-aware dedup helpers on BaseAlertModule (uses unifiedDeduplicator when available; no-op fallback)
 * - Standardized probability clamping, message composition helpers
 * - Resilient alert processing: per-module try/catch, per-game verbose logging guard
 * - Engine module initialization supports de-duped inputs and logs summarized outcomes
 * - Available alert types discovery supports compiled outputs and TS sources
 */

import type { AlertResult } from '../../../shared/schema';

// Re-export for backward compatibility
export type { AlertResult };

export interface GameState {
  gameId: string;
  sport: string;
  homeTeam: string | { name?: string; abbreviation?: string; shortName?: string; displayName?: string };
  awayTeam: string | { name?: string; abbreviation?: string; shortName?: string; displayName?: string };
  homeScore: number;
  awayScore: number;
  status: string;     // 'scheduled' | 'live' | 'final' | ...
  isLive: boolean;
  [key: string]: unknown; // Allow sport-specific fields
}

// ---- Base class for alert cylinders -------------------------------------------------

export abstract class BaseAlertModule {
  abstract alertType: string;
  abstract sport: string;

  /** Cheap boolean trigger check */
  abstract isTriggered(gameState: GameState): boolean;

  /** Create an AlertResult when triggered (return null to skip) */
  abstract generateAlert(gameState: GameState): AlertResult | null | Promise<AlertResult | null>;

  /** Numeric probability 0..100 (used by pre-AI thresholding) */
  abstract calculateProbability(gameState: GameState): number;

  /** Optional per-alert minimum confidence gate (0..100). Engines may use this. */
  minConfidence?: number;

  /** Optional recommended dedupe TTL (ms) per alert instance. */
  dedupeWindowMs?: number;

  // ---- Helpers -------------------------------------------------------------

  /** Clamp probability into [0, 100] and round to integer */
  protected clampProb(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const v = Math.max(0, Math.min(100, value));
    return Math.round(v);
  }

  /** Consistent team name extraction for string/object formats */
  protected getTeamName(team: unknown): string {
    if (!team) return 'Team';
    if (typeof team === 'string') return team;
    if (typeof team === 'object') {
      const t = team as Record<string, unknown>;
      return (
        (t.name as string) ||
        (t.abbreviation as string) ||
        (t.displayName as string) ||
        (t.shortName as string) ||
        'Team'
      );
    }
    return 'Team';
  }

  /** Optional human text builder with safe defaults */
  protected composeMessage(parts: Array<string | undefined | null>): string {
    return parts.filter(Boolean).join(' • ');
  }

  /**
   * Try dedupe for this alert instance. Uses unifiedDeduplicator if present; falls back to
   * a lightweight in-memory TTL map so modules can call this safely without a hard dependency.
   */
  protected tryDedupe(key: string, ttlMs = this.dedupeWindowMs ?? 15_000): boolean {
    // Attempt to use global unifiedDeduplicator if available on node globalThis
    const g = globalThis as unknown as { unifiedDeduplicator?: { /* shape we care about */ } & Record<string, any> };
    const deduper = g?.unifiedDeduplicator as any;

    // If unifiedDeduplicator exposes a request ledger-like API, prefer it
    if (deduper && typeof deduper.getStats === 'function') {
      // Reuse request cache map semantics for a tiny TTL ledger
      // We’ll store as an alert in its own internal map via shouldSendAlert-like flow when possible
      if (typeof deduper.shouldSendAlert === 'function') {
        // Minimal payload – type + gameId + timestamp are enough for coarse dedupe
        const ok = !!deduper.shouldSendAlert({ gameId: key.split(':')[0] ?? 'unknown', type: key, timestamp: Date.now() }, 'plate-appearance');
        return ok;
      }
    }

    // Fallback: lightweight in-memory TTL
    return LocalDedupeLedger.touch(key, ttlMs);
  }
}

/** Local fallback TTL ledger (module-level, process-local) */
class LocalDedupeLedger {
  private static map = new Map<string, number>();
  static touch(key: string, ttlMs: number): boolean {
    const now = Date.now();
    const last = this.map.get(key) ?? 0;
    if (now - last < ttlMs) return false;
    this.map.set(key, now);
    // Soft prune sporadically
    if (this.map.size > 5000) {
      const entries = Array.from(this.map.entries()).sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < 1000; i++) this.map.delete(entries[i][0]);
    }
    return true;
  }
}

// ---- Alert module manager (per sport) --------------------------------------

export class AlertModuleManager {
  private activeModules: Map<string, BaseAlertModule> = new Map();
  private sport: string;

  constructor(sport: string) {
    this.sport = sport;
  }

  /** Resolve module file path for a given alert type, checking multiple extensions */
  private async resolveModulePath(basePath: string): Promise<string> {
    const fs = await import('fs');
    const candidates = [
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.mjs`,
      `${basePath}.cjs`,
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    // If nothing exists, return the TS default (so bundlers may still resolve)
    return `${basePath}.ts`;
  }

  // Dynamically load alert module with retry capability (backoff)
  async loadAlertModule(alertType: string, retryCount: number = 0): Promise<boolean> {
    if (this.activeModules.has(alertType)) return true;

    const maxRetries = 3;
    const retryDelay = Math.min(120_000, 1000 * Math.pow(2, retryCount)); // 1s, 2s, 4s caps later
    try {
      const baseName = alertType
        .toLowerCase()
        .replace(`${this.sport.toLowerCase()}_`, '')
        .replace(/_/g, '-');

      const basePath = `./alert-cylinders/${this.sport.toLowerCase()}/${baseName}-module`;
      const modulePath = await this.resolveModulePath(basePath);

      const imported = await import(modulePath);
      const AlertModule = (imported.default ?? imported[Object.keys(imported)[0]]) as new () => BaseAlertModule;
      const instance = new AlertModule();

      // Guard: ensure sport matches (helps catch mis-wired modules)
      if (instance.sport && instance.sport.toUpperCase() !== this.sport.toUpperCase()) {
        console.warn(`⚠️ Module sport mismatch for ${alertType}: got ${instance.sport}, expected ${this.sport}`);
      }

      this.activeModules.set(alertType, instance);
      console.log(`✅ Loaded ${alertType} module for ${this.sport}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load ${alertType} module for ${this.sport}:`, error);
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying ${alertType} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryDelay));
        return this.loadAlertModule(alertType, retryCount + 1);
      }
      console.error(`❌ ${alertType} module failed after ${maxRetries} attempts`);
      return false;
    }
  }

  // Unload alert module when user disables it
  unloadAlertModule(alertType: string): void {
    if (this.activeModules.delete(alertType)) {
      console.log(`🗑️ Unloaded ${alertType} for ${this.sport}`);
    }
  }

  unloadAll(): void {
    this.activeModules.clear();
  }

  // Process all active modules for this game state with resilience
  async processAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const failed: string[] = [];

    for (const [alertType, module] of this.activeModules) {
      try {
        if (!gameState?.isLive) continue; // cheap guard; engines may decide differently
        if (!module.isTriggered(gameState)) continue;

        const alertOrPromise = module.generateAlert(gameState);
        const alert = await Promise.resolve(alertOrPromise);
        if (alert) alerts.push(alert);
      } catch (err) {
        console.error(`❌ Error in ${alertType} module:`, err);
        failed.push(alertType);
      }
    }

    if (failed.length) {
      console.log(`⚠️ ${failed.length} modules failed; emitted ${alerts.length} alerts for ${gameState.gameId}`);
    }
    return alerts;
  }

  // Get list of currently active alert types
  getActiveAlertTypes(): string[] {
    return Array.from(this.activeModules.keys());
  }
}

// ---- Base engine ------------------------------------------------------------

export abstract class BaseSportEngine {
  protected sport: string;
  protected alertModules: Map<string, BaseAlertModule> = new Map();

  constructor(sport: string) {
    this.sport = sport;
  }

  /** Engines can provide a combined model probability if needed */
  abstract calculateProbability(gameState: GameState): Promise<number>;

  // Generate live alerts using loaded modules with resilience
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const failed: string[] = [];

    const moduleCount = this.alertModules.size;
    console.log(`🔍 Generating alerts for ${gameState.gameId} (${this.sport}) with ${moduleCount} modules`);

    for (const [alertType, module] of this.alertModules) {
      try {
        if (!gameState?.isLive) {
          // Avoid noise in logs for scheduled/final states
          continue;
        }

        if (module.isTriggered(gameState)) {
          const alert = module.generateAlert(gameState);
          if (alert) {
            alerts.push(alert);
          }
        }
      } catch (error) {
        console.error(`❌ Error generating ${alertType} alert:`, error);
        failed.push(alertType);
      }
    }

    if (failed.length) {
      console.log(`⚠️ ${failed.length} modules failed; generated ${alerts.length} alerts for ${gameState.gameId}`);
    } else {
      console.log(`📊 Generated ${alerts.length} alerts for ${gameState.gameId}`);
    }

    return alerts;
  }

  // Load alert modules dynamically from sport-specific cylinders
  async loadAlertModule(alertType: string): Promise<BaseAlertModule | null> {
    try {
      // Convert alert type to module filename (e.g., MLB_GAME_START -> game-start-module)
      const baseName = alertType
        .toLowerCase()
        .replace(`${this.sport.toLowerCase()}_`, '') // Remove sport prefix
        .replace(/_/g, '-');

      const basePath = `./alert-cylinders/${this.sport.toLowerCase()}/${baseName}-module`;
      console.log(`🔧 Resolving module for: ${alertType} at ${basePath}`);

      const fs = await import('fs');
      const candidates = [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        `${basePath}.js`,
        `${basePath}.mjs`,
        `${basePath}.cjs`,
      ];
      const existing = candidates.find((p) => fs.existsSync(p)) ?? `${basePath}.ts`;

      const imported = await import(existing);
      const ModuleClass = (imported.default ?? imported[Object.keys(imported)[0]]) as new () => BaseAlertModule;

      const instance = new ModuleClass();
      return instance;
    } catch (error) {
      console.error(`❌ Failed to load alert module ${alertType} for ${this.sport}:`, error);
      return null;
    }
  }

  // Initialize alert modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    // De-duplicate and normalize the list
    const unique = Array.from(
      new Set(
        (enabledAlertTypes ?? [])
          .filter(Boolean)
          .map((t) => String(t).trim().toUpperCase())
      )
    );

    console.log(`🔧 Initializing ${unique.length} alert modules for ${this.sport}`);

    let loaded = 0;
    for (const alertType of unique) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        loaded++;
      } else {
        console.warn(`⚠️ Skipping unavailable module: ${alertType}`);
      }
    }

    console.log(`✅ Loaded ${loaded}/${unique.length} modules for ${this.sport}`);
  }

  // Discover available alert types by scanning the cylinder directory (supports JS/TS)
  async getAvailableAlertTypes(): Promise<string[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const cylinderDir = path.join(currentDir, `alert-cylinders/${this.sport.toLowerCase()}`);

      if (!fs.existsSync(cylinderDir)) {
        console.log(`⚠️ No cylinder directory found for ${this.sport} at ${cylinderDir}`);
        return [];
      }

      const files = fs.readdirSync(cylinderDir);
      const MODULE_SUFFIXES = ['-module.ts', '-module.tsx', '-module.js', '-module.mjs', '-module.cjs'];

      const alertTypes = files
        .filter((file) => MODULE_SUFFIXES.some((sfx) => file.endsWith(sfx)))
        .map((file) => {
          const base = MODULE_SUFFIXES.reduce((name, sfx) => name.replace(sfx, ''), file);
          const alertName = base.replace(/-/g, '_').toUpperCase(); // game-start => GAME_START
          return `${this.sport}_${alertName}`;                      // => MLB_GAME_START
        })
        .sort();

      console.log(`🔍 Found ${alertTypes.length} available alert types for ${this.sport}`);
      return alertTypes;
    } catch (error) {
      console.error(`❌ Error discovering alert types for ${this.sport}:`, error);
      return [];
    }
  }
}
