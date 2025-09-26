import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class ComebackPotentialModule extends BaseAlertModule {
  alertType = 'NCAAF_COMEBACK_POTENTIAL';
  sport = 'NCAAF';

  // College football comeback probability matrices
  private readonly DEFICIT_TIME_PROBABILITY = {
    // Deficit ranges by time remaining in 4th quarter
    3: { 300: 85, 600: 75, 900: 65 },    // 3-point deficit
    7: { 300: 70, 600: 60, 900: 50 },    // 7-point deficit  
    10: { 300: 55, 600: 45, 900: 35 },   // 10-point deficit
    14: { 300: 45, 600: 35, 900: 25 },   // 14-point deficit
    17: { 300: 35, 600: 25, 900: 15 },   // 17-point deficit
    21: { 300: 25, 600: 15, 900: 10 },   // 21-point deficit
    24: { 300: 18, 600: 10, 900: 5 },    // 24-point deficit
    28: { 300: 12, 600: 6, 900: 3 }      // 28-point deficit
  };

  private readonly MOMENTUM_MULTIPLIERS = {
    'STRONG_POSITIVE': 1.4,    // Team has strong momentum
    'MODERATE_POSITIVE': 1.2,  // Some positive momentum
    'NEUTRAL': 1.0,            // No clear momentum
    'NEGATIVE': 0.8            // Negative momentum
  };

  private readonly CONFERENCE_COMEBACK_FACTORS = {
    'Big 12': 1.3,       // High-scoring, fast-paced games
    'Pac-12': 1.25,      // After Dark comeback magic
    'SEC': 1.15,         // Talent level enables comebacks
    'ACC': 1.20,         // Coastal chaos factor
    'Big Ten': 1.10,     // More methodical, fewer comebacks
    'AAC': 1.22,         // Group of 5 offensive firepower
    'Mountain West': 1.18,
    'Conference USA': 1.15,
    'MAC': 1.12,
    'Sun Belt': 1.16,
    'Independent': 1.08
  };

  private readonly RIVALRY_COMEBACK_MULTIPLIER = 1.35; // Rivalries create magic

  isTriggered(gameState: GameState): boolean {
    // Only trigger for live games where one team is trailing
    if (gameState.status !== 'live' || !this.isValidComebackSituation(gameState)) return false;

    // Calculate comeback probability and trigger if >= 60%
    const comebackProbability = this.calculateComebackProbability(gameState);
    return comebackProbability >= 60;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const comebackProbability = this.calculateComebackProbability(gameState);
    const confidenceLevel = this.getConfidenceLevel(comebackProbability);
    const trailingTeam = this.getTrailingTeam(gameState);
    const deficitInfo = this.getDeficitInfo(gameState);
    const comebackFactors = this.getComebackFactors(gameState);
    const situationDescription = this.getSituationDescription(gameState);

    return {
      alertKey: `${gameState.gameId}_comeback_potential_${gameState.quarter}_${this.getTimeKey(gameState.timeRemaining)}_${deficitInfo.deficit}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${this.createDynamicMessage(gameState, deficitInfo, comebackProbability)}`,
      displayMessage: `🏈 NCAAF COMEBACK POTENTIAL | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down: gameState.down || null,
        yardsToGo: gameState.yardsToGo || null,
        fieldPosition: gameState.fieldPosition || null,
        possession: gameState.possession || trailingTeam,
        trailingTeam,
        leadingTeam: this.getLeadingTeam(gameState),
        deficit: deficitInfo.deficit,
        deficitType: deficitInfo.type,
        comebackProbability: Math.round(comebackProbability),
        confidenceLevel,
        comebackFactors,
        situationDescription,
        alertType: 'PREDICTIVE',
        predictionCategory: 'COMEBACK_POTENTIAL',
        // NCAAF-specific context for AI enhancement
        ncaafContext: {
          isComebackSituation: true,
          deficitSize: deficitInfo.deficit,
          timePressure: this.getTimePressureLevel(gameState),
          isRivalryGame: this.isRivalryGame(gameState),
          conferenceContext: this.getConferenceContext(gameState),
          momentumLevel: this.getMomentumLevel(gameState),
          offensiveCapability: this.getOffensiveCapability(gameState, trailingTeam),
          gameImportance: this.getGameImportance(gameState),
          timeoutsRemaining: this.getTimeoutsSituation(gameState)
        }
      },
      priority: this.calculateAlertPriority(comebackProbability, deficitInfo, gameState)
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateComebackProbability(gameState);
  }

  private calculateComebackProbability(gameState: GameState): number {
    if (!this.isValidComebackSituation(gameState)) return 0;

    const deficitInfo = this.getDeficitInfo(gameState);
    const timeRemaining = this.parseTimeToSeconds(gameState.timeRemaining);
    
    // Base probability from deficit and time matrix
    let baseProbability = this.getBaseComebackProbability(deficitInfo.deficit, timeRemaining, gameState.quarter);

    // Momentum adjustments
    const momentumMultiplier = this.getMomentumMultiplier(gameState);
    baseProbability *= momentumMultiplier;

    // Conference comeback factor
    const conferenceMultiplier = this.getConferenceComebackMultiplier(gameState);
    baseProbability *= conferenceMultiplier;

    // Rivalry game boost
    if (this.isRivalryGame(gameState)) {
      baseProbability *= this.RIVALRY_COMEBACK_MULTIPLIER;
    }

    // Offensive capability adjustment
    const offensiveAdjustment = this.getOffensiveCapabilityAdjustment(gameState);
    baseProbability *= offensiveAdjustment;

    // Special situation bonuses
    const specialBonus = this.getSpecialSituationBonus(gameState);
    baseProbability += specialBonus;

    // Timeout availability impact
    const timeoutAdjustment = this.getTimeoutAdjustment(gameState);
    baseProbability *= timeoutAdjustment;

    return Math.min(Math.max(baseProbability, 5), 95);
  }

  private getBaseComebackProbability(deficit: number, timeSeconds: number, quarter: number): number {
    // Third quarter comeback situations
    if (quarter === 3) {
      if (deficit <= 7) return 75;
      if (deficit <= 14) return 60;
      if (deficit <= 21) return 45;
      return 30;
    }

    // Fourth quarter comeback matrix
    if (quarter !== 4) return 20; // Earlier quarters have lower base probability

    // Find closest deficit and time match
    const deficitKey = this.findClosestDeficit(deficit);
    const timeKey = this.findClosestTime(timeSeconds);
    
    return this.DEFICIT_TIME_PROBABILITY[deficitKey as keyof typeof this.DEFICIT_TIME_PROBABILITY]?.[timeKey as keyof typeof this.DEFICIT_TIME_PROBABILITY[3]] || 20;
  }

  private findClosestDeficit(deficit: number): number {
    const deficits = [3, 7, 10, 14, 17, 21, 24, 28];
    return deficits.reduce((prev, curr) => 
      Math.abs(curr - deficit) < Math.abs(prev - deficit) ? curr : prev
    );
  }

  private findClosestTime(timeSeconds: number): number {
    const times = [300, 600, 900]; // 5, 10, 15 minutes
    return times.reduce((prev, curr) => 
      Math.abs(curr - timeSeconds) < Math.abs(prev - timeSeconds) ? curr : prev
    );
  }

  private getMomentumMultiplier(gameState: GameState): number {
    const momentumLevel = this.getMomentumLevel(gameState);
    return this.MOMENTUM_MULTIPLIERS[momentumLevel as keyof typeof this.MOMENTUM_MULTIPLIERS] || 1.0;
  }

  private getConferenceComebackMultiplier(gameState: GameState): number {
    const trailingTeam = this.getTrailingTeam(gameState);
    const conference = this.determineConference(trailingTeam);
    return this.CONFERENCE_COMEBACK_FACTORS[conference as keyof typeof this.CONFERENCE_COMEBACK_FACTORS] || 1.0;
  }

  private getOffensiveCapabilityAdjustment(gameState: GameState): number {
    const trailingTeam = this.getTrailingTeam(gameState);
    const conference = this.determineConference(trailingTeam);
    
    let adjustment = 1.0;
    
    // High-powered offensive conferences
    if (['Big 12', 'Pac-12', 'AAC'].includes(conference)) {
      adjustment += 0.15; // Strong offensive systems
    } else if (['SEC', 'ACC'].includes(conference)) {
      adjustment += 0.10; // Above average offense
    }

    // Additional factors would include actual team offensive statistics
    // This is a simplified version for demonstration
    
    return adjustment;
  }

  private getSpecialSituationBonus(gameState: GameState): number {
    let bonus = 0;

    // Overtime potential (close games late)
    const deficit = this.getDeficitInfo(gameState).deficit;
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    if (gameState.quarter === 4 && deficit <= 8 && timeSeconds <= 120) {
      bonus += 15; // Could force overtime
    }

    // Two-minute drill situations
    if (gameState.quarter === 4 && timeSeconds <= 120 && deficit <= 14) {
      bonus += 10; // Two-minute drill magic
    }

    // Bowl game/playoff intensity
    if (this.isBowlGame(gameState) || this.isPlayoffGame(gameState)) {
      bonus += 12; // High-stakes games create comebacks
    }

    // Conference championship implications
    if (this.hasConferenceChampionshipImplications(gameState)) {
      bonus += 8;
    }

    // Onside kick potential
    if (gameState.quarter === 4 && deficit <= 16 && timeSeconds <= 300) {
      bonus += 6; // Onside kick recovery opportunity
    }

    return bonus;
  }

  private getTimeoutAdjustment(gameState: GameState): number {
    // Placeholder - would check actual timeout data if available
    // For now, assume trailing teams in 4th quarter have timeouts available
    if (gameState.quarter === 4) {
      return 1.1; // Slight boost assuming timeout management
    }
    return 1.0;
  }

  private isValidComebackSituation(gameState: GameState): boolean {
    if (gameState.homeScore === undefined || gameState.awayScore === undefined) return false;
    
    const deficit = Math.abs(gameState.homeScore - gameState.awayScore);
    
    // Must have a meaningful deficit (3+ points) but not insurmountable (35+ points)
    if (deficit < 3 || deficit > 35) return false;
    
    // Must be in second half for comeback situations
    return (gameState.quarter >= 3);
  }

  private getDeficitInfo(gameState: GameState): { deficit: number; type: string } {
    const deficit = Math.abs(gameState.homeScore - gameState.awayScore);
    
    let type: string;
    if (deficit <= 3) type = 'Field Goal';
    else if (deficit <= 7) type = 'Touchdown';
    else if (deficit <= 8) type = 'Touchdown + XP';
    else if (deficit <= 14) type = 'Two Touchdowns';
    else if (deficit <= 17) type = 'Two TDs + FG';
    else if (deficit <= 21) type = 'Three Touchdowns';
    else type = 'Multiple Scores';
    
    return { deficit, type };
  }

  private getTrailingTeam(gameState: GameState): string {
    return gameState.homeScore < gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
  }

  private getLeadingTeam(gameState: GameState): string {
    return gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
  }

  private getComebackFactors(gameState: GameState): string[] {
    const factors: string[] = [];
    
    const deficitInfo = this.getDeficitInfo(gameState);
    factors.push(`${deficitInfo.type} deficit`);
    
    if (gameState.quarter === 4) {
      const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
      if (timeSeconds <= 120) factors.push('Two-minute drill');
      else if (timeSeconds <= 300) factors.push('Final 5 minutes');
      else factors.push('Fourth quarter');
    } else if (gameState.quarter === 3) {
      factors.push('Second half momentum');
    }
    
    if (this.isRivalryGame(gameState)) factors.push('Rivalry game magic');
    if (this.isBowlGame(gameState)) factors.push('Bowl game intensity');
    
    const conference = this.determineConference(this.getTrailingTeam(gameState));
    if ((this.CONFERENCE_COMEBACK_FACTORS[conference as keyof typeof this.CONFERENCE_COMEBACK_FACTORS] || 1.0) >= 1.2) {
      factors.push(`${conference} offensive firepower`);
    }
    
    const momentumLevel = this.getMomentumLevel(gameState);
    if (momentumLevel === 'STRONG_POSITIVE') {
      factors.push('Strong momentum');
    } else if (momentumLevel === 'MODERATE_POSITIVE') {
      factors.push('Building momentum');
    }
    
    return factors;
  }

  private getSituationDescription(gameState: GameState): string {
    const deficitInfo = this.getDeficitInfo(gameState);
    const quarter = gameState.quarter;
    const time = gameState.timeRemaining;
    const trailingScore = Math.min(gameState.homeScore, gameState.awayScore);
    const leadingScore = Math.max(gameState.homeScore, gameState.awayScore);
    
    let description = `trails ${leadingScore}-${trailingScore}`;
    
    if (quarter && time) {
      description += ` in Q${quarter} (${time})`;
    }
    
    return description;
  }

  private calculateAlertPriority(comebackProbability: number, deficitInfo: any, gameState: GameState): number {
    let priority = 80; // Base priority
    
    // Probability-based priority
    if (comebackProbability >= 85) priority = 95;
    else if (comebackProbability >= 80) priority = 92;
    else if (comebackProbability >= 75) priority = 90;
    else if (comebackProbability >= 70) priority = 88;
    else priority = 85;
    
    // Time pressure bonuses
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    if (gameState.quarter === 4 && timeSeconds <= 120) priority = Math.min(priority + 3, 98);
    else if (gameState.quarter === 4 && timeSeconds <= 300) priority = Math.min(priority + 2, 98);
    
    // Deficit type bonuses
    if (deficitInfo.deficit <= 8) priority = Math.min(priority + 2, 98); // One-score game
    
    // Special situation bonuses
    if (this.isRivalryGame(gameState)) priority = Math.min(priority + 2, 98);
    if (this.isBowlGame(gameState) || this.isPlayoffGame(gameState)) priority = Math.min(priority + 3, 98);
    
    return priority;
  }

  private getConfidenceLevel(probability: number): string {
    if (probability >= 80) return 'High';
    if (probability >= 70) return 'Good';
    if (probability >= 60) return 'Moderate';
    return 'Low';
  }

  private getMomentumLevel(gameState: GameState): string {
    // Simplified momentum detection - would use more sophisticated analysis in production
    if (gameState.momentum) return gameState.momentum;
    
    // Basic momentum inference from recent scoring
    const trailingTeam = this.getTrailingTeam(gameState);
    const recentScoring = gameState.recentScoring;
    
    if (recentScoring && recentScoring[trailingTeam] >= 14) return 'STRONG_POSITIVE';
    if (recentScoring && recentScoring[trailingTeam] >= 7) return 'MODERATE_POSITIVE';
    
    return 'NEUTRAL';
  }

  private getTimePressureLevel(gameState: GameState): string {
    if (!gameState.quarter || !gameState.timeRemaining) return 'Normal';
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    if (gameState.quarter === 4) {
      if (timeSeconds <= 60) return 'Critical';
      if (timeSeconds <= 120) return 'High';  
      if (timeSeconds <= 300) return 'Elevated';
      return 'Moderate';
    } else if (gameState.quarter === 3) {
      return 'Second Half';
    }
    
    return 'Normal';
  }

  private getConferenceContext(gameState: GameState): any {
    const trailingTeam = this.getTrailingTeam(gameState);
    const conference = this.determineConference(trailingTeam);
    const comebackFactor = this.CONFERENCE_COMEBACK_FACTORS[conference as keyof typeof this.CONFERENCE_COMEBACK_FACTORS] || 1.0;
    
    return {
      conference,
      comebackFactor,
      offensiveReputation: comebackFactor >= 1.2 ? 'High-Powered' : comebackFactor >= 1.1 ? 'Above Average' : 'Average'
    };
  }

  private getOffensiveCapability(gameState: GameState, team: string): any {
    const conference = this.determineConference(team);
    const multiplier = this.CONFERENCE_COMEBACK_FACTORS[conference as keyof typeof this.CONFERENCE_COMEBACK_FACTORS] || 1.0;
    
    return {
      conference,
      scoringAbility: multiplier >= 1.25 ? 'Elite' : multiplier >= 1.15 ? 'Strong' : 'Good',
      comebackHistory: multiplier >= 1.2 ? 'Excellent' : 'Average'
    };
  }

  private getGameImportance(gameState: GameState): string {
    if (this.isPlayoffGame(gameState)) return 'College Football Playoff';
    if (this.isBowlGame(gameState)) return 'Bowl Game';
    if (this.hasConferenceChampionshipImplications(gameState)) return 'Conference Championship Stakes';
    if (this.isRivalryGame(gameState)) return 'Rivalry Game';
    return 'Regular Season';
  }

  private getTimeoutsSituation(gameState: GameState): any {
    // Placeholder - would use actual timeout data if available
    return {
      trailingTeamTimeouts: 'Unknown',
      clockManagement: gameState.quarter === 4 ? 'Critical' : 'Normal'
    };
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

  private createDynamicMessage(gameState: GameState, deficitInfo: any, comebackProbability: number): string {
    const deficit = deficitInfo.deficit;
    const timeStr = gameState.timeRemaining;
    const quarter = gameState.quarter;
    const trailingTeam = this.getTrailingTeam(gameState);
    
    // Format time display
    const timeDisplay = timeStr === '0:00' ? 'Final seconds' : timeStr;
    
    // Create descriptive message based on situation
    if (quarter === 4) {
      if (comebackProbability >= 80) {
        return `${deficit}-pt deficit, ${timeDisplay} left Q${quarter} - High comeback probability`;
      } else if (comebackProbability >= 65) {
        return `${deficit}-pt deficit, ${timeDisplay} left Q${quarter} - Strong comeback chance`;
      } else {
        return `${deficit}-pt deficit, ${timeDisplay} left Q${quarter} - Comeback opportunity`;
      }
    } else if (quarter === 3) {
      return `${trailingTeam} trails by ${deficit}, Q${quarter} - Comeback building`;
    } else {
      return `${trailingTeam} trails by ${deficit} in Q${quarter} - Early comeback potential`;
    }
  }
}