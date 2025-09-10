import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TurnoverLikelihoodModule extends BaseAlertModule {
  alertType = 'NFL_TURNOVER_LIKELIHOOD';
  sport = 'NFL';

  // Historical turnover risk factors based on NFL statistics
  private readonly DOWN_DISTANCE_RISK = {
    1: { [1]: 2, [2]: 3, [3]: 4, [4]: 5, [5]: 6, [6]: 7, [7]: 8, [8]: 9, [9]: 10, [10]: 12 },
    2: { [1]: 4, [2]: 5, [3]: 6, [4]: 7, [5]: 8, [6]: 9, [7]: 11, [8]: 13, [9]: 15, [10]: 18 },
    3: { [1]: 8, [2]: 10, [3]: 12, [4]: 15, [5]: 18, [6]: 22, [7]: 26, [8]: 30, [9]: 35, [10]: 40 },
    4: { [1]: 15, [2]: 20, [3]: 25, [4]: 30, [5]: 35, [6]: 40, [7]: 45, [8]: 50, [9]: 55, [10]: 60 }
  };

  private readonly FIELD_POSITION_RISK = {
    // Opponent territory (lower risk, closer to scoring)
    5: 1, 10: 2, 15: 3, 20: 4, 25: 5,
    // Midfield area (moderate risk)
    30: 6, 35: 8, 40: 10, 45: 12, 50: 15,
    // Own territory (higher risk, deeper field position)
    55: 18, 60: 20, 65: 22, 70: 25, 75: 28, 80: 30, 85: 35, 90: 40, 95: 45, 99: 45
  };

  private readonly PRESSURE_SITUATIONS = {
    FOURTH_DOWN_CONVERSION: 35,
    LONG_THIRD_DOWN: 25, // 3rd & 8+
    DEEP_IN_OWN_TERRITORY: 20, // Inside own 20
    TWO_MINUTE_WARNING: 15,
    RED_ZONE_DEFENSE: 18, // Defensive turnover opportunity
    GOAL_LINE_STAND: 22,
    DESPERATION_TIME: 30 // <1 minute left, behind by score
  };

  isTriggered(gameState: GameState): boolean {
    // Only trigger for live games with necessary data
    if (gameState.status !== 'live' || 
        !gameState.down || 
        !gameState.yardsToGo || 
        !gameState.fieldPosition) {
      return false;
    }

    const turnoverRisk = this.calculateTurnoverRisk(gameState);
    return turnoverRisk >= 30; // Trigger when turnover risk is 30% or higher
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const turnoverRisk = this.calculateTurnoverRisk(gameState);
    const riskLevel = this.getRiskLevel(turnoverRisk);
    const riskFactors = this.identifyRiskFactors(gameState);
    const situationDescription = this.getSituationDescription(gameState);
    const possessionTeam = this.getPossessionTeam(gameState);
    const primaryRiskFactor = riskFactors[0] || 'Unknown';

    return {
      alertKey: `${gameState.gameId}_turnover_risk_${gameState.down}_${gameState.yardsToGo}_${gameState.fieldPosition}`,
      type: this.alertType,
      message: `⚠️ ${possessionTeam} Turnover Risk - ${situationDescription} - Risk Level: ${Math.round(turnoverRisk)}%`,
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
        turnoverRisk: Math.round(turnoverRisk),
        riskLevel,
        riskFactors,
        primaryRiskFactor,
        situationDescription,
        alertType: 'PREDICTIVE',
        predictionCategory: 'TURNOVER_RISK'
      },
      priority: turnoverRisk > 50 ? 95 : turnoverRisk > 40 ? 90 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.calculateTurnoverRisk(gameState);
  }

  private calculateTurnoverRisk(gameState: GameState): number {
    if (!gameState.down || !gameState.yardsToGo || !gameState.fieldPosition) return 0;

    let baseRisk = 0;

    // Down and distance risk calculation
    const down = Math.min(gameState.down, 4) as keyof typeof this.DOWN_DISTANCE_RISK;
    const yardsToGo = Math.min(gameState.yardsToGo, 10);
    const downDistanceRisk = this.DOWN_DISTANCE_RISK[down]?.[yardsToGo as keyof typeof this.DOWN_DISTANCE_RISK[1]] || 5;
    baseRisk += downDistanceRisk;

    // Field position risk
    const fieldPositionRisk = this.getFieldPositionRisk(gameState.fieldPosition);
    baseRisk += fieldPositionRisk;

    // Pressure situation multipliers
    const pressureMultiplier = this.calculatePressureMultiplier(gameState);
    baseRisk *= pressureMultiplier;

    // Time pressure adjustments
    const timeRisk = this.getTimePressureRisk(gameState);
    baseRisk += timeRisk;

    // Score differential impact (desperation factor)
    const desperationRisk = this.getDesperationRisk(gameState);
    baseRisk += desperationRisk;

    // Special situations
    const specialSituationRisk = this.getSpecialSituationRisk(gameState);
    baseRisk += specialSituationRisk;

    return Math.min(Math.max(baseRisk, 1), 75); // Cap at 75% maximum risk
  }

  private getFieldPositionRisk(fieldPosition: number): number {
    // Convert to absolute field position (0-99 yard scale)
    const adjustedPosition = Math.min(Math.max(fieldPosition, 1), 99);
    
    // Find closest position in our risk table
    const positions = Object.keys(this.FIELD_POSITION_RISK).map(Number).sort((a, b) => a - b);
    let closestPosition = positions[0];
    
    for (const pos of positions) {
      if (Math.abs(adjustedPosition - pos) < Math.abs(adjustedPosition - closestPosition)) {
        closestPosition = pos;
      }
    }
    
    return this.FIELD_POSITION_RISK[closestPosition as keyof typeof this.FIELD_POSITION_RISK] || 10;
  }

  private calculatePressureMultiplier(gameState: GameState): number {
    let multiplier = 1.0;

    // Fourth down conversion attempts
    if (gameState.down === 4) {
      multiplier += 0.5; // 50% higher risk on 4th down
    }

    // Long third downs (3rd & 8+)
    if (gameState.down === 3 && gameState.yardsToGo >= 8) {
      multiplier += 0.3; // 30% higher risk on long 3rd downs
    }

    // Deep in own territory (inside own 20)
    if (gameState.fieldPosition >= 80) {
      multiplier += 0.25; // 25% higher risk in own territory
    }

    // Goal line situations (increased pressure near goal line)
    if (gameState.fieldPosition <= 10) {
      multiplier += 0.2; // 20% higher risk near goal line
    }

    return multiplier;
  }

  private getTimePressureRisk(gameState: GameState): number {
    if (!gameState.quarter || !gameState.timeRemaining) return 0;

    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    let timeRisk = 0;

    // Fourth quarter pressure
    if (gameState.quarter === 4) {
      if (timeSeconds <= 60) timeRisk += 12; // Final minute
      else if (timeSeconds <= 120) timeRisk += 8; // Two-minute warning
      else if (timeSeconds <= 300) timeRisk += 5; // Last 5 minutes
      else timeRisk += 2; // Fourth quarter
    }

    // End of half pressure (2nd quarter)
    if (gameState.quarter === 2 && timeSeconds <= 120) {
      timeRisk += 6; // End of half urgency
    }

    return timeRisk;
  }

  private getDesperationRisk(gameState: GameState): number {
    if (gameState.homeScore === undefined || gameState.awayScore === undefined) return 0;
    if (!gameState.quarter || !gameState.timeRemaining) return 0;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    // Fourth quarter comeback scenarios
    if (gameState.quarter === 4 && timeSeconds <= 300) { // Last 5 minutes
      if (scoreDiff >= 14) return 10; // Two-touchdown deficit
      if (scoreDiff >= 7) return 6;   // One-touchdown deficit
      if (scoreDiff >= 3) return 3;   // Field goal deficit
    }

    // Final two minutes desperation
    if (gameState.quarter === 4 && timeSeconds <= 120 && scoreDiff > 0) {
      return scoreDiff >= 7 ? 15 : 8; // Higher desperation when behind
    }

    return 0;
  }

  private getSpecialSituationRisk(gameState: GameState): number {
    let specialRisk = 0;

    // Fourth and long situations
    if (gameState.down === 4 && gameState.yardsToGo >= 5) {
      specialRisk += 15; // High risk conversion attempt
    }

    // Third and very long (3rd & 15+)
    if (gameState.down === 3 && gameState.yardsToGo >= 15) {
      specialRisk += 8; // Desperate passing situation
    }

    // Goal line stands (defense has advantage)
    if (gameState.fieldPosition <= 5 && gameState.down >= 3) {
      specialRisk += 10; // Goal line defense opportunity
    }

    return specialRisk;
  }

  private identifyRiskFactors(gameState: GameState): string[] {
    const factors: string[] = [];

    // Down and distance factors
    if (gameState.down === 4) factors.push('Fourth Down Conversion');
    if (gameState.down === 3 && gameState.yardsToGo >= 8) factors.push('Long Third Down');
    if (gameState.yardsToGo >= 15) factors.push('Long Distance');

    // Field position factors
    if (gameState.fieldPosition >= 80) factors.push('Deep Own Territory');
    if (gameState.fieldPosition <= 10) factors.push('Goal Line Pressure');

    // Time factors
    if (gameState.quarter === 4) {
      const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
      if (timeSeconds <= 120) factors.push('Two-Minute Warning');
      if (timeSeconds <= 60) factors.push('Final Minute');
    }

    // Score factors
    if (gameState.homeScore !== undefined && gameState.awayScore !== undefined) {
      const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
      if (scoreDiff >= 7) factors.push('Desperation Situation');
    }

    return factors.length > 0 ? factors : ['Standard Situation'];
  }

  private getRiskLevel(risk: number): string {
    if (risk >= 50) return 'CRITICAL';
    if (risk >= 40) return 'HIGH';
    if (risk >= 30) return 'ELEVATED';
    if (risk >= 20) return 'MODERATE';
    return 'LOW';
  }

  private getPossessionTeam(gameState: GameState): string {
    // Use possession from game data when available and valid
    if (gameState.possession && 
        (gameState.possession === gameState.homeTeam || gameState.possession === gameState.awayTeam)) {
      return gameState.possession;
    }
    
    // If possession is unknown, use generic labeling to avoid mislabeling
    return 'Possessing Team';
  }

  private getSituationDescription(gameState: GameState): string {
    const down = this.getOrdinal(gameState.down || 1);
    const distance = gameState.yardsToGo || 10;
    const position = gameState.fieldPosition || 50;
    
    return `${down} & ${distance} at ${position}-yard line`;
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

  // Comprehensive testing function to validate turnover risk calculations
  validateTurnoverRiskLogic(): { success: boolean; results: any[]; errors: string[] } {
    const results: any[] = [];
    const errors: string[] = [];
    let success = true;

    // Test scenarios: [name, gameState, expectedMinRisk, expectedMaxRisk, shouldTrigger]
    const testScenarios: [string, Partial<GameState>, number, number, boolean][] = [
      // Field position semantics tests
      ['Deep Own Territory (4th & 5)', 
        { down: 4, yardsToGo: 5, fieldPosition: 95, status: 'live', quarter: 4, timeRemaining: '5:00', homeScore: 14, awayScore: 17 }, 
        45, 75, true],
      
      ['Opponent Red Zone (1st & 10)', 
        { down: 1, yardsToGo: 10, fieldPosition: 15, status: 'live', quarter: 2, timeRemaining: '8:30', homeScore: 7, awayScore: 3 }, 
        5, 20, false],
      
      ['Midfield Standard (2nd & 7)', 
        { down: 2, yardsToGo: 7, fieldPosition: 50, status: 'live', quarter: 3, timeRemaining: '12:15', homeScore: 10, awayScore: 10 }, 
        15, 35, false],
      
      // Critical game situations
      ['4th Down Conversion Deep Territory', 
        { down: 4, yardsToGo: 3, fieldPosition: 85, status: 'live', quarter: 4, timeRemaining: '3:45', homeScore: 14, awayScore: 21 }, 
        55, 75, true],
      
      ['Long 3rd Down Own Territory', 
        { down: 3, yardsToGo: 12, fieldPosition: 75, status: 'live', quarter: 4, timeRemaining: '2:00', homeScore: 17, awayScore: 24 }, 
        40, 70, true],
      
      ['Two-Minute Drill Behind', 
        { down: 2, yardsToGo: 8, fieldPosition: 65, status: 'live', quarter: 4, timeRemaining: '1:30', homeScore: 20, awayScore: 27 }, 
        30, 60, true],
      
      ['Goal Line Stand Defense', 
        { down: 3, yardsToGo: 2, fieldPosition: 3, status: 'live', quarter: 4, timeRemaining: '0:45', homeScore: 14, awayScore: 13 }, 
        15, 45, true],
      
      // Edge cases
      ['Invalid Game State', 
        { status: 'scheduled' }, 
        0, 0, false],
      
      ['Missing Field Position', 
        { down: 2, yardsToGo: 6, status: 'live' }, 
        0, 0, false]
    ];

    console.log('\n🧪 NFL TURNOVER_LIKELIHOOD Module Validation Tests');
    console.log('='.repeat(60));

    for (const [name, partialGameState, minRisk, maxRisk, shouldTrigger] of testScenarios) {
      try {
        // Create full game state with defaults
        const gameState: GameState = {
          gameId: 'test-game',
          homeTeam: 'Home',
          awayTeam: 'Away',
          homeScore: 0,
          awayScore: 0,
          status: 'scheduled',
          quarter: 1,
          timeRemaining: '15:00',
          down: undefined,
          yardsToGo: undefined,
          fieldPosition: undefined,
          possession: undefined,
          ...partialGameState
        } as GameState;

        const risk = this.calculateTurnoverRisk(gameState);
        const triggered = this.isTriggered(gameState);
        const alert = this.generateAlert(gameState);

        // Validate field position semantic consistency
        if (gameState.fieldPosition && gameState.fieldPosition >= 80) {
          // Deep in own territory should have higher base risk
          const baseFieldRisk = this.getFieldPositionRisk(gameState.fieldPosition);
          if (baseFieldRisk < 25) {
            errors.push(`${name}: Deep territory (FP=${gameState.fieldPosition}) has low base risk (${baseFieldRisk})`);
            success = false;
          }
        }

        // Validate risk ranges
        if (gameState.status === 'live' && gameState.down && gameState.yardsToGo && gameState.fieldPosition) {
          if (risk < minRisk || risk > maxRisk) {
            errors.push(`${name}: Risk ${risk}% outside expected range [${minRisk}-${maxRisk}%]`);
            success = false;
          }
        }

        // Validate trigger logic
        if (triggered !== shouldTrigger) {
          errors.push(`${name}: Expected trigger=${shouldTrigger}, got trigger=${triggered} (risk=${risk}%)`);
          success = false;
        }

        // Validate alert generation consistency
        if (triggered && !alert) {
          errors.push(`${name}: Triggered but no alert generated`);
          success = false;
        }
        if (!triggered && alert) {
          errors.push(`${name}: Not triggered but alert was generated`);
          success = false;
        }

        results.push({
          scenario: name,
          gameState: {
            down: gameState.down,
            yardsToGo: gameState.yardsToGo,
            fieldPosition: gameState.fieldPosition,
            quarter: gameState.quarter,
            timeRemaining: gameState.timeRemaining
          },
          risk: Math.round(risk * 100) / 100,
          triggered,
          expectedRange: `${minRisk}-${maxRisk}%`,
          possessionTeam: this.getPossessionTeam(gameState),
          riskLevel: risk > 0 ? this.getRiskLevel(risk) : 'N/A'
        });

        console.log(`✅ ${name}: ${risk.toFixed(1)}% risk, triggered=${triggered}, alert=${!!alert}`);

      } catch (error) {
        errors.push(`${name}: Exception - ${error}`);
        success = false;
        console.log(`❌ ${name}: Exception - ${error}`);
      }
    }

    // Test field position risk monotonicity
    console.log('\n🔍 Field Position Risk Consistency Check:');
    const fieldPositions = [5, 20, 35, 50, 65, 80, 95];
    const riskValues = fieldPositions.map(fp => ({ fp, risk: this.getFieldPositionRisk(fp) }));
    
    for (let i = 1; i < riskValues.length; i++) {
      const prev = riskValues[i-1];
      const curr = riskValues[i];
      console.log(`  FP ${curr.fp}: Risk ${curr.risk} (${curr.fp <= 20 ? 'opponent territory' : curr.fp >= 80 ? 'own territory' : 'midfield'})`);
      
      // Risk should generally increase as field position increases (deeper in own territory)
      if (curr.fp >= 60 && prev.fp < 60 && curr.risk < prev.risk) {
        errors.push(`Field position risk regression: FP ${curr.fp} (${curr.risk}) < FP ${prev.fp} (${prev.risk})`);
        success = false;
      }
    }

    console.log('\n📊 Test Summary:');
    console.log(`  Total scenarios: ${testScenarios.length}`);
    console.log(`  Passed: ${testScenarios.length - errors.length}`);
    console.log(`  Failed: ${errors.length}`);
    console.log(`  Overall success: ${success ? '✅' : '❌'}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

    return { success, results, errors };
  }
}