import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class BatterDueModule extends BaseAlertModule {
  alertType = 'MLB_BATTER_DUE';
  sport = 'MLB';

  // RE24 Matrix: Expected runs based on base-out state (standardized baseball statistics)
  private readonly RE24_MATRIX = {
    '000_0': 0.4804,  // Bases empty, 0 outs
    '000_1': 0.2555,  // Bases empty, 1 out  
    '000_2': 0.1034,  // Bases empty, 2 outs
    '001_0': 1.3707,  // Runner on 1st, 0 outs
    '001_1': 0.8946,  // Runner on 1st, 1 out
    '001_2': 0.3320,  // Runner on 1st, 2 outs
    '010_0': 1.1599,  // Runner on 2nd, 0 outs  
    '010_1': 0.6823,  // Runner on 2nd, 1 out
    '010_2': 0.3141,  // Runner on 2nd, 2 outs
    '011_0': 1.9845,  // Runners on 1st and 2nd, 0 outs
    '011_1': 1.2935,  // Runners on 1st and 2nd, 1 out
    '011_2': 0.4675,  // Runners on 1st and 2nd, 2 outs
    '100_0': 2.2566,  // Runner on 3rd, 0 outs
    '100_1': 1.3781,  // Runner on 3rd, 1 out
    '100_2': 0.3584,  // Runner on 3rd, 2 outs  
    '101_0': 2.9881,  // Runners on 1st and 3rd, 0 outs
    '101_1': 1.9635,  // Runners on 1st and 3rd, 1 out
    '101_2': 0.6318,  // Runners on 1st and 3rd, 2 outs
    '110_0': 2.7623,  // Runners on 2nd and 3rd, 0 outs
    '110_1': 1.6475,  // Runners on 2nd and 3rd, 1 out
    '110_2': 0.5808,  // Runners on 2nd and 3rd, 2 outs
    '111_0': 3.4039,  // Bases loaded, 0 outs
    '111_1': 2.2920,  // Bases loaded, 1 out
    '111_2': 0.7540   // Bases loaded, 2 outs
  };

  // Cached probability to prevent flapping - computed once per unique game state
  private probabilityCache: { [key: string]: number } = {};

  isTriggered(gameState: GameState): boolean {
    if (gameState.status !== 'live') return false;

    // Only trigger in the middle to late innings (4+) when games get more strategic
    if (!gameState.inning || gameState.inning < 4) return false;

    const probability = this.getScoringProbability(gameState);
    
    // Trigger when there's >65% chance of scoring in current inning
    return probability >= 65;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    // Use cached probability to ensure consistency
    const scoringProbability = this.getScoringProbability(gameState);
    const gameContext = this.analyzeGameSituation(gameState);
    
    // Create dynamic message based on the specific situation
    let alertMessage = this.generateAlertMessage(scoringProbability, gameContext);

    return {
      alertKey: `${gameState.gameId}_batter_due_inning_${gameState.inning}_${gameState.isTopInning ? 'top' : 'bottom'}`,
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
        re24Value: this.getCurrentRE24Value(gameState),
        // Predictive metadata
        alertTiming: 'predictive',
        confidence: this.calculateConfidenceLevel(scoringProbability)
      },
      priority: Math.min(95, 60 + Math.round(scoringProbability)) // Scale priority with probability
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
    // Get current RE24 value for base-out state
    const currentRE24 = this.getCurrentRE24Value(gameState);
    
    // Calculate base probability from RE24 matrix
    let probability = Math.min(85, currentRE24 * 25); // Scale RE24 to percentage

    // Add deterministic modifiers based on game situation
    probability += this.getInningLeverageFactor(gameState.inning || 1);
    probability += this.getGameSituationFactor(gameState);
    probability += this.getCountSituationFactor(gameState.balls || 0, gameState.strikes || 0);
    probability += this.getLineupStrengthFactor(gameState);

    // Cap the probability between realistic bounds
    return Math.max(15, Math.min(probability, 85));
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

  private getLineupStrengthFactor(gameState: GameState): number {
    // Deterministic lineup analysis based on batting order progression
    const inning = gameState.inning || 1;
    const outs = gameState.outs || 0;
    
    // Estimate current batting position based on inning and outs
    // This is deterministic - same calculation every time
    const estimatedBattingPosition = ((inning - 1) * 3 + outs) % 9 + 1;
    
    // Get lineup strength for upcoming batters (deterministic)
    const currentBatterStrength = this.getBatterStrengthByPosition(estimatedBattingPosition);
    const nextBatterPosition = (estimatedBattingPosition % 9) + 1;
    const nextBatterStrength = this.getBatterStrengthByPosition(nextBatterPosition);
    
    let lineupFactor = 0;
    
    // Current batter strength factor
    switch (currentBatterStrength) {
      case 'elite': lineupFactor += 10; break;
      case 'strong': lineupFactor += 7; break;
      case 'average': lineupFactor += 4; break;
      case 'weak': lineupFactor += 1; break;
    }
    
    // Next batter strength factor (smaller impact)
    switch (nextBatterStrength) {
      case 'elite': lineupFactor += 5; break;
      case 'strong': lineupFactor += 3; break;
      case 'average': lineupFactor += 2; break;
      case 'weak': lineupFactor += 0; break;
    }
    
    // Late inning lineup factor (managers use best available hitters)
    if (inning >= 7) {
      lineupFactor += 4; // Assume better hitters available in key situations
    }
    
    return lineupFactor;
  }

  private getBatterStrengthByPosition(position: number): 'elite' | 'strong' | 'average' | 'weak' {
    // Standard MLB batting order strength patterns (deterministic)
    if (position >= 1 && position <= 2) return 'elite';   // 1-2: Best contact/speed hitters
    if (position >= 3 && position <= 5) return 'strong';  // 3-5: Best power hitters  
    if (position >= 6 && position <= 7) return 'average'; // 6-7: Average hitters
    return 'weak'; // 8-9: Weakest hitters (including pitcher in NL)
  }

  private generateAlertMessage(scoringProbability: number, gameContext: any): string {
    const roundedProb = Math.round(scoringProbability);
    
    if (gameContext.isCloseGame && gameContext.hasRunnersInScoringPosition) {
      return `🔥 CLUTCH MOMENT: ${roundedProb}% scoring chance - runners in position for key batters!`;
    } else if (gameContext.isHighLeverage && gameContext.hasRunnersOnBase) {
      return `⚡ HIGH LEVERAGE: ${roundedProb}% chance to score with strong lineup sequence!`;
    } else if (gameContext.isLateInning) {
      return `⏰ LATE INNING OPPORTUNITY: ${roundedProb}% scoring probability with upcoming hitters!`;
    } else if (gameContext.hasRunnersInScoringPosition) {
      return `💥 RUNNERS IN SCORING POSITION: ${roundedProb}% chance to drive them home!`;
    } else {
      return `⚡ STRONG SCORING SETUP: ${roundedProb}% chance for big inning with current batters!`;
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
}