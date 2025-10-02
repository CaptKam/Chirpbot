import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class RedZoneOpportunityModule extends BaseAlertModule {
  alertType = 'NFL_RED_ZONE_OPPORTUNITY';
  sport = 'NFL';

  private lastSignatureByGame: Map<string, string> = new Map();

  // Historical data for touchdown probability calculations
  private readonly DOWN_DISTANCE_MULTIPLIERS = {
    1: { [0]: 1.4, [1]: 1.3, [2]: 1.2, [3]: 1.1, [4]: 1.0, [5]: 0.95, [6]: 0.9, [7]: 0.85, [8]: 0.8, [9]: 0.75, [10]: 0.7 },
    2: { [0]: 1.3, [1]: 1.2, [2]: 1.1, [3]: 1.0, [4]: 0.95, [5]: 0.9, [6]: 0.85, [7]: 0.8, [8]: 0.75, [9]: 0.7, [10]: 0.65 },
    3: { [0]: 1.2, [1]: 1.1, [2]: 1.0, [3]: 0.95, [4]: 0.9, [5]: 0.85, [6]: 0.8, [7]: 0.75, [8]: 0.7, [9]: 0.65, [10]: 0.6 },
    4: { [0]: 1.0, [1]: 0.9, [2]: 0.85, [3]: 0.8, [4]: 0.75, [5]: 0.7, [6]: 0.65, [7]: 0.6, [8]: 0.55, [9]: 0.5, [10]: 0.45 }
  };

  private readonly FIELD_POSITION_BASE_PROBABILITY = {
    0: 98,   // Goal line (0 yards to goal)
    1: 95,   // 1-yard line
    2: 90,   // 2-yard line
    3: 85,   // 3-yard line
    4: 80,   // 4-yard line
    5: 78,   // 5-yard line
    6: 76,   // 6-yard line
    7: 74,   // 7-yard line
    8: 72,   // 8-yard line
    9: 70,   // 9-yard line
    10: 68,  // 10-yard line
    11: 66,  // 11-yard line
    12: 64,  // 12-yard line
    13: 62,  // 13-yard line
    14: 60,  // 14-yard line
    15: 58,  // 15-yard line
    16: 56,  // 16-yard line
    17: 54,  // 17-yard line
    18: 52,  // 18-yard line
    19: 50,  // 19-yard line
    20: 48,  // 20-yard line
    21: 45,  // 21-yard line
    22: 43,  // 22-yard line
    23: 41,  // 23-yard line
    24: 39,  // 24-yard line
    25: 37,  // 25-yard line
    26: 35,  // 26-yard line
    27: 33,  // 27-yard line
    28: 31,  // 28-yard line
    29: 29,  // 29-yard line
    30: 27   // 30-yard line
  };

  isTriggered(gameState: GameState): boolean {
    const gameId = gameState.gameId;
    
    // Check basic conditions first (includes goal line = 0)
    const meetsBasicConditions = gameState.status === 'live' && 
                                 gameState.fieldPosition !== undefined && 
                                 gameState.fieldPosition !== null &&
                                 (gameState.fieldPosition as number) <= 30 &&
                                 (gameState.fieldPosition as number) >= 0 &&
                                 gameState.down !== undefined &&
                                 (gameState.down as number) <= 3;

    // If not in red zone anymore, clear the signature
    if (!meetsBasicConditions || (gameState.fieldPosition !== undefined && gameState.fieldPosition !== null && (gameState.fieldPosition as number) > 30)) {
      this.lastSignatureByGame.delete(gameId);
      return false;
    }

    if (!meetsBasicConditions) return false;

    // Build current signature
    const currentSignature = this.buildGameSignature(gameState);
    const lastSignature = this.lastSignatureByGame.get(gameId);

    // First time seeing this game in red zone, or signature changed
    if (!lastSignature || lastSignature !== currentSignature) {
      this.lastSignatureByGame.set(gameId, currentSignature);
      return true;
    }

    // Same signature - don't trigger
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const touchdownProbability = this.calculateTouchdownProbability(gameState);
    const confidenceLevel = this.getConfidenceLevel(touchdownProbability);
    const situationDescription = this.getSituationDescription(gameState);
    const possessionTeam = this.getPossessionTeam(gameState);
    
    const dynamicMessage = this.createDynamicMessage(gameState);

    return {
      alertKey: `${gameState.gameId}_red_zone_opportunity_${gameState.down}_${gameState.yardsToGo}_${gameState.fieldPosition}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        possessionTeam,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        touchdownProbability: Math.round(touchdownProbability),
        confidenceLevel,
        situationDescription,
        alertType: 'PREDICTIVE',
        predictionCategory: 'RED_ZONE_SCORING',
        // NFL-specific context for AI enhancement
        nflContext: {
          isRedZone: true,
          isGoalLine: (gameState.fieldPosition as number) <= 5,
          isShortYardage: (gameState.yardsToGo as number) <= 3,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          timePressure: this.getTimePressureLevel(gameState),
          playCalling: this.getPlayCallingTendency(gameState)
        }
      },
      priority: touchdownProbability > 80 ? 95 : touchdownProbability > 70 ? 90 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateTouchdownProbability(gameState);
  }

  private calculateTouchdownProbability(gameState: GameState): number {
    // Check for null/undefined, not truthiness (allows 0 values for goal line)
    if (gameState.fieldPosition == null || gameState.down == null || gameState.yardsToGo == null) return 0;

    // Base probability from field position
    const fieldPosition = Math.min((gameState.fieldPosition as number), 30);
    let baseProbability = this.FIELD_POSITION_BASE_PROBABILITY[fieldPosition as keyof typeof this.FIELD_POSITION_BASE_PROBABILITY] || 25;

    // Down and distance multiplier
    const down = Math.min((gameState.down as number), 4) as keyof typeof this.DOWN_DISTANCE_MULTIPLIERS;
    const yardsToGo = Math.min((gameState.yardsToGo as number), 10);
    const downDistanceMultiplier = this.DOWN_DISTANCE_MULTIPLIERS[down]?.[yardsToGo as keyof typeof this.DOWN_DISTANCE_MULTIPLIERS[1]] || 0.5;
    
    let probability = baseProbability * downDistanceMultiplier;

    // Weather impact adjustments (for outdoor stadiums only)
    if (gameState.weather && (gameState.weather as any).isOutdoorStadium) {
      const weatherImpact = (gameState.weather as any).impact;
      
      // If field goals are difficult due to weather, touchdown attempts become more attractive
      if (weatherImpact.fieldGoalDifficulty === 'extreme') {
        probability += 20; // Significantly favor touchdown attempts over field goals
      } else if (weatherImpact.fieldGoalDifficulty === 'high') {
        probability += 12; // Moderately favor touchdown attempts
      } else if (weatherImpact.fieldGoalDifficulty === 'moderate') {
        probability += 6; // Slightly favor touchdown attempts
      }
      
      // Wind/weather conditions affecting play strategy
      if (weatherImpact.preferredStrategy === 'run-heavy') {
        // Heavy running weather - easier to score rushing touchdowns in red zone
        if ((gameState.fieldPosition as number) <= 10) {
          probability += 8; // Goal line running is very effective
        } else if ((gameState.fieldPosition as number) <= 20) {
          probability += 5; // Red zone running still good
        }
      } else if (weatherImpact.preferredStrategy === 'conservative') {
        // Conservative weather - both passing and kicking affected
        probability += 4; // Slight preference for touchdown attempts
      }
      
      // Extreme weather conditions increase touchdown attempt preference
      if (weatherImpact.weatherAlert) {
        probability += 8; // Weather makes field goals unreliable
        
        // Special case: Very close to goal line in bad weather
        if ((gameState.fieldPosition as number) <= 5 && weatherImpact.passingConditions !== 'dangerous') {
          probability += 5; // Short yardage touchdowns still achievable
        }
      }
      
      // Passing conditions impact on red zone strategy
      if (weatherImpact.passingConditions === 'dangerous' && (gameState.fieldPosition as number) > 10) {
        probability -= 8; // Harder to pass in far red zone
      } else if (weatherImpact.passingConditions === 'poor' && (gameState.fieldPosition as number) > 15) {
        probability -= 4; // Moderate passing difficulty
      }
    }

    // Time pressure adjustments
    const timeAdjustment = this.getTimePressureAdjustment(gameState);
    probability *= timeAdjustment;

    // Score differential impact
    const scoreAdjustment = this.getScoreDifferentialAdjustment(gameState);
    probability *= scoreAdjustment;

    // Goal line situations are special
    if ((gameState.fieldPosition as number) <= 3 && (gameState.down as number) <= 2) {
      probability += 15; // Goal line boost
    }

    // First and goal situations
    if ((gameState.fieldPosition as number) <= 10 && gameState.down === 1) {
      probability += 10; // First and goal boost
    }

    // Short yardage in red zone
    if ((gameState.fieldPosition as number) <= 20 && (gameState.yardsToGo as number) <= 3) {
      probability += 8; // Short yardage boost
    }

    return Math.min(Math.max(probability, 5), 98);
  }

  private getTimePressureAdjustment(gameState: GameState): number {
    if (!gameState.quarter || !gameState.timeRemaining) return 1.0;

    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining as string);
    
    // Fourth quarter urgency
    if (gameState.quarter === 4) {
      if (timeSeconds <= 120) return 1.15; // Two-minute warning
      if (timeSeconds <= 300) return 1.10; // Last 5 minutes
      return 1.05; // Fourth quarter
    }
    
    // Second quarter (end of half)
    if (gameState.quarter === 2 && timeSeconds <= 120) {
      return 1.08; // End of half urgency
    }

    return 1.0; // Normal time
  }

  private getScoreDifferentialAdjustment(gameState: GameState): number {
    if (gameState.homeScore === undefined || gameState.awayScore === undefined) return 1.0;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (scoreDiff <= 3) return 1.10; // Very close game - more aggressive
    if (scoreDiff <= 7) return 1.05; // Close game
    if (scoreDiff <= 14) return 1.0;  // Competitive game
    if (scoreDiff <= 21) return 0.95; // Moderate lead
    return 0.90; // Blowout - less urgency
  }

  private getPossessionTeam(gameState: GameState): string {
    // In a real system, this would be determined from game data
    // For now, we'll use a placeholder approach
    if (gameState.possession) {
      return gameState.possession as string;
    }
    
    // Default assumption based on typical patterns
    const awayTeamName = typeof gameState.awayTeam === 'string' ? gameState.awayTeam : (gameState.awayTeam as any).name || '';
    return awayTeamName; // Default to away team for simplicity
  }

  private getSituationDescription(gameState: GameState): string {
    const down = this.getOrdinal((gameState.down as number) || 1);
    const distance = (gameState.yardsToGo as number) || 10;
    const position = (gameState.fieldPosition as number) || 20;
    
    return `${down} & ${distance} at ${position}-yard line`;
  }

  private getConfidenceLevel(probability: number): string {
    if (probability >= 80) return 'HIGH';
    if (probability >= 65) return 'MEDIUM-HIGH';
    if (probability >= 50) return 'MEDIUM';
    return 'LOW';
  }

  private getOrdinal(num: number): string {
    const ordinals = ['', '1st', '2nd', '3rd', '4th'];
    return ordinals[num] || `${num}th`;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    
    return parseInt(cleanTime) || 0;
  }

  private buildGameSignature(gameState: GameState): string {
    const possessionTeam = this.getPossessionTeam(gameState);
    const quarter = (gameState.quarter as number) || 0;
    const down = (gameState.down as number) || 0;
    const yardsToGo = (gameState.yardsToGo as number) || 0;
    const fieldPosition = (gameState.fieldPosition as number) || 0;
    
    // Field position bucket: group yards into buckets (1-5, 6-10, 11-15, 16-20, 21-25, 26-30)
    const fieldPositionBucket = Math.ceil(fieldPosition / 5) * 5;
    
    // Clock bucket: round time to 30-second intervals to avoid jitter
    const timeSeconds = this.parseTimeToSeconds((gameState.timeRemaining as string) || '0:00');
    const clockBucket = Math.floor(timeSeconds / 30) * 30;
    
    return `${possessionTeam}|Q${quarter}|${down}&${yardsToGo}|${fieldPositionBucket}|${clockBucket}`;
  }
  
  private getTimePressureLevel(gameState: GameState): string {
    if (!gameState.quarter || !gameState.timeRemaining) return 'NORMAL';
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining as string);
    
    if (gameState.quarter === 4) {
      if (timeSeconds <= 120) return 'CRITICAL';  // Two-minute warning
      if (timeSeconds <= 300) return 'HIGH';      // Last 5 minutes
      return 'MEDIUM';
    }
    
    if (gameState.quarter === 2 && timeSeconds <= 120) {
      return 'MEDIUM';  // End of half
    }
    
    return 'NORMAL';
  }
  
  private createDynamicMessage(gameState: GameState): string {
    const touchdownProbability = this.calculateTouchdownProbability(gameState);
    const down = this.getOrdinal((gameState.down as number) || 1);
    const yardsToGo = (gameState.yardsToGo as number) || 10;
    const fieldPosition = (gameState.fieldPosition as number) || 20;
    
    // Create contextual field position description
    let situationDesc = '';
    if (fieldPosition <= 3) {
      situationDesc = `${down} & Goal at ${fieldPosition}-yard line`;
    } else if (fieldPosition <= 10) {
      situationDesc = `${down} & ${yardsToGo} at ${fieldPosition}-yard line`;
    } else {
      situationDesc = `${down} & ${yardsToGo} at ${fieldPosition}-yard line`;
    }

    // Create scoring context based on probability
    let scoringContext = '';
    if (touchdownProbability >= 80) {
      scoringContext = 'Prime scoring opportunity';
    } else if (touchdownProbability >= 65) {
      scoringContext = 'Strong scoring chance';
    } else if (touchdownProbability >= 50) {
      scoringContext = 'Red zone scoring chance';
    } else {
      scoringContext = 'Red zone opportunity';
    }

    // Add goal line context
    if (fieldPosition <= 5) {
      scoringContext = 'Goal line ' + scoringContext.toLowerCase();
    }

    return `${situationDesc} - ${scoringContext}`;
  }

  private getPlayCallingTendency(gameState: GameState): string {
    // Analyze down, distance, and field position to predict play type
    if (gameState.down == null || gameState.yardsToGo == null || gameState.fieldPosition == null) {
      return 'BALANCED';
    }
    
    if ((gameState.fieldPosition as number) <= 3) {
      return 'POWER_RUN';  // Goal line situations favor power running
    }
    
    if (gameState.down === 1 && (gameState.yardsToGo as number) <= 3) {
      return 'RUN_HEAVY';  // Short yardage on first down
    }
    
    if (gameState.down === 3 && (gameState.yardsToGo as number) >= 7) {
      return 'PASS_HEAVY';  // Long third down
    }
    
    if (gameState.down === 2 && (gameState.yardsToGo as number) <= 3) {
      return 'RUN_LIKELY';  // Second and short
    }
    
    return 'BALANCED';
  }
}