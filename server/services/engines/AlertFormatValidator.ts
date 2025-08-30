
/**
 * LAW #7 COMPLIANCE VALIDATOR
 * 
 * Ensures ALL alerts follow the exact same format:
 * - Title: [EMOJI] [ALERT TYPE] ([SCORE]) - NO team names, NO duplicate info
 * - Description: 3 lines max, no duplicate information
 * 
 * VIOLATION OF LAW #7 REQUIRES REFUNDING DEVELOPMENT COSTS
 */

export interface AlertFormat {
  title: string;
  description: string;
  sport: string;
  alertType: string;
  score: { home: number; away: number };
}

export class AlertFormatValidator {
  
  /**
   * Validate that an alert follows Law #7 format exactly
   */
  static validateAlertFormat(alert: AlertFormat): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Title validation
    const titleViolations = this.validateTitle(alert.title, alert.score);
    violations.push(...titleViolations);

    // Description validation  
    const descriptionViolations = this.validateDescription(alert.description);
    violations.push(...descriptionViolations);

    // Cross-validation (no duplicate info between title and description)
    const crossViolations = this.validateNoDuplicateInfo(alert.title, alert.description);
    violations.push(...crossViolations);

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Validate title follows format: [EMOJI] [ALERT TYPE] ([SCORE])
   */
  private static validateTitle(title: string, score: { home: number; away: number }): string[] {
    const violations: string[] = [];
    
    // Must contain score in parentheses
    const scorePattern = /\(\d+-\d+\)/;
    if (!scorePattern.test(title)) {
      violations.push('Title missing score in format (X-X)');
    }

    // Must NOT contain team names
    if (this.containsTeamNames(title)) {
      violations.push('Title contains team names (not allowed)');
    }

    // Must start with emoji
    if (!/^[🏈🏀🏒⚾🚨🔥💥⚡⏰🛡️]/.test(title)) {
      violations.push('Title must start with relevant emoji');
    }

    // Must be under 30 characters
    if (title.length > 30) {
      violations.push('Title too long (max 30 chars)');
    }

    return violations;
  }

  /**
   * Validate description follows 3-line format with no duplicate info
   */
  private static validateDescription(description: string): string[] {
    const violations: string[] = [];
    
    const lines = description.split('\n').filter(line => line.trim());
    
    // Must be exactly 3 lines
    if (lines.length !== 3) {
      violations.push(`Description must be exactly 3 lines (found ${lines.length})`);
    }

    // Each line must be under 50 characters
    lines.forEach((line, index) => {
      if (line.length > 50) {
        violations.push(`Line ${index + 1} too long (max 50 chars): "${line}"`);
      }
    });

    return violations;
  }

  /**
   * Ensure no information is duplicated between title and description
   */
  private static validateNoDuplicateInfo(title: string, description: string): string[] {
    const violations: string[] = [];
    
    // Score should only appear in title
    const scoreInDescription = /\d+-\d+/.test(description);
    if (scoreInDescription) {
      violations.push('Score appears in description (should only be in title)');
    }

    return violations;
  }

