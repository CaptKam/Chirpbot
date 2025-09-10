import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ClutchPerformanceModule extends BaseAlertModule {
  alertType = 'NBA_CLUTCH_PERFORMANCE';
  sport = 'NBA';

  // NBA-specific clutch performance thresholds and analytics
  private readonly CLUTCH_TIME_SCENARIOS = {
    FINAL_POSSESSION: { quarter: 4, timeThreshold: 24, scoreDiffMax: 3 },
    FINAL_TWO_MINUTES: { quarter: 4, timeThreshold: 120, scoreDiffMax: 8 },
    FINAL_FIVE_MINUTES: { quarter: 4, timeThreshold: 300, scoreDiffMax: 5 },
    OVERTIME_ANY: { quarter: 5, timeThreshold: 600, scoreDiffMax: 15 },
    PLAYOFF_PRESSURE: { timeThreshold: 180, quarter: 3, scoreDiffMax: 10 }
  };

  private readonly NBA_CLUTCH_FACTORS = {
    POSSESSIONS_PER_MINUTE: 2.0, // NBA pace for final minutes
    POINTS_PER_POSSESSION: 1.1, // Elite NBA efficiency
    TIMEOUT_IMPACT_MULTIPLIER: 1.4, // Professional coaching advantage
    STAR_PLAYER_BOOST: 1.5, // Superstar clutch factor
    HOME_COURT_ADVANTAGE: 1.2, // NBA playoff atmosphere
    CHAMPIONSHIP_PRESSURE: 1.3 // Finals and conference finals
  };

  private readonly QUARTER_CLUTCH_WEIGHTS = {
    1: 0.1, // First quarter - minimal clutch factor
    2: 0.3, // Second quarter - building intensity
    3: 0.6, // Third quarter - setting up the finish
    4: 1.0, // Fourth quarter - maximum clutch factor
    5: 1.3  // Overtime - enhanced clutch factor
  };

  private readonly NBA_SUPERSTAR_CLUTCH_BOOST = {
    MVP_CANDIDATES: 1.4, // Current MVP candidates get clutch boost
    FINALS_MVP_HISTORY: 1.3, // Players with Finals MVP experience
    CLUTCH_REPUTATION: 1.2, // Players known for clutch performances
    PLAYOFF_EXPERIENCE: 1.1, // Veterans with deep playoff runs
    CHAMPIONSHIP_WINNERS: 1.25 // Players with championship experience
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
    
    // Check for various clutch performance scenarios
    return this.isClutchPerformanceScenario(quarter, timeSeconds, scoreDiff, gameState);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const clutchScenario = this.identifyClutchScenario(gameState);
    const clutchIntensity = this.calculateClutchIntensity(gameState);
    const superstarContext = this.analyzeSuperstarClutchContext(gameState);
    const performanceMetrics = this.calculateClutchPerformanceMetrics(gameState);
    const championshipContext = this.getChampionshipContext(gameState);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    // Determine leading team and trailing team
    const leadingTeam = homeScore > awayScore ? gameState.homeTeam : gameState.awayTeam;
    const trailingTeam = homeScore < awayScore ? gameState.homeTeam : gameState.awayTeam;
    
    return {
      alertKey: `${gameState.gameId}_clutch_performance_${quarter}_${this.parseTimeToSeconds(timeRemaining)}_${clutchScenario.type}`,
      type: this.alertType,
      message: `🏀 NBA CLUTCH TIME: ${clutchScenario.description} - ${leadingTeam} leads ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} with ${timeRemaining} left`,
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
        superstarContext,
        performanceMetrics,
        championshipContext,
        leadingTeam,
        trailingTeam,
        alertType: 'PREDICTIVE',
        predictionCategory: 'CLUTCH_PERFORMANCE',
        // NBA-specific context for AI enhancement
        nbaContext: {
          isClutchTime: true,
          isOvertime: quarter >= 5,
          isFinalMinute: this.parseTimeToSeconds(timeRemaining) <= 60,
          isFinalTwoMinutes: this.parseTimeToSeconds(timeRemaining) <= 120,
          possession: gameState.possession || null,
          shotClockPressure: this.parseTimeToSeconds(timeRemaining) % 24 <= 8,
          paceFactors: this.NBA_CLUTCH_FACTORS,
          clutchWeight: this.QUARTER_CLUTCH_WEIGHTS[quarter as keyof typeof this.QUARTER_CLUTCH_WEIGHTS] || 1.0,
          starPlayerBoost: this.calculateStarPlayerBoost(gameState),
          momentumShift: this.detectMomentumShift(gameState),
          timeoutStrategy: this.analyzeTimeoutStrategy(gameState),
          foulSituation: this.analyzeFoulSituation(gameState)
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
    let probability = 50 + (quarter * 12);
    
    // Time factor - more probability as time decreases in clutch situations
    if (quarter >= 4) {
      if (timeSeconds <= 60) probability += 35; // Final minute
      else if (timeSeconds <= 120) probability += 25; // Final 2 minutes
      else if (timeSeconds <= 300) probability += 15; // Final 5 minutes
    }
    
    // Score differential impact (NBA clutch ranges)
    if (scoreDiff <= 3) probability += 30; // One possession
    else if (scoreDiff <= 5) probability += 20; // Two possessions  
    else if (scoreDiff <= 8) probability += 15; // Three possessions
    
    // Overtime bonus
    if (quarter >= 5) probability += 25;
    
    // Professional basketball context
    probability += this.getChampionshipBonus(gameState);
    probability += this.getSuperstarBonus(gameState);
    
    return Math.min(probability, 95);
  }

  private isClutchPerformanceScenario(quarter: number, timeSeconds: number, scoreDiff: number, gameState: GameState): boolean {
    // Final possession scenario (within 24 seconds, close game)
    if (quarter >= 4 && timeSeconds <= 24 && scoreDiff <= 3) {
      return true;
    }
    
    // Final 2 minutes with moderate score differential
    if (quarter >= 4 && timeSeconds <= 120 && scoreDiff <= 8) {
      return true;
    }
    
    // Final 5 minutes with tight score
    if (quarter >= 4 && timeSeconds <= 300 && scoreDiff <= 5) {
      return true;
    }
    
    // Any overtime period
    if (quarter >= 5) {
      return true;
    }
    
    // Playoff pressure scenarios (if game context indicates playoffs)
    if (quarter >= 3 && timeSeconds <= 180 && scoreDiff <= 10) {
      const isPlayoffContext = this.isPlayoffContext(gameState);
      return isPlayoffContext;
    }
    
    return false;
  }

  private identifyClutchScenario(gameState: GameState): { type: string; description: string } {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    if (quarter >= 5) {
      return { type: 'OVERTIME_CLUTCH', description: 'Overtime clutch performance opportunity' };
    }
    
    if (quarter >= 4 && timeSeconds <= 24 && scoreDiff <= 3) {
      return { type: 'FINAL_POSSESSION', description: 'Final possession clutch moment' };
    }
    
    if (quarter >= 4 && timeSeconds <= 60) {
      return { type: 'FINAL_MINUTE', description: 'Final minute clutch pressure' };
    }
    
    if (quarter >= 4 && timeSeconds <= 120) {
      return { type: 'TWO_MINUTE_WARNING', description: 'Two-minute clutch situation' };
    }
    
    if (quarter >= 4 && timeSeconds <= 300) {
      return { type: 'FIVE_MINUTE_CLUTCH', description: 'Five-minute clutch time window' };
    }
    
    return { type: 'PLAYOFF_PRESSURE', description: 'Playoff-level clutch pressure' };
  }

  private calculateClutchIntensity(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let intensity = 0;
    
    // Time pressure (NBA-specific)
    if (timeSeconds <= 24) intensity += 50; // Shot clock scenario
    else if (timeSeconds <= 60) intensity += 40; // Final minute
    else if (timeSeconds <= 120) intensity += 30; // Final 2 minutes
    else if (timeSeconds <= 300) intensity += 20; // Final 5 minutes
    
    // Score pressure
    if (scoreDiff <= 2) intensity += 35; // One possession
    else if (scoreDiff <= 5) intensity += 25; // Two possessions
    else if (scoreDiff <= 8) intensity += 15; // Three possessions
    
    // Quarter pressure
    if (quarter >= 5) intensity += 25; // Overtime
    else if (quarter === 4) intensity += 20; // Fourth quarter
    
    // Championship context
    intensity += this.getChampionshipBonus(gameState);
    
    return Math.min(intensity, 100);
  }

  private analyzeSuperstarClutchContext(gameState: GameState): any {
    // In a real implementation, this would analyze current rosters and player stats
    return {
      starPlayersActive: this.identifyStarPlayers(gameState),
      clutchPerformanceHistory: this.getClutchHistory(gameState),
      mvpCandidatesPresent: this.checkMVPCandidates(gameState),
      championshipExperience: this.getChampionshipExperience(gameState),
      clutchRatings: this.getPlayerClutchRatings(gameState)
    };
  }

  private calculateClutchPerformanceMetrics(gameState: GameState): any {
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const quarter = gameState.quarter || 1;
    
    return {
      possessionsRemaining: Math.ceil(timeSeconds / 30), // Approximate NBA possessions
      scoringOpportunities: Math.ceil(timeSeconds / 24), // Shot clock opportunities
      timeoutStrategy: this.calculateTimeoutStrategy(timeSeconds, quarter),
      foulStrategy: this.calculateFoulStrategy(gameState),
      clutchFactorRating: this.calculateClutchFactor(gameState),
      momentumIndicator: this.calculateMomentum(gameState),
      pressureIndex: this.calculatePressureIndex(gameState)
    };
  }

  private getChampionshipContext(gameState: GameState): any {
    // This would analyze current season context, playoff implications, etc.
    return {
      isPlayoffGame: this.isPlayoffContext(gameState),
      championshipImplications: this.getChampionshipImplications(gameState),
      conferenceStandings: this.getConferenceContext(gameState),
      historicalSignificance: this.getHistoricalContext(gameState),
      mediaAttention: this.getMediaAttentionLevel(gameState),
      legacyImpact: this.getLegacyImpact(gameState)
    };
  }

  private calculateAlertPriority(clutchIntensity: number, quarter: number, timeSeconds: number): number {
    let priority = 80; // Base priority for NBA clutch situations
    
    if (clutchIntensity > 90) priority = 95;
    else if (clutchIntensity > 75) priority = 92;
    else if (clutchIntensity > 60) priority = 88;
    else if (quarter >= 5) priority = 90; // Overtime boost
    else if (timeSeconds <= 60 && quarter >= 4) priority = 93; // Final minute
    
    return priority;
  }

  // Helper methods for detailed analysis
  private identifyStarPlayers(gameState: GameState): string[] {
    // Placeholder - would integrate with NBA roster data
    return [];
  }

  private getClutchHistory(gameState: GameState): any {
    // Placeholder - would analyze historical clutch performance
    return {};
  }

  private checkMVPCandidates(gameState: GameState): boolean {
    // Placeholder - would check current MVP race
    return false;
  }

  private getChampionshipExperience(gameState: GameState): any {
    // Placeholder - would analyze championship experience of players
    return {};
  }

  private getPlayerClutchRatings(gameState: GameState): any {
    // Placeholder - would provide clutch performance ratings
    return {};
  }

  private calculateTimeoutStrategy(timeSeconds: number, quarter: number): string {
    if (timeSeconds <= 60 && quarter >= 4) return 'Critical timeout management';
    if (timeSeconds <= 120 && quarter >= 4) return 'Strategic timeout opportunity';
    return 'Standard timeout availability';
  }

  private calculateFoulStrategy(gameState: GameState): string {
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    
    if (timeSeconds <= 60 && scoreDiff <= 5) return 'Fouling strategy consideration';
    return 'Standard defensive approach';
  }

  private calculateClutchFactor(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return (quarter * 10) + (300 - timeSeconds) / 10 + (10 - scoreDiff);
  }

  private calculateMomentum(gameState: GameState): string {
    // Placeholder - would analyze recent scoring runs
    return 'Neutral momentum';
  }

  private calculatePressureIndex(gameState: GameState): number {
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    let pressure = quarter * 20;
    pressure += (300 - timeSeconds) / 5;
    pressure += (15 - scoreDiff) * 2;
    
    return Math.min(pressure, 100);
  }

  private isPlayoffContext(gameState: GameState): boolean {
    // Placeholder - would determine if this is a playoff game
    return false;
  }

  private getChampionshipImplications(gameState: GameState): any {
    // Placeholder - would analyze championship race implications
    return {};
  }

  private getConferenceContext(gameState: GameState): any {
    // Placeholder - would provide conference standings context
    return {};
  }

  private getHistoricalContext(gameState: GameState): any {
    // Placeholder - would provide historical significance
    return {};
  }

  private getMediaAttentionLevel(gameState: GameState): string {
    // Placeholder - would assess media coverage level
    return 'Standard coverage';
  }

  private getLegacyImpact(gameState: GameState): any {
    // Placeholder - would analyze potential legacy impact
    return {};
  }

  private getChampionshipBonus(gameState: GameState): number {
    // Placeholder - would provide championship context bonus
    return 0;
  }

  private getSuperstarBonus(gameState: GameState): number {
    // Placeholder - would provide superstar player bonus
    return 0;
  }

  private calculateStarPlayerBoost(gameState: GameState): number {
    // Placeholder - would calculate star player impact
    return 1.0;
  }

  private detectMomentumShift(gameState: GameState): any {
    // Placeholder - would detect momentum changes
    return {};
  }

  private analyzeTimeoutStrategy(gameState: GameState): any {
    // Placeholder - would analyze timeout strategy
    return {};
  }

  private analyzeFoulSituation(gameState: GameState): any {
    // Placeholder - would analyze foul situation
    return {};
  }
}