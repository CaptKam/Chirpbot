import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface GameContext {
  sport: string;
  homeTeam: string;
  awayTeam: string;
  inning?: number;
  score: { home: number; away: number };
  runners?: { first: boolean; second: boolean; third: boolean };
  outs?: number;
  currentBatter?: any;
  currentPitcher?: any;
  weatherData?: any;
}

export interface EnhancedAlert {
  enhancedDescription: string;
  insights: string[];
  confidence: number;
  weatherImpact?: string;
}

// Enhanced alert generation with deep contextual analysis
export async function enhanceAlertWithOpenAI(
  alertType: string,
  gameContext: GameContext,
  baseDescription: string,
  priority: number
): Promise<EnhancedAlert | null> {
  try {
    const prompt = `You are a sports analyst providing real-time game insights. Enhance this alert with intelligent analysis:

Alert Type: ${alertType}
Priority: ${priority}
Base Description: ${baseDescription}

Game Context:
- Teams: ${gameContext.awayTeam} @ ${gameContext.homeTeam}
- Score: ${gameContext.awayTeam} ${gameContext.score.away} - ${gameContext.homeTeam} ${gameContext.score.home}
${gameContext.inning ? `- Inning: ${gameContext.inning}` : ''}
${gameContext.runners ? `- Runners: 1st=${gameContext.runners.first}, 2nd=${gameContext.runners.second}, 3rd=${gameContext.runners.third}` : ''}
${gameContext.outs !== undefined ? `- Outs: ${gameContext.outs}` : ''}
${gameContext.currentBatter ? `- Batter: ${gameContext.currentBatter.name} (AVG: ${gameContext.currentBatter.stats?.avg || 'N/A'}, HR: ${gameContext.currentBatter.stats?.hr || 0})` : ''}
${gameContext.currentPitcher ? `- Pitcher: ${gameContext.currentPitcher.name} (ERA: ${gameContext.currentPitcher.stats?.era || 'N/A'})` : ''}

Provide a JSON response with:
1. enhancedDescription: A compelling, contextual description (max 150 chars) that captures the excitement and importance of this moment
2. insights: Array of 2-3 key strategic insights about this situation
3. confidence: Your confidence level (0-100) in the alert's importance

Focus on what makes this moment special and what fans should watch for. Be enthusiastic but factual.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert baseball analyst providing real-time insights. Keep descriptions exciting but concise. Focus on strategic importance and momentum shifts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      enhancedDescription: result.enhancedDescription || baseDescription,
      insights: result.insights || [],
      confidence: result.confidence || 75,
      weatherImpact: gameContext.weatherData ? await analyzeWeatherImpact(gameContext.weatherData) : undefined
    };
  } catch (error) {
    console.error('OpenAI enhancement error:', error);
    return null;
  }
}

// Weather impact analysis for outdoor games
export async function analyzeWeatherImpact(weatherData: any): Promise<string> {
  try {
    const prompt = `Analyze how these weather conditions affect baseball gameplay:
- Temperature: ${weatherData.temperature}°F
- Wind Speed: ${weatherData.windSpeed} mph
- Wind Direction: ${weatherData.windDirection || 'N/A'}
- Conditions: ${weatherData.conditions || 'Clear'}
- Humidity: ${weatherData.humidity || 'N/A'}%

Provide a brief (max 100 chars) insight on how this impacts hitting, pitching, or fielding.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a baseball weather analyst. Provide concise, actionable insights about weather impact on gameplay."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 100
    });

    return response.choices[0].message.content || "Weather conditions normal for play";
  } catch (error) {
    console.error('Weather analysis error:', error);
    return "Weather impact analysis unavailable";
  }
}

// Generate pre-game insights
export async function generatePreGameInsights(
  homeTeam: string,
  awayTeam: string,
  weatherData?: any
): Promise<string[]> {
  try {
    const prompt = `Generate 3 pre-game insights for ${awayTeam} @ ${homeTeam}.
${weatherData ? `Weather: ${weatherData.temperature}°F, Wind: ${weatherData.windSpeed}mph` : ''}

Provide JSON with an array called "insights" containing 3 brief, interesting pre-game talking points.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"insights":[]}');
    return result.insights || [];
  } catch (error) {
    console.error('Pre-game insights error:', error);
    return [];
  }
}

// Analyze game momentum
export async function analyzeGameMomentum(
  recentAlerts: any[],
  gameContext: GameContext
): Promise<string> {
  try {
    const recentEvents = recentAlerts.slice(-5).map(a => a.type).join(', ');
    
    const prompt = `Based on recent events (${recentEvents}) and the current score (${gameContext.awayTeam} ${gameContext.score.away} - ${gameContext.homeTeam} ${gameContext.score.home}), provide a brief momentum analysis (max 100 chars).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    });

    return response.choices[0].message.content || "Game momentum steady";
  } catch (error) {
    console.error('Momentum analysis error:', error);
    return "Momentum analysis unavailable";
  }
}

// Smart alert prioritization
export async function suggestAlertPriority(
  alertType: string,
  gameContext: GameContext
): Promise<number> {
  try {
    const isCloseGame = Math.abs(gameContext.score.home - gameContext.score.away) <= 2;
    const isLateInning = gameContext.inning && gameContext.inning >= 7;
    const hasRunners = gameContext.runners && (gameContext.runners.second || gameContext.runners.third);
    
    // Use AI to suggest priority based on context
    const prompt = `Given this baseball situation, suggest a priority (1-100) for a "${alertType}" alert:
- Close game: ${isCloseGame}
- Late inning: ${isLateInning}  
- Scoring position: ${hasRunners}
- Current score difference: ${Math.abs(gameContext.score.home - gameContext.score.away)}

Respond with just a number between 1-100.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    });

    const priority = parseInt(response.choices[0].message.content || '50');
    return Math.min(100, Math.max(1, priority));
  } catch (error) {
    console.error('Priority suggestion error:', error);
    return 50; // Default priority
  }
}