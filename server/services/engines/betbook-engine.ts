
// betbook-engine.ts (v2)
//
// Sophisticated Sports Betting Analysis Engine
// Features: Edge calculation, risk management, arbitrage detection, multi-sport plugins

import OpenAI from 'openai';

export interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
  bettingInsights: string[];
  confidence: number; // 0-100
  signals?: Signal[];
}

export interface AlertContext {
  sport: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning?: number;
  period?: string;
  probability?: number;
  priority?: number;
  gameState?: string;
  halfInning?: string;
  outs?: number;
  runners?: { first?: boolean; second?: boolean; third?: boolean };
  windMph?: number;
  windTowardOF?: boolean;
  offeredOdds?: {
    moneyline?: { home: number; away: number };
    total?: { number: number; over: number; under: number };
    spread?: { number: number; home: number; away: number };
  };
}

export interface Line {
  book: string;
  type: 'MONEYLINE' | 'TOTAL' | 'SPREAD';
  selection: string;
  priceAmerican: number;
  timestamp: number;
}

export interface Signal {
  strategy: string;
  title: string;
  selection: string;
  confidence: number; // 0-100
  edges: Edge[];
  reasoning: string[];
}

export interface Edge {
  book: string;
  selection: string;
  fairOdds: number;
  offeredOdds: number;
  impliedProb: number;
  fairProb: number;
  edgePct: number;
  expectedValue: number;
  stakeUnits: number;
}

export class BetbookEngine {
  private client?: OpenAI;
  private useOpenAI: boolean;
  private linesRegistry = new Map<string, Line[]>();
  private dedupeCache = new Map<string, number>();
  private readonly DEDUPE_TTL = 300000; // 5 minutes

