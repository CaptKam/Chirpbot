import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type RiskLevel = 'LOW'|'MODERATE'|'ELEVATED'|'HIGH'|'CRITICAL';

export default class TurnoverLikelihoodModule extends BaseAlertModule {
  alertType = 'NFL_TURNOVER_LIKELIHOOD';
  sport = 'NFL';

  // Tunables
  private readonly MIN_RISK_TO_TRIGGER = 34;     // gate to emit
  private readonly HYSTERESIS = 6;               // drop below (34-6) to re-arm
  private readonly MAX_RISK = 75;                // clamp

  // State
  private lastRiskByGame = new Map<string, number>();         // gameId -> last risk

  // Down & distance base table (capped at 10 yards)
  private readonly DOWN_DISTANCE_RISK: Record<number, number[]> = {
    1: [0,2,3,4,5,6,7,8,9,10,12], // index = yardsToGo
    2: [0,4,5,6,7,8,9,11,13,15,18],
    3: [0,8,10,12,15,18,22,26,30,35,40],
    4: [0,15,20,25,30,35,40,45,50,55,60]
  };

  isTriggered(gs: GameState): boolean {
    if (gs.status !== 'live' || !gs.down || !gs.yardsToGo || !gs.fieldPosition) return false;

    // quick prefilter (cheap) – only consider classic turnover-prone moments
    const longThird = gs.down === 3 && gs.yardsToGo >= 8;
    const fourth = gs.down === 4;
    const deepOwn = gs.fieldPosition >= 65;             // own 35 or worse
    const endgame = gs.quarter === 4 && this.parseTimeToSeconds(gs.timeRemaining) <= 120;

    // Only wake the heavy logic when any of these is true.
    return longThird || fourth || deepOwn || endgame;
  }

  generateAlert(gs: GameState): AlertResult | null {
    // compute once
    const risk = this.calculateTurnoverRisk(gs);
    const last = this.lastRiskByGame.get(gs.gameId) ?? 0;

    // hysteresis gating: only fire on rising edge across threshold
    const armed = last <= (this.MIN_RISK_TO_TRIGGER - this.HYSTERESIS);
    const shouldEmit = risk >= this.MIN_RISK_TO_TRIGGER && (armed || risk > last + 4);

    this.lastRiskByGame.set(gs.gameId, risk);

    if (!shouldEmit) return null;

    const riskLevel = this.getRiskLevel(risk);
    const factors = this.identifyRiskFactors(gs);
    const possessionTeam = this.getPossessionTeam(gs);

    const signature = this.buildSignature(gs); // stable key segments
    const alertKey = `${gs.gameId}:${this.alertType}:${signature}`;

    const message = this.composeMessage(gs, risk, riskLevel, factors[0]);

    return {
      alertKey,
      type: this.alertType,
      message: `${gs.awayTeam} @ ${gs.homeTeam} | ${message}`,
      displayMessage: `🏈 ${message} | Q${gs.quarter}`,
      context: {
        gameId: gs.gameId,
        sport: this.sport,
        homeTeam: gs.homeTeam,
        awayTeam: gs.awayTeam,
        homeScore: gs.homeScore,
        awayScore: gs.awayScore,
        possessionTeam,
        down: gs.down,
        yardsToGo: gs.yardsToGo,
        fieldPosition: gs.fieldPosition,
        quarter: gs.quarter,
        timeRemaining: gs.timeRemaining,
        turnoverRisk: Math.round(risk),
        riskLevel,
        riskFactors: factors,
        primaryRiskFactor: factors[0] || 'Standard Situation',
        situationDescription: this.getSituationDescription(gs),
        alertType: 'PREDICTIVE',
        predictionCategory: 'TURNOVER_RISK',
        nflContext: {
          isFourthDown: gs.down === 4,
          isDeepInOwnTerritory: (gs.fieldPosition ?? 0) >= 80,
          scoreDifferential: Math.abs((gs.homeScore ?? 0) - (gs.awayScore ?? 0)),
          timePressure: this.classifyTimePressure(gs)
        }
      },
      priority: risk >= 50 ? 95 : risk >= 40 ? 90 : 85
    };
  }

