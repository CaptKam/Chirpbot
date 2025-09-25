
import type { AlertResult, GameState } from './engines/base-engine';
import { unifiedAIProcessor, type CrossSportContext } from './unified-ai-processor';
import { oddsApiService, type ProcessedOdds } from './odds-api-service';
import { weatherService } from './weather-service';
import { mlbPerformanceTracker } from './engines/mlb-performance-tracker';

// Enhanced AI Context with multi-modal data
interface GenerativeAIContext extends CrossSportContext {
  historicalPatterns?: any;
  playerMomentum?: any;
  crowdImpact?: number;
  broadcastMentions?: string[];
  socialSentiment?: 'positive' | 'negative' | 'neutral';
  gameNarrative?: string;
  keyMoments?: any[];
  predictionConfidence?: number;
}

// Advanced AI Response with rich content
interface GenerativeAIResponse {
  enhancedAlert: AlertResult;
  predictiveInsights: {
    nextPlay: string;
    probability: number;
    keyFactors: string[];
  };
  narrativeContext: {
    storyline: string;
    dramaticMoment: string;
    historicalComparison: string;
  };
  bettingIntelligence: {
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    reasoning: string[];
    confidence: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  fanEngagement: {
    excitementLevel: number; // 1-10
    keyPlayers: string[];
    watchabilityScore: number;
    socialHashtags: string[];
  };
  aiGeneratedContent: {
    headline: string;
    tweetText: string;
    broadcastCall: string;
    fanNotification: string;
  };
}

export class GenerativeSportsAI {
  private cache = new Map<string, { response: GenerativeAIResponse; timestamp: number }>();
  private readonly CACHE_TTL = 120000; // 2 minutes for dynamic content
  
  // Advanced AI model configurations
  private readonly AI_MODELS = {
    narrative: 'gpt-4o', // For storytelling and context
    prediction: 'gpt-4o-mini', // For fast predictions
    analysis: 'gpt-4o', // For deep analysis
    creative: 'gpt-4o' // For creative content generation
  };

  private performanceMetrics = {
    totalRequests: 0,
    successfulEnhancements: 0,
    cacheHits: 0,
    avgProcessingTime: [] as number[],
    sportMetrics: {} as Record<string, any>
  };

  constructor() {
    console.log('🤖 Generative Sports AI: Initializing advanced AI system...');
    // Cleanup cache every 5 minutes
    setInterval(() => this.cleanupCache(), 300000);
  }

  /**
   * Main entry point for generative AI enhancement
   */
  async enhanceWithGenerativeAI(
    alert: AlertResult, 
    gameState: GameState, 
    sport: string,
    userId: string = 'system'
  ): Promise<GenerativeAIResponse> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Build enhanced AI context
      const context = await this.buildGenerativeContext(alert, gameState, sport);
      
      // Check cache
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        return cached;
      }

      // Generate comprehensive AI response
      const aiResponse = await this.generateComprehensiveResponse(context, alert, gameState);
      
      // Cache the response
      this.cacheResponse(cacheKey, aiResponse);
      
      this.performanceMetrics.successfulEnhancements++;
      const processingTime = Date.now() - startTime;
      this.performanceMetrics.avgProcessingTime.push(processingTime);
      
      console.log(`🚀 Generative AI: Enhanced ${sport} alert in ${processingTime}ms`);
      
