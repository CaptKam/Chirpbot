/*
 * MLB Probability Engine - Advanced alert generation using RE24 and statistical analysis
 * Calculates run-scoring probability and generates scored alerts with deduplication
 */

// Input game state interface
export interface MLBGameState {
  gameId: string;
  status: string;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  inning: { number: number; half: string };
  outs: number;
  runners: { first: boolean; second: boolean; third: boolean };
  batter?: { 
    name: string; 
    hr?: number; 
    pa?: number; 
    iso?: number; 
    slg?: number; 
  };
  weather?: { 
    roofOpen?: boolean; 
    windOutToOutfield?: boolean; 
    windMph?: number; 
  };
}

// Output alert interface
export interface ProbabilityAlert {
  id: string;
  alertKey: string;
  type: string;
  gameId: string;
  sport: string;
  message: string;
  score: number;
  createdAt: string;
  payload: any;
}

// RE24 lookup table (Run Expectancy by 24 base-out states)
const RE24: Record<string, number> = {
  "000_0": 0.461, "001_0": 0.243, "010_0": 1.100, "011_0": 0.897,
  "100_0": 0.831, "101_0": 0.508, "110_0": 1.373, "111_0": 1.140,
  "000_1": 0.243, "001_1": 0.095, "010_1": 0.644, "011_1": 0.413,
  "100_1": 0.508, "101_1": 0.203, "110_1": 0.908, "111_1": 0.588,
  "000_2": 0.095, "001_2": 0.027, "010_2": 0.305, "011_2": 0.142,
  "100_2": 0.203, "101_2": 0.047, "110_2": 0.413, "111_2": 0.188,
};

// Utility functions
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const norm100 = (x: number): number => Math.round(clamp01(x) * 100);

function inningTag(inningNum: number, half: string): string {
  return `${half.charAt(0).toUpperCase()}${inningNum}`;
}

function baseStateKey(runners: { first: boolean; second: boolean; third: boolean }, outs: number): string {
  const key = `${runners.first ? "1" : "0"}${runners.second ? "1" : "0"}${runners.third ? "1" : "0"}_${outs}`;
  return key;
}

function getRE24(runners: { first: boolean; second: boolean; third: boolean }, outs: number): number {
  const key = baseStateKey(runners, outs);
  return RE24[key] ?? 0.461; // Default to bases empty, 0 outs
}

