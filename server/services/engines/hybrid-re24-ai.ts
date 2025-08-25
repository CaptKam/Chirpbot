
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced RE24 + RP24 table with both expected runs AND probability of scoring ≥1 run
const RE24_RP24: Record<string, { RE: number; RP: number }> = {
  "000-0": { RE: 0.50, RP: 0.27 }, // Empty bases: 50% expected runs, 27% chance of ≥1 run
  "000-1": { RE: 0.27, RP: 0.17 },
  "000-2": { RE: 0.11, RP: 0.07 },
  "100-0": { RE: 0.90, RP: 0.43 }, // Runner on 1st: 90% expected runs, 43% chance of ≥1 run
  "100-1": { RE: 0.54, RP: 0.28 },
  "100-2": { RE: 0.25, RP: 0.14 },
  "010-0": { RE: 1.14, RP: 0.62 }, // Runner on 2nd: higher scoring probability
  "010-1": { RE: 0.70, RP: 0.43 },
  "010-2": { RE: 0.33, RP: 0.23 },
  "001-0": { RE: 1.32, RP: 0.68 }, // Runner on 3rd: very high scoring probability
  "001-1": { RE: 0.94, RP: 0.67 },
  "001-2": { RE: 0.36, RP: 0.30 },
  "110-0": { RE: 1.50, RP: 0.61 }, // Runners on 1st & 2nd
  "110-1": { RE: 0.95, RP: 0.44 },
  "110-2": { RE: 0.45, RP: 0.23 },
  "101-0": { RE: 1.68, RP: 0.69 }, // Runners on 1st & 3rd
  "101-1": { RE: 1.08, RP: 0.56 },
  "101-2": { RE: 0.47, RP: 0.32 },
  "011-0": { RE: 1.95, RP: 0.84 }, // Runners on 2nd & 3rd
  "011-1": { RE: 1.24, RP: 0.71 },
  "011-2": { RE: 0.54, RP: 0.41 },
  "111-0": { RE: 2.25, RP: 0.85 }, // Bases loaded: 225% expected runs, 85% chance of ≥1 run
  "111-1": { RE: 1.54, RP: 0.66 }, // This is the corrected example from your note
  "111-2": { RE: 0.76, RP: 0.41 }, // 0.76 expected runs ≠ 76% probability!
};

interface MLBGameState {
  gameId: string;
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: { first: boolean; second: boolean; third: boolean };
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  currentBatter?: {
    id: number;
    name: string;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      obp: number;
      ops: number;
      slg: number;
    };
  };
  currentPitcher?: {
    id: number;
    name: string;
    throwHand: string;
    stats: {
      era: number;
      whip: number;
      strikeOuts: number;
      wins: number;
      losses: number;
    };
  };
  weather?: {
    temperature?: number;
    description?: string;
    windSpeed?: number;
    precipitation?: string;
  };
}

interface HybridRE24Result {
  // Mathematical foundation
  expectedRuns: number; // RE: How big could the inning be?
  scoringProbability: number; // RP: Will at least one run score?
  re24Key: string;

  // AI-enhanced context
  leverageFactor: number;
  aiContextMultiplier: number;
  weatherMultiplier: number;
  finalProbability: number;
  aiInsight: string;
  confidence: number;

  // Weather integration
  weatherAnalysis: {
    impact: string;
    alert: string;
  };

  // Combined analysis
  isHighLeverage: boolean;
  bettingRecommendation?: string;
  alertPriority: number;
}

// Cache for AI results
const aiCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

// Prediction tracking for calibration
const predictionTracker = new Map<string, {
  predicted: number;
  actual: boolean;
  timestamp: number;
  gameContext: string;
}>();

function reKey(r: { first: boolean; second: boolean; third: boolean }, outs: number) {
  return `${r.first ? 1 : 0}${r.second ? 1 : 0}${r.third ? 1 : 0}-${outs}`;
}

function clamp(x: number, lo: number, hi: number) { 
  return Math.max(lo, Math.min(hi, x)); 
}

// Smooth priority mapping using logistic function
function calculateSmoothPriority(probability: number, k: number = 8, m: number = 0.7): number {
  // Logistic function: priority = 100 / (1 + exp(-k*(prob - m)))
  // k controls steepness, m controls midpoint
  const logistic = 100 / (1 + Math.exp(-k * (probability - m)));
  return Math.round(clamp(logistic, 30, 100));
}

