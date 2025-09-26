import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class RedZoneEfficiencyModule extends BaseAlertModule {
  alertType = 'NCAAF_RED_ZONE_EFFICIENCY';
  sport = 'NCAAF';

  // College football-specific red zone analytics
  private readonly FIELD_POSITION_TD_PROBABILITY = {
    1: 92, 2: 89, 3: 86, 4: 83, 5: 80, 6: 77, 7: 74, 8: 71, 9: 68, 10: 65,
    11: 62, 12: 59, 13: 56, 14: 53, 15: 50, 16: 47, 17: 44, 18: 41, 19: 38, 20: 35
  };

  private readonly DOWN_DISTANCE_EFFICIENCY = {
    1: { [1]: 1.4, [2]: 1.3, [3]: 1.2, [4]: 1.1, [5]: 1.0, [6]: 0.95, [7]: 0.9, [8]: 0.85, [9]: 0.8, [10]: 0.75 },
    2: { [1]: 1.3, [2]: 1.2, [3]: 1.1, [4]: 1.0, [5]: 0.95, [6]: 0.9, [7]: 0.85, [8]: 0.8, [9]: 0.75, [10]: 0.7 },
    3: { [1]: 1.2, [2]: 1.1, [3]: 1.0, [4]: 0.95, [5]: 0.9, [6]: 0.85, [7]: 0.8, [8]: 0.75, [9]: 0.7, [10]: 0.65 },
    4: { [1]: 1.1, [2]: 1.0, [3]: 0.95, [4]: 0.9, [5]: 0.85, [6]: 0.8, [7]: 0.75, [8]: 0.7, [9]: 0.65, [10]: 0.6 }
  };

  private readonly CONFERENCE_OFFENSIVE_MULTIPLIERS = {
    'Big 12': 1.25,    // High-scoring offensive conference
    'SEC': 1.15,       // Strong offensive talent
    'Pac-12': 1.20,    // West coast offensive systems
    'ACC': 1.10,       // Moderate offensive efficiency  
    'Big Ten': 1.05,   // More defensive-oriented
    'AAC': 1.18,       // Group of 5 high-powered offenses
    'Mountain West': 1.15,
    'Conference USA': 1.12,
    'MAC': 1.10,
    'Sun Belt': 1.13,
    'Independent': 1.08
  };

  private readonly RIVALRY_SCORING_MULTIPLIER = 1.15; // 15% boost in rivalry games

  isTriggered(gameState: GameState): boolean {
    // Only trigger for live games in red zone situations
    if (gameState.status !== 'live' || !gameState.fieldPosition) return false;
    
    // Must be in red zone (20 yards or closer to goal line)
    if (gameState.fieldPosition > 20 || gameState.fieldPosition <= 0) return false;
    
    // Calculate touchdown probability and trigger if >= 70%
    const touchdownProbability = this.calculateTouchdownProbability(gameState);
    return touchdownProbability >= 70;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const touchdownProbability = this.calculateTouchdownProbability(gameState);
    const confidenceLevel = this.getConfidenceLevel(touchdownProbability);
    const situationDescription = this.getSituationDescription(gameState);
    const possessionTeam = this.getPossessionTeam(gameState);
    const efficiencyFactors = this.getEfficiencyFactors(gameState);
    const predictedOutcome = this.getPredictedOutcome(gameState);

    return {
      alertKey: `${gameState.gameId}_red_zone_efficiency_${gameState.down}_${gameState.yardsToGo}_${gameState.fieldPosition}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | RED ZONE EFFICIENCY`,
      displayMessage: `🏈 NCAAF RED ZONE EFFICIENCY | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        possession: gameState.possession || possessionTeam,
        possessionTeam,
        touchdownProbability: Math.round(touchdownProbability),
        confidenceLevel,
        situationDescription,
        efficiencyFactors,
        predictedOutcome,
        alertType: 'PREDICTIVE',
        predictionCategory: 'RED_ZONE_EFFICIENCY',
        // NCAAF-specific context for AI enhancement
        ncaafContext: {
          isRedZone: true,
          isGoalLine: gameState.fieldPosition <= 5,
          isFirstAndGoal: gameState.down === 1 && gameState.fieldPosition <= 10,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          timePressure: this.getTimePressureLevel(gameState),
          isRivalryGame: this.isRivalryGame(gameState),
          conferenceOffensivePower: this.getConferenceOffensivePower(gameState),
          redZoneEfficiency: this.getRedZoneEfficiencyMetrics(gameState),
          gameImportance: this.getGameImportance(gameState)
        }
      },
      priority: this.calculateAlertPriority(touchdownProbability, gameState)
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateTouchdownProbability(gameState);
  }

  private calculateTouchdownProbability(gameState: GameState): number {
    if (!gameState.fieldPosition || !gameState.down || !gameState.yardsToGo) return 0;

    // Base probability from field position
    const fieldPosition = Math.min(Math.max(gameState.fieldPosition, 1), 20);
    let baseProbability = this.FIELD_POSITION_TD_PROBABILITY[fieldPosition as keyof typeof this.FIELD_POSITION_TD_PROBABILITY] || 35;

    // Down and distance efficiency multiplier
    const down = Math.min(gameState.down, 4) as keyof typeof this.DOWN_DISTANCE_EFFICIENCY;
    const yardsToGo = Math.min(gameState.yardsToGo, 10);
    const efficiencyMultiplier = this.DOWN_DISTANCE_EFFICIENCY[down]?.[yardsToGo as keyof typeof this.DOWN_DISTANCE_EFFICIENCY[1]] || 0.6;
    
    baseProbability *= efficiencyMultiplier;

    // Conference offensive strength
    const conferenceMultiplier = this.getConferenceOffensiveMultiplier(gameState);
    baseProbability *= conferenceMultiplier;

    // Game context adjustments
    const contextAdjustment = this.getGameContextAdjustment(gameState);
    baseProbability *= contextAdjustment;

    // Rivalry game boost
    if (this.isRivalryGame(gameState)) {
      baseProbability *= this.RIVALRY_SCORING_MULTIPLIER;
    }

    // Special red zone situations
    const specialBonus = this.getSpecialSituationBonus(gameState);
    baseProbability += specialBonus;

    // Weather impact (if applicable)
    if (gameState.weather && gameState.weather.isOutdoorStadium) {
      const weatherAdjustment = this.getWeatherAdjustment(gameState);
      baseProbability *= weatherAdjustment;
    }

    return Math.min(Math.max(baseProbability, 10), 98);
  }

  private getConferenceOffensiveMultiplier(gameState: GameState): number {
    const possessionTeam = this.getPossessionTeam(gameState);
    const conference = this.determineConference(possessionTeam);
    return this.CONFERENCE_OFFENSIVE_MULTIPLIERS[conference as keyof typeof this.CONFERENCE_OFFENSIVE_MULTIPLIERS] || 1.0;
  }

  private getGameContextAdjustment(gameState: GameState): number {
    if (!gameState.quarter || !gameState.timeRemaining) return 1.0;

    let adjustment = 1.0;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Quarter-based urgency
    if (gameState.quarter === 1) {
      adjustment += 0.05; // Early game confidence
    } else if (gameState.quarter === 2) {
      if (timeSeconds <= 120) adjustment += 0.15; // End of half urgency
      else adjustment += 0.08;
    } else if (gameState.quarter === 3) {
      adjustment += 0.10; // Second half momentum
    } else if (gameState.quarter === 4) {
      adjustment += 0.20; // Fourth quarter urgency
      if (timeSeconds <= 300) adjustment += 0.15; // Final 5 minutes
      if (timeSeconds <= 120) adjustment += 0.10; // Final 2 minutes
    } else if (gameState.quarter >= 5) {
      adjustment += 0.25; // Overtime situations
    }

    // Score differential context
    if (scoreDiff <= 3) {
      adjustment += 0.12; // Close game - every TD crucial
    } else if (scoreDiff <= 7) {
      adjustment += 0.08; // One-score game
    } else if (scoreDiff >= 21) {
      adjustment -= 0.05; // Blowout - less urgency
    }

    // Possession team context (behind teams more aggressive)
    const possessionTeam = this.getPossessionTeam(gameState);
    const possessionScore = possessionTeam === gameState.homeTeam ? gameState.homeScore : gameState.awayScore;
    const opponentScore = possessionTeam === gameState.homeTeam ? gameState.awayScore : gameState.homeScore;
    
    if (possessionScore < opponentScore) {
      adjustment += 0.10; // Trailing team needs TDs
    } else if (possessionScore > opponentScore + 14) {
      adjustment -= 0.08; // Comfortable lead - might settle for FGs
    }

    return adjustment;
  }

  private getSpecialSituationBonus(gameState: GameState): number {
    let bonus = 0;

    // Goal line situations
    if (gameState.fieldPosition <= 5) {
      bonus += 15; // Very close to goal line
      if (gameState.fieldPosition <= 2) bonus += 10; // Inside 2-yard line
    }

    // First and goal situations
    if (gameState.down === 1 && gameState.fieldPosition <= 10) {
      bonus += 12; // Fresh set of downs in red zone
    }

    // Short yardage situations
    if (gameState.yardsToGo <= 3) {
      bonus += 8; // Short yardage favors offense
    }

    // Two-minute drill situations
    if (gameState.quarter === 2 || gameState.quarter === 4) {
      const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
      if (timeSeconds <= 120) {
        bonus += 10; // Two-minute drill urgency
      }
    }

    // Conference championship/bowl game context
    if (this.isBowlGame(gameState) || this.hasConferenceChampionshipImplications(gameState)) {
      bonus += 8; // Big game situations
    }

    return bonus;
  }

  private getWeatherAdjustment(gameState: GameState): number {
    if (!gameState.weather || !gameState.weather.impact) return 1.0;

    const weatherImpact = gameState.weather.impact;
    let adjustment = 1.0;

    // Poor weather conditions
    if (weatherImpact.passingConditions === 'dangerous') {
      adjustment -= 0.15; // Difficult passing in red zone
    } else if (weatherImpact.passingConditions === 'poor') {
      adjustment -= 0.08; // Moderate passing difficulty
    }

    // Wind affects shorter passes less than long ones
    if (weatherImpact.windSpeed > 15 && gameState.fieldPosition > 10) {
      adjustment -= 0.05; // Minor impact on short red zone passes
    }

    // Precipitation favors running game in red zone
    if (weatherImpact.precipitation === 'heavy') {
      if (gameState.fieldPosition <= 10) adjustment += 0.05; // Power running near goal
      else adjustment -= 0.03; // Slightly harder passing
    }

    // Field conditions impact
    if (weatherImpact.fieldConditions === 'poor') {
      adjustment -= 0.05; // Footing issues affect all plays
    }

    return adjustment;
  }

  private getEfficiencyFactors(gameState: GameState): string[] {
    const factors: string[] = [];
    
    if (gameState.fieldPosition <= 5) factors.push('Goal line situation');
    if (gameState.down === 1 && gameState.fieldPosition <= 10) factors.push('First and goal');
    if (gameState.yardsToGo <= 3) factors.push('Short yardage');
    if (gameState.quarter === 4) factors.push('Fourth quarter');
    if (gameState.quarter >= 5) factors.push('Overtime');
    if (this.isRivalryGame(gameState)) factors.push('Rivalry game intensity');
    if (this.isBowlGame(gameState)) factors.push('Bowl game stakes');
    
    const conference = this.determineConference(this.getPossessionTeam(gameState));
    if ((this.CONFERENCE_OFFENSIVE_MULTIPLIERS[conference as keyof typeof this.CONFERENCE_OFFENSIVE_MULTIPLIERS] || 1.0) >= 1.15) {
      factors.push(`${conference} offensive power`);
    }
    
    return factors;
  }

  private getSituationDescription(gameState: GameState): string {
    const down = gameState.down;
    const yardsToGo = gameState.yardsToGo;
    const fieldPosition = gameState.fieldPosition;
    
    let description = `${down}${this.getOrdinalSuffix(down)} & ${yardsToGo} at ${fieldPosition}-yard line`;
    
    if (down === 1 && fieldPosition <= 10) {
      description = `1st & Goal at ${fieldPosition}`;
    } else if (yardsToGo >= fieldPosition) {
      description = `${down}${this.getOrdinalSuffix(down)} & Goal at ${fieldPosition}`;
    }
    
    return description;
  }

  private getPredictedOutcome(gameState: GameState): string {
    const probability = this.calculateTouchdownProbability(gameState);
    
    if (probability >= 90) return 'TOUCHDOWN HIGHLY LIKELY';
    if (probability >= 80) return 'STRONG TD PROBABILITY';
    if (probability >= 70) return 'GOOD TD CHANCE';
    if (probability >= 60) return 'TD FAVORED';
    return 'TD POSSIBLE';
  }

  private calculateAlertPriority(probability: number, gameState: GameState): number {
    let priority = 75; // Base priority
    
    // Probability-based priority
    if (probability >= 90) priority = 95;
    else if (probability >= 85) priority = 92;
    else if (probability >= 80) priority = 90;
    else if (probability >= 75) priority = 87;
    else priority = 85;
    
    // Situation bonuses
    if (gameState.fieldPosition <= 5) priority = Math.min(priority + 3, 98); // Goal line
    if (gameState.quarter === 4) priority = Math.min(priority + 2, 98); // Fourth quarter
    if (gameState.quarter >= 5) priority = Math.min(priority + 3, 98); // Overtime
    if (this.isRivalryGame(gameState)) priority = Math.min(priority + 2, 98); // Rivalry
    if (this.isBowlGame(gameState)) priority = Math.min(priority + 2, 98); // Bowl game
    
    return priority;
  }

  private getConfidenceLevel(probability: number): string {
    if (probability >= 90) return 'Very High';
    if (probability >= 80) return 'High';
    if (probability >= 70) return 'Moderate';
    return 'Low';
  }

  private getPossessionTeam(gameState: GameState): string {
    return gameState.possession || gameState.homeTeam;
  }

  private getTimePressureLevel(gameState: GameState): string {
    if (!gameState.quarter || !gameState.timeRemaining) return 'Normal';
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    if (gameState.quarter === 4) {
      if (timeSeconds <= 60) return 'Critical';
      if (timeSeconds <= 120) return 'High';  
      if (timeSeconds <= 300) return 'Elevated';
    } else if (gameState.quarter === 2 && timeSeconds <= 120) {
      return 'End of Half';
    }
    
    if (gameState.quarter >= 5) return 'Overtime';
    
    return 'Normal';
  }

  private getConferenceOffensivePower(gameState: GameState): any {
    const possessionTeam = this.getPossessionTeam(gameState);
    const conference = this.determineConference(possessionTeam);
    const multiplier = this.CONFERENCE_OFFENSIVE_MULTIPLIERS[conference as keyof typeof this.CONFERENCE_OFFENSIVE_MULTIPLIERS] || 1.0;
    
    return {
      conference,
      offensiveMultiplier: multiplier,
      powerRating: multiplier >= 1.2 ? 'High' : multiplier >= 1.1 ? 'Above Average' : 'Average'
    };
  }

  private getRedZoneEfficiencyMetrics(gameState: GameState): any {
    const probability = this.calculateTouchdownProbability(gameState);
    
    return {
      touchdownProbability: Math.round(probability),
      fieldGoalProbability: Math.round(100 - probability),
      situationalStrength: gameState.fieldPosition <= 10 ? 'Strong' : 'Moderate',
      conversionExpectation: probability >= 80 ? 'High' : probability >= 70 ? 'Good' : 'Fair'
    };
  }

  private getGameImportance(gameState: GameState): string {
    if (this.isPlayoffGame(gameState)) return 'College Football Playoff';
    if (this.isBowlGame(gameState)) return 'Bowl Game';
    if (this.hasConferenceChampionshipImplications(gameState)) return 'Conference Championship Stakes';
    if (this.isRivalryGame(gameState)) return 'Rivalry Game';
    return 'Regular Season';
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
    // Simplified bowl game detection
    const gameId = gameState.gameId?.toString() || '';
    return gameId.includes('bowl') || this.isDecemberOrJanuary();
  }

  private isPlayoffGame(gameState: GameState): boolean {
    const gameId = gameState.gameId?.toString() || '';
    return gameId.includes('playoff') || gameId.includes('championship');
  }

  private hasConferenceChampionshipImplications(gameState: GameState): boolean {
    return this.isLateSeasonGame() && this.determineConference(gameState.homeTeam) === this.determineConference(gameState.awayTeam);
  }

  private isDecemberOrJanuary(): boolean {
    const month = new Date().getMonth() + 1;
    return month === 12 || month === 1;
  }

  private isLateSeasonGame(): boolean {
    const month = new Date().getMonth() + 1;
    return month >= 11 || month <= 1; // November through January
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

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }
}