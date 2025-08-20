
// AI Predictions service has been completely removed
// This file is kept as a placeholder to prevent import errors

export interface PredictionAnalysis {
  eventType: string;
  probability: number;
  confidence: number;
  reasoning: string;
  impact: string;
  shouldAlert: boolean;
}

export interface GameContext {
  sport: string;
  inning?: number;
  quarter?: number;
  period?: number;
  outs?: number;
  down?: number;
  yardsToGo?: number;
  homeScore: number;
  awayScore: number;
  scoreDifference: number;
  runnersOn?: string[];
  currentBatter?: any;
  currentPitcher?: any;
  weather?: any;
  homeTeam: string;
  awayTeam: string;
  timeRemaining?: string;
  gameState: string;
}

export interface PredictionRequest {
  eventTypes: string[];
  context: GameContext;
  minimumProbability?: number;
}

// No AI predictions - return empty array
export async function generatePredictions(request: PredictionRequest): Promise<PredictionAnalysis[]> {
  console.log('🚫 AI Predictions DISABLED - No predictions will be generated');
  return [];
}

// Helper function for sport-specific prediction event types (kept for compatibility)
export const PREDICTION_EVENTS = {
  MLB: [],
  NFL: [],
  NBA: [],
  NHL: []
} as const;
