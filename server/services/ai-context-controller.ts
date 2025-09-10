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
  
  // NFL-specific context
  down?: number;
  yardsToGo?: number;
  fieldPosition?: number;
  possession?: string;
  redZone?: boolean;
  goalLine?: boolean;

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

  // Enhanced context
  bettingAdvice: {
    recommendation: string;
    confidence: number;
    reasoning: string[];
    suggestedBets: string[];
  };

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

    // Check if AI is enabled
    if (!this.basicAI.configured) {
      console.log('🚫 AI Context Controller: DISABLED - OpenAI not configured');
      return this.getFallbackAlert(context);
    }

    try {
      console.log(`🤖 AI Context Controller: Taking full control of ${context.alertType} alert`);

      // AI analyzes the complete game state and generates enhanced content
      const [
        enhancedContent,
        bettingAnalysis,
        gameProjection,
        userEngagement
      ] = await Promise.all([
        this.generateEnhancedContent(context),
        this.generateBettingAnalysis(context),
        this.generateGameProjection(context),
        this.generateUserEngagement(context)
      ]);

      const processingTime = Date.now() - startTime;

      console.log(`✅ AI Context Controller: Enhanced ${context.alertType} in ${processingTime}ms`);

      return {
        ...enhancedContent,
        bettingAdvice: bettingAnalysis,
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

  private async generateBettingAnalysis(context: AlertContext): Promise<{
    recommendation: string;
    confidence: number;
    reasoning: string[];
    suggestedBets: string[];
  }> {
    const currentTotal = context.homeScore + context.awayScore;
    const scoreDiff = Math.abs(context.homeScore - context.awayScore);

    // Calculate realistic game-specific betting lines
    const liveTotal = this.calculateLiveTotal(context);
    const liveSpread = this.calculateLiveSpread(context.homeTeam, context.awayTeam, context.homeScore, context.awayScore);

    const prompt = this.buildBettingAnalysisPrompt(context, currentTotal, scoreDiff, liveTotal, liveSpread);

    const response = await this.basicAI.generateResponse(prompt);
    if (!response) {
      return this.getContextualFallback(context, liveTotal, liveSpread);
    }

    return this.parseBettingResponse(response, context);
  }

  private buildBettingAnalysisPrompt(context: AlertContext, currentTotal: number, scoreDiff: number, liveTotal: number | string, liveSpread: string): string {
    if (context.sport === 'NFL') {
      return `
Analyze this NFL live betting opportunity:

CURRENT GAME STATE:
- ${context.awayTeam} ${context.awayScore} @ ${context.homeTeam} ${context.homeScore}
- Current total points: ${currentTotal}
- Score difference: ${scoreDiff}
- Alert: ${context.alertType} (${context.probability}% probability)
- Game situation: ${this.formatGameState(context)}

NFL-SPECIFIC CONTEXT:
${context.down && context.yardsToGo ? `- Down & Distance: ${this.getOrdinal(context.down)} & ${context.yardsToGo}` : ''}
${context.fieldPosition ? `- Field Position: ${context.fieldPosition}-yard line` : ''}
${context.redZone ? '- RED ZONE: High touchdown probability' : ''}
${context.goalLine ? '- GOAL LINE: Critical scoring moment' : ''}
${context.possession ? `- Possession: ${context.possession}` : ''}

CURRENT BETTING CONTEXT:
- Live total line: ${liveTotal}
- Live spread: ${liveSpread}

Based on this SPECIFIC NFL situation, provide:
1. Your #1 betting recommendation (be specific with the line)
2. 3 reasons why this bet makes sense RIGHT NOW
3. 3 specific NFL prop bets for this situation

Focus on immediate value based on down, distance, field position, and scoring probability.
`;
    }
    
    // Default MLB/other sports prompt
    return `
Analyze this ${context.sport} live betting opportunity:

CURRENT GAME STATE:
- ${context.awayTeam} ${context.awayScore} @ ${context.homeTeam} ${context.homeScore}
- Current total runs: ${currentTotal}
- Score difference: ${scoreDiff}
- Alert: ${context.alertType} (${context.probability}% probability)
- Game situation: ${this.formatGameState(context)}

CURRENT BETTING CONTEXT:
- Live total line: ${liveTotal}
- Live spread: ${liveSpread}
- Runners on base: ${context.baseRunners?.length || 0}

Based on this SPECIFIC game situation, provide:
1. Your #1 betting recommendation (be specific with the line)
2. 3 reasons why this bet makes sense RIGHT NOW
3. 3 specific bets with current game context

Focus on immediate value based on the actual score and game state.
`;
  }

  private calculateLiveTotal(context: AlertContext): number | string {
    const currentTotal = context.homeScore + context.awayScore;
    
    if (context.sport === 'NFL') {
      const quarter = context.quarter || 2;
      const baseTotal = 47.0; // Standard NFL total
      
      // Adjust based on current pace and game situation
      const gameProgress = quarter / 4;
      const currentPace = gameProgress > 0 ? (currentTotal / gameProgress) : currentTotal * 2;
      const adjustedTotal = Math.round((baseTotal + currentPace) / 2 * 2) / 2;
      
      // Ensure total is reasonable and above current score
      return Math.max(adjustedTotal, currentTotal + 3.5);
    }
    
    if (context.sport === 'MLB') {
      const inning = context.inning || 5;
      const baseTotal = 8.5; // Standard MLB total
      const currentPace = (currentTotal / Math.max(inning, 1)) * 9;
      return Math.round((baseTotal + currentPace) / 2 * 2) / 2; // Round to nearest 0.5
    }

    return currentTotal + 3.5; // Fallback
  }

  private calculateLiveSpread(homeTeam: any, awayTeam: any, homeScore: number, awayScore: number): string {
    // Extract team names properly with fallbacks
    let homeTeamName = 'Home Team';
    let awayTeamName = 'Away Team';

    if (typeof homeTeam === 'string') {
      homeTeamName = homeTeam;
    } else if (homeTeam && typeof homeTeam === 'object') {
      homeTeamName = homeTeam.displayName || homeTeam.name || homeTeam.teamName || homeTeam.abbreviation || 'Home Team';
    }

    if (typeof awayTeam === 'string') {
      awayTeamName = awayTeam;
    } else if (awayTeam && typeof awayTeam === 'object') {
      awayTeamName = awayTeam.displayName || awayTeam.name || awayTeam.teamName || awayTeam.abbreviation || 'Away Team';
    }

    // Ensure we have valid strings before calling split()
    const homeTeamCity = (typeof homeTeamName === 'string' && homeTeamName.length > 0) ? 
                         homeTeamName.split(' ').pop() || 'Home' : 'Home';
    const awayTeamCity = (typeof awayTeamName === 'string' && awayTeamName.length > 0) ? 
                         awayTeamName.split(' ').pop() || 'Away' : 'Away';

    const scoreDiff = homeScore - awayScore;

    if (scoreDiff === 0) return 'Pick\'em';

    const team = scoreDiff > 0 ? homeTeamCity : awayTeamCity;
    const line = Math.abs(scoreDiff) + 0.5;

    return `${team} ${scoreDiff > 0 ? '-' : '+'}${line}`;
  }


  private getContextualFallback(context: AlertContext, liveTotal: number | string, liveSpread: string): {
    recommendation: string;
    confidence: number;
    reasoning: string[];
    suggestedBets: string[];
  } {
    const currentTotal = context.homeScore + context.awayScore;
    const totalNum = typeof liveTotal === 'number' ? liveTotal : currentTotal + 3.5;

    if (context.sport === 'NFL') {
      return {
        recommendation: this.getNFLRecommendation(context, totalNum),
        confidence: Math.min(88, context.probability),
        reasoning: [
          `${context.alertType.replace('_', ' ')} creates high-value NFL scoring opportunity`,
          `Current ${context.awayScore}-${context.homeScore} score vs ${totalNum} total suggests value`,
          `${context.down && context.yardsToGo ? `${this.getOrdinal(context.down)} & ${context.yardsToGo}` : 'Game situation'} favors immediate action`
        ],
        suggestedBets: [
          context.redZone ? 'Touchdown scorer prop' : `${currentTotal < totalNum ? 'Over' : 'Under'} ${totalNum}`,
          context.goalLine ? 'Goal line touchdown' : 'Drive result prop',
          'Next score method'
        ]
      };
    }

    return {
      recommendation: currentTotal < totalNum ? `Over ${totalNum}` : `Under ${totalNum}`,
      confidence: Math.min(85, context.probability),
      reasoning: [
        `Current score ${context.awayScore}-${context.homeScore} suggests ${currentTotal < totalNum ? 'over' : 'under'} value`,
        `${context.alertType.replace('_', ' ')} creates scoring opportunity`,
        `Live line ${totalNum} vs current pace`
      ],
      suggestedBets: [
        `${currentTotal < totalNum ? 'Over' : 'Under'} ${totalNum}`,
        `Next inning total runs`,
        `${context.baseRunners?.length ? 'Runner to score' : 'No runs this inning'}`
      ]
    };
  }

  private getNFLRecommendation(context: AlertContext, liveTotal: number): string {
    if (context.redZone) {
      return 'Touchdown scorer prop - High probability';
    }
    
    if (context.goalLine) {
      return 'Goal line touchdown - Critical moment';
    }
    
    if (context.down === 4) {
      return 'Fourth down conversion prop';
    }
    
    const currentTotal = context.homeScore + context.awayScore;
    return currentTotal < liveTotal ? `Over ${liveTotal}` : `Under ${liveTotal}`;
  }

  private async generateGameProjection(context: AlertContext): Promise<{
    finalScorePrediction: string;
    keyMoments: string[];
    winProbability: { home: number; away: number };
  }> {
    const prompt = this.buildGameProjectionPrompt(context);

    const response = await this.basicAI.generateResponse(prompt);
    if (!response) {
      return this.getDefaultProjection(context);
    }

    return this.parseProjectionResponse(response, context);
  }

  private buildGameProjectionPrompt(context: AlertContext): string {
    if (context.sport === 'NFL') {
      return `
Project the outcome of this NFL game:

CURRENT: ${context.awayTeam} ${context.awayScore}, ${context.homeTeam} ${context.homeScore}
CONTEXT: ${context.alertType} alert triggered
${this.formatGameState(context)}

NFL SITUATION:
${context.down && context.yardsToGo ? `- ${this.getOrdinal(context.down)} & ${context.yardsToGo}` : ''}
${context.fieldPosition ? `- ${context.fieldPosition}-yard line` : ''}
${context.redZone ? '- RED ZONE opportunity' : ''}
${context.goalLine ? '- GOAL LINE situation' : ''}

Provide:
1. Final score prediction
2. 3 key upcoming NFL moments to watch
3. Current win probabilities (must sum to 100)

Focus on NFL-specific factors: field position, down/distance, clock management.
`;
    }
    
    return `
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
  }

  private getDefaultProjection(context: AlertContext) {
    const homeLead = context.homeScore - context.awayScore;
    const homeWinProb = Math.max(10, Math.min(90, 50 + (homeLead * 15)));

    if (context.sport === 'NFL') {
      return {
        finalScorePrediction: `${context.awayTeam} ${context.awayScore + 10}, ${context.homeTeam} ${context.homeScore + 14}`,
        keyMoments: [
          context.redZone ? 'Red zone touchdown attempt' : 'Next scoring drive',
          context.down === 4 ? 'Fourth down decision' : 'Defensive stop opportunity',
          'Clock management in final quarter'
        ],
        winProbability: { home: homeWinProb, away: 100 - homeWinProb }
      };
    }

    return {
      finalScorePrediction: `${context.awayTeam} ${context.awayScore + 2}, ${context.homeTeam} ${context.homeScore + 1}`,
      keyMoments: ['Next scoring opportunity', 'Defensive stop', 'Late game situation'],
      winProbability: { home: homeWinProb, away: 100 - homeWinProb }
    };
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
    const sportSpecificContext = this.buildSportSpecificContext(context);
    
    return `
You are the final AI layer controlling alert delivery for a sports betting app. Rewrite this alert with complete contextual awareness:

ALERT TYPE: ${context.alertType}
ORIGINAL MESSAGE: ${context.originalMessage}
GAME: ${context.awayTeam} @ ${context.homeTeam} (${context.awayScore}-${context.homeScore})
PROBABILITY: ${context.probability}%
${this.formatGameState(context)}
${sportSpecificContext}
${context.weather ? `WEATHER: ${context.weather.temperature}°F, ${context.weather.condition}` : ''}

Your mission: Create the most valuable, actionable alert possible. Consider:
- Immediate betting opportunities
- Game momentum and context  
- User urgency and timing
- Predictive insights
${context.sport === 'NFL' ? `- Down and distance implications
- Red zone efficiency
- Clock management factors` : ''}

Provide:
1. Compelling title (under 60 chars)
2. Clear, actionable message (under 120 chars)
3. 3 key insights
4. Primary recommendation

Make every word count. Users need instant clarity and value.
`;
  }

  private buildSportSpecificContext(context: AlertContext): string {
    if (context.sport === 'NFL') {
      let nflContext = '';
      
      if (context.redZone) {
        nflContext += 'RED ZONE SITUATION: High touchdown probability\n';
      }
      
      if (context.goalLine) {
        nflContext += 'GOAL LINE STAND: Critical scoring opportunity\n';
      }
      
      if (context.down === 4) {
        nflContext += 'FOURTH DOWN: Make-or-break decision point\n';
      }
      
      if (context.quarter === 4 && context.timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(context.timeRemaining);
        if (timeSeconds <= 120) {
          nflContext += 'TWO MINUTE WARNING: Crunch time decision making\n';
        }
      }
      
      return nflContext;
    }
    
    return '';
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    
    return parseInt(cleanTime) || 0;
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
      if (context.timeRemaining) state += `${context.timeRemaining} left, `;
      if (context.down && context.yardsToGo) {
        state += `${this.getOrdinal(context.down)} & ${context.yardsToGo}, `;
      }
      if (context.fieldPosition) {
        state += `${context.fieldPosition}-yard line, `;
      }
      if (context.possession) {
        state += `${context.possession} ball`;
      }
    }

    return state.replace(/, $/, ''); // Remove trailing comma
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

  private parseBettingResponse(response: string, context: AlertContext): {
    recommendation: string;
    confidence: number;
    reasoning: string[];
    suggestedBets: string[];
  } {
    const lines = response.split('\n').filter(line => line.trim());

    return {
      recommendation: lines[0]?.trim() || 'MONITOR',
      confidence: Math.min(95, context.probability + 10),
      reasoning: lines.slice(1, 4).map(line => line.replace(/^\d+\.?\s*/g, '')),
      suggestedBets: lines.slice(-3).map(line => line.replace(/^\d+\.?\s*/g, ''))
    };
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

  private getOrdinal(num: number): string {
    const ordinals = ['', '1st', '2nd', '3rd', '4th'];
    return ordinals[num] || `${num}th`;
  }

  private getFallbackAlert(context: AlertContext): AIEnhancedAlert {
    const sportSpecificDefaults = this.getSportSpecificDefaults(context);
    
    return {
      title: `${context.alertType.replace('_', ' ')} Alert`,
      message: context.originalMessage,
      insights: sportSpecificDefaults.insights,
      recommendation: sportSpecificDefaults.recommendation,
      urgency: this.determineUrgency(context),
      bettingAdvice: {
        recommendation: 'MONITOR',
        confidence: context.probability,
        reasoning: ['AI enhancement unavailable'],
        suggestedBets: sportSpecificDefaults.suggestedBets
      },
      gameProjection: {
        finalScorePrediction: `${context.awayTeam} vs ${context.homeTeam} - Close finish expected`,
        keyMoments: sportSpecificDefaults.keyMoments,
        winProbability: { home: 50, away: 50 }
      },
      callToAction: '📊 Situation developing - Stay alert',
      followUpActions: sportSpecificDefaults.followUpActions,
      originalContext: context.originalContext,
      aiProcessingTime: 0,
      confidenceScore: context.probability
    };
  }

  private getSportSpecificDefaults(context: AlertContext) {
    if (context.sport === 'NFL') {
      return {
        insights: [
          'High-probability NFL scoring situation detected',
          'Monitor down and distance closely',
          'Live betting opportunity in red zone'
        ],
        recommendation: 'Consider touchdown and field goal props',
        suggestedBets: ['Touchdown scorer', 'Field goal attempt', 'Drive result'],
        keyMoments: ['Next down decision', 'Red zone execution', 'Clock management'],
        followUpActions: ['Monitor play calling', 'Check live props', 'Watch for penalties']
      };
    }
    
    // Default MLB/other sports
    return {
      insights: ['High-probability situation detected', 'Monitor game closely', 'Betting opportunity available'],
      recommendation: 'Consider live betting options',
      suggestedBets: ['Live total', 'Next score'],
      keyMoments: ['Next scoring opportunity', 'Defensive stand', 'Final minutes'],
      followUpActions: ['Monitor progression', 'Check betting lines', 'Set alerts']
    };
  }
}