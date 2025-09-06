import { BasicAI } from './basic-ai';
import { storage } from '../storage';

export interface AlertContext {
  gameId: string;
  sport: string;
  alertType: string;
  priority: number;
  probability: number;

  // Game State
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;

  // Sport-specific context
  inning?: number;
  outs?: number;
  balls?: number;
  strikes?: number;
  quarter?: number;
  timeRemaining?: string;
  baseRunners?: string[];

  // Betting context
  betbookData?: any;

  // Environmental
  weather?: {
    temperature: number;
    condition: string;
    windSpeed?: number;
    humidity?: number;
  };

  // Historical context
  recentEvents?: string[];
  playerStats?: any;

  // Original message
  originalMessage: string;
  originalContext: any;
}

export interface AIEnhancedAlert {
  // AI-enhanced content
  title: string;
  message: string;
  insights: string[];
  recommendation: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Predictive analysis
  gameProjection: {
    finalScorePrediction: string;
    keyMoments: string[];
    winProbability: { home: number; away: number };
  };

  // User engagement
  callToAction: string;
  followUpActions: string[];

  // Original data preserved
  originalContext: any;
  aiProcessingTime: number;
  confidenceScore: number;
}

export class AIContextController {
  private basicAI: BasicAI;

  constructor() {
    this.basicAI = new BasicAI();
  }

  async enhanceAlertWithFullControl(context: AlertContext): Promise<AIEnhancedAlert> {
    const startTime = Date.now();

    // OpenAI is force disabled
    console.log('🚫 AI Context Controller: DISABLED - OpenAI integration turned off');
    return this.getFallbackAlert(context);

    try {
      console.log(`🤖 AI Context Controller: Taking full control of ${context.alertType} alert`);

      // AI analyzes the complete game state and generates enhanced content
      const [
        enhancedContent,
        gameProjection,
        userEngagement
      ] = await Promise.all([
        this.generateEnhancedContent(context),
        this.generateGameProjection(context),
        this.generateUserEngagement(context)
      ]);

      const processingTime = Date.now() - startTime;

      console.log(`✅ AI Context Controller: Enhanced ${context.alertType} in ${processingTime}ms`);

      return {
        ...enhancedContent,
        gameProjection: gameProjection,
        ...userEngagement,
        originalContext: context.originalContext,
        aiProcessingTime: processingTime,
        confidenceScore: this.calculateConfidenceScore(context, enhancedContent)
      };

    } catch (error) {
      console.error('❌ AI Context Controller failed:', error);
      return this.getFallbackAlert(context);
    }
  }

  private async generateEnhancedContent(context: AlertContext): Promise<{
    title: string;
    message: string;
    insights: string[];
    recommendation: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }> {
    const prompt = this.buildContentPrompt(context);
    const response = await this.basicAI.generateResponse(prompt);

    if (!response) {
      throw new Error('AI content generation failed');
    }

    // Parse AI response into structured content
    const lines = response.split('\n').filter(line => line.trim());

    return {
      title: this.extractTitle(lines, context),
      message: this.extractMessage(lines, context),
      insights: this.extractInsights(lines, context),
      recommendation: this.extractRecommendation(lines, context),
      urgency: this.determineUrgency(context)
    };
  }

  private async generateGameProjection(context: AlertContext): Promise<{
    finalScorePrediction: string;
    keyMoments: string[];
    winProbability: { home: number; away: number };
  }> {
    const prompt = `
Project the outcome of this ${context.sport} game:

CURRENT: ${context.awayTeam} ${context.awayScore}, ${context.homeTeam} ${context.homeScore}
CONTEXT: ${context.alertType} alert triggered
${this.formatGameState(context)}

Provide:
1. Final score prediction
2. 3 key upcoming moments to watch
3. Current win probabilities (must sum to 100)

Be specific and actionable.
`;

    const response = await this.basicAI.generateResponse(prompt);
    if (!response) {
      const homeLead = context.homeScore - context.awayScore;
      const homeWinProb = Math.max(10, Math.min(90, 50 + (homeLead * 15)));

      return {
        finalScorePrediction: `${context.awayTeam} ${context.awayScore + 2}, ${context.homeTeam} ${context.homeScore + 1}`,
        keyMoments: ['Next scoring opportunity', 'Defensive stop', 'Late game situation'],
        winProbability: { home: homeWinProb, away: 100 - homeWinProb }
      };
    }

    return this.parseProjectionResponse(response, context);
  }

  private async generateUserEngagement(context: AlertContext): Promise<{
    callToAction: string;
    followUpActions: string[];
  }> {
    const urgencyLevel = this.determineUrgency(context);

    const actions = {
      'CRITICAL': {
        cta: '🚨 ACT NOW - Prime betting window closing!',
        actions: ['Place live bet immediately', 'Check multiple sportsbooks', 'Monitor next 2 minutes closely']
      },
      'HIGH': {
        cta: '⚡ High-value opportunity - Act quickly!',
        actions: ['Review betting options', 'Set up live alerts', 'Watch for momentum shift']
      },
      'MEDIUM': {
        cta: '📊 Good betting spot - Consider your options',
        actions: ['Analyze the situation', 'Compare odds', 'Set price alerts']
      },
      'LOW': {
        cta: '👀 Situation developing - Stay alert',
        actions: ['Monitor progression', 'Note for future', 'Track patterns']
      }
    };

    return actions[urgencyLevel];
  }