// Generate cache key for AI context analysis
function generateCacheKey(gameState: MLBGameState): string {
  const batter = gameState.currentBatter;
  const pitcher = gameState.currentPitcher;

  return [
    reKey(gameState.runners, gameState.outs),
    gameState.inning,
    gameState.inningState,
    Math.abs(gameState.homeScore - gameState.awayScore),
    batter ? `${batter.stats.avg.toFixed(3)}-${batter.stats.hr}-${batter.stats.ops.toFixed(3)}` : 'no-batter',
    pitcher ? `${pitcher.stats.era.toFixed(2)}-${pitcher.stats.whip.toFixed(2)}` : 'no-pitcher',
    gameState.weather ? `${gameState.weather.temperature}-${gameState.weather.description}-${gameState.weather.windSpeed}-${gameState.weather.precipitation}` : 'no-weather'
  ].join('|');
}

// Fast mathematical RE24+RP24 calculation (always runs)
function calculateBaseRE24RP24(gameState: MLBGameState): {
  expectedRuns: number;
  scoringProbability: number;
  re24Key: string;
} {
  const key = reKey(gameState.runners, gameState.outs);
  const data = RE24_RP24[key] || { RE: 0.50, RP: 0.27 }; // Default fallback

  return {
    expectedRuns: data.RE,
    scoringProbability: data.RP, // Use RP directly, not derived from RE
    re24Key: key
  };
}

// Calculate leverage factor (separate from AI/weather)
function calculateLeverageFactor(gameState: MLBGameState): number {
  let leverage = 1.0;

  // Late-inning pressure (inning 8+)
  if (gameState.inning >= 8) {
    leverage *= 1.15;
  }

  // Close game pressure (≤2 run difference)
  const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
  if (scoreDiff <= 1) {
    leverage *= 1.10;
  } else if (scoreDiff <= 2) {
    leverage *= 1.05;
  }

  // High-leverage base-out states (runners in scoring position with <2 outs)
  if ((gameState.runners.second || gameState.runners.third) && gameState.outs < 2) {
    leverage *= 1.08;
  }

  return leverage;
}

// AI contextual enhancement (selective, cached)
async function getAIContextMultiplier(gameState: MLBGameState, baseProbability: number): Promise<{
  multiplier: number;
  insight: string;
  confidence: number;
}> {
  const cacheKey = generateCacheKey(gameState);

  // Check cache first
  const cached = aiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  try {
    // Only call AI for high-leverage situations (save API costs)
    const isHighLeverage = baseProbability >= 0.60 || gameState.inning >= 8 || 
      Math.abs(gameState.homeScore - gameState.awayScore) <= 2;

    if (!isHighLeverage) {
      return { multiplier: 1.0, insight: "Standard situation", confidence: 85 };
    }

    const batter = gameState.currentBatter;
    const pitcher = gameState.currentPitcher;

    const prompt = `
🔬 BASEBALL ANALYTICS - Contextual Probability Enhancement

📊 GAME SITUATION:
${gameState.awayTeam} @ ${gameState.homeTeam} | ${gameState.inning}${gameState.inningState === 'top' ? 'T' : 'B'} | Score: ${gameState.awayScore}-${gameState.homeScore}
Base Runners: ${gameState.runners.first ? '1st ' : ''}${gameState.runners.second ? '2nd ' : ''}${gameState.runners.third ? '3rd ' : ''}${gameState.outs} outs
Base Scoring Probability: ${(baseProbability * 100).toFixed(1)}%

🏏 BATTER PROFILE:
${batter ? `${batter.name} (${batter.batSide}H): ${(batter.stats.avg * 1000).toFixed(0)} AVG | ${batter.stats.hr} HR | ${batter.stats.ops.toFixed(3)} OPS` : 'Unknown Batter'}

⚾ PITCHER ANALYSIS:
${pitcher ? `${pitcher.name} (${pitcher.throwHand}HP): ${pitcher.stats.era.toFixed(2)} ERA | ${pitcher.stats.whip.toFixed(2)} WHIP | ${pitcher.stats.strikeOuts} K` : 'Unknown Pitcher'}

☁️ WEATHER CONDITIONS:
Temperature: ${gameState.weather?.temperature ?? 'N/A'} | Conditions: ${gameState.weather?.description ?? 'N/A'} | Wind: ${gameState.weather?.windSpeed ?? 'N/A'} mph

🧠 PROVIDE ANALYSIS:
Multiplier (0.8-1.3): Mathematical adjustment for context
Insight: Primary factor driving adjustment
Confidence (75-95): Data quality and certainty level

FORMAT: "Multiplier: X.X | Insight: [key factor] | Confidence: XX"
`;

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.3,
    });

    const aiResponse = response.choices[0]?.message?.content?.trim() || '';

    // Parse AI response
    const multiplierMatch = aiResponse.match(/Multiplier:\s*([\d.]+)/);
    const insightMatch = aiResponse.match(/Insight:\s*([^|]+)/);
    const confidenceMatch = aiResponse.match(/Confidence:\s*(\d+)/);

    const result = {
      multiplier: multiplierMatch ? parseFloat(multiplierMatch[1]) : 1.0,
      insight: insightMatch ? insightMatch[1].trim() : "AI analysis pending",
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 80
    };

    // Clamp multiplier to reasonable bounds
    result.multiplier = clamp(result.multiplier, 0.8, 1.3);

    // Cache the result
    aiCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;

  } catch (error) {
    console.error('AI context analysis failed:', error);
    return { multiplier: 1.0, insight: "Using mathematical baseline", confidence: 75 };
  }
}

