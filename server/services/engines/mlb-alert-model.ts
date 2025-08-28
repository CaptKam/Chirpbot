// mlbAlertModel.ts
//
// Math-driven module that estimates probability of ≥1 run scoring
// in remainder of inning across all 24 base/out states.
// Implements ChirpBot v3 severity bands: Low (≥65%), Medium (≥70%), High (≥80%)

export interface MLBGameState {
  runners: { first: boolean; second: boolean; third: boolean };
  outs: number;
  currentBatter?: {
    name: string;
    stats: { hr: number; avg: number; ops: number };
  };
  currentPitcher?: {
    name: string;
    stats: { era: number; whip: number };
  };
  ballpark?: string;
  weather?: {
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
  };
  inning: number;
  homeScore: number;
  awayScore: number;
  inningState: string;
}

interface SeverityResult {
  severity: 'Low' | 'Medium' | 'High' | 'None';
  probability: number;
  priority: number;
  reasons: string[];
  baseProb: number;
  modifiers: { [key: string]: number };
}

// Base Run Probability (RP24) table - probability of scoring ≥1 run
const RP24_TABLE: Record<string, number> = {
  "000-0": 0.27, "000-1": 0.17, "000-2": 0.07,
  "100-0": 0.43, "100-1": 0.28, "100-2": 0.14,
  "010-0": 0.62, "010-1": 0.43, "010-2": 0.23,
  "001-0": 0.68, "001-1": 0.67, "001-2": 0.30,
  "110-0": 0.61, "110-1": 0.44, "110-2": 0.23,
  "101-0": 0.69, "101-1": 0.56, "101-2": 0.32,
  "011-0": 0.84, "011-1": 0.71, "011-2": 0.41,
  "111-0": 0.85, "111-1": 0.66, "111-2": 0.41,
};

/**
 * Calculate base run probability from RP24 table
 */
function getBaseRunProbability(gameState: MLBGameState): number {
  const { runners, outs } = gameState;
  const key = `${runners.first ? 1 : 0}${runners.second ? 1 : 0}${runners.third ? 1 : 0}-${outs}`;
  return RP24_TABLE[key] || 0.27; // Default to empty bases, 0 outs
}

/**
 * Apply leverage modifier based on game situation
 */
function getLeverageModifier(gameState: MLBGameState): { modifier: number; reason?: string } {
  const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
  const inning = gameState.inning;
  const isLate = inning >= 7;
  const isClose = scoreDiff <= 2;
  
  if (isLate && isClose && inning >= 9) {
    return { modifier: 1.15, reason: "Late inning pressure (9th+)" };
  } else if (isLate && isClose) {
    return { modifier: 1.10, reason: "Late inning leverage" };
  } else if (isClose) {
    return { modifier: 1.05, reason: "Close game leverage" };
  }
  
  return { modifier: 1.0 };
}

/**
 * Apply power hitter modifier
 */
function getPowerHitterModifier(gameState: MLBGameState): { modifier: number; reason?: string } {
  if (!gameState.currentBatter?.stats) return { modifier: 1.0 };
  
  const { hr, ops } = gameState.currentBatter.stats;
  const isPowerHitter = hr >= 20 || ops >= 0.850;
  
  if (isPowerHitter && (gameState.runners.second || gameState.runners.third)) {
    return { modifier: 1.12, reason: `Power hitter (${hr} HR, .${Math.round(ops*1000)} OPS) in scoring position` };
  } else if (isPowerHitter) {
    return { modifier: 1.08, reason: `Power hitter at bat (${hr} HR)` };
  }
  
  return { modifier: 1.0 };
}

/**
 * Apply pitcher risk modifier
 */
function getPitcherRiskModifier(gameState: MLBGameState): { modifier: number; reason?: string } {
  if (!gameState.currentPitcher?.stats) return { modifier: 1.0 };
  
  const { era, whip } = gameState.currentPitcher.stats;
  const isRisky = era >= 4.5 || whip >= 1.4;
  
  if (isRisky) {
    return { modifier: 1.06, reason: `Struggling pitcher (${era.toFixed(2)} ERA, ${whip.toFixed(2)} WHIP)` };
  }
  
  return { modifier: 1.0 };
}

/**
 * Apply weather modifier
 */
