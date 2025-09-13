import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ClutchTimeOpportunityModule extends BaseAlertModule {
  alertType = 'WNBA_CLUTCH_TIME_OPPORTUNITY';
  sport = 'WNBA';

  // WNBA-specific clutch time thresholds and analytics
  private readonly CLUTCH_TIME_SCENARIOS = {
    FINAL_POSSESSION: { quarter: 4, timeThreshold: 24, scoreDiffMax: 3 },
    FINAL_TWO_MINUTES: { quarter: 4, timeThreshold: 120, scoreDiffMax: 8 },
    FINAL_FIVE_MINUTES: { quarter: 4, timeThreshold: 300, scoreDiffMax: 5 },
    OVERTIME_ANY: { quarter: 5, timeThreshold: 600, scoreDiffMax: 15 },
    SHOT_CLOCK_PRESSURE: { timeThreshold: 8, quarter: 3, scoreDiffMax: 12 }
  };

  private readonly WNBA_PACE_FACTORS = {
    POSSESSIONS_PER_MINUTE: 1.8, // Average WNBA pace
    POINTS_PER_POSSESSION: 1.05, // Average WNBA efficiency
    TIMEOUT_IMPACT_MULTIPLIER: 1.3,
    FOUL_TROUBLE_THRESHOLD: 4,
    BENCH_DEPTH_FACTOR: 0.85
  };

  private readonly QUARTER_CLUTCH_WEIGHTS = {
    1: 0.2, // First quarter - minimal clutch factor
    2: 0.4, // Second quarter - building momentum  
    3: 0.7, // Third quarter - setting up the finish
    4: 1.0, // Fourth quarter - maximum clutch factor
    5: 1.2  // Overtime - enhanced clutch factor
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
    
    // Check for various clutch time scenarios
    return this.isClutchTimeScenario(quarter, timeSeconds, scoreDiff, gameState);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const clutchScenario = this.identifyClutchScenario(gameState);
    const clutchIntensity = this.calculateClutchIntensity(gameState);
    const winProbability = this.calculateWinProbability(gameState);
    const keyFactors = this.getClutchKeyFactors(gameState);
    const gameContext = this.getGameContext(gameState);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    // Determine leading team and trailing team
    const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
    const trailingTeam = homeScore < awayScore ? gameState.homeTeam : gameState.awayTeam;
    
    return {
      alertKey: `${gameState.gameId}_clutch_time_${quarter}_${this.parseTimeToSeconds(timeRemaining)}_${clutchScenario.type}`,
      type: this.alertType,
      message: `🏀 CLUTCH TIME: ${clutchScenario.description} - ${leadingTeam} leads ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} with ${timeRemaining} left`,
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
        clutchScenario: clutchScenario.type,
        clutchIntensity: Math.round(clutchIntensity),
        winProbability: Math.round(winProbability),
        leadingTeam,
        trailingTeam,
        keyFactors,
        gameContext,
        alertType: 'PREDICTIVE',
        predictionCategory: 'CLUTCH_TIME_OPPORTUNITY',
        // WNBA-specific context for AI enhancement
        wnbaContext: {
          isClutchTime: true,
          isOvertime: quarter >= 5,
          isFinalMinute: this.parseTimeToSeconds(timeRemaining) <= 60,
          isFinalTwoMinutes: this.parseTimeToSeconds(timeRemaining) <= 120,
          possession: gameState.possession || null,
          shotClockPressure: this.parseTimeToSeconds(timeRemaining) % 24 <= 8,
          paceFactors: this.WNBA_PACE_FACTORS,
          clutchWeight: this.QUARTER_CLUTCH_WEIGHTS[quarter as keyof typeof this.QUARTER_CLUTCH_WEIGHTS] || 1.0,
          momentumShift: this.detectMomentumShift(gameState),
          keyMatchups: this.identifyKeyMatchups(gameState)
        }
      },
      priority: this.calculateAlertPriority(clutchIntensity, quarter, this.parseTimeToSeconds(timeRemaining))
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Base probability starts higher for later quarters
    let probability = 40 + (quarter * 15);
    
    // Time factor - more probability as time decreases in clutch situations
    if (quarter >= 4) {
      if (timeSeconds <= 60) probability += 40;
      else if (timeSeconds <= 120) probability += 30;
      else if (timeSeconds <= 300) probability += 20;
    }
    
    // Score differential impact
    if (scoreDiff <= 3) probability += 25;
    else if (scoreDiff <= 5) probability += 20;
    else if (scoreDiff <= 8) probability += 15;
    
    // Overtime bonus
    if (quarter >= 5) probability += 30;
    
    return Math.min(probability, 95);
  }

  private isClutchTimeScenario(quarter: number, timeSeconds: number, scoreDiff: number, gameState: GameState): boolean {
    // Final possession scenarios (game on the line)
    if (quarter >= 4 && timeSeconds <= this.CLUTCH_TIME_SCENARIOS.FINAL_POSSESSION.timeThreshold && 
        scoreDiff <= this.CLUTCH_TIME_SCENARIOS.FINAL_POSSESSION.scoreDiffMax) {
      return true;
    }
    
    // Final two minutes of regulation
    if (quarter === 4 && timeSeconds <= this.CLUTCH_TIME_SCENARIOS.FINAL_TWO_MINUTES.timeThreshold && 
        scoreDiff <= this.CLUTCH_TIME_SCENARIOS.FINAL_TWO_MINUTES.scoreDiffMax) {
      return true;
    }
    
    // Final five minutes with close score
    if (quarter === 4 && timeSeconds <= this.CLUTCH_TIME_SCENARIOS.FINAL_FIVE_MINUTES.timeThreshold && 
        scoreDiff <= this.CLUTCH_TIME_SCENARIOS.FINAL_FIVE_MINUTES.scoreDiffMax) {
      return true;
    }
    
    // Any overtime period
    if (quarter >= 5 && scoreDiff <= this.CLUTCH_TIME_SCENARIOS.OVERTIME_ANY.scoreDiffMax) {
      return true;
    }
    
    // Shot clock pressure in competitive games
    if (quarter >= this.CLUTCH_TIME_SCENARIOS.SHOT_CLOCK_PRESSURE.quarter && 
        timeSeconds % 24 <= this.CLUTCH_TIME_SCENARIOS.SHOT_CLOCK_PRESSURE.timeThreshold &&
        scoreDiff <= this.CLUTCH_TIME_SCENARIOS.SHOT_CLOCK_PRESSURE.scoreDiffMax) {
      return true;
    }
    
    return false;
  }

  private identifyClutchScenario(gameState: GameState): { type: string; description: string } {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    if (quarter >= 5) {
      return { type: 'OVERTIME_CLUTCH', description: 'Overtime clutch time' };
    }
    
    if (quarter === 4 && timeSeconds <= 24) {
      return { type: 'FINAL_POSSESSION', description: 'Final possession decides game' };
    }
    
    if (quarter === 4 && timeSeconds <= 60) {
      return { type: 'FINAL_MINUTE', description: 'Final minute crunch time' };
    }
    
    if (quarter === 4 && timeSeconds <= 120) {
      return { type: 'FINAL_TWO_MINUTES', description: 'Two-minute warning territory' };
    }
    
    if (quarter === 4 && timeSeconds <= 300) {
      return { type: 'FINAL_FIVE_MINUTES', description: 'Final five minutes pressure' };
    }
    
    if (timeSeconds % 24 <= 8 && quarter >= 3) {
      return { type: 'SHOT_CLOCK_PRESSURE', description: 'Shot clock pressure situation' };
    }
    
    return { type: 'COMPETITIVE_CLUTCH', description: 'Competitive clutch scenario' };
  }

  private calculateClutchIntensity(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let intensity = 50;
    
    // Quarter weight
    intensity *= this.QUARTER_CLUTCH_WEIGHTS[quarter as keyof typeof this.QUARTER_CLUTCH_WEIGHTS] || 1.0;
    
    // Time pressure (more intense as time decreases)
    if (quarter >= 4) {
      if (timeSeconds <= 30) intensity += 40;
      else if (timeSeconds <= 60) intensity += 30;
      else if (timeSeconds <= 120) intensity += 20;
      else if (timeSeconds <= 300) intensity += 10;
    }
    
    // Score closeness
    if (scoreDiff <= 1) intensity += 30;
    else if (scoreDiff <= 3) intensity += 25;
    else if (scoreDiff <= 5) intensity += 20;
    else if (scoreDiff <= 8) intensity += 15;
    
    // Overtime multiplier
    if (quarter >= 5) intensity *= 1.3;
    
    return Math.min(intensity, 100);
  }

  private calculateWinProbability(gameState: GameState): number {
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    
    // Simple win probability based on score differential and time remaining
    const scoreDiff = homeScore - awayScore;
    const timeRemaining = quarter === 4 ? timeSeconds : timeSeconds + ((4 - quarter) * 600);
    
    // Estimate possessions remaining (WNBA pace)
    const possessionsRemaining = timeRemaining / (60 / this.WNBA_PACE_FACTORS.POSSESSIONS_PER_MINUTE);
    
    // Win probability calculation (simplified)
    let winProb = 50;
    if (scoreDiff > 0) {
      winProb += Math.min(scoreDiff * 3, 30); // Leading team advantage
      winProb += Math.max(30 - possessionsRemaining, 0); // Time advantage
    } else if (scoreDiff < 0) {
      winProb -= Math.min(Math.abs(scoreDiff) * 3, 30); // Trailing team disadvantage
      winProb -= Math.max(30 - possessionsRemaining, 0); // Time disadvantage
    }
    
    return Math.min(Math.max(winProb, 5), 95);
  }

  private getClutchKeyFactors(gameState: GameState): string[] {
    const factors = [];
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    if (quarter >= 5) factors.push('Overtime pressure');
    if (timeSeconds <= 60 && quarter >= 4) factors.push('Final minute execution');
    if (scoreDiff <= 3) factors.push('One-possession game');
    if (timeSeconds % 24 <= 8) factors.push('Shot clock pressure');
    if (quarter >= 4 && timeSeconds <= 120) factors.push('Crunch time defense');
    
    return factors;
  }

  private getGameContext(gameState: GameState): any {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    
    return {
      isCloseGame: Math.abs(homeScore - awayScore) <= 8,
      isOvertimeGame: quarter >= 5,
      isFinalStretch: quarter === 4 && timeSeconds <= 300,
      isPossessionGame: Math.abs(homeScore - awayScore) <= 3,
      gamePhase: quarter <= 2 ? 'early' : quarter === 3 ? 'middle' : quarter === 4 ? 'clutch' : 'overtime',
      totalScore: homeScore + awayScore,
      pace: this.estimateGamePace(homeScore + awayScore, quarter, timeSeconds)
    };
  }

  private detectMomentumShift(gameState: GameState): boolean {
    // Simplified momentum detection - would need historical play data for full implementation
    const quarter = gameState.quarter || 1;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // In real implementation, would analyze recent scoring runs, timeouts, etc.
    return quarter >= 3 && scoreDiff <= 8;
  }

  private identifyKeyMatchups(gameState: GameState): string[] {
    // In real implementation, would identify key player matchups
    // For now, return general basketball matchup factors
    return [
      'Point guard vs defense',
      'Post presence',
      'Three-point shooting',
      'Bench depth',
      'Foul trouble impact'
    ];
  }

  private estimateGamePace(totalScore: number, quarter: number, timeSeconds: number): string {
    const gameTime = ((quarter - 1) * 600) + (600 - timeSeconds);
    const pointsPerMinute = totalScore / (gameTime / 60);
    
    if (pointsPerMinute > 3.0) return 'fast';
    if (pointsPerMinute > 2.5) return 'medium';
    return 'slow';
  }

  private calculateAlertPriority(clutchIntensity: number, quarter: number, timeSeconds: number): number {
    let priority = 75; // Base priority for clutch time
    
    // Intensity factor
    priority += Math.round(clutchIntensity * 0.15);
    
    // Quarter factor
    if (quarter >= 5) priority += 10; // Overtime
    else if (quarter === 4) priority += 5; // Fourth quarter
    
    // Time factor
    if (timeSeconds <= 60) priority += 10;
    else if (timeSeconds <= 120) priority += 5;
    
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