
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';

export default class FourthQuarterModule extends BaseAlertModule {
  alertType = 'FOURTH_QUARTER';
  sport = 'WNBA';

  isTriggered(gameState: GameState): boolean {
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    return gameState.quarter === 4 && 
           this.parseTimeToSeconds(gameState.timeRemaining) <= 300 && // 5 minutes
           scoreDiff <= 12;
  }

  async generateAlert(gameState: GameState): Promise<AlertResult | null> {
    if (!this.isTriggered(gameState)) return null;

    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeRemaining = gameState.timeRemaining;
    
    // Get weather data for context (most WNBA games are indoor, but weather affects travel/attendance)
    const homeTeam = gameState.homeTeam;
    let weatherData = null;
    let weatherContext = '';
    
    try {
      weatherData = await weatherService.getWeatherForTeam(homeTeam);
      if (weatherData) {
        // Weather affects crowd/atmosphere even for indoor games
        if (weatherData.condition === 'Rain' || weatherData.condition === 'Snow') {
          weatherContext = ` 🌧️ ${weatherData.condition} outside - Indoor atmosphere`;
        } else if (weatherData.temperature > 95) {
          weatherContext = ` 🔥 Hot outside: ${weatherData.temperature}°F - Cool arena`;
        } else if (weatherData.temperature < 32) {
          weatherContext = ` 🥶 Cold outside: ${weatherData.temperature}°F - Warm arena`;
        }
      }
    } catch (error) {
      console.warn('Weather data unavailable for WNBA alert enhancement');
    }

    const baseMessage = `🏀 WNBA FOURTH QUARTER CRUNCH TIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left`;
    const enhancedMessage = baseMessage + weatherContext;
    
    return {
      alertKey: `${gameState.gameId}_fourth_quarter_${timeRemaining.replace(/[:\s]/g, '')}`,
      type: this.alertType,
      message: enhancedMessage,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining,
        scoreDiff,
        weatherData: weatherData,
        weatherContext: weatherContext
      },
      priority: scoreDiff <= 5 ? 95 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 85 : 0;
  }

  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }
}