  private buildContentPrompt(context: AlertContext): string {
    return `
You are the final AI layer controlling alert delivery for a sports betting app. Rewrite this alert with complete contextual awareness:

ALERT TYPE: ${context.alertType}
ORIGINAL MESSAGE: ${context.originalMessage}
GAME: ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
PROBABILITY: ${context.probability}%
${this.formatGameState(context)}
${context.weather ? `WEATHER: ${context.weather.temperature}°F, ${context.weather.condition}` : ''}

Your mission: Create the most valuable, actionable alert possible. Consider:
- Immediate betting opportunities
- Game momentum and context  
- User urgency and timing
- Predictive insights

Provide:
1. Compelling title (under 60 chars)
2. Clear, actionable message (under 120 chars)
3. 3 key insights
4. Primary recommendation

Make every word count. Users need instant clarity and value.
`;
  }

  private formatGameState(context: AlertContext): string {
    let state = '';

    if (context.sport === 'MLB' || context.sport === 'NCAAF') {
      if (context.inning) state += `${context.inning}th inning, `;
      if (context.outs !== undefined) state += `${context.outs} outs, `;
      if (context.balls !== undefined && context.strikes !== undefined) {
        state += `${context.balls}-${context.strikes} count`;
      }
      if (context.baseRunners?.length) {
        state += `, runners: ${context.baseRunners.join(', ')}`;
      }
    } else if (context.sport === 'NFL' || context.sport === 'CFL') {
      if (context.quarter) state += `Q${context.quarter}, `;
      if (context.timeRemaining) state += `${context.timeRemaining} left`;
    }

    return state;
  }

  private extractTitle(lines: string[], context: AlertContext): string {
    const titleLine = lines.find(line => 
      line.toLowerCase().includes('title') || 
      line.length < 60 && line.includes(context.alertType)
    );

    return titleLine?.replace(/^title:?\s*/i, '').trim() || 
           `🚨 ${context.alertType.replace('_', ' ')} Alert`;
  }

  private extractMessage(lines: string[], context: AlertContext): string {
    const messageLine = lines.find(line => 
      line.toLowerCase().includes('message') ||
      (line.length > 30 && line.length < 120)
    );

    return messageLine?.replace(/^message:?\s*/i, '').trim() || 
           context.originalMessage;
  }

  private extractInsights(lines: string[], context: AlertContext): string[] {
    const insightLines = lines.filter(line => 
      line.match(/^\d\./) || 
      line.toLowerCase().includes('insight') ||
      line.includes('•') || line.includes('-')
    );

    return insightLines.slice(0, 3).map(line => 
      line.replace(/^\d+\.?\s*|^[•-]\s*/g, '').trim()
    );
  }

  private extractRecommendation(lines: string[], context: AlertContext): string {
    const recLine = lines.find(line => 
      line.toLowerCase().includes('recommendation') ||
      line.toLowerCase().includes('bet') ||
      line.toLowerCase().includes('action')
    );

    return recLine?.replace(/^recommendation:?\s*/i, '').trim() || 
           'Monitor situation closely';
  }

  private determineUrgency(context: AlertContext): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (context.probability >= 90) return 'CRITICAL';
    if (context.probability >= 80) return 'HIGH';
    if (context.probability >= 70) return 'MEDIUM';
    return 'LOW';
  }

  private parseProjectionResponse(response: string, context: AlertContext): {
    finalScorePrediction: string;
    keyMoments: string[];
    winProbability: { home: number; away: number };
  } {
    const lines = response.split('\n').filter(line => line.trim());

    // Extract win probability from response or calculate
    const homeLead = context.homeScore - context.awayScore;
    const homeWinProb = Math.max(10, Math.min(90, 50 + (homeLead * 12)));

    return {
      finalScorePrediction: lines[0]?.trim() || `${context.awayTeam} ${context.awayScore + 1}, ${context.homeTeam} ${context.homeScore + 2}`,
      keyMoments: lines.slice(1, 4).map(line => line.replace(/^\d+\.?\s*/g, '')),
      winProbability: { 
        home: homeWinProb, 
        away: 100 - homeWinProb 
      }
    };
  }

  private calculateConfidenceScore(context: AlertContext, content: any): number {
    let score = context.probability;

    // Boost for high-urgency situations
    if (content.urgency === 'CRITICAL') score += 15;
    else if (content.urgency === 'HIGH') score += 10;

    // Boost for multi-factor analysis
    if (context.weather) score += 5;
    if (context.playerStats) score += 5;
    if (context.betbookData) score += 5;

    return Math.min(95, score);
  }

  private getFallbackAlert(context: AlertContext): AIEnhancedAlert {
    return {
      title: `${context.alertType.replace('_', ' ')} Alert`,
      message: context.originalMessage,
      insights: ['High-probability situation detected', 'Monitor game closely', 'Betting opportunity available'],
      recommendation: 'Consider live betting options',
      urgency: this.determineUrgency(context),
      gameProjection: {
        finalScorePrediction: `${context.awayTeam} vs ${context.homeTeam} - Close finish expected`,
        keyMoments: ['Next scoring opportunity', 'Defensive stand', 'Final minutes'],
        winProbability: { home: 50, away: 50 }
      },
      callToAction: '📊 Situation developing - Stay alert',
      followUpActions: ['Monitor progression', 'Check betting lines', 'Set alerts'],
      originalContext: context.originalContext,
      aiProcessingTime: 0,
      confidenceScore: context.probability
    };
  }
}