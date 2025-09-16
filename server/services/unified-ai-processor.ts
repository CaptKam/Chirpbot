import { storage } from '../storage';
import { AlertResult } from './engines/base-engine';

// === UNIFIED INTERFACES ===
export interface CrossSportContext {
  sport: 'MLB' | 'NFL' | 'NCAAF' | 'WNBA' | 'NBA' | 'CFL';
  gameId: string;
  alertType: string;
  priority: number;
  probability: number;

  // Universal game state
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isLive: boolean;

  // Time/Period context
  period?: number;
  timeRemaining?: string;

  // MLB-specific
  inning?: number;
  outs?: number;
  balls?: number;
  strikes?: number;
  baseRunners?: {
    first: boolean;
    second: boolean;
    third: boolean;
  };

  // Football-specific (NFL/NCAAF/CFL)
  quarter?: number;
  down?: number;
  yardsToGo?: number;
  fieldPosition?: number;
  possession?: string;
  redZone?: boolean;
  goalLine?: boolean;

  // Basketball-specific (NBA/WNBA)
  timeLeft?: string;
  shotClock?: number;
  fouls?: {
    home: number;
    away: number;
  };

  // Environmental
  weather?: {
    temperature: number;
    condition: string;
    windSpeed?: number;
    humidity?: number;
    impact?: string;
  };

  // Betting context
  spread?: number;
  total?: number;

  // Championship/playoff context
  playoffImplications?: boolean;
  championshipContext?: string;

  // Original message for fallback
  originalMessage: string;
  originalContext: any;
}

export interface UnifiedAIResponse {
  sport: string;
  enhancedTitle: string;
  enhancedMessage: string;
  contextualInsights: string[];
  actionableRecommendation: string;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  bettingContext?: {
    recommendation: string;
    confidence: number;
    reasoning: string[];
  };
  gameProjection?: {
    winProbability: { home: number; away: number };
    keyFactors: string[];
    nextCriticalMoment: string;
  };
  aiProcessingTime: number;
  confidence: number;
  sportSpecificData: any;
}

interface AIJob {
  id: string;
  alertId: string;
  context: CrossSportContext;
  originalAlert: AlertResult;
  timestamp: number;
  userId: string;
  sport: string;
  retries: number;
}

interface AIResult {
  jobId: string;
  alertId: string;
  enhancedAlert: AlertResult;
  processingTime: number;
  processedAt: number;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
  wasActuallyEnhanced: boolean;
  hasComposerEnhancement?: boolean;
}

interface AICache {
  key: string;
  response: UnifiedAIResponse;
  timestamp: number;
  sport: string;
}

// === UNIFIED AI PROCESSOR ===
export class UnifiedAIProcessor {
  // Unified caching and queue management
  private cache = new Map<string, AICache>();
  private jobQueue = new Map<string, AIJob>();
  private processingQueue = new Set<string>();
  private results = new Map<string, AIResult>();
  
