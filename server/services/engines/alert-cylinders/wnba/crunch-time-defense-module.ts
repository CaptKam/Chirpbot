import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class CrunchTimeDefenseModule extends BaseAlertModule {
  alertType = 'WNBA_CRUNCH_TIME_DEFENSE';
  sport = 'WNBA';

  // WNBA-specific defensive pressure analytics and thresholds
  private readonly DEFENSIVE_SCENARIOS = {
    MUST_STOP: { quarter: 4, timeThreshold: 120, scoreDiffMax: 5, maxPossessions: 3 },
    PRESSURE_DEFENSE: { quarter: 4, timeThreshold: 300, scoreDiffMax: 8, maxPossessions: 6 },
    OVERTIME_DEFENSE: { quarter: 5, timeThreshold: 300, scoreDiffMax: 10, maxPossessions: 4 },
    SHOT_CLOCK_PRESSURE: { timeThreshold: 8, quarter: 3, scoreDiffMax: 12 },
    FOUL_TROUBLE_IMPACT: { foulThreshold: 4, quarter: 3, keyPlayerFactor: 1.5 }
  };

  private readonly WNBA_DEFENSIVE_FACTORS = {
    POSSESSION_VALUE: 1.05, // Average points per possession in WNBA
    DEFENSIVE_STOP_VALUE: 2.1, // Value of preventing opponent score
    TURNOVER_VALUE: 2.8, // Value of forcing a turnover
    SHOT_CLOCK_VIOLATION_VALUE: 3.0, // Premium value of shot clock defense
    FOUL_STRATEGY_THRESHOLD: 6, // Foul to give before bonus
    BENCH_DEFENSE_FACTOR: 0.85, // Defensive impact of bench players
    PACE_ADJUSTMENT: 1.8 // WNBA possessions per minute
  };

  private readonly QUARTER_DEFENSIVE_IMPORTANCE = {
    1: 0.6, // First quarter - building foundation
    2: 0.7, // Second quarter - establishing tone
    3: 0.8, // Third quarter - crucial momentum
    4: 1.0, // Fourth quarter - maximum importance
    5: 1.2  // Overtime - elevated importance
  };

  private readonly DEFENSIVE_PRIORITIES = {
    PREVENT_THREE_POINTERS: 3.2,
    CONTEST_TWO_POINTERS: 2.0,
    FORCE_TURNOVERS: 2.8,
    DEFENSIVE_REBOUNDS: 2.2,
    SHOT_CLOCK_VIOLATIONS: 3.0,
    FOUL_MANAGEMENT: 1.8
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger during live games
    if (gameState.status !== 'live') return false;
    
    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    
    // Parse time remaining in seconds
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    
    // Check for various defensive pressure scenarios
    return this.isDefensivePressureScenario(quarter, timeSeconds, scoreDiff, gameState);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const defensiveScenario = this.identifyDefensiveScenario(gameState);
    const defensiveImportance = this.calculateDefensiveImportance(gameState);
    const possessionsRemaining = this.estimatePossessionsRemaining(gameState);
    const defensivePriorities = this.getDefensivePriorities(gameState);
    const strategicFactors = this.getStrategicFactors(gameState);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    // Determine which team needs defensive stops (trailing team's perspective)
    const trailingTeam = homeScore < awayScore ? gameState.homeTeam : gameState.awayTeam;
    const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
    const defensiveTeam = homeScore < awayScore ? gameState.homeTeam : gameState.awayTeam;
    
    return {
      alertKey: `${gameState.gameId}_crunch_defense_${quarter}_${this.parseTimeToSeconds(timeRemaining)}_${scoreDiff}`,
      type: this.alertType,
      message: `🛡️ CRUNCH TIME DEFENSE: ${defensiveTeam} needs defensive stops - ${scoreDiff} point deficit with ${timeRemaining} remaining (${possessionsRemaining} possessions)`,
      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore,
        awayScore,
        quarter,
        timeRemaining,
        scoreDifferential: scoreDiff,
        defensiveTeam,
        trailingTeam,
        leadingTeam,
        defensiveScenario: defensiveScenario.type,
        defensiveImportance: Math.round(defensiveImportance),
        possessionsRemaining,
        defensivePriorities,
        strategicFactors,
        alertType: 'PREDICTIVE',
        predictionCategory: 'CRUNCH_TIME_DEFENSE',
        // WNBA-specific context for AI enhancement
        wnbaContext: {
          isCrunchTimeDefense: true,
          isOvertime: quarter >= 5,
          defensiveUrgency: this.calculateDefensiveUrgency(quarter, this.parseTimeToSeconds(timeRemaining), scoreDiff),
          stopsNeeded: this.calculateStopsNeeded(scoreDiff, possessionsRemaining),
          foulSituationAnalysis: this.analyzeFoulSituation(gameState),
          shotClockDefense: this.analyzeShootClockDefense(quarter, this.parseTimeToSeconds(timeRemaining)),
          reboundingImportance: this.calculateReboundingImportance(quarter, scoreDiff),
          defensiveMatchups: this.identifyKeyDefensiveMatchups(gameState),
          timeoutStrategy: this.evaluateTimeoutStrategy(quarter, this.parseTimeToSeconds(timeRemaining)),
          substitutionNeeds: this.evaluateSubstitutionNeeds(gameState),
          defensiveFactors: this.WNBA_DEFENSIVE_FACTORS
        }
      },
      priority: this.calculateAlertPriority(defensiveImportance, quarter, scoreDiff, this.parseTimeToSeconds(timeRemaining))
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Base probability increases with quarter importance
    let probability = 50 * (this.QUARTER_DEFENSIVE_IMPORTANCE[quarter as keyof typeof this.QUARTER_DEFENSIVE_IMPORTANCE] || 1.0);
    
    // Score differential impact - closer games increase defensive importance
    if (scoreDiff <= 3) probability += 25;
    else if (scoreDiff <= 5) probability += 20;
    else if (scoreDiff <= 8) probability += 15;
    else if (scoreDiff <= 12) probability += 10;
    
    // Time pressure factor
    if (quarter >= 4) {
      if (timeSeconds <= 60) probability += 30;
      else if (timeSeconds <= 120) probability += 25;
      else if (timeSeconds <= 300) probability += 20;
    } else if (quarter === 3) {
      probability += 10; // Third quarter momentum building
    }
    
    // Overtime boost
    if (quarter >= 5) probability += 25;
    
    return Math.min(probability, 95);
  }

  private isDefensivePressureScenario(quarter: number, timeSeconds: number, scoreDiff: number, gameState: GameState): boolean {
    // Must-stop scenarios (final 2 minutes, close game)
    if (quarter >= 4 && timeSeconds <= this.DEFENSIVE_SCENARIOS.MUST_STOP.timeThreshold && 
        scoreDiff <= this.DEFENSIVE_SCENARIOS.MUST_STOP.scoreDiffMax) {
      return true;
    }
    
    // Pressure defense scenarios (final 5 minutes)
    if (quarter === 4 && timeSeconds <= this.DEFENSIVE_SCENARIOS.PRESSURE_DEFENSE.timeThreshold && 
        scoreDiff <= this.DEFENSIVE_SCENARIOS.PRESSURE_DEFENSE.scoreDiffMax) {
      return true;
    }
    
    // Overtime defensive pressure
    if (quarter >= 5 && scoreDiff <= this.DEFENSIVE_SCENARIOS.OVERTIME_DEFENSE.scoreDiffMax) {
      return true;
    }
    
    // Shot clock pressure situations
    if (quarter >= this.DEFENSIVE_SCENARIOS.SHOT_CLOCK_PRESSURE.quarter && 
        timeSeconds % 24 <= this.DEFENSIVE_SCENARIOS.SHOT_CLOCK_PRESSURE.timeThreshold &&
        scoreDiff <= this.DEFENSIVE_SCENARIOS.SHOT_CLOCK_PRESSURE.scoreDiffMax) {
      return true;
    }
    
    // Third quarter momentum defense
    if (quarter === 3 && scoreDiff <= 10) {
      return true;
    }
    
    return false;
  }

  private identifyDefensiveScenario(gameState: GameState): { type: string; description: string } {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    if (quarter >= 5) {
      return { type: 'OVERTIME_DEFENSE', description: 'Overtime defensive intensity required' };
    }
    
    if (quarter === 4 && timeSeconds <= 60) {
      return { type: 'FINAL_MINUTE_STOPS', description: 'Final minute defensive stops crucial' };
    }
    
    if (quarter === 4 && timeSeconds <= 120) {
      return { type: 'MUST_STOP_POSSESSIONS', description: 'Must-stop defensive possessions' };
    }
    
    if (quarter === 4 && timeSeconds <= 300) {
      return { type: 'CRUNCH_TIME_PRESSURE', description: 'Crunch time defensive pressure' };
    }
    
    if (timeSeconds % 24 <= 8 && quarter >= 3) {
      return { type: 'SHOT_CLOCK_DEFENSE', description: 'Shot clock defensive pressure' };
    }
    
    if (quarter === 3) {
      return { type: 'MOMENTUM_DEFENSE', description: 'Momentum-shifting defensive stand' };
    }
    
    return { type: 'PRESSURE_DEFENSE', description: 'Pressure defensive scenario' };
  }

  private calculateDefensiveImportance(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let importance = 60;
    
    // Quarter weight
    importance *= this.QUARTER_DEFENSIVE_IMPORTANCE[quarter as keyof typeof this.QUARTER_DEFENSIVE_IMPORTANCE] || 1.0;
    
    // Score closeness amplifies defensive importance
    if (scoreDiff <= 2) importance += 30;
    else if (scoreDiff <= 5) importance += 25;
    else if (scoreDiff <= 8) importance += 20;
    else if (scoreDiff <= 12) importance += 15;
    
    // Time pressure increases importance
    if (quarter >= 4) {
      if (timeSeconds <= 30) importance += 35;
      else if (timeSeconds <= 60) importance += 30;
      else if (timeSeconds <= 120) importance += 25;
      else if (timeSeconds <= 300) importance += 20;
    }
    
    // Overtime multiplier
    if (quarter >= 5) importance *= 1.3;
    
    return Math.min(importance, 100);
  }

  private estimatePossessionsRemaining(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    
    // Calculate total time remaining
    const totalTimeRemaining = quarter >= 4 ? timeSeconds : timeSeconds + ((4 - quarter) * 600);
    
    // Estimate possessions based on WNBA pace
    return Math.round(totalTimeRemaining / (60 / this.WNBA_DEFENSIVE_FACTORS.PACE_ADJUSTMENT));
  }

  private getDefensivePriorities(gameState: GameState): string[] {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const priorities = [];
    
    // Always important
    priorities.push('Contest all shots');
    priorities.push('Secure defensive rebounds');
    
    // Time-based priorities
    if (quarter >= 4 && timeSeconds <= 120) {
      priorities.push('Prevent three-pointers');
      priorities.push('Force tough two-pointers');
    }
    
    // Score-based priorities
    if (scoreDiff <= 5) {
      priorities.push('No easy baskets');
      priorities.push('Force turnovers');
    }
    
    // Shot clock pressure
    if (timeSeconds % 24 <= 8) {
      priorities.push('Shot clock pressure');
    }
    
    // Foul management
    if (quarter >= 4) {
      priorities.push('Smart foul management');
    }
    
    return priorities;
  }

  private getStrategicFactors(gameState: GameState): any {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return {
      mustFoulToExtend: quarter === 4 && timeSeconds <= 60 && scoreDiff >= 4,
      canAffordToFoul: quarter <= 3,
      needStealsOrBlocks: scoreDiff >= 6 && quarter >= 4,
      defensiveReboundsCritical: quarter >= 3,
      substituteForDefense: quarter >= 4 && timeSeconds <= 300,
      pressFullCourt: scoreDiff >= 8 && quarter >= 3,
      protectPaintFirst: scoreDiff <= 3,
      contestThreePointers: quarter >= 4 || scoreDiff >= 6
    };
  }

  private calculateDefensiveUrgency(quarter: number, timeSeconds: number, scoreDiff: number): string {
    if (quarter >= 5) return 'maximum';
    if (quarter === 4 && timeSeconds <= 60) return 'critical';
    if (quarter === 4 && timeSeconds <= 120 && scoreDiff <= 5) return 'high';
    if (quarter === 4 && timeSeconds <= 300) return 'elevated';
    if (quarter >= 3 && scoreDiff <= 8) return 'moderate';
    return 'standard';
  }

  private calculateStopsNeeded(scoreDiff: number, possessionsRemaining: number): number {
    // Simple calculation: need to prevent opponent from scoring enough to maintain/extend lead
    const averagePointsPerPossession = this.WNBA_DEFENSIVE_FACTORS.POSSESSION_VALUE;
    const maxAllowableOpponentPoints = Math.max(0, scoreDiff - 1);
    return Math.max(0, possessionsRemaining - Math.floor(maxAllowableOpponentPoints / averagePointsPerPossession));
  }

  private analyzeFoulSituation(gameState: GameState): any {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    
    return {
      inBonusSituation: false, // Would need actual foul count data
      foulsToGive: this.WNBA_DEFENSIVE_FACTORS.FOUL_STRATEGY_THRESHOLD,
      shouldFoulToStop: quarter === 4 && timeSeconds <= 60,
      smartFoulNeeded: quarter >= 4 && timeSeconds <= 120,
      avoidFouling: quarter <= 2
    };
  }

  private analyzeShootClockDefense(quarter: number, timeSeconds: number): any {
    const shotClockTime = timeSeconds % 24;
    
    return {
      shotClockPressure: shotClockTime <= 8,
      canForceShotClockViolation: shotClockTime <= 5,
      contestLateShot: shotClockTime <= 3,
      defensiveValue: shotClockTime <= 8 ? this.WNBA_DEFENSIVE_FACTORS.SHOT_CLOCK_VIOLATION_VALUE : 0
    };
  }

  private calculateReboundingImportance(quarter: number, scoreDiff: number): string {
    if (quarter >= 4 && scoreDiff <= 5) return 'critical';
    if (quarter >= 3 && scoreDiff <= 8) return 'high';
    if (quarter >= 3) return 'important';
    return 'standard';
  }

  private identifyKeyDefensiveMatchups(gameState: GameState): string[] {
    // In real implementation, would analyze specific player matchups
    return [
      'Guard perimeter shooters',
      'Control paint defense',
      'Switch on screens effectively',
      'Help defense rotation',
      'Transition defense'
    ];
  }

  private evaluateTimeoutStrategy(quarter: number, timeSeconds: number): any {
    return {
      saveTimeoutsForDefense: quarter === 4 && timeSeconds <= 300,
      useTimeoutAfterScore: quarter >= 3,
      defensiveTimeoutValue: quarter >= 4 ? 'high' : 'medium',
      iceOpponentShooter: quarter === 4 && timeSeconds <= 120
    };
  }

  private evaluateSubstitutionNeeds(gameState: GameState): any {
    const quarter = gameState.quarter || 1;
    
    return {
      bringInDefensiveSpecialists: quarter >= 4,
      freshLegsNeeded: quarter >= 3,
      foulTroubleAdjustments: true, // Would need actual foul data
      matchupBasedSubs: quarter >= 3,
      energyAndIntensity: quarter >= 4
    };
  }

  private calculateAlertPriority(defensiveImportance: number, quarter: number, scoreDiff: number, timeSeconds: number): number {
    let priority = 78; // Base priority for defensive scenarios
    
    // Importance factor
    priority += Math.round(defensiveImportance * 0.12);
    
    // Quarter factor
    if (quarter >= 5) priority += 12; // Overtime
    else if (quarter === 4) priority += 8; // Fourth quarter
    else if (quarter === 3) priority += 4; // Third quarter
    
    // Score closeness factor
    if (scoreDiff <= 3) priority += 10;
    else if (scoreDiff <= 5) priority += 8;
    else if (scoreDiff <= 8) priority += 5;
    
    // Time urgency factor
    if (quarter === 4 && timeSeconds <= 60) priority += 10;
    else if (quarter === 4 && timeSeconds <= 120) priority += 7;
    else if (quarter === 4 && timeSeconds <= 300) priority += 5;
    
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