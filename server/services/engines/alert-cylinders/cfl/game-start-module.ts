
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { weatherService } from '../../../weather-service';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'CFL_GAME_START';
  sport = 'CFL';

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
        // CFL-specific weather impacts (wider field, more wind effect)
        if (weatherData.temperature < 10) {
          weatherContext = ` 🥶 Extremely cold: ${weatherData.temperature}°F - Canadian conditions`;
        } else if (weatherData.windSpeed >= 20) {
          weatherContext = ` 💨 High winds: ${weatherData.windSpeed}mph - Wider field affected`;
        } else if (weatherData.condition === 'Snow') {
          weatherContext = ` ❄️ Snow conditions - True Canadian football`;
        } else if (weatherData.condition === 'Rain') {
          weatherContext = ` 🌧️ Rain - Field conditions impact`;
        }
      }
    } catch (error) {
      console.warn('Weather data unavailable for CFL alert enhancement');
    }

    const baseMessage = `🏈 CFL Game Started: ${gameState.awayTeam} @ ${gameState.homeTeam}`;
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
