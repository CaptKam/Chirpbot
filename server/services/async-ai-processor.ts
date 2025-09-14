import { CrossSportAIEnhancement, CrossSportContext, CrossSportAIResponse } from './cross-sport-ai-enhancement';
import { AlertResult } from './engines/base-engine';

interface AsyncAIJob {
  id: string;
  alertId: string;
  context: CrossSportContext;
  originalAlert: AlertResult;
  timestamp: number;
  userId: string;
  sport: string;
  retries: number;
}

interface AsyncAIResult {
  jobId: string;
  alertId: string;
  enhancedAlert: AlertResult;
  processingTime: number;
  processedAt: number; // Timestamp when processing completed (for cache TTL)
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
  wasActuallyEnhanced: boolean; // Whether AI was actually applied vs gated
  hasComposerEnhancement?: boolean; // Whether AlertComposer was used
}

export class AsyncAIProcessor {
  private crossSportAI: CrossSportAIEnhancement;
  private jobQueue: Map<string, AsyncAIJob> = new Map();
  private processingQueue: Set<string> = new Set();
  private results: Map<string, AsyncAIResult> = new Map();
  private readonly AI_TIMEOUT_MS = 8000; // 8 second timeout for AI processing
  private readonly MAX_RETRIES = 1;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly RESULT_TTL = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  
  private performanceMetrics = {
    totalJobs: 0,
    completedJobs: 0,
    timeoutJobs: 0,
    failedJobs: 0,
    avgProcessingTime: [] as number[],
    queuedJobs: 0,
    processingJobs: 0,
    cacheHits: 0,
    cacheMisses: 0,
    gatedAlerts: 0, // Alerts that were filtered out by gating
    highValueAlerts: 0 // High-value alerts that received AI enhancement
  };