  // Configuration constants
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 500;
  private readonly AI_TIMEOUT_MS = 8000; // 8 second timeout
  private readonly MAX_RETRIES = 1;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly RESULT_TTL = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  // Unified performance metrics
  private performanceMetrics = {
    totalRequests: 0,
    totalJobs: 0,
    completedJobs: 0,
    timeoutJobs: 0,
    failedJobs: 0,
    cacheHits: 0,
    cacheMisses: 0,
    successfulEnhancements: 0,
    failedEnhancements: 0,
    avgProcessingTime: [] as number[],
    queuedJobs: 0,
    processingJobs: 0,
    highValueAlerts: 0,
    gatedAlerts: 0,
    fallbacksUsed: 0, // Track when we fallback to original alerts
    
    // Per-sport metrics
    sportMetrics: {
      MLB: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 },
      NFL: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 },
      NCAAF: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 },
      NBA: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 },
      WNBA: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 },
      CFL: { requests: 0, avgTime: 0, successes: 0, fallbacks: 0 }
    }
  };

  // High-value alert types that benefit most from AI enhancement
  private highValueAlertTypes: Record<string, string[]> = {
    'MLB': [
      'MLB_GAME_START', 'MLB_BASES_LOADED_NO_OUTS', 'MLB_BASES_LOADED_ONE_OUT',
      'MLB_FIRST_AND_THIRD_NO_OUTS', 'MLB_RUNNER_ON_THIRD_NO_OUTS', 'MLB_SECOND_AND_THIRD_NO_OUTS',
      'MLB_RUNNER_ON_THIRD_ONE_OUT', 'MLB_SECOND_AND_THIRD_ONE_OUT', 'MLB_SEVENTH_INNING_STRETCH',
      'MLB_BATTER_DUE', 'MLB_STEAL_LIKELIHOOD', 'MLB_LATE_INNING_CLOSE', 'MLB_FIRST_AND_SECOND',
      'MLB_SCORING_OPPORTUNITY', 'MLB_PITCHING_CHANGE', 'MLB_FIRST_AND_THIRD_ONE_OUT',
      'MLB_FIRST_AND_THIRD_TWO_OUTS', 'MLB_RUNNER_ON_THIRD_TWO_OUTS', 'MLB_BASES_LOADED_TWO_OUTS',
      'MLB_ON_DECK_PREDICTION', 'MLB_WIND_CHANGE'
    ],
    'NFL': [
      'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_TWO_MINUTE_WARNING', 'NFL_RED_ZONE_OPPORTUNITY',
      'NFL_GOAL_LINE_STAND', 'NFL_OVERTIME', 'NFL_GAME_START', 'NFL_SCORING_CHANGE', 'NFL_TOUCHDOWN',
      'NFL_FIELD_GOAL_ATTEMPT', 'NFL_TURNOVER', 'NFL_THIRD_DOWN', 'NFL_HALFTIME', 'NFL_FIRST_DOWN',
      'NFL_TURNOVER_LIKELIHOOD', 'NFL_MASSIVE_WEATHER', 'NFL_SECOND_HALF_KICKOFF'
    ],
    'NBA': [
      'NBA_CLUTCH_PERFORMANCE', 'NBA_FINAL_MINUTES', 'NBA_OVERTIME', 'NBA_TWO_MINUTE_WARNING',
      'NBA_GAME_WINNER_OPPORTUNITY', 'NBA_GAME_START', 'NBA_HALFTIME', 'NBA_SCORING_RUN',
      'NBA_MOMENTUM_SHIFT', 'NBA_BUZZER_BEATER', 'NBA_FREE_THROW_SITUATION'
    ],
    'NCAAF': [
      'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_FOURTH_DOWN_DECISION', 'NCAAF_TWO_MINUTE_WARNING',
      'NCAAF_OVERTIME', 'NCAAF_GOAL_LINE', 'NCAAF_GAME_START', 'NCAAF_HALFTIME',
      'NCAAF_SCORING_CHANGE', 'NCAAF_TURNOVER', 'NCAAF_THIRD_DOWN'
    ],
    'CFL': [
      'CFL_ROUGE_OPPORTUNITY', 'CFL_TWO_MINUTE_WARNING', 'CFL_OVERTIME', 'CFL_FOURTH_DOWN',
      'CFL_GAME_START', 'CFL_HALFTIME', 'CFL_RED_ZONE', 'CFL_THIRD_DOWN', 'CFL_SCORING_CHANGE'
    ],
    'WNBA': [
      'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_FINAL_MINUTES', 'WNBA_TWO_MINUTE_WARNING',
      'WNBA_OVERTIME', 'WNBA_GAME_START', 'WNBA_HALFTIME', 'WNBA_SCORING_RUN',
      'WNBA_MOMENTUM_SHIFT', 'WNBA_FREE_THROW_SITUATION'
    ]
  };

  private onEnhancedAlert?: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>;

  constructor() {
    // Clear ALL cache entries on startup to ensure clean state
    this.clearAllCache();
    
    // Start background cleanup
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    console.log(`🤖 Unified AI Processor: Initialized with clean cache and consistent "AI OR ORIGINAL" policy`);
  }

  private clearAllCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.results.clear();
    console.log(`🧹 Unified AI: Cleared ALL ${cacheSize} cache entries on startup to ensure clean state`);
  }

  get configured(): boolean {
    // TODO: Check if OpenAI API key is configured
    return true; // Placeholder
  }

  // Set callback for when enhanced alerts are ready
  setOnEnhancedAlert(callback: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>) {
    this.onEnhancedAlert = callback;
  }

  // NON-BLOCKING ENTRY POINT: Queue alert for AI enhancement (engines use this)
  queueAlert(
    alert: AlertResult, 
    context: CrossSportContext, 
    userId: string
  ): Promise<string> {
    const jobId = this.generateJobId(alert, context);
    
    console.log(`🎯 Unified AI: Queuing ${context.sport} ${context.alertType} for background AI enhancement`);
    
    try {
      // Check if alert qualifies for AI enhancement (gating)
      if (!this.shouldEnhanceAlert(context.alertType, context.sport, context.probability)) {
        console.log(`🚪 AI Gating: ${context.sport} ${context.alertType} not high-value - skipping AI enhancement`);
        this.performanceMetrics.gatedAlerts++;
        this.performanceMetrics.fallbacksUsed++;
        return Promise.resolve(jobId);
      }

      // Check cache first for AI-enhanced version
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        // Double-check cached response is valid before using it
        if (cached.enhancedMessage && 
            !cached.enhancedMessage.includes('This alert has been enhanced by the unified AI system') &&
            cached.enhancedMessage !== context.originalMessage) {
          console.log(`💨 Unified AI Cache Hit: ${context.sport} ${context.alertType} - valid cached content found`);
          this.performanceMetrics.cacheHits++;
          
          const startTime = Date.now();
          const enhancedAlert = this.buildEnhancedAlert(alert, cached, startTime);
          
          // Send enhanced version via WebSocket (non-blocking)
          if (this.onEnhancedAlert) {
            this.onEnhancedAlert(enhancedAlert, userId, context.sport, true).catch(error => {
              console.error(`❌ Failed to send cached enhanced alert via WebSocket:`, error);
            });
          }
          
          return Promise.resolve(jobId);
        } else {
          console.log(`⚠️ Unified AI: Cache hit but response was invalid/mock, deleting and proceeding with fresh enhancement`);
          this.cache.delete(cacheKey);
          this.performanceMetrics.cacheMisses++;
        }
      }

      // Queue for async AI processing (completely non-blocking)
      this.queueForAsyncEnhancement(alert, context, userId, jobId).catch(error => {
        console.error(`❌ Failed to queue alert for AI enhancement:`, error);
        this.performanceMetrics.failedEnhancements++;
        this.performanceMetrics.fallbacksUsed++;
      });
      
      console.log(`📥 Unified AI: Alert queued for background enhancement - original was already sent`);

    } catch (error) {
      console.error(`❌ Unified AI: Error queuing ${context.sport} alert:`, error);
      this.performanceMetrics.failedEnhancements++;
      this.performanceMetrics.fallbacksUsed++;
      const sportKey = context.sport as keyof typeof this.performanceMetrics.sportMetrics;
      this.performanceMetrics.sportMetrics[sportKey].fallbacks++;
    }

    return Promise.resolve(jobId);
  }

  // LEGACY METHOD (for backward compatibility - will be removed)
  async processAlert(
    alert: AlertResult, 
    context: CrossSportContext, 
    userId: string
  ): Promise<string> {
    console.warn(`⚠️ DEPRECATED: processAlert() called instead of queueAlert() - this blocks engines!`);
    return this.queueAlert(alert, context, userId);
  }

  // Check if alert qualifies for AI enhancement (unified gating)
  private shouldEnhanceAlert(alertType: string, sport: string, probability?: number): boolean {
    const normalizedSport = sport.toUpperCase();
    const highValueTypes = this.highValueAlertTypes[normalizedSport] || [];
    
    const isHighValue = highValueTypes.includes(alertType);
    const meetsThreshold = true; // Always allow enhancement - removed probability filter
    
    const shouldEnhance = isHighValue && meetsThreshold;
    
    if (shouldEnhance) {
      this.performanceMetrics.highValueAlerts++;
    }
    
    return shouldEnhance;
  }

  // Queue alert for asynchronous AI enhancement (non-blocking)
  private async queueForAsyncEnhancement(
    alert: AlertResult, 
    context: CrossSportContext, 
    userId: string,
    jobId: string
  ): Promise<void> {
    // Check queue size limit
    if (this.jobQueue.size >= this.MAX_QUEUE_SIZE) {
      console.warn(`⚠️ Unified AI Queue Full: Skipping enhancement for ${context.sport} ${context.alertType}`);
      return;
    }

    const job: AIJob = {
      id: jobId,
      alertId: alert.alertKey,
      context,
      originalAlert: alert,
      timestamp: Date.now(),
      userId,
      sport: context.sport,
      retries: 0
    };

    this.jobQueue.set(jobId, job);
    this.performanceMetrics.totalJobs++;
    this.performanceMetrics.queuedJobs = this.jobQueue.size;
    
    console.log(`📥 Unified AI Queued: ${context.sport} ${context.alertType} for async enhancement`);
    
    // Start processing immediately (non-blocking)
    this.processJobAsync(jobId).catch(error => {
      console.error(`❌ Unified AI Background processing failed for job ${jobId}:`, error);
    });

    this.performanceMetrics.cacheMisses++;
  }

  // Process AI job asynchronously with timeout protection
  private async processJobAsync(jobId: string): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      console.warn(`⚠️ Unified AI Job ${jobId} not found in queue`);
      return;
    }

    // Prevent duplicate processing
    if (this.processingQueue.has(jobId)) {
      return;
    }

    this.processingQueue.add(jobId);
    this.performanceMetrics.processingJobs = this.processingQueue.size;
    
    const startTime = Date.now();
    
    try {
      console.log(`🧠 Unified AI Processing: ${job.sport} ${job.context.alertType} (Timeout: ${this.AI_TIMEOUT_MS}ms)`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI_TIMEOUT')), this.AI_TIMEOUT_MS);
      });

      // Race AI processing against timeout
      const aiResponse = await Promise.race([
        this.enhanceAlert(job.context),
        timeoutPromise
      ]);

      const processingTime = Date.now() - startTime;
      
      // Verify AI actually provided enhanced content
      if (!aiResponse.enhancedMessage || aiResponse.enhancedMessage.trim().length === 0) {
        throw new Error('AI_ENHANCEMENT_FAILED_NO_MESSAGE');
      }

      // Build enhanced alert
      const enhancedAlert = this.buildEnhancedAlert(job.originalAlert, aiResponse, startTime);
      
      // Store result
      this.results.set(jobId, {
        jobId,
        alertId: job.alertId,
        enhancedAlert,
        processingTime,
        processedAt: Date.now(),
        status: 'completed',
        wasActuallyEnhanced: true,
        hasComposerEnhancement: !!job.originalAlert.context?.enhanced
      });

      // Send enhanced alert via WebSocket
      if (this.onEnhancedAlert) {
        await this.onEnhancedAlert(enhancedAlert, job.userId, job.sport, true);
      }

      // Cache the response for future use
      const cacheKey = this.generateCacheKey(job.context);
      this.cacheResponse(cacheKey, aiResponse);

      this.performanceMetrics.completedJobs++;
      this.performanceMetrics.successfulEnhancements++;
      const sportKey = job.sport as keyof typeof this.performanceMetrics.sportMetrics;
      this.performanceMetrics.sportMetrics[sportKey].successes++;
      
      console.log(`✅ Unified AI Enhanced: ${job.sport} ${job.context.alertType} in ${processingTime}ms`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message === 'AI_TIMEOUT';
      
      if (isTimeout) {
        console.warn(`⏱️ Unified AI Timeout: ${job.sport} ${job.context.alertType} after ${processingTime}ms`);
        this.performanceMetrics.timeoutJobs++;
      } else {
        console.error(`❌ Unified AI Failed: ${job.sport} ${job.context.alertType} after ${processingTime}ms:`, error);
        this.performanceMetrics.failedJobs++;
      }

      // Store failed result
      this.results.set(jobId, {
        jobId,
        alertId: job.alertId,
        enhancedAlert: job.originalAlert, // Fallback to original
        processingTime,
        processedAt: Date.now(),
        status: isTimeout ? 'timeout' : 'failed',
        error: error instanceof Error ? error.message : String(error),
        wasActuallyEnhanced: false
      });

      // NOTE: Original alert was already sent, no additional action needed
      // This is the key to "AI OR ORIGINAL" - user already got the alert

    } finally {
      // Cleanup
      this.jobQueue.delete(jobId);
      this.processingQueue.delete(jobId);
      this.performanceMetrics.queuedJobs = this.jobQueue.size;
      this.performanceMetrics.processingJobs = this.processingQueue.size;
    }
  }

  // Main AI enhancement method (unified from CrossSportAIEnhancement)
  async enhanceAlert(context: CrossSportContext): Promise<UnifiedAIResponse> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.sportMetrics[context.sport].requests++;

    try {
      // Check if AI is configured
      if (!this.configured) {
        console.log(`🚫 Unified AI: DISABLED for ${context.sport} - OpenAI not configured`);
        return this.getFallbackResponse(context, startTime);
      }

      // Generate sport-specific AI enhancement
      const sportPrompt = this.buildSportSpecificPrompt(context);
      const aiResponse = await this.callOpenAI(sportPrompt);

      if (!aiResponse) {
        console.log(`⚠️ Unified AI: No response from AI for ${context.sport}`);
        return this.getFallbackResponse(context, startTime);
      }

      // Parse and structure the AI response
      const enhancement = this.parseAIResponse(aiResponse, context, startTime);

      const processingTime = Date.now() - startTime;
      this.performanceMetrics.avgProcessingTime.push(processingTime);
      this.performanceMetrics.sportMetrics[context.sport].avgTime =
        (this.performanceMetrics.sportMetrics[context.sport].avgTime * (this.performanceMetrics.sportMetrics[context.sport].requests - 1) + processingTime) / this.performanceMetrics.sportMetrics[context.sport].requests;

      console.log(`✅ Unified AI: Enhanced ${context.sport} alert in ${processingTime}ms`);
      return enhancement;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Unified AI: Failed to enhance ${context.sport} alert after ${processingTime}ms:`, error);
      return this.getFallbackResponse(context, startTime);
    }
  }

  // === UTILITY METHODS ===

  // Get performance metrics for monitoring dashboard (API compatibility)
  getPerformanceMetrics() {
    const avgTime = this.performanceMetrics.avgProcessingTime.length > 0
      ? this.performanceMetrics.avgProcessingTime.reduce((sum, time) => sum + time, 0) / this.performanceMetrics.avgProcessingTime.length
      : 0;

    return {
      // AI Processing Metrics
      totalRequests: this.performanceMetrics.totalRequests,
      totalJobs: this.performanceMetrics.totalJobs,
      completedJobs: this.performanceMetrics.completedJobs,
      failedJobs: this.performanceMetrics.failedJobs,
      timeoutJobs: this.performanceMetrics.timeoutJobs,
      
      // Cache Metrics
      cacheHits: this.performanceMetrics.cacheHits,
      cacheMisses: this.performanceMetrics.cacheMisses,
      
      // Performance Metrics
      avgProcessingTime: avgTime,
      
      // Enhancement Metrics
      successfulEnhancements: this.performanceMetrics.successfulEnhancements,
      failedEnhancements: this.performanceMetrics.failedEnhancements,
      
      // Queue Status
      queuedJobs: this.performanceMetrics.queuedJobs,
      processingJobs: this.performanceMetrics.processingJobs,
      
      // Quality Metrics
      highValueAlerts: this.performanceMetrics.highValueAlerts,
      gatedAlerts: this.performanceMetrics.gatedAlerts,
      fallbacksUsed: this.performanceMetrics.fallbacksUsed,
      
      // Sport-specific metrics
      sportMetrics: this.performanceMetrics.sportMetrics
    };
  }

  private generateJobId(alert: AlertResult, context: CrossSportContext): string {
    return `${context.sport}_${context.gameId}_${context.alertType}_${Date.now()}`;
  }

  private generateCacheKey(context: CrossSportContext): string {
    const keyParts = [
      context.sport,
      context.gameId,
      context.alertType,
      context.inning || context.quarter || context.period || 0,
      context.outs || 0,
      context.awayScore,
      context.homeScore
    ];
    return keyParts.join(':');
  }

  private getCachedResponse(key: string): UnifiedAIResponse | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      // Validate cached response has actual content
      // Prevent returning cached mock responses or empty messages
      if (cached.response.enhancedMessage && 
          cached.response.enhancedMessage.trim().length > 0 &&
          !cached.response.enhancedMessage.includes('This alert has been enhanced by the unified AI system') &&
          cached.response.contextualInsights.length > 0 &&
          !cached.response.contextualInsights[0].includes('Game situation developing')) {
        return cached.response;
      } else {
        // Remove invalid cached entry
        console.log(`🗑️ Unified AI: Removing invalid cached response for key ${key}`);
        this.cache.delete(key);
      }
    }
    return null;
  }

  private cacheResponse(key: string, response: UnifiedAIResponse): void {
    // Validate response before caching - prevent caching mock or empty responses
    if (!response.enhancedMessage || 
        response.enhancedMessage.trim().length === 0 ||
        response.enhancedMessage.includes('This alert has been enhanced by the unified AI system') ||
        response.contextualInsights.length === 0 ||
        response.contextualInsights[0].includes('Game situation developing')) {
      console.log(`🚫 Unified AI: Refusing to cache invalid/mock response for key ${key}`);
      return;
    }

    // LRU-style cache management
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      response,
      timestamp: Date.now(),
      sport: response.sport
    });
    
    console.log(`💾 Unified AI: Cached valid response for ${response.sport} alert (${key})`);
  }

  private buildEnhancedAlert(originalAlert: AlertResult, aiResponse: UnifiedAIResponse, startTime: number): AlertResult {
    return {
      ...originalAlert,
      message: aiResponse.enhancedMessage,
      context: {
        ...originalAlert.context,
        aiEnhanced: true,
        aiInsights: aiResponse.contextualInsights,
        bettingAdvice: aiResponse.bettingContext?.recommendation,
        gameProjection: aiResponse.gameProjection,
        urgency: aiResponse.urgencyLevel,
        callToAction: aiResponse.actionableRecommendation,
        confidenceScore: aiResponse.confidence,
        aiProcessingTime: aiResponse.aiProcessingTime
      },
      priority: Math.max(originalAlert.priority, 90) // Boost priority for AI-enhanced alerts
    };
  }

  private getFallbackResponse(context: CrossSportContext, startTime: number): UnifiedAIResponse {
    return {
      sport: context.sport,
      enhancedTitle: `${context.sport} Alert`,
      enhancedMessage: context.originalMessage,
      contextualInsights: [`${context.sport} game situation developing`],
      actionableRecommendation: 'Monitor game progress',
      urgencyLevel: 'MEDIUM' as const,
      aiProcessingTime: Date.now() - startTime,
      confidence: 50,
      sportSpecificData: context
    };
  }

  // === PLACEHOLDER METHODS (to be implemented) ===
  
  private async callOpenAI(prompt: string): Promise<string | null> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ Unified AI: OPENAI_API_KEY not configured');
        return null;
      }

      console.log("🤖 Unified AI: Making OpenAI API call");
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt },
            { 
              role: 'user', 
              content: 'Provide a concise, contextual analysis (2-3 sentences max) with betting insights and key factors to watch. Focus on actionable information.' 
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Unified AI: OpenAI API error:', error);
        return null;
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (aiResponse && aiResponse.trim().length > 0) {
        console.log('✅ Unified AI: Successfully got AI response');
        return aiResponse;
      }
      
      console.warn('⚠️ Unified AI: Empty response from OpenAI');
      return null;
      
    } catch (error: any) {
      console.error('❌ Unified AI: Error calling OpenAI:', error.message);
      return null;
    }
  }

  private buildSportSpecificPrompt(context: CrossSportContext): string {
    const basePrompt = `You are a ${context.sport} expert AI providing contextual insights for sports alerts.

GAME CONTEXT:
- ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
- Alert: ${context.alertType} (${context.probability}% confidence)
- Original: ${context.originalMessage}
${context.playoffImplications ? '- PLAYOFF IMPLICATIONS: High stakes game' : ''}
${context.championshipContext ? `- CHAMPIONSHIP CONTEXT: ${context.championshipContext}` : ''}
${context.weather ? `- WEATHER: ${context.weather.temperature}°F, ${context.weather.condition}` : ''}
`;

    // Add sport-specific context based on sport type
    switch (context.sport) {
      case 'MLB':
        return `${basePrompt}BASEBALL SITUATION:
- ${context.inning}${this.getOrdinal(context.inning || 1)} inning, ${context.outs || 0} outs
- Count: ${context.balls || 0}-${context.strikes || 0}
- Runners: ${this.describeBaseRunners(context.baseRunners)}
Focus on: Run expectancy, leverage situations, clutch hitting.`;

      case 'NFL':
      case 'NCAAF':
      case 'CFL':
        return `${basePrompt}FOOTBALL SITUATION:
- Q${context.quarter || 1}, ${context.timeRemaining || 'Unknown'} remaining
${context.down && context.yardsToGo ? `- ${this.getOrdinal(context.down)} & ${context.yardsToGo}` : ''}
${context.redZone ? '- RED ZONE: High scoring probability' : ''}
Focus on: Down & distance, field position, clock management.`;

      case 'NBA':
      case 'WNBA':
        return `${basePrompt}BASKETBALL SITUATION:
- ${context.timeLeft || 'Unknown'} remaining
- Shot clock: ${context.shotClock || 'Unknown'}
${context.fouls ? `- Team fouls: ${context.fouls.home}-${context.fouls.away}` : ''}
Focus on: Time management, shooting efficiency, foul situation.`;

      default:
        return basePrompt;
    }
  }

  private parseAIResponse(aiResponse: string, context: CrossSportContext, startTime: number): UnifiedAIResponse {
    // Simple parsing - extract key information from AI response
    const lines = aiResponse.split('\n');
    
    const getSection = (marker: string): string => {
      const line = lines.find(l => l.includes(marker));
      return line ? line.split(':').slice(1).join(':').trim() : '';
    };

    return {
      sport: context.sport,
      enhancedTitle: getSection('Enhanced Title') || `${context.sport} Alert`,
      enhancedMessage: getSection('Enhanced Message') || context.originalMessage,
      contextualInsights: [
        getSection('Insight 1') || 'Game situation developing',
        getSection('Insight 2') || 'Strategic implications noted',
        getSection('Insight 3') || 'Monitor for opportunities'
      ].filter(insight => insight.length > 0),
      actionableRecommendation: getSection('Recommendation') || 'Monitor game progress',
      urgencyLevel: 'MEDIUM' as const,
      bettingContext: {
        recommendation: getSection('Recommendation') || 'Evaluate carefully',
        confidence: 75,
        reasoning: ['AI-generated analysis', 'Game situation assessment']
      },
      gameProjection: {
        winProbability: { home: 50, away: 50 },
        keyFactors: getSection('Factors').split(',').map(f => f.trim()).filter(f => f.length > 0),
        nextCriticalMoment: getSection('Next Moment') || 'Next play development'
      },
      aiProcessingTime: Date.now() - startTime,
      confidence: 85,
      sportSpecificData: context
    };
  }

  private getOrdinal(num: number): string {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  }

  private describeBaseRunners(runners?: { first: boolean; second: boolean; third: boolean }): string {
    if (!runners) return 'Unknown base situation';
    
    const occupied = [];
    if (runners.first) occupied.push('1st');
    if (runners.second) occupied.push('2nd');
    if (runners.third) occupied.push('3rd');
    
    return occupied.length > 0 ? occupied.join(', ') : 'Bases empty';
  }

  // Cleanup old entries
  private cleanup(): void {
    const now = Date.now();
    
    // Clean cache
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
    
    // Clean results
    for (const [key, result] of this.results.entries()) {
      if (now - result.processedAt > this.RESULT_TTL) {
        this.results.delete(key);
      }
    }
    
    // Clean old jobs
    for (const [key, job] of this.jobQueue.entries()) {
      if (now - job.timestamp > this.RESULT_TTL) {
        this.jobQueue.delete(key);
      }
    }
  }

  // Get statistics for monitoring
  getStats() {
    return {
      cache: {
        size: this.cache.size,
        hitRate: this.performanceMetrics.cacheHits / Math.max(1, this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100
      },
      queue: {
        current: this.jobQueue.size,
        processing: this.processingQueue.size,
        completed: this.performanceMetrics.completedJobs,
        failed: this.performanceMetrics.failedJobs,
        timeout: this.performanceMetrics.timeoutJobs
      },
      performance: {
        totalRequests: this.performanceMetrics.totalRequests,
        successRate: this.performanceMetrics.successfulEnhancements / Math.max(1, this.performanceMetrics.totalRequests) * 100,
        avgProcessingTime: this.performanceMetrics.avgProcessingTime.length > 0 
          ? this.performanceMetrics.avgProcessingTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.avgProcessingTime.length 
          : 0,
        fallbackRate: this.performanceMetrics.fallbacksUsed / Math.max(1, this.performanceMetrics.totalRequests) * 100
      },
      gating: {
        highValueAlerts: this.performanceMetrics.highValueAlerts,
        gatedAlerts: this.performanceMetrics.gatedAlerts,
        gatingRate: this.performanceMetrics.gatedAlerts / Math.max(1, this.performanceMetrics.highValueAlerts + this.performanceMetrics.gatedAlerts) * 100
      },
      sportMetrics: this.performanceMetrics.sportMetrics
    };
  }

  // Get high-value alert types for a specific sport
  getHighValueAlertTypes(sport: string): string[] {
    return this.highValueAlertTypes[sport.toUpperCase()] || [];
  }

  // Clear caches (for testing or manual cleanup)
  clearCache(): void {
    const cacheSize = this.cache.size;
    const resultsSize = this.results.size;
    this.cache.clear();
    this.results.clear();
    console.log(`🧹 Unified AI: Manually cleared ${cacheSize} cache entries and ${resultsSize} result entries`);
  }

  // Cleanup on shutdown
  destroy(): void {
    this.clearCache();
    this.jobQueue.clear();
    this.processingQueue.clear();
  }
}

// Create singleton instance
export const unifiedAIProcessor = new UnifiedAIProcessor();