// Basic AI System - Simple and efficient OpenAI integration
// Provides AI-enhanced alerts without complexity

interface AlertContext {
  sport: string;
  gameId: string;
  type: string;
  situation: string;
  probability: number;
  weather?: any;
  teams: {
    home: string;
    away: string;
  };
}

interface AIEnhancement {
  confidence: number;
  insights: string;
  recommendation: string;
  enhanced: boolean;
}

// Placeholder for betting insights structure, assuming it's defined elsewhere
interface BettingInsights {
  insights: string;
  recommendation: string;
  confidence: number;
}

export class BasicAI {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/chat/completions';
  private isConfigured = false; // Assume configuration check happens elsewhere

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    // Check for disable flags first
    this.isConfigured = this.checkIfEnabled() && !!this.apiKey;
  }

  // Check if AI system is enabled via disable flags
  private checkIfEnabled(): boolean {
    try {
      const fs = require('fs');
      const path = require('path');
      const disableFlagsPath = path.join(__dirname, '../.disable-flags');
      
      if (fs.existsSync(disableFlagsPath)) {
        const flags = JSON.parse(fs.readFileSync(disableFlagsPath, 'utf8'));
        if (flags.ai_disabled || flags.openai_disabled) {
          console.log('🚫 AI System: DISABLED via disable flags');
          return false;
        }
      }
      console.log('✅ OpenAI: ENABLED');
      return true;
    } catch (error) {
      console.warn('⚠️ Could not check disable flags, force disabling AI');
      return false; // Force disable on error
    }
  }

  // Public getter for isConfigured
  get configured(): boolean {
    return this.isConfigured;
  }

  // Simple AI enhancement for high-value alerts
  async enhanceAlert(context: AlertContext): Promise<AIEnhancement> {
    // Only enhance high-probability alerts to save API costs
    if (context.probability < 70) {
      return {
        confidence: context.probability,
        insights: '',
        recommendation: '',
        enhanced: false
      };
    }

    if (!this.apiKey) {
      console.log('⚠️ OpenAI API key not found - skipping AI enhancement');
      return {
        confidence: context.probability,
        insights: '',
        recommendation: '',
        enhanced: false
      };
    }

    try {
      const prompt = this.buildPrompt(context);
      const response = await this.callOpenAI(prompt);

      return {
        confidence: Math.min(context.probability + 10, 95), // AI boost
        insights: response.insights,
        recommendation: response.recommendation,
        enhanced: true
      };
    } catch (error) {
      console.error('AI enhancement error:', error);
      return {
        confidence: context.probability,
        insights: '',
        recommendation: '',
        enhanced: false
      };
    }
  }

  // Build focused prompt for sports betting insights
  private buildPrompt(context: AlertContext): string {
    return `
Analyze this ${context.sport} betting situation:

GAME: ${context.teams.away} @ ${context.teams.home}
SITUATION: ${context.situation}
ALERT TYPE: ${context.type}
PROBABILITY: ${context.probability}%
${context.weather ? `WEATHER: ${context.weather.temperature}°F, ${context.weather.condition}` : ''}

Provide:
1. Quick betting insight (1 sentence)
2. Simple recommendation (Over/Under/Spread)

Keep response under 100 words. Focus on immediate betting value.
    `.trim();
  }

  // Simple OpenAI API call
  private async callOpenAI(prompt: string): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a sports betting analyst. Provide brief, actionable betting insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse response into structured format
    const lines = content.split('\n').filter((line: string) => line.trim());
    return {
      insights: lines[0] || 'High-value betting opportunity',
      recommendation: lines[1] || 'Monitor closely'
    };
  }

  // Quick confidence boost for RE24-enhanced alerts
  calculateAIConfidence(baseConfidence: number, situation: string): number {
    let boost = 0;

    // Situational boosts
    if (situation.includes('bases loaded')) boost += 15;
    if (situation.includes('2 outs')) boost += 10;
    if (situation.includes('late inning')) boost += 10;
    if (situation.includes('close game')) boost += 5;

    return Math.min(baseConfidence + boost, 95);
  }

  // Check if alert is worth AI enhancement
  shouldEnhance(probability: number, alertType: string): boolean {
    // Only enhance high-value situations to control costs
    if (probability >= 80) return true;
    if (probability >= 70 && ['RISP', 'BASES_LOADED', 'CLOSE_GAME'].includes(alertType)) return true;
    return false;
  }

  // Fallback insights when AI is not configured or fails
  private getFallbackInsights(context: AlertContext): BettingInsights {
    return {
      insights: 'AI insights unavailable. Monitor game closely.',
      recommendation: 'HOLD',
      confidence: context.probability // Fallback to original probability
    };
  }

  // Function to generate betting insights using AI
  async generateBettingInsights(context: AlertContext): Promise<BettingInsights> {
    if (!this.isConfigured) {
      return this.getFallbackInsights(context);
    }

    // Check if this alert type should get AI enhancement
    if (!this.shouldEnhance(context.probability, context.type)) {
      return this.getFallbackInsights(context);
    }

    try {
      console.log(`🤖 AI: Generating betting insights for ${context.type} alert with ${context.probability}% probability`);
      const prompt = this.buildPrompt(context);
      const aiResponse = await this.callOpenAI(prompt);

      console.log(`✅ AI: Generated betting insights - ${aiResponse.insights}`);
      return {
        insights: aiResponse.insights,
        recommendation: aiResponse.recommendation,
        confidence: this.calculateAIConfidence(context.probability, context.situation)
      };
    } catch (error) {
      console.error('❌ AI betting insights failed:', error);
      return this.getFallbackInsights(context);
    }
  }

  // Simple response generation method for AI enhancements
  async generateResponse(prompt: string): Promise<string | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await this.callOpenAI(prompt);
      return response.insights || null;
    } catch (error) {
      console.error('AI response generation error:', error);
      return null;
    }
  }
}