  /**
   * Check if text contains team names (basic heuristic)
   */
  private static containsTeamNames(text: string): boolean {
    // Common team name patterns
    const teamPatterns = [
      /vs\s+\w+/, // "vs TeamName"
      /@\s+\w+/,  // "@ TeamName"  
      /\w+\s+(vs|@)\s+\w+/, // "Team1 vs Team2"
      /\b(Lakers|Celtics|Yankees|Red Sox|Cowboys|Patriots)\b/i // Common team names
    ];
    
    return teamPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Generate compliant alert format from game data
   */
  static generateCompliantAlert(sport: string, alertType: string, gameState: any): AlertFormat {
    const score = {
      home: gameState.homeScore || gameState.score?.home || 0,
      away: gameState.awayScore || gameState.score?.away || 0
    };

    return {
      title: this.generateStandardTitle(sport, alertType, score),
      description: this.generateStandardDescription(sport, alertType, gameState),
      sport,
      alertType,
      score
    };
  }

  /**
   * Generate standard title format for any sport
   */
  private static generateStandardTitle(sport: string, alertType: string, score: { home: number; away: number }): string {
    const scoreText = `${score.away}-${score.home}`;
    const emoji = this.getSportEmoji(sport);

    switch (alertType) {
      case 'redZone':
        return `🚨 RED ZONE (${scoreText})`;
      case 'fourthDown':
        return `💥 4TH DOWN (${scoreText})`;
      case 'closeGame':
        const pointDiff = Math.abs(score.home - score.away);
        return `🔥 ${pointDiff}-POINT GAME (${scoreText})`;
      case 'overtime':
        return `⚡ OVERTIME (${scoreText})`;
      case 'powerPlay':
        return `⚡ POWER PLAY (${scoreText})`;
      case 'risp':
        return `⚾ SCORING CHANCE (${scoreText})`;
      case 'basesLoaded':
        return `🏟️ BASES LOADED (${scoreText})`;
      default:
        return `${emoji} GAME ALERT (${scoreText})`;
    }
  }

  /**
   * Generate standard description format for any sport
   */
  private static generateStandardDescription(sport: string, alertType: string, gameState: any): string {
    const timePeriod = this.getTimePeriod(sport, gameState);
    const situation = this.getSituation(sport, gameState);
    const impact = this.getImpact(alertType);

    return `${timePeriod}
${situation}
${impact}`;
  }

  private static getSportEmoji(sport: string): string {
    switch (sport) {
      case 'NFL':
      case 'NCAAF':
      case 'CFL':
        return '🏈';
      case 'NBA':
        return '🏀';
      case 'NHL':
        return '🏒';
      case 'MLB':
        return '⚾';
      default:
        return '🏆';
    }
  }

  private static getTimePeriod(sport: string, gameState: any): string {
    if (sport === 'MLB') {
      const suffix = this.getOrdinalSuffix(gameState.inning || 1);
      return `${gameState.inning || 1}${suffix} ${gameState.inningState || 'top'}, ${gameState.outs || 0} outs`;
    } else {
      // Football/Basketball/Hockey
      const period = this.getPeriodName(sport, gameState.quarter || gameState.period || 1);
      const timeLeft = this.formatTime(gameState.timeRemaining || 0);
      return `${period} ${timeLeft}`;
    }
  }

  private static getSituation(sport: string, gameState: any): string {
    if (sport === 'MLB') {
      const runners: string[] = [];
      if (gameState.runners?.first) runners.push('1st');
      if (gameState.runners?.second) runners.push('2nd');
      if (gameState.runners?.third) runners.push('3rd');
      return runners.length ? `Runners on ${runners.join(' & ')}` : 'Bases empty';
    } else {
      // Football
      return `${gameState.down || 1}${this.getOrdinalSuffix(gameState.down || 1)} & ${gameState.distance || 10}, ${gameState.yardsToGoal || 50}yd line`;
    }
  }

  private static getImpact(alertType: string): string {
    switch (alertType) {
      case 'redZone':
        return 'High scoring probability';
      case 'fourthDown':
        return 'Convert or lose possession';
      case 'closeGame':
        return 'Every point matters now';
      case 'overtime':
        return 'Sudden death situation';
      case 'risp':
        return 'Run scoring opportunity';
      case 'basesLoaded':
        return 'Maximum scoring potential';
      default:
        return 'Critical moment developing';
    }
  }

  private static getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  private static getPeriodName(sport: string, period: number): string {
    if (sport === 'NBA' || sport === 'WNBA') {
      return period <= 4 ? `${period}${this.getOrdinalSuffix(period)} Quarter` : 'OT';
    } else if (sport === 'NHL') {
      return period <= 3 ? `${period}${this.getOrdinalSuffix(period)} Period` : 'OT';
    } else {
      // Football
      return period <= 4 ? `${period}${this.getOrdinalSuffix(period)} Quarter` : 'OT';
    }
  }

  private static formatTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `(${minutes}:${remainingSeconds.toString().padStart(2, '0')} left)` : `(${remainingSeconds}s left)`;
  }
}
