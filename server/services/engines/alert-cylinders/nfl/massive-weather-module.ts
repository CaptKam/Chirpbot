import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class MassiveWeatherModule extends BaseAlertModule {
  alertType = 'NFL_MASSIVE_WEATHER';
  sport = 'NFL';

  // Track previous weather conditions per game
  private previousWeatherData: { 
    [gameId: string]: { 
      condition: string;
      precipitation: boolean;
      severity: number;
      lastAlertTime: number;
      lastMeasurement: number;
    } 
  } = {};

  // Alert thresholds for severe weather
  private readonly ALERT_COOLDOWN = 15 * 60 * 1000; // 15 minutes between weather alerts
  private readonly MEASUREMENT_INTERVAL = 3 * 60 * 1000; // Check every 3 minutes
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
    const now = Date.now();

    // Analyze weather condition for severity
    const currentCondition = currentWeather.condition?.toLowerCase() || '';
    const currentSeverity = this.calculateWeatherSeverity(currentCondition, currentWeather);
    
    // First measurement for this game
    if (!previous) {
      this.previousWeatherData[gameId] = {
        condition: currentCondition,
        precipitation: this.hasPrecipitation(currentCondition),
        severity: currentSeverity,
        lastAlertTime: 0,
        lastMeasurement: now
      };
      
      // Alert immediately if any weather is detected
      return currentSeverity >= 1; // Any weather threshold
    }

    // Check if enough time has passed since last measurement
    if (now - previous.lastMeasurement < this.MEASUREMENT_INTERVAL) {
      return false;
    }

    // Check cooldown
    if (now - previous.lastAlertTime < this.ALERT_COOLDOWN) {
      // Update measurement but don't alert
      this.previousWeatherData[gameId].condition = currentCondition;
      this.previousWeatherData[gameId].severity = currentSeverity;
      this.previousWeatherData[gameId].lastMeasurement = now;
      return false;
    }

    // Determine if weather change is significant enough for alert
    const severityIncrease = currentSeverity - previous.severity;
    // Alert on any weather change - removed severity barriers
    if (currentSeverity > previous.severity || severityIncrease >= 1) {
      // Update data
      this.previousWeatherData[gameId] = {
        condition: currentCondition,
        precipitation: this.hasPrecipitation(currentCondition),
        severity: currentSeverity,
        lastAlertTime: now,
        lastMeasurement: now
      };
      return true;
    }

    // Update measurement time even if no alert
    this.previousWeatherData[gameId].lastMeasurement = now;
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

    return {
      alertKey,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | MASSIVE WEATHER`,
      displayMessage: `🏈 ${file##*/} | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
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
    
    // Temperature extremes (for football)
    if (weatherContext.temperature !== undefined) {
      if (weatherContext.temperature <= 20) severity += 2; // Extreme cold
      if (weatherContext.temperature >= 100) severity += 2; // Extreme heat
    }
    
    // Wind factor (less important but still relevant for extreme conditions)
    if (weatherContext.windSpeed !== undefined && weatherContext.windSpeed >= 30) {
      severity += 2; // Extreme winds
    }
    
    return Math.min(10, severity); // Cap at 10
  }

  private getConditionSeverity(condition: string): number {
    const severityMap: Record<string, number> = {
      'thunderstorm': 6,
      'lightning': 7,
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
        message += ` | Affecting gameplay and player safety`;
        break;
      case 'moderate':
        message += ` | Impacting field conditions`;
        break;
    }

    return message;
  }
}