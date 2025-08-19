import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    name: string;
    stats: {
      avg?: number;
      hr?: number;
      rbi?: number;
      obp?: number;
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
  try {
    const prompt = buildPredictionPrompt(request);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an elite sports analytics AI that specializes in real-time game predictions. 
          
Your expertise includes:
- Situational probability analysis based on historical data patterns
- Player performance trends and clutch situations
- Environmental impact on play outcomes (wind, weather, venue)
- Game flow and momentum analysis
- Critical moment identification

Analyze the provided game situation and predict the likelihood of specific events occurring. Consider all contextual factors including player stats, game situation, environmental conditions, and historical precedents.

Always respond with valid JSON containing an array of predictions. Each prediction should have:
- eventType: string (exactly matching the requested event type)
- probability: number (0-100, realistic based on statistical analysis)
- confidence: number (0-100, how confident you are in this prediction)
- reasoning: string (brief explanation of key factors, max 100 words)
- impact: string (significance if this event occurs, max 50 words)
- shouldAlert: boolean (true if probability and impact warrant an alert)

Be realistic with probabilities - don't inflate them. Base them on actual statistical likelihoods while considering the specific context.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"predictions": []}');
    const predictions: PredictionAnalysis[] = result.predictions || [];
    
    // Filter by minimum probability if specified
    const filteredPredictions = request.minimumProbability 
      ? predictions.filter(p => p.probability >= request.minimumProbability!)
      : predictions;
    
    return filteredPredictions.map(p => ({
      ...p,
      probability: Math.max(0, Math.min(100, p.probability)),
      confidence: Math.max(0, Math.min(100, p.confidence))
    }));
    
  } catch (error) {
    console.error("AI prediction failed:", error);
    return [];
  }
}

function buildPredictionPrompt(request: PredictionRequest): string {
  const { eventTypes, context } = request;
  
  let prompt = `Analyze this ${context.sport} game situation and predict the probability of these events: ${eventTypes.join(', ')}\n\n`;
  
  // Game state
  prompt += `GAME SITUATION:\n`;
  prompt += `${context.awayTeam} @ ${context.homeTeam}\n`;
  prompt += `Score: ${context.awayTeam} ${context.homeScore} - ${context.homeScore} ${context.homeTeam}\n`;
  prompt += `Score Difference: ${Math.abs(context.scoreDifference)} ${context.scoreDifference > 0 ? 'Home leading' : context.scoreDifference < 0 ? 'Away leading' : 'Tied'}\n`;
  
  // Sport-specific context
  if (context.sport === 'MLB') {
    prompt += `Inning: ${context.inning || 'Unknown'}\n`;
    prompt += `Outs: ${context.outs || 'Unknown'}\n`;
    if (context.runnersOn?.length) {
      prompt += `Runners on base: ${context.runnersOn.join(', ')}\n`;
    }
  } else if (context.sport === 'NFL') {
    prompt += `Quarter: ${context.quarter || 'Unknown'}\n`;
    prompt += `Down: ${context.down || 'Unknown'}\n`;
    prompt += `Yards to go: ${context.yardsToGo || 'Unknown'}\n`;
  }
  
  // Player context
  if (context.currentBatter) {
    prompt += `\nCURRENT BATTER: ${context.currentBatter.name}\n`;
    if (context.currentBatter.stats.avg) prompt += `Batting Average: ${context.currentBatter.stats.avg}\n`;
    if (context.currentBatter.stats.hr) prompt += `Home Runs: ${context.currentBatter.stats.hr}\n`;
    if (context.currentBatter.stats.rbi) prompt += `RBIs: ${context.currentBatter.stats.rbi}\n`;
  }
  
  // Environmental factors
  if (context.weather) {
    prompt += `\nWEATHER CONDITIONS:\n`;
    if (context.weather.windSpeed) prompt += `Wind: ${context.weather.windSpeed}mph ${context.weather.windDirection || ''}\n`;
    if (context.weather.temperature) prompt += `Temperature: ${context.weather.temperature}°F\n`;
    if (context.weather.condition) prompt += `Conditions: ${context.weather.condition}\n`;
  }
  
  prompt += `\nProvide predictions for: ${eventTypes.join(', ')}\n`;
  prompt += `\nRespond with JSON format: {"predictions": [{"eventType": "...", "probability": 0, "confidence": 0, "reasoning": "...", "impact": "...", "shouldAlert": false}]}`;
  
  return prompt;
}

// Helper function for sport-specific prediction event types
export const PREDICTION_EVENTS = {
  MLB: [
    "Home Run",
    "RBI Hit", 
    "Scoring Play",
    "Double Play",
    "Strikeout",
    "Walk-off Hit",
    "Grand Slam"
  ],
  NFL: [
    "Touchdown",
    "Field Goal",
    "Interception", 
    "Fumble",
    "Game Winner",
    "Two-Point Conversion",
    "Safety"
  ],
  NBA: [
    "Three Pointer",
    "Dunk",
    "Game Winner",
    "And-One",
    "Steal",
    "Block",
    "Buzzer Beater"
  ],
  NHL: [
    "Goal",
    "Power Play Goal",
    "Short Handed Goal",
    "Empty Net Goal",
    "Hat Trick",
    "Game Winner",
    "Save"
  ]
} as const;