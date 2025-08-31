
// AlertFormatValidator.ts - Enforces Laws #6 and #7
export interface StandardAlertFormat {
  id: string;
  type: string;
  sport: string;
  title: string;        // Format: "[EMOJI] [ALERT_TYPE] ([SCORE])"
  description: string;  // Max 3 lines, no duplicate info
  gameInfo: {
    homeTeam: string;
    awayTeam: string;
    score: { home: number; away: number };
    status: string;
    situation: string;
  };
  priority: number;
  timestamp: Date;
}

export class AlertFormatValidator {
  /**
   * LAW #7: Generate compliant title format
   * Format: "[EMOJI] [ALERT_TYPE] ([SCORE])"
   * NO team names, NO duplicate info
   */
  static generateStandardTitle(sport: string, alertType: string, score: { home: number; away: number }): string {
    const emoji = this.getAlertEmoji(alertType);
    const scoreText = `${score.away}-${score.home}`;
    return `${emoji} ${alertType.toUpperCase()} (${scoreText})`;
  }

  /**
   * LAW #7: Generate compliant description format
   * 3 lines max:
   * Line 1: Time/Period info
   * Line 2: Game situation  
   * Line 3: Why it matters
   */
  static generateStandardDescription(sport: string, alertType: string, gameState: any): string {
    const lines: string[] = [];
    
    // Line 1: Time/Period info
    if (sport === 'MLB') {
      const inning = gameState.inning || 1;
      const state = gameState.inningState || 'top';
      lines.push(`${state.charAt(0).toUpperCase() + state.slice(1)} ${inning}${this.getOrdinalSuffix(inning)}`);
    } else if (sport === 'NCAAF' || sport === 'NFL') {
      const quarter = gameState.quarter || 1;
      lines.push(`Q${quarter} - ${gameState.timeRemaining || '15:00'}`);
    }

    // Line 2: Game situation
    if (sport === 'MLB') {
      const runners = this.formatRunners(gameState.runners);
      const outs = gameState.outs || 0;
      lines.push(`${runners} • ${outs} outs`);
    } else if (sport === 'NCAAF' || sport === 'NFL') {
      const down = gameState.down || 1;
      const distance = gameState.distance || 10;
      lines.push(`${down}${this.getOrdinalSuffix(down)} & ${distance}`);
    }

    // Line 3: Why it matters (betting context)
    lines.push(this.getActionableBettingContext(sport, alertType, gameState));

    return lines.join('\n');
  }

  private static getAlertEmoji(alertType: string): string {
    const emojiMap: Record<string, string> = {
      'RISP': '🔥',
      'SCORING': '⚡',
      'REDZONE': '🎯',
      'CLUTCHTIME': '⏰',
      'HOMERUN': '💥',
      'LATEINNING': '🚨'
    };
    return emojiMap[alertType.toUpperCase()] || '⚠️';
  }

  private static formatRunners(runners: any): string {
    if (!runners) return 'No runners';
    const bases = [];
    if (runners.first) bases.push('1st');
    if (runners.second) bases.push('2nd'); 
    if (runners.third) bases.push('3rd');
    return bases.length ? `Runners on ${bases.join(' & ')}` : 'No runners';
  }

  private static getActionableBettingContext(sport: string, alertType: string, gameState: any): string {
    if (sport === 'MLB') {
      if (alertType === 'RISP') return 'Live bet Over - high scoring probability';
      if (alertType === 'SCORING') return 'Consider team total Over';
    }
    if (sport === 'NCAAF' && alertType === 'REDZONE') {
      return 'Live bet touchdown props';
    }
    return 'Monitor for betting opportunities';
  }

  private static getOrdinalSuffix(num: number): string {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return suffix[(v - 20) % 10] || suffix[v] || suffix[0];
  }

  /**
   * LAW #6: Validate alert has all required fields
   */
  static validateStructure(alert: any): string[] {
    const violations: string[] = [];
    const required = ['id', 'type', 'sport', 'title', 'description', 'gameInfo', 'priority'];
    
    for (const field of required) {
      if (!alert[field]) violations.push(`Missing required field: ${field}`);
    }

    if (alert.gameInfo) {
      const gameInfoRequired = ['homeTeam', 'awayTeam', 'score', 'status'];
      for (const field of gameInfoRequired) {
        if (!alert.gameInfo[field]) violations.push(`Missing gameInfo.${field}`);
      }
    }

    return violations;
  }

  /**
   * LAW #7: Validate no duplicate information
   */
  static validateNoDuplicates(alert: any): string[] {
    const violations: string[] = [];
    
    // Score should only be in title
    if (alert.description && /\d+-\d+/.test(alert.description)) {
      violations.push('VIOLATION: Score appears in description (should only be in title)');
    }

    // Team names should not be in title or description
    if (this.containsTeamNames(alert.title)) {
      violations.push('VIOLATION: Team names in title (should only be in gameInfo)');
    }
    if (this.containsTeamNames(alert.description)) {
      violations.push('VIOLATION: Team names in description (should only be in gameInfo)');
    }

    return violations;
  }

  private static containsTeamNames(text: string): boolean {
    // Check for @ symbol or vs pattern
    return /@|vs\s|\w+\s+(vs|@)\s+\w+/i.test(text);
  }

  /**
   * Complete validation - Laws #6 and #7
   */
  static validateCompliance(alert: any): { isValid: boolean; violations: string[] } {
    const violations = [
      ...this.validateStructure(alert),
      ...this.validateNoDuplicates(alert)
    ];
    
    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
