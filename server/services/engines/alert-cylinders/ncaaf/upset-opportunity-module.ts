import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class UpsetOpportunityModule extends BaseAlertModule {
  alertType = 'NCAAF_UPSET_OPPORTUNITY';
  sport = 'NCAAF';

  // College football upset probability factors
  private readonly UPSET_THRESHOLD_SCORES = {
    MINOR_UPSET: 3,      // 3+ point underdog
    MODERATE_UPSET: 7,   // 7+ point underdog  
    MAJOR_UPSET: 14,     // 14+ point underdog
    MASSIVE_UPSET: 21    // 21+ point underdog
  };

  private readonly MOMENTUM_INDICATORS = {
    SCORING_RUN: 14,       // Team has scored 14+ unanswered points
    TURNOVER_ADVANTAGE: 2, // +2 or better turnover differential
    FIELD_POSITION: 30,    // Consistently better field position
    TIME_OF_POSSESSION: 0.6 // 60%+ time of possession advantage
  };

  private readonly CONFERENCE_UPSET_MULTIPLIERS = {
    'SEC': 1.3,          // SEC upsets are huge stories
    'Big Ten': 1.25,     // Traditional power conference
    'Big 12': 1.2,       // High-scoring conference upsets
    'ACC': 1.15,         // ACC coastal chaos
    'Pac-12': 1.15,      // After dark magic
    'AAC': 1.1,          // Group of 5 upsets
    'Mountain West': 1.1,
    'Conference USA': 1.05,
    'MAC': 1.05,
    'Sun Belt': 1.05,
    'Independent': 1.0
  };

  private readonly RIVALRY_UPSET_MULTIPLIER = 1.4; // Rivalries create chaos

  isTriggered(gameState: GameState): boolean {
    // Only trigger for live games with score data
    if (gameState.status !== 'live' || !this.hasValidScoreData(gameState)) return false;

    // Calculate upset probability and trigger if >= 65%
    const upsetProbability = this.calculateUpsetProbability(gameState);
    return upsetProbability >= 65;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const upsetProbability = this.calculateUpsetProbability(gameState);
    const upsetMagnitude = this.getUpsetMagnitude(gameState);
    const momentumFactors = this.getMomentumFactors(gameState);
    const situationDescription = this.getSituationDescription(gameState);
    const underdog = this.getUnderdogTeam(gameState);
    const favorite = this.getFavoriteTeam(gameState);

    return {
      alertKey: `${gameState.gameId}_upset_opportunity_${gameState.quarter}_${this.getTimeKey(gameState.timeRemaining)}`,
      type: this.alertType,
      message: `🚨 UPSET ALERT: ${underdog} ${situationDescription} vs ${favorite} - Upset probability: ${Math.round(upsetProbability)}%`,
      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        underdog,
        favorite,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        upsetProbability: Math.round(upsetProbability),
        upsetMagnitude,
        momentumFactors,
        situationDescription,
        alertType: 'PREDICTIVE',
        predictionCategory: 'UPSET_OPPORTUNITY',
        // NCAAF-specific context for AI enhancement
        ncaafContext: {
          isUpsetInProgress: true,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          timePressure: this.getTimePressureLevel(gameState),
          isRivalryGame: this.isRivalryGame(gameState),
          conferenceImplications: this.getConferenceImplications(gameState),
          playoffImplications: this.getPlayoffImplications(gameState),
          momentumShift: this.getMomentumShiftLevel(gameState),
          underdogPerformance: this.getUnderdogPerformanceLevel(gameState)
        }
      },
      priority: this.calculateAlertPriority(upsetProbability, upsetMagnitude, gameState)
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateUpsetProbability(gameState);
  }

  private calculateUpsetProbability(gameState: GameState): number {
    if (!this.hasValidScoreData(gameState)) return 0;

    let probability = this.getBaseProbabilityFromScore(gameState);

    // Momentum adjustments
    const momentumBonus = this.calculateMomentumBonus(gameState);
    probability += momentumBonus;

    // Time-based adjustments
    const timeAdjustment = this.getTimeBasedAdjustment(gameState);
    probability *= timeAdjustment;

    // Conference and rivalry multipliers
    const conferenceMultiplier = this.getConferenceMultiplier(gameState);
    probability *= conferenceMultiplier;

    if (this.isRivalryGame(gameState)) {
      probability *= this.RIVALRY_UPSET_MULTIPLIER;
    }

    // Special situation bonuses
    const specialBonus = this.getSpecialSituationBonus(gameState);
    probability += specialBonus;

    return Math.min(Math.max(probability, 5), 98);
  }

  private getBaseProbabilityFromScore(gameState: GameState): number {
    const homeScore = gameState.homeScore;
    const awayScore = gameState.awayScore;
    
    // Determine which team is likely the underdog based on current performance
    // In college football, home teams are often favored
    let probability = 30; // Base probability

    // If away team is leading or competitive, increase upset probability
    if (awayScore > homeScore) {
      const leadSize = awayScore - homeScore;
      if (leadSize >= 21) probability = 85; // Away team dominating
      else if (leadSize >= 14) probability = 75; // Strong away lead
      else if (leadSize >= 7) probability = 65; // Moderate away lead
      else if (leadSize >= 3) probability = 55; // Small away lead
      else probability = 50; // Tied or very close
    } else if (homeScore > awayScore) {
      const leadSize = homeScore - awayScore;
      // Home team leading reduces upset probability unless it's a massive comeback
      if (leadSize <= 3) probability = 45; // Close home lead
      else if (leadSize <= 7) probability = 35; // Moderate home lead
      else probability = 25; // Large home lead
    } else {
      probability = 50; // Tied game
    }

    return probability;
  }

  private calculateMomentumBonus(gameState: GameState): number {
    let bonus = 0;

    // Look for momentum indicators in game context
    if (gameState.momentumShift) {
      if (gameState.momentumShift === 'STRONG') bonus += 15;
      else if (gameState.momentumShift === 'MODERATE') bonus += 10;
      else if (gameState.momentumShift === 'SLIGHT') bonus += 5;
    }

    // Turnover differential (if available)
    if (gameState.turnovers && gameState.turnovers.differential >= 2) {
      bonus += 10;
    }

    // Recent scoring analysis (if recent scores available)
    if (gameState.recentScoring) {
      const underdogRecentPoints = this.getUnderdogRecentScoring(gameState);
      if (underdogRecentPoints >= 14) bonus += 12; // Scoring run
      else if (underdogRecentPoints >= 7) bonus += 8;
    }

    return bonus;
  }

  private getTimeBasedAdjustment(gameState: GameState): number {
    if (!gameState.quarter || !gameState.timeRemaining) return 1.0;

    let adjustment = 1.0;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    // Third quarter - momentum building time
    if (gameState.quarter === 3) {
      adjustment += 0.1; // Slight boost in third quarter
    }
    
    // Fourth quarter urgency
    else if (gameState.quarter === 4) {
      if (timeSeconds <= 300) { // Final 5 minutes
        adjustment += 0.2; // Upset opportunities crystallize late
      }
      if (timeSeconds <= 120) { // Final 2 minutes
        adjustment += 0.15; // Critical time for upsets
      }
    }
    
    // Overtime situations
    else if (gameState.quarter >= 5) {
      adjustment += 0.3; // Upsets very likely in overtime
    }

    return adjustment;
  }

  private getConferenceMultiplier(gameState: GameState): number {
    const homeConference = this.determineConference(gameState.homeTeam);
    const awayConference = this.determineConference(gameState.awayTeam);
    
    // Use the higher conference multiplier (upsets in major conferences are bigger stories)
    const homeMultiplier = this.CONFERENCE_UPSET_MULTIPLIERS[homeConference as keyof typeof this.CONFERENCE_UPSET_MULTIPLIERS] || 1.0;
    const awayMultiplier = this.CONFERENCE_UPSET_MULTIPLIERS[awayConference as keyof typeof this.CONFERENCE_UPSET_MULTIPLIERS] || 1.0;
    
    return Math.max(homeMultiplier, awayMultiplier);
  }

  private getSpecialSituationBonus(gameState: GameState): number {
    let bonus = 0;

    // Unranked vs ranked scenarios (if ranking data available)
    if (gameState.homeRank && !gameState.awayRank && gameState.awayScore >= gameState.homeScore) {
      bonus += 15; // Unranked beating ranked
    }
    if (gameState.awayRank && !gameState.homeRank && gameState.homeScore >= gameState.awayScore) {
      bonus += 15; // Unranked beating ranked
    }

    // Ranked matchup upsets
    if (gameState.homeRank && gameState.awayRank) {
      const rankDiff = Math.abs(gameState.homeRank - gameState.awayRank);
      if (rankDiff >= 15) bonus += 12; // Major ranking difference
      else if (rankDiff >= 10) bonus += 8; // Moderate ranking difference
    }

    // Bowl game or playoff context
    if (this.isBowlGame(gameState) || this.isPlayoffGame(gameState)) {
      bonus += 10; // Bowl/playoff upsets are huge
    }

    // Conference championship implications
    if (this.hasConferenceChampionshipImplications(gameState)) {
      bonus += 8;
    }

    return bonus;
  }

  private getUpsetMagnitude(gameState: GameState): string {
    const probability = this.calculateUpsetProbability(gameState);
    
    if (probability >= 90) return 'MASSIVE';
    if (probability >= 80) return 'MAJOR';
    if (probability >= 70) return 'MODERATE';
    return 'MINOR';
  }

  private getMomentumFactors(gameState: GameState): string[] {
    const factors: string[] = [];
    
    if (gameState.momentumShift) factors.push(`${gameState.momentumShift} momentum shift`);
    if (gameState.turnovers && gameState.turnovers.differential >= 2) factors.push('Turnover advantage');
    if (this.isRivalryGame(gameState)) factors.push('Rivalry game');
    if (gameState.quarter === 4) factors.push('Fourth quarter');
    if (gameState.quarter >= 5) factors.push('Overtime');
    if (this.isBowlGame(gameState)) factors.push('Bowl game');
    if (this.hasConferenceChampionshipImplications(gameState)) factors.push('Conference championship implications');
    
    return factors;
  }

  private getSituationDescription(gameState: GameState): string {
    const homeScore = gameState.homeScore;
    const awayScore = gameState.awayScore;
    const quarter = gameState.quarter;
    const time = gameState.timeRemaining;
    
    let description = '';
    
    if (awayScore > homeScore) {
      description = `leads ${awayScore}-${homeScore}`;
    } else if (homeScore > awayScore) {
      description = `trails ${homeScore}-${awayScore}`;
    } else {
      description = `tied ${homeScore}-${awayScore}`;
    }
    
    if (quarter && time) {
      description += ` in Q${quarter} (${time})`;
    }
    
    return description;
  }

  private getUnderdogTeam(gameState: GameState): string {
    // In college football, home teams are typically favored
    // So if away team is competitive, they're likely the underdog
    if (gameState.awayScore >= gameState.homeScore - 3) {
      return gameState.awayTeam;
    }
    return gameState.homeTeam;
  }

  private getFavoriteTeam(gameState: GameState): string {
    return this.getUnderdogTeam(gameState) === gameState.homeTeam ? gameState.awayTeam : gameState.homeTeam;
  }

  private calculateAlertPriority(probability: number, magnitude: string, gameState: GameState): number {
    let priority = 75; // Base priority
    
    // Probability-based priority
    if (probability >= 90) priority = 98;
    else if (probability >= 85) priority = 95;
    else if (probability >= 80) priority = 92;
    else if (probability >= 75) priority = 90;
    else if (probability >= 70) priority = 87;
    else priority = 85;
    
    // Magnitude bonuses
    if (magnitude === 'MASSIVE') priority = Math.min(priority + 3, 98);
    else if (magnitude === 'MAJOR') priority = Math.min(priority + 2, 98);
    
    // Special situation bonuses
    if (this.isRivalryGame(gameState)) priority = Math.min(priority + 2, 98);
    if (this.isBowlGame(gameState) || this.isPlayoffGame(gameState)) priority = Math.min(priority + 3, 98);
    if (gameState.quarter >= 5) priority = Math.min(priority + 2, 98); // Overtime
    
    return priority;
  }

  private hasValidScoreData(gameState: GameState): boolean {
    return gameState.homeScore !== undefined && 
           gameState.awayScore !== undefined &&
           (gameState.homeScore > 0 || gameState.awayScore > 0);
  }

  private isRivalryGame(gameState: GameState): boolean {
    // Common college football rivalries (simplified detection)
    const rivalries = [
      ['Alabama', 'Auburn'], ['Ohio State', 'Michigan'], ['Duke', 'North Carolina'],
      ['Georgia', 'Florida'], ['Army', 'Navy'], ['USC', 'UCLA'], ['Texas', 'Oklahoma'],
      ['Harvard', 'Yale'], ['Cal', 'Stanford'], ['Virginia', 'Virginia Tech'],
      ['Clemson', 'South Carolina'], ['Louisville', 'Kentucky'], ['Iowa', 'Iowa State'],
      ['Florida', 'Florida State'], ['Miami', 'Florida State'], ['BYU', 'Utah']
    ];

    const homeTeam = gameState.homeTeam.toLowerCase();
    const awayTeam = gameState.awayTeam.toLowerCase();

    return rivalries.some(([team1, team2]) =>
      (homeTeam.includes(team1.toLowerCase()) && awayTeam.includes(team2.toLowerCase())) ||
      (homeTeam.includes(team2.toLowerCase()) && awayTeam.includes(team1.toLowerCase()))
    );
  }

  private determineConference(teamName: string): string {
    const team = teamName.toLowerCase();
    
    // SEC teams
    if (['alabama', 'auburn', 'florida', 'georgia', 'kentucky', 'lsu', 'mississippi', 'ole miss', 'missouri', 'south carolina', 'tennessee', 'vanderbilt', 'arkansas', 'mississippi state', 'texas a&m'].some(t => team.includes(t))) {
      return 'SEC';
    }
    
    // Big Ten teams  
    if (['ohio state', 'michigan', 'penn state', 'wisconsin', 'iowa', 'minnesota', 'illinois', 'indiana', 'maryland', 'michigan state', 'nebraska', 'northwestern', 'purdue', 'rutgers'].some(t => team.includes(t))) {
      return 'Big Ten';
    }
    
    // Big 12 teams
    if (['texas', 'oklahoma', 'oklahoma state', 'kansas', 'kansas state', 'iowa state', 'baylor', 'tcu', 'texas tech', 'west virginia'].some(t => team.includes(t))) {
      return 'Big 12';
    }
    
    // ACC teams
    if (['clemson', 'florida state', 'miami', 'virginia tech', 'virginia', 'north carolina', 'nc state', 'duke', 'wake forest', 'georgia tech', 'louisville', 'pittsburgh', 'syracuse', 'boston college'].some(t => team.includes(t))) {
      return 'ACC';
    }
    
    // Pac-12 teams
    if (['usc', 'ucla', 'stanford', 'cal', 'oregon', 'oregon state', 'washington', 'washington state', 'arizona', 'arizona state', 'colorado', 'utah'].some(t => team.includes(t))) {
      return 'Pac-12';
    }
    
    return 'Independent';
  }

  private isBowlGame(gameState: GameState): boolean {
    // Simplified bowl game detection - would need more sophisticated logic in production
    const gameId = gameState.gameId?.toString() || '';
    return gameId.includes('bowl') || (gameState.quarter && gameState.quarter >= 1 && this.isDecemberOrJanuary());
  }

  private isPlayoffGame(gameState: GameState): boolean {
    // Simplified playoff detection
    const gameId = gameState.gameId?.toString() || '';
    return gameId.includes('playoff') || gameId.includes('championship');
  }

  private hasConferenceChampionshipImplications(gameState: GameState): boolean {
    // Would need more sophisticated conference standings analysis
    return this.isLateSeasonGame() && this.determineConference(gameState.homeTeam) === this.determineConference(gameState.awayTeam);
  }

  private getUnderdogRecentScoring(gameState: GameState): number {
    // Placeholder - would analyze recent scoring from game data
    return gameState.recentScoring?.underdog || 0;
  }

  private getTimePressureLevel(gameState: GameState): string {
    if (!gameState.quarter || !gameState.timeRemaining) return 'Normal';
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    if (gameState.quarter === 4) {
      if (timeSeconds <= 60) return 'Critical';
      if (timeSeconds <= 120) return 'High';  
      if (timeSeconds <= 300) return 'Elevated';
    }
    
    if (gameState.quarter >= 5) return 'Overtime';
    
    return 'Normal';
  }

  private getConferenceImplications(gameState: GameState): any {
    const homeConference = this.determineConference(gameState.homeTeam);
    const awayConference = this.determineConference(gameState.awayTeam);
    
    return {
      homeConference,
      awayConference,
      isConferenceGame: homeConference === awayConference,
      hasChampionshipImplications: this.hasConferenceChampionshipImplications(gameState)
    };
  }

  private getPlayoffImplications(gameState: GameState): string {
    if (this.isPlayoffGame(gameState)) return 'Playoff Game';
    if (this.isBowlGame(gameState)) return 'Bowl Game';
    if (this.hasConferenceChampionshipImplications(gameState)) return 'Conference Championship Stakes';
    return 'Regular Season';
  }

  private getMomentumShiftLevel(gameState: GameState): string {
    if (gameState.momentumShift) return gameState.momentumShift;
    
    // Simple momentum detection based on score trends
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff >= 14) return 'STRONG';
    if (scoreDiff >= 7) return 'MODERATE';
    return 'SLIGHT';
  }

  private getUnderdogPerformanceLevel(gameState: GameState): string {
    const underdog = this.getUnderdogTeam(gameState);
    const underdogScore = underdog === gameState.homeTeam ? gameState.homeScore : gameState.awayScore;
    const favoriteScore = underdog === gameState.homeTeam ? gameState.awayScore : gameState.homeScore;
    
    if (underdogScore > favoriteScore + 14) return 'Dominating';
    if (underdogScore > favoriteScore + 7) return 'Strong';  
    if (underdogScore >= favoriteScore) return 'Competitive';
    if (favoriteScore - underdogScore <= 7) return 'Close';
    return 'Struggling';
  }

  private isDecemberOrJanuary(): boolean {
    const month = new Date().getMonth() + 1;
    return month === 12 || month === 1;
  }

  private isLateSeasonGame(): boolean {
    const month = new Date().getMonth() + 1;
    return month >= 11 || month <= 1; // November through January
  }

  private getTimeKey(timeRemaining?: string): string {
    if (!timeRemaining) return '0';
    const seconds = this.parseTimeToSeconds(timeRemaining);
    return Math.floor(seconds / 60).toString(); // Group by minute
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
    } catch {
      return 0;
    }
  }
}