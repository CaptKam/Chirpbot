/**
 * Clean Alert Formatter
 * Transforms verbose alert messages into concise, scannable formats
 * Structure: [Sport Icon] | [Key Data] | [Action]
 * Maximum 15 words per line, essential data only
 */

export interface CleanAlertInput {
  type: string;
  sport: string;
  context?: any;
  timing?: {
    whyNow?: string;
    urgencyLevel?: string;
  };
  action?: {
    primaryAction?: string;
    confidence?: number;
  };
  insight?: {
    keyFactor?: string;
  };
  riskReward?: {
    probability?: number;
  };
  gameState?: any;
  message?: string;
  headline?: string;
}

export interface CleanAlertOutput {
  primary: string;      // Main formatted message
  secondary?: string;   // Optional action line
  icon: string;        // Sport or action icon
  confidence?: number; // Confidence percentage if available
}

export class CleanAlertFormatter {
  private readonly sportIcons: Record<string, string> = {
    MLB: '⚾',
    NFL: '🏈',
    NBA: '🏀',
    WNBA: '🏀',
    NCAAF: '🏈',
    CFL: '🍁'
  };

  private readonly actionIcons: Record<string, string> = {
    OVER: '📈',
    UNDER: '📉',
    BET: '💡',
    WATCH: '👀',
    ALERT: '🔔',
    HOT: '🔥',
    COLD: '❄️'
  };

  /**
   * Main formatter entry point
   */
  format(alert: CleanAlertInput): CleanAlertOutput {
    const sport = alert.sport?.toUpperCase() || 'GAME';
    const type = alert.type || '';
    
    // Route to sport-specific formatter
    switch (sport) {
      case 'MLB':
        return this.formatMLB(alert);
      case 'NFL':
        return this.formatNFL(alert);
      case 'NBA':
        return this.formatNBA(alert);
      case 'WNBA':
        return this.formatWNBA(alert);
      case 'NCAAF':
        return this.formatNCAAF(alert);
      case 'CFL':
        return this.formatCFL(alert);
      default:
        return this.formatGeneric(alert);
    }
  }

  /**
   * MLB Alert Formatter
   */
  private formatMLB(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // Extract key MLB data
    const outs = gameState.outs || 0;
    const inning = gameState.inning || 0;
    const inningHalf = gameState.isTopInning ? 'T' : 'B';
    const runners = this.getMLBRunners(gameState);
    const scoringProb = this.extractPercentage(alert);

    // Format based on alert type
    if (type.includes('BASES_LOADED')) {
      return {
        primary: `⚾ Bases Loaded | ${outs} out | ${scoringProb}% scoring`,
        secondary: scoringProb > 80 ? '📈 OVER 0.5 runs' : undefined,
        icon: '⚾',
        confidence: scoringProb
      };
    }
    
    if (type.includes('RUNNER_ON_THIRD')) {
      return {
        primary: `⚾ Runner 3rd | ${outs} out | ${scoringProb}% score`,
        secondary: outs === 0 ? '💡 Next run YES' : undefined,
        icon: '⚾',
        confidence: scoringProb
      };
    }
    
    if (type.includes('FIRST_AND_SECOND')) {
      return {
        primary: `⚾ 1st/2nd | ${outs} out | ${scoringProb}% score`,
        icon: '⚾',
        confidence: scoringProb
      };
    }
    
    if (type.includes('SCORING_OPPORTUNITY')) {
      return {
        primary: `⚾ ${runners} | ${inningHalf}${inning} | ${scoringProb}%`,
        icon: '⚾',
        confidence: scoringProb
      };
    }
    
    if (type.includes('SEVENTH_INNING')) {
      return {
        primary: `⚾ 7th Stretch | Bullpen time`,
        secondary: '👀 Watch totals',
        icon: '⚾'
      };
    }
    
    if (type.includes('LATE_INNING_CLOSE')) {
      const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
      return {
        primary: `⚾ ${inningHalf}${inning} | ${scoreDiff} run game`,
        secondary: '🔥 High leverage',
        icon: '⚾'
      };
    }
    
    if (type.includes('PITCHING_CHANGE')) {
      return {
        primary: `⚾ New pitcher | ${inningHalf}${inning}`,
        icon: '⚾'
      };
    }
    
    if (type.includes('ON_DECK')) {
      const batter = gameState.onDeckBatter || 'Next';
      return {
        primary: `⚾ On deck: ${this.truncateName(batter)}`,
        icon: '⚾'
      };
    }
    
    // Default MLB format
    return {
      primary: `⚾ ${this.cleanAlertType(type)} | ${inningHalf}${inning}`,
      icon: '⚾',
      confidence
    };
  }

