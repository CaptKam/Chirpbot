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

// Simple cache to reduce API calls
const analysisCache = new Map<string, { analysis: AlertAnalysis; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

// Track quota status
let lastQuotaCheck = 0;
let quotaAvailable = true;
const QUOTA_CHECK_INTERVAL = 60000; // Check quota every minute

function generateDetailedFallback(alertType: string, gameInfo: any, weatherData?: any): string {
  const score = gameInfo.score ? `${gameInfo.score.away}-${gameInfo.score.home}` : 'Unknown score';
  const inning = gameInfo.inning ? ` in the ${gameInfo.inning}${gameInfo.inningState ? ` ${gameInfo.inningState}` : ''}` : '';
  const outs = gameInfo.outs !== undefined ? ` with ${gameInfo.outs} out${gameInfo.outs !== 1 ? 's' : ''}` : '';
  const scoringProb = gameInfo.scoringProbability ? ` (${gameInfo.scoringProbability}% scoring probability)` : '';
  
  let context = `Critical moment${inning}${outs}. Score: ${score}${scoringProb}.`;
  
  // Weather impact
  if (weatherData?.windSpeed && weatherData.windSpeed >= 10) {
    context += ` Wind: ${weatherData.windSpeed}mph ${weatherData.windDirection || ''} affecting ball flight.`;
  }
  
  // Batter context
  if (gameInfo.currentBatter?.name) {
    const batter = gameInfo.currentBatter;
    const hrRate = batter.stats?.hr && batter.stats?.atBats ? `${((batter.stats.hr / batter.stats.atBats) * 100).toFixed(1)}%` : 'Unknown';
    context += ` ${batter.name} batting (${batter.stats?.avg || '?'} AVG, ${hrRate} HR rate).`;
  }
  
  return context;
}

export async function analyzeAlert(
  alertType: string,
  sport: string,
  gameInfo: any,
  weatherData?: any
): Promise<AlertAnalysis> {
  // Create cache key
  const cacheKey = `${alertType}-${sport}-${gameInfo.homeTeam}-${gameInfo.awayTeam}`;
  
  // Check cache first
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.analysis;
  }
  
  // Check if quota might be available again
  if (!quotaAvailable && Date.now() - lastQuotaCheck > QUOTA_CHECK_INTERVAL) {
    quotaAvailable = true;
    console.log("Retrying OpenAI API - quota may be restored");
  }
  
  // Enhanced analysis for high-priority situations
  const detailedAnalysisTypes = ['Runners on 2nd & 3rd, 1 Out', 'Runner on 3rd, 1 Out', 'Runners In Scoring Position', 'Clutch Moment Prediction', 'RBI Opportunity'];
  if (!detailedAnalysisTypes.includes(alertType) || !quotaAvailable) {
    const fallbackAnalysis = {
      context: `${alertType} situation - ${generateDetailedFallback(alertType, gameInfo, weatherData)}`,
      confidence: 75
    };
    analysisCache.set(cacheKey, { analysis: fallbackAnalysis, timestamp: Date.now() });
    return fallbackAnalysis;
  }
  
  try {
    const prompt = `Analyze this critical sports situation with enhanced detail:
    
Alert Type: ${alertType}
Sport: ${sport}  
Game: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}
Score: ${gameInfo.score?.away || 0} - ${gameInfo.score?.home || 0}
Status: ${gameInfo.status}
${sport === 'MLB' ? `Inning: ${gameInfo.inning || '?'} ${gameInfo.inningState || ''}` : ''}
${sport === 'MLB' ? `Outs: ${gameInfo.outs || '?'}` : ''}
${gameInfo.runners ? `Runners: ${Object.entries(gameInfo.runners).filter(([_, value]) => value).map(([base]) => base).join(', ') || 'None'}` : ''}

CURRENT BATTER ANALYSIS:
${gameInfo.currentBatter ? `🏏 ${gameInfo.currentBatter.name} (${gameInfo.currentBatter.batSide === 'L' ? 'Left' : gameInfo.currentBatter.batSide === 'R' ? 'Right' : 'Switch'} handed)
Stats: ${gameInfo.currentBatter.stats.avg || 'N/A'} AVG, ${gameInfo.currentBatter.stats.hr || 0} HR, ${gameInfo.currentBatter.stats.rbi || 0} RBI, ${gameInfo.currentBatter.stats.ops || 'N/A'} OPS
Power Rating: ${gameInfo.currentBatter.stats.hr && gameInfo.currentBatter.stats.atBats ? `${((gameInfo.currentBatter.stats.hr / gameInfo.currentBatter.stats.atBats) * 100).toFixed(1)}% HR rate` : 'Unknown'}
Clutch Factor: ${gameInfo.currentBatter.stats.rbi && gameInfo.currentBatter.stats.rbi > 50 ? 'High RBI producer' : gameInfo.currentBatter.stats.rbi && gameInfo.currentBatter.stats.rbi > 25 ? 'Moderate RBI threat' : 'Limited RBI history'}` : 'Batter data not available'}

ON-DECK BATTER:
${gameInfo.onDeckBatter ? `🔄 ${gameInfo.onDeckBatter.name} (${gameInfo.onDeckBatter.batSide === 'L' ? 'Left' : gameInfo.onDeckBatter.batSide === 'R' ? 'Right' : 'Switch'} handed)
On-Deck Stats: ${gameInfo.onDeckBatter.stats.avg || 'N/A'} AVG, ${gameInfo.onDeckBatter.stats.hr || 0} HR, ${gameInfo.onDeckBatter.stats.rbi || 0} RBI, ${gameInfo.onDeckBatter.stats.ops || 'N/A'} OPS
Threat Level: ${gameInfo.onDeckBatter.stats.ops && gameInfo.onDeckBatter.stats.ops > 0.8 ? 'High threat' : gameInfo.onDeckBatter.stats.ops && gameInfo.onDeckBatter.stats.ops > 0.7 ? 'Moderate threat' : 'Lower threat'}` : 'On-deck batter data not available'}

CURRENT PITCHER:
${gameInfo.currentPitcher ? `⚾ ${gameInfo.currentPitcher.name} (${gameInfo.currentPitcher.throwHand === 'L' ? 'Left' : 'Right'} handed)
Pitching Stats: ${gameInfo.currentPitcher.stats.era || 'N/A'} ERA, ${gameInfo.currentPitcher.stats.whip || 'N/A'} WHIP, ${gameInfo.currentPitcher.stats.strikeOuts || 0} K, ${gameInfo.currentPitcher.stats.wins || 0}-${gameInfo.currentPitcher.stats.losses || 0} W-L
Control: ${gameInfo.currentPitcher.stats.whip && gameInfo.currentPitcher.stats.whip < 1.2 ? 'Excellent control' : gameInfo.currentPitcher.stats.whip && gameInfo.currentPitcher.stats.whip < 1.4 ? 'Good control' : 'Struggles with control'}` : 'Pitcher data not available'}

WEATHER IMPACT ANALYSIS:
${weatherData ? `🌤️ Current Conditions: ${weatherData.temperature}°F, ${weatherData.windSpeed || 0}mph ${weatherData.windDirection || ''} wind, ${weatherData.condition}
Wind Analysis: ${weatherData.windSpeed >= 15 ? `⚠️ HIGH WINDS (${weatherData.windSpeed}mph) - Significantly affects ball flight` : weatherData.windSpeed >= 8 ? `🌬️ MODERATE WINDS (${weatherData.windSpeed}mph) - May affect pop-ups and fly balls` : `🍃 LIGHT WINDS (${weatherData.windSpeed}mph) - Minimal impact on play`}
${weatherData.windDirection ? `Wind Direction Impact: ${weatherData.windDirection.includes('Out') ? '🚀 HITTING ADVANTAGE - Tailwind helps carry balls' : weatherData.windDirection.includes('In') ? '🛡️ PITCHER ADVANTAGE - Headwind knocks down fly balls' : '↔️ NEUTRAL - Crosswind affects ball movement'}` : ''}
Temperature Effect: ${weatherData.temperature >= 80 ? '🔥 HOT WEATHER - Ball travels further, favors hitters' : weatherData.temperature <= 50 ? '🧊 COLD WEATHER - Ball doesn\'t carry, favors pitchers' : '🌡️ IDEAL TEMPERATURE - Neutral conditions'}` : 'Weather data not available'}

Scoring Probability: ${gameInfo.scoringProbability || '?'}%
Count: ${gameInfo.balls || 0}-${gameInfo.strikes || 0}

ANALYSIS REQUIREMENTS:
Provide detailed tactical analysis considering:
1. Current batter's strengths vs current pitcher
2. On-deck threat for strategic decisions  
3. Weather impact on this specific at-bat
4. Game situation and momentum implications
5. Why this moment is critical for both teams

Provide analysis in JSON format with 'context' (2-3 detailed sentences about situation significance, player matchups, weather impact, and tactical implications) and 'confidence' (0-100) fields.`;

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
    
    const analysis = {
      context: result.context || "Analysis unavailable",
      confidence: Math.max(0, Math.min(100, result.confidence || 0))
    };
    
    // Cache the result
    analysisCache.set(cacheKey, { analysis, timestamp: Date.now() });
    return analysis;
  } catch (error: any) {
    // Handle different OpenAI errors
    if (error.status === 429) {
      quotaAvailable = false;
      lastQuotaCheck = Date.now();
      console.log("OpenAI analysis skipped: API quota exceeded, using fallback");
    } else if (error.message === 'OpenAI API timeout') {
      console.log("OpenAI analysis skipped: timeout after 5 seconds");
    } else if (error.message?.includes('API key')) {
      console.log("OpenAI analysis skipped: API key not configured");
    } else {
      // For other errors, try again in a minute
      if (error.status !== 429) {
        quotaAvailable = true;
      }
      console.log("OpenAI analysis skipped:", error.message || "API temporarily unavailable");
    }
    return {
      context: "AI analysis temporarily unavailable",
      confidence: 0
    };
  }
}
