import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FourthDownDecisionModule extends BaseAlertModule {
  alertType = 'NCAAF_FOURTH_DOWN_DECISION';
  sport = 'NCAAF';

  // College football-specific fourth down analytics
  private readonly FIELD_POSITION_GO_FOR_IT_PROBABILITY = {
    // Opponent territory (higher go-for-it probability)
    1: 95, 2: 92, 3: 89, 4: 86, 5: 83, 6: 80, 7: 77, 8: 74, 9: 71, 10: 68,
    11: 65, 12: 62, 13: 59, 14: 56, 15: 53, 16: 50, 17: 47, 18: 44, 19: 41, 20: 38,
    21: 35, 22: 32, 23: 29, 24: 26, 25: 23, 26: 20, 27: 18, 28: 16, 29: 14, 30: 12,
    // Midfield area (moderate probability)
    35: 25, 40: 35, 45: 45, 50: 55,
    // Own territory (lower probability, more conservative)
    55: 15, 60: 12, 65: 10, 70: 8, 75: 6, 80: 5, 85: 4, 90: 3, 95: 2, 99: 1
  };

  private readonly YARDS_TO_GO_MULTIPLIERS = {
    1: 2.0, 2: 1.8, 3: 1.5, 4: 1.2, 5: 1.0, 6: 0.8, 7: 0.6, 8: 0.5, 9: 0.4, 10: 0.3
  };

  private readonly CONFERENCE_AGGRESSION_FACTORS = {
    'SEC': 1.15,      // Most aggressive conference
    'Big Ten': 1.10,  // Traditional but increasingly aggressive
    'Big 12': 1.20,   // High-scoring, aggressive conference
    'ACC': 1.05,      // Moderate aggression
    'Pac-12': 1.08,   // West coast offensive mentality
    'AAC': 1.12,      // Group of 5 teams more aggressive
    'Mountain West': 1.15, // G5 teams need every advantage
    'Conference USA': 1.18,
    'MAC': 1.20,      // Mid-major teams must be aggressive
    'Sun Belt': 1.16,
    'Independent': 1.10 // Varies by team
  };

  private readonly RIVALRY_GAME_MULTIPLIER = 1.25; // 25% more aggressive in rivalry games

  isTriggered(gameState: GameState): boolean {
    // Only trigger on live 4th down situations
    if (gameState.status !== 'live' || gameState.down !== 4) return false;
    
    // Must have basic field position and yards to go data
    if (!gameState.fieldPosition || !gameState.yardsToGo) return false;
    
    // Calculate go-for-it probability and trigger if >= 60%
    const goForItProbability = this.calculateGoForItProbability(gameState);
    return goForItProbability >= 60;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const goForItProbability = this.calculateGoForItProbability(gameState);
    const confidenceLevel = this.getConfidenceLevel(goForItProbability);
    const situationDescription = this.getSituationDescription(gameState);
    const possessionTeam = this.getPossessionTeam(gameState);
    const recommendedAction = this.getRecommendedAction(gameState);
    const contextFactors = this.getContextFactors(gameState);

    return {
      alertKey: `${gameState.gameId}_fourth_down_decision_${gameState.fieldPosition}_${gameState.yardsToGo}`,
      type: this.alertType,
      message: `🏈 ${possessionTeam} Fourth Down Decision - ${situationDescription} - Go-for-it probability: ${Math.round(goForItProbability)}%`,
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
        goForItProbability: Math.round(goForItProbability),
        confidenceLevel,
        situationDescription,
        recommendedAction,
        contextFactors,
        alertType: 'PREDICTIVE',
        predictionCategory: 'FOURTH_DOWN_DECISION',
        // NCAAF-specific context for AI enhancement
        ncaafContext: {
          isFourthDown: true,
          isRedZone: gameState.fieldPosition <= 20,
          isShortYardage: gameState.yardsToGo <= 3,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          timePressure: this.getTimePressureLevel(gameState),
          isRivalryGame: this.isRivalryGame(gameState),
          conferenceContext: this.getConferenceContext(gameState),
          gameImportance: this.getGameImportance(gameState)
        }
      },
      priority: goForItProbability > 85 ? 95 : goForItProbability > 75 ? 90 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateGoForItProbability(gameState);
  }

  private calculateGoForItProbability(gameState: GameState): number {
    if (!gameState.fieldPosition || !gameState.yardsToGo) return 0;

    // Base probability from field position
    const fieldPosition = Math.min(Math.max(gameState.fieldPosition, 1), 99);
    let baseProbability = this.getFieldPositionProbability(fieldPosition);

    // Yards to go multiplier
    const yardsToGo = Math.min(gameState.yardsToGo, 10);
    const yardsMultiplier = this.YARDS_TO_GO_MULTIPLIERS[yardsToGo as keyof typeof this.YARDS_TO_GO_MULTIPLIERS] || 0.2;
    baseProbability *= yardsMultiplier;

    // Time and score situation adjustments
    const gameContextAdjustment = this.getGameContextAdjustment(gameState);
    baseProbability *= gameContextAdjustment;

    // Conference aggression factor
    const conferenceMultiplier = this.getConferenceAggression(gameState);
    baseProbability *= conferenceMultiplier;

    // Rivalry game bonus
    if (this.isRivalryGame(gameState)) {
      baseProbability *= this.RIVALRY_GAME_MULTIPLIER;
    }

    // Special situations
    const specialSituationBonus = this.getSpecialSituationBonus(gameState);
    baseProbability += specialSituationBonus;

    // Weather impact (affects field goal accuracy)
    if (gameState.weather && gameState.weather.isOutdoorStadium) {
      const weatherImpact = this.getWeatherImpact(gameState);
      baseProbability += weatherImpact;
    }

    return Math.min(Math.max(baseProbability, 5), 98);
  }

  private getFieldPositionProbability(fieldPosition: number): number {
    // Use interpolation for positions not in our table
    const positions = Object.keys(this.FIELD_POSITION_GO_FOR_IT_PROBABILITY).map(Number).sort((a, b) => a - b);
    let closestPosition = positions[0];
    
    for (const pos of positions) {
      if (Math.abs(fieldPosition - pos) < Math.abs(fieldPosition - closestPosition)) {
        closestPosition = pos;
      }
    }
    
    return this.FIELD_POSITION_GO_FOR_IT_PROBABILITY[closestPosition as keyof typeof this.FIELD_POSITION_GO_FOR_IT_PROBABILITY] || 25;
  }

  private getGameContextAdjustment(gameState: GameState): number {
    if (!gameState.quarter || !gameState.timeRemaining) return 1.0;

    let adjustment = 1.0;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Fourth quarter urgency
    if (gameState.quarter === 4) {
      if (timeSeconds <= 120) adjustment += 0.4; // Final two minutes
      else if (timeSeconds <= 300) adjustment += 0.3; // Final 5 minutes
      else adjustment += 0.2; // Fourth quarter general
      
      // Desperate situations (behind and running out of time)
      if (scoreDiff >= 7 && timeSeconds <= 300) {
        adjustment += 0.3; // Must score touchdowns
      }
    }

    // Overtime situations (college football specific)
    if (gameState.quarter >= 5) {
      adjustment += 0.5; // Much more aggressive in overtime
    }

    // Close game situations
    if (scoreDiff <= 3) {
      adjustment += 0.15; // Every possession matters
    } else if (scoreDiff <= 7) {
      adjustment += 0.1; // Still important
    }

    return adjustment;
  }

  private getConferenceAggression(gameState: GameState): number {
    // Try to determine conference from team names (simplified)
    const homeTeamConference = this.determineConference(gameState.homeTeam);
    const awayTeamConference = this.determineConference(gameState.awayTeam);
    
    // Use the more aggressive conference's factor
    const homeMultiplier = this.CONFERENCE_AGGRESSION_FACTORS[homeTeamConference as keyof typeof this.CONFERENCE_AGGRESSION_FACTORS] || 1.0;
    const awayMultiplier = this.CONFERENCE_AGGRESSION_FACTORS[awayTeamConference as keyof typeof this.CONFERENCE_AGGRESSION_FACTORS] || 1.0;
    
    return Math.max(homeMultiplier, awayMultiplier);
  }

  private getSpecialSituationBonus(gameState: GameState): number {
    let bonus = 0;

    // Red zone situations (more likely to go for it near goal line)
    if (gameState.fieldPosition <= 20) {
      bonus += 15; // Higher reward for touchdowns vs field goals
      if (gameState.fieldPosition <= 5) {
        bonus += 10; // Goal line situations
      }
    }

    // Two-point conversion territory
    if (gameState.fieldPosition <= 2 && gameState.yardsToGo <= 2) {
      bonus += 20; // Very high probability near goal line
    }

    // Long field goal attempts (40+ yards) make going for it more attractive
    if (gameState.fieldPosition >= 23) { // 40+ yard field goal
      bonus += 8;
      if (gameState.fieldPosition >= 33) { // 50+ yard field goal
        bonus += 15;
      }
    }

    return bonus;
  }

  private getWeatherImpact(gameState: GameState): number {
    if (!gameState.weather || !gameState.weather.impact) return 0;

    const weatherImpact = gameState.weather.impact;
    let impact = 0;

    // Poor kicking conditions increase go-for-it probability
    if (weatherImpact.fieldGoalDifficulty === 'extreme') {
      impact += 25; // Field goals very unreliable
    } else if (weatherImpact.fieldGoalDifficulty === 'high') {
      impact += 15; // Field goals difficult
    } else if (weatherImpact.fieldGoalDifficulty === 'moderate') {
      impact += 8; // Field goals somewhat difficult
    }

    // Wind conditions
    if (weatherImpact.weatherAlert && gameState.fieldPosition >= 25) {
      impact += 10; // Long kicks affected more by weather
    }

    return impact;
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
    
    return 'Independent'; // Default for teams not in major conferences
  }

  private getContextFactors(gameState: GameState): string[] {
    const factors: string[] = [];
    
    if (gameState.yardsToGo <= 2) factors.push('Short yardage');
    if (gameState.fieldPosition <= 20) factors.push('Red zone');
    if (gameState.quarter === 4) factors.push('Fourth quarter');
    if (gameState.quarter >= 5) factors.push('Overtime');
    if (this.isRivalryGame(gameState)) factors.push('Rivalry game');
    if (Math.abs(gameState.homeScore - gameState.awayScore) <= 3) factors.push('Close game');
    if (gameState.weather && gameState.weather.impact?.fieldGoalDifficulty === 'high') factors.push('Poor kicking weather');
    
    return factors;
  }

  private getSituationDescription(gameState: GameState): string {
    const down = gameState.down;
    const yardsToGo = gameState.yardsToGo;
    const fieldPosition = gameState.fieldPosition;
    
    return `${down}${this.getOrdinalSuffix(down)} & ${yardsToGo} at ${fieldPosition}-yard line`;
  }

  private getRecommendedAction(gameState: GameState): string {
    const probability = this.calculateGoForItProbability(gameState);
    
    if (probability >= 85) return 'STRONG GO FOR IT';
    if (probability >= 70) return 'GO FOR IT';
    if (probability >= 55) return 'LEAN GO FOR IT';
    if (probability >= 45) return 'TOSS UP';
    if (probability >= 30) return 'LEAN PUNT/KICK';
    return 'PUNT/KICK';
  }

  private getConfidenceLevel(probability: number): string {
    if (probability >= 85) return 'Very High';
    if (probability >= 70) return 'High';
    if (probability >= 55) return 'Medium';
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
    }
    
    if (gameState.quarter >= 5) return 'Overtime';
    
    return 'Normal';
  }

  private getConferenceContext(gameState: GameState): any {
    const homeConference = this.determineConference(gameState.homeTeam);
    const awayConference = this.determineConference(gameState.awayTeam);
    
    return {
      homeConference,
      awayConference,
      isConferenceGame: homeConference === awayConference,
      aggressionLevel: Math.max(
        this.CONFERENCE_AGGRESSION_FACTORS[homeConference as keyof typeof this.CONFERENCE_AGGRESSION_FACTORS] || 1.0,
        this.CONFERENCE_AGGRESSION_FACTORS[awayConference as keyof typeof this.CONFERENCE_AGGRESSION_FACTORS] || 1.0
      )
    };
  }

  private getGameImportance(gameState: GameState): string {
    if (this.isRivalryGame(gameState)) return 'Rivalry';
    if (gameState.quarter >= 5) return 'Overtime';
    
    // Could add more sophisticated importance detection based on rankings, bowl implications, etc.
    return 'Regular';
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