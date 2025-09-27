
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class TwoMinuteWarningModule extends BaseAlertModule {
  alertType = 'NFL_TWO_MINUTE_WARNING';
  sport = 'NFL';

  private isExactlyTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const [minutes, seconds] = timeRemaining.split(':').map(Number);
      const totalSeconds = minutes * 60 + seconds;
      // Allow for 5-second window around exactly 2:00 (115-125 seconds)
      return totalSeconds >= 115 && totalSeconds <= 125;
    } catch (error) {
      return false;
    }
  }

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NFL Two Minute check for ${gameState.gameId}: status=${gameState.status}, Q${gameState.quarter}, time=${gameState.timeRemaining}, scores=${gameState.homeScore}-${gameState.awayScore}`);

    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Two Minute: Game not live (${gameState.status})`);
      return false;
    }

    // Must be in 2nd or 4th quarter (end of half situations)
    if (gameState.quarter !== 2 && gameState.quarter !== 4) {
      console.log(`❌ Two Minute: Wrong quarter (Q${gameState.quarter})`);
      return false;
    }

    // Must be exactly at 2:00 remaining (within 5 second window)
    const exactlyTwoMinutes = this.isExactlyTwoMinutes(gameState.timeRemaining);
    if (!exactlyTwoMinutes) {
      console.log(`❌ Two Minute: Not exactly 2:00 remaining (${gameState.timeRemaining})`);
      return false;
    }

    console.log(`🎯 NFL Two Minute WARNING TRIGGERED for ${gameState.gameId}`);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const isFirstHalf = gameState.quarter === 2;
    const halfText = isFirstHalf ? '1st Half' : '2nd Half';
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining);

    const dynamicMessage = this.createDynamicMessage(gameState);

    // Extract weather context if available
    const weatherContext = gameState.weatherContext;
    const weatherImpact = weatherContext ? this.analyzeWeatherImpact(weatherContext) : null;

    // Build context with weather data when available
    const context: any = {
      gameId: gameState.gameId,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      quarter: gameState.quarter,
      timeRemaining: gameState.timeRemaining,
      timeSeconds,
      halfText,
      isFirstHalf,
      twoMinuteWarning: true,
      situationType: 'TWO_MINUTE_WARNING'
    };

    // Add weather context if available
    if (weatherContext) {
      context.weatherCondition = weatherContext.condition;
      context.temperature = weatherContext.temperature;
      context.windSpeed = weatherContext.windSpeed;
      context.windDirection = weatherContext.windDirection;
      context.humidity = weatherContext.humidity;
      context.precipitation = this.hasPrecipitation(weatherContext.condition);
      context.weatherImpact = weatherImpact;
    }

    return {
      alertKey: `${gameState.gameId}_two_minute_warning_q${gameState.quarter}_${timeSeconds}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${dynamicMessage}`,
      displayMessage: `🏈 ${dynamicMessage} | Q${gameState.quarter}`,
      context,
      priority: 88
    };
  }

  private createDynamicMessage(gameState: GameState): string {
    const isFirstHalf = gameState.quarter === 2;
    const halfText = isFirstHalf ? '1st half' : '4th quarter';
    const scoreDisplay = this.getScoreDisplay(gameState);
    const clockPhase = this.getClockManagementPhase(gameState);
    const urgencyLevel = this.getUrgencyLevel(gameState);
    
    // Create base message with time and situation
    let situationDesc = `Two-minute warning - ${halfText}`;
    
    // Add score context
    if (gameState.homeScore > 0 || gameState.awayScore > 0) {
      situationDesc += `, ${scoreDisplay}`;
    }
    
    // Add strategic context based on clock management phase
    let strategicContext = '';
    switch (clockPhase) {
      case 'CRITICAL_LATE_GAME':
        strategicContext = 'Critical end-game situation';
        break;
      case 'COMEBACK_ATTEMPT':
        strategicContext = 'Comeback drive opportunity';
        break;
      case 'RUNNING_OUT_CLOCK':
        strategicContext = 'Running out the clock';
        break;
      case 'END_OF_HALF':
        strategicContext = 'End of half drive';
        break;
      default:
        strategicContext = 'Clock management situation';
    }
    
    // Add urgency context if high stakes
    if (urgencyLevel === 'MAXIMUM') {
      strategicContext = 'Game-deciding situation';
    } else if (urgencyLevel === 'HIGH') {
      strategicContext = 'High-pressure situation';
    }
    
    // Add weather context if available
    const weatherContext = gameState.weatherContext;
    let weatherInfo = '';
    if (weatherContext) {
      weatherInfo = this.getWeatherDescription(weatherContext);
      if (weatherInfo) {
        strategicContext += ` | ${weatherInfo}`;
      }
    }
    
    return `${situationDesc} - ${strategicContext}`;
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 95; // High probability since it's exactly at 2:00 mark
  }
  
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;

    try {
      const [minutes, seconds] = timeString.split(':').map(Number);
      return (minutes * 60) + seconds;
    } catch (error) {
      return 0;
    }
  }

  private getScoreDisplay(gameState: GameState): string {
    if (gameState.homeScore === gameState.awayScore) {
      return `Tied ${gameState.homeScore}-${gameState.awayScore}`;
    }

    const leadingTeam = gameState.homeScore > gameState.awayScore ? gameState.homeTeam : gameState.awayTeam;
    const leadingScore = Math.max(gameState.homeScore, gameState.awayScore);
    const trailingScore = Math.min(gameState.homeScore, gameState.awayScore);

    return `${leadingTeam} leads ${leadingScore}-${trailingScore}`;
  }

  private getClockManagementPhase(gameState: GameState): string {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (gameState.quarter === 4) {
      if (scoreDiff <= 3) return 'CRITICAL_LATE_GAME';
      if (scoreDiff <= 7) return 'COMEBACK_ATTEMPT';
      if (scoreDiff >= 14) return 'RUNNING_OUT_CLOCK';
      return 'STANDARD_LATE_GAME';
    }
    
    if (gameState.quarter === 2) {
      return 'END_OF_HALF';
    }
    
    return 'STANDARD';
  }
  
  private getTimeoutSituation(gameState: GameState): string {
    // In a real implementation, this would check actual timeout counts
    // For now, provide strategic analysis based on situation
    const clockPhase = this.getClockManagementPhase(gameState);
    
    switch (clockPhase) {
      case 'CRITICAL_LATE_GAME':
        return 'PRESERVE_TIMEOUTS';
      case 'COMEBACK_ATTEMPT':
        return 'AGGRESSIVE_TIMEOUT_USAGE';
      case 'RUNNING_OUT_CLOCK':
        return 'FORCE_OPPONENT_TIMEOUTS';
      case 'END_OF_HALF':
        return 'STRATEGIC_TIMEOUT_DECISION';
      default:
        return 'NORMAL_MANAGEMENT';
    }
  }
  
  private getComebackProbability(gameState: GameState): number {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    
    if (gameState.quarter !== 4) {
      return 50; // End of half, no comeback analysis
    }
    
    // Fourth quarter comeback probability based on score differential
    if (scoreDiff === 0) return 50;
    if (scoreDiff <= 3) return 45; // Field goal difference
    if (scoreDiff <= 7) return 35; // One touchdown
    if (scoreDiff <= 10) return 25; // Touchdown + field goal
    if (scoreDiff <= 14) return 15; // Two touchdowns
    if (scoreDiff <= 17) return 10; // Two TDs + field goal
    if (scoreDiff <= 21) return 5;  // Three touchdowns
    
    return 2; // Nearly impossible
  }
  
  private getUrgencyLevel(gameState: GameState): string {
    const clockPhase = this.getClockManagementPhase(gameState);
    const comebackProb = this.getComebackProbability(gameState);
    
    if (clockPhase === 'CRITICAL_LATE_GAME') return 'MAXIMUM';
    if (clockPhase === 'COMEBACK_ATTEMPT' && comebackProb >= 25) return 'HIGH';
    if (clockPhase === 'END_OF_HALF') return 'MEDIUM';
    if (clockPhase === 'RUNNING_OUT_CLOCK') return 'LOW';
    
    return 'MEDIUM';
  }

  // Weather analysis helper methods
  private analyzeWeatherImpact(weatherContext: any): 'minimal' | 'moderate' | 'significant' | 'severe' {
    let impactScore = 0;
    
    // Analyze temperature impact
    if (weatherContext.temperature !== undefined) {
      if (weatherContext.temperature <= 20) impactScore += 2; // Extreme cold affects ball handling
      if (weatherContext.temperature >= 95) impactScore += 1; // Heat affects player endurance
    }
    
    // Analyze wind impact (significant for field goals/passing)
    if (weatherContext.windSpeed !== undefined) {
      if (weatherContext.windSpeed >= 20) impactScore += 2; // Strong winds affect passing/kicking
      if (weatherContext.windSpeed >= 30) impactScore += 1; // Extreme winds
    }
    
    // Analyze precipitation impact
    if (weatherContext.condition) {
      const condition = weatherContext.condition.toLowerCase();
      if (this.hasPrecipitation(condition)) {
        impactScore += 2; // Rain/snow affects ball handling and field conditions
        if (condition.includes('heavy') || condition.includes('storm')) {
          impactScore += 1; // Heavy precipitation is worse
        }
      }
    }
    
    // Determine impact level
    if (impactScore >= 5) return 'severe';
    if (impactScore >= 3) return 'significant';
    if (impactScore >= 1) return 'moderate';
    return 'minimal';
  }

  private hasPrecipitation(condition: string | undefined): boolean {
    if (!condition) return false;
    const precipitationKeywords = ['rain', 'snow', 'sleet', 'drizzle', 'shower', 'storm', 'precipitation'];
    return precipitationKeywords.some(keyword => condition.toLowerCase().includes(keyword));
  }

  private getWeatherDescription(weatherContext: any): string {
    const parts: string[] = [];
    
    // Temperature information (if extreme)
    if (weatherContext.temperature !== undefined) {
      if (weatherContext.temperature <= 32) {
        parts.push(`${weatherContext.temperature}°F (freezing)`);
      } else if (weatherContext.temperature <= 20) {
        parts.push(`${weatherContext.temperature}°F (extreme cold)`);
      } else if (weatherContext.temperature >= 95) {
        parts.push(`${weatherContext.temperature}°F (extreme heat)`);
      }
    }
    
    // Wind information (if significant)
    if (weatherContext.windSpeed !== undefined && weatherContext.windSpeed >= 15) {
      let windDesc = `${weatherContext.windSpeed}mph winds`;
      if (weatherContext.windDirection) {
        windDesc += ` ${weatherContext.windDirection}`;
      }
      parts.push(windDesc);
    }
    
    // Precipitation information
    if (weatherContext.condition && this.hasPrecipitation(weatherContext.condition)) {
      parts.push(weatherContext.condition.toLowerCase());
    }
    
    // Add impact assessment
    if (parts.length > 0) {
      const impact = this.analyzeWeatherImpact(weatherContext);
      const impactDesc = this.getImpactDescription(impact);
      return `${parts.join(', ')} (${impactDesc})`;
    }
    
    return '';
  }

  private getImpactDescription(impact: string): string {
    switch (impact) {
      case 'severe': return 'major game impact';
      case 'significant': return 'significant impact';
      case 'moderate': return 'moderate impact';
      case 'minimal': return 'minimal impact';
      default: return 'weather conditions';
    }
  }
}
