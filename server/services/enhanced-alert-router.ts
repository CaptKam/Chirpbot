import type { AlertResult, GameState } from './engines/base-engine';
import type { WeatherChangeEvent } from './weather-on-live-service';

// === UNIFIED ENHANCED ALERT INTERFACE ===
// Consolidates best features from all AI systems into single response

export interface UnifiedEnhancedAlert {
  // Core alert data
  type: string;
  sport: string;
  gameId: string;
  alertKey: string;
  priority: number;
  
  // === NARRATIVE INTELLIGENCE (from AlertComposer) ===
  headline: string; // Compelling one-line summary
  enhancedMessage: string; // Clear, action-oriented message
  
  // === TIME-SENSITIVE CONTEXT (from AlertComposer) ===
  timing: {
    whyNow: string; // Why this alert matters at this exact moment
    urgencyLevel: 'immediate' | 'urgent' | 'moderate';
    expiresIn?: number; // Seconds until opportunity expires
  };
  
  // === ACTIONABLE INTELLIGENCE (from AlertComposer + UnifiedAIProcessor) ===
  action: {
    primaryAction: string; // The ONE thing to do right now
    confidence: number; // 0-100 confidence in recommendation
    reasoning: string[]; // Quick supporting facts (max 3)
  };
  
  // === PREDICTIVE INSIGHTS (from GenerativeSportsAI) ===
  prediction: {
    nextCriticalMoment: string; // What to watch for next
    probability: number; // Success probability 0-100
    keyFactors: string[]; // Critical factors affecting outcome (max 3)
  };
  
  // === BETTING INTELLIGENCE (from GamblingInsightsComposer) ===
  betting?: {
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID';
    bullets: string[]; // Key betting insights (max 3)
    confidence: number; // Betting confidence 0-100
    odds?: {
      home: number;
      away: number;
      total: number;
    };
  };
  
  // === WEATHER CONTEXT (from WeatherOnLive) ===
  weather?: {
    impact: string; // How weather affects this situation
    severity: 'low' | 'moderate' | 'high' | 'extreme';
    isWeatherTriggered: boolean;
  };
  
  // === PROCESSING METADATA ===
  enhancement: {
    aiProcessingTime: number;
    confidenceScore: number; // Overall enhancement confidence
    enhancementSources: string[]; // Which AI capabilities were used
    cacheUsed: boolean;
  };
  
  // === SPORT-SPECIFIC DATA ===
  sportSpecificContext?: any; // Preserve original context
}

// === ENHANCEMENT CONFIGURATION ===
interface EnhancementConfig {
  enableNarrative: boolean;
  enablePredictive: boolean;
  enableBetting: boolean;
  enableWeather: boolean;
  timeoutMs: number;
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
}

// === CACHE STRATEGY ===
interface CacheEntry {
  alert: UnifiedEnhancedAlert;
  timestamp: number;
  sources: string[];
}

export class EnhancedAlertRouter {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_CONFIG: EnhancementConfig = {
    enableNarrative: true,
    enablePredictive: true,
    enableBetting: true,
    enableWeather: true,
    timeoutMs: 3000, // Single consistent timeout
    cacheStrategy: 'moderate'
  };
  
  // Unified cache TTL based on strategy
  private readonly CACHE_TTL = {
    aggressive: 60000,  // 1 minute - faster response
    moderate: 45000,    // 45 seconds - balanced
    minimal: 30000      // 30 seconds - fresh data
  };
  
