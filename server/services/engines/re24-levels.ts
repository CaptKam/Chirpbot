
import { MLBGameState } from './mlb-engine';
import { analyzeHybridRE24, HybridRE24Result } from './hybrid-re24-ai';

export interface RE24LevelResult {
  level: number;
  analysis: string;
  confidence: number;
  priority: number;
  bettingInsight?: string;
}

// 📊 RE24 Level 1 - Basic situational analysis with AI enhancement
export async function calculateRE24Level1(gameState: MLBGameState): Promise<RE24LevelResult> {
  const hybrid = await analyzeHybridRE24(gameState);
  
  const runners = [];
  if (gameState.runners.first) runners.push('1st');
  if (gameState.runners.second) runners.push('2nd'); 
  if (gameState.runners.third) runners.push('3rd');
  
  const baseState = runners.length > 0 ? runners.join(' & ') : 'Empty';
  const scoringProb = Math.round(hybrid.finalProbability * 100);
  
  return {
    level: 1,
    analysis: `📊 L1: ${baseState}, ${gameState.outs} out - ${scoringProb}% scoring probability`,
    confidence: 85,
    priority: hybrid.alertPriority,
    bettingInsight: hybrid.bettingRecommendation
  };
}

// 📈 RE24 Level 2 - Intermediate player analytics with contextual AI  
export async function calculateRE24Level2(gameState: MLBGameState): Promise<RE24LevelResult> {
  const hybrid = await analyzeHybridRE24(gameState);
  const batter = gameState.currentBatter;
  
  let playerContext = '';
  if (batter) {
    const batterTier = batter.stats.hr >= 30 ? 'Elite' : 
                     batter.stats.hr >= 20 ? 'Power' : 
                     batter.stats.avg >= 0.300 ? 'Contact' : 'Average';
    playerContext = ` | ${batter.name} (${batterTier}: ${batter.stats.hr} HR, .${Math.round(batter.stats.avg * 1000)} AVG)`;
  }
  
  const leverageText = hybrid.leverageFactor > 1.05 ? ` | High Leverage (${(hybrid.leverageFactor * 100).toFixed(0)}%)` : '';
  
  return {
    level: 2, 
    analysis: `📈 L2: ${Math.round(hybrid.finalProbability * 100)}% scoring${playerContext}${leverageText}`,
    confidence: 90,
    priority: hybrid.alertPriority + 5,
    bettingInsight: hybrid.bettingRecommendation
  };
}

// 🎯 RE24 Level 3 - Elite sabermetrics with advanced AI predictions
export async function calculateRE24Level3(gameState: MLBGameState): Promise<RE24LevelResult> {
  const hybrid = await analyzeHybridRE24(gameState);
  
  const aiMultiplier = hybrid.aiContextMultiplier !== 1.0 ? 
    ` | AI: ${(hybrid.aiContextMultiplier * 100).toFixed(0)}%` : '';
  const weatherImpact = hybrid.weatherMultiplier !== 1.0 ? 
    ` | Weather: ${hybrid.weatherAnalysis.impact}` : '';
  
  const advancedMetrics = `Expected: +${hybrid.expectedRuns.toFixed(1)} runs`;
  
  return {
    level: 3,
    analysis: `🎯 L3: ${Math.round(hybrid.finalProbability * 100)}% | ${advancedMetrics}${aiMultiplier}${weatherImpact} | ${hybrid.aiInsight}`,
    confidence: 95,
    priority: hybrid.alertPriority + 10,
    bettingInsight: hybrid.bettingRecommendation
  };
}

// Determine which level to use based on settings
export async function getActiveRE24Level(gameState: MLBGameState, settings: any): Promise<RE24LevelResult | null> {
  const alertTypes = settings?.alertTypes || {};
  
  if (alertTypes.re24Level3) {
    return await calculateRE24Level3(gameState);
  } else if (alertTypes.re24Level2) {
    return await calculateRE24Level2(gameState);
  } else if (alertTypes.re24Level1) {
    return await calculateRE24Level1(gameState);
  } else if (alertTypes.useRE24System) {
    return await calculateRE24Level1(gameState); // Default to Level 1
  }
  
  return null;
}
