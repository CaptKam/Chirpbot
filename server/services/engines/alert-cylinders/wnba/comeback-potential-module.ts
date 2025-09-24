import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type NormStatus = 'scheduled' | 'live' | 'final' | 'other';

export default class ComebackPotentialModule extends BaseAlertModule {
  alertType = 'WNBA_COMEBACK_POTENTIAL';
  sport = 'WNBA';

  // --- Tunables / config -----------------------------------------------------
  private readonly QUARTER_SECONDS = 600;  // WNBA regulation quarter
  private readonly OT_SECONDS = 300;       // WNBA OT period
  private readonly MIN_DEFICIT_TO_CARE = 3;

  // Quarter-specific “interesting” deficit bands (for the *trailing* team)
  private readonly DEFICIT_BANDS = {
    2: { min: 10, max: 20 }, // early
    3: { min:  8, max: 18 }, // mid
    4: { min:  5, max: 15 }, // late
    5: { min:  1, max:  8 }, // OT
  } as const;

  private readonly BASE_COMEBACK_PROB_BY_Q = {
    1: 0.75, 2: 0.65, 3: 0.45, 4: 0.25, 5: 0.15,
  } as const;

  private readonly FACTORS = {
    THREE_POINT_IMPACT: 3.2,
    PACE_PER_MIN: 1.8,              // estimated possessions per minute (per team-ish)
    TIMEOUT_VALUE: 2.5,
    FOUL_STRATEGY_SEC: 90,
    BENCH_DEPTH: 0.9,
    MOMENTUM_WEIGHT: 1.4,
  };

  // Anti-spam: require condition to persist this long before (re)firing
  private readonly PERSISTENCE_SEC = 20;
  // Anti-spam: cooldown per game/scenario key
  private readonly COOLDOWN_MS = 120_000;

  // Track last time we fired per (gameId + scenarioKey)
  private readonly lastFire = new Map<string, number>();
  // Track when scenario condition first became true to enforce persistence
  private readonly firstSeenTrue = new Map<string, number>();

  // --- Helpers ---------------------------------------------------------------
  private normStatus(s?: string): NormStatus {
    const t = (s || '').trim().toLowerCase();
    if (t === 'live' || t === 'in progress' || t === 'inprogress') return 'live';
    if (t === 'final' || t === 'completed') return 'final';
    if (t === 'scheduled' || t === 'pregame' || t === 'pre') return 'scheduled';
    return 'other';
  }

  private parseTimeToSeconds(timeString?: string): number {
    if (!timeString || timeString === '0:00') return 0;
    try {
      const clean = timeString.trim().split(' ')[0];
      if (clean.includes(':')) {
        const [m, s] = clean.split(':').map(n => parseInt(n, 10) || 0);
        return m * 60 + s;
      }
      return parseInt(clean, 10) || 0;
    } catch {
      return 0;
    }
  }

  private getDeficitAndTeams(gs: GameState) {
    const home = gs.homeScore ?? 0;
    const away = gs.awayScore ?? 0;
    const trailingTeam = home < away ? gs.homeTeam : gs.awayTeam;
    const leadingTeam  = home > away ? gs.homeTeam : gs.awayTeam;
    const trailingScore = Math.min(home, away);
    const leadingScore  = Math.max(home, away);
    const deficit = leadingScore - trailingScore; // ALWAYS a trailing deficit
    return { trailingTeam, leadingTeam, trailingScore, leadingScore, deficit };
  }

  private totalRegulationTimeLeft(quarter: number, secLeftThisQuarter: number): number {
    if (quarter >= 5) return secLeftThisQuarter; // OT: just use current OT time
    const quartersRemainingAfterThis = Math.max(0, 4 - quarter);
    return secLeftThisQuarter + quartersRemainingAfterThis * this.QUARTER_SECONDS;
  }

  private scenarioKey(gs: GameState, bandLabel: string): string {
    const q = gs.quarter ?? 1;
    // Bucket deficit/time a bit to avoid overly-unique keys
    const { deficit } = this.getDeficitAndTeams(gs);
    const defBucket = Math.min(20, Math.max(0, Math.round(deficit / 2) * 2));
    const timeBucket = Math.min(600, Math.max(0, Math.round(this.parseTimeToSeconds(gs.timeRemaining || '') / 15) * 15));
    return `${gs.gameId}_${bandLabel}_Q${q}_D${defBucket}_T${timeBucket}`;
  }

  private withinBand(q: number, deficit: number): { ok: boolean; label: string } {
    const band = (this.DEFICIT_BANDS as any)[q];
    if (!band) return { ok: false, label: 'NONE' };
    const ok = deficit >= band.min && deficit <= band.max;
    const label = q === 2 ? 'EARLY' : q === 3 ? 'MID' : q === 4 ? 'LATE' : 'OT';
    return { ok, label };
  }

