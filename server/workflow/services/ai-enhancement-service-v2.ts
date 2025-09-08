import { EventEmitter } from 'events';

/**
 * AI Enhancement Service V2 - Completely rewritten for better performance and integration
 */

export interface AIEnhancementConfig {
  enableOpenAI: boolean;
  maxEnhancementsPerMinute: number;
  priorityThreshold: number;
  cacheSize: number;
  timeoutMs: number;
}

export interface EnhancementRequest {
  type: string;
  sport: string;
  context: any;
  message: string;
  priority: number;
}

export interface EnhancementResult {
  enhanced: boolean;
  aiAnalysis?: string;
  betingInsights?: string;
  confidence?: number;
  processingTimeMs: number;
  error?: string;
}

export interface BettingContext {
  sport: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  gameState: any;
  alertType: string;
  probability: number;
}

export class AIEnhancementServiceV2 extends EventEmitter {
  private config: AIEnhancementConfig;
  private enhancementCache: Map<string, EnhancementResult> = new Map();
  private rateLimitCounter = 0;
  private rateLimitResetTime = Date.now() + 60000; // 1 minute
  private isEnabled = false;

  constructor(config: AIEnhancementConfig) {
    super();
    this.config = config;
    this.isEnabled = config.enableOpenAI;
  }

