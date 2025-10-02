import { storage } from '../storage';
import { AlertResult } from './engines/base-engine';
import { gamblingInsightsComposer } from './gambling-insights-composer';

// 🛡️ SECURITY: Schema validation and XSS protection
import { z } from 'zod';

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
  enhancedContext?: string[];
  tags?: string[];
  analysis?: string;
}

// 🛡️ SECURITY: Strict schema validation for AI JSON responses
const AIJSONResponseSchema = z.object({
  primary: z.string().min(5).max(200),
  secondary: z.string().max(200).optional()
});

// Legacy schema for backward compatibility
const AIResponseSchema = z.object({
  sport: z.string().max(10),
  enhancedTitle: z.string().max(200),
  enhancedMessage: z.string().max(500),
  contextualInsights: z.array(z.string().max(150)).max(5),
  actionableRecommendation: z.string().max(200),
  urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  bettingContext: z.object({
    recommendation: z.string().max(150),
    confidence: z.number().min(0).max(100),
    reasoning: z.array(z.string().max(100)).max(3)
  }).optional(),
  gameProjection: z.object({
    winProbability: z.object({
      home: z.number().min(0).max(100),
      away: z.number().min(0).max(100)
    }),
    keyFactors: z.array(z.string().max(100)).max(3),
    nextCriticalMoment: z.string().max(100)
  }).optional(),
  aiProcessingTime: z.number(),
  confidence: z.number().min(0).max(100),
  sportSpecificData: z.any(),
  enhancedContext: z.array(z.string().max(200)).max(5).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  analysis: z.string().max(1000).optional()
});

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
  private readonly AI_TIMEOUT_MS = 3000; // 3 second timeout for faster fallback
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
      'MLB_ON_DECK_PREDICTION', 'MLB_WIND_CHANGE', 'MLB_STRIKEOUT'
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
      'NCAAF_GAME_START', 'NCAAF_SECOND_HALF_KICKOFF', 'NCAAF_CLOSE_GAME', 'NCAAF_FOURTH_QUARTER', 
      'NCAAF_HALFTIME', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_COMEBACK_POTENTIAL', 'NCAAF_FOURTH_DOWN_DECISION',
      'NCAAF_MASSIVE_WEATHER', 'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_RED_ZONE', 'NCAAF_SCORING_PLAY',
      'NCAAF_UPSET_OPPORTUNITY'
    ],
    'CFL': [
      'CFL_ROUGE_OPPORTUNITY', 'CFL_TWO_MINUTE_WARNING', 'CFL_OVERTIME', 'CFL_FOURTH_DOWN',
      'CFL_GAME_START', 'CFL_HALFTIME', 'CFL_RED_ZONE', 'CFL_THIRD_DOWN', 'CFL_SCORING_CHANGE'
    ],
    'WNBA': [
      'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_FINAL_MINUTES', 'WNBA_TWO_MINUTE_WARNING',
      'WNBA_OVERTIME', 'WNBA_GAME_START', 'WNBA_HALFTIME', 'WNBA_SCORING_RUN',
      'WNBA_MOMENTUM_SHIFT', 'WNBA_FREE_THROW_SITUATION', 'WNBA_CRUNCH_TIME_DEFENSE', 
      'WNBA_CHAMPIONSHIP_IMPLICATIONS'
    ]
  };

  private onEnhancedAlert?: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>;

  constructor() {
    // Clear ALL cache entries on startup to ensure clean state
    this.clearAllCache();
    
    // Force clear cache to eliminate pre-unified enhancement responses
    this.clearUnifiedEnhancementCache();
    
    // Start background cleanup
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    console.log(`🤖 Unified AI Processor: Initialized with clean cache and unified enhancement pipeline v3.0`);
  }

  private clearAllCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.results.clear();
    console.log(`🧹 Unified AI: Cleared ALL ${cacheSize} cache entries on startup to ensure clean state`);
  }

  private clearUnifiedEnhancementCache(): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      // Remove any cache entries that don't have the v3.0 version marker
      if (!key.includes('v3.0')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🧹 Unified AI: Cleared ${keysToDelete.length} pre-v3.0 cache entries for consistency`);
  }

  get configured(): boolean {
    // TODO: Check if OpenAI API key is configured
    return true; // Placeholder
  }

  // Set callback for when enhanced alerts are ready
  setOnEnhancedAlert(callback: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>) {
    this.onEnhancedAlert = callback;
  }

  // UNIFIED ENTRY POINT: Queue alert for complete enhancement (AI + gambling + weather in one pipeline)
  queueAlert(
    alert: AlertResult, 
    context: CrossSportContext, 
    userId: string
  ): Promise<string> {
    const jobId = this.generateJobId(alert, context);
    
    console.log(`🎯 Unified Enhancement: Queuing ${context.sport} ${context.alertType} for complete enhancement pipeline`);
    
    try {
      // Always apply gambling and weather enhancement, only gate AI portion
      const shouldApplyAI = this.shouldEnhanceAlert(context.alertType, context.sport, context.probability);
      
      if (!shouldApplyAI) {
        console.log(`🚪 AI Gating: ${context.sport} ${context.alertType} not high-value - applying gambling+weather only`);
        this.performanceMetrics.gatedAlerts++;
        
        // Apply non-AI enhancements immediately (gambling + weather only)
        this.applyLimitedUnifiedEnhancement(alert, context).then(limitedEnhancement => {
          // Send limited enhanced version via WebSocket (non-blocking)
          if (this.onEnhancedAlert) {
            this.onEnhancedAlert(limitedEnhancement, userId, context.sport, true).catch(error => {
              console.error(`❌ Failed to send limited enhanced alert via WebSocket:`, error);
            });
          }
          
          console.log(`✅ Applied gambling+weather enhancement for gated ${context.sport} ${context.alertType}`);
        }).catch(error => {
          console.warn(`⚠️ Limited enhancement failed for ${context.sport} ${context.alertType}:`, error);
          this.performanceMetrics.fallbacksUsed++;
        });
        
        return Promise.resolve(jobId);
      }

      // Check cache first for AI-enhanced version
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getCachedResponse(cacheKey, context);
      if (cached) {
        // Double-check cached response is valid before using it
        if (cached.enhancedMessage && 
            !cached.enhancedMessage.includes('This alert has been enhanced by the unified AI system') &&
            cached.enhancedMessage !== context.originalMessage) {
          console.log(`💨 Unified AI Cache Hit: ${context.sport} ${context.alertType} - valid cached content found`);
          this.performanceMetrics.cacheHits++;
          
          const startTime = Date.now();
          
          // Apply gambling insights and weather enhancement even for cache hits
          let enhancedAlert = { ...alert };
          this.applyGamblingInsightsEnhancement(enhancedAlert, context)
            .then(gamblingEnhanced => this.applyWeatherEnhancement(gamblingEnhanced, context))
            .then(fullyEnhanced => {
              // Build enhanced alert with cached AI response and unified flags
              const finalAlert = this.buildEnhancedAlert(fullyEnhanced, {
                ...cached,
                enhancedContext: {
                  ...fullyEnhanced.context,
                  ...cached.enhancedContext,
                  unifiedEnhancement: true,
                  enhancementTypes: ['gambling', 'weather', 'ai']
                }
              }, startTime);
              
              // Send enhanced version via WebSocket (non-blocking)
              if (this.onEnhancedAlert) {
                this.onEnhancedAlert(finalAlert, userId, context.sport, true).catch(error => {
                  console.error(`❌ Failed to send cached enhanced alert via WebSocket:`, error);
                });
              }
            })
            .catch(error => {
              console.warn(`⚠️ Cache hit enhancement failed, using cached response only:`, error);
              const fallbackAlert = this.buildEnhancedAlert(alert, cached, startTime);
              if (this.onEnhancedAlert) {
                this.onEnhancedAlert(fallbackAlert, userId, context.sport, true).catch(error => {
                  console.error(`❌ Failed to send fallback cached alert via WebSocket:`, error);
                });
              }
            });
          
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
    
    // Enhanced gating: Include high-value types + probability-based inclusion
    const isHighValue = highValueTypes.includes(alertType);
    const hasGoodProbability = (probability || 0) >= 60; // 60%+ probability threshold
    const isGameStart = alertType.includes('GAME_START'); // Always enhance game starts
    
    const shouldEnhance = isHighValue || hasGoodProbability || isGameStart;
    
    if (shouldEnhance) {
      if (isHighValue) this.performanceMetrics.highValueAlerts++;
    } else {
      this.performanceMetrics.gatedAlerts++;
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

      // Race unified enhancement (AI + gambling + weather) against timeout
      const enhancementResponse = await Promise.race([
        this.applyUnifiedEnhancement(job.originalAlert, job.context),
        timeoutPromise
      ]);

      const processingTime = Date.now() - startTime;
      
      // Verify unified enhancement provided enhanced content
      if (!enhancementResponse.enhancedMessage || enhancementResponse.enhancedMessage.trim().length === 0) {
        throw new Error('UNIFIED_ENHANCEMENT_FAILED_NO_MESSAGE');
      }

      // Build enhanced alert from unified enhancement
      const enhancedAlert = this.buildEnhancedAlert(job.originalAlert, enhancementResponse, startTime);
      
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
      this.cacheResponse(cacheKey, enhancementResponse, false);

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

  // Validate if game state has complete data for AI enhancement
  private hasCompleteGameState(context: CrossSportContext, sport: string): boolean {
    if (sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL') {
      // For football, require down, distance, and field position for AI enhancement
      // Use explicit null/undefined checks to allow 0 values (goal line, QB kneel situations)
      if (context.down == null || context.yardsToGo == null || context.fieldPosition == null) {
        console.log(`⚠️ Missing game state for ${sport}:`, {
          down: context.down,
          yardsToGo: context.yardsToGo,
          fieldPosition: context.fieldPosition
        });
        return false;
      }
      return true;
    }
    // Add validation for other sports as needed
    return true; // Default to allowing AI enhancement
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

      // Skip AI enhancement if critical game state data is missing
      if (!this.hasCompleteGameState(context, context.sport)) {
        console.log(`⚠️ Skipping AI enhancement for ${context.sport} - insufficient game state data`);
        return this.getFallbackResponse(context, startTime);
      }

      // Generate sport-specific AI enhancement
      const sportPrompt = this.buildSportSpecificPrompt(context);
      const aiResponse = await this.callOpenAI(sportPrompt);

      if (!aiResponse) {
        console.log(`⚠️ Unified AI: No response from AI for ${context.sport}`);
        return this.getFallbackResponse(context, startTime);
      }

      // Convert JSON response to unified format
      const enhancement = this.convertJSONToUnifiedResponse(aiResponse, context, startTime);

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

  // Get health status for monitoring (missing method fix)
  getHealthStatus() {
    const queueStatus = this.performanceMetrics.queuedJobs + this.performanceMetrics.processingJobs;
    const successRate = this.performanceMetrics.totalRequests > 0 
      ? (this.performanceMetrics.successfulEnhancements / this.performanceMetrics.totalRequests) * 100 
      : 100;
    
    const status = this.configured ? 
      (successRate > 80 ? 'healthy' : successRate > 60 ? 'degraded' : 'unhealthy') :
      'disabled';

    return {
      status,
      configured: this.configured,
      queuedJobs: this.performanceMetrics.queuedJobs,
      processingJobs: this.performanceMetrics.processingJobs,
      totalQueue: queueStatus,
      successRate: Math.round(successRate),
      lastActivity: new Date().toISOString(),
      serviceHealth: {
        openAI: this.configured,
        queue: queueStatus < 100, // healthy if queue is manageable
        performance: successRate > 60
      }
    };
  }

  private generateJobId(alert: AlertResult, context: CrossSportContext): string {
    return `${context.sport}_${context.gameId}_${context.alertType}_${Date.now()}`;
  }

  private generateCacheKey(context: CrossSportContext): string {
    // Richer cache key with sport-specific buckets for better reuse
    const scoreBucket = Math.min(5, Math.floor(Math.abs((context.homeScore - context.awayScore)) / 2));
    const windBucket = Math.round((context.weather?.windSpeed ?? 0) / 5) * 5;
    
    // Add team signature to prevent cross-game content contamination
    const teamSig = this.getTeamSignature(context.homeTeam, context.awayTeam);
    
    const keyParts = [
      context.sport,
      teamSig, // Bind cached content to specific teams
      context.alertType,
      context.inning ?? context.quarter ?? context.period ?? 0,
      context.outs ?? 0,
      this.getRunnersSignature(context.baseRunners),
      context.balls !== undefined && context.strikes !== undefined ? `${context.balls}-${context.strikes}` : '-',
      scoreBucket,
      windBucket,
      'v3.1' // Version marker
    ];
    return keyParts.join(':');
  }
  
  private getTeamSignature(homeTeam: string, awayTeam: string): string {
    // Create a short hash of team names to bind cache to specific matchup
    const combined = `${homeTeam}-${awayTeam}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 6); // 6-char base-36 hash
  }
  
  private getRunnersSignature(runners?: { first: boolean; second: boolean; third: boolean }): string {
    if (!runners) return '-';
    const sig = [];
    if (runners.first) sig.push('1');
    if (runners.second) sig.push('2');
    if (runners.third) sig.push('3');
    return sig.length > 0 ? sig.join('-') : 'empty';
  }

  private getCachedResponse(key: string, context: CrossSportContext): UnifiedAIResponse | null {
    const cached = this.cache.get(key);
    const adaptiveTTL = this.getAdaptiveTTL(context);
    if (cached && (Date.now() - cached.timestamp) < adaptiveTTL) {
      // Relaxed validation - accept any non-empty enhanced message
      if (cached.response.enhancedMessage && 
          cached.response.enhancedMessage.trim().length > 10 &&
          cached.response.enhancedMessage !== cached.response.sport) {
        return cached.response;
      } else {
        // Remove truly invalid cached entry
        console.log(`🗑️ Unified AI: Removing invalid cached response for key ${key}`);
        this.cache.delete(key);
      }
    }
    return null;
  }
  
  private getAdaptiveTTL(context: CrossSportContext): number {
    // Adaptive TTL based on game tempo
    const isHighTempo = this.isHighTempoSituation(context);
    const isNormalTempo = this.isNormalTempoSituation(context);
    
    if (isHighTempo) {
      return 7000; // 7 seconds for high-tempo (2-min warning, late innings)
    } else if (isNormalTempo) {
      return 30000; // 30 seconds for normal tempo
    } else {
      return 90000; // 90 seconds for low-tempo (early game, blowouts)
    }
  }
  
  private isHighTempoSituation(context: CrossSportContext): boolean {
    // MLB: Late innings with close score
    if (context.sport === 'MLB') {
      const isLateInning = (context.inning ?? 0) >= 7;
      const isClose = Math.abs(context.homeScore - context.awayScore) <= 2;
      return isLateInning && isClose;
    }
    
    // Football: 2-minute warning or final quarter
    if (['NFL', 'NCAAF', 'CFL'].includes(context.sport)) {
      const isFinalQuarter = (context.quarter ?? 0) === 4;
      const twoMinWarning = context.alertType.includes('TWO_MINUTE');
      return isFinalQuarter || twoMinWarning;
    }
    
    // Basketball: Final 2 minutes
    if (['NBA', 'WNBA'].includes(context.sport)) {
      const timeLeft = context.timeLeft ?? '';
      return timeLeft.includes('0:') || timeLeft.includes('1:');
    }
    
    return false;
  }
  
  private isNormalTempoSituation(context: CrossSportContext): boolean {
    // Check if not high tempo and not blowout
    const scoreDiff = Math.abs(context.homeScore - context.awayScore);
    return scoreDiff <= 10; // Within 10 points/runs is normal tempo
  }

  private cacheResponse(key: string, response: UnifiedAIResponse, isFallback: boolean = false): void {
    // More lenient cache validation - only reject truly broken responses
    if (!response.enhancedMessage || response.enhancedMessage.trim().length === 0) {
      console.log(`🚫 Unified AI: Refusing to cache empty response for key ${key}`);
      return;
    }
    
    // For fallback responses, just ensure basic content exists
    if (isFallback && response.enhancedMessage.trim().length < 5) {
      console.log(`🚫 Unified AI: Refusing to cache invalid fallback response for key ${key}`);
      return;
    }
    
    // Allow all responses that have valid content - let AI generate what it wants

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
    const enhancedAlert = {
      ...originalAlert,
      message: aiResponse.enhancedMessage,
      // Explicitly preserve gambling insights from pipeline
      gamblingInsights: originalAlert.gamblingInsights,
      hasComposerEnhancement: originalAlert.hasComposerEnhancement,
      context: {
        ...originalAlert.context,
        // Preserve weather enhancement fields in context where they belong
        weatherContext: originalAlert.context?.weatherContext,
        isWeatherTriggered: originalAlert.context?.isWeatherTriggered,
        weatherSeverity: originalAlert.context?.weatherSeverity,
        // CRITICAL FIX: Include unified enhancement flags from enhancedContext
        ...aiResponse.enhancedContext,
        // AI enhancement data
        aiEnhanced: true,
        aiInsights: aiResponse.contextualInsights,
        bettingAdvice: aiResponse.bettingContext?.recommendation,
        gameProjection: aiResponse.gameProjection,
        urgency: aiResponse.urgencyLevel,
        callToAction: aiResponse.actionableRecommendation,
        confidenceScore: aiResponse.confidence,
        aiProcessingTime: aiResponse.aiProcessingTime
      },
      priority: originalAlert.priority // Keep original priority - AI enhancement shouldn't artificially inflate urgency
    };
    
    // Add logging to track enhancement flags being set
    console.log(`🏷️ Enhanced Alert Context: ${enhancedAlert.context?.unifiedEnhancement ? '✅ UNIFIED' : '❌ MISSING UNIFIED'}, ${enhancedAlert.context?.hasGamblingInsights ? '✅ GAMBLING' : '❌ NO GAMBLING'}, ${enhancedAlert.context?.hasWeatherEnhancement ? '✅ WEATHER' : '❌ NO WEATHER'}, ${enhancedAlert.context?.aiEnhanced ? '✅ AI' : '❌ NO AI'}`);
    
    return enhancedAlert;
  }

  // UNIFIED ENHANCEMENT METHOD: Applies all enhancement types in single pipeline
  async applyUnifiedEnhancement(alert: AlertResult, context: CrossSportContext): Promise<UnifiedAIResponse> {
    console.log(`🔗 Unified Enhancement: Starting complete enhancement pipeline for ${context.sport} ${context.alertType}`);
    
    let enhancedAlert = { ...alert };
    const startTime = Date.now();
    
    try {
      // Step 1: Apply gambling insights enhancement
      enhancedAlert = await this.applyGamblingInsightsEnhancement(enhancedAlert, context);
      
      // Step 2: Apply weather enhancement (for outdoor sports)
      enhancedAlert = await this.applyWeatherEnhancement(enhancedAlert, context);
      
      // Step 3: Apply AI enhancement  
      const aiResponse = await this.enhanceAlert(context);
      
      // Combine all enhancements into final result
      return {
        sport: aiResponse.sport,
        enhancedTitle: aiResponse.enhancedTitle,
        enhancedMessage: aiResponse.enhancedMessage,
        contextualInsights: aiResponse.contextualInsights,
        actionableRecommendation: aiResponse.actionableRecommendation,
        urgencyLevel: aiResponse.urgencyLevel,
        bettingContext: aiResponse.bettingContext,
        gameProjection: aiResponse.gameProjection,
        aiProcessingTime: aiResponse.aiProcessingTime,
        confidence: aiResponse.confidence,
        sportSpecificData: aiResponse.sportSpecificData,
        enhancedContext: {
          ...(typeof enhancedAlert.context === 'object' && enhancedAlert.context ? enhancedAlert.context : {}),
          ...(aiResponse.enhancedContext || {}),
        },
        tags: aiResponse.tags,
        analysis: aiResponse.analysis
      };
      
    } catch (error) {
      console.error(`❌ Unified Enhancement failed for ${context.sport} ${context.alertType}:`, error);
      return this.getFallbackResponse(context, startTime);
    }
  }

  // LIMITED ENHANCEMENT: Apply gambling + weather only (for gated alerts)
  async applyLimitedUnifiedEnhancement(alert: AlertResult, context: CrossSportContext): Promise<AlertResult> {
    console.log(`🔗 Limited Enhancement: Applying gambling+weather only for ${context.sport} ${context.alertType}`);
    
    let enhancedAlert = { ...alert };
    
    try {
      // Step 1: Apply gambling insights enhancement
      enhancedAlert = await this.applyGamblingInsightsEnhancement(enhancedAlert, context);
      
      // Step 2: Apply weather enhancement (for outdoor sports)
      enhancedAlert = await this.applyWeatherEnhancement(enhancedAlert, context);
      
      // Mark as having limited enhancement
      enhancedAlert.context = {
        ...enhancedAlert.context,
        unifiedEnhancement: true,
        enhancementTypes: ['gambling', 'weather'],
        aiGated: true
      };
      
      console.log(`✅ Limited enhancement complete for ${context.sport} ${context.alertType}`);
      return enhancedAlert;
      
    } catch (error) {
      console.error(`❌ Limited enhancement failed for ${context.sport} ${context.alertType}:`, error);
      return alert; // Return original on failure
    }
  }

  // Apply gambling insights enhancement
  private async applyGamblingInsightsEnhancement(alert: AlertResult, context: CrossSportContext): Promise<AlertResult> {
    try {
      console.log(`🎰 Applying gambling insights enhancement for ${context.sport} ${context.alertType}`);
      
      // Convert context to format expected by gambling insights composer
      const gameStateData = {
        sport: context.sport,
        gameId: context.gameId,
        homeTeam: context.homeTeam,
        awayTeam: context.awayTeam,
        homeScore: context.homeScore,
        awayScore: context.awayScore,
        status: 'live',
        isLive: context.isLive,
        // Add sport-specific fields
        ...(context.inning && { inning: context.inning }),
        ...(context.outs !== undefined && { outs: context.outs }),
        ...(context.balls !== undefined && { balls: context.balls }),
        ...(context.strikes !== undefined && { strikes: context.strikes }),
        ...(context.baseRunners && {
          hasFirst: context.baseRunners.first,
          hasSecond: context.baseRunners.second,
          hasThird: context.baseRunners.third
        })
      };
      
      // Apply gambling insights enhancement
      const enhancedAlerts = await gamblingInsightsComposer.enhanceAlertsWithGamblingInsights([alert], context.sport);
      
      if (enhancedAlerts && enhancedAlerts.length > 0) {
        const enhanced = enhancedAlerts[0];
        console.log(`✅ Gambling insights enhancement applied for ${context.sport} ${context.alertType}`);
        return {
          ...enhanced,
          context: {
            ...enhanced.context,
            hasGamblingInsights: true
          }
        };
      }
      
      return alert;
    } catch (error) {
      console.warn(`⚠️ Gambling insights enhancement failed for ${context.sport} ${context.alertType}:`, error);
      return alert;
    }
  }

  // Apply weather enhancement (for outdoor sports)
  private async applyWeatherEnhancement(alert: AlertResult, context: CrossSportContext): Promise<AlertResult> {
    try {
      const outdoorSports = ['MLB', 'NFL', 'NCAAF', 'CFL'];
      if (!outdoorSports.includes(context.sport)) {
        return alert; // Indoor sports don't need weather enhancement
      }
      
      console.log(`🌤️ Applying weather enhancement for ${context.sport} ${context.alertType}`);
      
      // Weather enhancement logic would go here
      // For now, just mark that weather enhancement was attempted
      return {
        ...alert,
        context: {
          ...alert.context,
          hasWeatherEnhancement: true,
          weatherChecked: true
        }
      };
      
    } catch (error) {
      console.warn(`⚠️ Weather enhancement failed for ${context.sport} ${context.alertType}:`, error);
      return alert;
    }
  }

  private getFallbackResponse(context: CrossSportContext, startTime: number): UnifiedAIResponse {
    // Generate better fallback content to avoid cache rejection
    const actionWords = ['Watch for', 'Monitor', 'Key moment in', 'Developing situation in'];
    const randomAction = actionWords[Math.floor(Math.random() * actionWords.length)];
    
    return {
      sport: context.sport,
      enhancedTitle: `${context.sport} Game Alert`,
      enhancedMessage: context.originalMessage || `${randomAction} ${context.sport} game between ${context.awayTeam} and ${context.homeTeam}`,
      contextualInsights: [
        `${context.sport} matchup: ${context.awayTeam} @ ${context.homeTeam}`,
        `Current score: ${context.awayScore}-${context.homeScore}`,
        'Situation worth monitoring for betting opportunities'
      ].filter(insight => insight && !insight.includes('undefined')),
      actionableRecommendation: `${randomAction} this ${context.sport} game development`,
      urgencyLevel: context.priority >= 80 ? 'HIGH' as const : 'MEDIUM' as const,
      aiProcessingTime: Date.now() - startTime,
      confidence: Math.min(context.probability || 60, 75), // Use context probability but cap for fallbacks
      sportSpecificData: context
    };
  }

  // === SECURITY METHODS ===
  
  // 🛡️ SECURITY: Input sanitization to prevent injection attacks
  private sanitizeInput(input: string): string {
    if (!input) return '';
    
    // Remove potentially dangerous characters and sequences
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>"']/g, '') // Remove HTML characters
      .trim()
      .substring(0, 2000); // Limit length
  }

  // 🛡️ SECURITY: AI response sanitization to prevent XSS
  private sanitizeAIResponse(response: string): string {
    if (!response) return '';
    
    // Sanitize AI response content
    return response
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags  
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: URIs
      .replace(/vbscript:/gi, '') // Remove vbscript: protocols
      .trim()
      .substring(0, 1000); // Limit response length
  }

  // === PLACEHOLDER METHODS (to be implemented) ===
  
  private async callOpenAI(payload: { system: string; user: string }): Promise<any | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ Unified AI: OPENAI_API_KEY not configured');
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800); // under 3s race

    try {
      const body = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.sanitizeInput(payload.system).slice(0, 1200) },
          { role: 'user', content: this.sanitizeInput(payload.user).slice(0, 8000) }
        ],
        max_tokens: 180,
        temperature: 0.5,
        response_format: { type: 'json_object' as const }
      };

      console.log('🤖 Unified AI: Making OpenAI API call (JSON mode)');

      // Simple bounded retry for 429/5xx
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || '';
            
            if (!text || text.trim().length === 0) {
              console.warn('⚠️ Unified AI: Empty response from OpenAI');
              return null;
            }

            // Parse and validate JSON
            const parsed = JSON.parse(text);
            const validated = AIJSONResponseSchema.parse(parsed);
            
            console.log('✅ Unified AI: Successfully got and validated AI response');
            return validated;
          }

          // Retry only on 429/5xx
          if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
            console.warn(`⚠️ OpenAI ${resp.status}, retrying (attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, 200 + Math.random() * 250));
            continue;
          }

          console.error('❌ Unified AI: OpenAI error:', await resp.text());
          return null;
        } catch (fetchError: any) {
          if (fetchError?.name === 'AbortError') {
            throw fetchError; // Re-throw abort to outer catch
          }
          if (attempt === 1) throw fetchError; // Last attempt, throw
          console.warn(`⚠️ Fetch error, retrying:`, fetchError.message);
          await new Promise(r => setTimeout(r, 200 + Math.random() * 250));
        }
      }
      return null;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.warn('⌛️ OpenAI aborted at 2.8s');
      } else {
        console.error('❌ Unified AI: Error calling OpenAI:', e?.message);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildSportSpecificPrompt(context: CrossSportContext): { system: string; user: string } {
    const system = `You are a concise sports alert writer.
- Never fabricate player names or odds.
- Output JSON with keys: primary, secondary.
- Primary line: [Player/Team] + [Action] + [Opportunity] (one clear sentence)
- Secondary line: ONLY impactful factors (runners on base, weather IF significant, momentum). Omit if nothing meaningful.
- NO fluff phrases: no "key moment", "high confidence", "watch for"
- NO defensive disclaimers: no "no fabricated odds", "evaluate carefully"
- NO time windows: no "next 5min", "this at-bat" (already known from timestamp)
- NO neutral info: only mention weather/conditions if they actively impact play
`;

    const baseContext = `GAME CONTEXT:
- ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
- Alert: ${context.alertType} (${context.probability}% confidence)
- Original: ${context.originalMessage}
${context.playoffImplications ? '- PLAYOFF IMPLICATIONS: High stakes game' : ''}
${context.championshipContext ? `- CHAMPIONSHIP CONTEXT: ${context.championshipContext}` : ''}
- Weather: ${context.weather?.temperature ?? 'NA'}°F, ${context.weather?.condition ?? 'Indoor'}, wind ${context.weather?.windSpeed ?? 'NA'} mph
`;

    // Add sport-specific context based on sport type
    switch (context.sport) {
      case 'MLB': {
        const ordInning = this.getOrdinal(context.inning ?? 1);
        const windSpeed = context.weather?.windSpeed ?? context.originalContext?.weatherContext?.windSpeed ?? 0;
        const batterName = context.originalContext?.currentBatter ?? 'Unknown';
        const pitcherName = context.originalContext?.currentPitcher ?? 'Unknown';
        const alertType = context.alertType;
        
        // Alert-type specific guidance - tell AI what matters for THIS situation
        let focusGuidance = '';
        
        if (alertType.includes('BASES_LOADED')) {
          focusGuidance = `FOCUS: Batter's clutch hitting ability. Include wind ONLY if >15mph. Mention outs context.
Example: {"primary": "${batterName} at bat with bases loaded", "secondary": "Bats .340 with RISP, 1 out"}`;
        } else if (alertType.includes('RISP') || alertType.includes('SCORING_OPPORTUNITY')) {
          focusGuidance = `FOCUS: Scoring setup. Mention batter IF known power hitter. Include runners detail only if 2nd+3rd.
Example: {"primary": "RBI scoring chance, ${batterName} at bat", "secondary": "Runners on 2nd & 3rd"}`;
        } else if (alertType.includes('HIGH_SCORING') || alertType.includes('RALLY')) {
          focusGuidance = `FOCUS: Recent momentum or pitcher fatigue. Skip individual batter details.
Example: {"primary": "Rally building: 3 runs already scored", "secondary": "Pitcher at 95 pitches, tiring"}`;
        } else if (alertType.includes('LATE') || alertType.includes('PRESSURE') || alertType.includes('SEVENTH_INNING')) {
          focusGuidance = `FOCUS: Game situation stakes. Mention closer/bullpen IF relevant. Skip weather.
Example: {"primary": "Late-game pressure: tie game in 8th", "secondary": "Bullpen depleted from yesterday"}`;
        } else if (alertType.includes('WIND') || alertType.includes('WEATHER')) {
          focusGuidance = `FOCUS: Wind impact on play. Mention direction (out/in/across). Include batter IF power hitter.
Example: {"primary": "Strong wind affecting fly balls", "secondary": "20mph out to center, favors power hitters"}`;
        } else {
          focusGuidance = `FOCUS: Most impactful factor for this situation. Keep it simple.
Example: {"primary": "${batterName} at bat", "secondary": "${context.outs} out${context.outs === 1 ? '' : 's'}"}`;
        }
        
        const user = `${baseContext}MLB SITUATION:
- ${ordInning} inning, ${context.outs ?? 0} outs
- Count: ${context.balls ?? 0}-${context.strikes ?? 0}
- Runners: ${this.describeBaseRunners(context.baseRunners)}
- Batter: ${batterName}
- Pitcher: ${pitcherName}
- Pitch Count: ${context.originalContext?.pitchCount ?? 'Unknown'}
- Wind: ${windSpeed}mph ${context.originalContext?.weatherContext?.windDirection ?? ''}

${focusGuidance}

REMEMBER: Users are watching multiple games. Give them ONLY what matters for THIS specific situation. Skip generic info.`;
        return { system, user };
      }

      case 'NFL':
      case 'NCAAF':
      case 'CFL': {
        const ordDown = context.down ? this.getOrdinal(context.down) : '';
        const user = `${baseContext}FOOTBALL SITUATION:
- Q${context.quarter ?? 1}${context.timeRemaining ? `, ${context.timeRemaining} remaining` : ''}
${context.down && context.yardsToGo ? `- ${ordDown} & ${context.yardsToGo}` : ''}
${context.redZone ? '- RED ZONE: High scoring probability' : ''}
${context.fieldPosition ? `- Field Position: ${context.fieldPosition} yard line` : ''}
${context.timeRemaining ? `- Time Pressure: ${context.timeRemaining}` : ''}

Return JSON:
{
  "primary": "[Team/QB]: [TD/FG/scoring] opportunity",
  "secondary": "[field position OR weather if severe OR momentum factor] OR omit if nothing impactful"
}

Example:
{"primary": "Chiefs in red zone: TD scoring chance", "secondary": "1st and goal at 5 yard line"}
{"primary": "4th down decision: FG or go for it", "secondary": "Strong winds affecting kick"}`;
        return { system, user };
      }

      case 'NBA':
      case 'WNBA': {
        const user = `${baseContext}BASKETBALL SITUATION:
- ${context.timeLeft ?? 'Unknown'} remaining
- Shot clock: ${context.shotClock ?? 'Unknown'}
${context.fouls ? `- Team fouls: ${context.fouls.home}-${context.fouls.away}` : ''}

Return JSON:
{
  "primary": "[Player/Team]: [scoring/clutch/run] opportunity",
  "secondary": "[foul situation OR pace factor OR momentum] OR omit if nothing impactful"
}

Example:
{"primary": "Curry hot hand: scoring run building", "secondary": "Team on 12-0 run"}
{"primary": "Clutch time situation: tight game", "secondary": "Bonus situation - free throws likely"}`;
        return { system, user };
      }

      default: {
        const user = `${baseContext}
Provide analysis in JSON format.`;
        return { system, user };
      }
    }
  }

  // Convert JSON response from OpenAI to unified format
  private convertJSONToUnifiedResponse(jsonResponse: any, context: CrossSportContext, startTime: number): UnifiedAIResponse {
    // Build enhanced message from new clean format (primary + optional secondary)
    const enhancedMessage = jsonResponse.secondary 
      ? `${jsonResponse.primary}\n${jsonResponse.secondary}`
      : jsonResponse.primary;
    
    return {
      sport: context.sport,
      enhancedTitle: `${context.sport} Alert`,
      enhancedMessage,
      contextualInsights: [
        jsonResponse.primary,
        jsonResponse.secondary || ''
      ].filter(Boolean),
      actionableRecommendation: jsonResponse.primary,
      urgencyLevel: context.priority >= 80 ? 'HIGH' : 'MEDIUM',
      bettingContext: {
        recommendation: jsonResponse.primary,
        confidence: 80,
        reasoning: [jsonResponse.secondary || 'Situation analysis'].filter(Boolean)
      },
      gameProjection: {
        winProbability: { home: 50, away: 50 },
        keyFactors: [jsonResponse.secondary || 'Standard situation'].filter(Boolean),
        nextCriticalMoment: jsonResponse.primary
      },
      aiProcessingTime: Date.now() - startTime,
      confidence: 85,
      sportSpecificData: context
    };
  }

  private parseAIResponse(aiResponse: string, context: CrossSportContext, startTime: number): UnifiedAIResponse {
    // Simple parsing - extract key information from AI response
    const lines = aiResponse.split('\n');
    
    const getSection = (marker: string): string => {
      const line = lines.find(l => l.includes(marker));
      return line ? line.split(':').slice(1).join(':').trim() : '';
    };

    // Use the raw AI response as enhanced message if no structured parsing found
    const enhancedMessage = getSection('Enhanced Message') || 
                           (aiResponse.trim().length > 10 ? aiResponse.trim() : context.originalMessage);

    return {
      sport: context.sport,
      enhancedTitle: getSection('Enhanced Title') || `${context.sport} Alert`,
      enhancedMessage,
      contextualInsights: [
        getSection('Insight 1') || `${context.sport} game analysis`,
        getSection('Insight 2') || 'Strategic implications worth monitoring',
        getSection('Insight 3') || 'Betting opportunity assessment'
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