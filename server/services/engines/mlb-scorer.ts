
type BaseState = '---' | '1--' | '-2-' | '--3' | '12-' | '1-3' | '-23' | '123';

const RUN_EXPECTANCY: Record<number, Record<BaseState, number>> = {
  // Modern MLB RE to end of inning (runs)
  0: { '---': 0.50, '1--': 0.90, '-2-': 1.10, '--3': 1.30, '12-': 1.45, '1-3': 1.70, '-23': 1.90, '123': 2.30 },
  1: { '---': 0.26, '1--': 0.50, '-2-': 0.65, '--3': 0.90, '12-': 0.85, '1-3': 1.05, '-23': 1.45, '123': 1.55 },
  2: { '---': 0.10, '1--': 0.20, '-2-': 0.30, '--3': 0.35, '12-': 0.40, '1-3': 0.45, '-23': 0.55, '123': 0.75 },
};

function toBaseState(r1: boolean, r2: boolean, r3: boolean): BaseState {
  return `${r1 ? '1' : '-'}${r2 ? '2' : '-'}${r3 ? '3' : '-'}` as BaseState;
}

type Weather = { windSpeed?: number; windDirection?: string };
type Batter = { 
  stats: {
    avg?: number; hr?: number; rbi?: number; obp?: number; ops?: number; 
    slg?: number; atBats?: number; hits?: number; strikeOuts?: number; walks?: number;
  };
  batSide?: string;
};
type Pitcher = { 
  stats: {
    era?: number; whip?: number; strikeOuts?: number; wins?: number; losses?: number;
    inningsPitched?: string; hits?: number; earnedRuns?: number; homeRuns?: number;
  };
  throwHand?: string; 
};

type Park = { hrFactor?: number; runFactor?: number }; // 1.00 = neutral
type Game = { inning: number; inningState: 'top'|'bottom'; homeScore: number; awayScore: number };

