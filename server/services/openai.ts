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
    const prompt = `Analyze this sports alert briefly:
    
Alert Type: ${alertType}
Sport: ${sport}  
Game: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}
Status: ${gameInfo.status}
Weather: ${weatherData ? `${weatherData.temperature}°F, ${weatherData.condition}` : 'Not available'}

Provide analysis in JSON format with 'context' (1-2 sentences max, focus on key impact) and 'confidence' (0-100) fields.`;

    // Add timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API timeout')), 5000)
    );

    const apiPromise = openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a sports analytics expert. Provide very brief, concise context for sports alerts in 1-2 short sentences only. Focus on immediate impact and key insights. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    const result = JSON.parse(response.choices[0].message.content || '{"context": "Analysis unavailable", "confidence": 0}');
    
    return {
      context: result.context || "Analysis unavailable",
      confidence: Math.max(0, Math.min(100, result.confidence || 0))
    };
  } catch (error: any) {
    if (error.message === 'OpenAI API timeout') {
      console.error("OpenAI analysis timed out after 5 seconds");
    } else if (error.status === 429 || error.code === 'insufficient_quota' || error.message?.includes('quota')) {
      console.error("OpenAI quota exceeded - falling back to statistical analysis");
    } else {
      console.error("OpenAI analysis failed:", error.message || error);
    }
    
    // Return empty context so the caller can use composite scoring instead
    return {
      context: "",
      confidence: 0
    };
  }
}