// Main evaluation function
export function evaluateGameForAlerts(game: MLBGameState): ProbabilityAlert[] {
  if (game.status !== "LIVE") return [];

  const alerts: ProbabilityAlert[] = [];
  const nowIso = new Date().toISOString();
  const inningNum = game.inning.number;
  const half = game.inning.half;
  const outs = game.outs;

  // Calculate base run expectancy
  const pRun = getRE24(game.runners, outs);

  // ---- 1) RISP (Runners in Scoring Position) ----
  if (game.runners.second || game.runners.third) {
    const rispBonus = game.runners.third ? 0.15 : 0.10;
    const key = `RISP:${game.gameId}:${inningTag(inningNum, half)}:${outs}`;
    const score = norm100(0.55 + rispBonus);
    
    const positions = [];
    if (game.runners.second) positions.push("2nd");
    if (game.runners.third) positions.push("3rd");
    
    alerts.push({
      id: key,
      alertKey: key,
      type: 'RISP_CHANCE',
      gameId: game.gameId,
      sport: 'MLB',
      message: `🎯 RISP OPPORTUNITY — ${positions.join(" & ")} base, ${outs} outs. Scoring probability ${Math.round(pRun * 100)}%.`,
      score,
      createdAt: nowIso,
      payload: { 
        pRunBase: pRun, 
        runners: game.runners, 
        outs,
        inning: game.inning,
        positions 
      }
    });
  }

  // ---- 2) Bases loaded ----
  if (game.runners.first && game.runners.second && game.runners.third) {
    const key = `BASES:${game.gameId}:${inningTag(inningNum, half)}:${outs}`;
    const score = norm100(0.85);
    alerts.push({
      id: key,
      alertKey: key,
      type: 'BASES_LOADED',
      gameId: game.gameId,
      sport: 'MLB',
      message: `🔥 BASES LOADED — Maximum pressure situation, ${outs} outs.`,
      score,
      createdAt: nowIso,
      payload: { 
        pRunBase: pRun, 
        runners: game.runners, 
        outs,
        inning: game.inning 
      }
    });
  }

  // ---- 3) High scoring probability (general) ----
  if (pRun >= 1.0) {
    const key = `PROB:${game.gameId}:${inningTag(inningNum, half)}:${outs}`;
    const score = norm100(0.50 + Math.min(0.30, pRun * 0.20));
    alerts.push({
      id: key,
      alertKey: key,
      type: 'SCORING_PROBABILITY',
      gameId: game.gameId,
      sport: 'MLB',
      message: `📊 HIGH SCORING CHANCE — ${Math.round(pRun * 100)}% probability this half-inning.`,
      score,
      createdAt: nowIso,
      payload: { 
        pRunBase: pRun, 
        runners: game.runners, 
        outs,
        inning: game.inning 
      }
    });
  }

  // Calculate wind and weather modifiers
  const windBoost = game.weather?.windOutToOutfield && (game.weather?.windMph ?? 0) >= 10 
    ? Math.min(0.25, (game.weather.windMph - 10) * 0.02) 
    : 0;

  // Calculate batter power
  const batterPower = game.batter?.iso ? Math.max(1.0, game.batter.iso / 0.15) : 1.0;

  // ---- 4) Wind jetstream for HRs ----
  if (windBoost >= 0.10) {
    const key = `WIND:${game.gameId}:${inningTag(inningNum, half)}`;
    const score = norm100(0.60 + windBoost);
    alerts.push({
      id: key,
      alertKey: key,
      type: 'WIND_JETSTREAM',
      gameId: game.gameId,
      sport: 'MLB',
      message: `💨 WIND ASSIST — Tailwind ${game.weather?.windMph ?? 0} mph, roof ${game.weather?.roofOpen ? 'open' : 'closed'}.`,
      score,
      createdAt: nowIso,
      payload: { 
        windMph: game.weather?.windMph, 
        windOutToOutfield: game.weather?.windOutToOutfield, 
        roofOpen: game.weather?.roofOpen 
      }
    });
  }

  // ---- 5) HR hitter at bat ----
  if (batterPower >= 1.4) {
    const hrBias = clamp01(0.20 * (batterPower - 1.0) + windBoost);
    const key = `HRBAT:${game.gameId}:${inningTag(inningNum, half)}:${outs}`;
    const score = norm100(0.55 + hrBias);
    alerts.push({
      id: key,
      alertKey: key,
      type: 'HR_HITTER_AT_BAT',
      gameId: game.gameId,
      sport: 'MLB',
      message: `⚾ POWER HITTER UP — ${game.batter?.name ?? 'Batter'}. HR potential ${Math.round(hrBias * 100)}%.`,
      score,
      createdAt: nowIso,
      payload: { 
        batter: game.batter, 
        batterPower, 
        windBoost,
        hrBias 
      }
    });
  }

  // ---- 6) Late pressure / close game ----
  const totalRuns = (game.homeScore ?? 0) + (game.awayScore ?? 0);
  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  
  if (inningNum >= 8 && diff <= 1) {
    const key = `PRESSURE:${game.gameId}:${inningTag(inningNum, half)}`;
    const score = norm100(0.70 + 0.05 * (totalRuns >= 9 ? 1 : 0));
    alerts.push({
      id: key,
      alertKey: key,
      type: 'LATE_PRESSURE',
      gameId: game.gameId,
      sport: 'MLB',
      message: `🔥 LATE PRESSURE — ${half} ${inningNum}, one-run game.`,
      score,
      createdAt: nowIso,
      payload: { 
        totalRuns, 
        diff,
        inning: game.inning 
      }
    });
  }

  // ---- 7) Ninth inning tie ----
  if (inningNum >= 9 && diff === 0) {
    const key = `NINTH_TIE:${game.gameId}:${inningTag(inningNum, half)}`;
    const score = norm100(0.85);
    alerts.push({
      id: key,
      alertKey: key,
      type: 'NINTH_TIE',
      gameId: game.gameId,
      sport: 'MLB',
      message: `⚡ NINTH-INNING TIE — ${game.away} ${game.awayScore ?? 0} • ${game.home} ${game.homeScore ?? 0}.`,
      score,
      createdAt: nowIso,
      payload: { 
        inning: game.inning,
        homeScore: game.homeScore,
        awayScore: game.awayScore 
      }
    });
  }

  // ---- 8) Close game late (fallback) ----
  if (inningNum >= 7 && diff <= 1) {
    const key = `CGL:${game.gameId}:${inningTag(inningNum, half)}`;
    const score = norm100(0.65);
    alerts.push({
      id: key,
      alertKey: key,
      type: 'CLOSE_GAME_LATE',
      gameId: game.gameId,
      sport: 'MLB',
      message: `📈 CLOSE GAME — Late innings within one run.`,
      score,
      createdAt: nowIso,
      payload: { 
        inningNum, 
        diff,
        inning: game.inning 
      }
    });
  }

  return alerts.sort((a, b) => b.score - a.score);
}

// Demo game state for testing
export const __demo: MLBGameState = {
  gameId: 'MLB-776553',
  status: 'LIVE',
  home: 'Milwaukee Brewers',
  away: 'Arizona Diamondbacks',
  homeScore: 2,
  awayScore: 3,
  inning: { number: 8, half: 'Top' },
  outs: 1,
  runners: { first: false, second: true, third: true },
  batter: { name: 'Christian Walker', hr: 29, pa: 520, iso: 0.240, slg: 0.520 },
  weather: { roofOpen: true, windOutToOutfield: true, windMph: 16 },
};