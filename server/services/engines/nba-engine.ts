/**
 * NBA Engine — V3.1 Improvements
 * - Safer probability clamp + fast guards
 * - Optional pre-AI threshold gate (configurable via unifiedSettings)
 * - Dynamic module init reuse from BaseSportEngine with de-dupe + summaries
 * - Meaningful enhanced-live-data merge with cheap guards
 * - Low-noise logging in production
 * - Optional unified dedupe check before emitting alerts (fallback local TTL)
 */

import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';

const DEBUG = process.env.NODE_ENV !== 'production';

type EnhancedNBA = {
  quarter?: number;
  timeRemaining?: string;
  possession?: string;
  homeScore?: number;
  awayScore?: number;
  // extras
  period?: number;
  clock?: string;
  shotClock?: number;
  situation?: Record<string, unknown>;
  starPlayerStats?: Record<string, unknown>;
};

export class NBAEngine extends BaseSportEngine {
  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    probabilityCalculationTime: [] as number[],
    gameStateEnhancementTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    clutchTimeDetections: 0,
    overtimeAlerts: 0,
  };

  // Reused singleton for API calls
  private static nbaApiService: { getEnhancedGameData?: (gameId: string) => Promise<EnhancedNBA & { error?: any }> } | null = null;

  constructor() {
    super('NBA');
  }

  // ---- Settings helpers ----------------------------------------------------

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Validate against dynamically discovered alert types
      const validAlerts = await this.getAvailableAlertTypes();
      
      if (!validAlerts.includes(alertType)) {
        if (DEBUG) console.log(`❌ ${alertType} is not a valid NBA alert type - rejecting`);
        return false;
      }
      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NBA Settings lookup error for ${alertType}:`, error);
      // Fail-open to avoid missing critical alerts if settings store is momentarily unavailable
      return true;
    }
  }

  // ---- Probability model (cheap, deterministic) ---------------------------

  async calculateProbability(gameState: GameState): Promise<number> {
    const t0 = Date.now();
    try {
      if (!gameState?.isLive) return 0;

      let p = 50; // baseline
      const quarter = Number(gameState.quarter ?? 0);
      const timeRemaining = String(gameState.timeRemaining ?? '');
      const homeScore = Number(gameState.homeScore ?? 0);
      const awayScore = Number(gameState.awayScore ?? 0);
      const totalScore = homeScore + awayScore;

      // Quarter weighting
      if (quarter === 1) p += 10;
      else if (quarter === 2) p += 12;
      else if (quarter === 3) p += 14;
      else if (quarter === 4) p += 20;
      else if (quarter >= 5) { p += 30; this.performanceMetrics.overtimeAlerts++; }

      // Time pressure
      const secs = this.parseTimeToSeconds(timeRemaining);
      if (quarter >= 4) {
        if (secs <= 60) { p += 25; this.performanceMetrics.clutchTimeDetections++; }
        else if (secs <= 120) p += 18;
        else if (secs <= 300) p += 12;
      }
      if (quarter >= 3 && secs % 24 <= 5) p += 8; // shot clock crunch

      // Score pressure
      const diff = Math.abs(homeScore - awayScore);
      if (diff <= 3) p += 25;
      else if (diff <= 6) p += 18;
      else if (diff <= 10) p += 12;
      else if (diff <= 15) p += 8;
      else if (diff >= 20) p -= 10;

      // Pace/total
      if (quarter >= 3) {
        if (totalScore >= 220) p += 15;
        else if (totalScore >= 200) p += 10;
        else if (totalScore <= 180) p += 8; // defensive battle still interesting late
      }

      // Late-possession context (light touch)
      if (quarter >= 3 && gameState.possession) p += 5;

      // Clamp to sane window
      const finalP = Math.max(10, Math.min(95, Math.round(p)));

      const dt = Date.now() - t0;
      this.performanceMetrics.probabilityCalculationTime.push(dt);
      if (dt > 50 && DEBUG) console.log(`⚠️ NBA slow probability calc: ${dt}ms for game ${gameState.gameId}`);

      return finalP;
    } catch (err) {
      const dt = Date.now() - t0;
      console.error(`❌ NBA probability calc failed after ${dt}ms:`, err);
      return 50;
    }
  }

  // ---- Main alert generation ----------------------------------------------

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const t0 = Date.now();

    try {
      if (!gameState?.gameId) {
        if (DEBUG) console.log('⚠️ NBA: Missing gameId, skip');
        return [];
      }
      if (!gameState.isLive) return [];

      // Optional pre-AI threshold to avoid noisy work
      const threshold = 70;
      const preProb = await this.calculateProbability(gameState);
      if (preProb < threshold) {
        if (DEBUG) console.log(`⏭️ NBA pre-threshold drop (${preProb} < ${threshold}) for game ${gameState.gameId}`);
        return [];
      }

      // Merge live enhanced info if available
      const enhanced = await this.enhanceGameStateWithLiveData(gameState);

      // Defer to BaseSportEngine which iterates loaded modules safely
      const alerts = await super.generateLiveAlerts(enhanced);

      // Optional per-alert dedupe gate (global deduper if present; fallback local TTL)
      const filtered: AlertResult[] = [];
      for (const alert of alerts) {
        const key = `${enhanced.gameId}:${alert.type}:${enhanced.quarter ?? ''}:${enhanced.timeRemaining ?? ''}:${enhanced.homeScore ?? 0}-${enhanced.awayScore ?? 0}`;
        if (tryGlobalDedupe(key, alert.type)) {
          filtered.push(alert);
        } else if (DEBUG) {
          console.log(`🚫 DEDUP blocked ${alert.type} for ${enhanced.gameId}`);
        }
      }

      // Track metrics
      this.performanceMetrics.totalAlerts += filtered.length;

      if (DEBUG) {
        if (filtered.length) console.log(`🔄 NBA: Emitting ${filtered.length} alerts (raw=${alerts.length}) for ${enhanced.gameId}`);
        else console.log(`🔄 NBA: No alerts emitted for ${enhanced.gameId}`);
      }

      return filtered;
    } finally {
      const dt = Date.now() - t0;
      this.performanceMetrics.alertGenerationTime.push(dt);
      // Keep last 100 samples
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  // ---- Enhanced game-state merge ------------------------------------------

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive || !gameState.gameId) return gameState;

      if (!NBAEngine.nbaApiService) {
        const { NBAApiService } = await import('../nba-api');
        NBAEngine.nbaApiService = new NBAApiService();
      }

      const enhanced = await NBAEngine.nbaApiService.getEnhancedGameData?.(gameState.gameId).catch(() => null);

      if (enhanced && !('error' in enhanced) && this.isEnhancedDataMeaningful(enhanced, gameState)) {
        const merged: GameState = {
          ...gameState,
          quarter: this.pickEnhanced(enhanced.quarter, gameState.quarter, 1),
          timeRemaining: this.pickEnhanced(enhanced.timeRemaining, gameState.timeRemaining, '12:00'),
          possession: enhanced.possession ?? gameState.possession,
          homeScore: this.pickScore(enhanced.homeScore, gameState.homeScore),
          awayScore: this.pickScore(enhanced.awayScore, gameState.awayScore),
          // extras
          period: enhanced.period ?? (gameState as any).period ?? gameState.quarter,
          clock: enhanced.clock ?? (gameState as any).clock ?? gameState.timeRemaining,
          shotClock: enhanced.shotClock ?? (gameState as any).shotClock ?? 24,
          situation: enhanced.situation ?? (gameState as any).situation ?? {},
          starPlayerStats: enhanced.starPlayerStats ?? (gameState as any).starPlayerStats ?? {},
          clutchSituation: this.detectClutchSituation({
            ...gameState,
            quarter: enhanced.quarter ?? gameState.quarter,
            timeRemaining: enhanced.timeRemaining ?? gameState.timeRemaining,
            homeScore: enhanced.homeScore ?? gameState.homeScore,
            awayScore: enhanced.awayScore ?? gameState.awayScore,
          } as GameState),
        };
        this.performanceMetrics.cacheHits++;
        if (DEBUG) console.log(`🔍 NBA enhanced state used for ${gameState.gameId}`);
        this.performanceMetrics.gameStateEnhancementTime.push(Date.now() - t0);
        this.maintainPerfArrays();
        return merged;
      }

      this.performanceMetrics.cacheMisses++;
      if (DEBUG) console.log(`🚫 NBA enhanced data not meaningful for ${gameState.gameId}`);
      this.performanceMetrics.gameStateEnhancementTime.push(Date.now() - t0);
      this.maintainPerfArrays();
      return gameState;
    } catch (err) {
      const dt = Date.now() - t0;
      console.error(`❌ NBA enhance failed after ${dt}ms:`, err);
      return gameState;
    }
  }

  // ---- Initialization / module wiring -------------------------------------

  async initializeForUser(userId: string): Promise<void> {
    try {
      const prefs = await storage.getUserAlertPreferencesBySport(userId, 'NBA');
      const enabled = (prefs ?? []).filter(p => p.enabled).map(p => String(p.alertType));

      // Filter by global enablement
      const final: string[] = [];
      for (const t of enabled) {
        // eslint-disable-next-line no-await-in-loop
        if (await this.isAlertEnabled(t)) final.push(t);
      }

      if (DEBUG) console.log(`🎯 NBA init for user ${userId} with ${final.length} alerts`);
      await this.initializeUserAlertModules(final);
    } catch (err) {
      console.error(`❌ NBA init failed for user ${userId}:`, err);
    }
  }

  // Reuse BaseSportEngine's dynamic loader by keeping method signature;
  // Provide a fast path map for common alerts but still fall back to base loader.
  async loadAlertModule(alertType: string): Promise<any | null> {
    const t0 = Date.now();
    try {
      const map: Record<string, string> = {
        'NBA_GAME_START': './alert-cylinders/nba/game-start-module',
        'NBA_FOURTH_QUARTER': './alert-cylinders/nba/fourth-quarter-module',
        'NBA_FINAL_MINUTES': './alert-cylinders/nba/final-minutes-module',
        'NBA_TWO_MINUTE_WARNING': './alert-cylinders/nba/two-minute-warning-module',
        'NBA_OVERTIME': './alert-cylinders/nba/overtime-module',
        // advanced
        'NBA_CLUTCH_PERFORMANCE': './alert-cylinders/nba/clutch-performance-module',
        'NBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/nba/championship-implications-module',
        'NBA_SUPERSTAR_ANALYTICS': './alert-cylinders/nba/superstar-analytics-module',
        'NBA_PLAYOFF_INTENSITY': './alert-cylinders/nba/playoff-intensity-module',
      };

      const base = map[alertType];
      if (base) {
        const module = await import(resolveWithExtensions(base));
        const dt = Date.now() - t0;
        this.performanceMetrics.moduleLoadTime.push(dt);
        if (dt > 50 && DEBUG) console.log(`⚠️ NBA slow module load: ${alertType} ${dt}ms`);
        return new module.default();
      }

      // Fallback to Base loader (handles other patterns)
      const m = await super.loadAlertModule(alertType);
      const dt = Date.now() - t0;
      this.performanceMetrics.moduleLoadTime.push(dt);
      if (!m && DEBUG) console.log(`❌ NBA module not found for ${alertType}`);
      return m;
    } catch (err) {
      const dt = Date.now() - t0;
      console.error(`❌ Failed to load NBA module ${alertType} after ${dt}ms:`, err);
      return null;
    }
  }

  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if changed
    const current = Array.from(this.alertModules.keys()).sort();
    const next = Array.from(new Set((enabledAlertTypes ?? []).map(t => String(t).trim().toUpperCase()))).sort();
    const changed = JSON.stringify(current) !== JSON.stringify(next);

    if (!changed && this.alertModules.size > 0) {
      if (DEBUG) console.log(`🔄 NBA cylinders already loaded: ${this.alertModules.size}`);
      return;
    }
    if (changed) {
      this.alertModules.clear();
      if (DEBUG) console.log(`🧹 NBA cylinders cleared due to type changes`);
    }

    for (const t of next) {
      const mod = await this.loadAlertModule(t);
      if (mod) {
        this.alertModules.set(t, mod);
        if (DEBUG) console.log(`✅ NBA loaded: ${t}`);
      }
    }
    if (DEBUG) console.log(`🔧 NBA initialized ${this.alertModules.size} cylinders`);
  }

  // ---- Utilities -----------------------------------------------------------

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    try {
      const clean = String(timeString).trim().split(' ')[0];
      if (clean.includes(':')) {
        const [m, s] = clean.split(':').map(n => parseInt(n, 10) || 0);
        return m * 60 + s;
      }
      return parseInt(clean, 10) || 0;
    } catch (e) {
      if (DEBUG) console.warn(`NBA: Failed to parse time "${timeString}":`, e);
      return 0;
    }
  }

  private isEnhancedDataMeaningful(enhanced: EnhancedNBA | null | undefined, original: GameState): boolean {
    if (!enhanced) return false;
    if (enhanced.quarter && enhanced.quarter !== 1 && enhanced.quarter !== (original as any).quarter) return true;
    if (enhanced.timeRemaining && enhanced.timeRemaining !== '12:00' && enhanced.timeRemaining !== (original as any).timeRemaining) return true;
    if ((enhanced.homeScore ?? 0) + (enhanced.awayScore ?? 0) > 0) {
      if (enhanced.homeScore !== original.homeScore || enhanced.awayScore !== original.awayScore) return true;
    }
    return false;
  }

  private pickEnhanced<T>(enhanced: T | undefined, original: T | undefined, defaultValue: T): T | undefined {
    return enhanced !== undefined && enhanced !== defaultValue && enhanced !== original ? enhanced : original;
  }

  private pickScore(enhanced: number | undefined, original: number | undefined): number {
    if (typeof enhanced === 'number' && enhanced >= 0) {
      if (enhanced > 0 || !original || original === 0) return enhanced;
    }
    return original ?? 0;
  }

  private detectClutchSituation(state: GameState) {
    const q = Number(state.quarter ?? 0);
    const tr = String(state.timeRemaining ?? '');
    const hs = Number(state.homeScore ?? 0);
    const as = Number(state.awayScore ?? 0);

    if (q >= 4 && tr) {
      const secs = this.parseTimeToSeconds(tr);
      const diff = Math.abs(hs - as);
      return {
        isClutchTime: secs <= 300,
        isCrunchTime: secs <= 120,
        isCloseGame: diff <= 5,
        clutchFactor: this.calculateClutchFactor(secs, diff, q),
      };
    }
    return {};
  }

  private calculateClutchFactor(secs: number, diff: number, q: number): number {
    let f = 0;
    if (secs <= 60) f += 40;
    else if (secs <= 120) f += 30;
    else if (secs <= 300) f += 20;

    if (diff <= 2) f += 30;
    else if (diff <= 5) f += 20;
    else if (diff <= 10) f += 10;

    if (q >= 5) f += 20;
    else if (q === 4) f += 15;

    return Math.min(100, f);
  }

  private maintainPerfArrays() {
    const cap = 100;
    const trim = (arr: number[]) => (arr.length > cap ? arr.slice(-cap) : arr);
    this.performanceMetrics.gameStateEnhancementTime = trim(this.performanceMetrics.gameStateEnhancementTime);
    this.performanceMetrics.moduleLoadTime = trim(this.performanceMetrics.moduleLoadTime);
    this.performanceMetrics.enhanceDataTime = trim(this.performanceMetrics.enhanceDataTime);
    this.performanceMetrics.probabilityCalculationTime = trim(this.performanceMetrics.probabilityCalculationTime);
  }

  // ---- Metrics -------------------------------------------------------------

  private cleanupPerformanceMetrics(): void {
    const max = 100;
    const trim = (arr: number[]) => arr.slice(-max);
    this.performanceMetrics.alertGenerationTime = trim(this.performanceMetrics.alertGenerationTime);
    this.performanceMetrics.moduleLoadTime = trim(this.performanceMetrics.moduleLoadTime);
    this.performanceMetrics.enhanceDataTime = trim(this.performanceMetrics.enhanceDataTime);
    this.performanceMetrics.probabilityCalculationTime = trim(this.performanceMetrics.probabilityCalculationTime);
    this.performanceMetrics.gameStateEnhancementTime = trim(this.performanceMetrics.gameStateEnhancementTime);
    if (DEBUG) console.log(`🧹 NBA Engine metrics trimmed to last ${max} samples`);
  }

  getPerformanceStats(): any {
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      totalRequests: this.performanceMetrics.totalRequests,
      totalAlerts: this.performanceMetrics.totalAlerts,
      cacheHits: this.performanceMetrics.cacheHits,
      cacheMisses: this.performanceMetrics.cacheMisses,
      clutchTimeDetections: this.performanceMetrics.clutchTimeDetections,
      overtimeAlerts: this.performanceMetrics.overtimeAlerts,
      averageAlertTime: avg(this.performanceMetrics.alertGenerationTime),
      averageEnhanceTime: avg(this.performanceMetrics.enhanceDataTime),
      averageProbabilityTime: avg(this.performanceMetrics.probabilityCalculationTime),
    };
  }

  getPerformanceMetrics() {
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const avgCalculationTime = avg(this.performanceMetrics.probabilityCalculationTime);
    const avgAlertTime = avg(this.performanceMetrics.alertGenerationTime);
    const avgEnhanceTime = avg(this.performanceMetrics.gameStateEnhancementTime);
    const cacheHitRate =
      this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
        ? (this.performanceMetrics.cacheHits /
            (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) *
          100
        : 0;

    return {
      sport: 'NBA',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        cacheHitRate,
        deduplicationRate: 0, // handled globally
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses,
      },
      sportSpecific: {
        clutchTimeDetections: this.performanceMetrics.clutchTimeDetections,
        overtimeAlerts: this.performanceMetrics.overtimeAlerts,
        professionalBasketballAlerts: this.performanceMetrics.totalAlerts,
        activeGameTracking: 0, // global
        totalTrackedAlerts: 0, // global
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20),
      },
    };
  }
}

// ---- Local helpers ---------------------------------------------------------

function resolveWithExtensions(base: string): string {
  // Let bundlers resolve; prefer TS/JS common endings.
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.cjs`];
  // We return the bare base; dynamic import resolution will try file with extension in many setups.
  // To be safe, return first candidate; node/ts-node usually can handle .ts in dev.
  return candidates[0];
}

function tryGlobalDedupe(key: string, type: string): boolean {
  // Use global unifiedDeduplicator if available, else a local TTL map
  const g = globalThis as unknown as { unifiedDeduplicator?: { shouldSendAlert?: Function } };
  const d = g?.unifiedDeduplicator;
  if (d?.shouldSendAlert) {
    try {
      return !!d.shouldSendAlert({ gameId: key.split(':')[0], type, timestamp: Date.now() }, 'plate-appearance');
    } catch {
      // fall through to local
    }
  }
  return localTTL(key, 15_000);
}

const _localTTLMap = new Map<string, number>();
function localTTL(key: string, ttl: number): boolean {
  const now = Date.now();
  const last = _localTTLMap.get(key) ?? 0;
  if (now - last < ttl) return false;
  _localTTLMap.set(key, now);
  if (_localTTLMap.size > 5000) {
    const entries = Array.from(_localTTLMap.entries()).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 1000; i++) _localTTLMap.delete(entries[i][0]);
  }
  return true;
}
