import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class FourthDownModule extends BaseAlertModule {
  alertType = 'NFL_FOURTH_DOWN';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    // Fourth down situations - game must be live and down must be 4
    return gameState.status === 'live' && 
           gameState.down === 4 &&
           gameState.yardsToGo !== undefined &&
           gameState.fieldPosition !== undefined;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const priority = gameState.yardsToGo <= 3 ? 95 : 85; // Higher priority for short yardage
    const fieldPosition = gameState.fieldPosition || 50;
    const yardsToGo = gameState.yardsToGo || 10;
    const dynamicMessage = this.createDynamicMessage(gameState);

    return {
      alertKey: `${gameState.gameId}_fourth_down_${yardsToGo}_${fieldPosition}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        isFourthDown: true,
        // NFL-specific context for AI enhancement
        nflContext: {
          isFourthDown: true,
          isShortYardage: yardsToGo <= 3,
          isInRedZone: fieldPosition <= 20,
          isGoalLine: fieldPosition <= 5,
          scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
          timePressure: this.getTimePressureLevel(gameState),
          conversionProbability: this.getConversionProbability(gameState),
          decisionRecommendation: this.getDecisionRecommendation(gameState)
        }
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 90; // Base high probability for fourth down

    // Higher probability for shorter yardage
    if (gameState.yardsToGo <= 1) probability = 100;
    else if (gameState.yardsToGo <= 3) probability = 95;
    else if (gameState.yardsToGo <= 5) probability = 90;

    // Higher probability in red zone
    if (gameState.fieldPosition <= 20) probability += 5;

    // Higher probability in fourth quarter
    if (gameState.quarter === 4) probability += 5;

    return Math.min(probability, 100);
  }
  
  private getTimePressureLevel(gameState: GameState): string {
    if (!gameState.quarter || !gameState.timeRemaining) return 'NORMAL';
    
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
    
    if (gameState.quarter === 4) {
      if (timeSeconds <= 60) return 'CRITICAL';   // Final minute
      if (timeSeconds <= 120) return 'HIGH';      // Two-minute warning
      if (timeSeconds <= 300) return 'MEDIUM';    // Last 5 minutes
    }
    
    if (gameState.quarter === 2 && timeSeconds <= 120) {
      return 'MEDIUM';  // End of half
    }
    
    return 'NORMAL';
  }
  
  private getConversionProbability(gameState: GameState): number {
    if (!gameState.yardsToGo || !gameState.fieldPosition) return 50;
    
    let probability = 50; // Base conversion rate
    
    // Distance factors
    if (gameState.yardsToGo <= 1) probability = 85;
    else if (gameState.yardsToGo <= 3) probability = 70;
    else if (gameState.yardsToGo <= 5) probability = 55;
    else probability = 35;
    
    // Field position adjustments
    if (gameState.fieldPosition <= 10) probability += 10; // Goal line boost
    else if (gameState.fieldPosition <= 30) probability += 5; // Red zone boost
    
    // Weather impact adjustments (for outdoor stadiums only)
    if (gameState.weather && gameState.weather.isOutdoorStadium) {
      const weatherImpact = gameState.weather.impact;
      
      // Weather affects conversion strategies differently based on distance
      if (gameState.yardsToGo <= 3) {
        // Short yardage - weather favors running
        if (weatherImpact.preferredStrategy === 'run-heavy') {
          probability += 8; // Weather favors short yardage running
        } else if (weatherImpact.passingConditions === 'dangerous') {
          probability += 5; // Must run in bad passing weather
        }
      } else {
        // Longer conversions - weather affects passing
        if (weatherImpact.passingConditions === 'dangerous') {
          probability -= 12; // Hard to convert long yardage in bad weather
        } else if (weatherImpact.passingConditions === 'poor') {
          probability -= 6; // Moderate passing difficulty
        }
      }
      
      // Extreme weather generally favors conservative decisions
      if (weatherImpact.weatherAlert) {
        probability -= 5; // Slightly lower conversion due to conditions
      }
    }
    
    return Math.min(Math.max(probability, 15), 95);
  }
  
  private getDecisionRecommendation(gameState: GameState): string {
    const conversionProb = this.getConversionProbability(gameState);
    const fieldPosition = gameState.fieldPosition || 50;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timePressure = this.getTimePressureLevel(gameState);
    
    // High conversion probability situations
    if (conversionProb >= 75) {
      return 'GO_FOR_IT';
    }
    
    // Critical time situations
    if (timePressure === 'CRITICAL' && scoreDiff <= 7) {
      return fieldPosition <= 40 ? 'GO_FOR_IT' : 'PUNT';
    }
    
    // Field goal range
    if (fieldPosition <= 35 && conversionProb < 60) {
      return 'FIELD_GOAL_ATTEMPT';
    }
    
    // Default recommendations
    if (fieldPosition <= 30) return 'GO_FOR_IT';
    if (fieldPosition >= 60) return 'PUNT';
    
    return conversionProb >= 50 ? 'GO_FOR_IT' : 'PUNT';
  }
  
  private createDynamicMessage(gameState: GameState): string {
    const yardsToGo = gameState.yardsToGo || 10;
    const fieldPosition = gameState.fieldPosition || 50;
    const recommendation = this.getDecisionRecommendation(gameState);
    const conversionProb = this.getConversionProbability(gameState);
    
    // Create contextual field position description
    let positionDesc = '';
    if (fieldPosition <= 5) {
      positionDesc = `at ${fieldPosition}-yard line`;
    } else if (fieldPosition <= 20) {
      positionDesc = `at ${fieldPosition}-yard line (Red Zone)`;
    } else if (fieldPosition <= 35) {
      positionDesc = `at ${fieldPosition}-yard line (FG Range)`;
    } else if (fieldPosition >= 80) {
      positionDesc = `at own ${100 - fieldPosition}-yard line`;
    } else {
      positionDesc = `at ${fieldPosition}-yard line`;
    }

    // Create decision context
    let decisionContext = '';
    switch (recommendation) {
      case 'GO_FOR_IT':
        decisionContext = conversionProb >= 75 ? 'High conversion chance' : 'Critical decision';
        break;
      case 'FIELD_GOAL_ATTEMPT':
        decisionContext = 'FG attempt likely';
        break;
      case 'PUNT':
        decisionContext = 'Punt situation';
        break;
      default:
        decisionContext = 'Decision pending';
    }

    return `4th & ${yardsToGo} ${positionDesc} - ${decisionContext}`;
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
}