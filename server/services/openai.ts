// This file now delegates to the centralized OpenAI manager
import { getOpenAIManager } from './openai-manager';

export interface AlertAnalysis {
  context: string;
  confidence: number;
}

export async function analyzeAlert(
  alertType: string,
  sport: string,
  gameInfo: any,
  weatherData?: any
): Promise<AlertAnalysis> {
  // Delegate to centralized OpenAI manager
  const openaiManager = getOpenAIManager();
  return openaiManager.analyzeAlert(alertType, sport, gameInfo, weatherData);
}