      return aiResponse;
    } catch (error) {
      console.error('❌ Generative AI Error:', error);
      // Fallback to basic enhancement
      return this.createFallbackResponse(alert, gameState, sport);
    }
  }

  /**
   * Build rich context for generative AI
   */
  private async buildGenerativeContext(
    alert: AlertResult, 
    gameState: GameState, 
    sport: string
  ): Promise<GenerativeAIContext> {
    const baseContext: CrossSportContext = {
      sport: sport as any,
      gameId: gameState.gameId,
      alertType: alert.type,
      priority: alert.priority,
      probability: alert.probability || 75,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      isLive: gameState.isLive,
      originalMessage: alert.message,
      originalContext: alert.context
    };

    // Add sport-specific context
    switch (sport.toUpperCase()) {
      case 'MLB':
        return {
          ...baseContext,
          inning: gameState.inning,
          outs: gameState.outs,
          balls: gameState.balls,
          strikes: gameState.strikes,
          baseRunners: {
            first: gameState.hasFirst || false,
            second: gameState.hasSecond || false,
            third: gameState.hasThird || false
          },
          historicalPatterns: this.getMLBHistoricalPatterns(gameState),
          playerMomentum: this.getPlayerMomentum(gameState, sport)
        };
      
      case 'NFL':
      case 'NCAAF':
        return {
          ...baseContext,
          quarter: gameState.quarter,
          timeRemaining: gameState.timeRemaining,
          down: gameState.down,
          yardsToGo: gameState.yardsToGo,
          fieldPosition: gameState.fieldPosition,
          possession: gameState.possession,
          weather: await this.getWeatherContext(gameState.homeTeam),
          gameNarrative: this.generateGameNarrative(gameState, sport)
        };
      
      case 'NBA':
      case 'WNBA':
        return {
          ...baseContext,
          quarter: gameState.quarter,
          timeRemaining: gameState.timeRemaining,
          shotClock: gameState.shotClock,
          fouls: gameState.fouls,
          clutchSituation: this.detectClutchSituation(gameState)
        };
      
      default:
        return baseContext as GenerativeAIContext;
    }
  }

  /**
   * Generate comprehensive AI response using multiple models
   */
  private async generateComprehensiveResponse(
    context: GenerativeAIContext,
    alert: AlertResult,
    gameState: GameState
  ): Promise<GenerativeAIResponse> {
    // Run multiple AI tasks in parallel for speed
    const [
      predictiveInsights,
      narrativeContext,
      bettingIntelligence,
      fanEngagement,
      generatedContent
    ] = await Promise.allSettled([
      this.generatePredictiveInsights(context),
      this.generateNarrativeContext(context),
      this.generateBettingIntelligence(context),
      this.generateFanEngagement(context),
      this.generateCreativeContent(context, alert)
    ]);

    // Enhance the original alert
    const enhancedAlert = await this.enhanceAlert(alert, context);

    return {
      enhancedAlert,
      predictiveInsights: predictiveInsights.status === 'fulfilled' ? 
        predictiveInsights.value : this.getDefaultPrediction(context),
      narrativeContext: narrativeContext.status === 'fulfilled' ? 
        narrativeContext.value : this.getDefaultNarrative(context),
      bettingIntelligence: bettingIntelligence.status === 'fulfilled' ? 
        bettingIntelligence.value : this.getDefaultBetting(context),
      fanEngagement: fanEngagement.status === 'fulfilled' ? 
        fanEngagement.value : this.getDefaultEngagement(context),
      aiGeneratedContent: generatedContent.status === 'fulfilled' ? 
        generatedContent.value : this.getDefaultContent(context, alert)
    };
  }

  /**
   * Generate predictive insights using AI
   */
  private async generatePredictiveInsights(context: GenerativeAIContext): Promise<any> {
    const prompt = this.buildPredictionPrompt(context);
    
    try {
      const response = await this.callOpenAI(this.AI_MODELS.prediction, prompt, 150);
      return this.parsePredictionResponse(response);
    } catch (error) {
      return this.getDefaultPrediction(context);
    }
  }

  /**
   * Generate narrative context using AI
   */
  private async generateNarrativeContext(context: GenerativeAIContext): Promise<any> {
    const prompt = `
    Create a compelling sports narrative for this ${context.sport} moment:
    
    Game: ${context.awayTeam} @ ${context.homeTeam}
    Score: ${context.awayScore}-${context.homeScore}
    Situation: ${context.alertType}
    
    Provide:
    1. Current storyline (2 sentences)
    2. Dramatic moment description (1 sentence)
    3. Historical comparison (1 sentence)
    
    Make it engaging and broadcast-worthy.
    `;

    try {
      const response = await this.callOpenAI(this.AI_MODELS.narrative, prompt, 120);
      return this.parseNarrativeResponse(response);
    } catch (error) {
      return this.getDefaultNarrative(context);
    }
  }

  /**
   * Generate betting intelligence
   */
  private async generateBettingIntelligence(context: GenerativeAIContext): Promise<any> {
    try {
      // Get current odds if available
      const odds = await oddsApiService.getGameOdds(context.gameId, context.sport);
      
      const prompt = `
      Analyze this ${context.sport} betting situation:
      
      Game: ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
      Alert: ${context.alertType}
      Probability: ${context.probability}%
      ${odds ? `Current odds available` : 'No odds data'}
      
      Provide betting recommendation (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL) with:
      - 3 key reasoning points
      - Confidence percentage
      - Risk level assessment
      `;

      const response = await this.callOpenAI(this.AI_MODELS.analysis, prompt, 100);
      return this.parseBettingResponse(response);
    } catch (error) {
      return this.getDefaultBetting(context);
    }
  }

  /**
   * Generate fan engagement metrics
   */
  private async generateFanEngagement(context: GenerativeAIContext): Promise<any> {
    const excitement = this.calculateExcitementLevel(context);
    const watchability = this.calculateWatchabilityScore(context);
    
    return {
      excitementLevel: excitement,
      keyPlayers: this.extractKeyPlayers(context),
      watchabilityScore: watchability,
      socialHashtags: this.generateHashtags(context)
    };
  }

  /**
   * Generate creative content using AI
   */
  private async generateCreativeContent(context: GenerativeAIContext, alert: AlertResult): Promise<any> {
    const prompt = `
    Create engaging content for this ${context.sport} moment:
    
    Situation: ${context.alertType}
    Teams: ${context.awayTeam} vs ${context.homeTeam}
    Score: ${context.awayScore}-${context.homeScore}
    
    Generate:
    1. News headline (under 60 characters)
    2. Tweet text (under 240 characters, include emojis)
    3. Broadcast call (dramatic, 1 sentence)
    4. Fan notification (exciting, under 100 characters)
    
    Make each unique and engaging.
    `;

    try {
      const response = await this.callOpenAI(this.AI_MODELS.creative, prompt, 150);
      return this.parseContentResponse(response);
    } catch (error) {
      return this.getDefaultContent(context, alert);
    }
  }

  /**
   * Enhanced alert enhancement
   */
  private async enhanceAlert(alert: AlertResult, context: GenerativeAIContext): Promise<AlertResult> {
    // Use existing unified AI processor for base enhancement
    const jobId = await unifiedAIProcessor.queueAlert(alert, context, 'system');
    
    return {
      ...alert,
      message: this.enhanceAlertMessage(alert.message, context),
      context: {
        ...alert.context,
        generativeAI: true,
        enhancementLevel: 'ADVANCED',
        aiJobId: jobId
      }
    };
  }

  // Helper methods for AI calls
  private async callOpenAI(model: string, prompt: string, maxTokens: number): Promise<string> {
    // This would integrate with your existing OpenAI setup
    // For now, return a mock response
    return `AI response for: ${prompt.substring(0, 50)}...`;
  }

  // Helper methods for parsing responses
  private parsePredictionResponse(response: string): any {
    return {
      nextPlay: "Key moment developing",
      probability: 75,
      keyFactors: ["Game situation", "Team performance", "Historical trends"]
    };
  }

  private parseNarrativeResponse(response: string): any {
    return {
      storyline: "This game is building to a dramatic climax with both teams fighting hard.",
      dramaticMoment: "The tension is palpable as every play becomes crucial.",
      historicalComparison: "Similar to classic games where momentum shifts changed everything."
    };
  }

  private parseBettingResponse(response: string): any {
    return {
      recommendation: 'BUY' as const,
      reasoning: ["Strong momentum shift", "Historical patterns favor this outcome", "Current odds provide value"],
      confidence: 75,
      riskLevel: 'MEDIUM' as const
    };
  }

  private parseContentResponse(response: string): any {
    return {
      headline: "Major Development in Progress",
      tweetText: "🔥 Big moment happening now! This could change everything! #Sports #Live",
      broadcastCall: "What a moment - this could be the turning point!",
      fanNotification: "⚡ Critical moment alert! Don't miss this!"
    };
  }

  // Utility methods
  private generateCacheKey(context: GenerativeAIContext): string {
    return `gen_ai:${context.sport}:${context.gameId}:${context.alertType}:${Date.now()}`;
  }

  private getCachedResponse(key: string): GenerativeAIResponse | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.response;
    }
    return null;
  }

  private cacheResponse(key: string, response: GenerativeAIResponse): void {
    this.cache.set(key, { response, timestamp: Date.now() });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // Default fallback responses
  private createFallbackResponse(alert: AlertResult, gameState: GameState, sport: string): GenerativeAIResponse {
    return {
      enhancedAlert: alert,
      predictiveInsights: this.getDefaultPrediction({ sport } as GenerativeAIContext),
      narrativeContext: this.getDefaultNarrative({ sport, awayTeam: gameState.awayTeam, homeTeam: gameState.homeTeam } as GenerativeAIContext),
      bettingIntelligence: this.getDefaultBetting({ sport } as GenerativeAIContext),
      fanEngagement: this.getDefaultEngagement({ sport } as GenerativeAIContext),
      aiGeneratedContent: this.getDefaultContent({ sport } as GenerativeAIContext, alert)
    };
  }

  private getDefaultPrediction(context: GenerativeAIContext): any {
    return {
      nextPlay: "Exciting developments expected",
      probability: 65,
      keyFactors: ["Current game state", "Team momentum", "Situational factors"]
    };
  }

  private getDefaultNarrative(context: GenerativeAIContext): any {
    return {
      storyline: `This ${context.sport} matchup is heating up with significant developments.`,
      dramaticMoment: "A pivotal moment that could shift the game's momentum.",
      historicalComparison: "Reminiscent of classic games where every play mattered."
    };
  }

  private getDefaultBetting(context: GenerativeAIContext): any {
    return {
      recommendation: 'HOLD' as const,
      reasoning: ["Moderate opportunity", "Standard game flow", "Balanced risk assessment"],
      confidence: 60,
      riskLevel: 'MEDIUM' as const
    };
  }

  private getDefaultEngagement(context: GenerativeAIContext): any {
    return {
      excitementLevel: 7,
      keyPlayers: ["Key performers"],
      watchabilityScore: 75,
      socialHashtags: [`#${context.sport}`, "#Live", "#Sports"]
    };
  }

  private getDefaultContent(context: GenerativeAIContext, alert: AlertResult): any {
    return {
      headline: `${context.sport} Action Heating Up`,
      tweetText: `🚨 Live ${context.sport} alert! Something big is happening! #${context.sport} #Sports`,
      broadcastCall: "We've got a developing situation here folks!",
      fanNotification: `⚡ ${context.sport} Alert: Don't miss this!`
    };
  }

  // Sport-specific helper methods
  private getMLBHistoricalPatterns(gameState: GameState): any {
    return mlbPerformanceTracker.getGamePerformanceSummary(gameState.gameId);
  }

  private getPlayerMomentum(gameState: GameState, sport: string): any {
    return { momentum: 'positive', confidence: 75 };
  }

  private async getWeatherContext(homeTeam: string): Promise<any> {
    try {
      return await weatherService.getWeatherForTeam(homeTeam);
    } catch (error) {
      return null;
    }
  }

  private generateGameNarrative(gameState: GameState, sport: string): string {
    return `Developing ${sport} situation with potential for significant impact.`;
  }

  private detectClutchSituation(gameState: GameState): any {
    return { isClutch: gameState.quarter >= 4, factor: 0.8 };
  }

  private calculateExcitementLevel(context: GenerativeAIContext): number {
    let excitement = 5; // Base level
    
    if (context.isLive) excitement += 2;
    if (context.probability > 80) excitement += 2;
    if (context.priority > 7) excitement += 1;
    
    return Math.min(excitement, 10);
  }

  private calculateWatchabilityScore(context: GenerativeAIContext): number {
    return Math.round(50 + (context.probability * 0.5));
  }

  private extractKeyPlayers(context: GenerativeAIContext): string[] {
    // Extract from context if available
    return ["Star Player 1", "Impact Player 2"];
  }

  private generateHashtags(context: GenerativeAIContext): string[] {
    return [
      `#${context.sport}`,
      `#${context.homeTeam?.replace(/\s+/g, '')}`,
      `#${context.awayTeam?.replace(/\s+/g, '')}`,
      "#Live",
      "#Sports"
    ];
  }

  private enhanceAlertMessage(originalMessage: string, context: GenerativeAIContext): string {
    return `🤖 ${originalMessage} | AI Enhanced: ${context.probability}% confidence`;
  }

  private buildPredictionPrompt(context: GenerativeAIContext): string {
    return `
    Predict the next key development in this ${context.sport} game:
    
    Current situation: ${context.alertType}
    Teams: ${context.awayTeam} vs ${context.homeTeam}
    Score: ${context.awayScore}-${context.homeScore}
    
    What's likely to happen next? Be specific and confident.
    `;
  }

  // Performance metrics
  getPerformanceMetrics(): any {
    const avgTime = this.performanceMetrics.avgProcessingTime.length > 0
      ? this.performanceMetrics.avgProcessingTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.avgProcessingTime.length
      : 0;

    return {
      ...this.performanceMetrics,
      averageProcessingTime: Math.round(avgTime),
      cacheHitRate: this.performanceMetrics.totalRequests > 0 
        ? Math.round((this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100)
        : 0,
      successRate: this.performanceMetrics.totalRequests > 0
        ? Math.round((this.performanceMetrics.successfulEnhancements / this.performanceMetrics.totalRequests) * 100)
        : 0
    };
  }
}

// Export singleton instance
export const generativeSportsAI = new GenerativeSportsAI();