  // --- Core contract ---------------------------------------------------------
  isTriggered(gs: GameState): boolean {
    if (!gs.gameId) return false;
    if (this.normStatus(gs.status) !== 'live') return false;

    const q = gs.quarter ?? 1;
    const tQ = this.parseTimeToSeconds(gs.timeRemaining || '');
    const { deficit } = this.getDeficitAndTeams(gs);

    // Must be a *trailing* deficit above minimal noise
    if (deficit < this.MIN_DEFICIT_TO_CARE) return false;

    const { ok, label } = this.withinBand(q, deficit);
    if (!ok) return false;

    const key = this.scenarioKey(gs, label);

    // Persistence window to avoid flapping
    const now = Date.now();
    if (!this.firstSeenTrue.has(key)) this.firstSeenTrue.set(key, now);
    const seenSince = (now - (this.firstSeenTrue.get(key) || now)) / 1000;

    if (seenSince < this.PERSISTENCE_SEC) return false;

    // Cooldown
    const last = this.lastFire.get(key) || 0;
    if (now - last < this.COOLDOWN_MS) return false;

    // Optional: In very late Q4, tighten minimal deficit to avoid garbage time noise
    if (q === 4 && tQ < 90 && deficit < 4) return false;

    this.lastFire.set(key, now);
    return true;
  }

  generateAlert(gs: GameState): AlertResult | null {
    const q = gs.quarter ?? 1;
    const tStr = gs.timeRemaining || '';
    const tSec = this.parseTimeToSeconds(tStr);
    const { trailingTeam, leadingTeam, trailingScore, leadingScore, deficit } = this.getDeficitAndTeams(gs);

    const scenario = this.identifyScenario(q, tSec);
    const probPct  = Math.round(this.probabilityPct(gs));
    const reqPace  = Math.round(this.requiredPointsPerPoss(gs) * 10) / 10;
    const strategies = this.getStrategies(q, tSec, deficit);
    const timeMeta   = this.timeMeta(q, tSec);

    return {
      alertKey: `${gs.gameId}_cb_${scenario}_${q}_${Math.min(20, deficit)}_${Math.min(600, tSec)}`,
      type: this.alertType,
      message: `🔄 COMEBACK: ${trailingTeam} trails ${leadingScore}-${trailingScore} (${deficit}) with ${tStr} left — ${this.scenarioDescription(scenario)}`,
      context: {
        gameId: gs.gameId,
        sport: this.sport,
        homeTeam: gs.homeTeam,
        awayTeam: gs.awayTeam,
        homeScore: gs.homeScore ?? 0,
        awayScore: gs.awayScore ?? 0,
        quarter: q,
        timeRemaining: tStr,
        deficit,
        trailingTeam,
        leadingTeam,
        trailingScore,
        leadingScore,
        comebackScenario: scenario,
        comebackProbability: probPct,
        requiredPace: reqPace,
        keyStrategies: strategies,
        timeFactors: timeMeta,
        alertType: 'PREDICTIVE',
        predictionCategory: 'COMEBACK_POTENTIAL',
        wnbaContext: {
          isComebackScenario: true,
          deficitSize: this.categorizeDeficit(deficit),
          timeUrgency: this.timeUrgency(q, tSec),
          possessionsRemaining: this.estimatePoss(q, tSec),
          requiredThreePointers: Math.ceil(deficit / this.FACTORS.THREE_POINT_IMPACT),
          foulStrategyRecommended: this.shouldFoul(q, tSec, deficit),
          timeoutValue: this.FACTORS.TIMEOUT_VALUE,
          paceFactors: this.FACTORS,
          momentumIndicators: this.momentum(gs),
          strategicOptions: this.strategicOptions(q, tSec, deficit),
        },
      },
      priority: this.priority(probPct, q, deficit, tSec),
    };
  }

  // PURE — do not call isTriggered() here
  calculateProbability(gs: GameState): number {
    return Math.min(Math.max(this.probabilityPct(gs), 10), 85);
  }

  // --- Reasoning pieces used by both methods --------------------------------
  private probabilityPct(gs: GameState): number {
    const q = gs.quarter ?? 1;
    const tSec = this.parseTimeToSeconds(gs.timeRemaining || '');
    const { deficit } = this.getDeficitAndTeams(gs);

    let base = (this.BASE_COMEBACK_PROB_BY_Q as any)[q] ?? 0.25;

    // Deficit shaping (smaller deficit => higher)
    if (deficit <= 5) base *= 1.5;
    else if (deficit <= 8) base *= 1.2;
    else if (deficit <= 12) base *= 1.0;
    else if (deficit <= 15) base *= 0.8;
    else base *= 0.6;

    // Time shaping for Q4/OT
    if (q === 4) {
      if (tSec > 480) base *= 1.1;
      else if (tSec > 300) base *= 1.0;
      else if (tSec > 120) base *= 0.9;
      else base *= 0.7;
    } else if (q >= 5) {
      base *= 0.6;
    }

    return base * 100;
  }