  // High-value alert types that benefit most from AI enhancement (V3-17 Gating)
  private highValueAlertTypes: Record<string, string[]> = {
    'MLB': [
      'MLB_GAME_START',
      'MLB_BASES_LOADED_NO_OUTS',
      'MLB_BASES_LOADED_ONE_OUT', 
      'MLB_FIRST_AND_THIRD_NO_OUTS',
      'MLB_RUNNER_ON_THIRD_NO_OUTS',
      'MLB_SECOND_AND_THIRD_NO_OUTS',
      'MLB_RUNNER_ON_THIRD_ONE_OUT',
      'MLB_SECOND_AND_THIRD_ONE_OUT',
      'MLB_SEVENTH_INNING_STRETCH',
      'MLB_BATTER_DUE',
      'MLB_STEAL_LIKELIHOOD',
      'MLB_LATE_INNING_CLOSE',
      'MLB_FIRST_AND_SECOND',
      'MLB_SCORING_OPPORTUNITY',
      'MLB_PITCHING_CHANGE',
      'MLB_FIRST_AND_THIRD_ONE_OUT',
      'MLB_FIRST_AND_THIRD_TWO_OUTS',
      'MLB_RUNNER_ON_THIRD_TWO_OUTS',
      'MLB_BASES_LOADED_TWO_OUTS',
      'MLB_ON_DECK_PREDICTION',
      'MLB_WIND_CHANGE',
      'MLB_GAME_END',
      'MLB_SCORING_CHANGE',
      'MLB_MOMENTUM_SHIFT'
    ],
    'NFL': [
      'NFL_RED_ZONE',
      'NFL_FOURTH_DOWN',
      'NFL_TWO_MINUTE_WARNING',
      'NFL_RED_ZONE_OPPORTUNITY',
      'NFL_GOAL_LINE_STAND',
      'NFL_OVERTIME',
      'NFL_GAME_START',
      'NFL_SCORING_CHANGE',
      'NFL_TOUCHDOWN',
      'NFL_FIELD_GOAL_ATTEMPT',
      'NFL_TURNOVER',
      'NFL_THIRD_DOWN',
      'NFL_HALFTIME',
      'NFL_FIRST_DOWN',
      'NFL_GAME_END',
      'NFL_MOMENTUM_SHIFT',
      'NFL_COMEBACK_ALERT'
    ],
    'NBA': [
      'NBA_CLUTCH_PERFORMANCE',
      'NBA_FINAL_MINUTES',
      'NBA_OVERTIME',
      'NBA_TWO_MINUTE_WARNING',
      'NBA_GAME_WINNER_OPPORTUNITY',
      'NBA_GAME_START',
      'NBA_HALFTIME',
      'NBA_SCORING_RUN',
      'NBA_MOMENTUM_SHIFT',
      'NBA_BUZZER_BEATER',
      'NBA_FREE_THROW_SITUATION',
      'NBA_TIMEOUT',
      'NBA_TECHNICAL_FOUL',
      'NBA_GAME_END',
      'NBA_QUARTER_END',
      'NBA_COMEBACK_ALERT'
    ],
    'NCAAF': [
      'NCAAF_RED_ZONE_EFFICIENCY',
      'NCAAF_FOURTH_DOWN_DECISION',
      'NCAAF_TWO_MINUTE_WARNING',
      'NCAAF_OVERTIME',
      'NCAAF_GOAL_LINE',
      'NCAAF_GAME_START',
      'NCAAF_HALFTIME',
      'NCAAF_SCORING_CHANGE',
      'NCAAF_TURNOVER',
      'NCAAF_THIRD_DOWN',
      'NCAAF_FIELD_GOAL_ATTEMPT',
      'NCAAF_TOUCHDOWN',
      'NCAAF_GAME_END',
      'NCAAF_MOMENTUM_SHIFT',
      'NCAAF_COMEBACK_ALERT'
    ],
    'CFL': [
      'CFL_ROUGE_OPPORTUNITY',
      'CFL_TWO_MINUTE_WARNING',
      'CFL_OVERTIME',
      'CFL_FOURTH_DOWN',
      'CFL_GAME_START',
      'CFL_HALFTIME',
      'CFL_RED_ZONE',
      'CFL_THIRD_DOWN',
      'CFL_SCORING_CHANGE',
      'CFL_TURNOVER',
      'CFL_FIELD_GOAL_ATTEMPT',
      'CFL_TOUCHDOWN',
      'CFL_GAME_END',
      'CFL_MOMENTUM_SHIFT'
    ],
    'WNBA': [
      'WNBA_CLUTCH_TIME_OPPORTUNITY',
      'WNBA_FINAL_MINUTES',
      'WNBA_TWO_MINUTE_WARNING',
      'WNBA_OVERTIME',
      'WNBA_GAME_START',
      'WNBA_HALFTIME',
      'WNBA_SCORING_RUN',
      'WNBA_MOMENTUM_SHIFT',
      'WNBA_FREE_THROW_SITUATION',
      'WNBA_TIMEOUT',
      'WNBA_QUARTER_END',
      'WNBA_GAME_END',
      'WNBA_COMEBACK_ALERT',
      'WNBA_BUZZER_BEATER'
    ]
  };

  private onEnhancedAlert?: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>;

  constructor() {
    this.crossSportAI = new CrossSportAIEnhancement();
    
    // Start background cleanup
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    
    console.log(`🚀 AsyncAIProcessor: Initialized with ${this.AI_TIMEOUT_MS}ms timeout`);
  }

  // Set callback for when enhanced alerts are ready
  setOnEnhancedAlert(callback: (alert: AlertResult, userId: string, sport: string, wasActuallyEnhanced: boolean) => Promise<void>) {
    this.onEnhancedAlert = callback;
  }

  // V3-17: Alert-Type-Level Gating - Check if alert qualifies for AI enhancement
  private shouldEnhanceAlert(alertType: string, sport: string, probability?: number): boolean {
    const normalizedSport = sport.toUpperCase();
    const highValueTypes = this.highValueAlertTypes[normalizedSport] || [];
    
    // Check if this is a high-value alert type
    const isHighValue = highValueTypes.includes(alertType);
    
    // Additional criteria for gating
    const meetsThreshold = !probability || probability >= 30; // Only enhance low+ probability events (0-100 scale)
    
    const shouldEnhance = isHighValue && meetsThreshold;
    
    if (shouldEnhance) {
      console.log(`🎯 AI Gating: ${normalizedSport} ${alertType} qualifies for enhancement (high-value, prob=${probability || 'N/A'})`);
      this.performanceMetrics.highValueAlerts++;
    } else {
      console.log(`🚫 AI Gating: ${normalizedSport} ${alertType} filtered out (low-value or low-prob, prob=${probability || 'N/A'})`);
      this.performanceMetrics.gatedAlerts++;
    }
    
    return shouldEnhance;
  }