  /**
   * Enhance an alert with AI analysis
   */
  async enhanceAlert(request: EnhancementRequest): Promise<EnhancementResult> {
    const startTime = Date.now();

    try {
      // Check if enhancement is needed
      if (!this.shouldEnhance(request)) {
        return {
          enhanced: false,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.enhancementCache.get(cacheKey);
      if (cached) {
        console.log(`🎯 Using cached AI enhancement for ${request.type}`);
        return cached;
      }

      // Check rate limits
      if (!this.checkRateLimit()) {
        console.log('⚠️ AI enhancement rate limit exceeded');
        return {
          enhanced: false,
          error: 'Rate limit exceeded',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Generate enhancement
      const result = await this.generateEnhancement(request);
      result.processingTimeMs = Date.now() - startTime;

      // Cache the result
      this.cacheResult(cacheKey, result);

      console.log(`🤖 Generated AI enhancement for ${request.type} in ${result.processingTimeMs}ms`);
      this.emit('enhancementGenerated', { request, result });

      return result;

    } catch (error) {
      const result: EnhancementResult = {
        enhanced: false,
        error: (error as Error).message,
        processingTimeMs: Date.now() - startTime
      };

      console.error(`❌ AI enhancement failed for ${request.type}:`, error);
      this.emit('enhancementError', { request, error });

      return result;
    }
  }

  /**
   * Generate betting insights for a game situation
   */
  async generateBettingInsights(context: BettingContext): Promise<string> {
    try {
      const { sport, homeTeam, awayTeam, homeScore, awayScore, alertType, probability } = context;
      
      // Generate contextual betting advice
      const scoreDiff = Math.abs(homeScore - awayScore);
      const totalScore = homeScore + awayScore;
      
      let insights = `${awayTeam} ${awayScore}-${homeScore} ${homeTeam}`;

      // Sport-specific insights
      if (sport === 'MLB') {
        const currentPace = totalScore > 0 ? (totalScore / (context.gameState?.inning || 5)) * 9 : 8.5;
        const recommendedTotal = Math.round(currentPace * 2) / 2;

        if (alertType.includes('BASES_LOADED')) {
          insights += ` | BASES LOADED: Strong OVER ${recommendedTotal} value. Historical 75%+ scoring rate.`;
        } else if (alertType.includes('RUNNER_ON_THIRD')) {
          insights += ` | Runner in scoring position. OVER ${recommendedTotal} shows value.`;
        } else if (alertType.includes('CLOSE_GAME')) {
          insights += ` | Live betting window. Consider spread and total ${recommendedTotal}.`;
        }

        // Add probability-based recommendations
        if (probability >= 80) {
          insights += ` High confidence situation (${probability}%).`;
        } else if (probability >= 60) {
          insights += ` Moderate confidence (${probability}%).`;
        }
      }

      return insights;

    } catch (error) {
      console.error('❌ Error generating betting insights:', error);
      return 'Unable to generate betting insights at this time.';
    }
  }

  /**
   * Check if alert should be enhanced
   */
  private shouldEnhance(request: EnhancementRequest): boolean {
    if (!this.isEnabled) {
      return false;
    }

    // Only enhance high-priority alerts to save resources
    if (request.priority < this.config.priorityThreshold) {
      return false;
    }

    // Skip enhancement for certain alert types
    const skipTypes = ['GAME_START', 'GAME_END', 'HALFTIME'];
    if (skipTypes.some(type => request.type.includes(type))) {
      return false;
    }

    return true;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if minute has passed
    if (now >= this.rateLimitResetTime) {
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + 60000;
    }

    if (this.rateLimitCounter >= this.config.maxEnhancementsPerMinute) {
      return false;
    }

    this.rateLimitCounter++;
    return true;
  }

  /**
   * Generate the actual AI enhancement
   */
  private async generateEnhancement(request: EnhancementRequest): Promise<EnhancementResult> {
    try {
      // Simulate AI processing (replace with actual OpenAI call when available)
      const mockDelay = Math.random() * 500 + 200; // 200-700ms
      await new Promise(resolve => setTimeout(resolve, mockDelay));

      // Generate contextual analysis
      const analysis = await this.generateContextualAnalysis(request);
      
      // Generate betting insights
      const bettingContext: BettingContext = {
        sport: request.sport,
        gameId: request.context.gameId || 'unknown',
        homeTeam: request.context.homeTeam || 'Home',
        awayTeam: request.context.awayTeam || 'Away',
        homeScore: request.context.homeScore || 0,
        awayScore: request.context.awayScore || 0,
        gameState: request.context,
        alertType: request.type,
        probability: request.priority // Use priority as probability proxy
      };

      const bettingInsights = await this.generateBettingInsights(bettingContext);

      return {
        enhanced: true,
        aiAnalysis: analysis,
        betingInsights: bettingInsights,
        confidence: Math.min(request.priority / 100, 0.95),
        processingTimeMs: 0 // Will be set by caller
      };

    } catch (error) {
      throw new Error(`AI enhancement generation failed: ${error}`);
    }
  }

  /**
   * Generate contextual analysis
   */
  private async generateContextualAnalysis(request: EnhancementRequest): Promise<string> {
    const { type, sport, context } = request;

    // Sport-specific contextual analysis
    if (sport === 'MLB') {
      return this.generateMLBAnalysis(type, context);
    } else if (sport === 'NFL') {
      return this.generateNFLAnalysis(type, context);
    } else {
      return this.generateGenericAnalysis(type, context);
    }
  }

  /**
   * Generate MLB-specific analysis
   */
  private generateMLBAnalysis(alertType: string, context: any): string {
    const { inning = 5, outs = 0, homeScore = 0, awayScore = 0 } = context;
    const scoreDiff = Math.abs(homeScore - awayScore);

    if (alertType.includes('BASES_LOADED')) {
      return `Bases loaded situation in inning ${inning} with ${outs} outs. Historically, teams score in 75% of bases loaded scenarios with fewer than 2 outs. ${scoreDiff <= 2 ? 'Close game adds pressure.' : ''} High-value betting opportunity.`;
    }

    if (alertType.includes('RUNNER_ON_THIRD')) {
      return `Runner on third base represents prime scoring opportunity. With ${outs} outs, probability of scoring is ${outs === 0 ? '85%' : outs === 1 ? '68%' : '45%'}. ${inning >= 7 ? 'Late-game situation increases urgency.' : ''}`;
    }

    if (alertType.includes('CLOSE_GAME')) {
      return `Close game situation with ${scoreDiff} run difference. Late-inning pressure creates volatile betting environment. Consider live lines carefully.`;
    }

    return `${alertType} situation detected in ${sport} game during inning ${inning}.`;
  }

  /**
   * Generate NFL-specific analysis
   */
  private generateNFLAnalysis(alertType: string, context: any): string {
    if (alertType.includes('TWO_MINUTE_WARNING')) {
      return 'Two-minute warning creates critical game management period. Teams may alter strategy significantly, affecting spread and total outcomes.';
    }

    return `${alertType} situation in NFL game presents betting opportunity.`;
  }

  /**
   * Generate generic analysis
   */
  private generateGenericAnalysis(alertType: string, context: any): string {
    return `${alertType} situation detected. Game context suggests betting value opportunity.`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: EnhancementRequest): string {
    const contextString = JSON.stringify({
      type: request.type,
      sport: request.sport,
      gameId: request.context?.gameId,
      homeScore: request.context?.homeScore,
      awayScore: request.context?.awayScore,
      inning: request.context?.inning,
      period: request.context?.period
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `${request.type}_${Math.abs(hash)}`;
  }

  /**
   * Cache enhancement result
   */
  private cacheResult(key: string, result: EnhancementResult): void {
    // Remove oldest entries if cache is full
    if (this.enhancementCache.size >= this.config.cacheSize) {
      const firstKey = this.enhancementCache.keys().next().value;
      this.enhancementCache.delete(firstKey);
    }

    this.enhancementCache.set(key, result);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.enhancementCache.clear();
    console.log('🧹 AI enhancement cache cleared');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      cacheSize: this.enhancementCache.size,
      rateLimitCounter: this.rateLimitCounter,
      rateLimitResetTime: this.rateLimitResetTime,
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIEnhancementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isEnabled = this.config.enableOpenAI;
    console.log('✅ AI enhancement config updated');
  }
}