function getWeatherModifier(gameState: MLBGameState): { modifier: number; reason?: string } {
  if (!gameState.weather?.windSpeed || !gameState.weather?.windDirection) {
    return { modifier: 1.0 };
  }
  
  const { windSpeed, windDirection } = gameState.weather;
  const isWindAiding = windDirection === 'out' || windDirection === 'blowing out';
  
  if (isWindAiding && windSpeed >= 10) {
    return { modifier: 1.08, reason: `Wind blowing out at ${windSpeed} mph` };
  } else if (isWindAiding && windSpeed >= 6) {
    return { modifier: 1.04, reason: `Light wind boost (${windSpeed} mph out)` };
  }
  
  return { modifier: 1.0 };
}

/**
 * Apply ballpark factor
 */
function getBallparkModifier(gameState: MLBGameState): { modifier: number; reason?: string } {
  if (!gameState.ballpark) return { modifier: 1.0 };
  
  const hitterParks = ['Coors Field', 'Great American Ballpark', 'Yankee Stadium'];
  const pitcherParks = ['Marlins Park', 'Tropicana Field', 'Oakland Coliseum'];
  
  if (hitterParks.includes(gameState.ballpark)) {
    return { modifier: 1.05, reason: `Hitter-friendly ${gameState.ballpark}` };
  } else if (pitcherParks.includes(gameState.ballpark)) {
    return { modifier: 0.96, reason: `Pitcher-friendly ${gameState.ballpark}` };
  }
  
  return { modifier: 1.0 };
}

/**
 * Main function to calculate MLB alert severity
 */
export function calculateMLBSeverity(gameState: MLBGameState): SeverityResult {
  // Get base probability
  const baseProb = getBaseRunProbability(gameState);
  
  // Apply all modifiers
  const leverageMod = getLeverageModifier(gameState);
  const powerMod = getPowerHitterModifier(gameState);
  const pitcherMod = getPitcherRiskModifier(gameState);
  const weatherMod = getWeatherModifier(gameState);
  const ballparkMod = getBallparkModifier(gameState);
  
  // Calculate final probability
  const totalModifier = leverageMod.modifier * powerMod.modifier * 
                       pitcherMod.modifier * weatherMod.modifier * ballparkMod.modifier;
  const finalProb = Math.min(baseProb * totalModifier, 0.95); // Cap at 95%
  
  // Collect reasons
  const reasons: string[] = [];
  const modifiers: { [key: string]: number } = {};
  
  if (leverageMod.reason) {
    reasons.push(leverageMod.reason);
    modifiers.leverage = leverageMod.modifier;
  }
  if (powerMod.reason) {
    reasons.push(powerMod.reason);
    modifiers.power = powerMod.modifier;
  }
  if (pitcherMod.reason) {
    reasons.push(pitcherMod.reason);
    modifiers.pitcher = pitcherMod.modifier;
  }
  if (weatherMod.reason) {
    reasons.push(weatherMod.reason);
    modifiers.weather = weatherMod.modifier;
  }
  if (ballparkMod.reason) {
    reasons.push(ballparkMod.reason);
    modifiers.ballpark = ballparkMod.modifier;
  }
  
  // Determine severity band
  let severity: 'Low' | 'Medium' | 'High' | 'None' = 'None';
  let priority = 50;
  
  if (finalProb >= 0.80) {
    severity = 'High';
    priority = 95;
  } else if (finalProb >= 0.70) {
    severity = 'Medium';
    priority = 85;
  } else if (finalProb >= 0.65) {
    severity = 'Low';
    priority = 75;
  }
  
  return {
    severity,
    probability: finalProb,
    priority,
    reasons,
    baseProb,
    modifiers
  };
}

/**
 * Helper functions for each alert level
 */
export function mlbL1WithProb(gameState: MLBGameState): SeverityResult {
  const result = calculateMLBSeverity(gameState);
  return result.severity === 'Low' ? result : { ...result, severity: 'None', priority: 50 };
}

export function mlbL2WithProb(gameState: MLBGameState): SeverityResult {
  const result = calculateMLBSeverity(gameState);
  return result.severity === 'Medium' ? result : { ...result, severity: 'None', priority: 50 };
}

export function mlbL3WithProb(gameState: MLBGameState): SeverityResult {
  const result = calculateMLBSeverity(gameState);
  return result.severity === 'High' ? result : { ...result, severity: 'None', priority: 50 };
}