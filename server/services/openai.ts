import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 5000,
  maxRetries: 1
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
    // Silently handle all OpenAI errors to prevent workflow failures
    if (error.status === 429) {
      console.log("OpenAI analysis skipped: API quota exceeded, using fallback");
    } else if (error.message === 'OpenAI API timeout') {
      console.log("OpenAI analysis skipped: timeout after 5 seconds");
    } else if (error.message?.includes('API key')) {
      console.log("OpenAI analysis skipped: API key not configured");
    } else {
      console.log("OpenAI analysis skipped:", error.message || "API temporarily unavailable");
    }
    return {
      context: "AI analysis temporarily unavailable",
      confidence: 0
    };
  }
}
