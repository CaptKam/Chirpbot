
export interface GameContext {
  // Game state
  runners: { first: boolean; second: boolean; third: boolean };
  outs: number;
  inning: number;
  inningState: 'top' | 'bottom';
  homeScore: number;
  awayScore: number;
  
  // Players
  batter: {
    name: string;
    hr: number;
    iso: number;
  };
  onDeck: {
    name: string;
    hr: number;
    iso: number;
  };
  pitcher: {
    name: string;
    pitchCount: number;
    isStarter: boolean;
  };
  
  // Situational
  leverageIndex: number;
  balls: number;
  strikes: number;
  platoonAdvantage: 'advantage' | 'neutral' | 'disadvantage';
  
  // Environmental
  wind: {
    mph: number;
    direction: string;
    toCenterField: boolean;
  };
  park: {
    hrFactor: number;
  };
  bullpenERA: number;
}

export type GameDelta = 
  | "basepath" 
  | "outs" 
  | "batter" 
  | "onDeck" 
  | "count_cross_2-0" 
  | "count_cross_3-1"
  | "pitcher_change" 
  | "def_change" 
  | "weather_delta" 
  | "inning_cross_7" 
  | "li_cross";

export interface HSSState {
  lastContext?: GameContext;
  nextAllowedEvalAt: number;
  lastAlertHash?: string;
  lastHSSScore: number;
}

export class HSSEngine {
  private gameStates = new Map<string, HSSState>();
  
  // Base-Out State scoring table (proxy for RE24)
  private baseOutTable = new Map<string, number>([
    ['___,0', 0.10], ['___,1', 0.07], ['___,2', 0.02],
    ['1__,0', 0.30], ['1__,1', 0.18], ['1__,2', 0.07],
    ['_2_,0', 0.40], ['_2_,1', 0.24], ['_2_,2', 0.10],
    ['__3,0', 0.60], ['__3,1', 0.35], ['__3,2', 0.15],
    ['12_,0', 0.55], ['12_,1', 0.32], ['12_,2', 0.12],
    ['1_3,0', 0.75], ['1_3,1', 0.45], ['1_3,2', 0.18],
    ['_23,0', 0.85], ['_23,1', 0.70], ['_23,2', 0.30], // Your key example: 2nd & 3rd, 1 out = 0.70
    ['123,0', 0.95], ['123,1', 0.90], ['123,2', 0.35], // Bases loaded scenarios
  ]);

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getBaseOutKey(runners: GameContext['runners'], outs: number): string {
    const first = runners.first ? '1' : '_';
    const second = runners.second ? '2' : '_';
    const third = runners.third ? '3' : '_';
    return `${first}${second}${third},${outs}`;
  }

  private getBaseOutScore(runners: GameContext['runners'], outs: number): number {
    const key = this.getBaseOutKey(runners, outs);
    return this.baseOutTable.get(key) || 0.05;
  }

  /**
   * Fast HSS Score calculation (0-1) - deterministic and cheap
   */
  public calculateHSSScore(ctx: GameContext): number {
    // Base-Out State (w=0.30)
    const baseOut = this.getBaseOutScore(ctx.runners, ctx.outs);
    
    // Leverage Index (w=0.15) - clamp to 0-1
    const li = this.clamp(ctx.leverageIndex / 3.0, 0, 1);
    
    // Score Tightness (w=0.10)
    const scoreDiff = Math.abs(ctx.homeScore - ctx.awayScore);
    const scoreTight = scoreDiff <= 1 ? 1.0 : (scoreDiff === 2 ? 0.7 : 0.2);
    
    // Batter Power (w=0.12)
    const batterPower = Math.max(
      ctx.batter.hr >= 25 ? 1 : 0,
      this.clamp(ctx.batter.iso / 0.25, 0, 1)
    );
    
    // On-Deck Power (w=0.08)
    const onDeckPower = ctx.onDeck.hr >= 20 ? 1 : this.clamp(ctx.onDeck.iso / 0.22, 0, 1);
    
    // Platoon Edge (w=0.05)
    const platoon = ctx.platoonAdvantage === 'advantage' ? 1.0 : 
                   (ctx.platoonAdvantage === 'neutral' ? 0.5 : 0.0);
    
    // Pitcher Fatigue (w=0.05)
    const fatigue = (ctx.pitcher.pitchCount > 75 && ctx.pitcher.isStarter) || 
                   (ctx.pitcher.pitchCount > 25 && !ctx.pitcher.isStarter) ? 1.0 : 0.0;
    
    // Bullpen Quality Opportunity (w=0.05)
    const penQual = this.clamp(1 - ctx.bullpenERA / 5.0, 0, 1);
    
    // Wind Toward Outfield (w=0.07)
    const windCF = ctx.wind.toCenterField ? this.clamp(ctx.wind.mph / 12.0, 0, 1) : 0;
    
    // Park HR Factor (w=0.03)
    const park = this.clamp(ctx.park.hrFactor / 110.0, 0.5, 1);
    
    // Weighted sum
    return 0.30 * baseOut + 
           0.15 * li + 
           0.10 * scoreTight + 
           0.12 * batterPower +
           0.08 * onDeckPower + 
           0.05 * platoon + 
           0.05 * fatigue + 
           0.05 * penQual +
           0.07 * windCF + 
           0.03 * park;
  }