  calculateProbability(gs: GameState): number {
    return this.calculateTurnoverRisk(gs);
  }

  // ---------- Risk model ----------

  private calculateTurnoverRisk(gs: GameState): number {
    if (!gs.down || !gs.yardsToGo || !gs.fieldPosition) return 0;

    // 1) base from down & distance (capped at 10 yards)
    const down = Math.min(gs.down, 4);
    const ytg = Math.min(Math.max(gs.yardsToGo, 1), 10);
    let score = this.DOWN_DISTANCE_RISK[down]?.[ytg] ?? 5;

    // 2) field position (unified semantics)
    score += this.fieldPositionRisk(gs.fieldPosition);

    // 3) situational adders (additive, not multiplicative to avoid blowups)
    score += this.situationAdders(gs);

    // 4) time + score pressure
    score += this.timePressureAdder(gs);
    score += this.desperationAdder(gs);

    // clamp
    return Math.min(Math.max(score, 1), this.MAX_RISK);
  }

  // Own territory is risky (80–99). Opp red zone gets a *small* uptick (traffic).
  private fieldPositionRisk(fpRaw: number): number {
    const fp = Math.min(Math.max(fpRaw, 1), 99);
    if (fp >= 90) return 35;         // own 10
    if (fp >= 80) return 26;         // own 20
    if (fp >= 70) return 22;         // own 30
    if (fp >= 60) return 18;         // own 40
    if (fp >= 50) return 15;         // midfield
    if (fp >= 40) return 12;         // opp 40+
    if (fp >= 21) return 9;          // opp 39–21
    // opp red zone 1–20
    if (fp >= 10) return 11;         // slight congestion uptick
    return 13;                        // goal-to-go congestion
  }

  private situationAdders(gs: GameState): number {
    let add = 0;
    if (gs.down === 4) {
      add += gs.yardsToGo >= 5 ? 15 : 8;      // 4th-down urgency
    }
    if (gs.down === 3 && gs.yardsToGo >= 15) add += 8;       // 3rd & very long
    if (gs.down === 3 && gs.yardsToGo >= 8)  add += 4;       // 3rd & long
    // Goal line stand: defense has leverage on 3rd/4th & <=2 inside the 5
    if (gs.fieldPosition && gs.fieldPosition <= 5 && gs.down >= 3 && (gs.yardsToGo ?? 0) <= 2) {
      add += 6;
    }
    return add;
  }

  private timePressureAdder(gs: GameState): number {
    if (!gs.quarter || !gs.timeRemaining) return 0;
    const t = this.parseTimeToSeconds(gs.timeRemaining);
    if (gs.quarter === 4) {
      if (t <= 60) return 12;
      if (t <= 120) return 8;
      if (t <= 300) return 5;
      return 2;
    }
    if (gs.quarter === 2 && t <= 120) return 4; // end of half
    return 0;
    }

  private desperationAdder(gs: GameState): number {
    const h = gs.homeScore ?? 0, a = gs.awayScore ?? 0;
    if (!gs.quarter || !gs.timeRemaining) return 0;
    const t = this.parseTimeToSeconds(gs.timeRemaining);
    const diff = Math.abs(h - a);
    if (gs.quarter === 4 && t <= 300) {
      if (diff >= 14) return 10;
      if (diff >= 7)  return 6;
      if (diff >= 3)  return 3;
    }
    if (gs.quarter === 4 && t <= 120 && diff > 0) {
      return diff >= 7 ? 8 : 5; // keep total additive sane
    }
    return 0;
  }

  // ---------- Message + helpers ----------

  private getRiskLevel(r: number): RiskLevel {
    if (r >= 50) return 'CRITICAL';
    if (r >= 40) return 'HIGH';
    if (r >= 30) return 'ELEVATED';
    if (r >= 20) return 'MODERATE';
    return 'LOW';
  }

