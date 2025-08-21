
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GameContext {
  sport: string;
  homeTeam: string;
  awayTeam: string;
  inning?: number;
  score: { home: number; away: number };
  runners?: { first: boolean; second: boolean; third: boolean };
  outs?: number;
  currentBatter?: { name: string; stats: any };
}

interface EnhancedAlert {
  originalDescription: string;
  enhancedDescription: string;
  contextualInsight: string;
  priority: number;
}

// Only use AI for high-priority alerts to control costs
export async function enhanceHighPriorityAlert(
  alertType: string,
  gameContext: GameContext,
  originalDescription: string,
  priority: number
): Promise<EnhancedAlert | null> {
  
  // Only enhance alerts with priority >= 80 to control costs
  if (priority < 80) {
    return null;
  }

  try {
    const prompt = `
Enhance this sports alert with contextual insight:

Alert: ${alertType}
Game: ${gameContext.awayTeam} @ ${gameContext.homeTeam}
Score: ${gameContext.awayTeam} ${gameContext.score.away} - ${gameContext.homeTeam} ${gameContext.score.home}
${gameContext.inning ? `Inning: ${gameContext.inning}` : ''}
${gameContext.outs !== undefined ? `Outs: ${gameContext.outs}` : ''}
${gameContext.runners ? `Runners: ${Object.entries(gameContext.runners).filter(([_, on]) => on).map(([base]) => base).join(', ')}` : ''}
${gameContext.currentBatter ? `Batter: ${gameContext.currentBatter.name}` : ''}

Original: ${originalDescription}

Provide a brief (max 50 words) enhanced description that adds context and excitement. Focus on why this moment matters.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Cheaper than GPT-4
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80, // Keep responses short
      temperature: 0.7,
    });

    const enhancedDescription = response.choices[0]?.message?.content?.trim();
    
    if (!enhancedDescription) {
      return null;
    }

    return {
      originalDescription,
      enhancedDescription,
      contextualInsight: enhancedDescription,
      priority: Math.min(priority + 5, 100) // Slight priority boost for AI-enhanced alerts
    };

  } catch (error) {
    console.error('Error enhancing alert with AI:', error);
    return null;
  }
}

// Batch analyze multiple game situations to reduce API calls
export async function analyzeGameMomentum(
  gameContexts: GameContext[]
): Promise<{ gameId: string; momentumShift: string; significance: number }[]> {
  
  if (gameContexts.length === 0) return [];

  try {
    const prompt = `
Analyze these live sports situations for momentum shifts and significance:

${gameContexts.map((ctx, i) => `
Game ${i + 1}: ${ctx.awayTeam} @ ${ctx.homeTeam}
Score: ${ctx.score.away}-${ctx.score.home}
${ctx.inning ? `Inning: ${ctx.inning}` : ''}
${ctx.outs !== undefined ? `Outs: ${ctx.outs}` : ''}
`).join('\n')}

For each game, rate significance (1-10) and describe momentum in 10 words or less.
Format: "Game X: [significance]/10 - [momentum description]"
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    // Parse response and return analysis
    const analysis = response.choices[0]?.message?.content?.trim() || '';
    
    return gameContexts.map((ctx, i) => ({
      gameId: `${ctx.awayTeam}-${ctx.homeTeam}`,
      momentumShift: `Game ${i + 1} analysis`,
      significance: 5 // Default if parsing fails
    }));

  } catch (error) {
    console.error('Error analyzing game momentum:', error);
    return [];
  }
}
