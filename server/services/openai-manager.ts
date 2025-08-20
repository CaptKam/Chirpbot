import OpenAI from "openai";

interface OpenAICallLog {
  timestamp: Date;
  type: 'alert_analysis' | 'prediction' | 'general';
  endpoint: string;
  model: string;
  prompt?: string;
  response?: any;
  error?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
  cost?: number;
  cacheHit: boolean;
  sport?: string;
  context?: any;
}

interface OpenAIStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  cachedResponses: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  quotaExceeded: boolean;
  lastQuotaCheck: Date;
}

export class OpenAIManager {
  private static instance: OpenAIManager;
  private openai: OpenAI;
  private callLogs: OpenAICallLog[] = [];
  private stats: OpenAIStats;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds - shorter for fresh analysis
  private readonly MAX_LOGS = 1000; // Keep last 1000 logs
  private quotaAvailable = true;
  private lastQuotaCheck = 0;
  private readonly QUOTA_CHECK_INTERVAL = 60000; // 1 minute

  // Token cost per 1000 tokens (approximate)
  private readonly TOKEN_COSTS = {
    'gpt-4o': { prompt: 0.005, completion: 0.015 },
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 }
  };

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 8000,
      maxRetries: 1
    });

    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cachedResponses: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatency: 0,
      errorRate: 0,
      quotaExceeded: false,
      lastQuotaCheck: new Date()
    };

    console.log('🤖 OpenAI Manager initialized - Centralized API management active');
  }

  static getInstance(): OpenAIManager {
    if (!OpenAIManager.instance) {
      OpenAIManager.instance = new OpenAIManager();
    }
    return OpenAIManager.instance;
  }

  private logCall(log: OpenAICallLog) {
    this.callLogs.push(log);
    
    // Keep only recent logs
    if (this.callLogs.length > this.MAX_LOGS) {
      this.callLogs = this.callLogs.slice(-this.MAX_LOGS);
    }

    // Update stats
    this.stats.totalCalls++;
    if (log.error) {
      this.stats.failedCalls++;
      console.error(`❌ OpenAI API Error [${log.type}]:`, log.error);
      if (log.error.includes('quota') || log.error.includes('rate limit')) {
        this.quotaAvailable = false;
        this.stats.quotaExceeded = true;
        console.warn('⚠️ OpenAI quota/rate limit reached - using fallback mechanisms');
      }
    } else {
      this.stats.successfulCalls++;
      if (log.tokens) {
        this.stats.totalTokens += log.tokens.total;
        if (log.cost) {
          this.stats.totalCost += log.cost;
        }
      }
    }

    if (log.cacheHit) {
      this.stats.cachedResponses++;
    }

    // Update average latency
    const totalLatency = this.callLogs.reduce((sum, l) => sum + (l.latency || 0), 0);
    this.stats.averageLatency = totalLatency / this.callLogs.length;
    this.stats.errorRate = (this.stats.failedCalls / this.stats.totalCalls) * 100;

    // Log summary
    console.log(`📊 OpenAI Call [${log.type}]: ${log.cacheHit ? '💾 CACHED' : '🔄 API'} | ⏱️ ${log.latency}ms | ${log.error ? '❌ ERROR' : '✅ SUCCESS'} | 🪙 ${log.tokens?.total || 0} tokens | 💰 $${(log.cost || 0).toFixed(4)}`);
  }

  private getCacheKey(type: string, params: any): string {
    return `${type}-${JSON.stringify(params)}`;
  }

  private checkCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      const now = Date.now();
      entries.forEach(([k, v]) => {
        if (now - v.timestamp > this.CACHE_TTL) {
          this.cache.delete(k);
        }
      });
    }
  }

  private checkQuotaAvailability() {
    if (!this.quotaAvailable && Date.now() - this.lastQuotaCheck > this.QUOTA_CHECK_INTERVAL) {
      this.quotaAvailable = true;
      this.lastQuotaCheck = Date.now();
      this.stats.lastQuotaCheck = new Date();
      console.log('🔄 Retrying OpenAI API - quota may be restored');
    }
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const costs = this.TOKEN_COSTS[model as keyof typeof this.TOKEN_COSTS] || this.TOKEN_COSTS['gpt-3.5-turbo'];
    return (promptTokens / 1000) * costs.prompt + (completionTokens / 1000) * costs.completion;
  }

  async analyzeAlert(
    alertType: string,
    sport: string,
    gameInfo: any,
    weatherData?: any
  ): Promise<{ context: string; confidence: number }> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey('alert', { alertType, sport, gameInfo, weatherData });
    
    // Check cache
    const cached = this.checkCache(cacheKey);
    if (cached) {
      this.logCall({
        timestamp: new Date(),
        type: 'alert_analysis',
        endpoint: 'chat.completions',
        model: 'cached',
        latency: Date.now() - startTime,
        cacheHit: true,
        sport,
        context: { alertType, gameInfo }
      });
      return cached;
    }

    // Check quota availability
    this.checkQuotaAvailability();
    
    // Prioritize high-value alerts and prediction-based alerts
    const highPriorityTypes = [
      'Runners on 2nd & 3rd, 1 Out', 
      'Runner on 3rd, 1 Out', 
      'Runners In Scoring Position',
      'Clutch Moment Prediction',
      'Buzzer Beater Prediction',
      'Three Point Opportunity'
    ];
    if (!highPriorityTypes.includes(alertType) || !this.quotaAvailable) {
      const fallback = {
        context: `${alertType} situation - monitoring for scoring opportunities`,
        confidence: 75
      };
      
      this.logCall({
        timestamp: new Date(),
        type: 'alert_analysis',
        endpoint: 'fallback',
        model: 'none',
        latency: Date.now() - startTime,
        cacheHit: false,
        sport,
        context: { alertType, gameInfo, reason: 'quota_conservation' }
      });
      
      return fallback;
    }

    try {
      const prompt = `Analyze this sports alert briefly:
      
Alert Type: ${alertType}
Sport: ${sport}  
Game: ${gameInfo.homeTeam} vs ${gameInfo.awayTeam}
Status: ${gameInfo.status}
Weather: ${weatherData ? `${weatherData.temperature}°F, ${weatherData.condition}` : 'Not available'}

Provide analysis in JSON format with 'context' (1-2 sentences max, focus on key impact) and 'confidence' (0-100) fields.`;

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a sports analyst providing brief, insightful context for live game alerts. Focus on what makes this moment significant."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 150,
          response_format: { type: "json_object" }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout')), 8000)
        )
      ]);

      const result = JSON.parse(response.choices[0].message.content || '{}');
      const usage = response.usage;
      const cost = usage ? this.calculateCost('gpt-4o', usage.prompt_tokens, usage.completion_tokens) : 0;

      this.setCache(cacheKey, result);

      this.logCall({
        timestamp: new Date(),
        type: 'alert_analysis',
        endpoint: 'chat.completions',
        model: 'gpt-4o',
        prompt,
        response: result,
        tokens: usage ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        } : undefined,
        latency: Date.now() - startTime,
        cost,
        cacheHit: false,
        sport,
        context: { alertType, gameInfo }
      });

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      
      this.logCall({
        timestamp: new Date(),
        type: 'alert_analysis',
        endpoint: 'chat.completions',
        model: 'gpt-4o',
        error: errorMessage,
        latency: Date.now() - startTime,
        cacheHit: false,
        sport,
        context: { alertType, gameInfo }
      });

      // Return fallback
      return {
        context: `${alertType} - AI analysis unavailable`,
        confidence: 60
      };
    }
  }

  async generatePredictions(
    eventTypes: string[],
    context: any,
    minimumProbability: number = 0
  ): Promise<any[]> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey('prediction', { eventTypes, context, minimumProbability });
    
    // Check cache
    const cached = this.checkCache(cacheKey);
    if (cached) {
      this.logCall({
        timestamp: new Date(),
        type: 'prediction',
        endpoint: 'chat.completions',
        model: 'cached',
        latency: Date.now() - startTime,
        cacheHit: true,
        sport: context.sport,
        context: { eventTypes }
      });
      return cached;
    }

    // Check quota
    this.checkQuotaAvailability();
    if (!this.quotaAvailable) {
      console.log('⚠️ OpenAI quota exceeded - using statistical predictions');
      return this.generateStatisticalPredictions(eventTypes, context, minimumProbability);
    }

    try {
      const prompt = this.buildPredictionPrompt(eventTypes, context);
      
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: this.getPredictionSystemPrompt()
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 800,
          response_format: { type: "json_object" }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout')), 8000)
        )
      ]);

      // Safely parse JSON response with validation
      let result;
      try {
        const content = response.choices[0].message.content || '{"predictions": []}';
        
        // Clean up any potential JSON formatting issues
        const cleanContent = content.trim();
        
        // Validate that we have proper JSON structure
        if (!cleanContent.startsWith('{')) {
          throw new Error('Invalid JSON structure: response does not start with {');
        }
        
        // Handle truncated JSON responses
        if (!cleanContent.endsWith('}')) {
          console.warn('JSON response appears truncated, attempting to fix...');
          // Find last complete object and close it
          let braceCount = 0;
          let lastValidIndex = -1;
          for (let i = 0; i < cleanContent.length; i++) {
            if (cleanContent[i] === '{') braceCount++;
            if (cleanContent[i] === '}') {
              braceCount--;
              if (braceCount === 0) lastValidIndex = i;
            }
          }
          
          if (lastValidIndex > 0) {
            const truncatedContent = cleanContent.substring(0, lastValidIndex + 1);
            console.log('Fixed truncated JSON, trying to parse:', truncatedContent.substring(0, 100) + '...');
            try {
              result = JSON.parse(truncatedContent);
            } catch {
              throw new Error('Invalid JSON structure: response truncated and could not be fixed');
            }
          } else {
            throw new Error('Invalid JSON structure: response does not appear to be valid JSON');
          }
        } else {
          result = JSON.parse(cleanContent);
        }
        
        // Validate the expected structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure: parsed result is not an object');
        }
        
        if (!Array.isArray(result.predictions)) {
          console.warn('OpenAI response missing predictions array, using empty array');
          result.predictions = [];
        }
        
      } catch (parseError: any) {
        console.error('OpenAI JSON parsing failed:', parseError.message);
        console.error('Raw response content:', response.choices[0].message.content);
        
        // Log this as a parsing error for debugging
        this.logCall({
          timestamp: new Date(),
          type: 'prediction',
          endpoint: 'chat.completions',
          model: 'gpt-4o',
          error: `JSON parsing failed: ${parseError.message}`,
          latency: Date.now() - startTime,
          cacheHit: false,
          sport: context.sport || 'unknown',
          context: { eventTypes }
        });
        
        // Return fallback predictions instead of throwing
        result = { predictions: this.generateStatisticalPredictions(eventTypes, context, minimumProbability) };
      }
      
      const predictions = result.predictions || [];
      const usage = response.usage;
      const cost = usage ? this.calculateCost('gpt-4o', usage.prompt_tokens, usage.completion_tokens) : 0;

      // Filter by minimum probability
      const filtered = predictions.filter((p: any) => p.probability >= minimumProbability);
      
      this.setCache(cacheKey, filtered);

      this.logCall({
        timestamp: new Date(),
        type: 'prediction',
        endpoint: 'chat.completions',
        model: 'gpt-4o',
        prompt,
        response: filtered,
        tokens: usage ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        } : undefined,
        latency: Date.now() - startTime,
        cost,
        cacheHit: false,
        sport: context.sport,
        context: { eventTypes, predictions: filtered.length }
      });

      return filtered;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      
      this.logCall({
        timestamp: new Date(),
        type: 'prediction',
        endpoint: 'chat.completions',
        model: 'gpt-4o',
        error: errorMessage,
        latency: Date.now() - startTime,
        cacheHit: false,
        sport: context.sport,
        context: { eventTypes }
      });

      // Fallback to statistical predictions
      return this.generateStatisticalPredictions(eventTypes, context, minimumProbability);
    }
  }

  private buildPredictionPrompt(eventTypes: string[], context: any): string {
    let prompt = `Analyze this ${context.sport} game situation and predict probabilities for specific events:

GAME CONTEXT:
- ${context.homeTeam} (Home) vs ${context.awayTeam} (Away)
- Score: ${context.homeScore} - ${context.awayScore}
- Game State: ${context.gameState}`;

    if (context.sport === 'MLB') {
      prompt += `
- Inning: ${context.inning || 'Unknown'}
- Outs: ${context.outs || 0}
- Runners: ${context.runnersOn?.join(', ') || 'None'}`;
      
      if (context.currentBatter) {
        prompt += `
- Batter: ${context.currentBatter.name} (AVG: ${context.currentBatter.stats.avg || 'N/A'}, HR: ${context.currentBatter.stats.hr || 0})`;
      }
      
      if (context.currentPitcher) {
        prompt += `
- Pitcher: ${context.currentPitcher.name} (ERA: ${context.currentPitcher.stats.era || 'N/A'})`;
      }
    }

    if (context.weather) {
      prompt += `
- Weather: ${context.weather.temperature}°F, Wind: ${context.weather.windSpeed}mph ${context.weather.windDirection}`;
    }

    prompt += `

PREDICT PROBABILITIES FOR:
${eventTypes.map(e => `- ${e}`).join('\n')}

Return JSON with "predictions" array, each containing:
- eventType: string
- probability: number (0-100)
- confidence: number (0-100) 
- reasoning: string (brief explanation)
- impact: string (game impact if occurs)
- shouldAlert: boolean`;

    return prompt;
  }

  private getPredictionSystemPrompt(): string {
    return `You are an expert sports analyst with deep knowledge of game statistics and situational probabilities.
Analyze game situations and provide realistic probability assessments based on:
- Current game state and momentum
- Player statistics and matchups
- Environmental factors
- Historical patterns

Be conservative with probabilities - most events have <30% chance.
High confidence only for very clear situations.
Consider all factors but avoid overconfidence.`;
  }

  private generateStatisticalPredictions(eventTypes: string[], context: any, minProb: number): any[] {
    // Statistical fallback when API is unavailable
    const predictions: any[] = [];
    
    for (const eventType of eventTypes) {
      let probability = 0;
      let reasoning = "Statistical average (AI unavailable)";
      
      // Basic statistical probabilities
      if (eventType === 'Home Run' && context.sport === 'MLB') {
        probability = context.runnersOn?.length ? 4 : 3;
        if (context.currentBatter?.stats.hr > 20) probability += 2;
      } else if (eventType === 'Scoring Play' && context.sport === 'MLB') {
        probability = 10 + (context.runnersOn?.length || 0) * 15;
      } else if (eventType === 'Touchdown' && context.sport === 'NFL') {
        probability = context.yardsToGo < 20 ? 25 : 10;
      }

      if (probability >= minProb) {
        predictions.push({
          eventType,
          probability,
          confidence: 50,
          reasoning,
          impact: "Potential scoring opportunity",
          shouldAlert: probability > 30
        });
      }
    }

    return predictions;
  }

  // Get current statistics
  getStats(): OpenAIStats {
    return { ...this.stats };
  }

  // Get recent logs
  getLogs(limit: number = 100): OpenAICallLog[] {
    return this.callLogs.slice(-limit);
  }

  // Get error logs
  getErrorLogs(): OpenAICallLog[] {
    return this.callLogs.filter(log => log.error);
  }

  // Clear logs (for memory management)
  clearOldLogs(keepLast: number = 100) {
    this.callLogs = this.callLogs.slice(-keepLast);
    console.log(`🧹 Cleared old OpenAI logs, keeping last ${keepLast}`);
  }

  // Clear cache (force fresh analysis)
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cleared OpenAI cache - forcing fresh analysis');
  }

  // Reset quota status (for when user increases budget)
  resetQuota(): void {
    this.quotaAvailable = true;
    this.lastQuotaCheck = Date.now();
    this.stats.lastQuotaCheck = new Date();
    this.stats.quotaExceeded = false;
    console.log('🔄 OpenAI quota reset - API calls re-enabled');
  }

  // Check API health
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5
      });
      return true;
    } catch {
      return false;
    }
  }

  // Export logs for analysis
  exportLogs(): string {
    const summary = {
      stats: this.stats,
      recentLogs: this.callLogs.slice(-50),
      errorSummary: {
        total: this.stats.failedCalls,
        rate: `${this.stats.errorRate.toFixed(2)}%`,
        quotaExceeded: this.stats.quotaExceeded
      }
    };
    return JSON.stringify(summary, null, 2);
  }
}

// Export singleton instance getter
export const getOpenAIManager = () => OpenAIManager.getInstance();