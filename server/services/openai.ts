import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

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
  try {
    const prompt = `Provide UNIQUE strategic analysis for this sports alert (avoid repeating basic stats):
    
Alert Type: ${alertType}
Sport: ${sport}  
Game: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}
Status: ${gameInfo.status}
Weather: ${weatherData ? `${weatherData.temperature}°F, ${weatherData.condition}` : 'Not available'}

DO NOT mention player names, batting averages, or basic stats already in the alert.
Focus ONLY on strategic implications, betting angles, or historical context:

Examples:
- "Teams score in 72% of late-inning RISP situations this season"
- "Home teams convert 68% of red zone attempts in night games" 
- "Weather conditions favor over bets by 12% historically"
- "Late-game momentum swings occur 3x more in tied games"
- "Division rivals average 1.4 more runs in clutch situations"

Provide brief tactical insight in JSON format with 'context' and 'confidence' (0-100) fields.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a sports betting analyst. Provide ONLY unique strategic insights that complement (never repeat) the main alert information. Focus on historical success rates, situational statistics, betting implications, or tactical context. NEVER mention player names, batting averages, or stats already shown. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"context": "Analysis unavailable", "confidence": 0}');
    
    return {
      context: result.context || "Analysis unavailable",
      confidence: Math.max(0, Math.min(100, result.confidence || 0))
    };
  } catch (error) {
    console.error("OpenAI analysis failed:", error);
    return {
      context: "AI analysis temporarily unavailable",
      confidence: 0
    };
  }
}
