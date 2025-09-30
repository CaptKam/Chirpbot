import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class MassiveWeatherModule extends BaseAlertModule {
  alertType = 'NCAAF_MASSIVE_WEATHER';
  sport = 'NCAAF';

  // Track previous weather conditions per game
  private previousWeatherData: { 
    [gameId: string]: { 
      condition: string;
      precipitation: boolean;
      severity: number;
    } 
  } = {};

  // Alert thresholds for severe weather
  private readonly SEVERE_WEATHER_CONDITIONS = [
    'thunderstorm', 'heavy rain', 'storm', 'severe', 'tornado',
    'lightning', 'downpour', 'deluge', 'tempest'
  ];

  isTriggered(gameState: GameState): boolean {
    // Only check for live games or games starting soon
    if (!gameState.isLive && gameState.status !== 'scheduled') return false;
    if (!gameState.weatherContext) return false;
    
    const gameId = gameState.gameId;
    const currentWeather = gameState.weatherContext;
    
    const previous = this.previousWeatherData[gameId];

    // Analyze weather condition for severity
    const currentCondition = currentWeather.condition?.toLowerCase() || '';
    const currentSeverity = this.calculateWeatherSeverity(currentCondition, currentWeather);
    
    // First measurement for this game
    if (!previous) {
      this.previousWeatherData[gameId] = {
        condition: currentCondition,
        precipitation: this.hasPrecipitation(currentCondition),
        severity: currentSeverity
      };
      
      // Alert immediately if severe weather is detected
      return currentSeverity >= 7; // Severe threshold
    }

    // Determine if weather change is significant enough for alert
    const severityIncrease = currentSeverity - previous.severity;
    const newSevereWeather = currentSeverity >= 7 && previous.severity < 7;
    const massiveWeatherEvent = currentSeverity >= 9; // Game-delay level
    
    if (newSevereWeather || massiveWeatherEvent || severityIncrease >= 3) {
      // Update data
      this.previousWeatherData[gameId] = {
        condition: currentCondition,
        precipitation: this.hasPrecipitation(currentCondition),
        severity: currentSeverity
      };
      return true;
    }

    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const gameId = gameState.gameId;
    const currentWeather = gameState.weatherContext!;
    const current = this.previousWeatherData[gameId];

    // Determine impact level
    const impact = this.determineGameImpact(current.severity, currentWeather);

    const alertKey = `${gameId}_massive_weather_${current.severity}_${Date.now()}`;
    const dynamicMessage = this.createDynamicMessage(gameState, current, impact);

    return {
      alertKey,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down: gameState.down || null,
        yardsToGo: gameState.yardsToGo || null,
        fieldPosition: gameState.fieldPosition || null,
        possession: gameState.possession || null,
        weatherCondition: current.condition,
        weatherSeverity: current.severity,
        gameImpact: impact,
        temperature: currentWeather.temperature,
        situationType: 'MASSIVE_WEATHER'
      },
      priority: this.calculatePriority(current.severity, impact)
    };
  }

  calculateProbability(): number {
    return 85; // High probability for severe weather events
  }

  private createDynamicMessage(gameState: GameState, current: any, impact: string): string {
    const condition = current.condition || 'severe weather';
    const severity = current.severity;
    
    // Create descriptive message based on impact and severity
    switch (impact) {
      case 'cancellation':
        return `Dangerous weather conditions - game cancellation risk (${condition})`;
      case 'game_delay':
        return `Severe weather alert - potential game delay (${condition})`;
      case 'significant':
        return `Major weather impact on field conditions (${condition})`;
      case 'moderate':
        return `Weather conditions affecting gameplay (${condition})`;
      default:
        return `Weather alert - ${condition} conditions`;
    }
  }

  private calculateWeatherSeverity(condition: string, weatherContext: any): number {
    let severity = 0;
    
    // Base severity from condition keywords
    for (const severeCondition of this.SEVERE_WEATHER_CONDITIONS) {
      if (condition.includes(severeCondition)) {
        severity += this.getConditionSeverity(severeCondition);
      }
    }
    
    // Additional factors
    if (condition.includes('heavy')) severity += 2;
    if (condition.includes('severe')) severity += 3;
    if (condition.includes('extreme')) severity += 4;
    
    // Temperature extremes (college football often played in harsh conditions)
    if (weatherContext.temperature !== undefined) {
      if (weatherContext.temperature <= 15) severity += 3; // Extreme cold
      if (weatherContext.temperature >= 105) severity += 3; // Extreme heat
    }
    
    // Wind factor (less important but still relevant for extreme conditions)
    if (weatherContext.windSpeed !== undefined && weatherContext.windSpeed >= 35) {
      severity += 2; // Extreme winds
    }
    
    return Math.min(10, severity); // Cap at 10
  }

  private getConditionSeverity(condition: string): number {
    const severityMap: Record<string, number> = {
      'thunderstorm': 6,
      'lightning': 8, // Higher for college due to outdoor stadiums
      'tornado': 10,
      'heavy rain': 4,
      'storm': 5,
      'severe': 6,
      'downpour': 5,
      'deluge': 6,
      'tempest': 7
    };
    
    return severityMap[condition] || 1;
  }

  private hasPrecipitation(condition: string): boolean {
    const precipitationKeywords = ['rain', 'storm', 'snow', 'sleet', 'drizzle', 'shower'];
    return precipitationKeywords.some(keyword => condition.includes(keyword));
  }

  private determineGameImpact(severity: number, weatherContext: any): 'minimal' | 'moderate' | 'significant' | 'game_delay' | 'cancellation' {
    if (severity >= 9) {
      // Check for cancellation-level conditions
      if (weatherContext.condition?.toLowerCase().includes('tornado') || 
          weatherContext.condition?.toLowerCase().includes('lightning')) {
        return 'cancellation';
      }
      return 'game_delay';
    } else if (severity >= 7) {
      return 'significant';
    } else if (severity >= 5) {
      return 'moderate';
    } else {
      return 'minimal';
    }
  }

  private calculatePriority(severity: number, impact: string): number {
    switch (impact) {
      case 'cancellation': return 95;
      case 'game_delay': return 90;
      case 'significant': return 80;
      case 'moderate': return 70;
      default: return 65;
    }
  }

  private generateWeatherMessage(
    condition: string,
    severity: number,
    impact: string,
    gameState: GameState
  ): string {
    let icon = '⛈️';
    let urgencyText = '';
    
    switch (impact) {
      case 'cancellation':
        icon = '🚨';
        urgencyText = 'GAME CANCELLATION RISK';
        break;
      case 'game_delay':
        icon = '⚠️';
        urgencyText = 'POTENTIAL GAME DELAY';
        break;
      case 'significant':
        icon = '🌩️';
        urgencyText = 'SEVERE WEATHER IMPACT';
        break;
      case 'moderate':
        icon = '🌧️';
        urgencyText = 'WEATHER CONDITIONS WORSENING';
        break;
      default:
        urgencyText = 'Weather alert';
    }

    // Build comprehensive message
    let message = `${icon} ${gameState.awayTeam} @ ${gameState.homeTeam}: ${urgencyText}`;
    message += ` - ${condition} conditions (severity ${severity}/10)`;

    // Add game context
    if (gameState.quarter && gameState.timeRemaining) {
      message += ` | Q${gameState.quarter} ${gameState.timeRemaining}`;
    } else if (gameState.status === 'scheduled') {
      message += ` | Pre-game conditions`;
    }

    // Add impact description
    switch (impact) {
      case 'cancellation':
        message += ` | Dangerous conditions - game safety at risk`;
        break;
      case 'game_delay':
        message += ` | Officials may delay start/suspend play`;
        break;
      case 'significant':
        message += ` | Affecting gameplay and field conditions`;
        break;
      case 'moderate':
        message += ` | Impacting field and player performance`;
        break;
    }

    return message;
  }
}