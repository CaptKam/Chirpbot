import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BatterDueModule extends BaseAlertModule {
  alertType = 'MLB_BATTER_DUE';
  sport = 'MLB';

  // RE24 Matrix: Expected runs based on base-out state (2019-2023 MLB averages - accurate values)
  private readonly RE24_MATRIX = {
    '000_0': 0.502,  // Bases empty, 0 outs
    '000_1': 0.257,  // Bases empty, 1 out  
    '000_2': 0.099,  // Bases empty, 2 outs
    '001_0': 0.867,  // Runner on 1st, 0 outs
    '001_1': 0.509,  // Runner on 1st, 1 out
    '001_2': 0.214,  // Runner on 1st, 2 outs
    '010_0': 1.189,  // Runner on 2nd, 0 outs  
    '010_1': 0.657,  // Runner on 2nd, 1 out
    '010_2': 0.305,  // Runner on 2nd, 2 outs
    '011_0': 1.541,  // Runners on 1st and 2nd, 0 outs
    '011_1': 0.927,  // Runners on 1st and 2nd, 1 out
    '011_2': 0.412,  // Runners on 1st and 2nd, 2 outs
    '100_0': 1.373,  // Runner on 3rd, 0 outs
    '100_1': 0.950,  // Runner on 3rd, 1 out
    '100_2': 0.382,  // Runner on 3rd, 2 outs  
    '101_0': 1.740,  // Runners on 1st and 3rd, 0 outs
    '101_1': 1.202,  // Runners on 1st and 3rd, 1 out
    '101_2': 0.489,  // Runners on 1st and 3rd, 2 outs
    '110_0': 1.955,  // Runners on 2nd and 3rd, 0 outs
    '110_1': 1.293,  // Runners on 2nd and 3rd, 1 out
    '110_2': 0.587,  // Runners on 2nd and 3rd, 2 outs
    '111_0': 2.350,  // Bases loaded, 0 outs
    '111_1': 1.546,  // Bases loaded, 1 out
    '111_2': 0.694   // Bases loaded, 2 outs
  };

  // RP24 Matrix: Probability of scoring at least one run (complementing RE24)
  private readonly RP24_MATRIX = {
    '000_0': 0.274,  // Bases empty, 0 outs
    '000_1': 0.157,  // Bases empty, 1 out  
    '000_2': 0.068,  // Bases empty, 2 outs
    '001_0': 0.416,  // Runner on 1st, 0 outs
    '001_1': 0.260,  // Runner on 1st, 1 out
    '001_2': 0.125,  // Runner on 1st, 2 outs
    '010_0': 0.607,  // Runner on 2nd, 0 outs  
    '010_1': 0.407,  // Runner on 2nd, 1 out
    '010_2': 0.214,  // Runner on 2nd, 2 outs
    '011_0': 0.655,  // Runners on 1st and 2nd, 0 outs
    '011_1': 0.459,  // Runners on 1st and 2nd, 1 out
    '011_2': 0.251,  // Runners on 1st and 2nd, 2 outs
    '100_0': 0.841,  // Runner on 3rd, 0 outs
    '100_1': 0.656,  // Runner on 3rd, 1 out
    '100_2': 0.294,  // Runner on 3rd, 2 outs  
    '101_0': 0.867,  // Runners on 1st and 3rd, 0 outs
    '101_1': 0.703,  // Runners on 1st and 3rd, 1 out
    '101_2': 0.351,  // Runners on 1st and 3rd, 2 outs
    '110_0': 0.900,  // Runners on 2nd and 3rd, 0 outs
    '110_1': 0.767,  // Runners on 2nd and 3rd, 1 out
    '110_2': 0.426,  // Runners on 2nd and 3rd, 2 outs
    '111_0': 0.908,  // Bases loaded, 0 outs
    '111_1': 0.782,  // Bases loaded, 1 out
    '111_2': 0.453   // Bases loaded, 2 outs
  };

  // Cached probability to prevent flapping - computed once per unique game state
  private probabilityCache: { [key: string]: number } = {};
  
  // Hysteresis thresholds to prevent alert flapping
  private readonly TRIGGER_THRESHOLD = 62; // Trigger alert at 62%
  private readonly CLEAR_THRESHOLD = 55;   // Clear alert at 55%
  private lastTriggeredState: { [gameId: string]: boolean } = {};

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    // Only trigger in the middle to late innings (4+) when games get more strategic
    if (!gameState.inning || gameState.inning < 4) return false;

    const probability = this.getScoringProbability(gameState);
    const gameId = gameState.gameId;
    const wasTriggered = this.lastTriggeredState[gameId] || false;
    
    // Implement hysteresis to prevent flapping
    let shouldTrigger;
    if (wasTriggered) {
      // If already triggered, clear only when probability drops below clear threshold
      shouldTrigger = probability >= this.CLEAR_THRESHOLD;
    } else {
      // If not triggered, trigger when probability exceeds trigger threshold
      shouldTrigger = probability >= this.TRIGGER_THRESHOLD;
    }
    
    // Update state
    this.lastTriggeredState[gameId] = shouldTrigger;
    
    return shouldTrigger;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    // Use cached probability to ensure consistency
    const scoringProbability = this.getScoringProbability(gameState);
    const gameContext = this.analyzeGameSituation(gameState);
    const lineupContext = this.analyzeLineupData(gameState);
    
    // Create dynamic message based on the specific situation
    let alertMessage = this.generateAlertMessage(scoringProbability, gameContext, lineupContext);

    // More granular alertKey with base/out/lineup context
    const baseOutState = this.getBaseOutStateKey(gameState);
    const currentBatter = gameState.currentBatter || 'unknown';
    const alertKey = `${gameState.gameId}_batter_due_${gameState.inning}_${gameState.isTopInning ? 'top' : 'bottom'}_${baseOutState}_${currentBatter.replace(/\s+/g, '_')}`;

    return {
      alertKey,
      type: this.alertType,
      message: alertMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        hasFirst: gameState.hasFirst || false,
        hasSecond: gameState.hasSecond || false,
        hasThird: gameState.hasThird || false,
        outs: gameState.outs || 0,
        balls: gameState.balls || 0,
        strikes: gameState.strikes || 0,
        scenarioName: 'Batter Due Prediction',
        scoringProbability: scoringProbability,
        predictionType: 'upcoming_batters',
        gameContext,
        lineupContext,
        re24Value: this.getCurrentRE24Value(gameState),
        rp24Value: this.getCurrentRP24Value(gameState),
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        baseOutState,
        // Predictive metadata
        alertTiming: 'predictive',
        confidence: this.calculateConfidenceLevel(scoringProbability),
        leverageIndex: this.calculateLeverageIndex(gameState)
      },
      priority: Math.min(95, 60 + Math.round(scoringProbability * 0.4)) // More conservative priority scaling
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.getScoringProbability(gameState);
  }

  private getScoringProbability(gameState: GameState): number {
    // Create unique cache key for this specific game state
    const cacheKey = this.createGameStateKey(gameState);
    
    // Return cached value if available to prevent flapping
    if (this.probabilityCache[cacheKey] !== undefined) {
      return this.probabilityCache[cacheKey];
    }

    // Calculate probability using deterministic baseball statistics
    const probability = this.calculateDeterministicProbability(gameState);
    
    // Cache the result for this specific game state
    this.probabilityCache[cacheKey] = probability;
    return probability;
  }

  private createGameStateKey(gameState: GameState): string {
    // Create a unique key that represents the exact game state
    return [
      gameState.gameId,
      gameState.inning,
      gameState.isTopInning ? 'top' : 'bottom',
      gameState.hasFirst ? '1' : '0',
      gameState.hasSecond ? '1' : '0', 
      gameState.hasThird ? '1' : '0',
      gameState.outs,
      gameState.balls,
      gameState.strikes,
      gameState.homeScore,
      gameState.awayScore
    ].join('_');
  }

  private calculateDeterministicProbability(gameState: GameState): number {
    // Use RP24 (Run Probability) as base - more direct measure of scoring likelihood
    const baseRP24 = this.getCurrentRP24Value(gameState);
    const currentRE24 = this.getCurrentRE24Value(gameState);
    
    // Start with RP24 as base probability (already a percentage)
    let probability = baseRP24 * 100;
    
    // Apply logistic scaling for RE24 influence (prevents oversaturation)
    const re24Factor = this.logisticScale(currentRE24, 1.2, 10); // Scale factor and steepness
    probability = probability * (1 + re24Factor);

    // Add situational modifiers
    probability += this.getInningLeverageFactor(gameState.inning || 1);
    probability += this.getGameSituationFactor(gameState);
    probability += this.getCountSituationFactor(gameState.balls || 0, gameState.strikes || 0);
    probability += this.getRealLineupStrengthFactor(gameState);
    probability += this.getPitcherBatterMatchupFactor(gameState);

    // Apply calibrated bounds (more realistic than hard caps)
    return this.calibrateScoreBounds(probability, gameState);
  }

  private getCurrentRE24Value(gameState: GameState): number {
    // Build base-out state key for RE24 lookup
    const baseState = [
      gameState.hasThird ? '1' : '0',
      gameState.hasSecond ? '1' : '0', 
      gameState.hasFirst ? '1' : '0'
    ].join('');
    
    const outs = Math.min(2, gameState.outs || 0); // Cap at 2 outs
    const re24Key = `${baseState}_${outs}`;
    
    return this.RE24_MATRIX[re24Key as keyof typeof this.RE24_MATRIX] || 0.25;
  }

  private getInningLeverageFactor(inning: number): number {
    // Leverage increases in later innings (deterministic)
    if (inning >= 9) return 15; // 9th inning and extras - highest leverage
    if (inning >= 7) return 12; // 7-8th innings - high leverage
    if (inning >= 5) return 8;  // 5-6th innings - medium leverage
    if (inning >= 4) return 5;  // 4th inning - building leverage
    return 2; // Earlier innings - lower leverage
  }

  private getGameSituationFactor(gameState: GameState): number {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Game situation affects scoring urgency (deterministic)
    if (scoreDiff === 0) return 12; // Tied game - maximum urgency
    if (scoreDiff === 1) return 10; // One-run game - high urgency
    if (scoreDiff === 2) return 7;  // Two-run game - moderate urgency
    if (scoreDiff === 3) return 4;  // Three-run game - some urgency
    if (scoreDiff <= 5) return 1;   // Still within reach
    return -3; // Blowout - reduced urgency
  }

  private getCountSituationFactor(balls: number, strikes: number): number {
    // Count situation affects at-bat outcome probability (deterministic)
    if (balls >= 3) return 6; // Full count or walk - high pressure on pitcher
    if (balls >= 2 && strikes <= 1) return 4; // Hitter's count (2-0, 2-1, 3-1)
    if (balls > strikes) return 2; // Ahead in count
    if (strikes >= 2) return -2; // Pitcher ahead (0-2, 1-2)
    return 0; // Neutral count
  }

  private getRealLineupStrengthFactor(gameState: GameState): number {
    const lineupData = gameState.lineupData;
    if (!lineupData) {
      // Fallback to estimative method if no real data available
      return this.getFallbackLineupFactor(gameState);
    }
    
    let lineupFactor = 0;
    
    // Current batter strength from real lineup data
    const currentStrength = lineupData.currentBatterStrength;
    switch (currentStrength) {
      case 'elite': lineupFactor += 8; break;
      case 'strong': lineupFactor += 5; break;
      case 'average': lineupFactor += 2; break;
      case 'weak': lineupFactor += 0; break;
    }
    
    // Next batter strength (smaller impact)
    const nextStrength = lineupData.nextBatterStrength;
    switch (nextStrength) {
      case 'elite': lineupFactor += 4; break;
      case 'strong': lineupFactor += 2; break;
      case 'average': lineupFactor += 1; break;
      case 'weak': lineupFactor += 0; break;
    }
    
    // On-deck batter (even smaller impact)
    const onDeckStrength = lineupData.onDeckBatterStrength;
    switch (onDeckStrength) {
      case 'elite': lineupFactor += 2; break;
      case 'strong': lineupFactor += 1; break;
      case 'average': lineupFactor += 0; break;
      case 'weak': lineupFactor += -1; break;
    }
    
    // Late inning pinch hitting factor
    if ((gameState.inning || 1) >= 7) {
      lineupFactor += 3; // Managers optimize lineups in key situations
    }
    
    return lineupFactor;
  }

  private getFallbackLineupFactor(gameState: GameState): number {
    // Fallback to original synthetic method if no real lineup data
    const inning = gameState.inning || 1;
    const outs = gameState.outs || 0;
    const estimatedPosition = ((inning - 1) * 3 + outs) % 9 + 1;
    
    const strength = this.getBatterStrengthByPosition(estimatedPosition);
    switch (strength) {
      case 'elite': return 6;
      case 'strong': return 4;
      case 'average': return 2;
      case 'weak': return 0;
    }
    return 2;
  }

  private getBatterStrengthByPosition(position: number): 'elite' | 'strong' | 'average' | 'weak' {
    // Standard MLB batting order strength patterns (deterministic)
    if (position >= 1 && position <= 2) return 'elite';   // 1-2: Best contact/speed hitters
    if (position >= 3 && position <= 5) return 'strong';  // 3-5: Best power hitters  
    if (position >= 6 && position <= 7) return 'average'; // 6-7: Average hitters
    return 'weak'; // 8-9: Weakest hitters (including pitcher in NL)
  }

  private generateAlertMessage(scoringProbability: number, gameContext: any, lineupContext: any): string {
    const roundedProb = Math.round(scoringProbability);
    const currentBatter = lineupContext.currentBatterName || 'batter';
    
    if (gameContext.isCloseGame && gameContext.hasRunnersInScoringPosition) {
      return `🔥 CLUTCH MOMENT: ${roundedProb}% scoring chance - ${currentBatter} with runners in scoring position!`;
    } else if (gameContext.isHighLeverage && lineupContext.hasStrongUpcomingHitters) {
      return `⚡ HIGH LEVERAGE: ${roundedProb}% scoring chance - strong lineup sequence coming up!`;
    } else if (gameContext.isLateInning && lineupContext.currentBatterStrength === 'elite') {
      return `⏰ CLUTCH HITTER: ${roundedProb}% scoring chance - elite batter ${currentBatter} at the plate!`;
    } else if (gameContext.hasRunnersInScoringPosition && lineupContext.favorablePitcherMatchup) {
      return `💥 FAVORABLE MATCHUP: ${roundedProb}% scoring chance - ${currentBatter} vs favorable pitcher!`;
    } else if (lineupContext.hasStrongUpcomingHitters) {
      return `⚡ STRONG LINEUP: ${roundedProb}% scoring chance - powerful hitters coming to bat!`;
    } else {
      return `📈 SCORING OPPORTUNITY: ${roundedProb}% chance with current lineup sequence!`;
    }
  }

  private analyzeGameSituation(gameState: GameState): any {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const inning = gameState.inning || 1;
    
    return {
      isCloseGame: scoreDiff <= 2,
      isTiedGame: scoreDiff === 0,
      isLateInning: inning >= 7,
      isExtraInnings: inning >= 10,
      hasRunnersOnBase: gameState.hasFirst || gameState.hasSecond || gameState.hasThird,
      hasRunnersInScoringPosition: gameState.hasSecond || gameState.hasThird,
      isHighLeverage: (inning >= 7 && scoreDiff <= 3) || (inning >= 9 && scoreDiff <= 1),
      outs: gameState.outs || 0,
      inning: inning,
      scoreDifferential: scoreDiff,
      currentRE24: this.getCurrentRE24Value(gameState)
    };
  }

  private calculateConfidenceLevel(probability: number): string {
    // Confidence based on probability strength (deterministic)
    if (probability >= 80) return 'very_high';
    if (probability >= 70) return 'high';
    if (probability >= 60) return 'medium_high';
    if (probability >= 50) return 'medium';
    return 'low';
  }

  // New helper methods for enhanced baseball analysis
  
  private getCurrentRP24Value(gameState: GameState): number {
    const baseOutState = this.getBaseOutStateKey(gameState);
    return this.RP24_MATRIX[baseOutState as keyof typeof this.RP24_MATRIX] || 0.10;
  }
  
  private getBaseOutStateKey(gameState: GameState): string {
    const baseState = [
      gameState.hasThird ? '1' : '0',
      gameState.hasSecond ? '1' : '0', 
      gameState.hasFirst ? '1' : '0'
    ].join('');
    const outs = Math.min(2, gameState.outs || 0);
    return `${baseState}_${outs}`;
  }
  
  private logisticScale(value: number, midpoint: number, steepness: number): number {
    // Logistic function to prevent oversaturation at high values
    return 1 / (1 + Math.exp(-steepness * (value - midpoint))) - 0.5;
  }
  
  private calibrateScoreBounds(probability: number, gameState: GameState): number {
    // More intelligent bounds based on game situation
    const minProb = gameState.hasThird ? 20 : 10; // Higher floor with RISP
    const maxProb = (gameState.inning || 1) >= 9 ? 92 : 88; // Higher ceiling in late innings
    
    return Math.max(minProb, Math.min(probability, maxProb));
  }
  
  private analyzeLineupData(gameState: GameState): any {
    const lineupData = gameState.lineupData;
    const currentBatter = gameState.currentBatter;
    const currentPitcher = gameState.currentPitcher;
    
    // Analyze upcoming hitter strength
    const hasStrongUpcomingHitters = lineupData && 
      (lineupData.currentBatterStrength === 'elite' || lineupData.currentBatterStrength === 'strong') &&
      (lineupData.nextBatterStrength === 'elite' || lineupData.nextBatterStrength === 'strong');
    
    // Analyze pitcher-batter matchup favorability
    const favorablePitcherMatchup = this.assessPitcherBatterMatchup(currentBatter, currentPitcher);
    
    return {
      currentBatterName: currentBatter ? currentBatter.split(' ').slice(-1)[0] : 'unknown', // Last name only
      currentBatterStrength: lineupData?.currentBatterStrength || 'average',
      nextBatterStrength: lineupData?.nextBatterStrength || 'average',
      onDeckBatterStrength: lineupData?.onDeckBatterStrength || 'average',
      hasStrongUpcomingHitters,
      favorablePitcherMatchup,
      battingOrder: lineupData?.currentBatterOrder || 1,
      nextBattingOrder: lineupData?.nextBatterOrder || 2
    };
  }
  
  private getPitcherBatterMatchupFactor(gameState: GameState): number {
    // Placeholder for pitcher-batter matchup analysis
    // In a full implementation, this would analyze L/R handedness, recent performance, etc.
    const currentBatter = gameState.currentBatter;
    const currentPitcher = gameState.currentPitcher;
    
    if (!currentBatter || !currentPitcher) return 0;
    
    // Simple heuristic: favorable matchup adds 2-3 points
    const isFavorable = this.assessPitcherBatterMatchup(currentBatter, currentPitcher);
    return isFavorable ? 3 : 0;
  }
  
  private assessPitcherBatterMatchup(batter: string, pitcher: string): boolean {
    // Placeholder for advanced matchup analysis
    // In full implementation would check handedness, historical performance, etc.
    // For now, return random favorable matchup for demonstration
    if (!batter || !pitcher) return false;
    
    // Simple heuristic based on name hash for demonstration
    const hash = (batter + pitcher).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return Math.abs(hash) % 3 === 0; // ~33% favorable matchups
  }
  
  private calculateLeverageIndex(gameState: GameState): number {
    // Simplified Leverage Index calculation
    const inning = gameState.inning || 1;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const outs = gameState.outs || 0;
    
    let leverage = 1.0; // Base leverage
    
    // Inning factor
    if (inning >= 9) leverage *= 2.5;
    else if (inning >= 7) leverage *= 1.8;
    else if (inning >= 5) leverage *= 1.3;
    
    // Score differential factor  
    if (scoreDiff === 0) leverage *= 2.0; // Tied game
    else if (scoreDiff === 1) leverage *= 1.7; // One-run game
    else if (scoreDiff === 2) leverage *= 1.3; // Two-run game
    else if (scoreDiff >= 5) leverage *= 0.6; // Blowout
    
    // Outs factor
    if (outs === 2) leverage *= 1.4; // Two outs increases pressure
    else if (outs === 1) leverage *= 1.1;
    
    return Math.round(leverage * 100) / 100; // Round to 2 decimal places
  }
}