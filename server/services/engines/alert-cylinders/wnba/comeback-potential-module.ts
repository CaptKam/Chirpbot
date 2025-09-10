import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ComebackPotentialModule extends BaseAlertModule {
  alertType = 'WNBA_COMEBACK_POTENTIAL';
  sport = 'WNBA';

  // WNBA-specific comeback analytics and thresholds
  private readonly COMEBACK_SCENARIOS = {
    EARLY_DEFICIT: { quarter: 2, deficitMin: 10, deficitMax: 20, timeThreshold: 600 },
    MID_GAME_DEFICIT: { quarter: 3, deficitMin: 8, deficitMax: 18, timeThreshold: 600 },
    FOURTH_QUARTER_COMEBACK: { quarter: 4, deficitMin: 5, deficitMax: 15, timeThreshold: 300 },
    FINAL_MINUTES_RALLY: { quarter: 4, deficitMin: 3, deficitMax: 12, timeThreshold: 120 },
    OVERTIME_OPPORTUNITY: { quarter: 5, deficitMin: 1, deficitMax: 8, timeThreshold: 300 }
  };

  private readonly WNBA_COMEBACK_FACTORS = {
    THREE_POINT_IMPACT: 3.2, // Average 3PT value in comeback scenarios
    PACE_MULTIPLIER: 1.8, // WNBA possessions per minute
    TIMEOUT_VALUE: 2.5, // Point value of strategic timeout
    FOUL_STRATEGY_THRESHOLD: 90, // Seconds when fouling becomes strategic
    BENCH_DEPTH_FACTOR: 0.9, // Impact of bench players in comebacks
    MOMENTUM_WEIGHT: 1.4 // Weight of recent scoring runs
  };

  private readonly QUARTER_COMEBACK_PROBABILITIES = {
    1: 0.75, // 75% chance in first quarter (lots of time)
    2: 0.65, // 65% chance in second quarter
    3: 0.45, // 45% chance in third quarter
    4: 0.25, // 25% chance in fourth quarter (time pressure)
    5: 0.15  // 15% chance in overtime (limited possessions)
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger during live games
    if (gameState.status !== 'live') return false;
    
    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const deficit = Math.abs(homeScore - awayScore);
    
    // Parse time remaining in seconds
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    
    // Only trigger if there's a meaningful deficit
    if (deficit < 3) return false;
    
    // Check for various comeback scenarios
    return this.isComebackScenario(quarter, timeSeconds, deficit, homeScore, awayScore);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const comebackScenario = this.identifyComebackScenario(gameState);
    const comebackProbability = this.calculateComebackProbability(gameState);
    const requiredPace = this.calculateRequiredPace(gameState);
    const keyStrategies = this.getComebackStrategies(gameState);
    const timeFactors = this.getTimeFactors(gameState);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const deficit = Math.abs(homeScore - awayScore);

    // Determine trailing team and leading team
    const trailingTeam = homeScore < awayScore ? gameState.homeTeam : gameState.awayTeam;
    const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
    const trailingScore = Math.min(homeScore, awayScore);
    const leadingScore = Math.max(homeScore, awayScore);
    
    return {
      alertKey: `${gameState.gameId}_comeback_potential_${quarter}_${deficit}_${this.parseTimeToSeconds(timeRemaining)}`,
      type: this.alertType,
      message: `🔄 COMEBACK ALERT: ${trailingTeam} trails ${leadingScore}-${trailingScore} (${deficit} points) with ${timeRemaining} left - ${comebackScenario.description}`,
      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore,
        awayScore,
        quarter,
        timeRemaining,
        deficit,
        trailingTeam,
        leadingTeam,
        trailingScore,
        leadingScore,
        comebackScenario: comebackScenario.type,
        comebackProbability: Math.round(comebackProbability),
        requiredPace: Math.round(requiredPace * 10) / 10,
        keyStrategies,
        timeFactors,
        alertType: 'PREDICTIVE',
        predictionCategory: 'COMEBACK_POTENTIAL',
        // WNBA-specific context for AI enhancement
        wnbaContext: {
          isComebackScenario: true,
          deficitSize: this.categorizeDeficit(deficit),
          timeUrgency: this.calculateTimeUrgency(quarter, this.parseTimeToSeconds(timeRemaining)),
          possessionsRemaining: this.estimatePossessionsRemaining(quarter, this.parseTimeToSeconds(timeRemaining)),
          requiredThreePointers: Math.ceil(deficit / this.WNBA_COMEBACK_FACTORS.THREE_POINT_IMPACT),
          foulStrategyRecommended: this.shouldRecommendFoulStrategy(quarter, this.parseTimeToSeconds(timeRemaining), deficit),
          timeoutValue: this.WNBA_COMEBACK_FACTORS.TIMEOUT_VALUE,
          paceFactors: this.WNBA_COMEBACK_FACTORS,
          momentumIndicators: this.analyzeMomentum(gameState),
          strategicOptions: this.getStrategicOptions(gameState)
        }
      },
      priority: this.calculateAlertPriority(comebackProbability, quarter, deficit, this.parseTimeToSeconds(timeRemaining))
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Base probability from quarter-specific lookup
    let probability = (this.QUARTER_COMEBACK_PROBABILITIES[quarter as keyof typeof this.QUARTER_COMEBACK_PROBABILITIES] || 0.25) * 100;
    
    // Deficit impact - smaller deficits have higher probability
    if (deficit <= 5) probability += 20;
    else if (deficit <= 8) probability += 15;
    else if (deficit <= 12) probability += 10;
    else if (deficit <= 15) probability += 5;
    else probability -= 10; // Large deficits reduce probability
    
    // Time factor - more time generally means better comeback chances
    if (quarter <= 2) probability += 15; // Plenty of time
    else if (quarter === 3) probability += 10; // Decent time
    else if (quarter === 4 && timeSeconds > 300) probability += 5; // Some time left
    else if (quarter === 4 && timeSeconds <= 120) probability -= 5; // Very little time
    else if (quarter >= 5) probability -= 10; // Overtime pressure
    
    return Math.min(Math.max(probability, 10), 85);
  }

  private isComebackScenario(quarter: number, timeSeconds: number, deficit: number, homeScore: number, awayScore: number): boolean {
    // Early game deficits (second quarter)
    if (quarter === this.COMEBACK_SCENARIOS.EARLY_DEFICIT.quarter && 
        deficit >= this.COMEBACK_SCENARIOS.EARLY_DEFICIT.deficitMin && 
        deficit <= this.COMEBACK_SCENARIOS.EARLY_DEFICIT.deficitMax) {
      return true;
    }
    
    // Mid-game deficits (third quarter)
    if (quarter === this.COMEBACK_SCENARIOS.MID_GAME_DEFICIT.quarter && 
        deficit >= this.COMEBACK_SCENARIOS.MID_GAME_DEFICIT.deficitMin && 
        deficit <= this.COMEBACK_SCENARIOS.MID_GAME_DEFICIT.deficitMax) {
      return true;
    }
    
    // Fourth quarter comeback scenarios
    if (quarter === this.COMEBACK_SCENARIOS.FOURTH_QUARTER_COMEBACK.quarter && 
        deficit >= this.COMEBACK_SCENARIOS.FOURTH_QUARTER_COMEBACK.deficitMin && 
        deficit <= this.COMEBACK_SCENARIOS.FOURTH_QUARTER_COMEBACK.deficitMax) {
      return true;
    }
    
    // Final minutes rally
    if (quarter === 4 && timeSeconds <= this.COMEBACK_SCENARIOS.FINAL_MINUTES_RALLY.timeThreshold &&
        deficit >= this.COMEBACK_SCENARIOS.FINAL_MINUTES_RALLY.deficitMin && 
        deficit <= this.COMEBACK_SCENARIOS.FINAL_MINUTES_RALLY.deficitMax) {
      return true;
    }
    
    // Overtime comeback opportunities
    if (quarter >= 5 && 
        deficit >= this.COMEBACK_SCENARIOS.OVERTIME_OPPORTUNITY.deficitMin && 
        deficit <= this.COMEBACK_SCENARIOS.OVERTIME_OPPORTUNITY.deficitMax) {
      return true;
    }
    
    return false;
  }

  private identifyComebackScenario(gameState: GameState): { type: string; description: string } {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    if (quarter >= 5) {
      return { type: 'OVERTIME_COMEBACK', description: 'Overtime comeback opportunity' };
    }
    
    if (quarter === 4 && timeSeconds <= 120) {
      return { type: 'FINAL_MINUTES_RALLY', description: 'Final minutes rally potential' };
    }
    
    if (quarter === 4 && timeSeconds <= 300) {
      return { type: 'FOURTH_QUARTER_COMEBACK', description: 'Fourth quarter comeback scenario' };
    }
    
    if (quarter === 3) {
      return { type: 'MID_GAME_RALLY', description: 'Mid-game rally opportunity' };
    }
    
    if (quarter === 2) {
      return { type: 'EARLY_COMEBACK', description: 'Early game comeback potential' };
    }
    
    return { type: 'COMEBACK_OPPORTUNITY', description: 'Comeback opportunity developing' };
  }

  private calculateComebackProbability(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Start with base probability from quarter
    let probability = this.QUARTER_COMEBACK_PROBABILITIES[quarter as keyof typeof this.QUARTER_COMEBACK_PROBABILITIES] || 0.25;
    
    // Adjust for deficit size
    if (deficit <= 5) probability *= 1.5;
    else if (deficit <= 8) probability *= 1.2;
    else if (deficit <= 12) probability *= 1.0;
    else if (deficit <= 15) probability *= 0.8;
    else probability *= 0.6;
    
    // Time adjustments
    if (quarter === 4) {
      if (timeSeconds > 480) probability *= 1.1; // 8+ minutes left
      else if (timeSeconds > 300) probability *= 1.0; // 5-8 minutes
      else if (timeSeconds > 120) probability *= 0.9; // 2-5 minutes
      else probability *= 0.7; // < 2 minutes
    }
    
    // Overtime adjustment
    if (quarter >= 5) probability *= 0.6;
    
    return probability * 100;
  }

  private calculateRequiredPace(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Calculate time remaining in the game
    const totalTimeRemaining = quarter >= 4 ? timeSeconds : timeSeconds + ((4 - quarter) * 600);
    
    // Estimate possessions remaining
    const possessionsRemaining = totalTimeRemaining / (60 / this.WNBA_COMEBACK_FACTORS.PACE_MULTIPLIER);
    
    // Required points per possession to overcome deficit
    return deficit / possessionsRemaining;
  }

  private getComebackStrategies(gameState: GameState): string[] {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const strategies = [];
    
    // Three-point strategy
    if (deficit >= 6) strategies.push('Focus on three-point shooting');
    
    // Defensive pressure
    if (quarter >= 3) strategies.push('Increase defensive pressure');
    
    // Fouling strategy
    if (quarter === 4 && timeSeconds <= this.WNBA_COMEBACK_FACTORS.FOUL_STRATEGY_THRESHOLD) {
      strategies.push('Consider fouling strategy');
    }
    
    // Timeout strategy
    if (quarter >= 3) strategies.push('Strategic timeout usage');
    
    // Pace strategy
    if (deficit >= 8) strategies.push('Increase game pace');
    
    // Rebounding
    strategies.push('Secure defensive rebounds');
    
    return strategies;
  }

  private getTimeFactors(gameState: GameState): any {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    
    return {
      quarterPhase: quarter <= 2 ? 'early' : quarter === 3 ? 'middle' : quarter === 4 ? 'late' : 'overtime',
      timeUrgency: this.calculateTimeUrgency(quarter, timeSeconds),
      possessionsRemaining: this.estimatePossessionsRemaining(quarter, timeSeconds),
      canAffordTurnovers: quarter <= 3 || (quarter === 4 && timeSeconds > 180),
      timeForPatience: quarter <= 2,
      mustPressNow: quarter === 4 && timeSeconds <= 300
    };
  }

  private categorizeDeficit(deficit: number): string {
    if (deficit <= 3) return 'minimal';
    if (deficit <= 6) return 'small';
    if (deficit <= 10) return 'moderate';
    if (deficit <= 15) return 'large';
    return 'substantial';
  }

  private calculateTimeUrgency(quarter: number, timeSeconds: number): string {
    if (quarter >= 5) return 'extreme';
    if (quarter === 4 && timeSeconds <= 60) return 'critical';
    if (quarter === 4 && timeSeconds <= 180) return 'high';
    if (quarter === 4 && timeSeconds <= 360) return 'moderate';
    if (quarter >= 3) return 'low';
    return 'minimal';
  }

  private estimatePossessionsRemaining(quarter: number, timeSeconds: number): number {
    const totalTimeRemaining = quarter >= 4 ? timeSeconds : timeSeconds + ((4 - quarter) * 600);
    return Math.round(totalTimeRemaining / (60 / this.WNBA_COMEBACK_FACTORS.PACE_MULTIPLIER));
  }

  private shouldRecommendFoulStrategy(quarter: number, timeSeconds: number, deficit: number): boolean {
    return quarter === 4 && timeSeconds <= this.WNBA_COMEBACK_FACTORS.FOUL_STRATEGY_THRESHOLD && deficit >= 4;
  }

  private analyzeMomentum(gameState: GameState): any {
    // Simplified momentum analysis - would need historical play data for full implementation
    const quarter = gameState.quarter || 1;
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return {
      recentTrend: 'neutral', // Would analyze recent scoring runs
      momentumShift: quarter >= 3 && deficit <= 12,
      energyLevel: quarter >= 3 ? 'high' : 'building',
      crowdFactor: 'supportive' // Would consider home/away and game importance
    };
  }

  private getStrategicOptions(gameState: GameState): string[] {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const deficit = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    const options = ['Defensive pressure', 'Three-point shooting'];
    
    if (quarter >= 3) options.push('Timeout strategy');
    if (quarter === 4 && timeSeconds <= 120) options.push('Fouling strategy');
    if (deficit >= 8) options.push('Press defense');
    if (quarter >= 4) options.push('Substitution strategy');
    
    return options;
  }

  private calculateAlertPriority(comebackProbability: number, quarter: number, deficit: number, timeSeconds: number): number {
    let priority = 80; // Base priority for comeback scenarios
    
    // Probability factor
    priority += Math.round(comebackProbability * 0.1);
    
    // Quarter factor
    if (quarter >= 5) priority += 8; // Overtime
    else if (quarter === 4) priority += 5; // Fourth quarter
    else if (quarter === 3) priority += 3; // Third quarter
    
    // Deficit factor (closer games are higher priority)
    if (deficit <= 5) priority += 8;
    else if (deficit <= 8) priority += 5;
    else if (deficit <= 12) priority += 3;
    
    // Time factor
    if (quarter === 4 && timeSeconds <= 300) priority += 5;
    
    return Math.min(priority, 95);
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      return 0;
    }
  }
}