  // Get high-value alert types for a specific sport
  getHighValueAlertTypes(sport: string): string[] {
    return this.highValueAlertTypes[sport.toUpperCase()] || [];
  }

  // Queue alert for asynchronous AI enhancement
  async queueAlertForEnhancement(
    alert: AlertResult, 
    context: CrossSportContext, 
    userId: string
  ): Promise<string> {
    const jobId = this.generateJobId(alert, context);
    
    // V3-17: Apply Alert-Type-Level Gating before processing
    if (!this.shouldEnhanceAlert(context.alertType, context.sport, context.probability)) {
      console.log(`🚪 AI Gating: Completely skipping alert for ${context.sport} ${context.alertType} (not high-value) - USER SEES NOTHING`);
      
      // AI OR NOTHING: Do not broadcast low-value alerts at all
      // Quality over quantity - user sees nothing rather than boring alerts
      
      return jobId; // Return job ID for tracking but don't process OR broadcast
    }
    
    // Check if we've already processed this alert recently (cache hit)
    const existingResult = this.results.get(jobId);
    if (existingResult && (Date.now() - existingResult.processedAt) < 30000) {
      console.log(`💨 AsyncAI Cache Hit: ${context.sport} ${context.alertType} (${jobId.slice(0, 8)})`);
      this.performanceMetrics.cacheHits++;
      
      // Immediately send cached enhanced alert
      if (this.onEnhancedAlert) {
        await this.onEnhancedAlert(existingResult.enhancedAlert, userId, context.sport, existingResult.wasActuallyEnhanced);
      }
      
      return jobId;
    }

    // Check queue size limit
    if (this.jobQueue.size >= this.MAX_QUEUE_SIZE) {
      console.warn(`⚠️ AsyncAI Queue Full: Dropping ${context.sport} ${context.alertType} job`);
      return jobId;
    }

    const job: AsyncAIJob = {
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
    
    console.log(`📥 AsyncAI Queued: ${context.sport} ${context.alertType} (Queue: ${this.jobQueue.size})`);
    
    // Start processing immediately (non-blocking)
    this.processJobAsync(jobId).catch(error => {
      console.error(`❌ AsyncAI Background processing failed for job ${jobId}:`, error);
    });

    this.performanceMetrics.cacheMisses++;
    return jobId;
  }

  // Process AI job asynchronously with timeout protection
  private async processJobAsync(jobId: string): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      console.warn(`⚠️ AsyncAI Job ${jobId} not found in queue`);
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
      console.log(`🧠 AsyncAI Processing: ${job.sport} ${job.context.alertType} (Timeout: ${this.AI_TIMEOUT_MS}ms)`);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI_TIMEOUT')), this.AI_TIMEOUT_MS);
      });

      // Race AI processing against timeout
      const aiResponse = await Promise.race([
        this.crossSportAI.enhanceAlert(job.context),
        timeoutPromise
      ]);

      const processingTime = Date.now() - startTime;
      
      // Check if alert already has AlertComposer enhancement
      const hasComposerEnhancement = job.originalAlert.context?.enhanced && 
                                      job.originalAlert.context?.timing && 
                                      job.originalAlert.context?.action;
      
      // AI OR NOTHING: Verify AI actually provided enhanced content
      if (!aiResponse.enhancedMessage || aiResponse.enhancedMessage.trim().length === 0) {
        console.warn(`🚫 AI Enhancement FAILED: ${job.sport} ${job.context.alertType} - No enhanced message provided - ALERT SKIPPED`);
        throw new Error('AI_ENHANCEMENT_FAILED_NO_MESSAGE');
      }

      // Build enhanced alert that preserves AlertComposer enhancements
      const enhancedAlert: AlertResult = {
        ...job.originalAlert,
        message: aiResponse.enhancedMessage, // No fallback - AI must provide message
        context: {
          ...job.originalAlert.context,
          aiEnhanced: true,
          aiInsights: aiResponse.contextualInsights,
          aiRecommendation: aiResponse.actionableRecommendation,
          urgencyLevel: aiResponse.urgencyLevel,
          bettingContext: aiResponse.bettingContext,
          confidence: aiResponse.confidence,
          sportSpecificData: aiResponse.sportSpecificData,
          processingTime: aiResponse.aiProcessingTime,
          asyncProcessed: true,
          asyncJobId: jobId,
          // Preserve AlertComposer enhancements if present
          ...(hasComposerEnhancement ? {
            enhanced: job.originalAlert.context.enhanced,
            timing: job.originalAlert.context.timing,
            action: job.originalAlert.context.action,
            insight: job.originalAlert.context.insight,
            riskReward: job.originalAlert.context.riskReward,
            displayText: job.originalAlert.context.displayText,
            mobileText: job.originalAlert.context.mobileText
          } : {}),
          // Combine insights if both exist
          combinedInsight: hasComposerEnhancement && aiResponse.contextualInsights
            ? `${job.originalAlert.context.insight?.keyFactor || ''} | AI: ${aiResponse.contextualInsights}`
            : aiResponse.contextualInsights || job.originalAlert.context.insight?.keyFactor
        }
      };

      // Store result
      const result: AsyncAIResult = {
        jobId,
        alertId: job.alertId,
        enhancedAlert,
        processingTime,
        processedAt: Date.now(),
        status: 'completed',
        wasActuallyEnhanced: true,
        hasComposerEnhancement
      };
      
      this.results.set(jobId, result);
      this.performanceMetrics.completedJobs++;
      this.performanceMetrics.avgProcessingTime.push(processingTime);
      
      console.log(`✅ AsyncAI Completed: ${job.sport} ${job.context.alertType} in ${processingTime}ms`);

      // Send enhanced alert via callback (WebSocket broadcast)
      if (this.onEnhancedAlert) {
        await this.onEnhancedAlert(enhancedAlert, job.userId, job.sport, true);
      }

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      if (error.message === 'AI_TIMEOUT') {
        console.warn(`⏱️ AsyncAI Timeout: ${job.sport} ${job.context.alertType} after ${processingTime}ms - ALERT SKIPPED`);
        this.performanceMetrics.timeoutJobs++;
        
        // Store result for tracking but don't broadcast alert
        this.results.set(jobId, {
          jobId,
          alertId: job.alertId,
          enhancedAlert: job.originalAlert, // Keep for tracking only - not broadcasted
          processingTime,
          processedAt: Date.now(),
          status: 'timeout',
          error: 'AI processing timeout - alert skipped',
          wasActuallyEnhanced: false
        });
        
        console.log(`🚫 Mandatory AI: Skipping ${job.sport} ${job.context.alertType} due to timeout (quality over quantity)`);
        // No callback - alert is completely skipped
      } else {
        console.error(`❌ AsyncAI Failed: ${job.sport} ${job.context.alertType} after ${processingTime}ms:`, error);
        this.performanceMetrics.failedJobs++;
        
        // Retry logic
        if (job.retries < this.MAX_RETRIES) {
          job.retries++;
          console.log(`🔄 AsyncAI Retry: ${job.sport} ${job.context.alertType} (Attempt ${job.retries + 1})`);
          
          // Re-queue with delay
          setTimeout(() => {
            this.processJobAsync(jobId).catch(retryError => {
              console.error(`❌ AsyncAI Retry failed for job ${jobId}:`, retryError);
            });
          }, 1000);
          
          return; // Don't clean up yet
        }
        
        // After all retries failed - skip the alert entirely
        console.warn(`🚫 Mandatory AI: Skipping ${job.sport} ${job.context.alertType} after ${job.retries + 1} attempts - ALERT SKIPPED`);
        
        this.results.set(jobId, {
          jobId,
          alertId: job.alertId,
          enhancedAlert: job.originalAlert, // Keep for tracking only - not broadcasted
          processingTime,
          processedAt: Date.now(),
          status: 'failed',
          error: `AI enhancement failed after ${job.retries + 1} attempts - alert skipped`,
          wasActuallyEnhanced: false
        });
        
        console.log(`🚫 Mandatory AI: Quality over quantity - failed alert will not be shown to users`);
        // No callback - alert is completely skipped
      }
    } finally {
      // Clean up job
      this.jobQueue.delete(jobId);
      this.processingQueue.delete(jobId);
      this.performanceMetrics.queuedJobs = this.jobQueue.size;
      this.performanceMetrics.processingJobs = this.processingQueue.size;
    }
  }

  // Generate consistent job ID for caching
  private generateJobId(alert: AlertResult, context: CrossSportContext): string {
    const data = `${context.sport}-${context.alertType}-${context.gameId}-${context.probability}-${context.quarter}-${context.homeScore}-${context.awayScore}`;
    return Buffer.from(data).toString('base64').slice(0, 16);
  }

  // Get processing status for a job
  getJobStatus(jobId: string): 'queued' | 'processing' | 'completed' | 'failed' | 'timeout' | 'not_found' {
    if (this.results.has(jobId)) {
      return this.results.get(jobId)!.status;
    }
    if (this.processingQueue.has(jobId)) {
      return 'processing';
    }
    if (this.jobQueue.has(jobId)) {
      return 'queued';
    }
    return 'not_found';
  }

  // Get performance metrics
  getPerformanceMetrics() {
    const avgTime = this.performanceMetrics.avgProcessingTime.length > 0
      ? this.performanceMetrics.avgProcessingTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.avgProcessingTime.length
      : 0;

    return {
      ...this.performanceMetrics,
      avgProcessingTime: Math.round(avgTime),
      successRate: this.performanceMetrics.totalJobs > 0 
        ? Math.round((this.performanceMetrics.completedJobs / this.performanceMetrics.totalJobs) * 100)
        : 0,
      timeoutRate: this.performanceMetrics.totalJobs > 0
        ? Math.round((this.performanceMetrics.timeoutJobs / this.performanceMetrics.totalJobs) * 100) 
        : 0,
      cacheHitRate: (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) > 0
        ? Math.round((this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100)
        : 0
    };
  }

  // Cleanup old results and failed jobs
  private cleanup(): void {
    const now = Date.now();
    let cleanedResults = 0;
    let cleanedJobs = 0;

    // Clean up old results
    for (const [jobId, result] of this.results.entries()) {
      if (now - result.processedAt > this.RESULT_TTL) {
        this.results.delete(jobId);
        cleanedResults++;
      }
    }

    // Clean up stuck jobs (older than 5 minutes)
    for (const [jobId, job] of this.jobQueue.entries()) {
      if (now - job.timestamp > this.RESULT_TTL) {
        this.jobQueue.delete(jobId);
        cleanedJobs++;
      }
    }

    // Trim performance metrics arrays
    if (this.performanceMetrics.avgProcessingTime.length > 1000) {
      this.performanceMetrics.avgProcessingTime = this.performanceMetrics.avgProcessingTime.slice(-500);
    }

    if (cleanedResults > 0 || cleanedJobs > 0) {
      console.log(`🧹 AsyncAI Cleanup: Removed ${cleanedResults} results, ${cleanedJobs} jobs`);
    }
  }

  // Shutdown gracefully
  async shutdown(): Promise<void> {
    console.log(`🛑 AsyncAI Shutdown: ${this.jobQueue.size} jobs queued, ${this.processingQueue.size} processing`);
    
    // Wait for current processing jobs to complete (with timeout)
    const shutdownTimeout = 5000; // 5 seconds
    const shutdownStart = Date.now();
    
    while (this.processingQueue.size > 0 && (Date.now() - shutdownStart) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ AsyncAI Shutdown Complete`);
  }
}

// Export singleton instance
export const asyncAIProcessor = new AsyncAIProcessor();