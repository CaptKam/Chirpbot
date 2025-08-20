import OpenAI from "openai";
import { fetchJson } from './http';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 8000,
  maxRetries: 1
});

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
  onDeckBatter?: {
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
  previousWeather?: {
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

// Fallback predictions based on statistical averages
function generateFallbackPredictions(request: PredictionRequest): PredictionAnalysis[] {
  const predictions: PredictionAnalysis[] = [];
  const { context, eventTypes } = request;
  
  for (const eventType of eventTypes) {
    let probability = 0;
    let reasoning = "Statistical average (AI unavailable)";
    
    // Baseball RISP scoring probabilities based on historical data
    if (eventType === "Scoring Play" && context.sport === "MLB") {
      const runners = context.runnersOn || [];
      const outs = context.outs || 0;
      
      if (runners.includes("3rd") && outs < 2) {
        probability = 65;
        reasoning = "Runner on 3rd with less than 2 outs historically scores 65% of the time";
      } else if (runners.includes("2nd") && outs < 2) {
        probability = 45;
        reasoning = "Runner on 2nd with less than 2 outs historically scores 45% of the time";
      } else if (runners.length > 0) {
        probability = 25;
        reasoning = "Runners on base score approximately 25% of the time";
      }
    }
    
    // Home run probability based on batter stats
    if (eventType === "Home Run" && context.currentBatter) {
      const avgHrRate = 3; // ~3% average HR rate
      const batterHrRate = context.currentBatter.stats.hr && context.currentBatter.stats.atBats
        ? (context.currentBatter.stats.hr / context.currentBatter.stats.atBats) * 100
        : avgHrRate;
      probability = Math.min(batterHrRate * 1.5, 15); // Cap at 15%
      reasoning = `Based on batter's HR rate of ${batterHrRate.toFixed(1)}%`;
    }
    
    if (probability > 0) {
      predictions.push({
        eventType,
        probability,
        confidence: 50, // Lower confidence for fallback
        reasoning,
        impact: "Significant scoring opportunity",
        shouldAlert: probability >= (request.minimumProbability || 30)
      });
    }
  }
  
  return predictions;
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
    
  } catch (error: any) {
    // Silently handle all OpenAI errors and use fallbacks
    if (error.status === 429) {
      console.log('AI predictions: Using statistical fallbacks due to API quota limit');
    } else if (error.message?.includes('timeout')) {
      console.log('AI predictions: Using statistical fallbacks due to timeout');
    } else if (error.message?.includes('API key')) {
      console.log('AI predictions: Using statistical fallbacks (API key not configured)');
    } else {
      console.log('AI predictions: Using statistical fallbacks (API temporarily unavailable)');
    }
    
    // Always return fallback predictions instead of empty array
    return generateFallbackPredictions(request);
  }
}

function buildPredictionPrompt(request: PredictionRequest): string {
  const { eventTypes, context } = request;
  
  let prompt = `Analyze this ${context.sport} game situation and predict the probability of these events: ${eventTypes.join(', ')}\n\n`;
  
  // Game state
  prompt += `GAME SITUATION:\n`;
  prompt += `${context.awayTeam} @ ${context.homeTeam}\n`;
  prompt += `Score: ${context.awayTeam} ${context.awayScore} - ${context.homeScore} ${context.homeTeam}\n`;
  prompt += `Score Difference: ${Math.abs(context.scoreDifference)} ${context.scoreDifference > 0 ? 'Home leading' : context.scoreDifference < 0 ? 'Away leading' : 'Tied'}\n`;
  
  // Sport-specific context
  if (context.sport === 'MLB') {
    prompt += `Inning: ${context.inning || 'Unknown'}\n`;
    prompt += `Outs: ${context.outs || 'Unknown'}\n`;
    if (context.runnersOn?.length) {
      prompt += `Runners on base: ${context.runnersOn.join(', ')}\n`;
    }
    
    // Game momentum and situation
    if (context.inning && context.inning >= 7) {
      prompt += `LATE GAME SITUATION: Critical innings - every at-bat matters\n`;
    }
    if (context.outs === 2) {
      prompt += `HIGH PRESSURE: Two outs - do-or-die situation\n`;
    }
    
  } else if (context.sport === 'NFL') {
    prompt += `Quarter: ${context.quarter || 'Unknown'}\n`;
    prompt += `Down: ${context.down || 'Unknown'}\n`;
    prompt += `Yards to go: ${context.yardsToGo || 'Unknown'}\n`;
  }
  
  // Player context
  if (context.currentBatter) {
    prompt += `\nCURRENT BATTER: ${context.currentBatter.name}`;
    if (context.currentBatter.batSide) prompt += ` (${context.currentBatter.batSide === 'L' ? 'Left' : context.currentBatter.batSide === 'R' ? 'Right' : 'Switch'} handed)`;
    prompt += `\n`;
    if (context.currentBatter.stats.avg) prompt += `Batting Average: ${context.currentBatter.stats.avg}\n`;
    if (context.currentBatter.stats.hr) prompt += `Home Runs: ${context.currentBatter.stats.hr}\n`;
    if (context.currentBatter.stats.rbi) prompt += `RBIs: ${context.currentBatter.stats.rbi}\n`;
    if (context.currentBatter.stats.ops) prompt += `OPS: ${context.currentBatter.stats.ops}\n`;
    if (context.currentBatter.stats.strikeOuts) prompt += `Strikeouts: ${context.currentBatter.stats.strikeOuts}\n`;
    
    // Power analysis
    if (context.currentBatter.stats.hr && context.currentBatter.stats.atBats) {
      const hrRate = (context.currentBatter.stats.hr / context.currentBatter.stats.atBats * 100).toFixed(1);
      prompt += `Home Run Rate: ${hrRate}% (${context.currentBatter.stats.hr}/${context.currentBatter.stats.atBats} AB)\n`;
    }
    
    // Clutch performance indicator
    if (context.currentBatter.stats.rbi && context.currentBatter.stats.rbi > 50) {
      prompt += `CLUTCH PRODUCER: ${context.currentBatter.stats.rbi} RBIs this season\n`;
    }
  }
  
  // On-deck batter context (if available)
  if (context.onDeckBatter) {
    prompt += `\nON-DECK BATTER: ${context.onDeckBatter.name}`;
    if (context.onDeckBatter.batSide) prompt += ` (${context.onDeckBatter.batSide === 'L' ? 'Left' : context.onDeckBatter.batSide === 'R' ? 'Right' : 'Switch'} handed)`;
    prompt += `\n`;
    if (context.onDeckBatter.stats.avg) prompt += `On-Deck BA: ${context.onDeckBatter.stats.avg} | HR: ${context.onDeckBatter.stats.hr || 0} | RBI: ${context.onDeckBatter.stats.rbi || 0}\n`;
    if (context.onDeckBatter.stats.ops) prompt += `On-Deck OPS: ${context.onDeckBatter.stats.ops}\n`;
  }
  
  if (context.currentPitcher) {
    prompt += `\nCURRENT PITCHER: ${context.currentPitcher.name}`;
    if (context.currentPitcher.throwHand) prompt += ` (${context.currentPitcher.throwHand === 'L' ? 'Left' : 'Right'} handed)`;
    prompt += `\n`;
    if (context.currentPitcher.stats.era) prompt += `ERA: ${context.currentPitcher.stats.era}\n`;
    if (context.currentPitcher.stats.whip) prompt += `WHIP: ${context.currentPitcher.stats.whip}\n`;
    if (context.currentPitcher.stats.strikeOuts) prompt += `Strikeouts: ${context.currentPitcher.stats.strikeOuts}\n`;
    if (context.currentPitcher.stats.wins !== undefined && context.currentPitcher.stats.losses !== undefined) {
      prompt += `Record: ${context.currentPitcher.stats.wins}-${context.currentPitcher.stats.losses}\n`;
    }
  }
  
  // Environmental factors
  if (context.weather) {
    prompt += `\nWEATHER CONDITIONS:\n`;
    if (context.weather.windSpeed) {
      prompt += `Wind: ${context.weather.windSpeed}mph ${context.weather.windDirection || ''}\n`;
      
      // Wind impact analysis
      if (context.weather.windSpeed >= 15) {
        prompt += `⚠️ HIGH WINDS: ${context.weather.windSpeed}mph winds will significantly affect ball flight\n`;
        if (context.weather.windDirection && context.weather.windDirection.includes('Out')) {
          prompt += `🚀 WIND ADVANTAGE: Strong tailwind favors home runs and deep fly balls\n`;
        } else if (context.weather.windDirection && context.weather.windDirection.includes('In')) {
          prompt += `🛡️ PITCHER FRIENDLY: Headwind will knock down potential home runs\n`;
        }
      } else if (context.weather.windSpeed >= 8) {
        prompt += `🌬️ MODERATE WINDS: Will affect ball trajectory, especially on pop-ups\n`;
      }
    }
    
    if (context.weather.temperature) {
      prompt += `Temperature: ${context.weather.temperature}°F`;
      if (context.weather.temperature >= 80) {
        prompt += ` (Hot weather favors offense - ball travels further)\n`;
      } else if (context.weather.temperature <= 50) {
        prompt += ` (Cold weather favors pitching - ball doesn't travel as far)\n`;
      } else {
        prompt += ` (Neutral temperature conditions)\n`;
      }
    }
    
    if (context.weather.condition) prompt += `Conditions: ${context.weather.condition}\n`;
    
    // Previous weather comparison for dynamic analysis
    if (context.previousWeather) {
      const windChange = Math.abs((context.weather.windSpeed || 0) - (context.previousWeather.windSpeed || 0));
      const tempChange = Math.abs((context.weather.temperature || 0) - (context.previousWeather.temperature || 0));
      
      if (windChange >= 5) {
        prompt += `🌪️ MAJOR WIND SHIFT: Wind speed changed by ${windChange}mph from earlier - affects pitcher/batter strategy\n`;
      }
      if (context.weather.windDirection !== context.previousWeather.windDirection) {
        prompt += `🔄 WIND DIRECTION CHANGE: From ${context.previousWeather.windDirection || 'unknown'} to ${context.weather.windDirection || 'unknown'} - changes hitting approach\n`;
      }
      if (tempChange >= 10) {
        prompt += `🌡️ SIGNIFICANT TEMPERATURE SHIFT: ${tempChange}°F change from earlier affects ball carry distance\n`;
      }
    }
    
    // Batter-specific weather impact
    if (context.currentBatter) {
      prompt += `\nWEATHER IMPACT ON CURRENT BATTER:\n`;
      const powerHitter = context.currentBatter.stats.hr && context.currentBatter.stats.hr > 15;
      const contactHitter = context.currentBatter.stats.avg && context.currentBatter.stats.avg > 0.280;
      
      if (powerHitter && context.weather.windSpeed >= 10 && context.weather.windDirection?.includes('Out')) {
        prompt += `⚾ POWER HITTER + TAILWIND: ${context.currentBatter.name}'s power (${context.currentBatter.stats.hr} HR) gets boost from ${context.weather.windSpeed}mph tailwind\n`;
      } else if (powerHitter && context.weather.windSpeed >= 10 && context.weather.windDirection?.includes('In')) {
        prompt += `⚾ POWER NEGATED: ${context.currentBatter.name}'s power reduced by ${context.weather.windSpeed}mph headwind\n`;
      } else if (contactHitter && context.weather.windSpeed >= 15) {
        prompt += `⚾ CONTACT HITTER CHALLENGE: ${context.currentBatter.name} (.${Math.round((context.currentBatter.stats.avg || 0) * 1000)} AVG) faces difficult conditions with ${context.weather.windSpeed}mph winds\n`;
      }
      
      if (context.weather.temperature <= 50 && powerHitter) {
        prompt += `🧊 COLD IMPACT: ${context.currentBatter.name}'s power reduced by cold ${context.weather.temperature}°F temperature\n`;
      } else if (context.weather.temperature >= 85 && powerHitter) {
        prompt += `🔥 HEAT BOOST: ${context.currentBatter.name}'s power enhanced by hot ${context.weather.temperature}°F conditions\n`;
      }
    }
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