  /**
   * NFL Alert Formatter
   */
  private formatNFL(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // Extract key NFL data
    const quarter = gameState.quarter || 'Q?';
    const timeRemaining = gameState.timeRemaining || '';
    const down = gameState.down || 0;
    const yardsToGo = gameState.yardsToGo || 0;
    const fieldPosition = gameState.fieldPosition || 50;
    
    // Format based on alert type
    if (type.includes('RED_ZONE')) {
      const yardsToGoal = 20 - Math.abs(100 - fieldPosition);
      return {
        primary: `🏈 Red Zone | ${yardsToGoal} yds | ${confidence}% TD`,
        secondary: yardsToGoal <= 5 ? '💡 TD scorer props' : undefined,
        icon: '🏈',
        confidence
      };
    }
    
    if (type.includes('TWO_MINUTE_WARNING')) {
      return {
        primary: `🏈 2-min warning | Q${quarter}`,
        secondary: '📈 Pace increases',
        icon: '🏈'
      };
    }
    
    if (type.includes('FOURTH_DOWN')) {
      return {
        primary: `🏈 4th & ${yardsToGo} | ${fieldPosition} yd line`,
        secondary: fieldPosition <= 40 ? '🎯 Go for it zone' : undefined,
        icon: '🏈'
      };
    }
    
    if (type.includes('TURNOVER_LIKELIHOOD')) {
      return {
        primary: `🏈 Turnover risk | ${confidence}%`,
        icon: '🏈',
        confidence
      };
    }
    
    if (type.includes('GAME_START')) {
      return {
        primary: `🏈 Kickoff | Game starting`,
        icon: '🏈'
      };
    }
    
    if (type.includes('SECOND_HALF')) {
      return {
        primary: `🏈 2nd half kickoff`,
        icon: '🏈'
      };
    }
    
    if (type.includes('MASSIVE_WEATHER')) {
      const windSpeed = gameState.weatherContext?.windSpeed || gameState.windSpeed || 0;
      return {
        primary: `🏈 Weather alert | ${windSpeed}+ mph`,
        secondary: '📉 Consider UNDER',
        icon: '🌪️'
      };
    }
    
    // Default NFL format
    return {
      primary: `🏈 ${this.cleanAlertType(type)} | Q${quarter} ${timeRemaining}`,
      icon: '🏈',
      confidence
    };
  }

  /**
   * NBA Alert Formatter
   */
  private formatNBA(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // Extract key NBA data
    const quarter = gameState.quarter || 0;
    const timeRemaining = gameState.timeRemaining || '';
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const fouls = gameState.fouls || { home: 0, away: 0 };
    
    // Format based on alert type
    if (type.includes('FINAL_MINUTES')) {
      return {
        primary: `🏀 Final mins | ${scoreDiff} pt game`,
        secondary: scoreDiff <= 5 ? '🔥 Clutch time' : undefined,
        icon: '🏀'
      };
    }
    
    if (type.includes('TWO_MINUTE_WARNING')) {
      return {
        primary: `🏀 2 mins Q${quarter} | ${scoreDiff} pts`,
        icon: '🏀'
      };
    }
    
    if (type.includes('CLUTCH_PERFORMANCE')) {
      return {
        primary: `🏀 Clutch time | ${scoreDiff} pt margin`,
        secondary: '💡 Star player props',
        icon: '🏀',
        confidence
      };
    }
    
    if (type.includes('FOURTH_QUARTER')) {
      return {
        primary: `🏀 Q4 start | ${scoreDiff} pt lead`,
        icon: '🏀'
      };
    }
    
    if (type.includes('OVERTIME')) {
      return {
        primary: `🏀 OVERTIME | Tied game`,
        secondary: '📈 OVER likely',
        icon: '🏀'
      };
    }
    
    if (type.includes('SUPERSTAR_ANALYTICS')) {
      const player = gameState.starPlayers?.[0]?.name || 'Star';
      return {
        primary: `🏀 ${this.truncateName(player)} hot`,
        secondary: '💡 Player props',
        icon: '⭐'
      };
    }
    
    // Default NBA format
    return {
      primary: `🏀 ${this.cleanAlertType(type)} | Q${quarter}`,
      icon: '🏀',
      confidence
    };
  }

  /**
   * WNBA Alert Formatter
   */
  private formatWNBA(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // Extract key WNBA data (similar to NBA)
    const quarter = gameState.quarter || 0;
    const timeRemaining = gameState.timeRemaining || '';
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    
    // Format based on alert type
    if (type.includes('FINAL_MINUTES')) {
      return {
        primary: `🏀 Final mins | ${scoreDiff} pt game`,
        icon: '🏀'
      };
    }
    
    if (type.includes('CLUTCH_TIME')) {
      return {
        primary: `🏀 Clutch | ${scoreDiff} pts | Q${quarter}`,
        icon: '🏀',
        confidence
      };
    }
    
    if (type.includes('HIGH_SCORING_QUARTER')) {
      const pts = gameState.quarterPoints || 0;
      return {
        primary: `🏀 High scoring Q${quarter} | ${pts} pts`,
        secondary: '📈 OVER trending',
        icon: '🏀'
      };
    }
    
    if (type.includes('LOW_SCORING_QUARTER')) {
      const pts = gameState.quarterPoints || 0;
      return {
        primary: `🏀 Low scoring Q${quarter} | ${pts} pts`,
        secondary: '📉 UNDER trending',
        icon: '🏀'
      };
    }
    
    if (type.includes('CHAMPIONSHIP')) {
      return {
        primary: `🏀 Playoff implications`,
        icon: '🏆'
      };
    }
    
    // Default WNBA format
    return {
      primary: `🏀 ${this.cleanAlertType(type)} | Q${quarter}`,
      icon: '🏀',
      confidence
    };
  }

