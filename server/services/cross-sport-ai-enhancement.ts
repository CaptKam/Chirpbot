import { BasicAI } from './basic-ai';
import { storage } from '../storage';

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
  period?: number; // Quarter, Inning, etc.
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
  
  // Original message
  originalMessage: string;
  originalContext: any;
}

export interface CrossSportAIResponse {
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

interface AICache {
  key: string;
  response: CrossSportAIResponse;
  timestamp: number;
  sport: string;
}

export class CrossSportAIEnhancement {
  private basicAI: BasicAI;
  private cache = new Map<string, AICache>();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 500;
  private performanceMetrics = {
    totalRequests: 0,
    totalProcessingTime: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
    successfulEnhancements: 0,
    failedEnhancements: 0,
    // Per-sport metrics
    sportMetrics: {
      MLB: { requests: 0, avgTime: 0, successes: 0 },
      NFL: { requests: 0, avgTime: 0, successes: 0 },
      NCAAF: { requests: 0, avgTime: 0, successes: 0 },
      NBA: { requests: 0, avgTime: 0, successes: 0 },
      WNBA: { requests: 0, avgTime: 0, successes: 0 },
      CFL: { requests: 0, avgTime: 0, successes: 0 }
    }
  };

  constructor() {
    this.basicAI = new BasicAI();
    console.log(`🤖 Cross-Sport AI Enhancement: ${this.basicAI.configured ? 'ENABLED' : 'DISABLED'}`);
  }

  get configured(): boolean {
    return this.basicAI.configured;
  }

  // Main enhancement method for all sports
  async enhanceAlert(context: CrossSportContext): Promise<CrossSportAIResponse> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.sportMetrics[context.sport].requests++;

