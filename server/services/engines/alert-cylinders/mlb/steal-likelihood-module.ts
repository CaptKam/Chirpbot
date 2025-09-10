import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class StealLikelihoodModule extends BaseAlertModule {
  alertType = 'MLB_STEAL_LIKELIHOOD';
  sport = 'MLB';

  // Historical steal ATTEMPT rates by base and game situation (2019-2023 MLB data)
  // These are actual attempt probabilities per pitch, recalibrated for realistic levels
  private readonly STEAL_ATTEMPT_RATES = {
    '1B_to_2B': { base: 0.015, favorable: 0.025, unfavorable: 0.008 }, // First to second (1.5% per-pitch rate)
    '2B_to_3B': { base: 0.020, favorable: 0.032, unfavorable: 0.012 }, // Second to third (2% per-pitch rate)
    '1B_3B_double': { base: 0.008, favorable: 0.014, unfavorable: 0.004 } // First and third double steal (0.8% per-pitch rate)
  };

  // Success rates for when attempts are made (for context generation)
  private readonly STEAL_SUCCESS_RATES = {
    '1B_to_2B': 0.742, // Historical success rate for first to second
    '2B_to_3B': 0.834, // Historical success rate for second to third  
    '1B_3B_double': 0.695 // Historical success rate for double steals
  };

  // Count situation multipliers for steal attempts (compressed to prevent over-amplification)
  private readonly COUNT_LEVERAGE = {
    '1-0': 1.2,   // 20% increase - slightly favorable
    '2-0': 1.3,   // 30% increase - favorable, pitcher must throw strike
    '2-1': 1.25,  // 25% increase - favorable, pitcher pressure
    '3-0': 1.1,   // 10% increase - less favorable, automatic take
    '3-1': 1.3,   // 30% increase - most favorable, pitcher must throw strike
    '3-2': 0.8,   // 20% decrease - unfavorable, all focus on plate
    '0-1': 0.8,   // 20% decrease - unfavorable, pitcher ahead
    '0-2': 0.7,   // 30% decrease - very unfavorable, defensive count
    '1-2': 0.75,  // 25% decrease - unfavorable, pitcher advantage
    '0-0': 1.0    // Neutral - no change
  };

  // Inning leverage multipliers (compressed ranges to prevent over-amplification)
  private readonly INNING_LEVERAGE = {
    1: 0.9, 2: 0.95, 3: 1.0, 4: 1.05, 5: 1.1,
    6: 1.15, 7: 1.2, 8: 1.25, 9: 1.3, 10: 1.3
  };

  // Game situation multipliers (compressed to realistic ranges)
  private readonly SITUATION_MODIFIERS = {
    tying_run: 1.2,      // 20% increase - runner represents tying run
    go_ahead_run: 1.25,  // 25% increase - runner represents go-ahead run
    close_game: 1.15,    // 15% increase - 1-2 run difference
    blowout: 0.7,        // 30% decrease - 5+ run difference
    leadoff_walk: 1.1,   // 10% increase - leadoff walk scenario (removed duplicate)
    hit_and_run: 1.2     // 20% increase - hit and run opportunity
  };

  // Cached probability to prevent flapping
  private probabilityCache: { [key: string]: number } = {};
  private readonly TRIGGER_THRESHOLD = 7; // Trigger alert at 7% (realistic per-pitch probability)
  private readonly CLEAR_THRESHOLD = 5;   // Clear alert at 5%
  private lastTriggeredState: { [gameId: string]: boolean } = {};

  // Player performance metrics (compressed ranges to prevent over-amplification)
  private readonly PLAYER_METRICS = {
    runnerSpeed: {
      elite: 1.2,   // 20% boost for elite speed
      fast: 1.15,   // 15% boost for fast runners
      average: 1.0, // No change for average
      slow: 0.85    // 15% penalty for slow runners
    },
    catcherArm: {
      elite: 0.8,   // 20% reduction vs elite catcher
      strong: 0.85, // 15% reduction vs strong arm
      average: 1.0, // No change vs average
      weak: 1.15    // 15% boost vs weak arm
    },
    pitcherControl: {
      elite: 0.9,   // 10% reduction vs elite control
      good: 0.95,   // 5% reduction vs good control
      average: 1.0, // No change vs average
      poor: 1.1     // 10% boost vs poor control
    }
  };

  isTriggered(gameState: GameState): boolean {
    // Defensive live game check
    if (gameState.status !== 'live' && !gameState.isLive) return false;

    // Must have potential stealing scenarios
    if (!this.hasStealingOpportunity(gameState)) return false;

    const probability = this.calculateStealProbability(gameState);
    const gameId = gameState.gameId;
    const wasTriggered = this.lastTriggeredState[gameId] || false;
    
    // Implement hysteresis to prevent flapping
    let shouldTrigger;
    if (wasTriggered) {
      shouldTrigger = probability >= this.CLEAR_THRESHOLD;
    } else {
      shouldTrigger = probability >= this.TRIGGER_THRESHOLD;
    }
    
    this.lastTriggeredState[gameId] = shouldTrigger;
    return shouldTrigger;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const stealProbability = this.calculateStealProbability(gameState);
    const stealAnalysis = this.analyzeStealSituation(gameState);
    const alertMessage = this.generateStealMessage(stealProbability, stealAnalysis);

    // Create unique alert key with base runner configuration
    const baseConfiguration = this.getBaseConfiguration(gameState);
    const alertKey = `${gameState.gameId}_steal_likelihood_${gameState.inning}_${gameState.isTopInning ? 'top' : 'bottom'}_${baseConfiguration}_${gameState.balls}_${gameState.strikes}`;

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
        scenarioName: 'Steal Likelihood',
        stealProbability: stealProbability,
        predictionType: 'steal_attempt',
        stealAnalysis,
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        baseConfiguration,
        // Predictive metadata
        alertTiming: 'predictive',
        confidence: this.calculateConfidenceLevel(stealProbability),
        leverageIndex: this.calculateGameLeverage(gameState),
        optimalStealWindow: this.calculateOptimalStealWindow(gameState)
      },
      priority: Math.min(95, 55 + Math.round(stealProbability * 0.4))
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateStealProbability(gameState);
  }

  private hasStealingOpportunity(gameState: GameState): boolean {
    // Must have runner on 1st or 2nd (not 3rd - different dynamic)
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;
    const outs = gameState.outs || 0;

    // No stealing with 2 outs typically
    if (outs >= 2) return false;

    // Valid stealing scenarios
    return (hasFirst && !hasSecond) ||  // Runner only on 1st
           (!hasFirst && hasSecond) ||  // Runner only on 2nd  
           (hasFirst && hasThird);      // First and third (double steal)
  }

  private calculateStealProbability(gameState: GameState): number {
    const cacheKey = this.createGameStateKey(gameState);
    
    if (this.probabilityCache[cacheKey] !== undefined) {
      return this.probabilityCache[cacheKey];
    }

    const probability = this.calculateDeterministicStealProbability(gameState);
    this.probabilityCache[cacheKey] = probability;
    return probability;
  }

  private createGameStateKey(gameState: GameState): string {
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

  private calculateDeterministicStealProbability(gameState: GameState): number {
    // Start with base steal ATTEMPT rate for the scenario
    const baseScenario = this.getStealScenario(gameState);
    let probability = this.STEAL_ATTEMPT_RATES[baseScenario].base;

    // Apply multiplicative factors instead of additive bonuses
    
    // Count situation leverage (multiplicative)
    const countKey = `${gameState.balls || 0}-${gameState.strikes || 0}`;
    const countMultiplier = this.COUNT_LEVERAGE[countKey as keyof typeof this.COUNT_LEVERAGE] || 1.0;
    probability *= countMultiplier;

    // Inning leverage (multiplicative)
    const inning = Math.min(10, gameState.inning || 1);
    const inningMultiplier = this.INNING_LEVERAGE[inning as keyof typeof this.INNING_LEVERAGE] || 1.0;
    probability *= inningMultiplier;

    // Game situation modifiers (multiplicative)
    const gameSituationMultiplier = this.getGameSituationMultiplier(gameState);
    probability *= gameSituationMultiplier;

    // Player performance factors (multiplicative)
    const playerFactors = this.getPlayerPerformanceFactors(gameState);
    probability *= playerFactors.runnerSpeed;
    probability *= playerFactors.catcherArm;
    probability *= playerFactors.pitcherControl;

    // Environmental factors (smaller multiplicative adjustment)
    const environmentMultiplier = this.getEnvironmentalMultiplier(gameState);
    probability *= environmentMultiplier;

    // Convert to percentage and apply realistic bounds for per-pitch probabilities
    const percentage = probability * 100;
    return Math.max(1, Math.min(12, percentage)); // Realistic bounds: 1-12% per-pitch
  }

  private getStealScenario(gameState: GameState): keyof typeof this.STEAL_ATTEMPT_RATES {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;

    if (hasFirst && hasThird) return '1B_3B_double';
    if (hasSecond && !hasFirst) return '2B_to_3B';
    return '1B_to_2B'; // Default to most common scenario
  }

  private getGameSituationMultiplier(gameState: GameState): number {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inning = gameState.inning || 1;
    let multiplier = 1.0; // Start with neutral multiplier

    // Score situation multipliers
    if (scoreDiff <= 1) {
      multiplier *= this.SITUATION_MODIFIERS.close_game;
    } else if (scoreDiff >= 5) {
      multiplier *= this.SITUATION_MODIFIERS.blowout;
    } else if (scoreDiff <= 2) {
      multiplier *= this.SITUATION_MODIFIERS.close_game * 0.8; // Moderate close game
    }

    // Late inning pressure boost
    if (inning >= 7 && scoreDiff <= 2) {
      multiplier *= this.SITUATION_MODIFIERS.tying_run;
    }

    // Note: Removed leadoff_walk bonus here to prevent double-counting with COUNT_LEVERAGE
    // Count pressure is already handled in COUNT_LEVERAGE multipliers

    return multiplier;
  }

  private getPlayerPerformanceFactors(gameState: GameState): { runnerSpeed: number; catcherArm: number; pitcherControl: number } {
    // Deterministic player assessment based on game context
    // In a real implementation, this would use actual player speed/arm strength data
    
    // Runner Speed Assessment
    const inning = gameState.inning || 1;
    const outs = gameState.outs || 0;
    let runnerSpeed = 1.0; // Start with average
    
    // Late-inning substitutions typically bring in faster runners
    if (inning >= 8) runnerSpeed = this.PLAYER_METRICS.runnerSpeed.fast;
    else if (inning >= 6) runnerSpeed = this.PLAYER_METRICS.runnerSpeed.average;
    else runnerSpeed = this.PLAYER_METRICS.runnerSpeed.average;
    
    // Compress outs situation multipliers
    if (outs === 0) runnerSpeed *= 1.05; // Can be more aggressive (reduced from 1.1)
    else if (outs === 1) runnerSpeed *= 1.1; // Critical to advance (reduced from 1.2)
    
    // Catcher Arm Assessment (deterministic based on game context)
    let catcherArm = this.PLAYER_METRICS.catcherArm.average; // Default average
    
    // In real implementation, would lookup actual catcher arm strength
    // For now, vary slightly based on inning to simulate different catchers
    if (inning % 3 === 0) catcherArm = this.PLAYER_METRICS.catcherArm.strong;
    else if (inning % 5 === 0) catcherArm = this.PLAYER_METRICS.catcherArm.weak;
    
    // Pitcher Control Assessment (removed - handled in COUNT_LEVERAGE to avoid double-counting)
    let pitcherControl = this.PLAYER_METRICS.pitcherControl.average;
    
    // Note: Removed balls/strikes assessment here to prevent double-counting
    // Count pressure is already handled in COUNT_LEVERAGE multipliers
    
    return { runnerSpeed, catcherArm, pitcherControl };
  }

  // This method is now replaced by getPlayerPerformanceFactors
  // Keeping stub for any legacy references
  private getDefensiveResistanceFactor(gameState: GameState): number {
    return 1.0; // Neutral - logic moved to getPlayerPerformanceFactors
  }

  private getEnvironmentalMultiplier(gameState: GameState): number {
    // Environmental factors affecting steal attempts (multiplicative)
    let multiplier = 1.0;

    // Game progression factors
    const inning = gameState.inning || 1;
    
    // Late innings have slight advantage (more urgent situations)
    if (inning >= 8) multiplier *= 1.05; // 5% boost in crucial late innings
    else if (inning >= 6) multiplier *= 1.02; // Small boost in later innings
    
    // Home team slight advantage (familiar environment, supportive crowd)
    if (!gameState.isTopInning) multiplier *= 1.03;
    
    // Weather factors would go here in real implementation
    // For now, keep it simple and realistic
    
    return multiplier;
  }

  // This method is now incorporated into count leverage
  // Keeping stub for any legacy references  
  private getBatterProfileFactor(gameState: GameState): number {
    return 1.0; // Neutral - logic moved to COUNT_LEVERAGE multipliers
  }

  private analyzeStealSituation(gameState: GameState): any {
    const scenario = this.getStealScenario(gameState);
    const countKey = `${gameState.balls || 0}-${gameState.strikes || 0}`;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    return {
      scenario,
      baseConfiguration: this.getBaseConfiguration(gameState),
      countSituation: countKey,
      countLeverage: this.COUNT_LEVERAGE[countKey as keyof typeof this.COUNT_LEVERAGE] || 0,
      inningPressure: this.INNING_LEVERAGE[(gameState.inning || 1) as keyof typeof this.INNING_LEVERAGE] || 0,
      gameCompetitiveness: scoreDiff <= 2 ? 'close' : scoreDiff >= 5 ? 'blowout' : 'moderate',
      stealWindow: this.calculateOptimalStealWindow(gameState)
    };
  }

  private getBaseConfiguration(gameState: GameState): string {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;

    if (hasFirst && hasThird) return 'first_third';
    if (hasSecond && !hasFirst) return 'second_only';
    if (hasFirst && !hasSecond) return 'first_only';
    return 'unknown';
  }

  private generateStealMessage(probability: number, analysis: any): string {
    const roundedProb = Math.round(probability);
    const scenario = analysis.scenario;
    const countSit = analysis.countSituation;

    let message = `🏃 HIGH STEAL LIKELIHOOD: ${roundedProb}% chance of steal attempt`;

    // Add scenario-specific context
    if (scenario === '1B_to_2B') {
      message += ` - Runner breaking for 2nd`;
    } else if (scenario === '2B_to_3B') {
      message += ` - Runner advancing to 3rd`;
    } else if (scenario === '1B_3B_double') {
      message += ` - Double steal opportunity`;
    }

    // Add count context (fixed to compare against 1.0 baseline)
    if (analysis.countLeverage > 1.1) {
      message += ` on favorable ${countSit} count`;
    } else if (analysis.countLeverage < 0.9) {
      message += ` despite tough ${countSit} count`;
    }

    return message;
  }

  private calculateOptimalStealWindow(gameState: GameState): string {
    const balls = gameState.balls || 0;
    const strikes = gameState.strikes || 0;

    // Determine optimal pitch in sequence for steal attempt
    if (balls >= 2) return 'next_pitch'; // Must throw strike
    if (balls === strikes) return 'within_2_pitches'; // Even count flexibility
    if (strikes >= 2) return 'risky_timing'; // Defensive count
    
    return 'moderate_window';
  }

  private calculateConfidenceLevel(probability: number): 'high' | 'medium' | 'low' {
    // Updated thresholds for realistic per-pitch probability ranges
    if (probability >= 15) return 'high';
    if (probability >= 8) return 'medium';
    return 'low';
  }

  private calculateGameLeverage(gameState: GameState): number {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inning = gameState.inning || 1;
    
    let leverage = 1.0;
    
    // Close game increases leverage
    if (scoreDiff <= 1) leverage += 0.5;
    else if (scoreDiff <= 3) leverage += 0.2;
    
    // Late innings increase leverage
    if (inning >= 7) leverage += 0.3;
    if (inning >= 9) leverage += 0.2;
    
    return Math.round(leverage * 10) / 10;
  }
}