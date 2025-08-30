// OpenAiEngine.ts
//
// Sports Analysis AI Engine using OpenAI
// Provides intelligent sports analysis for various game situations
// Used by other engines for contextual sports insights

import OpenAI from 'openai';

export interface GameSituation {
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  gameState: string; // inning, quarter, period, etc.
  timeRemaining?: string;
  keyPlayers?: Array<{
    name: string;
    position: string;
    stats?: any;
  }>;
  situationContext: string; // Current game situation description
  scoringProbability?: number;
  priority?: number;
}

export interface SportsAnalysis {
  summary: string;
  keyInsights: string[];
  momentum: 'home' | 'away' | 'neutral';
  confidence: number; // 0-100
  recommendation: string;
}

export class OpenAiEngine {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('🤖 OpenAI Sports Analysis Engine initialized');
  }

  /**
   * Analyze a live sports situation and provide intelligent insights
   */
  async analyzeSituation(situation: GameSituation): Promise<SportsAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(situation);
      
      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: 'system',
            content: 'You are a professional sports analyst with deep knowledge of game dynamics, player performance, and situational analysis. Provide objective, data-driven insights in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 300,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(response);
      
      return {
        summary: analysis.summary || 'Analysis unavailable',
        keyInsights: analysis.keyInsights || [],
        momentum: analysis.momentum || 'neutral',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 75)),
        recommendation: analysis.recommendation || 'Monitor situation closely'
      };
    } catch (error) {
      console.error('❌ OpenAI Analysis Error:', error);
      return this.getFallbackAnalysis(situation);
    }
  }

  /**
   * Analyze real-time game data and provide intelligent insights
   */
  async analyzeGameSituation(gameData: any): Promise<string> {
    try {
      const situation = gameData.espnData?.competitions[0]?.situation;
      const status = gameData.espnData?.status;
      const competition = gameData.espnData?.competitions[0];
      
      const prompt = `You are an expert college football analyst with access to real-time ESPN game data. Analyze this live game situation and provide intelligent insights:

🏈 REAL-TIME GAME DATA ANALYSIS:

TEAMS: ${gameData.awayTeam} @ ${gameData.homeTeam}
SCORE: ${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeTeam} ${gameData.homeScore}
TIME: ${status?.displayClock || 'Unknown'} remaining in ${this.getQuarter(status?.period)}
FIELD POSITION: ${situation?.yardLine ? `${situation.team?.abbreviation} ${situation.yardLine}` : 'Unknown'}
DOWN & DISTANCE: ${situation?.down ? `${this.getDownText(situation.down)} & ${situation.distance}` : 'Unknown'}
RED ZONE: ${situation?.isRedZone ? 'YES' : 'NO'}
POSSESSION: ${situation?.team?.displayName || 'Unknown'}

ADDITIONAL CONTEXT:
- Conference: ${competition?.conference?.name || 'Unknown'}
- Venue: ${competition?.venue?.fullName || 'Unknown'}
- Game Status: ${status?.type?.description || 'Unknown'}

ANALYSIS REQUEST:
Based on this real-time data, provide 2-3 sentences of expert analysis focusing on:
- Current field position and scoring opportunity
- Time pressure and clock management implications  
- Down and distance strategy considerations
- Momentum and tactical situation
- What fans should be watching for next

Provide professional sports analysis like you're calling the game live on television. Focus on WHY this moment matters strategically.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 250,
      });

      const analysis = completion.choices[0]?.message?.content?.trim();
      
      console.log(`🤖 OpenAI Game Analysis Length: ${analysis ? analysis.length : 0}`);
      console.log(`🤖 OpenAI Game Analysis: "${analysis}"`);
      
      if (analysis && analysis.length > 20) {
        return analysis;
      } else {
        console.log(`❌ Analysis too short (${analysis ? analysis.length : 0} chars): "${analysis}"`);
        throw new Error(`Generated analysis too short: ${analysis ? analysis.length : 0} characters`);
      }
    } catch (error) {
      console.error('❌ OpenAI Game Analysis Error:', error);
      return this.getFallbackGameAnalysis(gameData);
    }
  }

  private getQuarter(period: number): string {
    if (!period) return '1st Quarter';
    if (period === 1) return '1st Quarter';
    if (period === 2) return '2nd Quarter';
    if (period === 3) return '3rd Quarter';
    if (period === 4) return '4th Quarter';
    if (period > 4) return 'Overtime';
    return `Period ${period}`;
  }

  private getDownText(down: number): string {
    if (down === 1) return '1st';
    if (down === 2) return '2nd';
    if (down === 3) return '3rd';
    if (down === 4) return '4th';
    return `${down}th`;
  }

  private getFallbackGameAnalysis(gameData: any): string {
    return `${gameData.awayTeam} trails ${gameData.homeTeam} ${gameData.awayScore}-${gameData.homeScore} in a developing game situation. The momentum could shift dramatically with the next possession as both teams battle for field position and scoring opportunities.`;
  }

  /**
   * Generate a concise alert description for sports situations (Legacy method)
   */
  async generateAlertDescription(situation: GameSituation): Promise<string> {
    try {
      const prompt = `You are a professional college football analyst providing real-time insights. Analyze this live game situation and provide a sophisticated, detailed alert for sports enthusiasts:

🏈 LIVE COLLEGE FOOTBALL ANALYSIS REQUEST:

MATCHUP: ${situation.awayTeam} @ ${situation.homeTeam}
CURRENT SCORE: ${situation.awayTeam} ${situation.awayScore} - ${situation.homeTeam} ${situation.homeScore}
GAME STATE: ${situation.gameState}
SITUATION: ${situation.situationContext}
${situation.scoringProbability ? `SCORING PROBABILITY: ${Math.round(situation.scoringProbability * 100)}%` : ''}
ALERT PRIORITY: ${situation.priority}/100

ANALYSIS REQUIREMENTS:
- Provide 2-3 sentences of sophisticated game analysis
- Include strategic insights about team positioning and momentum  
- Mention specific tactical implications and what to watch for
- Use professional sports terminology
- Make it engaging for serious college football fans
- Focus on WHY this moment matters, not just WHAT is happening

Format your response as a single, flowing analytical description (no bullet points or lists). Sound like an expert analyst breaking down the action for passionate fans.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 200,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      const description = completion.choices[0]?.message?.content?.trim();
      
      console.log(`🤖 OpenAI Raw Response Length: ${description ? description.length : 0}`);
      console.log(`🤖 OpenAI Raw Response: "${description}"`);
      
      if (description && description.length > 15) {
        return description;
      } else {
        console.log(`❌ Description too short (${description ? description.length : 0} chars): "${description}"`);
        throw new Error(`Generated description too short: ${description ? description.length : 0} characters`);
      }
    } catch (error) {
      console.error('❌ OpenAI Alert Description Error:', error);
      return this.getFallbackDescription(situation);
    }
  }

  /**
   * Analyze player performance in current context
   */
  async analyzePlayerImpact(situation: GameSituation, playerId?: string): Promise<string> {
    try {
      if (!situation.keyPlayers?.length) {
        return 'No player data available for analysis';
      }

      const prompt = `Analyze the impact of key players in this ${situation.sport} situation:

Game: ${situation.awayTeam} @ ${situation.homeTeam} (${situation.awayScore}-${situation.homeScore})
Current Situation: ${situation.situationContext}
Key Players: ${JSON.stringify(situation.keyPlayers)}

Provide a brief analysis (max 150 characters) of how these players might impact the outcome.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 60,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      return completion.choices[0]?.message?.content?.trim() || 'Player impact analysis unavailable';
    } catch (error) {
      console.error('❌ OpenAI Player Analysis Error:', error);
      return 'Player impact analysis temporarily unavailable';
    }
  }

  /**
   * Generate contextual game insights
   */
  async generateContextualInsight(situation: GameSituation): Promise<string> {
    try {
      const prompt = `Provide a single key insight about this ${situation.sport} game situation:

${situation.awayTeam} @ ${situation.homeTeam}
Score: ${situation.awayScore}-${situation.homeScore}
Context: ${situation.situationContext}
${situation.scoringProbability ? `Scoring Chance: ${Math.round(situation.scoringProbability * 100)}%` : ''}

What's the most important factor fans should watch for? (max 100 characters)`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 40,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      return completion.choices[0]?.message?.content?.trim() || 'Key insight unavailable';
    } catch (error) {
      console.error('❌ OpenAI Insight Error:', error);
      return 'Watch for momentum shifts in this critical moment';
    }
  }

  private buildAnalysisPrompt(situation: GameSituation): string {
    return `Analyze this ${situation.sport} game situation and respond with JSON:

GAME DETAILS:
- Teams: ${situation.awayTeam} @ ${situation.homeTeam}
- Score: ${situation.awayTeam} ${situation.awayScore} - ${situation.homeTeam} ${situation.homeScore}
- Game State: ${situation.gameState}
- Context: ${situation.situationContext}
${situation.scoringProbability ? `- Scoring Probability: ${Math.round(situation.scoringProbability * 100)}%` : ''}
${situation.keyPlayers ? `- Key Players: ${JSON.stringify(situation.keyPlayers)}` : ''}

Respond with JSON containing:
{
  "summary": "Brief game situation summary (max 150 chars)",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "momentum": "home|away|neutral",
  "confidence": 85,
  "recommendation": "What to watch for next (max 100 chars)"
}`;
  }

  private getFallbackAnalysis(situation: GameSituation): SportsAnalysis {
    const scoreDiff = Math.abs(situation.homeScore - situation.awayScore);
    const isCloseGame = scoreDiff <= 3;
    
    return {
      summary: `${situation.sport} game between ${situation.awayTeam} and ${situation.homeTeam} in ${situation.gameState}`,
      keyInsights: [
        isCloseGame ? 'Close game situation' : 'Score differential significant',
        'Key moment in the game',
        'Monitor for momentum shifts'
      ],
      momentum: scoreDiff === 0 ? 'neutral' : 'neutral',
      confidence: 60,
      recommendation: 'Watch for critical plays and momentum changes'
    };
  }

  private getFallbackDescription(situation: GameSituation): string {
    const prob = situation.scoringProbability ? `${Math.round(situation.scoringProbability * 100)}% ` : '';
    return `${situation.awayTeam} @ ${situation.homeTeam}: ${prob}scoring opportunity in ${situation.gameState}`;
  }
}

// Export singleton instance
export const openAiEngine = new OpenAiEngine();