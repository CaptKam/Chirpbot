
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { enhancedWeatherService } from '../enhanced-weather';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Your existing RE24 table from mlb-engine-backup.ts
const RE24: Record<string, number> = {
  "000-0": 0.50, "000-1": 0.27, "000-2": 0.11,
  "100-0": 0.90, "100-1": 0.54, "100-2": 0.25,
  "010-0": 1.14, "010-1": 0.70, "010-2": 0.33,
  "001-0": 1.32, "001-1": 0.94, "001-2": 0.36,
  "110-0": 1.50, "110-1": 0.95, "110-2": 0.45,
  "101-0": 1.68, "101-1": 1.08, "101-2": 0.47,
  "011-0": 1.95, "011-1": 1.24, "011-2": 0.54,
  "111-0": 2.25, "111-1": 1.54, "111-2": 0.76,
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
}

interface HybridRE24Result {
  // Mathematical foundation (fast, reliable)
  baseRE24Probability: number;
  expectedRuns: number;
  re24Key: string;
  
  // AI-enhanced context (intelligent, adaptive)
  aiContextMultiplier: number;
  finalProbability: number;
  aiInsight: string;
  confidence: number;
  
  // Weather integration
  weatherEffects?: {
    windSpeed: number;
    windDirection: string;
    windComponentToCenter: number;
    weatherDescription: string;
    weatherEmoji: string;
  };
  
  // Combined analysis
  isHighLeverage: boolean;
  betingRecommendation?: string;
  alertPriority: number;
}

// Cache for AI results to avoid excessive API calls
const aiCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

// Learning system for prediction accuracy tracking
const predictionTracker = new Map<string, {
  predicted: number;
  actual: boolean;
  timestamp: number;
  gameContext: string;
}>();

// Performance metrics
let accuracyStats = {
  totalPredictions: 0,
  correctPredictions: 0,
  falsePositives: 0,
  falseNegatives: 0
};

function reKey(r: { first: boolean; second: boolean; third: boolean }, outs: number) {
  return `${r.first ? 1 : 0}${r.second ? 1 : 0}${r.third ? 1 : 0}-${outs}`;
}

function probFromRE(re: number) {
  return Math.max(0.05, Math.min(0.98, re / 2.2));
}

function clamp(x: number, lo: number, hi: number) { 
  return Math.max(lo, Math.min(hi, x)); 
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
    pitcher ? `${pitcher.stats.era.toFixed(2)}-${pitcher.stats.whip.toFixed(2)}` : 'no-pitcher'
  ].join('|');
}

// Fast mathematical RE24 calculation (always runs)
function calculateBaseRE24(gameState: MLBGameState): {
  probability: number;
  expectedRuns: number;
  re24Key: string;
} {
  const key = reKey(gameState.runners, gameState.outs);
  const expectedRuns = RE24[key] || 0.50;
  const probability = probFromRE(expectedRuns) * 100;
  
  // Apply late-inning pressure modifier
  let modifier = 1.0;
  if (gameState.inning >= 8) {
    modifier = 1.15; // 15% boost for high-leverage situations
  }
  
  return {
    probability: Math.round(clamp(probability * modifier, 5, 98)),
    expectedRuns,
    re24Key: key
  };
}

