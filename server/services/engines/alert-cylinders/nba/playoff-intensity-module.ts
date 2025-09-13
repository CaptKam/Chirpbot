import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class PlayoffIntensityModule extends BaseAlertModule {
  alertType = 'NBA_PLAYOFF_INTENSITY';
  sport = 'NBA';

  // NBA playoff structure and intensity analytics
  private readonly NBA_PLAYOFF_STRUCTURE = {
    CONFERENCE_TEAMS: 8, // 8 teams per conference make playoffs
    PLAYOFF_ROUNDS: 4, // First Round, Semifinals, Conference Finals, Finals
    SERIES_LENGTH: 7, // Best-of-7 series
    ELIMINATION_GAMES: [4, 5, 6, 7], // Games that can end a series
    HOME_COURT_ADVANTAGE: [1, 2, 5, 7], // Home games in series
    ROAD_PRESSURE: [3, 4, 6] // Road games in series
  };

  private readonly PLAYOFF_INTENSITY_SCENARIOS = {
    ELIMINATION_GAME: { seriesStatus: 'elimination', importance: 1.0 },
    CLOSEOUT_GAME: { seriesStatus: 'closeout', importance: 0.9 },
    SERIES_CLINCHING: { seriesStatus: 'clinching', importance: 0.95 },
    GAME_7: { gameNumber: 7, importance: 1.0 },
    CONFERENCE_FINALS: { round: 'CF', importance: 0.9 },
    NBA_FINALS: { round: 'Finals', importance: 1.0 },
    DYNASTY_DEFINING: { context: 'dynasty', importance: 0.95 },
    UPSET_POTENTIAL: { underdog: true, importance: 0.85 }
  };

  private readonly CHAMPIONSHIP_CONTEXT_MULTIPLIERS = {
    NBA_FINALS_GAME_7: 2.5, // Ultimate championship game
    CONFERENCE_FINALS_GAME_7: 2.0, // Conference championship
    ELIMINATION_GAME: 1.8, // Must-win scenarios
    FIRST_CHAMPIONSHIP: 1.6, // Team seeking first title
    DYNASTY_CONTINUATION: 1.5, // Championship dynasty
    HISTORIC_RIVALRY: 1.4, // Classic championship matchups
    SUPERSTAR_LEGACY: 1.7, // Elite player championship moment
    COACHING_LEGACY: 1.3, // Championship coaching moment
    FRANCHISE_DROUGHT: 1.6, // Long championship drought
    UPSET_COMPLETION: 1.5 // Completing historic upset
  };

  private readonly PLAYOFF_PRESSURE_FACTORS = {
    HOME_COURT_PRESSURE: 0.25, // Playoff home crowd intensity
    ELIMINATION_PRESSURE: 0.35, // Do-or-die game pressure
    CHAMPIONSHIP_EXPERIENCE: 0.20, // Veterans vs. inexperienced teams
    SUPERSTAR_PERFORMANCE: 0.30, // Elite players in playoffs
    COACHING_ADJUSTMENTS: 0.15, // Strategic playoff coaching
    INJURY_FACTOR: 0.10, // Playing through playoff injuries
    MEDIA_SCRUTINY: 0.15, // Playoff media attention
    LEGACY_IMPLICATIONS: 0.25 // Historical significance pressure
  };

  private readonly NBA_CHAMPIONSHIP_LEGACY = {
    FIRST_TIME_CHAMPIONS: 1.4, // Teams winning first championship
    DYNASTY_BUILDERS: 1.3, // Teams building championship runs
    CHAMPIONSHIP_VETERANS: 1.2, // Teams with recent titles
    SUPERSTAR_VALIDATION: 1.5, // Elite players seeking first title
    COACHING_MASTERCLASS: 1.2, // Championship coaching moments
    HISTORIC_FRANCHISES: 1.1, // Storied franchise championships
    MARKET_PRESSURE: 1.2, // Large market championship expectations
    INTERNATIONAL_IMPACT: 1.1 // Global NBA championship impact
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger during live games with playoff implications
    if (gameState.status !== 'live') return false;
    
    // Check for playoff intensity scenarios
    return this.hasPlayoffIntensity(gameState);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const playoffContext = this.analyzePlayoffContext(gameState);
    const intensityLevel = this.calculateIntensityLevel(gameState, playoffContext);
    const championshipImplications = this.analyzeChampionshipImplications(gameState, playoffContext);
    const legacyAnalysis = this.analyzeLegacyImplications(gameState, playoffContext);
    const pressureFactors = this.analyzePressureFactors(gameState, playoffContext);
    const historicalContext = this.getHistoricalContext(gameState, playoffContext);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    const scenarioType = this.identifyPlayoffScenario(gameState, playoffContext);
    
    return {
      alertKey: `${gameState.gameId}_playoff_intensity_${scenarioType.type}_${quarter}_${this.parseTimeToSeconds(timeRemaining)}`,
      type: this.alertType,
      message: `🏆 NBA PLAYOFF INTENSITY: ${scenarioType.description} - ${gameState.homeTeam} vs ${gameState.awayTeam} (${homeScore}-${awayScore})`,
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
        playoffScenario: scenarioType.type,
        intensityLevel: Math.round(intensityLevel),
        playoffContext,
        championshipImplications,
        legacyAnalysis,
        pressureFactors,
        historicalContext,
        alertType: 'PREDICTIVE',
        predictionCategory: 'PLAYOFF_INTENSITY',
        // NBA-specific context for AI enhancement
        nbaContext: {
          hasPlayoffIntensity: true,
          isEliminationGame: this.isEliminationGame(gameState, playoffContext),
          isCloseoutGame: this.isCloseoutGame(gameState, playoffContext),
          isGame7: this.isGame7(gameState, playoffContext),
          isConferenceFinals: this.isConferenceFinals(gameState, playoffContext),
          isNBAFinals: this.isNBAFinals(gameState, playoffContext),
          championshipOnLine: this.isChampionshipOnLine(gameState, playoffContext),
          dynastyImplications: this.hasDynastyImplications(gameState, playoffContext),
          firstChampionship: this.isFirstChampionship(gameState, playoffContext),
          superstarLegacy: this.hasSuperstarLegacy(gameState, playoffContext),
          historicRivalry: this.isHistoricRivalry(gameState, playoffContext),
          upsetPotential: this.hasUpsetPotential(gameState, playoffContext),
          homeCourAdvantage: this.analyzeHomeCourt(gameState, playoffContext),
          seriesMomentum: this.analyzeSeriesMomentum(gameState, playoffContext),
          coachingBattle: this.analyzeCoachingBattle(gameState, playoffContext),
          injuryImpact: this.analyzeInjuryImpact(gameState, playoffContext),
          mediaSpotlight: this.getMediaSpotlight(gameState, playoffContext),
          fanExpectations: this.getFanExpectations(gameState, playoffContext),
          bettingAction: this.getBettingAction(gameState, playoffContext),
          globalViewership: this.getGlobalViewership(gameState, playoffContext),
          pressureFactorWeights: this.PLAYOFF_PRESSURE_FACTORS,
          championshipMultipliers: this.CHAMPIONSHIP_CONTEXT_MULTIPLIERS,
          legacyFactors: this.NBA_CHAMPIONSHIP_LEGACY
        }
      },
      priority: this.calculateAlertPriority(intensityLevel, scenarioType.type, quarter, championshipImplications.isChampionshipGame)
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const playoffContext = this.analyzePlayoffContext(gameState);
    const quarter = gameState.quarter || 1;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Base probability from playoff context
    let probability = playoffContext.baseIntensity * 100;
    
    // Quarter progression (playoff intensity builds)
    if (quarter >= 4) probability += 30; // Fourth quarter playoff drama
    else if (quarter >= 3) probability += 20; // Third quarter playoff build-up
    else if (quarter >= 2) probability += 15; // Second quarter playoff development
    
    // Time pressure in playoffs
    if (quarter >= 4) {
      if (timeSeconds <= 120) probability += 25; // Final 2 minutes playoff intensity
      else if (timeSeconds <= 300) probability += 20; // Final 5 minutes playoff pressure
    }
    
    // Score differential impact (playoff games are often close)
    if (scoreDiff <= 3) probability += 25; // One possession playoff games
    else if (scoreDiff <= 7) probability += 20; // Close playoff battles
    else if (scoreDiff <= 12) probability += 15; // Competitive playoff games
    
    // Playoff scenario bonuses
    if (this.isEliminationGame(gameState, playoffContext)) probability += 30;
    if (this.isGame7(gameState, playoffContext)) probability += 35;
    if (this.isNBAFinals(gameState, playoffContext)) probability += 25;
    if (this.isConferenceFinals(gameState, playoffContext)) probability += 20;
    
    // Legacy and historical factors
    probability += this.getLegacyBonus(gameState, playoffContext);
    probability += this.getHistoricalBonus(gameState, playoffContext);
    probability += this.getDynastyBonus(gameState, playoffContext);
    
    return Math.min(probability, 95);
  }

  private hasPlayoffIntensity(gameState: GameState): boolean {
    // Check multiple playoff intensity indicators
    
    // Simulate playoff context (in real implementation, would get from database)
    const playoffContext = this.estimatePlayoffContext(gameState);
    
    // Elimination game scenarios
    if (this.isEliminationGame(gameState, playoffContext)) {
      return true;
    }
    
    // Close-out opportunities
    if (this.isCloseoutGame(gameState, playoffContext)) {
      return true;
    }
    
    // Game 7 scenarios
    if (this.isGame7(gameState, playoffContext)) {
      return true;
    }
    
    // Conference Finals or NBA Finals
    if (this.isConferenceFinals(gameState, playoffContext) || this.isNBAFinals(gameState, playoffContext)) {
      return true;
    }
    
    // Dynasty or legacy implications
    if (this.hasDynastyImplications(gameState, playoffContext) || this.hasSuperstarLegacy(gameState, playoffContext)) {
      return true;
    }
    
    // Historic upset potential
    if (this.hasUpsetPotential(gameState, playoffContext)) {
      return true;
    }
    
    return false;
  }

  private analyzePlayoffContext(gameState: GameState): any {
    return this.estimatePlayoffContext(gameState);
  }

  private estimatePlayoffContext(gameState: GameState): any {
    // In real implementation, would get actual playoff data from database/API
    // This simulates playoff context based on game data and season timing
    
    const currentDate = new Date();
    const month = currentDate.getMonth(); // 0-11
    
    // Estimate playoff phase based on month
    let playoffPhase = 'REGULAR_SEASON';
    let round = 'NONE';
    let seriesGame = 1;
    
    if (month >= 3 && month <= 5) { // April-June (NBA playoffs)
      playoffPhase = 'PLAYOFFS';
      if (month === 3) { // April
        round = 'FIRST_ROUND';
        seriesGame = Math.floor(Math.random() * 7) + 1;
      } else if (month === 4) { // May
        round = 'CONFERENCE_SEMIFINALS';
        seriesGame = Math.floor(Math.random() * 7) + 1;
      } else if (month === 5) { // June
        round = Math.random() > 0.5 ? 'CONFERENCE_FINALS' : 'NBA_FINALS';
        seriesGame = Math.floor(Math.random() * 7) + 1;
      }
    }
    
    return {
      playoffPhase,
      round,
      seriesGame,
      baseIntensity: this.calculateBaseIntensity(playoffPhase, round, seriesGame),
      isEliminationScenario: this.checkEliminationScenario(seriesGame),
      isCloseoutScenario: this.checkCloseoutScenario(seriesGame),
      championshipImplications: this.getChampionshipImplications(round),
      dynastyContext: this.getDynastyContext(gameState),
      rivalryContext: this.getRivalryContext(gameState),
      upsetContext: this.getUpsetContext(gameState)
    };
  }

  private calculateIntensityLevel(gameState: GameState, playoffContext: any): number {
    let intensityLevel = playoffContext.baseIntensity * 100;
    
    // Round-specific multipliers
    const roundMultipliers = {
      'FIRST_ROUND': 0.7,
      'CONFERENCE_SEMIFINALS': 0.8,
      'CONFERENCE_FINALS': 0.9,
      'NBA_FINALS': 1.0
    };
    
    intensityLevel *= roundMultipliers[playoffContext.round as keyof typeof roundMultipliers] || 0.6;
    
    // Series game multipliers
    const gameMultipliers = {
      1: 0.8, 2: 0.8, 3: 0.9, 4: 0.95, 5: 1.0, 6: 1.1, 7: 1.2
    };
    
    intensityLevel *= gameMultipliers[playoffContext.seriesGame as keyof typeof gameMultipliers] || 1.0;
    
    // Scenario bonuses
    if (playoffContext.isEliminationScenario) intensityLevel += 25;
    if (playoffContext.isCloseoutScenario) intensityLevel += 20;
    if (playoffContext.championshipImplications) intensityLevel += 15;
    
    // Legacy and context bonuses
    intensityLevel += this.getLegacyBonus(gameState, playoffContext);
    intensityLevel += this.getDynastyBonus(gameState, playoffContext);
    
    return Math.min(intensityLevel, 100);
  }

  private analyzeChampionshipImplications(gameState: GameState, playoffContext: any): any {
    return {
      isChampionshipGame: this.isChampionshipGame(gameState, playoffContext),
      championshipProbability: this.calculateChampionshipProbability(gameState, playoffContext),
      pathToChampionship: this.analyzeChampionshipPath(gameState, playoffContext),
      firstChampionshipOpportunity: this.checkFirstChampionshipOpportunity(gameState, playoffContext),
      dynastyContinuation: this.checkDynastyContinuation(gameState, playoffContext),
      franchiseHistory: this.analyzeFranchiseHistory(gameState, playoffContext),
      marketImpact: this.analyzeMarketImpact(gameState, playoffContext),
      globalSignificance: this.analyzeGlobalSignificance(gameState, playoffContext)
    };
  }

  private analyzeLegacyImplications(gameState: GameState, playoffContext: any): any {
    return {
      superstarLegacies: this.analyzeSuperstarLegacies(gameState, playoffContext),
      coachingLegacies: this.analyzeCoachingLegacies(gameState, playoffContext),
      franchiseLegacies: this.analyzeFranchiseLegacies(gameState, playoffContext),
      generationalShift: this.analyzeGenerationalShift(gameState, playoffContext),
      retirementImpact: this.analyzeRetirementImpact(gameState, playoffContext),
      breakoutMoments: this.analyzeBreakoutMoments(gameState, playoffContext),
      redemptionStories: this.analyzeRedemptionStories(gameState, playoffContext),
      historicalParallels: this.analyzeHistoricalParallels(gameState, playoffContext)
    };
  }

  private analyzePressureFactors(gameState: GameState, playoffContext: any): any {
    return {
      homeCourPressure: this.analyzeHomeCourt(gameState, playoffContext),
      eliminationPressure: this.analyzeEliminationPressure(gameState, playoffContext),
      experienceFactor: this.analyzeExperienceFactor(gameState, playoffContext),
      mediaScrutiny: this.analyzeMediaScrutiny(gameState, playoffContext),
      fanExpectations: this.analyzeFanExpectations(gameState, playoffContext),
      injuryFactors: this.analyzeInjuryFactors(gameState, playoffContext),
      coachingPressure: this.analyzeCoachingPressure(gameState, playoffContext),
      momentumShifts: this.analyzeMomentumShifts(gameState, playoffContext)
    };
  }

  private identifyPlayoffScenario(gameState: GameState, playoffContext: any): { type: string; description: string } {
    if (this.isGame7(gameState, playoffContext)) {
      if (playoffContext.round === 'NBA_FINALS') {
        return { type: 'NBA_FINALS_GAME_7', description: 'NBA Finals Game 7 championship deciding game' };
      } else if (playoffContext.round === 'CONFERENCE_FINALS') {
        return { type: 'CONFERENCE_FINALS_GAME_7', description: 'Conference Finals Game 7 championship berth' };
      } else {
        return { type: 'GAME_7', description: 'Playoff Game 7 elimination showdown' };
      }
    }
    
    if (this.isEliminationGame(gameState, playoffContext)) {
      return { type: 'ELIMINATION_GAME', description: 'Must-win elimination game' };
    }
    
    if (this.isCloseoutGame(gameState, playoffContext)) {
      return { type: 'CLOSEOUT_GAME', description: 'Series closeout opportunity' };
    }
    
    if (this.isNBAFinals(gameState, playoffContext)) {
      return { type: 'NBA_FINALS', description: 'NBA Finals championship battle' };
    }
    
    if (this.isConferenceFinals(gameState, playoffContext)) {
      return { type: 'CONFERENCE_FINALS', description: 'Conference Finals championship berth battle' };
    }
    
    return { type: 'PLAYOFF_INTENSITY', description: 'High-intensity playoff battle' };
  }

  private calculateAlertPriority(intensityLevel: number, scenarioType: string, quarter: number, isChampionshipGame: boolean): number {
    let priority = 88; // Base priority for playoff intensity
    
    // Intensity level adjustments
    if (intensityLevel > 95) priority = 95;
    else if (intensityLevel > 90) priority = 94;
    else if (intensityLevel > 85) priority = 92;
    else if (intensityLevel > 80) priority = 90;
    
    // Scenario type bonuses
    const scenarioPriorities = {
      'NBA_FINALS_GAME_7': 95,
      'CONFERENCE_FINALS_GAME_7': 94,
      'GAME_7': 93,
      'ELIMINATION_GAME': 92,
      'CLOSEOUT_GAME': 90,
      'NBA_FINALS': 91,
      'CONFERENCE_FINALS': 89,
      'PLAYOFF_INTENSITY': 88
    };
    
    const scenarioPriority = scenarioPriorities[scenarioType as keyof typeof scenarioPriorities];
    if (scenarioPriority) {
      priority = Math.max(priority, scenarioPriority);
    }
    
    // Additional adjustments
    if (isChampionshipGame) priority = Math.max(priority, 94);
    if (quarter >= 4) priority += 1; // Fourth quarter playoff drama
    
    return Math.min(priority, 95);
  }

  // Helper methods for playoff analysis (placeholders for full implementation)
  private calculateBaseIntensity(playoffPhase: string, round: string, seriesGame: number): number {
    if (playoffPhase !== 'PLAYOFFS') return 0.3;
    
    const baseIntensities = {
      'FIRST_ROUND': 0.6,
      'CONFERENCE_SEMIFINALS': 0.7,
      'CONFERENCE_FINALS': 0.8,
      'NBA_FINALS': 0.9
    };
    
    const roundIntensity = baseIntensities[round as keyof typeof baseIntensities] || 0.5;
    const gameIntensity = Math.min(seriesGame / 7, 1.0);
    
    return roundIntensity * 0.7 + gameIntensity * 0.3;
  }

  private checkEliminationScenario(seriesGame: number): boolean {
    return seriesGame >= 4; // Games 4-7 can be elimination
  }

  private checkCloseoutScenario(seriesGame: number): boolean {
    return seriesGame >= 4 && seriesGame <= 6; // Games 4-6 can be closeout
  }

  private getChampionshipImplications(round: string): boolean {
    return round === 'CONFERENCE_FINALS' || round === 'NBA_FINALS';
  }

  private getDynastyContext(gameState: GameState): any { return {}; }
  private getRivalryContext(gameState: GameState): any { return {}; }
  private getUpsetContext(gameState: GameState): any { return {}; }
  
  private isEliminationGame(gameState: GameState, playoffContext: any): boolean { return playoffContext.isEliminationScenario; }
  private isCloseoutGame(gameState: GameState, playoffContext: any): boolean { return playoffContext.isCloseoutScenario; }
  private isGame7(gameState: GameState, playoffContext: any): boolean { return playoffContext.seriesGame === 7; }
  private isConferenceFinals(gameState: GameState, playoffContext: any): boolean { return playoffContext.round === 'CONFERENCE_FINALS'; }
  private isNBAFinals(gameState: GameState, playoffContext: any): boolean { return playoffContext.round === 'NBA_FINALS'; }
  private isChampionshipOnLine(gameState: GameState, playoffContext: any): boolean { return playoffContext.round === 'NBA_FINALS'; }
  private hasDynastyImplications(gameState: GameState, playoffContext: any): boolean { return false; }
  private isFirstChampionship(gameState: GameState, playoffContext: any): boolean { return false; }
  private hasSuperstarLegacy(gameState: GameState, playoffContext: any): boolean { return false; }
  private isHistoricRivalry(gameState: GameState, playoffContext: any): boolean { return false; }
  private hasUpsetPotential(gameState: GameState, playoffContext: any): boolean { return false; }
  
  // Additional analysis method placeholders
  private analyzeHomeCourt(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeSeriesMomentum(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeCoachingBattle(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeInjuryImpact(gameState: GameState, playoffContext: any): any { return {}; }
  private getMediaSpotlight(gameState: GameState, playoffContext: any): string { return 'High'; }
  private getFanExpectations(gameState: GameState, playoffContext: any): any { return {}; }
  private getBettingAction(gameState: GameState, playoffContext: any): any { return {}; }
  private getGlobalViewership(gameState: GameState, playoffContext: any): any { return {}; }
  
  private getLegacyBonus(gameState: GameState, playoffContext: any): number { return 0; }
  private getHistoricalBonus(gameState: GameState, playoffContext: any): number { return 0; }
  private getDynastyBonus(gameState: GameState, playoffContext: any): number { return 0; }
  
  private isChampionshipGame(gameState: GameState, playoffContext: any): boolean { return false; }
  private calculateChampionshipProbability(gameState: GameState, playoffContext: any): number { return 0; }
  private analyzeChampionshipPath(gameState: GameState, playoffContext: any): any { return {}; }
  private checkFirstChampionshipOpportunity(gameState: GameState, playoffContext: any): boolean { return false; }
  private checkDynastyContinuation(gameState: GameState, playoffContext: any): boolean { return false; }
  private analyzeFranchiseHistory(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeMarketImpact(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeGlobalSignificance(gameState: GameState, playoffContext: any): any { return {}; }
  
  private analyzeSuperstarLegacies(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeCoachingLegacies(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeFranchiseLegacies(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeGenerationalShift(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeRetirementImpact(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeBreakoutMoments(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeRedemptionStories(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeHistoricalParallels(gameState: GameState, playoffContext: any): any { return {}; }
  
  private analyzeEliminationPressure(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeExperienceFactor(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeMediaScrutiny(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeFanExpectations(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeInjuryFactors(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeCoachingPressure(gameState: GameState, playoffContext: any): any { return {}; }
  private analyzeMomentumShifts(gameState: GameState, playoffContext: any): any { return {}; }
  
  private getHistoricalContext(gameState: GameState, playoffContext: any): any { return {}; }
}