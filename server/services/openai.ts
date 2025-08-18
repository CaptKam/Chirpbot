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
    const prompt = `Analyze this sports alert and provide context and confidence:
    
Alert Type: ${alertType}
Sport: ${sport}
Game: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}
Status: ${gameInfo.status}
Weather: ${weatherData ? `${weatherData.temperature}°F, ${weatherData.condition}` : 'Not available'}

Provide analysis in JSON format with 'context' (detailed analysis) and 'confidence' (0-100) fields.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a sports analytics expert. Provide detailed context for sports alerts and assign confidence scores based on statistical likelihood and situational factors. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
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