  constructor(options: { useOpenAI?: boolean } = {}) {
    this.useOpenAI = options.useOpenAI ?? true;
    if (this.useOpenAI && process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    console.log('💰 Betbook AI Engine v2 initialized');
  }

  /**
   * Register sportsbook lines for a game
   */
  registerLines(gameId: string, lines: Line[]): void {
    this.linesRegistry.set(gameId, lines);
    this.detectArbitrage(gameId, lines);
  }

  /**
   * Main evaluation function - returns betting signals
   */
  evaluate(ctx: AlertContext): Signal[] {
    const cacheKey = this.buildCacheKey(ctx);
    if (this.isDuplicate(cacheKey)) return [];

    const signals: Signal[] = [];
    
    // Sport-specific strategy plugins
    if (ctx.sport === 'MLB') signals.push(...this.mlbStrategies(ctx));
    if (ctx.sport === 'Tennis') signals.push(...this.tennisStrategies(ctx));
    
    // Filter and sort by confidence
    const validSignals = signals
      .filter(s => s.confidence >= 60)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    if (validSignals.length) {
      this.dedupeCache.set(cacheKey, Date.now());
    }

    return validSignals;
  }

  /**
   * Convert signals to UI-friendly BetbookData
   */
  async toBetbookData(ctx: AlertContext, signals: Signal[]): Promise<BetbookData> {
    return {
      odds: this.extractDisplayOdds(ctx),
      aiAdvice: this.useOpenAI && this.client ? 
        await this.generateAIAdvice(ctx, signals) : 
        this.fallbackAdvice(ctx, signals),
      sportsbookLinks: this.getSportsbookLinks(),
      bettingInsights: this.generateInsights(signals),
      confidence: signals.reduce((max, s) => Math.max(max, s.confidence), 0),
      signals
    };
  }

  // ===== MLB STRATEGIES =====
  private mlbStrategies(ctx: AlertContext): Signal[] {
    const signals: Signal[] = [];
    
    // RISP + Wind Strategy
    if (this.isRISP(ctx) && ctx.windTowardOF && (ctx.windMph ?? 0) >= 10) {
      const confidence = 75 + Math.min(15, (ctx.windMph ?? 0) - 10);
      signals.push({
        strategy: 'MLB_RISP_WIND',
        title: 'RISP + Favorable Wind',
        selection: 'OVER',
        confidence,
        edges: this.calculateEdges(ctx, 'TOTAL', 'OVER', 0.58),
        reasoning: [
          `Runners in scoring position with ${ctx.windMph}mph wind favoring hitters`,
          'Historical data shows 12% boost in run probability'
        ]
      });
    }

    // Late-inning close game moneyline
    if ((ctx.inning ?? 0) >= 7 && Math.abs(ctx.homeScore - ctx.awayScore) <= 1) {
      const homeAdvantage = ctx.halfInning === 'bottom' ? 0.54 : 0.46;
      signals.push({
        strategy: 'MLB_LATE_CLOSE',
        title: 'Late Inning Close Game',
        selection: ctx.halfInning === 'bottom' ? 'HOME' : 'AWAY',
        confidence: 68,
        edges: this.calculateEdges(ctx, 'MONEYLINE', ctx.halfInning === 'bottom' ? 'HOME' : 'AWAY', homeAdvantage),
        reasoning: [
          `${ctx.inning}th inning, 1-run game`,
          `${ctx.halfInning === 'bottom' ? 'Home' : 'Away'} team advantage in situation`
        ]
      });
    }

    return signals;
  }

  // ===== TENNIS STRATEGIES =====
  private tennisStrategies(ctx: AlertContext): Signal[] {
    const signals: Signal[] = [];
    
    // Service hold under pressure
    if (ctx.gameState?.includes('break point')) {
      signals.push({
        strategy: 'TENNIS_BREAK_POINT',
        title: 'Break Point Opportunity',
        selection: 'BREAK',
        confidence: 72,
        edges: this.calculateEdges(ctx, 'NEXT_GAME', 'BREAK', 0.35),
        reasoning: [
          'Server under pressure on break point',
          'Historical break conversion rates favor returner'
        ]
      });
    }

    return signals;
  }

  // ===== EDGE CALCULATION =====
  private calculateEdges(ctx: AlertContext, betType: string, selection: string, fairProb: number): Edge[] {
    const lines = this.linesRegistry.get(ctx.gameId) || [];
    const relevantLines = lines.filter(l => 
      (betType === 'MONEYLINE' && l.type === 'MONEYLINE') ||
      (betType === 'TOTAL' && l.type === 'TOTAL') ||
      (betType === 'SPREAD' && l.type === 'SPREAD')
    );

    return relevantLines.map(line => {
      const impliedProb = this.americanToImplied(line.priceAmerican);
      const edgePct = ((fairProb - impliedProb) / impliedProb) * 100;
      const expectedValue = fairProb * this.americanToDecimal(line.priceAmerican) - 1;
      
      // Kelly sizing (scaled conservatively)
      const kellyFraction = Math.max(0, (fairProb * this.americanToDecimal(line.priceAmerican) - 1) / (this.americanToDecimal(line.priceAmerican) - 1));
      const stakeUnits = Math.min(5, kellyFraction * 0.25 * 100); // 25% Kelly, max 5 units

      return {
        book: line.book,
        selection,
        fairOdds: this.impliedToAmerican(fairProb),
        offeredOdds: line.priceAmerican,
        impliedProb,
        fairProb,
        edgePct,
        expectedValue,
        stakeUnits
      };
    }).filter(edge => edge.edgePct > 2); // Only show edges > 2%
  }

  // ===== ARBITRAGE DETECTION =====
  private detectArbitrage(gameId: string, lines: Line[]): Signal[] {
    const signals: Signal[] = [];
    const moneylines = lines.filter(l => l.type === 'MONEYLINE');
    
    if (moneylines.length >= 2) {
      const homeLines = moneylines.filter(l => l.selection === 'HOME');
      const awayLines = moneylines.filter(l => l.selection === 'AWAY');
      
      for (const homeLine of homeLines) {
        for (const awayLine of awayLines) {
          if (homeLine.book !== awayLine.book) {
            const homeImplied = this.americanToImplied(homeLine.priceAmerican);
            const awayImplied = this.americanToImplied(awayLine.priceAmerican);
            const totalImplied = homeImplied + awayImplied;
            
            if (totalImplied < 0.98) { // Arbitrage opportunity
              signals.push({
                strategy: 'ARBITRAGE',
                title: 'Arbitrage Opportunity',
                selection: 'BOTH_SIDES',
                confidence: 95,
                edges: [],
                reasoning: [
                  `${homeLine.book}: ${homeLine.priceAmerican} vs ${awayLine.book}: ${awayLine.priceAmerican}`,
                  `Guaranteed profit: ${((1/totalImplied - 1) * 100).toFixed(2)}%`
                ]
              });
            }
          }
        }
      }
    }
    
    return signals;
  }

  // ===== HELPER FUNCTIONS =====
  private isRISP(ctx: AlertContext): boolean {
    return !!(ctx.runners?.second || ctx.runners?.third);
  }

  private americanToImplied(american: number): number {
    return american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);
  }

  private americanToDecimal(american: number): number {
    return american > 0 ? (american / 100) + 1 : (100 / Math.abs(american)) + 1;
  }

  private impliedToAmerican(implied: number): number {
    return implied >= 0.5 ? -((implied / (1 - implied)) * 100) : ((1 - implied) / implied) * 100;
  }

  private buildCacheKey(ctx: AlertContext): string {
    return `${ctx.gameId}:${ctx.inning || ctx.period}:${ctx.homeScore}-${ctx.awayScore}`;
  }