  private performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    timeouts: 0,
    avgProcessingTime: [] as number[],
    enhancementSuccessRate: {} as Record<string, number>
  };

  constructor() {
    console.log('🚀 Enhanced Alert Router: Initializing unified AI enhancement pipeline...');
    
    // Cleanup cache every 2 minutes
    setInterval(() => this.cleanupCache(), 120000);
  }

  /**
   * MAIN ENTRY POINT - Single enhancement call that replaces all other AI systems
   */
  async enhanceAlert(
    alert: AlertResult,
    gameState: GameState,
    userId?: string,
    config?: Partial<EnhancementConfig>
  ): Promise<UnifiedEnhancedAlert> {
    const startTime = Date.now();
    const enhancementConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    this.performanceMetrics.totalRequests++;
    
    try {
      // Generate unified cache key
      const cacheKey = this.generateCacheKey(alert, gameState, enhancementConfig);
      
      // Check cache first
      const cached = this.getCachedAlert(cacheKey, enhancementConfig.cacheStrategy);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        console.log(`⚡ Cache hit for ${alert.type} in ${gameState.sport}`);
        return cached;
      }
      
      // Parallel enhancement with single timeout
      const enhancementPromise = this.performUnifiedEnhancement(alert, gameState, enhancementConfig);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Enhancement timeout')), enhancementConfig.timeoutMs)
      );
      
      const enhancedAlert = await Promise.race([enhancementPromise, timeoutPromise]);
      
      // Cache the result
      this.cacheAlert(cacheKey, enhancedAlert, enhancementConfig.cacheStrategy);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.performanceMetrics.avgProcessingTime.push(processingTime);
      enhancedAlert.enhancement.aiProcessingTime = processingTime;
      
      console.log(`✅ Enhanced ${alert.type} in ${processingTime}ms (${gameState.sport})`);
      return enhancedAlert;
      
    } catch (error) {
      console.error(`❌ Enhancement failed for ${alert.type}:`, error);
      
      if (error instanceof Error && error.message === 'Enhancement timeout') {
        this.performanceMetrics.timeouts++;
      }
      
      // Return fallback enhanced alert with minimal processing
      return this.createFallbackAlert(alert, gameState, Date.now() - startTime);
    }
  }
  
  /**
   * Perform all enhancements in parallel with intelligent fallbacks
   */
  private async performUnifiedEnhancement(
    alert: AlertResult,
    gameState: GameState,
    config: EnhancementConfig
  ): Promise<UnifiedEnhancedAlert> {
    const enhancementPromises: Promise<any>[] = [];
    const sources: string[] = [];
    
    // Base alert structure
    const baseAlert: UnifiedEnhancedAlert = {
      type: alert.type,
      sport: gameState.sport,
      gameId: gameState.gameId,
      alertKey: alert.alertKey || this.generateAlertKey(alert, gameState),
      priority: alert.priority,
      headline: this.generateBasicHeadline(alert, gameState),
      enhancedMessage: alert.message || 'Alert detected',
      timing: {
        whyNow: 'Opportunity detected',
        urgencyLevel: 'moderate',
      },
      action: {
        primaryAction: 'Monitor situation',
        confidence: 50,
        reasoning: ['Alert triggered']
      },
      prediction: {
        nextCriticalMoment: 'Watch for developments',
        probability: 50,
        keyFactors: ['Game situation']
      },
      enhancement: {
        aiProcessingTime: 0,
        confidenceScore: 50,
        enhancementSources: [],
        cacheUsed: false
      },
      sportSpecificContext: alert.context
    };
    
    // === NARRATIVE ENHANCEMENT ===
    if (config.enableNarrative) {
      enhancementPromises.push(
        this.enhanceWithNarrative(alert, gameState).catch(err => {
          console.warn(`⚠️ Narrative enhancement failed:`, err.message);
          return null;
        })
      );
      sources.push('narrative');
    }
    
    // === PREDICTIVE ENHANCEMENT ===
    if (config.enablePredictive) {
      enhancementPromises.push(
        this.enhanceWithPredictive(alert, gameState).catch(err => {
          console.warn(`⚠️ Predictive enhancement failed:`, err.message);
          return null;
        })
      );
      sources.push('predictive');
    }
    
    // === BETTING ENHANCEMENT ===
    if (config.enableBetting) {
      enhancementPromises.push(
        this.enhanceWithBetting(alert, gameState).catch(err => {
          console.warn(`⚠️ Betting enhancement failed:`, err.message);
          return null;
        })
      );
      sources.push('betting');
    }
    
    // === WEATHER ENHANCEMENT ===
    if (config.enableWeather && gameState.isLive) {
      enhancementPromises.push(
        this.enhanceWithWeather(alert, gameState).catch(err => {
          console.warn(`⚠️ Weather enhancement failed:`, err.message);
          return null;
        })
      );
      sources.push('weather');
    }
    
    // Wait for all enhancements (with fallbacks)
    const results = await Promise.allSettled(enhancementPromises);
    
    // Merge successful enhancements into base alert
    const successfulSources: string[] = [];
    let overallConfidence = 50;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const sourceName = sources[index];
        this.mergeEnhancement(baseAlert, result.value, sourceName);
        successfulSources.push(sourceName);
        
        // Boost confidence for each successful enhancement
        overallConfidence += 15;
      }
    });
    
    // Finalize enhancement metadata
    baseAlert.enhancement.enhancementSources = successfulSources;
    baseAlert.enhancement.confidenceScore = Math.min(overallConfidence, 95);
    
    console.log(`🔗 Enhanced with ${successfulSources.length}/${sources.length} sources: ${successfulSources.join(', ')}`);
    
    return baseAlert;
  }
  
  /**
   * NARRATIVE ENHANCEMENT - Time-sensitive, action-oriented intelligence
   */
  private async enhanceWithNarrative(alert: AlertResult, gameState: GameState): Promise<any> {
    // Import AlertComposer capabilities without dependencies
    const urgencyLevel = alert.priority > 80 ? 'immediate' : alert.priority > 60 ? 'urgent' : 'moderate';
    
    return {
      headline: this.generateNarrativeHeadline(alert, gameState, urgencyLevel),
      timing: {
        whyNow: this.generateWhyNow(alert, gameState),
        urgencyLevel: urgencyLevel,
        expiresIn: urgencyLevel === 'immediate' ? 60 : urgencyLevel === 'urgent' ? 300 : undefined
      },
      action: {
        primaryAction: this.generatePrimaryAction(alert, gameState),
        confidence: Math.min(alert.priority + 20, 95),
        reasoning: this.generateActionReasoning(alert, gameState)
      }
    };
  }
  
  /**
   * PREDICTIVE ENHANCEMENT - Next critical moments and probabilities
   */
  private async enhanceWithPredictive(alert: AlertResult, gameState: GameState): Promise<any> {
    return {
      prediction: {
        nextCriticalMoment: this.generateNextMoment(alert, gameState),
        probability: this.calculateSuccessProbability(alert, gameState),
        keyFactors: this.generateKeyFactors(alert, gameState)
      }
    };
  }
  
  /**
   * BETTING ENHANCEMENT - Gambling insights and recommendations
   */
  private async enhanceWithBetting(alert: AlertResult, gameState: GameState): Promise<any> {
    // Simplified betting logic without external dependencies
    const recommendation = this.generateBettingRecommendation(alert, gameState);
    
    return {
      betting: {
        recommendation: recommendation.action,
        bullets: recommendation.bullets,
        confidence: recommendation.confidence,
        odds: this.generateSimulatedOdds(gameState)
      }
    };
  }
  
  /**
   * WEATHER ENHANCEMENT - Weather impact on game situation
   */
  private async enhanceWithWeather(alert: AlertResult, gameState: GameState): Promise<any> {
    // Simplified weather logic for outdoor sports
    if (!['MLB', 'NFL', 'NCAAF', 'CFL'].includes(gameState.sport)) {
      return null;
    }
    
    return {
      weather: {
        impact: 'Weather conditions may affect play',
        severity: 'moderate' as const,
        isWeatherTriggered: false
      }
    };
  }
  
  // === HELPER METHODS ===
  
  private generateCacheKey(alert: AlertResult, gameState: GameState, config: EnhancementConfig): string {
    const configHash = Object.values(config).join('|');
    return `enhanced_${gameState.sport}_${alert.type}_${gameState.gameId}_${configHash}`;
  }
  
  private getCachedAlert(cacheKey: string, strategy: 'aggressive' | 'moderate' | 'minimal'): UnifiedEnhancedAlert | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    
    const ttl = this.CACHE_TTL[strategy];
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    entry.alert.enhancement.cacheUsed = true;
    return entry.alert;
  }
  
  private cacheAlert(cacheKey: string, alert: UnifiedEnhancedAlert, strategy: 'aggressive' | 'moderate' | 'minimal'): void {
    this.cache.set(cacheKey, {
      alert: { ...alert },
      timestamp: Date.now(),
      sources: alert.enhancement.enhancementSources
    });
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > Math.max(...Object.values(this.CACHE_TTL))) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }
  
  private mergeEnhancement(baseAlert: UnifiedEnhancedAlert, enhancement: any, source: string): void {
    // Intelligent merging based on source type
    if (enhancement.headline && enhancement.headline.length > baseAlert.headline.length) {
      baseAlert.headline = enhancement.headline;
    }
    
    if (enhancement.timing) {
      baseAlert.timing = { ...baseAlert.timing, ...enhancement.timing };
    }
    
    if (enhancement.action) {
      baseAlert.action = { ...baseAlert.action, ...enhancement.action };
    }
    
    if (enhancement.prediction) {
      baseAlert.prediction = { ...baseAlert.prediction, ...enhancement.prediction };
    }
    
    if (enhancement.betting) {
      baseAlert.betting = enhancement.betting;
    }
    
    if (enhancement.weather) {
      baseAlert.weather = enhancement.weather;
    }
  }
  
  private createFallbackAlert(alert: AlertResult, gameState: GameState, processingTime: number): UnifiedEnhancedAlert {
    return {
      type: alert.type,
      sport: gameState.sport,
      gameId: gameState.gameId,
      alertKey: alert.alertKey || this.generateAlertKey(alert, gameState),
      priority: alert.priority,
      headline: `${gameState.sport} Alert: ${alert.type}`,
      enhancedMessage: alert.message || 'Alert detected - check game status',
      timing: {
        whyNow: 'Alert triggered',
        urgencyLevel: 'moderate',
      },
      action: {
        primaryAction: 'Monitor game situation',
        confidence: 40,
        reasoning: ['Alert detected in system']
      },
      prediction: {
        nextCriticalMoment: 'Watch for game developments',
        probability: 50,
        keyFactors: ['Game situation evolving']
      },
      enhancement: {
        aiProcessingTime: processingTime,
        confidenceScore: 40,
        enhancementSources: ['fallback'],
        cacheUsed: false
      },
      sportSpecificContext: alert.context
    };
  }
  
  // === NARRATIVE GENERATION HELPERS ===
  
  private generateBasicHeadline(alert: AlertResult, gameState: GameState): string {
    return `${gameState.sport}: ${alert.type} Alert`;
  }
  
  private generateNarrativeHeadline(alert: AlertResult, gameState: GameState, urgency: string): string {
    const urgencyEmoji = urgency === 'immediate' ? '🔴' : urgency === 'urgent' ? '🔥' : '📊';
    const teams = `${gameState.awayTeam} @ ${gameState.homeTeam}`;
    return `${urgencyEmoji} ${teams}: ${this.alertTypeToHeadline(alert.type)}`;
  }
  
  private alertTypeToHeadline(alertType: string): string {
    const headlines: Record<string, string> = {
      'BASES_LOADED': 'Bases Loaded - Big Inning Brewing',
      'HOME_RUN': 'Home Run Changes Everything',
      'RISP': 'Runner in Scoring Position',
      'TOUCHDOWN': 'Touchdown Momentum Shift',
      'RED_ZONE': 'Red Zone Opportunity',
      'TWO_MINUTE_WARNING': 'Crunch Time Begins'
    };
    
    return headlines[alertType] || `${alertType.replace(/_/g, ' ')} Situation`;
  }
  
  private generateWhyNow(alert: AlertResult, gameState: GameState): string {
    if (gameState.sport === 'MLB') {
      return `${gameState.inning}th inning situation developing`;
    }
    return 'Critical game moment unfolding';
  }
  
  private generatePrimaryAction(alert: AlertResult, gameState: GameState): string {
    const actions: Record<string, string> = {
      'BASES_LOADED': 'Watch for clutch hitting',
      'HOME_RUN': 'Monitor momentum shift',
      'RISP': 'Track RBI opportunity',
      'TOUCHDOWN': 'Assess score impact',
      'RED_ZONE': 'Watch red zone execution'
    };
    
    return actions[alert.type] || 'Monitor situation closely';
  }
  
  private generateActionReasoning(alert: AlertResult, gameState: GameState): string[] {
    return [
      `${gameState.sport} situation evolving`,
      `Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
      'High-impact moment detected'
    ];
  }
  
  private generateNextMoment(alert: AlertResult, gameState: GameState): string {
    if (gameState.sport === 'MLB') {
      return `Next batter vs pitcher matchup`;
    }
    return 'Next play call critical';
  }
  
  private calculateSuccessProbability(alert: AlertResult, gameState: GameState): number {
    // Simple probability based on alert priority and game context
    let probability = alert.priority;
    
    // Adjust for game context
    if (gameState.isLive) probability += 10;
    if (gameState.homeScore !== gameState.awayScore) probability += 5;
    
    return Math.min(Math.max(probability, 5), 95);
  }
  
  private generateKeyFactors(alert: AlertResult, gameState: GameState): string[] {
    const factors = [
      `Game status: ${gameState.isLive ? 'Live' : 'Not Live'}`,
      `Score differential: ${Math.abs(gameState.homeScore - gameState.awayScore)}`
    ];
    
    if (gameState.sport === 'MLB' && gameState.inning) {
      factors.push(`Inning: ${gameState.inning}`);
    }
    
    return factors.slice(0, 3);
  }
  
  private generateBettingRecommendation(alert: AlertResult, gameState: GameState): { action: string; bullets: string[]; confidence: number } {
    // Simplified betting logic
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (alert.priority > 75) {
      return {
        action: 'BUY' as const,
        bullets: [
          'High-probability situation',
          `Score impact likely`,
          'Monitor line movement'
        ],
        confidence: Math.min(alert.priority + 10, 90)
      };
    }
    
    return {
      action: 'HOLD' as const,
      bullets: [
        'Situation developing',
        'Wait for clarity',
        'Monitor momentum'
      ],
      confidence: 60
    };
  }
  
  private generateSimulatedOdds(gameState: GameState): { home: number; away: number; total: number } {
    const scoreDiff = gameState.homeScore - gameState.awayScore;
    
    return {
      home: scoreDiff > 0 ? -150 : 120,
      away: scoreDiff < 0 ? -150 : 120,
      total: gameState.homeScore + gameState.awayScore + 8.5
    };
  }
  
  private generateAlertKey(alert: AlertResult, gameState: GameState): string {
    return `${gameState.gameId}_${alert.type}_${Date.now()}`;
  }
  
  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    const avgTime = this.performanceMetrics.avgProcessingTime.length > 0 
      ? this.performanceMetrics.avgProcessingTime.reduce((a, b) => a + b) / this.performanceMetrics.avgProcessingTime.length 
      : 0;
      
    return {
      totalRequests: this.performanceMetrics.totalRequests,
      cacheHitRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests * 100).toFixed(1) + '%'
        : '0%',
      timeoutRate: this.performanceMetrics.totalRequests > 0
        ? (this.performanceMetrics.timeouts / this.performanceMetrics.totalRequests * 100).toFixed(1) + '%'
        : '0%',
      avgProcessingTime: avgTime.toFixed(0) + 'ms',
      cacheSize: this.cache.size
    };
  }
}

// Export singleton instance
export const enhancedAlertRouter = new EnhancedAlertRouter();