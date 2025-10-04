import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class WNBAChampionshipImplicationsModule extends BaseAlertModule {
  alertType = 'WNBA_CHAMPIONSHIP_IMPLICATIONS';
  sport = 'WNBA';

  // WNBA season and playoff structure constants
  private readonly WNBA_SEASON_STRUCTURE = {
    REGULAR_SEASON_GAMES: 40, // WNBA regular season length
    PLAYOFF_TEAMS: 8, // Teams that make playoffs
    PLAYOFF_ROUNDS: 4, // First Round, Semifinals, Finals, Championship
    GAMES_REMAINING_THRESHOLD: 10, // When to start tracking implications
    CLOSE_RACE_THRESHOLD: 3, // Games back to be in close race
    MUST_WIN_THRESHOLD: 5 // Games remaining when every game is crucial
  };

  private readonly CHAMPIONSHIP_SCENARIOS = {
    PLAYOFF_RACE: { gamesBack: 3, gamesRemaining: 15, importance: 0.8 },
    SEEDING_BATTLE: { positionRange: 3, gamesRemaining: 10, importance: 0.7 },
    ELIMINATION_GAME: { gamesBack: 0.5, gamesRemaining: 5, importance: 1.0 },
    CHAMPIONSHIP_POSITION: { topPositions: 2, gamesRemaining: 8, importance: 0.9 },
    SEASON_FINALE: { gamesRemaining: 1, importance: 0.95 }
  };

  private readonly WNBA_IMPORTANCE_FACTORS = {
    HOME_COURT_ADVANTAGE: 0.15, // Home court win percentage boost
    HEAD_TO_HEAD_TIEBREAKER: 0.25, // Value of head-to-head record
    CONFERENCE_RECORD_WEIGHT: 0.2, // Conference record importance
    LATE_SEASON_MOMENTUM: 0.3, // Importance of momentum in final games
    STAR_PLAYER_IMPACT: 0.35, // Impact of key players in crucial games
    COACHING_EXPERIENCE: 0.2 // Value of experienced coaching in playoffs
  };

  private readonly GAME_CONTEXT_MULTIPLIERS = {
    DIRECT_RIVAL: 2.0, // Playing direct playoff competitor
    CONFERENCE_OPPONENT: 1.5, // Playing within conference
    BACK_TO_BACK: 0.8, // Back-to-back game fatigue factor
    HOME_GAME: 1.2, // Home court advantage
    AWAY_GAME: 0.9, // Away game difficulty
    SEASON_SERIES_FINALE: 1.8 // Final game of season series
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger during live games when we have actual championship data
    // Without real standings/playoff data, don't generate false alerts
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const seasonContext = this.estimateSeasonContext(gameState);
    const championshipScenario = this.identifyChampionshipScenario(gameState, seasonContext);
    const implicationLevel = this.calculateImplicationLevel(gameState, seasonContext);
    const stakesAnalysis = this.analyzeGameStakes(gameState, seasonContext);
    const contextFactors = this.getContextFactors(gameState, seasonContext);

    const quarter = gameState.quarter || 1;
    const timeRemaining = gameState.timeRemaining || '';
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);

    return {
      alertKey: `${gameState.gameId}_championship_implications_${championshipScenario.type}_${quarter}_${this.parseTimeToSeconds(timeRemaining)}`,
      type: this.alertType,
      message: `🏆 CHAMPIONSHIP IMPLICATIONS: ${championshipScenario.description} - ${gameState.homeTeam} vs ${gameState.awayTeam} (${homeScore}-${awayScore})`,
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
        contextFactors,
        seasonContext,
        alertType: 'PREDICTIVE',
        predictionCategory: 'CHAMPIONSHIP_IMPLICATIONS',
        // WNBA-specific context for AI enhancement
        wnbaContext: {
          hasChampionshipImplications: true,
          seasonPhase: seasonContext.seasonPhase,
          playoffRaceStatus: seasonContext.playoffRaceStatus,
          seedingImplications: this.analyzeSeedingImplications(seasonContext),
          headToHeadImpact: this.analyzeHeadToHeadImpact(gameState, seasonContext),
          momentumFactors: this.analyzeMomentumFactors(gameState, seasonContext),
          pressureLevel: this.calculatePressureLevel(gameState, seasonContext),
          mediaAttention: this.estimateMediaAttention(gameState, seasonContext),
          fanExpectations: this.analyzeFanExpectations(gameState, seasonContext),
          historicalContext: this.getHistoricalContext(gameState),
          championshipFactors: this.WNBA_IMPORTANCE_FACTORS,
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
    
    // Game closeness increases championship implications
    if (scoreDiff <= 3) probability += 25;
    else if (scoreDiff <= 5) probability += 20;
    else if (scoreDiff <= 8) probability += 15;
    else if (scoreDiff <= 12) probability += 10;
    
    // Quarter factor - later quarters more important for championship implications
    if (quarter >= 4) probability += 20;
    else if (quarter === 3) probability += 15;
    else if (quarter === 2) probability += 10;
    
    // Season urgency factor
    if (seasonContext.gamesRemaining <= 5) probability += 30;
    else if (seasonContext.gamesRemaining <= 10) probability += 20;
    else if (seasonContext.gamesRemaining <= 15) probability += 10;
    
    return Math.min(probability, 95);
  }

  private hasChampionshipImplications(gameState: GameState, seasonContext: any): boolean {
    // Playoff race implications
    if (seasonContext.playoffRaceStatus !== 'none') return true;
    
    // Seeding implications
    if (seasonContext.seedingImplications && seasonContext.gamesRemaining <= 15) return true;
    
    // Late season games (final 10 games) 
    if (seasonContext.gamesRemaining <= 10) return true;
    
    // Head-to-head matchups with playoff implications
    if (seasonContext.isDirectRival && seasonContext.gamesRemaining <= 20) return true;
    
    // Close conference race
    if (seasonContext.conferenceRaceStatus === 'tight' && seasonContext.gamesRemaining <= 12) return true;
    
    return false;
  }

  private estimateSeasonContext(gameState: GameState): any {
    // In real implementation, would get from database/API
    // For now, simulate realistic WNBA season context
    
    const mockGamesRemaining = Math.floor(Math.random() * 15) + 1; // 1-15 games remaining
    const mockSeasonPhase = mockGamesRemaining <= 5 ? 'season_finale' : 
                           mockGamesRemaining <= 10 ? 'late_season' : 
                           mockGamesRemaining <= 20 ? 'playoff_push' : 'mid_season';
    
    return {
      gamesRemaining: mockGamesRemaining,
      seasonPhase: mockSeasonPhase,
      playoffRaceStatus: mockGamesRemaining <= 10 ? 'tight' : 'moderate',
      seedingImplications: mockGamesRemaining <= 12,
      conferenceRaceStatus: mockGamesRemaining <= 8 ? 'tight' : 'moderate',
      isDirectRival: Math.random() > 0.7, // 30% chance of direct rival
      baseImportance: this.calculateBaseImportance(mockSeasonPhase, mockGamesRemaining),
      seasonRecord: { homeWins: 18, homeLosses: 2, awayWins: 12, awayLosses: 8 },
      rivalRecord: { wins: 1, losses: 1 } // Season series record
    };
  }

  private calculateBaseImportance(seasonPhase: string, gamesRemaining: number): number {
    switch (seasonPhase) {
      case 'season_finale': return 0.95;
      case 'late_season': return 0.85;
      case 'playoff_push': return 0.75;
      case 'mid_season': return 0.65;
      default: return 0.5;
    }
  }

  private identifyChampionshipScenario(gameState: GameState, seasonContext: any): { type: string; description: string } {
    const gamesRemaining = seasonContext.gamesRemaining;
    
    if (gamesRemaining === 1) {
      return { type: 'SEASON_FINALE', description: 'Season finale with championship implications' };
    }
    
    if (gamesRemaining <= 5 && seasonContext.playoffRaceStatus === 'tight') {
      return { type: 'ELIMINATION_GAME', description: 'Potential elimination game scenario' };
    }
    
    if (gamesRemaining <= 8 && seasonContext.seedingImplications) {
      return { type: 'SEEDING_BATTLE', description: 'Playoff seeding battle' };
    }
    
    if (gamesRemaining <= 10 && seasonContext.isDirectRival) {
      return { type: 'HEAD_TO_HEAD_CRUCIAL', description: 'Head-to-head playoff race game' };
    }
    
    if (gamesRemaining <= 12 && seasonContext.playoffRaceStatus === 'tight') {
      return { type: 'PLAYOFF_RACE', description: 'Playoff race implications' };
    }
    
    if (seasonContext.conferenceRaceStatus === 'tight') {
      return { type: 'CONFERENCE_STANDINGS', description: 'Conference standings battle' };
    }
    
    return { type: 'CHAMPIONSHIP_CONTEXT', description: 'Game with championship context' };
  }

  private calculateImplicationLevel(gameState: GameState, seasonContext: any): number {
    let implicationLevel = seasonContext.baseImportance * 70;
    
    // Games remaining factor
    if (seasonContext.gamesRemaining <= 3) implicationLevel += 25;
    else if (seasonContext.gamesRemaining <= 5) implicationLevel += 20;
    else if (seasonContext.gamesRemaining <= 8) implicationLevel += 15;
    else if (seasonContext.gamesRemaining <= 12) implicationLevel += 10;
    
    // Race tightness factor
    if (seasonContext.playoffRaceStatus === 'tight') implicationLevel += 20;
    else if (seasonContext.playoffRaceStatus === 'moderate') implicationLevel += 10;
    
    // Direct rival factor
    if (seasonContext.isDirectRival) {
      implicationLevel *= this.GAME_CONTEXT_MULTIPLIERS.DIRECT_RIVAL;
    }
    
    // Seeding implications
    if (seasonContext.seedingImplications) implicationLevel += 15;
    
    return Math.min(implicationLevel, 100);
  }

  private analyzeGameStakes(gameState: GameState, seasonContext: any): any {
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    const quarter = gameState.quarter || 1;
    
    return {
      playoffPositioning: seasonContext.playoffRaceStatus !== 'none',
      seedingImplications: seasonContext.seedingImplications,
      headToHeadTiebreaker: seasonContext.isDirectRival,
      momentumForPlayoffs: quarter >= 3,
      seasonSeriesDecider: seasonContext.rivalRecord?.wins === seasonContext.rivalRecord?.losses,
      mustWinSituation: seasonContext.gamesRemaining <= 5 && seasonContext.playoffRaceStatus === 'tight',
      championshipPathway: seasonContext.gamesRemaining <= 8,
      legacyImplications: seasonContext.seasonPhase === 'season_finale'
    };
  }

  private getContextFactors(gameState: GameState, seasonContext: any): any {
    return {
      seasonPhase: seasonContext.seasonPhase,
      gamesRemaining: seasonContext.gamesRemaining,
      playoffRaceStatus: seasonContext.playoffRaceStatus,
      isDirectRival: seasonContext.isDirectRival,
      conferenceGame: true, // Would determine from team data
      homeCourtAdvantage: gameState.homeTeam !== null,
      mediaAttention: this.estimateMediaAttention(gameState, seasonContext),
      fanExpectations: seasonContext.baseImportance > 0.8 ? 'very_high' : seasonContext.baseImportance > 0.6 ? 'high' : 'moderate',
      pressureLevel: this.calculatePressureLevel(gameState, seasonContext)
    };
  }

  private analyzeSeedingImplications(seasonContext: any): any {
    return {
      homeCourt: seasonContext.gamesRemaining <= 10,
      playoffBye: false, // WNBA doesn't have byes
      avoidPlayIn: false, // No play-in tournament in WNBA
      topSeedRace: seasonContext.gamesRemaining <= 8,
      middleSeedBattle: seasonContext.seedingImplications,
      avoidLowerSeed: seasonContext.playoffRaceStatus === 'tight'
    };
  }

  private analyzeHeadToHeadImpact(gameState: GameState, seasonContext: any): any {
    return {
      seasonSeriesRecord: seasonContext.rivalRecord,
      tiebreakerValue: seasonContext.isDirectRival ? this.WNBA_IMPORTANCE_FACTORS.HEAD_TO_HEAD_TIEBREAKER : 0,
      futureMatchups: 0, // Would get from schedule
      historicalRivalry: seasonContext.isDirectRival,
      conferenceTiebreaker: true,
      divisionTiebreaker: false // WNBA doesn't have divisions
    };
  }

  private analyzeMomentumFactors(gameState: GameState, seasonContext: any): any {
    const quarter = gameState.quarter || 1;
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    return {
      lateSeasonMomentum: seasonContext.gamesRemaining <= 10,
      playoffMomentum: quarter >= 3 && scoreDiff <= 8,
      confidenceBuilder: seasonContext.isDirectRival,
      narrativeShift: seasonContext.playoffRaceStatus === 'tight',
      teamChemistry: quarter >= 4,
      coachingAdjustments: quarter >= 3,
      starPlayerPerformance: quarter >= 4 && scoreDiff <= 5
    };
  }

  private calculatePressureLevel(gameState: GameState, seasonContext: any): string {
    const quarter = gameState.quarter || 1;
    let pressure = seasonContext.baseImportance;
    
    if (seasonContext.gamesRemaining <= 3) pressure += 0.3;
    if (seasonContext.isDirectRival) pressure += 0.2;
    if (quarter >= 4) pressure += 0.2;
    if (seasonContext.playoffRaceStatus === 'tight') pressure += 0.2;
    
    if (pressure >= 0.9) return 'maximum';
    if (pressure >= 0.8) return 'very_high';
    if (pressure >= 0.7) return 'high';
    if (pressure >= 0.6) return 'elevated';
    return 'moderate';
  }

  private estimateMediaAttention(gameState: GameState, seasonContext: any): string {
    let attention = seasonContext.baseImportance;
    
    if (seasonContext.gamesRemaining <= 5) attention += 0.3;
    if (seasonContext.isDirectRival) attention += 0.2;
    if (seasonContext.playoffRaceStatus === 'tight') attention += 0.2;
    
    if (attention >= 0.9) return 'national';
    if (attention >= 0.8) return 'regional';
    if (attention >= 0.7) return 'local_heavy';
    if (attention >= 0.6) return 'local_moderate';
    return 'standard';
  }

  private analyzeFanExpectations(gameState: GameState, seasonContext: any): any {
    return {
      expectationLevel: seasonContext.baseImportance > 0.8 ? 'championship' : 
                       seasonContext.baseImportance > 0.6 ? 'playoff' : 'competitive',
      pressureFromFans: seasonContext.isDirectRival || seasonContext.gamesRemaining <= 5,
      homeCourtAdvantage: gameState.homeTeam !== null ? 1.2 : 1.0,
      loyaltyTest: seasonContext.gamesRemaining <= 8,
      legacyExpectations: seasonContext.seasonPhase === 'season_finale'
    };
  }

  private getHistoricalContext(gameState: GameState): any {
    // In real implementation, would get historical matchup data
    return {
      franchiseHistory: 'competitive',
      recentMeetings: { homeWins: 2, awayWins: 1 },
      playoffHistory: 'limited',
      starPlayerLegacy: 'building',
      coachingHistory: 'experienced',
      arenaSignificance: 'moderate'
    };
  }

  private calculateAlertPriority(implicationLevel: number, scenarioType: string, quarter: number, scoreDiff: number): number {
    let priority = 82; // Base priority for championship implications
    
    // Implication level factor
    priority += Math.round(implicationLevel * 0.1);
    
    // Scenario type factor
    const scenarioBonus = {
      'SEASON_FINALE': 12,
      'ELIMINATION_GAME': 10,
      'SEEDING_BATTLE': 8,
      'HEAD_TO_HEAD_CRUCIAL': 8,
      'PLAYOFF_RACE': 6,
      'CONFERENCE_STANDINGS': 4,
      'CHAMPIONSHIP_CONTEXT': 2
    };
    priority += scenarioBonus[scenarioType as keyof typeof scenarioBonus] || 0;
    
    // Quarter factor
    if (quarter >= 4) priority += 6;
    else if (quarter === 3) priority += 4;
    else if (quarter === 2) priority += 2;
    
    // Score closeness factor
    if (scoreDiff <= 3) priority += 6;
    else if (scoreDiff <= 5) priority += 4;
    else if (scoreDiff <= 8) priority += 2;
    
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