import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ChampionshipImplicationsModule extends BaseAlertModule {
  alertType = 'NBA_CHAMPIONSHIP_IMPLICATIONS';
  sport = 'NBA';

  // NBA season and championship structure constants
  private readonly NBA_SEASON_STRUCTURE = {
    REGULAR_SEASON_GAMES: 82, // NBA regular season length
    PLAYOFF_TEAMS: 16, // 8 teams per conference
    CONFERENCE_TEAMS: 15, // Teams per conference
    PLAYOFF_ROUNDS: 4, // First Round, Semifinals, Conference Finals, Finals
    GAMES_REMAINING_THRESHOLD: 15, // When to start tracking implications
    CLOSE_RACE_THRESHOLD: 2, // Games back to be in close race
    MUST_WIN_THRESHOLD: 8 // Games remaining when every game is crucial
  };

  private readonly CHAMPIONSHIP_SCENARIOS = {
    PLAYOFF_RACE: { gamesBack: 2, gamesRemaining: 20, importance: 0.9 },
    SEEDING_BATTLE: { positionRange: 4, gamesRemaining: 15, importance: 0.8 },
    DIVISION_TITLE: { gamesBack: 1, gamesRemaining: 12, importance: 0.85 },
    HOME_COURT_ADVANTAGE: { topSeeds: 4, gamesRemaining: 10, importance: 0.8 },
    FINALS_CONTENTION: { topPositions: 6, gamesRemaining: 20, importance: 0.95 },
    SEASON_FINALE: { gamesRemaining: 1, importance: 1.0 }
  };

  private readonly NBA_CHAMPIONSHIP_FACTORS = {
    HOME_COURT_ADVANTAGE: 0.20, // Significant in NBA playoffs
    HEAD_TO_HEAD_TIEBREAKER: 0.30, // Critical for seeding
    CONFERENCE_RECORD_WEIGHT: 0.25, // Conference record importance
    DIVISION_TITLE_WEIGHT: 0.15, // Division championship value
    STAR_PLAYER_HEALTH: 0.35, // Superstar availability impact
    CHAMPIONSHIP_EXPERIENCE: 0.25, // Playoff and Finals experience
    COACHING_PLAYOFF_SUCCESS: 0.20 // Championship coaching experience
  };

  private readonly GAME_CONTEXT_MULTIPLIERS = {
    DIRECT_PLAYOFF_RIVAL: 2.5, // Playing direct playoff competitor
    CONFERENCE_OPPONENT: 1.8, // Playing within conference
    DIVISION_RIVAL: 2.0, // Division opponent
    TOP_SEED_MATCHUP: 2.2, // Playing against top seed
    BACK_TO_BACK: 0.85, // Back-to-back game difficulty
    HOME_GAME: 1.3, // Home court advantage
    NATIONAL_TV_GAME: 1.4, // Prime time exposure
    SEASON_SERIES_FINALE: 2.0 // Final game of season series
  };

  private readonly NBA_LEGACY_FACTORS = {
    CHAMPIONSHIP_DROUGHT: 1.3, // Teams without recent championships
    SUPERSTAR_LEGACY: 1.4, // Elite players seeking first championship
    DYNASTY_POTENTIAL: 1.2, // Teams building championship dynasties
    HISTORIC_RIVALRY: 1.25, // Historic franchise rivalries
    MARKET_SIZE_PRESSURE: 1.15, // Large market championship expectations
    COACHING_LEGACY: 1.1 // Legendary coaches seeking championships
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger during live games in meaningful part of season
    if (gameState.status !== 'live') return false;
    
    // Simulate season context (in real implementation, would get from database)
    const seasonContext = this.estimateSeasonContext(gameState);
    
    // Check if game has championship implications
    return this.hasChampionshipImplications(gameState, seasonContext);
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const seasonContext = this.estimateSeasonContext(gameState);
    const championshipScenario = this.identifyChampionshipScenario(gameState, seasonContext);
    const implicationLevel = this.calculateImplicationLevel(gameState, seasonContext);
    const stakesAnalysis = this.analyzeGameStakes(gameState, seasonContext);
    const legacyContext = this.analyzeLegacyContext(gameState, seasonContext);
    const playoffImplications = this.analyzePlayoffImplications(gameState, seasonContext);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    return {
      alertKey: `${gameState.gameId}_championship_implications_${championshipScenario.type}_${quarter}_${this.parseTimeToSeconds(timeRemaining)}`,
      type: this.alertType,
      message: `🏆 NBA CHAMPIONSHIP IMPLICATIONS: ${championshipScenario.description} - ${gameState.homeTeam} vs ${gameState.awayTeam} (${homeScore}-${awayScore})`,
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
        championshipScenario: championshipScenario.type,
        implicationLevel: Math.round(implicationLevel),
        stakesAnalysis,
        legacyContext,
        playoffImplications,
        seasonContext,
        alertType: 'PREDICTIVE',
        predictionCategory: 'CHAMPIONSHIP_IMPLICATIONS',
        // NBA-specific context for AI enhancement
        nbaContext: {
          hasChampionshipImplications: true,
          seasonPhase: seasonContext.seasonPhase,
          playoffRaceStatus: seasonContext.playoffRaceStatus,
          seedingImplications: this.analyzeSeedingImplications(seasonContext),
          divisionRaceStatus: this.analyzeDivisionRace(seasonContext),
          conferenceBattles: this.analyzeConferenceBattles(seasonContext),
          homeCourAdvantage: this.analyzeHomeCourt(seasonContext),
          headToHeadImpact: this.analyzeHeadToHeadImpact(gameState, seasonContext),
          starPlayerImpact: this.analyzeStarPlayerImpact(gameState, seasonContext),
          coachingExperience: this.analyzeCoachingExperience(gameState, seasonContext),
          historicalContext: this.getHistoricalContext(gameState),
          mediaAttention: this.estimateMediaAttention(gameState, seasonContext),
          fanExpectations: this.analyzeFanExpectations(gameState, seasonContext),
          bettingImplications: this.analyzeBettingImplications(gameState, seasonContext),
          legacyFactors: this.NBA_LEGACY_FACTORS,
          championshipFactors: this.NBA_CHAMPIONSHIP_FACTORS,
          gameContextMultipliers: this.GAME_CONTEXT_MULTIPLIERS
        }
      },
      priority: this.calculateAlertPriority(implicationLevel, championshipScenario.type, quarter, scoreDiff)
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const seasonContext = this.estimateSeasonContext(gameState);
    const quarter = gameState.quarter || 1;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Base probability from season context
    let probability = seasonContext.baseImportance * 100;
    
    // Quarter progression (championship implications grow)
    if (quarter >= 4) probability += 25; // Fourth quarter pressure
    else if (quarter >= 3) probability += 15; // Third quarter build-up
    else if (quarter >= 2) probability += 10; // Second quarter development
    
    // Score differential impact
    if (scoreDiff <= 5) probability += 20; // Close championship-implication games
    else if (scoreDiff <= 10) probability += 15;
    else if (scoreDiff <= 15) probability += 10;
    
    // Season phase adjustments
    if (seasonContext.seasonPhase === 'LATE_SEASON') probability += 20;
    else if (seasonContext.seasonPhase === 'PLAYOFF_PUSH') probability += 30;
    else if (seasonContext.seasonPhase === 'FINAL_GAMES') probability += 40;
    
    // Legacy and market factors
    probability += this.getLegacyBonus(gameState, seasonContext);
    probability += this.getMarketPressureBonus(gameState);
    probability += this.getRivalryBonus(gameState);
    
    return Math.min(probability, 95);
  }

  private hasChampionshipImplications(gameState: GameState, seasonContext: any): boolean {
    // Check multiple championship implication factors
    
    // Late season games with playoff implications
    if (seasonContext.gamesRemaining <= 20 && seasonContext.playoffRace) {
      return true;
    }
    
    // Division race implications
    if (seasonContext.divisionRace && seasonContext.gamesRemaining <= 15) {
      return true;
    }
    
    // Conference seeding battles
    if (seasonContext.seedingBattle && seasonContext.gamesRemaining <= 25) {
      return true;
    }
    
    // Head-to-head matchups with playoff implications
    if (this.isHeadToHeadSignificant(gameState, seasonContext)) {
      return true;
    }
    
    // Championship legacy games
    if (this.hasLegacyImplications(gameState, seasonContext)) {
      return true;
    }
    
    return false;
  }

  private estimateSeasonContext(gameState: GameState): any {
    // In real implementation, would get from database/API
    // This simulates season context based on game data
    
    const currentDate = new Date();
    const month = currentDate.getMonth(); // 0-11
    
    // Estimate season phase based on month
    let seasonPhase = 'EARLY_SEASON';
    let gamesRemaining = 40;
    
    if (month >= 2 && month <= 3) { // March-April
      seasonPhase = 'LATE_SEASON';
      gamesRemaining = 15;
    } else if (month >= 1 && month <= 2) { // February-March
      seasonPhase = 'PLAYOFF_PUSH';
      gamesRemaining = 25;
    } else if (month >= 3) { // April
      seasonPhase = 'FINAL_GAMES';
      gamesRemaining = 5;
    }
    
    return {
      seasonPhase,
      gamesRemaining,
      playoffRace: gamesRemaining <= 20,
      divisionRace: gamesRemaining <= 15,
      seedingBattle: gamesRemaining <= 25,
      baseImportance: this.calculateBaseImportance(seasonPhase, gamesRemaining),
      conferenceStandings: this.simulateConferenceStandings(gameState),
      playoffContenders: this.identifyPlayoffContenders(gameState),
      championshipContenders: this.identifyChampionshipContenders(gameState)
    };
  }

  private identifyChampionshipScenario(gameState: GameState, seasonContext: any): { type: string; description: string } {
    if (seasonContext.gamesRemaining <= 5) {
      return { type: 'SEASON_FINALE', description: 'Season finale with championship implications' };
    }
    
    if (seasonContext.seedingBattle && seasonContext.gamesRemaining <= 10) {
      return { type: 'SEEDING_BATTLE', description: 'Critical playoff seeding battle' };
    }
    
    if (seasonContext.divisionRace) {
      return { type: 'DIVISION_TITLE', description: 'Division championship implications' };
    }
    
    if (seasonContext.playoffRace) {
      return { type: 'PLAYOFF_RACE', description: 'Playoff qualification race' };
    }
    
    if (this.isTopSeedBattle(gameState, seasonContext)) {
      return { type: 'HOME_COURT_BATTLE', description: 'Home court advantage battle' };
    }
    
    return { type: 'CHAMPIONSHIP_POSITIONING', description: 'Championship positioning battle' };
  }

  private calculateImplicationLevel(gameState: GameState, seasonContext: any): number {
    let implicationLevel = seasonContext.baseImportance * 100;
    
    // Season phase multiplier
    const phaseMultipliers = {
      'EARLY_SEASON': 0.6,
      'MID_SEASON': 0.8,
      'LATE_SEASON': 1.0,
      'PLAYOFF_PUSH': 1.3,
      'FINAL_GAMES': 1.5
    };
    
    implicationLevel *= phaseMultipliers[seasonContext.seasonPhase as keyof typeof phaseMultipliers] || 1.0;
    
    // Add specific scenario bonuses
    if (seasonContext.playoffRace) implicationLevel += 20;
    if (seasonContext.divisionRace) implicationLevel += 15;
    if (seasonContext.seedingBattle) implicationLevel += 10;
    
    // Head-to-head importance
    if (this.isHeadToHeadSignificant(gameState, seasonContext)) {
      implicationLevel += 25;
    }
    
    // Legacy and market pressure
    implicationLevel += this.getLegacyBonus(gameState, seasonContext);
    
    return Math.min(implicationLevel, 100);
  }

  private analyzeGameStakes(gameState: GameState, seasonContext: any): any {
    return {
      playoffImplications: this.getPlayoffImplications(gameState, seasonContext),
      seedingImplications: this.getSeedingImplications(gameState, seasonContext),
      divisionImplications: this.getDivisionImplications(gameState, seasonContext),
      homeCourImplications: this.getHomeCourtImplications(gameState, seasonContext),
      tiebreakingImplications: this.getTiebreakingImplications(gameState, seasonContext),
      legacyImplications: this.getLegacyImplications(gameState, seasonContext),
      financialImplications: this.getFinancialImplications(gameState, seasonContext),
      historicalSignificance: this.getHistoricalSignificance(gameState, seasonContext)
    };
  }

  private analyzeLegacyContext(gameState: GameState, seasonContext: any): any {
    return {
      superstarLegacies: this.analyzeSuperstarLegacies(gameState),
      franchiseHistory: this.analyzeFranchiseHistory(gameState),
      coachingLegacies: this.analyzeCoachingLegacies(gameState),
      rivalryContext: this.analyzeRivalryContext(gameState),
      championshipDroughts: this.analyzeChampionshipDroughts(gameState),
      dynastyBuilding: this.analyzeDynastyBuilding(gameState),
      historicMoments: this.analyzeHistoricMoments(gameState),
      mediaLegacy: this.analyzeMediaLegacy(gameState)
    };
  }

  private analyzePlayoffImplications(gameState: GameState, seasonContext: any): any {
    return {
      playoffProbability: this.calculatePlayoffProbability(gameState, seasonContext),
      seedingScenarios: this.analyzeSeedingScenarios(gameState, seasonContext),
      matchupImplications: this.analyzeMatchupImplications(gameState, seasonContext),
      homeCourScenarios: this.analyzeHomeCourtScenarios(gameState, seasonContext),
      pathToChampionship: this.analyzeChampionshipPath(gameState, seasonContext),
      eliminationScenarios: this.analyzeEliminationScenarios(gameState, seasonContext)
    };
  }

  private calculateAlertPriority(implicationLevel: number, scenarioType: string, quarter: number, scoreDiff: number): number {
    let priority = 85; // Base priority for championship implications
    
    // Implication level adjustments
    if (implicationLevel > 90) priority = 95;
    else if (implicationLevel > 80) priority = 92;
    else if (implicationLevel > 70) priority = 89;
    else if (implicationLevel > 60) priority = 87;
    
    // Scenario type bonuses
    const scenarioPriorities = {
      'SEASON_FINALE': 95,
      'PLAYOFF_RACE': 93,
      'SEEDING_BATTLE': 90,
      'DIVISION_TITLE': 91,
      'HOME_COURT_BATTLE': 88,
      'CHAMPIONSHIP_POSITIONING': 86
    };
    
    const scenarioPriority = scenarioPriorities[scenarioType as keyof typeof scenarioPriorities];
    if (scenarioPriority) {
      priority = Math.max(priority, scenarioPriority);
    }
    
    // Quarter and score adjustments
    if (quarter >= 4 && scoreDiff <= 5) priority += 2;
    if (quarter >= 3 && scoreDiff <= 3) priority += 1;
    
    return Math.min(priority, 95);
  }

  // Helper methods for detailed analysis (placeholders for full implementation)
  private calculateBaseImportance(seasonPhase: string, gamesRemaining: number): number {
    const phaseImportance = {
      'EARLY_SEASON': 0.3,
      'MID_SEASON': 0.5,
      'LATE_SEASON': 0.7,
      'PLAYOFF_PUSH': 0.9,
      'FINAL_GAMES': 1.0
    };
    
    const remainingImportance = Math.max(0, 1 - (gamesRemaining / 82));
    return (phaseImportance[seasonPhase as keyof typeof phaseImportance] || 0.5) * 0.7 + remainingImportance * 0.3;
  }

  private simulateConferenceStandings(gameState: GameState): any {
    // Placeholder for conference standings simulation
    return {};
  }

  private identifyPlayoffContenders(gameState: GameState): string[] {
    // Placeholder for playoff contender identification
    return [];
  }

  private identifyChampionshipContenders(gameState: GameState): string[] {
    // Placeholder for championship contender identification
    return [];
  }

  private isTopSeedBattle(gameState: GameState, seasonContext: any): boolean {
    // Placeholder for top seed battle detection
    return false;
  }

  private isHeadToHeadSignificant(gameState: GameState, seasonContext: any): boolean {
    // Placeholder for head-to-head significance analysis
    return false;
  }

  private hasLegacyImplications(gameState: GameState, seasonContext: any): boolean {
    // Placeholder for legacy implications detection
    return false;
  }

  // Additional analysis method placeholders
  private analyzeSeedingImplications(seasonContext: any): any { return {}; }
  private analyzeDivisionRace(seasonContext: any): any { return {}; }
  private analyzeConferenceBattles(seasonContext: any): any { return {}; }
  private analyzeHomeCourt(seasonContext: any): any { return {}; }
  private analyzeHeadToHeadImpact(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeStarPlayerImpact(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeCoachingExperience(gameState: GameState, seasonContext: any): any { return {}; }
  private getHistoricalContext(gameState: GameState): any { return {}; }
  private estimateMediaAttention(gameState: GameState, seasonContext: any): string { return 'High coverage'; }
  private analyzeFanExpectations(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeBettingImplications(gameState: GameState, seasonContext: any): any { return {}; }
  
  private getPlayoffImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getSeedingImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getDivisionImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getHomeCourtImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getTiebreakingImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getLegacyImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getFinancialImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private getHistoricalSignificance(gameState: GameState, seasonContext: any): any { return {}; }
  
  private analyzeSuperstarLegacies(gameState: GameState): any { return {}; }
  private analyzeFranchiseHistory(gameState: GameState): any { return {}; }
  private analyzeCoachingLegacies(gameState: GameState): any { return {}; }
  private analyzeRivalryContext(gameState: GameState): any { return {}; }
  private analyzeChampionshipDroughts(gameState: GameState): any { return {}; }
  private analyzeDynastyBuilding(gameState: GameState): any { return {}; }
  private analyzeHistoricMoments(gameState: GameState): any { return {}; }
  private analyzeMediaLegacy(gameState: GameState): any { return {}; }
  
  private calculatePlayoffProbability(gameState: GameState, seasonContext: any): number { return 0; }
  private analyzeSeedingScenarios(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeMatchupImplications(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeHomeCourtScenarios(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeChampionshipPath(gameState: GameState, seasonContext: any): any { return {}; }
  private analyzeEliminationScenarios(gameState: GameState, seasonContext: any): any { return {}; }
  
  private getLegacyBonus(gameState: GameState, seasonContext: any): number { return 0; }
  private getMarketPressureBonus(gameState: GameState): number { return 0; }
  private getRivalryBonus(gameState: GameState): number { return 0; }

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