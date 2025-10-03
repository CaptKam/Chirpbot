import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type RedZoneConfig = {
  maxTriggerYardline: number; // trigger at or inside this yard line (<=30 preserves your current behavior)
  minDown: number;            // inclusive
  maxDown: number;            // inclusive (set 3 for 4th-down exclusion)
  cooldownSec: number;        // per-game cooldown to avoid spam (e.g., 12–20s)
  dedupeBucketSec: number;    // clock bucketing to smooth feed jitter (e.g., 30s)
};

export default class RedZoneOpportunityModule extends BaseAlertModule {
  alertType = 'NFL_RED_ZONE_OPPORTUNITY';
  sport = 'NFL';

  // === Tunables ===
  private readonly cfg: RedZoneConfig = {
    maxTriggerYardline: 30,
    minDown: 1,
    maxDown: 3,
    cooldownSec: 15,
    dedupeBucketSec: 30,
  };

  // === Stateful guards ===
  private lastSignatureByGame = new Map<string, string>();
  private lastTriggerTsByGame = new Map<string, number>(); // wall-clock epoch seconds
  private lastSeenLiveByGame = new Map<string, boolean>();

  // === Static tables (yours, preserved) ===
  private readonly DOWN_DISTANCE_MULTIPLIERS: Record<number, Record<number, number>> = {
    1: {1:1.3,2:1.2,3:1.1,4:1.0,5:0.95,6:0.9,7:0.85,8:0.8,9:0.75,10:0.7},
    2: {1:1.2,2:1.1,3:1.0,4:0.95,5:0.9,6:0.85,7:0.8,8:0.75,9:0.7,10:0.65},
    3: {1:1.1,2:1.0,3:0.95,4:0.9,5:0.85,6:0.8,7:0.75,8:0.7,9:0.65,10:0.6},
    4: {1:0.9,2:0.85,3:0.8,4:0.75,5:0.7,6:0.65,7:0.6,8:0.55,9:0.5,10:0.45},
  };

  private readonly FIELD_POSITION_BASE_PROBABILITY: Record<number, number> = {
    1:95, 2:90, 3:85, 4:80, 5:78, 6:76, 7:74, 8:72, 9:70, 10:68,
    11:66, 12:64, 13:62, 14:60, 15:58, 16:56, 17:54, 18:52, 19:50, 20:48,
    21:45, 22:43, 23:41, 24:39, 25:37, 26:35, 27:33, 28:31, 29:29, 30:27
  };

  // ---- Trigger logic
  isTriggered(gameState: GameState): boolean {
    const gameId = String(gameState.gameId || '');
    if (!gameId) return false;

    // detect game stop → cleanup
    const isLive = gameState.status === 'live';
    if (this.lastSeenLiveByGame.get(gameId) === true && !isLive) {
      this.lastSignatureByGame.delete(gameId);
      this.lastTriggerTsByGame.delete(gameId);
    }
    this.lastSeenLiveByGame.set(gameId, !!isLive);

    // Basic checks
    if (!isLive) return false;

    const fp = this.num(gameState.fieldPosition);
    const down = this.num(gameState.down);
    const ytg = this.num(gameState.yardsToGo);
    const qtr = this.num(gameState.quarter);
    const timeStr = String(gameState.timeRemaining || '0:00');

    if (!fp || fp < 1) return false;
    if (fp > this.cfg.maxTriggerYardline) {
      // outside trigger range → clear
      this.lastSignatureByGame.delete(gameId);
      return false;
    }
    if (!down || down < this.cfg.minDown || down > this.cfg.maxDown) return false;
    if (!ytg || ytg < 1) return false;
    if (!qtr) return false;

    // Cooldown window
    const now = Math.floor(Date.now() / 1000);
    const lastTs = this.lastTriggerTsByGame.get(gameId) || 0;
    if (now - lastTs < this.cfg.cooldownSec) {
      return false;
    }

    // Build dedupe signature (possession/drive + situation buckets)
    const signature = this.buildSignature(gameState, timeStr);
    const prev = this.lastSignatureByGame.get(gameId);

    if (prev !== signature) {
      this.lastSignatureByGame.set(gameId, signature);
      this.lastTriggerTsByGame.set(gameId, now);
      return true;
    }
    return false;
  }