// Analyze weather impact
function analyzeWeatherImpact(gameState: MLBGameState): { 
  multiplier: number; 
  impact: string; 
  alert: string; 
} {
  const weather = gameState.weather;

  if (!weather) {
    return { multiplier: 1.0, impact: "No weather data", alert: "" };
  }

  let multiplier = 1.0;
  let impact = "Neutral";
  let alert = "";

  if (weather.description?.toLowerCase().includes("rain") || weather.precipitation?.toLowerCase().includes("rain")) {
    multiplier = 0.85;
    impact = "Negative";
    alert = "Rain may delay or affect game play.";
  } else if (weather.description?.toLowerCase().includes("windy") && weather.windSpeed && weather.windSpeed > 15) {
    multiplier = 0.90;
    impact = "Moderate";
    alert = `High winds could affect fly balls and pitching. (Wind: ${weather.windSpeed} mph)`;
  } else if (weather.temperature && weather.temperature < 40) {
    multiplier = 0.93;
    impact = "Moderate";
    alert = `Cold conditions may impact offensive performance. (Temp: ${weather.temperature}°F)`;
  } else if (weather.windSpeed && weather.windSpeed > 10 && weather.windSpeed <= 15) {
    multiplier = 1.05; // Slight boost for favorable wind
    impact = "Favorable";
    alert = `Favorable wind conditions for offense. (Wind: ${weather.windSpeed} mph)`;
  }

  return { multiplier, impact, alert };
}

// Main hybrid analysis function using Path A (probability path)
export async function analyzeHybridRE24(gameState: MLBGameState): Promise<HybridRE24Result> {
  // Step 1: Fast mathematical foundation (always runs)
  const baseAnalysis = calculateBaseRE24RP24(gameState);

  // Step 2: Calculate leverage factor (separate from AI/weather)
  const leverageFactor = calculateLeverageFactor(gameState);

  // Step 3: AI contextual enhancement (selective)
  const aiContext = await getAIContextMultiplier(gameState, baseAnalysis.scoringProbability);

  // Step 4: Weather integration analysis
  const weatherAnalysis = analyzeWeatherImpact(gameState);

  // Step 5: Path A - Apply all factors to probability
  const finalProbability = clamp(
    baseAnalysis.scoringProbability * leverageFactor * aiContext.multiplier * weatherAnalysis.multiplier,
    0.02, // 2% minimum
    0.98  // 98% maximum
  );

  // Step 6: Calculate smooth priority using logistic function
  const alertPriority = calculateSmoothPriority(finalProbability);

  // Step 7: Enhanced betting intelligence
  const isHighLeverage = finalProbability >= 0.75 || gameState.inning >= 8;
  const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
  const totalScore = gameState.homeScore + gameState.awayScore;

  let bettingRecommendation = undefined;

  if (isHighLeverage && finalProbability >= 0.90) {
    bettingRecommendation = `🔥 ELITE BET: ${(finalProbability * 100).toFixed(1)}% | Live Over ${(totalScore + 2.5).toFixed(1)} | MAX UNIT SIZE`;
  } else if (finalProbability >= 0.85 && gameState.runners.first && gameState.runners.second && gameState.runners.third) {
    bettingRecommendation = `💎 BASES LOADED: ${(finalProbability * 100).toFixed(1)}% | Expected: +${baseAnalysis.expectedRuns.toFixed(1)} runs`;
  } else if (finalProbability >= 0.80 && gameState.currentBatter?.stats.hr >= 20) {
    bettingRecommendation = `⚡ HR PROP: ${gameState.currentBatter.name} +350 | ${(finalProbability * 100).toFixed(1)}% leverage`;
  } else if (finalProbability <= 0.25 && gameState.inning >= 8 && scoreDiff <= 3) {
    bettingRecommendation = `🛡️ UNDER LOCK: ${((1-finalProbability) * 100).toFixed(1)}% confidence | Defensive situation`;
  }

  return {
    // Mathematical foundation
    expectedRuns: baseAnalysis.expectedRuns,
    scoringProbability: baseAnalysis.scoringProbability,
    re24Key: baseAnalysis.re24Key,

    // Enhancement factors
    leverageFactor,
    aiContextMultiplier: aiContext.multiplier,
    weatherMultiplier: weatherAnalysis.multiplier,
    finalProbability,
    aiInsight: aiContext.insight,
    confidence: aiContext.confidence,

    // Weather integration
    weatherAnalysis: {
      impact: weatherAnalysis.impact,
      alert: weatherAnalysis.alert
    },

    // Combined analysis
    isHighLeverage,
    bettingRecommendation,
    alertPriority
  };
}