    try {
      // Check if AI is configured
      if (!this.configured) {
        console.log(`🚫 Cross-Sport AI: DISABLED for ${context.sport} - OpenAI not configured`);
        return this.getFallbackResponse(context, startTime);
      }

      // Only enhance medium-priority alerts and above to control costs 
      if (context.probability < 60) {
        console.log(`⏭️ Cross-Sport AI: Skipping ${context.sport} alert (${context.probability}% < 60% threshold)`);
        return this.getFallbackResponse(context, startTime);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        console.log(`💨 Cross-Sport AI: Cache hit for ${context.sport} - ${context.alertType}`);
        this.performanceMetrics.cacheHits++;
        return cached;
      }

      console.log(`🧠 Cross-Sport AI: Processing ${context.sport} ${context.alertType} alert (${context.probability}%)`);
      
      // Generate sport-specific AI enhancement
      const sportPrompt = this.buildSportSpecificPrompt(context);
      const aiResponse = await this.basicAI.generateResponse(sportPrompt);
      
      if (!aiResponse) {
        console.log(`⚠️ Cross-Sport AI: No response from AI for ${context.sport}`);
        this.performanceMetrics.failedEnhancements++;
        return this.getFallbackResponse(context, startTime);
      }

      // Parse and structure the AI response
      const enhancement = this.parseAIResponse(aiResponse, context, startTime);
      
      // Cache the response
      this.cacheResponse(cacheKey, enhancement);
      this.performanceMetrics.cacheMisses++;
      this.performanceMetrics.successfulEnhancements++;
      this.performanceMetrics.sportMetrics[context.sport].successes++;

      const processingTime = Date.now() - startTime;
      this.performanceMetrics.totalProcessingTime.push(processingTime);
      this.performanceMetrics.sportMetrics[context.sport].avgTime = 
        (this.performanceMetrics.sportMetrics[context.sport].avgTime + processingTime) / 2;

      console.log(`✅ Cross-Sport AI: Enhanced ${context.sport} alert in ${processingTime}ms`);
      return enhancement;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Cross-Sport AI: Failed to enhance ${context.sport} alert after ${processingTime}ms:`, error);
      this.performanceMetrics.failedEnhancements++;
      return this.getFallbackResponse(context, startTime);
    }
  }

  // Build sport-specific prompts with deep contextual understanding
  private buildSportSpecificPrompt(context: CrossSportContext): string {
    const basePrompt = this.buildBasePrompt(context);
    
    switch (context.sport) {
      case 'MLB':
        return this.buildMLBPrompt(context, basePrompt);
      case 'NFL':
        return this.buildNFLPrompt(context, basePrompt);
      case 'NCAAF':
        return this.buildNCAAFPrompt(context, basePrompt);
      case 'NBA':
        return this.buildNBAPrompt(context, basePrompt);
      case 'WNBA':
        return this.buildWNBAPrompt(context, basePrompt);
      case 'CFL':
        return this.buildCFLPrompt(context, basePrompt);
      default:
        return basePrompt;
    }
  }

  private buildBasePrompt(context: CrossSportContext): string {
    return `
You are a ${context.sport} expert AI providing contextual insights for sports betting alerts.

GAME CONTEXT:
- ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
- Alert: ${context.alertType} (${context.probability}% confidence)
- Original: ${context.originalMessage}
${context.playoffImplications ? '- PLAYOFF IMPLICATIONS: High stakes game' : ''}
${context.championshipContext ? `- CHAMPIONSHIP CONTEXT: ${context.championshipContext}` : ''}
${context.weather ? `- WEATHER: ${context.weather.temperature}°F, ${context.weather.condition}` : ''}
`;
  }

  private buildMLBPrompt(context: CrossSportContext, basePrompt: string): string {
    const runnersDesc = context.baseRunners ? 
      `${context.baseRunners.first ? '1st ' : ''}${context.baseRunners.second ? '2nd ' : ''}${context.baseRunners.third ? '3rd' : ''}`.trim() || 'Bases empty' :
      'Unknown base situation';
    
    return `${basePrompt}
BASEBALL SITUATION:
- ${context.inning}${this.getOrdinal(context.inning || 1)} inning, ${context.outs || 0} outs
- Count: ${context.balls || 0}-${context.strikes || 0}
- Runners: ${runnersDesc}
${context.inning && context.inning >= 7 ? '- LATE INNING: High leverage situation' : ''}

Focus on: Run expectancy, leverage situations, clutch hitting, pitcher fatigue, bullpen usage.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars) 
3. 3 contextual insights
4. Actionable betting recommendation
5. Win probability factors

Keep response concise and baseball-specific.`;
  }

  private buildNFLPrompt(context: CrossSportContext, basePrompt: string): string {
    return `${basePrompt}
NFL SITUATION:
- Q${context.quarter || 1}, ${context.timeRemaining || 'Unknown'} remaining
${context.down && context.yardsToGo ? `- ${this.getOrdinal(context.down)} & ${context.yardsToGo}` : ''}
${context.fieldPosition ? `- Field position: ${context.fieldPosition}-yard line` : ''}
${context.redZone ? '- RED ZONE: High touchdown probability' : ''}
${context.goalLine ? '- GOAL LINE: Critical scoring opportunity' : ''}
${context.possession ? `- Possession: ${context.possession}` : ''}
${context.weather?.impact ? `- Weather impact: ${context.weather.impact}` : ''}

Focus on: Down & distance, field position, clock management, weather impact, playoff positioning.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars)
3. 3 NFL-specific insights
4. Betting recommendation (spread/total/prop)
5. Key factors for next play

Emphasize NFL strategy and situational football.`;
  }

  private buildNCAAFPrompt(context: CrossSportContext, basePrompt: string): string {
    return `${basePrompt}
COLLEGE FOOTBALL SITUATION:  
- Q${context.quarter || 1}, ${context.timeRemaining || 'Unknown'} remaining
${context.down && context.yardsToGo ? `- ${this.getOrdinal(context.down)} & ${context.yardsToGo}` : ''}
${context.fieldPosition ? `- Field position: ${context.fieldPosition}-yard line` : ''}
${context.redZone ? '- RED ZONE: Touchdown opportunity' : ''}
${context.championshipContext ? `- ${context.championshipContext}` : ''}

Focus on: College football dynamics, conference implications, rivalry factors, playoff picture impact.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars)
3. 3 college-specific insights (recruiting, conference, rivalry)
4. Betting recommendation
5. Championship implications

Emphasize college football context and amateur athletics.`;
  }

  private buildNBAPrompt(context: CrossSportContext, basePrompt: string): string {
    return `${basePrompt}
