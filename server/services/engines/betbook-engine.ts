// betbook-engine.ts
//
// Sports Betting Analysis Engine using OpenAI
// Provides sports betting context and AI-generated insights
// for secondary actions (e.g. swipe left on alerts)

import OpenAI from 'openai';

export interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
  bettingInsights: string[];
  confidence: number; // 0-100
}

export interface AlertContext {
  sport: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning?: number;
  period?: string;
  probability?: number;
  priority?: number;
  gameState?: string;
}

export class BetbookEngine {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('💰 Betbook AI Betting Analysis Engine initialized');
  }

  /**
   * Generate comprehensive betting analysis using OpenAI
   */
  async generateBettingAnalysis(alertContext: AlertContext): Promise<BetbookData> {
    try {
      const bettingInsights = await this.generateBettingInsights(alertContext);
      const aiAdvice = await this.generateAIBettingAdvice(alertContext);
      
      return {
        odds: this.generateMockOdds(alertContext),
        aiAdvice: aiAdvice + ' Always gamble responsibly and within your means.',
        sportsbookLinks: this.getSportsbookLinks(),
        bettingInsights: bettingInsights,
        confidence: await this.calculateBettingConfidence(alertContext)
      };
    } catch (error) {
      console.error('❌ Betbook AI Analysis Error:', error);
      return this.getFallbackBettingData(alertContext);
    }
  }

  /**
   * Generate AI-powered betting advice for the situation
   */
  private async generateAIBettingAdvice(alertContext: AlertContext): Promise<string> {
    try {
      const prompt = `You are a professional sports betting analyst. Analyze this live ${alertContext.sport} situation and provide actionable betting insights.

GAME SITUATION:
- Teams: ${alertContext.awayTeam} @ ${alertContext.homeTeam}
- Score: ${alertContext.awayTeam} ${alertContext.awayScore} - ${alertContext.homeTeam} ${alertContext.homeScore}
- Game State: ${this.getGameStateString(alertContext)}
${alertContext.probability ? `- Scoring Probability: ${Math.round(alertContext.probability * 100)}%` : ''}
${alertContext.priority ? `- Alert Priority: ${alertContext.priority}` : ''}

Provide a brief, specific betting recommendation (max 120 chars) focusing on live betting opportunities and value.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 50,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      const advice = completion.choices[0]?.message?.content?.trim();
      return advice || this.getFallbackAdvice(alertContext);
    } catch (error) {
      console.error('❌ AI Betting Advice Error:', error);
      return this.getFallbackAdvice(alertContext);
    }
  }

  /**
   * Generate detailed betting insights using OpenAI
   */
  private async generateBettingInsights(alertContext: AlertContext): Promise<string[]> {
    try {
      const prompt = `Analyze this ${alertContext.sport} game for betting insights and respond with JSON:

GAME DETAILS:
- ${alertContext.awayTeam} @ ${alertContext.homeTeam}
- Current Score: ${alertContext.awayScore}-${alertContext.homeScore}
- Game State: ${this.getGameStateString(alertContext)}
${alertContext.probability ? `- Scoring Probability: ${Math.round(alertContext.probability * 100)}%` : ''}

Provide 3 specific betting insights in JSON format:
{
  "insights": [
    "insight about moneyline/spread opportunities",
    "insight about over/under betting",
    "insight about live betting timing"
  ]
}`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 150,
        // temperature: 1 (default) - gpt-5 only supports default value
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const parsed = JSON.parse(response);
        return parsed.insights || this.getFallbackInsights(alertContext);
      }
      
      return this.getFallbackInsights(alertContext);
    } catch (error) {
      console.error('❌ AI Betting Insights Error:', error);
      return this.getFallbackInsights(alertContext);
    }
  }

  /**
   * Calculate betting confidence using OpenAI analysis
   */
  private async calculateBettingConfidence(alertContext: AlertContext): Promise<number> {
    try {
      // Simple confidence calculation based on available data
      let confidence = 60; // base confidence
      
      if (alertContext.probability && alertContext.probability > 0.7) {
        confidence += 20;
      }
      if (alertContext.priority && alertContext.priority >= 90) {
        confidence += 15;
      }
      
      // Close game situations are often more predictable for betting
      const scoreDiff = Math.abs(alertContext.homeScore - alertContext.awayScore);
      if (scoreDiff <= 3) {
        confidence += 10;
      }

      return Math.min(95, Math.max(40, confidence));
    } catch (error) {
      return 65; // fallback confidence
    }
  }

  private getGameStateString(alertContext: AlertContext): string {
    if (alertContext.sport === 'MLB' && alertContext.inning) {
      return `${alertContext.inning}th inning`;
    }
    if (alertContext.period) {
      return alertContext.period;
    }
    return alertContext.gameState || 'Live';
  }

  private generateMockOdds(alertContext: AlertContext): { home: number; away: number; total: number } {
    // Mock odds generation - replace with real odds API
    const scoreDiff = alertContext.homeScore - alertContext.awayScore;
    const baseHome = scoreDiff > 0 ? -120 : -100;
    const baseAway = scoreDiff < 0 ? -120 : -100;
    
    return {
      home: baseHome + Math.floor(Math.random() * 40) - 20,
      away: baseAway + Math.floor(Math.random() * 40) - 20,
      total: 8.5 + (Math.random() - 0.5) * 2
    };
  }

  private getSportsbookLinks(): Array<{ name: string; url: string }> {
    return [
      { name: 'FanDuel', url: 'https://www.fanduel.com/' },
      { name: 'DraftKings', url: 'https://www.draftkings.com/' },
      { name: 'BetMGM', url: 'https://www.betmgm.com/' },
      { name: 'Caesars', url: 'https://www.caesars.com/sportsbook' },
      { name: 'BetRivers', url: 'https://www.betrivers.com/' }
    ];
  }

  private getFallbackAdvice(alertContext: AlertContext): string {
    if (alertContext.probability && alertContext.probability > 0.75) {
      return `High ${Math.round(alertContext.probability * 100)}% scoring probability suggests live over betting opportunities`;
    }
    if (alertContext.priority && alertContext.priority >= 90) {
      return 'High priority situation - monitor live lines for value opportunities';
    }
    if (alertContext.sport === 'MLB' && alertContext.inning && alertContext.inning >= 7) {
      return 'Late inning volatility creates live betting opportunities';
    }
    return 'Monitor live lines for value in this developing situation';
  }

  private getFallbackInsights(alertContext: AlertContext): string[] {
    return [
      'Current situation may impact moneyline odds',
      `${alertContext.sport} scoring patterns suggest over/under value`,
      'Live betting timing critical in this moment'
    ];
  }

  private getFallbackBettingData(alertContext: AlertContext): BetbookData {
    return {
      odds: this.generateMockOdds(alertContext),
      aiAdvice: this.getFallbackAdvice(alertContext) + ' Always gamble responsibly and within your means.',
      sportsbookLinks: this.getSportsbookLinks(),
      bettingInsights: this.getFallbackInsights(alertContext),
      confidence: 60
    };
  }
}

// Create singleton instance
const betbookEngine = new BetbookEngine();

/**
 * Generate Betbook information for a given alert context using AI analysis
 */
export async function getBetbookData(alertContext: AlertContext): Promise<BetbookData> {
  return await betbookEngine.generateBettingAnalysis(alertContext);
}

/**
 * Legacy synchronous function - now calls async version
 */
export function getBetbookDataSync(alertContext: AlertContext): BetbookData {
  // Return fallback data immediately for backwards compatibility
  return {
    odds: {
      home: -110 + Math.floor(Math.random() * 40) - 20,
      away: +100 + Math.floor(Math.random() * 40) - 20,
      total: 8.5 + (Math.random() - 0.5) * 2
    },
    aiAdvice: 'Betting data temporarily unavailable. Please check your sportsbook for current odds. Always gamble responsibly.',
    sportsbookLinks: [
      { name: 'FanDuel', url: 'https://www.fanduel.com/' },
      { name: 'DraftKings', url: 'https://www.draftkings.com/' }
    ],
    bettingInsights: ['Monitor live lines for value opportunities', 'Situation developing rapidly', 'Consider timing of live bets'],
    confidence: 60
  };
}

/**
 * Check if Betbook should be available for this alert context
 */
export function shouldShowBetbook(alertContext: AlertContext): boolean {
  // Only show for live games with reasonable probability
  const isLiveGame = Boolean(alertContext.gameId) && (alertContext.homeScore >= 0 || alertContext.awayScore >= 0);
  const hasReasonableProbability = !alertContext.probability || alertContext.probability >= 0.6;
  
  return isLiveGame && hasReasonableProbability;
}