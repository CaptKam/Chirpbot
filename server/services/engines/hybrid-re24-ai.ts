
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

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
  
  // Combined analysis
  isHighLeverage: boolean;
  betingRecommendation?: string;
  alertPriority: number;
}

// Cache for AI results to avoid excessive API calls
const aiCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

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
Analyze this HIGH-LEVERAGE baseball situation for contextual probability adjustment:

🎯 SITUATION:
${gameState.awayTeam} @ ${gameState.homeTeam} | Inning ${gameState.inning} ${gameState.inningState}
Score: ${gameState.awayScore}-${gameState.homeScore} | ${gameState.outs} outs
Runners: ${gameState.runners.first ? '1st ' : ''}${gameState.runners.second ? '2nd ' : ''}${gameState.runners.third ? '3rd' : ''}
Base RE24 Probability: ${baseRE24}%

👤 MATCHUP:
${batter ? `Batter: ${batter.name} (.${(batter.stats.avg * 1000).toFixed(0)} AVG, ${batter.stats.hr} HR, ${batter.stats.ops.toFixed(3)} OPS, ${batter.batSide})` : 'Batter: Unknown'}
${pitcher ? `Pitcher: ${pitcher.name} (${pitcher.stats.era.toFixed(2)} ERA, ${pitcher.stats.whip.toFixed(2)} WHIP, ${pitcher.throwHand})` : 'Pitcher: Unknown'}

🧠 PROVIDE:
1. Context Multiplier (0.7-1.4): Adjust base probability based on matchup, momentum, clutch history
2. One-line insight: Key factor affecting this situation
3. Confidence (70-95): How sure are you about this adjustment?

FORMAT: "Multiplier: X.X | Insight: [brief insight] | Confidence: XX"

Example: "Multiplier: 1.2 | Insight: Elite clutch hitter vs struggling reliever favors offense | Confidence: 87"
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

// Main hybrid analysis function
export async function analyzeHybridRE24(gameState: MLBGameState): Promise<HybridRE24Result> {
  // Step 1: Fast mathematical foundation (always runs)
  const baseAnalysis = calculateBaseRE24(gameState);
  
  // Step 2: AI contextual enhancement (selective)
  const aiContext = await getAIContextMultiplier(gameState, baseAnalysis.probability);
  
  // Step 3: Combine results
  const finalProbability = Math.round(clamp(
    baseAnalysis.probability * aiContext.multiplier, 
    5, 
    98
  ));
  
  // Step 4: Determine leverage and betting insights
  const isHighLeverage = finalProbability >= 75 || gameState.inning >= 8;
  
  let bettingRecommendation = undefined;
  if (isHighLeverage && finalProbability >= 80) {
    bettingRecommendation = `HIGH VALUE: ${finalProbability}% scoring probability - consider over bets`;
  } else if (finalProbability <= 25 && gameState.inning >= 7) {
    bettingRecommendation = `DEFENSIVE SPOT: ${finalProbability}% scoring chance - under opportunity`;
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