NBA SITUATION:
- Q${context.quarter || 1}, ${context.timeLeft || 'Unknown'} remaining
${context.shotClock ? `- Shot clock: ${context.shotClock}s` : ''}
${context.fouls ? `- Team fouls: ${context.awayTeam} ${context.fouls.away}, ${context.homeTeam} ${context.fouls.home}` : ''}
${context.quarter && context.quarter >= 4 && context.timeLeft ? '- CLUTCH TIME: Championship moments' : ''}

Focus on: Clutch performances, star player impact, playoff positioning, MVP considerations, championship implications.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars)
3. 3 NBA insights (star power, clutch time, playoffs)
4. Betting recommendation
5. Championship/MVP factors

Emphasize professional basketball dynamics and superstar performances.`;
  }

  private buildWNBAPrompt(context: CrossSportContext, basePrompt: string): string {
    return `${basePrompt}
WNBA SITUATION:
- Q${context.quarter || 1}, ${context.timeLeft || 'Unknown'} remaining
${context.shotClock ? `- Shot clock: ${context.shotClock}s` : ''}
${context.quarter && context.quarter >= 4 ? '- FOURTH QUARTER: Crunch time in professional women\'s basketball' : ''}

Focus on: Professional women's basketball dynamics, playoff races, MVP candidates, clutch performances.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars)
3. 3 WNBA insights (playoff race, star performances, league context)
4. Betting recommendation
5. Championship implications

