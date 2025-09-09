
export interface UniversalEnhancement {
  name: string;
  description: string;
  applicableToAllSports: boolean;
  sportSpecificAdaptations?: Record<string, any>;
}

export class UniversalAlertEnhancer {
  // Weather Integration - applies to all outdoor sports
  static applyWeatherContext(alertMessage: string, sport: string, weatherData: any): string {
    if (sport === 'MLB' && weatherData?.stadiumWindContext) {
      return `${alertMessage} (Weather: ${weatherData.stadiumWindContext})`;
    }
    if (['NFL', 'NCAAF', 'CFL'].includes(sport) && weatherData?.temperature) {
      return `${alertMessage} (Temp: ${weatherData.temperature}°F)`;
    }
    return alertMessage;
  }

  // Player Context - applies to all sports  
  static applyPlayerContext(alertMessage: string, gameState: any, sport: string): string {
    if (sport === 'MLB' && gameState.currentBatter?.name) {
      return `${alertMessage} - ${gameState.currentBatter.name} batting`;
    }
    if (['NFL', 'NCAAF', 'CFL'].includes(sport) && gameState.currentPlayer?.name) {
      return `${alertMessage} - ${gameState.currentPlayer.name} in`;
    }
    if (['NBA', 'WNBA'].includes(sport) && gameState.currentPlayer?.name) {
      return `${alertMessage} - ${gameState.currentPlayer.name} leading`;
    }
    return alertMessage;
  }

  // Probability Scoring - applies to all sports
  static calculateUniversalProbability(gameState: any, sport: string): number {
    let baseProbability = 0.5;

    // Score differential impact (universal)
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3) baseProbability += 0.2; // Close game bonus
    if (scoreDiff <= 7) baseProbability += 0.1;

    // Time/Inning pressure (sport-specific)
    if (sport === 'MLB' && gameState.inning >= 7) baseProbability += 0.15;
    if (['NFL', 'NCAAF', 'CFL'].includes(sport) && gameState.quarter >= 3) baseProbability += 0.15;
    if (['NBA', 'WNBA'].includes(sport) && gameState.quarter === 4) baseProbability += 0.15;

    return Math.min(baseProbability, 1.0);
  }

  // Alert Priority - applies to all sports
  static calculateUniversalPriority(alertType: string, probability: number, sport: string): number {
    let priority = Math.floor(probability * 100);

    // High-impact situations get priority boost
    if (alertType.includes('LOADED') || alertType.includes('RED_ZONE') || alertType.includes('CLUTCH')) {
      priority += 20;
    }

    // Late-game situations get priority boost
    if (alertType.includes('TWO_MINUTE') || alertType.includes('FINAL_MINUTES')) {
      priority += 15;
    }

    return Math.min(priority, 100);
  }
}

// Universal alert enhancement registry
export const UNIVERSAL_ENHANCEMENTS: UniversalEnhancement[] = [
  {
    name: 'Weather Integration',
    description: 'Add weather context to outdoor sport alerts',
    applicableToAllSports: false,
    sportSpecificAdaptations: {
      'MLB': 'Wind direction and speed relative to field',
      'NFL': 'Temperature and precipitation impact', 
      'NCAAF': 'Temperature and precipitation impact',
      'CFL': 'Temperature and precipitation impact'
    }
  },
  {
    name: 'Player Context',
    description: 'Add key player information to alerts',
    applicableToAllSports: true,
    sportSpecificAdaptations: {
      'MLB': 'Current batter information',
      'NFL': 'Key player in situation',
      'NCAAF': 'Key player in situation', 
      'CFL': 'Key player in situation',
      'NBA': 'Leading scorer/key player',
      'WNBA': 'Leading scorer/key player'
    }
  },
  {
    name: 'Probability Scoring',
    description: 'Universal probability calculation for alert importance',
    applicableToAllSports: true
  },
  {
    name: 'Time Pressure Context',
    description: 'Add time/period urgency to alerts',
    applicableToAllSports: true,
    sportSpecificAdaptations: {
      'MLB': 'Late inning pressure',
      'NFL': 'Quarter and time remaining',
      'NCAAF': 'Quarter and time remaining',
      'CFL': 'Quarter and time remaining', 
      'NBA': 'Quarter and shot clock',
      'WNBA': 'Quarter and shot clock'
    }
  }
];