  private identifyRiskFactors(gs: GameState): string[] {
    const f: string[] = [];
    if (gs.down === 4) f.push('Fourth Down Conversion');
    if (gs.down === 3 && gs.yardsToGo! >= 15) f.push('Very Long Third Down');
    else if (gs.down === 3 && gs.yardsToGo! >= 8) f.push('Long Third Down');
    if ((gs.fieldPosition ?? 0) >= 80) f.push('Deep Own Territory');
    if ((gs.fieldPosition ?? 100) <= 10) f.push('Goal Line Pressure');
    if (gs.quarter === 4) {
      const t = this.parseTimeToSeconds(gs.timeRemaining);
      if (t <= 60) f.push('Final Minute');
      else if (t <= 120) f.push('Two-Minute Warning');
    }
    const diff = Math.abs((gs.homeScore ?? 0) - (gs.awayScore ?? 0));
    if (diff >= 7 && gs.quarter === 4) f.push('Desperation Situation');
    return f.length ? f : ['Standard Situation'];
  }

  private composeMessage(gs: GameState, risk: number, level: RiskLevel, primary: string | undefined): string {
    const down = this.getOrdinal(gs.down || 1);
    const ytg = gs.yardsToGo || 10;
    const fp = gs.fieldPosition || 50;

    const posDesc =
      fp <= 20 ? `at opponent ${fp}-yard line` :
      fp >= 80 ? `at own ${100 - fp}-yard line` :
                 `at ${fp}-yard line`;

    let tag =
      level === 'CRITICAL' ? 'High turnover risk' :
      level === 'HIGH'     ? 'Elevated turnover risk' :
      level === 'ELEVATED' ? 'Moderate turnover risk' :
      level === 'MODERATE' ? 'Turnover risk' : 'Turnover potential';

    if (primary && primary !== 'Standard Situation') {
      const map: Record<string,string> = {
        'Fourth Down Conversion': 'Critical 4th down risk',
        'Very Long Third Down':   'Very long 3rd down risk',
        'Long Third Down':        'Long 3rd down risk',
        'Deep Own Territory':     'Own territory turnover risk',
        'Goal Line Pressure':     'Goal line traffic risk',
        'Desperation Situation':  'High-pressure turnover risk'
      };
      tag = map[primary] ?? tag;
    }

    return `${down} & ${ytg} ${posDesc} — ${tag} (${Math.round(risk)}%)`;
  }

  private buildSignature(gs: GameState): string {
    // Bucket time to 15s to reduce churn; include down/ytg/field/quarter/possession side
    const t = this.bucketTime(this.parseTimeToSeconds(gs.timeRemaining), 15);
    const side = (gs.possession && (gs.possession === gs.homeTeam || gs.possession === gs.awayTeam)) ? gs.possession : 'UNK';
    return `Q${gs.quarter}|T${t}|D${gs.down}|Y${Math.min(gs.yardsToGo ?? 0, 10)}|FP${gs.fieldPosition}|P${side}`;
  }

  private getPossessionTeam(gs: GameState): string {
    if (gs.possession && (gs.possession === gs.homeTeam || gs.possession === gs.awayTeam)) return gs.possession;
    return 'Possessing Team';
  }

  private getSituationDescription(gs: GameState): string {
    return `${this.getOrdinal(gs.down || 1)} & ${gs.yardsToGo || 10} at ${gs.fieldPosition || 50}-yard line`;
  }

  private getOrdinal(n: number): string {
    const ord = ['', '1st','2nd','3rd','4th'];
    return ord[n] || `${n}th`;
  }

  private classifyTimePressure(gs: GameState): 'normal'|'elevated'|'critical' {
    const t = this.parseTimeToSeconds(gs.timeRemaining);
    if (gs.quarter === 4 && t <= 60) return 'critical';
    if (gs.quarter === 4 && t <= 300) return 'elevated';
    if (gs.quarter === 2 && t <= 120) return 'elevated';
    return 'normal';
  }

  private parseTimeToSeconds(timeString?: string): number {
    if (!timeString) return 0;
    const clean = timeString.trim().split(/\s+/)[0]; // handles "1:23 4th"
    if (clean.includes(':')) {
      const [m,s] = clean.split(':').map(v => Number.parseInt(v,10) || 0);
      return m*60 + s;
    }
    return Number.parseInt(clean,10) || 0;
  }

  private bucketTime(seconds: number, bucket: number): number {
    return Math.max(0, Math.floor(seconds / bucket) * bucket);
  }
}