// Utility function to generate enhanced alert descriptions
export function generateHybridAlertDescription(
  analysis: HybridRE24Result,
  gameState: MLBGameState
): string {
  const runners = [];
  if (gameState.runners.first) runners.push('1ST');
  if (gameState.runners.second) runners.push('2ND');
  if (gameState.runners.third) runners.push('3RD');

  const runnerText = runners.length > 0 ? runners.join(' & ') : 'Empty bases';
  const batter = gameState.currentBatter;

  let description = `📊 HYBRID RE24: ${runnerText}, ${gameState.outs} out - ${(analysis.finalProbability * 100).toFixed(1)}% scoring probability`;

  // Show enhancement factors if significant
  if (analysis.leverageFactor > 1.05) {
    description += ` (Leverage: ${(analysis.leverageFactor * 100).toFixed(0)}%)`;
  }

  if (analysis.aiContextMultiplier !== 1.0) {
    const direction = analysis.aiContextMultiplier > 1.0 ? 'boosted' : 'adjusted';
    description += ` (AI ${direction}: ${(analysis.aiContextMultiplier * 100).toFixed(0)}%)`;
  }

  if (batter && analysis.confidence >= 85) {
    description += ` | ${batter.name} at bat`;
  }

  if (analysis.aiInsight && analysis.aiInsight !== "Standard situation") {
    description += ` | ${analysis.aiInsight}`;
  }

  if (analysis.weatherAnalysis.alert) {
    description += ` | ☁️ ${analysis.weatherAnalysis.alert}`;
  }

  // Add expected runs context for big innings
  if (analysis.expectedRuns >= 1.5) {
    description += ` | Expected: ${analysis.expectedRuns.toFixed(1)} runs`;
  }

  return description;
}

// Cache cleanup function
export function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of aiCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      aiCache.delete(key);
    }
  }
}

// Track prediction for calibration (call this when actual outcomes are known)
export function trackPrediction(
  gameId: string,
  predicted: number,
  actual: boolean,
  gameContext: string
) {
  predictionTracker.set(gameId, {
    predicted,
    actual,
    timestamp: Date.now(),
    gameContext
  });
}

// Get calibration metrics
export function getCalibrationMetrics(): {
  totalPredictions: number;
  averageCalibration: number;
  recentAccuracy: number;
} {
  const predictions = Array.from(predictionTracker.values());
  
  if (predictions.length === 0) {
    return { totalPredictions: 0, averageCalibration: 0, recentAccuracy: 0 };
  }

  // Simple calibration: are our 70% predictions right ~70% of the time?
  const totalPredictions = predictions.length;
  const correctPredictions = predictions.filter(p => p.actual).length;
  const averageCalibration = correctPredictions / totalPredictions;

  // Recent accuracy (last 50 predictions)
  const recentPredictions = predictions.slice(-50);
  const recentCorrect = recentPredictions.filter(p => p.actual).length;
  const recentAccuracy = recentCorrect / recentPredictions.length;

  return {
    totalPredictions,
    averageCalibration,
    recentAccuracy
  };
}