  /**
   * NCAAF Alert Formatter
   */
  private formatNCAAF(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // Similar to NFL but with college-specific alerts
    const quarter = gameState.quarter || 'Q?';
    const timeRemaining = gameState.timeRemaining || '';
    const down = gameState.down || 0;
    const yardsToGo = gameState.yardsToGo || 0;
    
    if (type.includes('UPSET_OPPORTUNITY')) {
      const underdog = gameState.underdog || 'Underdog';
      return {
        primary: `🏈 Upset alert | ${this.truncateTeam(underdog)}`,
        secondary: '💡 ML value',
        icon: '🏈'
      };
    }
    
    if (type.includes('FOURTH_DOWN_DECISION')) {
      return {
        primary: `🏈 4th & ${yardsToGo} | Decision`,
        icon: '🏈'
      };
    }
    
    if (type.includes('COMEBACK_POTENTIAL')) {
      const deficit = gameState.deficit || 0;
      return {
        primary: `🏈 Comeback | Down ${deficit}`,
        icon: '🏈',
        confidence
      };
    }
    
    // Use NFL formatter for common alerts
    return this.formatNFL(alert);
  }

  /**
   * CFL Alert Formatter
   */
  private formatCFL(alert: CleanAlertInput): CleanAlertOutput {
    const type = alert.type || '';
    const gameState = alert.gameState || alert.context || {};
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    // CFL-specific formatting
    if (type.includes('ROUGE_OPPORTUNITY')) {
      return {
        primary: `🍁 Rouge chance | 1 pt`,
        icon: '🍁'
      };
    }
    
    if (type.includes('THIRD_DOWN')) {
      const yardsToGo = gameState.yardsToGo || 0;
      return {
        primary: `🍁 3rd & ${yardsToGo} | CFL rules`,
        icon: '🍁'
      };
    }
    
    if (type.includes('GREY_CUP')) {
      return {
        primary: `🍁 Grey Cup implications`,
        icon: '🏆'
      };
    }
    
    // Use NFL formatter for common alerts but with CFL icon
    const nflFormat = this.formatNFL(alert);
    nflFormat.icon = '🍁';
    nflFormat.primary = nflFormat.primary.replace('🏈', '🍁');
    return nflFormat;
  }

  /**
   * Generic formatter for unknown sports
   */
  private formatGeneric(alert: CleanAlertInput): CleanAlertOutput {
    const type = this.cleanAlertType(alert.type || 'ALERT');
    const confidence = alert.action?.confidence || alert.riskReward?.probability || 0;
    
    return {
      primary: `🔔 ${type}`,
      icon: '🔔',
      confidence: confidence > 0 ? confidence : undefined
    };
  }

  // Helper methods
  
  private getMLBRunners(gameState: any): string {
    const hasFirst = gameState.hasFirst || false;
    const hasSecond = gameState.hasSecond || false;
    const hasThird = gameState.hasThird || false;
    
    if (hasFirst && hasSecond && hasThird) return 'Bases loaded';
    if (hasSecond && hasThird) return '2nd/3rd';
    if (hasFirst && hasThird) return '1st/3rd';
    if (hasFirst && hasSecond) return '1st/2nd';
    if (hasThird) return '3rd';
    if (hasSecond) return '2nd';
    if (hasFirst) return '1st';
    return 'Empty';
  }
  
  private extractPercentage(alert: CleanAlertInput): number {
    // Try multiple sources for percentage/probability
    if (alert.riskReward?.probability) return Math.round(alert.riskReward.probability);
    if (alert.action?.confidence) return Math.round(alert.action.confidence);
    if (alert.context?.scoringProbability) return Math.round(alert.context.scoringProbability);
    if (alert.context?.probability) return Math.round(alert.context.probability);
    
    // Try to extract from text
    const text = alert.message || alert.headline || alert.timing?.whyNow || '';
    const match = text.match(/(\d+)%/);
    if (match) return parseInt(match[1]);
    
    return 0;
  }
  
  private cleanAlertType(type: string): string {
    return type
      .replace(/^(MLB|NFL|NBA|WNBA|NCAAF|CFL)_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
      .slice(0, 20); // Limit length
  }
  
  private truncateName(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}. ${parts[parts.length - 1]}`.slice(0, 15);
    }
    return name.slice(0, 15);
  }
  
  private truncateTeam(team: string): string {
    if (!team) return '';
    // Remove common suffixes
    return team
      .replace(/University|College|State|Tech|Institute/gi, '')
      .trim()
      .slice(0, 12);
  }
}

// Export singleton instance for convenience
export const cleanAlertFormatter = new CleanAlertFormatter();

// Export function for direct use
export function formatCleanAlert(alert: CleanAlertInput): CleanAlertOutput {
  return cleanAlertFormatter.format(alert);
}