  /**
   * Determine situation tier for threshold selection
   */
  private getSituationTier(ctx: GameContext): 'cold' | 'warm' | 'hot' {
    const isHot = (ctx.leverageIndex >= 2.0) || 
                  (ctx.inning >= 7 && Math.abs(ctx.homeScore - ctx.awayScore) <= 1);
    
    const isWarm = (ctx.runners.second || ctx.runners.third) || 
                   Math.abs(ctx.homeScore - ctx.awayScore) <= 2;
    
    return isHot ? 'hot' : (isWarm ? 'warm' : 'cold');
  }

  /**
   * Get threshold based on situation tier
   */
  private getThreshold(tier: 'cold' | 'warm' | 'hot'): number {
    switch (tier) {
      case 'hot': return 0.40;    // Critical situations
      case 'warm': return 0.55;   // Scoring opportunities
      case 'cold': return 0.70;   // Low-leverage situations
    }
  }

  /**
   * Get TTL (cooldown) based on situation tier
   */
  private getTTL(tier: 'cold' | 'warm' | 'hot'): number {
    switch (tier) {
      case 'hot': return 6000;    // 6 seconds
      case 'warm': return 25000;  // 25 seconds
      case 'cold': return 60000;  // 60 seconds
    }
  }

  /**
   * Identify what changed between contexts
   */
  public identifyDeltas(prevCtx: GameContext | undefined, newCtx: GameContext): GameDelta[] {
    if (!prevCtx) return ['batter']; // First time seeing this game
    
    const deltas: GameDelta[] = [];
    
    // Base/outs changes
    if (prevCtx.runners.first !== newCtx.runners.first ||
        prevCtx.runners.second !== newCtx.runners.second ||
        prevCtx.runners.third !== newCtx.runners.third) {
      deltas.push('basepath');
    }
    
    if (prevCtx.outs !== newCtx.outs) {
      deltas.push('outs');
    }
    
    // Batter/on-deck changes
    if (prevCtx.batter.name !== newCtx.batter.name) {
      deltas.push('batter');
    }
    
    if (prevCtx.onDeck.name !== newCtx.onDeck.name) {
      deltas.push('onDeck');
    }
    
    // Count crosses
    if ((prevCtx.balls < 2 && newCtx.balls === 2 && newCtx.strikes === 0) ||
        (prevCtx.balls < 3 && newCtx.balls === 3 && newCtx.strikes === 1)) {
      deltas.push(newCtx.balls === 2 ? 'count_cross_2-0' : 'count_cross_3-1');
    }
    
    // Pitcher change
    if (prevCtx.pitcher.name !== newCtx.pitcher.name) {
      deltas.push('pitcher_change');
    }
    
    // Weather delta (≥5 mph or ≥45° direction change)
    if (Math.abs(prevCtx.wind.mph - newCtx.wind.mph) >= 5 ||
        prevCtx.wind.direction !== newCtx.wind.direction) {
      deltas.push('weather_delta');
    }
    
    // Inning crosses
    if (prevCtx.inning < 7 && newCtx.inning >= 7) {
      deltas.push('inning_cross_7');
    }
    
    // Leverage Index crosses
    if (Math.abs(prevCtx.leverageIndex - newCtx.leverageIndex) >= 0.5) {
      deltas.push('li_cross');
    }
    
    return deltas;
  }

