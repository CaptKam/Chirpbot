import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface AlertAnalysis {
  context: string;
  confidence: number;
}

export interface DesignSuggestion {
  layout: string;
  colors: string;
  typography: string;
  elements: string[];
  teamLogoPlacement: string;
  informationHierarchy: string[];
}

export async function generateAlertDesignSuggestions(
  currentDesign: string
): Promise<DesignSuggestion> {
  try {
    const prompt = `Analyze this current sports alert UI design and suggest modern improvements:

Current Design:
${currentDesign}

Provide suggestions for a modern, mobile-first sports alert design with:
1. Clean, card-based layout with team logos
2. Better visual hierarchy for sports information  
3. Modern color schemes and typography
4. Enhanced user experience for sports betting/fantasy users
5. Team logo integration and placement
6. Information priority order

Respond with JSON containing: layout, colors, typography, elements (array), teamLogoPlacement, informationHierarchy (array).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a UX/UI design expert specializing in modern mobile sports applications. Provide practical, implementable design suggestions in JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      layout: result.layout || "Modern card-based design",
      colors: result.colors || "Clean color palette",
      typography: result.typography || "Modern typography",
      elements: result.elements || ["Team logos", "Score display", "Alert badges"],
      teamLogoPlacement: result.teamLogoPlacement || "Top left of card",
      informationHierarchy: result.informationHierarchy || ["Team info", "Score", "Alert details"]
    };
  } catch (error) {
    console.error("OpenAI design suggestion failed:", error);
    return {
      layout: "Clean card layout with team logos and enhanced visual hierarchy",
      colors: "Modern blue and red accent colors with clean backgrounds",
      typography: "Bold headings with clear information hierarchy",
      elements: ["Team logos", "Enhanced score display", "Color-coded alert badges", "AI confidence indicators"],
      teamLogoPlacement: "Left side with team names, prominent display",
      informationHierarchy: ["Team matchup with logos", "Current score", "Alert type and details", "AI analysis", "Weather conditions"]
    };
  }
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

    const response = await openai.chat.completions.create({
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
