// OpenAI service has been completely removed
// This file is kept as a placeholder to prevent import errors

export interface AlertAnalysis {
  context: string;
  confidence: number;
}

// No AI analysis - return basic fallback
export async function analyzeAlert(
  alertType: string,
  sport: string,
  gameInfo: any,
  weatherData?: any
): Promise<AlertAnalysis> {
  console.log('🚫 OpenAI Analysis DISABLED - Using basic fallback');

  return {
    context: `${alertType} situation detected`,
    confidence: 0
  };
}