  /**
   * Check if we should run LLM evaluation
   */
  public shouldRunLLM(gameId: string, ctx: GameContext, deltas: GameDelta[]): boolean {
    const state = this.gameStates.get(gameId) || { 
      nextAllowedEvalAt: 0, 
      lastHSSScore: 0 
    };
    
    const score = this.calculateHSSScore(ctx);
    const tier = this.getSituationTier(ctx);
    const threshold = this.getThreshold(tier);
    
    // Check if we're past TTL
    const pastTTL = Date.now() >= state.nextAllowedEvalAt;
    
    // Major deltas that should trigger immediate re-evaluation
    const majorDelta = deltas.some(d => 
      ['basepath', 'batter', 'onDeck', 'pitcher_change', 'weather_delta'].includes(d)
    );
    
    // One-liner rule: IF runners={2B,3B} AND outs=1 AND onDeck.HR≥20 AND wind.toCF≥8 mph
    const specialRule = ctx.runners.second && ctx.runners.third && 
                       ctx.outs === 1 && ctx.onDeck.hr >= 20 && 
                       ctx.wind.toCenterField && ctx.wind.mph >= 8;
    
    // Score improvement check (≥15% increase)
    const significantImprovement = score >= (state.lastHSSScore * 1.15);
    
    const shouldRun = (score >= threshold && pastTTL) || 
                     (majorDelta && pastTTL) || 
                     specialRule || 
                     significantImprovement;
    
    // Update state
    this.gameStates.set(gameId, {
      ...state,
      lastContext: ctx,
      lastHSSScore: score
    });
    
    return shouldRun;
  }

  /**
   * Set cooldown after LLM evaluation
   */
  public setCooldown(gameId: string, ctx: GameContext): void {
    const state = this.gameStates.get(gameId) || { 
      nextAllowedEvalAt: 0, 
      lastHSSScore: 0 
    };
    
    const tier = this.getSituationTier(ctx);
    const ttl = this.getTTL(tier);
    
    this.gameStates.set(gameId, {
      ...state,
      nextAllowedEvalAt: Date.now() + ttl
    });
  }

  /**
   * Check for duplicate alerts
   */
  public isDuplicateAlert(gameId: string, alertHash: string): boolean {
    const state = this.gameStates.get(gameId);
    return state?.lastAlertHash === alertHash;
  }

  /**
   * Mark alert as sent
   */
  public markAlertSent(gameId: string, alertHash: string): void {
    const state = this.gameStates.get(gameId) || { 
      nextAllowedEvalAt: 0, 
      lastHSSScore: 0 
    };
    
    this.gameStates.set(gameId, {
      ...state,
      lastAlertHash: alertHash
    });
  }

  /**
   * Generate example from your guidelines
   */
  public exampleCalculation(): void {
    const exampleCtx: GameContext = {
      runners: { first: false, second: true, third: true },
      outs: 1,
      inning: 8,
      inningState: 'bottom',
      homeScore: 3,
      awayScore: 4,
      batter: { name: 'Power Hitter', hr: 22, iso: 0.220 },
      onDeck: { name: 'Slugger', hr: 25, iso: 0.280 },
      pitcher: { name: 'Tired Starter', pitchCount: 95, isStarter: true },
      leverageIndex: 1.6,
      balls: 2,
      strikes: 1,
      platoonAdvantage: 'advantage',
      wind: { mph: 10, direction: 'S', toCenterField: true },
      park: { hrFactor: 105 },
      bullpenERA: 4.2
    };

    const score = this.calculateHSSScore(exampleCtx);
    console.log(`🎯 HSS Example Score: ${score.toFixed(3)}`);
    console.log(`   - Base-Out (2nd&3rd, 1 out): 0.70 × 0.30 = ${(0.70 * 0.30).toFixed(3)}`);
    console.log(`   - Wind to CF (10 mph): ${(10/12).toFixed(2)} × 0.07 = ${((10/12) * 0.07).toFixed(3)}`);
    console.log(`   - On-deck power (HR≥20): 1.0 × 0.08 = 0.080`);
    console.log(`   - Leverage Index (1.6): ${(1.6/3).toFixed(2)} × 0.15 = ${((1.6/3) * 0.15).toFixed(3)}`);
    console.log(`   - Score tightness (1-run): 1.0 × 0.10 = 0.100`);
    console.log(`   - Batter power (ISO .220): ${(0.22/0.25).toFixed(2)} × 0.12 = ${((0.22/0.25) * 0.12).toFixed(3)}`);
  }
}

export const hssEngine = new HSSEngine();
