
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'NFL_GAME_START';
  sport = 'NFL';

  isTriggered(gameState: GameState): boolean {
    return gameState.status === 'live' && gameState.quarter === 1 && 
           gameState.timeRemaining === '15:00';
  }

  async generateAlert(gameState: GameState): Promise<AlertResult | null> {
    if (!this.isTriggered(gameState)) return null;

    // Get weather data for the home team
    const homeTeam = gameState.homeTeam;
    let weatherData = null;
    let weatherContext = '';
    
    try {
      weatherData = await weatherService.getWeatherForTeam(homeTeam);
      if (weatherData) {
        // NFL-specific weather impacts
        if (weatherData.temperature < 32) {
          weatherContext = ` 🥶 Freezing conditions: ${weatherData.temperature}°F - Affects passing/kicking`;
        } else if (weatherData.temperature > 95) {
          weatherContext = ` 🔥 Extreme heat: ${weatherData.temperature}°F - Player fatigue concern`;
        } else if (weatherData.windSpeed >= 15) {
          weatherContext = ` 💨 Strong winds: ${weatherData.windSpeed}mph - Passing/kicking affected`;
        } else if (weatherData.condition === 'Rain' || weatherData.condition === 'Snow') {
          weatherContext = ` 🌧️ ${weatherData.condition} - Field conditions impact`;
        }
      }
    } catch (error) {
      console.warn('Weather data unavailable for NFL alert enhancement');
    }

    const baseMessage = `🏈 Game Started: ${gameState.awayTeam} @ ${gameState.homeTeam}`;
    const enhancedMessage = baseMessage + weatherContext;

    return {
      alertKey: `${gameState.gameId}_game_start`,
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
        weatherData: weatherData,
        weatherContext: weatherContext
      },
      priority: 75
    };
  }

  calculateProbability(gameState: GameState): number {
    return this.isTriggered(gameState) ? 100 : 0;
  }
}