// AI contextual enhancement (selective, cached)
async function getAIContextMultiplier(gameState: MLBGameState, baseRE24: number): Promise<{
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
    const isHighLeverage = baseRE24 >= 60 || gameState.inning >= 8 || 
      Math.abs(gameState.homeScore - gameState.awayScore) <= 2;
    
    if (!isHighLeverage) {
      return { multiplier: 1.0, insight: "Standard situation", confidence: 85 };
    }

    const batter = gameState.currentBatter;
    const pitcher = gameState.currentPitcher;
    
    const prompt = `
🔬 ADVANCED BASEBALL ANALYTICS - Contextual Probability Enhancement

📊 GAME SITUATION:
${gameState.awayTeam} @ ${gameState.homeTeam} | ${gameState.inning}${gameState.inningState === 'top' ? 'T' : 'B'} | Score: ${gameState.awayScore}-${gameState.homeScore}
Base Runners: ${gameState.runners.first ? '1st ' : ''}${gameState.runners.second ? '2nd ' : ''}${gameState.runners.third ? '3rd ' : ''}${gameState.outs} outs
Mathematical RE24: ${baseRE24}% scoring probability

🏏 BATTER PROFILE:
${batter ? `${batter.name} (${batter.batSide}H): ${(batter.stats.avg * 1000).toFixed(0)} AVG | ${batter.stats.hr} HR | ${batter.stats.ops.toFixed(3)} OPS` : 'Unknown Batter'}
${batter && batter.stats.ops >= 0.900 ? '⭐ ELITE HITTER' : batter && batter.stats.ops >= 0.800 ? '🔥 STRONG HITTER' : ''}

⚾ PITCHER ANALYSIS:
${pitcher ? `${pitcher.name} (${pitcher.throwHand}HP): ${pitcher.stats.era.toFixed(2)} ERA | ${pitcher.stats.whip.toFixed(2)} WHIP | ${pitcher.stats.strikeOuts} K` : 'Unknown Pitcher'}
${pitcher && pitcher.stats.era <= 3.50 ? '🎯 DOMINANT PITCHER' : pitcher && pitcher.stats.era >= 4.50 ? '📈 STRUGGLING PITCHER' : ''}

🎯 LEVERAGE FACTORS:
- Game Context: ${Math.abs(gameState.homeScore - gameState.awayScore) <= 1 ? 'CLOSE GAME' : 'COMFORTABLE MARGIN'}
- Timing: ${gameState.inning >= 8 ? 'LATE INNING PRESSURE' : gameState.inning >= 6 ? 'MIDDLE INNINGS' : 'EARLY GAME'}
- Situation: ${gameState.runners.first && gameState.runners.second && gameState.runners.third ? 'BASES LOADED' : gameState.runners.second || gameState.runners.third ? 'SCORING POSITION' : 'PRESSURE BUILDING'}

🧠 PROVIDE ANALYSIS:
Multiplier (0.7-1.4): Mathematical adjustment for context
Insight: Primary factor driving adjustment
Confidence (75-95): Data quality and certainty level

FORMAT: "Multiplier: X.X | Insight: [key factor] | Confidence: XX"
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
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
    result.multiplier = clamp(result.multiplier, 0.7, 1.4);
    
    // Cache the result
    aiCache.set(cacheKey, { result, timestamp: Date.now() });
    
    return result;
    
  } catch (error) {
    console.error('AI context analysis failed:', error);
    return { multiplier: 1.0, insight: "Using mathematical baseline", confidence: 75 };
  }
}

// Stadium to team mapping for weather data
const TEAM_STADIUM_MAP: Record<string, string> = {
  'Los Angeles Angels': 'Angel Stadium',
  'Oakland Athletics': 'Oakland Coliseum',
  'Boston Red Sox': 'Fenway Park',
  'New York Yankees': 'Yankee Stadium',
  'Colorado Rockies': 'Coors Field',
  'Houston Astros': 'Minute Maid Park',
  // Add more as needed - fallback will use team name
};

// Main hybrid analysis function
export async function analyzeHybridRE24(gameState: MLBGameState): Promise<HybridRE24Result> {
  // Step 1: Fast mathematical foundation (always runs)
  const baseAnalysis = calculateBaseRE24(gameState);
  
  // Step 2: Get weather data for better context
  let weatherEffects = undefined;
  try {
    const stadiumName = TEAM_STADIUM_MAP[gameState.homeTeam] || `${gameState.homeTeam} Stadium`;
    const weatherData = await enhancedWeatherService.getEnhancedWeatherData(stadiumName);
    
    if (weatherData) {
      const weatherSummary = enhancedWeatherService.getWeatherEffectsSummary(weatherData);
      weatherEffects = {
        windSpeed: weatherData.windSpeed,
        windDirection: `${weatherData.windDirection}°`,
        windComponentToCenter: Math.round(weatherData.calculations.windComponent * 10) / 10,
        weatherDescription: weatherSummary.description,
        weatherEmoji: weatherSummary.emoji
      };
    }
  } catch (error) {
    console.warn('Weather data unavailable for RE24 analysis:', error);
  }
  
  // Step 3: AI contextual enhancement (selective)
  const aiContext = await getAIContextMultiplier(gameState, baseAnalysis.probability);
  
  // Step 3: Combine results
  const finalProbability = Math.round(clamp(
    baseAnalysis.probability * aiContext.multiplier, 
    5, 
    98
  ));
  
  // Step 4: Enhanced betting intelligence with market context
  const isHighLeverage = finalProbability >= 75 || gameState.inning >= 8;
  const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
  
  let bettingRecommendation = undefined;
  
  // Advanced betting scenarios
  if (isHighLeverage && finalProbability >= 85) {
    bettingRecommendation = `🚨 PREMIUM BET: ${finalProbability}% probability | Live Over ${(gameState.homeScore + gameState.awayScore + 2.5).toFixed(1)} | High Confidence`;
  } else if (finalProbability >= 80 && gameState.runners.first && gameState.runners.second && gameState.runners.third) {
    bettingRecommendation = `💎 BASES LOADED VALUE: ${finalProbability}% | Multiple run potential | Consider team total over`;
  } else if (finalProbability <= 20 && gameState.inning >= 8 && scoreDiff <= 3) {
    bettingRecommendation = `🛡️ UNDER LOCK: ${finalProbability}% scoring | Late inning defense | Under ${(gameState.homeScore + gameState.awayScore + 0.5).toFixed(1)}`;
  } else if (finalProbability >= 75 && gameState.currentBatter?.stats.hr >= 15) {
    bettingRecommendation = `⚡ POWER PLAY: ${gameState.currentBatter.name} HR prop | ${finalProbability}% situation`;
  }
  
  // Step 5: Calculate alert priority
  let alertPriority = Math.round(finalProbability * 0.85); // Base on probability
  
  // Boost priority for extreme situations
  if (gameState.runners.first && gameState.runners.second && gameState.runners.third) {
    alertPriority += 15; // Bases loaded boost
  }
  if (gameState.inning >= 9 && Math.abs(gameState.homeScore - gameState.awayScore) <= 1) {
    alertPriority += 20; // Late-game close situations
  }
  
  alertPriority = clamp(alertPriority, 30, 100);
  
  return {
    // Mathematical foundation
    baseRE24Probability: baseAnalysis.probability,
    expectedRuns: baseAnalysis.expectedRuns,
    re24Key: baseAnalysis.re24Key,
    
    // AI enhancement
    aiContextMultiplier: aiContext.multiplier,
    finalProbability,
    aiInsight: aiContext.insight,
    confidence: aiContext.confidence,
    
    // Weather integration
    weatherEffects,
    
    // Combined analysis
    isHighLeverage,
    betingRecommendation,
    alertPriority
  };
}

// Utility function to generate enhanced alert descriptions
export function generateHybridAlertDescription(
  gameState: MLBGameState, 
  analysis: HybridRE24Result
): string {
  const runners = [];
  if (gameState.runners.first) runners.push('1ST');
  if (gameState.runners.second) runners.push('2ND');
  if (gameState.runners.third) runners.push('3RD');
  
  const runnerText = runners.length > 0 ? runners.join(' & ') : 'Empty bases';
  const batter = gameState.currentBatter;
  
  let description = `📊 HYBRID RE24: ${runnerText}, ${gameState.outs} out - ${analysis.finalProbability}% scoring probability`;
  
  if (analysis.aiContextMultiplier !== 1.0) {
    const direction = analysis.aiContextMultiplier > 1.0 ? 'boosted' : 'adjusted';
    description += ` (AI ${direction}: ${(analysis.aiContextMultiplier * 100).toFixed(0)}%)`;
  }
  
  if (batter && analysis.confidence >= 85) {
    description += ` | ${batter.name} at bat`;
  }
  
  // Add weather effects to description
  if (analysis.weatherEffects) {
    const { windSpeed, windComponentToCenter, weatherEmoji, weatherDescription } = analysis.weatherEffects;
    const windDirection = windComponentToCenter > 0 ? 'helping' : windComponentToCenter < 0 ? 'hindering' : 'crosswind';
    
    description += ` | ${weatherEmoji} Wind: ${windSpeed}mph (${Math.abs(windComponentToCenter)}mph ${windDirection} toward CF)`;
    
    // Add weather context if significant
    if (Math.abs(windComponentToCenter) >= 5) {
      description += ` - ${weatherDescription}`;
    }
  }
  
  if (analysis.aiInsight && analysis.aiInsight !== "Standard situation") {
    description += ` | ${analysis.aiInsight}`;
  }
  
  return description;
}

// Cache cleanup function (call periodically)
export function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of aiCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      aiCache.delete(key);
    }
  }
}