  // ---- Alert payload
  generateAlert(gameState: GameState): AlertResult | null {
    const prob = this.calculateTouchdownProbability(gameState);
    const confidenceLevel = this.getConfidenceLevel(prob);
    const situationDescription = this.getSituationDescription(gameState);
    const possessionTeam = this.getPossessionTeam(gameState);
    const dynamicMessage = this.createDynamicMessage(gameState);

    return {
      alertKey: `${gameState.gameId}_red_zone_opportunity_${gameState.down}_${gameState.yardsToGo}_${gameState.fieldPosition}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${this.num(gameState.quarter)}`,
      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: this.num(gameState.homeScore),
        awayScore: this.num(gameState.awayScore),
        possessionTeam,
        down: this.num(gameState.down),
        yardsToGo: this.num(gameState.yardsToGo),
        fieldPosition: this.num(gameState.fieldPosition),
        quarter: this.num(gameState.quarter),
        timeRemaining: String(gameState.timeRemaining || ''),
        touchdownProbability: Math.round(prob),
        confidenceLevel,
        situationDescription,
        alertType: 'PREDICTIVE',
        predictionCategory: 'RED_ZONE_SCORING',
        nflContext: {
          isRedZone: this.num(gameState.fieldPosition) <= 20,
          isGoalLine: this.num(gameState.fieldPosition) <= 5,
          isShortYardage: this.num(gameState.yardsToGo) <= 3,
          scoreDifferential: Math.abs(this.num(gameState.homeScore) - this.num(gameState.awayScore)),
          timePressure: this.getTimePressureLevel(gameState),
          playCalling: this.getPlayCallingTendency(gameState),
        },
      },
      priority: prob > 80 ? 95 : prob > 70 ? 90 : 85,
    };
  }

  // Public probability hook
  calculateProbability(gameState: GameState): number {
    return this.calculateTouchdownProbability(gameState);
  }

  // ---- Internals

  private calculateTouchdownProbability(gameState: GameState): number {
    const fp = this.clamp(this.num(gameState.fieldPosition), 1, 100);
    const down = this.clamp(this.num(gameState.down), 1, 4);
    const ytg = this.clamp(this.num(gameState.yardsToGo), 1, 10);

    if (!fp || !down || !ytg) return 0;

    const cappedFp = Math.min(fp, 30);
    let base = this.FIELD_POSITION_BASE_PROBABILITY[cappedFp] ?? 25;

    const ddMultTable = this.DOWN_DISTANCE_MULTIPLIERS[down] || this.DOWN_DISTANCE_MULTIPLIERS[3];
    const ddMult = ddMultTable[ytg] ?? 0.6;

    let probability = base * ddMult;

    // Weather heuristics (optional, preserved)
    const wx: any = (gameState as any).weather;
    if (wx?.isOutdoorStadium && wx.impact) {
      const impact = wx.impact;
      // FG difficulty tilts toward TD attempts
      if (impact.fieldGoalDifficulty === 'extreme') probability += 20;
      else if (impact.fieldGoalDifficulty === 'high') probability += 12;
      else if (impact.fieldGoalDifficulty === 'moderate') probability += 6;

      if (impact.preferredStrategy === 'run-heavy') {
        if (fp <= 10) probability += 8;
        else if (fp <= 20) probability += 5;
      } else if (impact.preferredStrategy === 'conservative') {
        probability += 4;
      }

      if (impact.weatherAlert) {
        probability += 8;
        if (fp <= 5 && impact.passingConditions !== 'dangerous') probability += 5;
      }

      if (impact.passingConditions === 'dangerous' && fp > 10) {
        probability -= 8;
      } else if (impact.passingConditions === 'poor' && fp > 15) {
        probability -= 4;
      }
    }

    probability *= this.getTimePressureAdjustment(gameState);
    probability *= this.getScoreDifferentialAdjustment(gameState);

    if (fp <= 3 && down <= 2) probability += 15; // goal line boost
    if (fp <= 10 && down === 1) probability += 10; // 1st & goal tendency
    if (fp <= 20 && this.num(gameState.yardsToGo) <= 3) probability += 8; // short yardage

    return this.clamp(probability, 5, 98);
  }

  private getTimePressureAdjustment(gameState: GameState): number {
    const q = this.num(gameState.quarter);
    const t = this.parseTimeToSeconds(String(gameState.timeRemaining || '0:00'));
    if (!q) return 1;

    if (q === 4) {
      if (t <= 120) return 1.15;
      if (t <= 300) return 1.10;
      return 1.05;
    }
    if (q === 2 && t <= 120) return 1.08;
    return 1.0;
  }

  private getScoreDifferentialAdjustment(gameState: GameState): number {
    const h = this.num(gameState.homeScore);
    const a = this.num(gameState.awayScore);
    if (h === null || a === null) return 1.0;

    const d = Math.abs(h - a);
    if (d <= 3) return 1.10;
    if (d <= 7) return 1.05;
    if (d <= 14) return 1.0;
    if (d <= 21) return 0.95;
    return 0.90;
  }

  private getPossessionTeam(gameState: GameState): string {
    if (gameState.possession) return String(gameState.possession);
    const away = (typeof gameState.awayTeam === 'string')
      ? gameState.awayTeam
      : (gameState as any).awayTeam?.name || '';
    return away || 'Unknown';
  }

  private getSituationDescription(gameState: GameState): string {
    const downStr = this.getOrdinal(this.num(gameState.down) || 1);
    const distance = this.num(gameState.yardsToGo) || 10;
    const pos = this.num(gameState.fieldPosition) || 20;
    return `${downStr} & ${distance} at ${pos}-yard line`;
  }

  private getConfidenceLevel(probability: number): string {
    if (probability >= 80) return 'HIGH';
    if (probability >= 65) return 'MEDIUM-HIGH';
    if (probability >= 50) return 'MEDIUM';
    return 'LOW';
  }

  private getOrdinal(n: number): string {
    const ord = ['', '1st', '2nd', '3rd', '4th'];
    return ord[n] || `${n}th`;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const clean = timeString.trim().split(' ')[0];
    if (clean.includes(':')) {
      const [m, s] = clean.split(':').map(x => parseInt(x, 10) || 0);
      return m * 60 + s;
    }
    return parseInt(clean, 10) || 0;
  }

  private buildSignature(gameState: GameState, timeStr: string): string {
    const team = this.getPossessionTeam(gameState);
    const driveId = (gameState as any).driveId ? String((gameState as any).driveId) : '';
    const down = this.clamp(this.num(gameState.down) || 1, 1, 4);
    const ytg = this.clamp(this.num(gameState.yardsToGo) || 10, 1, 50);
    const pos = this.clamp(this.num(gameState.fieldPosition) || 20, 1, 99);

    const posBucket = Math.ceil(pos / 5) * 5; // 1–5, 6–10, …
    const tSec = this.parseTimeToSeconds(timeStr);
    const tBucket = Math.floor(tSec / this.cfg.dedupeBucketSec) * this.cfg.dedupeBucketSec;

    // Prefer per-drive dedupe if available
    const driveKey = driveId ? `D:${driveId}` : `T:${team}`;
    return `${driveKey}|Q${this.num(gameState.quarter)}|${down}&${ytg}|FP${posBucket}|CLK${tBucket}`;
  }

  private getTimePressureLevel(gameState: GameState): string {
    const q = this.num(gameState.quarter);
    const t = this.parseTimeToSeconds(String(gameState.timeRemaining || '0:00'));
    if (!q) return 'NORMAL';
    if (q === 4) {
      if (t <= 120) return 'CRITICAL';
      if (t <= 300) return 'HIGH';
      return 'MEDIUM';
    }
    if (q === 2 && t <= 120) return 'MEDIUM';
    return 'NORMAL';
  }

  private createDynamicMessage(gameState: GameState): string {
    const prob = this.calculateTouchdownProbability(gameState);
    const downStr = this.getOrdinal(this.num(gameState.down) || 1);
    const ytg = this.num(gameState.yardsToGo) || 10;
    const fp = this.num(gameState.fieldPosition) || 20;

    const situation =
      fp <= 3
        ? `${downStr} & Goal at ${fp}-yard line`
        : `${downStr} & ${ytg} at ${fp}-yard line`;

    let label: string;
    if (prob >= 80) label = 'Prime scoring opportunity';
    else if (prob >= 65) label = 'Strong scoring chance';
    else if (prob >= 50) label = 'Red zone scoring chance';
    else label = 'Red zone opportunity';

    if (fp <= 5) label = 'Goal line ' + label.toLowerCase();
    return `${situation} - ${label}`;
  }

  private getPlayCallingTendency(gameState: GameState): string {
    const down = this.num(gameState.down);
    const ytg = this.num(gameState.yardsToGo);
    const fp = this.num(gameState.fieldPosition);
    if (!down || !ytg || !fp) return 'BALANCED';

    if (fp <= 3) return 'POWER_RUN';
    if (down === 1 && ytg <= 3) return 'RUN_HEAVY';
    if (down === 3 && ytg >= 7) return 'PASS_HEAVY';
    if (down === 2 && ytg <= 3) return 'RUN_LIKELY';
    return 'BALANCED';
  }

  // ---- tiny utils
  private num(v: any): number {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  private clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
  }
}
