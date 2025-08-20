// This file now delegates to the centralized OpenAI manager
import { getOpenAIManager } from './openai-manager';

export interface PredictionAnalysis {
  eventType: string;
  probability: number;
  confidence: number;
  reasoning: string;
  impact: string;
  shouldAlert: boolean;
}

export interface GameContext {
  // Basic game state
  sport: string;
  inning?: number;
  quarter?: number;
  period?: number;
  outs?: number;
  down?: number;
  yardsToGo?: number;
  
  // Score situation
  homeScore: number;
  awayScore: number;
  scoreDifference: number;
  
  // Situational context
  runnersOn?: string[]; // ["1st", "2nd", "3rd"]
  currentBatter?: {
    id?: number;
    name: string;
    batSide?: string;
    stats: {
      avg?: number;
      hr?: number;
      rbi?: number;
      obp?: number;
      ops?: number;
      slg?: number;
      atBats?: number;
      hits?: number;
      strikeOuts?: number;
      walks?: number;
    };
  };
  currentPitcher?: {
    id?: number;
    name: string;
    throwHand?: string;
    stats: {
      era?: number;
      whip?: number;
      strikeOuts?: number;
      walks?: number;
      wins?: number;
      losses?: number;
      saves?: number;
      inningsPitched?: string;
      hits?: number;
      earnedRuns?: number;
      homeRuns?: number;
    };
  };
  
  // Environmental factors
  weather?: {
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
    condition?: string;
  };
  
  // Team context
  homeTeam: string;
  awayTeam: string;
  
  // Time/game situation
  timeRemaining?: string;
  gameState: string; // "Live", "Final", etc.
}

export interface PredictionRequest {
  eventTypes: string[]; // ["Home Run", "Scoring Play", "Game Winner", etc.]
  context: GameContext;
  minimumProbability?: number; // Only return predictions above this threshold
}

export async function generatePredictions(request: PredictionRequest): Promise<PredictionAnalysis[]> {
  // Delegate to centralized OpenAI manager
  const openaiManager = getOpenAIManager();
  return openaiManager.generatePredictions(
    request.eventTypes,
    request.context,
    request.minimumProbability || 0
  );
}

// Event types for different sports
export const PREDICTION_EVENTS = {
  MLB: [
    "Home Run",
    "RBI Hit",
    "Double Play",
    "Strikeout",
    "Walk",
    "Stolen Base",
    "Scoring Play",
    "Inning End",
    "Rally Start",
    "Walk-off Hit"
  ],
  NFL: [
    "Touchdown",
    "Field Goal",
    "Interception",
    "Fumble",
    "Safety",
    "Two-Point Conversion",
    "Long Pass",
    "Red Zone Score",
    "Fourth Down Stop",
    "Game Winner"
  ],
  NBA: [
    "Three Pointer",
    "Dunk",
    "Fast Break",
    "Technical Foul",
    "Buzzer Beater",
    "Comeback Start",
    "Clutch Shot",
    "Momentum Swing",
    "Free Throw Miss",
    "Game Winner"
  ],
  NHL: [
    "Goal",
    "Power Play Goal",
    "Short Handed Goal",
    "Empty Net Goal",
    "Hat Trick",
    "Game Winner",
    "Save",
    "Penalty Shot",
    "Fight",
    "Overtime Goal"
  ]
} as const;