  private requiredPointsPerPoss(gs: GameState): number {
    const q = gs.quarter ?? 1;
    const tSec = this.parseTimeToSeconds(gs.timeRemaining || '');
    const { deficit } = this.getDeficitAndTeams(gs);

    const regLeft = this.totalRegulationTimeLeft(q, tSec);
    const possRemaining = this.estimatePossFromSeconds(regLeft);
    if (possRemaining <= 0) return deficit; // avoid div-by-zero; treat as all in one shot
    return deficit / possRemaining;
  }

  private estimatePoss(q: number, tSec: number): number {
    return Math.round(this.estimatePossFromSeconds(this.totalRegulationTimeLeft(q, tSec)));
  }

  private estimatePossFromSeconds(seconds: number): number {
    // Rough combined-team possessions available to the *trailing* team
    const perMin = this.FACTORS.PACE_PER_MIN;
    return (seconds / 60) * perMin;
  }

  private identifyScenario(q: number, tSec: number): string {
    if (q >= 5) return 'OVERTIME_COMEBACK';
    if (q === 4 && tSec <= 120) return 'FINAL_MINUTES_RALLY';
    if (q === 4 && tSec <= 300) return 'FOURTH_QUARTER_COMEBACK';
    if (q === 3) return 'MID_GAME_RALLY';
    if (q === 2) return 'EARLY_COMEBACK';
    return 'COMEBACK_OPPORTUNITY';
  }

  private scenarioDescription(s: string): string {
    switch (s) {
      case 'OVERTIME_COMEBACK': return 'Overtime chance developing';
      case 'FINAL_MINUTES_RALLY': return 'Final two-minute push';
      case 'FOURTH_QUARTER_COMEBACK': return 'Late-game comeback window';
      case 'MID_GAME_RALLY': return 'Mid-game rally opportunity';
      case 'EARLY_COMEBACK': return 'Early deficit—plenty of time';
      default: return 'Comeback opportunity';
    }
  }

  private getStrategies(q: number, tSec: number, deficit: number): string[] {
    const s: string[] = [];
    if (deficit >= 6) s.push('Lean into quality 3s');
    if (q >= 3) s.push('Tighten on-ball defense');
    if (q === 4 && tSec <= this.FACTORS.FOUL_STRATEGY_SEC) s.push('Consider foul-to-extend');
    if (q >= 3) s.push('Use timeouts strategically');
    if (deficit >= 8) s.push('Increase pace selectively');
    s.push('Dominate the defensive glass');
    return s;
  }

  private timeMeta(q: number, tSec: number) {
    return {
      quarterPhase: q <= 2 ? 'early' : q === 3 ? 'middle' : q === 4 ? 'late' : 'overtime',
      timeUrgency: this.timeUrgency(q, tSec),
      possessionsRemaining: this.estimatePoss(q, tSec),
      canAffordTurnovers: q <= 3 || (q === 4 && tSec > 180),
      timeForPatience: q <= 2,
      mustPressNow: q === 4 && tSec <= 300,
    };
  }

  private categorizeDeficit(d: number): string {
    if (d <= 3) return 'minimal';
    if (d <= 6) return 'small';
    if (d <= 10) return 'moderate';
    if (d <= 15) return 'large';
    return 'substantial';
  }

  private timeUrgency(q: number, tSec: number): string {
    if (q >= 5) return 'extreme';
    if (q === 4 && tSec <= 60) return 'critical';
    if (q === 4 && tSec <= 180) return 'high';
    if (q === 4 && tSec <= 360) return 'moderate';
    if (q >= 3) return 'low';
    return 'minimal';
  }

  private shouldFoul(q: number, tSec: number, deficit: number): boolean {
    return q === 4 && tSec <= this.FACTORS.FOUL_STRATEGY_SEC && deficit >= 4;
  }

  private momentum(_gs: GameState) {
    // Placeholder – wire to recent run data when available
    return {
      recentTrend: 'neutral',
      momentumShift: true, // conservative optimistic flag for UI
      energyLevel: 'high',
      crowdFactor: 'supportive',
    };
  }

  private strategicOptions(q: number, tSec: number, deficit: number): string[] {
    const opts = ['Defensive pressure', 'High-value 3s'];
    if (q >= 3) opts.push('Timeout sequencing');
    if (q === 4 && tSec <= 120) opts.push('Foul-to-extend clock');
    if (deficit >= 8) opts.push('Press defense');
    if (q >= 4) opts.push('Targeted substitutions');
    return opts;
  }

  private priority(probPct: number, q: number, deficit: number, tSec: number): number {
    let p = 80;
    p += Math.round(probPct * 0.1);
    if (q >= 5) p += 8;
    else if (q === 4) p += 5;
    else if (q === 3) p += 3;

    if (deficit <= 5) p += 8;
    else if (deficit <= 8) p += 5;
    else if (deficit <= 12) p += 3;

    if (q === 4 && tSec <= 300) p += 5;
    return Math.min(p, 95);
  }
}
