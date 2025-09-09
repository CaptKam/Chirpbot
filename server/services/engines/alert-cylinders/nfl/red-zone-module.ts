import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';

export default class RedZoneModule extends BaseAlertModule {
  alertType = 'RED_ZONE';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && 
           gameState.yardLine !== undefined && 
           gameState.yardLine <= 20;
  }

  async generateAlert(gameState: GameState): Promise<AlertResult | null> {
    if (!this.isTriggered(gameState)) return null;

    const down = gameState.down || 1;
    const yardLine = gameState.yardLine || 20;
    const teamWithBall = gameState.possession || gameState.homeTeam;

    // Get weather data for enhanced context
    const homeTeam = gameState.homeTeam;
    let weatherData = null;
    let weatherContext = '';

    try {
      weatherData = await weatherService.getWeatherForTeam(homeTeam);
      if (weatherData) {
        // Red zone specific weather impacts
        if (weatherData.windSpeed >= 15 && down >= 3) {
          weatherContext = ` 💨 ${weatherData.windSpeed}mph winds - Field goal challenging`;
        } else if (weatherData.condition === 'Rain' && down >= 3) {
          weatherContext = ` 🌧️ Rain - Slippery conditions for short passes`;
        } else if (weatherData.temperature < 32) {
          weatherContext = ` 🥶 Freezing ${weatherData.temperature}°F - Handling difficulty`;
        }
      }
    } catch (error) {
      console.warn('Weather data unavailable for NFL red zone alert enhancement');
    }

    const baseMessage = `🔴 RED ZONE: ${teamWithBall} has ${down}${this.getOrdinalSuffix(down)} & ${gameState.yardsToGo || 10} at the ${yardLine} yard line!`;
    const enhancedMessage = baseMessage + weatherContext;

    return {
      alertKey: `${gameState.gameId}_red_zone_${down}_${yardLine}`,
      type: this.alertType,
      message: enhancedMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down,
        yardLine,
        yardsToGo: gameState.yardsToGo,
        possession: teamWithBall,
        weatherData: weatherData,
        weatherContext: weatherContext
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 85 : 0;
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}