export function scoreSituation(params: {
  // state
  outs: 0|1|2;
  runners: { first: boolean; second: boolean; third: boolean };
  // actors
  batter?: Batter;
  onDeck?: Batter;
  pitcher?: Pitcher;
  // env
  weather?: Weather;
  park?: Park;
  // game
  game: Game;
}) {
  const { outs, runners, batter, onDeck, pitcher, weather, park, game } = params;

  // --- 1) Run Expectancy (RE) ---
  const bs = toBaseState(runners.first, runners.second, runners.third);
  const RE_now = RUN_EXPECTANCY[outs][bs] ?? 0.3;
  const RE_norm = clamp(map(RE_now, 0, 2.5, 0, 100), 0, 100);

  // ΔRE if ball in play (RISP impact)
  const rispWeight = (runners.second || runners.third) ? (outs === 0 ? 1.0 : outs === 1 ? 0.8 : 0.25) : 0.25;
  const deltaRE = RE_now * rispWeight;
  const dRE_norm = clamp(map(deltaRE, 0, 2.0, 0, 100), 0, 100);

  // --- 2) Game Context ---
  const inningWeight = game.inning >= 8 ? 1.0 : game.inning >= 7 ? 0.8 : game.inning >= 6 ? 0.6 : 0.4;
  const scoreDiff = Math.abs(game.homeScore - game.awayScore);
  const closeness = scoreDiff === 0 ? 1.0 : scoreDiff === 1 ? 0.85 : scoreDiff === 2 ? 0.6 : 0.35;
  const context = 100 * inningWeight * closeness;

  // --- 3) Batter Threat ---
  const batterStats = batter?.stats || {};
  const ops = safe(batterStats.ops, 0.730);
  const hrRate = safe(batterStats.hr && batterStats.atBats ? batterStats.hr / batterStats.atBats : undefined, 0.04);
  const avg = safe(batterStats.avg, 0.250);

  const opsScore = clamp(map(ops, 0.600, 1.000, 0, 100), 0, 100);
  const hrScore = clamp(map(hrRate, 0.02, 0.08, 0, 100), 0, 100);
  const avgScore = clamp(map(avg, 0.200, 0.350, 0, 100), 0, 100);

  // Platoon advantage
  const platoonBoost = (batter?.batSide && pitcher?.throwHand && batter.batSide !== pitcher.throwHand) ? 1.08 : 1.00;
  const batterThreat = clamp((0.50*opsScore + 0.35*hrScore + 0.15*avgScore) * platoonBoost, 0, 100);

  // --- 4) On-Deck Threat ---
  const firstBaseOpen = !runners.first;
  const onDeckPower = onDeck ? scorePower(onDeck) : 0;
  let onDeckThreat = onDeckPower * (firstBaseOpen ? 1.00 : 0.50);
  
  // Strategic pressure with RISP
  if ((runners.second || runners.third) && firstBaseOpen) onDeckThreat *= 1.15;

  // --- 5) Weather Boost ---
  const windTowardOF = weather?.windDirection?.includes('out') || weather?.windDirection?.includes('W') ? 
    (weather.windSpeed || 0) : 0;
  const weatherHRBoostPct = Math.min(0.015 * windTowardOF, 0.15);
  const weatherScore = clamp(weatherHRBoostPct * 100, 0, 100);

  // --- 6) Park Factor ---
  const pfHR = clamp(map(safe(park?.hrFactor, 1.00), 0.90, 1.10, 0, 100), 0, 100);
  const pfRun = clamp(map(safe(park?.runFactor, 1.00), 0.92, 1.08, 0, 100), 0, 100);
  const parkScore = 0.6*pfHR + 0.4*pfRun;

  // --- 7) Pitcher State ---
  const pitcherStats = pitcher?.stats || {};
  const era = safe(pitcherStats.era, 4.50);
  const whip = safe(pitcherStats.whip, 1.30);
  
  const eraScore = clamp(map(era, 6.00, 2.50, 0, 100), 0, 100); // Lower ERA = higher threat to batter
  const whipScore = clamp(map(whip, 1.60, 0.90, 0, 100), 0, 100);
  const pitcherState = 0.6*eraScore + 0.4*whipScore;

  // --- Composite Score ---
  const composite =
      0.22*RE_norm +
      0.10*dRE_norm +
      0.18*context +
      0.18*batterThreat +
      0.10*onDeckThreat +
      0.10*weatherScore +
      0.07*parkScore +
      0.05*pitcherState;

  const priority = compositeToPriority(composite);

  return {
    priority,
    scores: {
      RE_norm: round(RE_norm, 1), 
      dRE_norm: round(dRE_norm, 1), 
      context: round(context, 1), 
      batterThreat: round(batterThreat, 1), 
      onDeckThreat: round(onDeckThreat, 1), 
      weatherScore: round(weatherScore, 1), 
      parkScore: round(parkScore, 1), 
      pitcherState: round(pitcherState, 1),
      composite: round(composite, 1),
    }
  };
}

// Helper functions
function safe(v: number|undefined, d: number): number { 
  return Number.isFinite(v) ? v! : d; 
}

function clamp(n: number, a: number, b: number): number { 
  return Math.max(a, Math.min(b, n)); 
}

function map(x: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const t = (x - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function round(n: number, d = 0): number { 
  const k = Math.pow(10, d); 
  return Math.round(n * k) / k; 
}

function scorePower(batter: Batter): number {
  const stats = batter.stats;
  const hrRate = safe(stats.hr && stats.atBats ? stats.hr / stats.atBats : undefined, 0.04);
  const ops = safe(stats.ops, 0.730);
  
  const s1 = clamp(map(hrRate, 0.02, 0.10, 0, 100), 0, 100);
  const s2 = clamp(map(ops, 0.600, 1.200, 0, 100), 0, 100);
  return 0.65*s1 + 0.35*s2;
}

function compositeToPriority(c: number): number {
  if (c >= 90) return 95;   // Critical
  if (c >= 80) return 90;   // High-value
  if (c >= 70) return 85;   // RISP / multi-factor
  if (c >= 60) return 75;   // Notify (Telegram)
  if (c >= 50) return 70;   // Trigger AI analysis
  return 60;                // Standard
}