Emphasize WNBA-specific context and professional women's sports.`;
  }

  private buildCFLPrompt(context: CrossSportContext, basePrompt: string): string {
    return `${basePrompt}
CFL SITUATION:
- Q${context.quarter || 1}, ${context.timeRemaining || 'Unknown'} remaining
${context.down && context.yardsToGo ? `- ${this.getOrdinal(context.down)} & ${context.yardsToGo} (3-down system)` : ''}
${context.fieldPosition ? `- Field position: ${context.fieldPosition}-yard line (110-yard field)` : ''}

Focus on: 3-down system, rouge scoring, 110-yard field, Grey Cup implications, Canadian football specifics.

Provide:
1. Enhanced title (under 50 chars)
2. Enhanced message (under 100 chars)
3. 3 CFL insights (3-down system, rouge, Grey Cup)
4. Betting recommendation
5. Canadian football factors

Emphasize CFL-specific rules and Grey Cup championship context.`;
  }

  private parseAIResponse(aiResponse: string, context: CrossSportContext, startTime: number): CrossSportAIResponse {
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    // Extract structured data from AI response
    const enhancedTitle = this.extractTitle(lines, context);
    const enhancedMessage = this.extractMessage(lines, context);
    const insights = this.extractInsights(lines);
    const recommendation = this.extractRecommendation(lines);
    
    // Calculate win probability based on current score and sport
    const winProbability = this.calculateWinProbability(context);
    
    return {
      sport: context.sport,
      enhancedTitle,
      enhancedMessage,
      contextualInsights: insights,
      actionableRecommendation: recommendation,
      urgencyLevel: this.determineUrgencyLevel(context),
      bettingContext: this.generateBettingContext(context),
      gameProjection: {
        winProbability,
        keyFactors: this.getKeyFactors(context),
        nextCriticalMoment: this.getNextCriticalMoment(context)
      },
      aiProcessingTime: Date.now() - startTime,
      confidence: Math.min(context.probability + 5, 95), // Slight AI boost
      sportSpecificData: this.getSportSpecificData(context)
    };
  }

  private extractTitle(lines: string[], context: CrossSportContext): string {
    const titleLine = lines.find(line => 
      line.toLowerCase().includes('title') ||
      (line.length < 50 && line.includes('🚨'))
    );
    return titleLine?.replace(/^.*title:?\s*/i, '').trim() || 
           `🚨 ${context.sport} ${context.alertType.replace('_', ' ')}`;
  }

  private extractMessage(lines: string[], context: CrossSportContext): string {
    const messageLine = lines.find(line => 
      line.toLowerCase().includes('message') ||
      (line.length > 20 && line.length < 100)
    );
    return messageLine?.replace(/^.*message:?\s*/i, '').trim() || 
           context.originalMessage;
  }

  private extractInsights(lines: string[]): string[] {
    return lines.filter(line => 
      line.match(/^\d\./) || 
      line.includes('•') || 
      line.includes('-') ||
      line.toLowerCase().includes('insight')
    ).slice(0, 3).map(line => 
      line.replace(/^\d+\.?\s*|^[•-]\s*/g, '').trim()
    );
  }

  private extractRecommendation(lines: string[]): string {
    const recLine = lines.find(line => 
      line.toLowerCase().includes('recommendation') ||
      line.toLowerCase().includes('bet') ||
      line.toLowerCase().includes('action')
    );
    return recLine?.replace(/^.*recommendation:?\s*/i, '').trim() || 
           'Monitor situation closely';
  }

  private calculateWinProbability(context: CrossSportContext): { home: number; away: number } {
    const scoreDiff = context.homeScore - context.awayScore;
    let homeWinProb = 50; // Base 50-50
    
    // Adjust based on score differential
    homeWinProb += scoreDiff * 5;
    
    // Sport-specific adjustments
    switch (context.sport) {
      case 'MLB':
        if (context.inning && context.inning >= 7) homeWinProb += scoreDiff * 3;
        break;
      case 'NFL':
        if (context.quarter && context.quarter >= 4) homeWinProb += scoreDiff * 7;
        break;
      case 'NBA':
      case 'WNBA':
        if (context.quarter && context.quarter >= 4) homeWinProb += scoreDiff * 4;
        break;
    }
    
    // Clamp between 10-90
    homeWinProb = Math.max(10, Math.min(90, homeWinProb));
    
    return { home: homeWinProb, away: 100 - homeWinProb };
  }

  private generateBettingContext(context: CrossSportContext): { recommendation: string; confidence: number; reasoning: string[]; } {
    const scoreDiff = Math.abs(context.homeScore - context.awayScore);
    const currentTotal = context.homeScore + context.awayScore;
    
    return {
      recommendation: this.getSportSpecificBettingRec(context, scoreDiff, currentTotal),
      confidence: Math.min(context.probability, 88),
      reasoning: [
        `${context.sport} ${context.alertType.replace('_', ' ')} situation`,
        `Current score differential: ${scoreDiff}`,
        `High probability opportunity: ${context.probability}%`
      ]
    };
  }

  private getSportSpecificBettingRec(context: CrossSportContext, scoreDiff: number, currentTotal: number): string {
    switch (context.sport) {
      case 'NFL':
        if (context.redZone) return 'Touchdown scorer prop';
        if (context.goalLine) return 'Goal line stand prop';
        return scoreDiff <= 3 ? 'Live spread value' : 'Total points focus';
      
      case 'NBA':
      case 'WNBA':
        return context.quarter && context.quarter >= 4 ? 'Live total adjustment' : 'Spread opportunity';
      
      case 'MLB':
        return context.baseRunners?.first || context.baseRunners?.second || context.baseRunners?.third ? 
          'Next inning runs' : 'Game total adjustment';
      
      default:
        return 'Monitor live lines';
    }
  }

  private getKeyFactors(context: CrossSportContext): string[] {
    const factors: string[] = [];
    
    // Universal factors
    const scoreDiff = Math.abs(context.homeScore - context.awayScore);
    if (scoreDiff <= 3) factors.push('Close game dynamics');
    
    // Sport-specific factors
    switch (context.sport) {
      case 'MLB':
        if (context.inning && context.inning >= 7) factors.push('Late inning pressure');
        if (context.baseRunners?.third) factors.push('Runner on third scoring threat');
        break;
        
      case 'NFL':
        if (context.redZone) factors.push('Red zone efficiency');
        if (context.quarter === 4) factors.push('Fourth quarter execution');
        break;
        
      case 'NBA':
      case 'WNBA':
        if (context.quarter === 4) factors.push('Clutch time performance');
        factors.push('Star player impact');
        break;
    }
    
    return factors.slice(0, 3);
  }

  private getNextCriticalMoment(context: CrossSportContext): string {
    switch (context.sport) {
      case 'MLB':
        if (context.outs === 2) return 'Two-out rally potential';
        return 'Next at-bat opportunity';
        
      case 'NFL':
        if (context.down === 4) return 'Fourth down decision';
        if (context.redZone) return 'Red zone execution';
        return 'Next possession drive';
        
      case 'NBA':
      case 'WNBA':
        if (context.quarter === 4) return 'Final minutes execution';
        return 'Next scoring run';
        
      default:
        return 'Next critical play';
    }
  }

  private getSportSpecificData(context: CrossSportContext): any {
    switch (context.sport) {
      case 'MLB':
        return {
          leverageIndex: this.calculateMLBLeverage(context),
          runExpectancy: this.calculateRunExpectancy(context)
        };
        
      case 'NFL':
        return {
          winProbabilityAdded: this.calculateNFLWPA(context),
          expectedPoints: this.calculateExpectedPoints(context)
        };
        
      default:
        return {};
    }
  }

  private calculateMLBLeverage(context: CrossSportContext): number {
    if (!context.inning) return 1.0;
    
    let leverage = 1.0;
    if (context.inning >= 7) leverage += 0.5;
    if (context.outs === 2) leverage += 0.3;
    if (context.baseRunners?.third) leverage += 0.4;
    
    return Math.round(leverage * 10) / 10;
  }

  private calculateRunExpectancy(context: CrossSportContext): number {
    let expectancy = 0.5; // Base expectancy
    
    if (context.baseRunners?.first) expectancy += 0.3;
    if (context.baseRunners?.second) expectancy += 0.6;
    if (context.baseRunners?.third) expectancy += 0.9;
    
    expectancy *= (3 - (context.outs || 0)) / 3; // Adjust for outs
    
    return Math.round(expectancy * 10) / 10;
  }

  private calculateNFLWPA(context: CrossSportContext): number {
    if (!context.down || !context.yardsToGo) return 0.05;
    
    let wpa = 0.05; // Base WPA
    if (context.redZone) wpa += 0.1;
    if (context.down === 4) wpa += 0.15;
    if (context.quarter === 4) wpa += 0.1;
    
    return Math.round(wpa * 100) / 100;
  }

  private calculateExpectedPoints(context: CrossSportContext): number {
    if (!context.fieldPosition) return 2.0;
    
    // Simple expected points model based on field position
    if (context.fieldPosition <= 10) return 6.5; // Goal line
    if (context.fieldPosition <= 20) return 5.5; // Red zone
    if (context.fieldPosition <= 40) return 3.5; // Scoring territory
    return 2.0; // Mid-field
  }

  private determineUrgencyLevel(context: CrossSportContext): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (context.probability >= 95) return 'CRITICAL';
    if (context.probability >= 90) return 'HIGH';
    if (context.probability >= 85) return 'MEDIUM';
    return 'LOW';
  }

  private getFallbackResponse(context: CrossSportContext, startTime: number): CrossSportAIResponse {
    return {
      sport: context.sport,
      enhancedTitle: `${context.sport} ${context.alertType.replace('_', ' ')}`,
      enhancedMessage: context.originalMessage,
      contextualInsights: ['High-probability opportunity', 'Monitor situation closely', 'Consider betting implications'],
      actionableRecommendation: 'Monitor game progression',
      urgencyLevel: this.determineUrgencyLevel(context),
      aiProcessingTime: Date.now() - startTime,
      confidence: context.probability,
      sportSpecificData: {}
    };
  }

  // Cache management
  private generateCacheKey(context: CrossSportContext): string {
    return `${context.sport}_${context.gameId}_${context.alertType}_${context.homeScore}_${context.awayScore}_${context.period || context.inning || context.quarter || 1}`;
  }

  private getCachedResponse(key: string): CrossSportAIResponse | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.response;
    }
    
    // Clean up expired cache entry
    if (cached) this.cache.delete(key);
    return null;
  }

  private cacheResponse(key: string, response: CrossSportAIResponse): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      key,
      response,
      timestamp: Date.now(),
      sport: response.sport
    });
  }

  // Helper methods
  private getOrdinal(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  }

  // Performance monitoring
  getPerformanceMetrics() {
    const avgProcessingTime = this.performanceMetrics.totalProcessingTime.length > 0 ?
      this.performanceMetrics.totalProcessingTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.totalProcessingTime.length : 0;
    
    return {
      ...this.performanceMetrics,
      avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
      cacheHitRate: this.performanceMetrics.totalRequests > 0 ? 
        (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests * 100) : 0,
      successRate: this.performanceMetrics.totalRequests > 0 ?
        (this.performanceMetrics.successfulEnhancements / this.performanceMetrics.totalRequests * 100) : 0,
      cacheSize: this.cache.size
    };
  }

  // Clear cache (for testing/maintenance)
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cross-Sport AI: Cache cleared');
  }
}