  private isDuplicate(key: string): boolean {
    const existing = this.dedupeCache.get(key);
    if (!existing) return false;
    
    const isExpired = Date.now() - existing > this.DEDUPE_TTL;
    if (isExpired) {
      this.dedupeCache.delete(key);
      return false;
    }
    return true;
  }

  private extractDisplayOdds(ctx: AlertContext) {
    return {
      home: ctx.offeredOdds?.moneyline?.home ?? -110,
      away: ctx.offeredOdds?.moneyline?.away ?? +100,
      total: ctx.offeredOdds?.total?.number ?? 8.5
    };
  }

  private generateInsights(signals: Signal[]): string[] {
    if (!signals.length) return ['No strong betting edges detected at this time'];
    
    return signals.slice(0, 3).map(s => 
      `${s.title}: ${s.confidence}% confidence`
    );
  }

  private getSportsbookLinks(): Array<{ name: string; url: string }> {
    return [
      { name: 'FanDuel', url: 'https://www.fanduel.com/' },
      { name: 'DraftKings', url: 'https://www.draftkings.com/' },
      { name: 'BetMGM', url: 'https://www.betmgm.com/' },
      { name: 'Caesars', url: 'https://www.caesars.com/sportsbook' }
    ];
  }

  /**
   * Generate AI-powered betting advice
   */
  private async generateAIAdvice(ctx: AlertContext, signals: Signal[]): Promise<string> {
    if (!this.client) return this.fallbackAdvice(ctx, signals);

    try {
      const prompt = `Analyze this ${ctx.sport} betting situation and provide brief advice (max 120 chars):

Game: ${ctx.awayTeam} @ ${ctx.homeTeam} (${ctx.awayScore}-${ctx.homeScore})
Signals: ${signals.map(s => s.title).join(', ')}
${ctx.probability ? `Scoring Probability: ${Math.round(ctx.probability * 100)}%` : ''}

Focus on timing and value opportunities.`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.3
      });

      return (completion.choices[0]?.message?.content || this.fallbackAdvice(ctx, signals)).trim();
    } catch (e) {
      console.error('AI advice error', e);
      return this.fallbackAdvice(ctx, signals);
    }
  }

  private fallbackAdvice(ctx: AlertContext, signals: Signal[]): string {
    if (!signals.length) return 'No actionable edge right now; wait for better prices or state changes.';
    const best = signals[0];
    return `Focus on ${best.selection} given ${best.confidence}% confidence. Size appropriately and avoid overexposure.`;
  }
}

// ===== BACKWARD COMPATIBILITY EXPORTS =====

const engineInstance = new BetbookEngine({ useOpenAI: true });

/**
 * Generate Betbook information for a given alert context using AI analysis
 */
export async function getBetbookData(alertContext: AlertContext): Promise<BetbookData> {
  const signals = engineInstance.evaluate(alertContext);
  return await engineInstance.toBetbookData(alertContext, signals);
}

/**
 * Legacy synchronous function
 */
export function getBetbookDataSync(alertContext: AlertContext): BetbookData {
  const engine = new BetbookEngine({ useOpenAI: false });
  const signals = engine.evaluate(alertContext);
  
  return {
    odds: {
      home: alertContext.offeredOdds?.moneyline?.home ?? -110,
      away: alertContext.offeredOdds?.moneyline?.away ?? +100,
      total: alertContext.offeredOdds?.total?.number ?? 8.5
    },
    aiAdvice: engine['fallbackAdvice'](alertContext, signals),
    sportsbookLinks: engine['getSportsbookLinks'](),
    bettingInsights: signals.length ? signals.map(s => `${s.title} (${s.confidence}% conf)`) : ['No strong edges detected'],
    confidence: signals.reduce((max, s) => Math.max(max, s.confidence), 60),
    signals
  };
}

/**
 * Check if Betbook should be available for this alert context
 */
export function shouldShowBetbook(alertContext: AlertContext): boolean {
  const isLive = (alertContext.gameState || '').toUpperCase() === 'LIVE';
  const hasTeams = !!alertContext.homeTeam && !!alertContext.awayTeam;
  return isLive && hasTeams;
}

/**
 * Self-check function for testing
 */
export function __selfCheck__() {
  const engine = new BetbookEngine({ useOpenAI: false });
  const ctx: AlertContext = {
    sport: 'MLB',
    gameId: 'TEST',
    homeTeam: 'Dodgers',
    awayTeam: 'Cubs',
    homeScore: 3,
    awayScore: 3,
    inning: 7,
    halfInning: 'bottom',
    outs: 1,
    runners: { second: true },
    windMph: 12,
    windTowardOF: true,
    gameState: 'LIVE',
    offeredOdds: { 
      total: { number: 8.5, over: +105, under: -110 }, 
      moneyline: { home: -115, away: +105 } 
    }
  };
  const signals = engine.evaluate(ctx);
  if (!signals.length) throw new Error('Expected at least one MLB signal');
  return signals;
}
