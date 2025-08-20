import { BaseSportEngine, AlertConfig } from './base-engine';
import { GameContext } from '../ai-predictions';
import { getWeatherData } from '../weather';
import { storage } from '../../storage';

interface WeatherState {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  city: string;
  currentWeather: {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    condition: string;
    humidity?: number;
    pressure?: number;
  };
  previousWeather?: {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    condition: string;
  };
  sport: string;
}

export class WeatherEngine extends BaseSportEngine {
  sport = 'WEATHER';
  monitoringInterval = 60000; // 1 minute for faster weather monitoring
  
  private weatherHistory = new Map<string, WeatherState['currentWeather']>();
  
  async monitor() {
    try {
      const settings = await storage.getSettingsBySport('MLB');
      if (!settings?.aiEnabled) {
        return;
      }
      
      console.log(`🌤️ Checking weather conditions for all active games...`);
      
      // Get all monitored teams and check weather for their venues
      const monitoredTeams = await storage.getMonitoredTeams();
      
      for (const team of monitoredTeams) {
        try {
          const weatherData = await getWeatherData(team.name);
          if (!weatherData) continue;
          
          const previousWeather = this.weatherHistory.get(team.name);
          
          const weatherState: WeatherState = {
            gameId: `weather-${team.name}`,
            homeTeam: team.name,
            awayTeam: 'N/A',
            venue: team.name,
            city: team.name,
            currentWeather: {
              temperature: weatherData.temperature || 0,
              windSpeed: weatherData.windSpeed || 0,
              windDirection: weatherData.windDirection || 'N',
              condition: weatherData.condition
            },
            previousWeather,
            sport: 'WEATHER'
          };
          
          // Check for weather alerts
          const triggeredAlerts = await this.checkAlertConditions(weatherState);
          
          if (triggeredAlerts.length > 0) {
            console.log(`🌪️ Weather alerts for ${team.name}:`, triggeredAlerts.length);
            await this.processAlerts(triggeredAlerts, weatherState);
          }
          
          // Update weather history
          this.weatherHistory.set(team.name, weatherState.currentWeather);
          
        } catch (error) {
          console.error(`Weather check failed for ${team.name}:`, error);
        }
      }
      
    } catch (error) {
      console.error(`Weather monitoring error:`, error);
    }
  }
  
  alertConfigs: AlertConfig[] = [
    {
      type: "Wind Shift Alert",
      priority: 80,
      probability: 1.0,
      description: "🌪️ WIND DIRECTION SHIFT - Game conditions changed!",
      conditions: (state: WeatherState) => 
        Boolean(state.previousWeather && 
        state.currentWeather.windDirection !== state.previousWeather.windDirection &&
        state.currentWeather.windSpeed >= 8)
    },
    {
      type: "High Wind Alert",
      priority: 85,
      probability: 1.0,
      description: "💨 HIGH WINDS - Wind speeds affecting play!",
      conditions: (state: WeatherState) => 
        state.currentWeather.windSpeed >= 15
    },
    {
      type: "Wind Speed Change",
      priority: 75,
      probability: 1.0,
      description: "🌬️ WIND SPEED CHANGE - Conditions shifting!",
      conditions: (state: WeatherState) => 
        Boolean(state.previousWeather && 
        Math.abs(state.currentWeather.windSpeed - state.previousWeather.windSpeed) >= 8)
    },
    {
      type: "Temperature Drop",
      priority: 70,
      probability: 1.0,
      description: "🥶 TEMPERATURE DROP - Cold weather affecting play!",
      conditions: (state: WeatherState) => 
        Boolean(state.previousWeather && 
        (state.previousWeather.temperature - state.currentWeather.temperature) >= 15)
    },
    {
      type: "Weather Condition Change",
      priority: 90,
      probability: 1.0,
      description: "🌦️ WEATHER CHANGE - Playing conditions altered!",
      conditions: (state: WeatherState) => 
        Boolean(state.previousWeather && 
        state.currentWeather.condition !== state.previousWeather.condition &&
        ['Rain', 'Snow', 'Fog'].includes(state.currentWeather.condition))
    },
    {
      type: "Perfect Weather",
      priority: 60,
      probability: 0.3,
      description: "☀️ PERFECT CONDITIONS - Ideal weather for big plays!",
      conditions: (state: WeatherState) => 
        state.currentWeather.temperature >= 65 && 
        state.currentWeather.temperature <= 78 &&
        state.currentWeather.windSpeed <= 5 &&
        state.currentWeather.condition === 'Clear'
    },
    {
      type: "Dome Game",
      priority: 40,
      probability: 0.2,
      description: "🏟️ DOME GAME - Weather not a factor",
      conditions: (state: WeatherState) => 
        ['Dome', 'Indoor', 'Retractable Roof Closed'].includes(state.currentWeather.condition)
    }
  ];

  extractGameState(gameData: any): WeatherState | null {
    try {
      return {
        gameId: gameData.gameId,
        homeTeam: gameData.homeTeam,
        awayTeam: gameData.awayTeam,
        venue: gameData.venue || 'Unknown Venue',
        city: gameData.city || gameData.homeTeam,
        currentWeather: gameData.weather,
        previousWeather: this.weatherHistory.get(gameData.gameId),
        sport: gameData.sport
      };
    } catch (error) {
      console.error('Error extracting weather state:', error);
      return null;
    }
  }

  protected getGameSpecificInfo(gameState: WeatherState) {
    return {
      venue: gameState.venue,
      city: gameState.city,
      temperature: gameState.currentWeather.temperature,
      windSpeed: gameState.currentWeather.windSpeed,
      windDirection: gameState.currentWeather.windDirection,
      condition: gameState.currentWeather.condition,
      temperatureChange: gameState.previousWeather ? 
        gameState.currentWeather.temperature - gameState.previousWeather.temperature : 0,
      windSpeedChange: gameState.previousWeather ? 
        gameState.currentWeather.windSpeed - gameState.previousWeather.windSpeed : 0
    };
  }

  protected buildGameContext(gameState: WeatherState): GameContext {
    return {
      sport: gameState.sport,
      homeScore: 0,
      awayScore: 0,
      scoreDifference: 0,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live',
      weather: {
        windSpeed: gameState.currentWeather.windSpeed,
        windDirection: gameState.currentWeather.windDirection,
        temperature: gameState.currentWeather.temperature,
        condition: gameState.currentWeather.condition
      }
    };
  }

  async monitorWeatherForAllGames(): Promise<void> {
    try {
      console.log('🌤️ Monitoring weather conditions for all active games...');
      
      // Get all live games from different sports
      const allGames = await this.getAllLiveGames();
      
      for (const game of allGames) {
        try {
          const weatherData = await getWeatherData(game.homeTeam);
          if (!weatherData) continue;

          const gameWeatherData = {
            gameId: game.gameId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            venue: game.venue,
            city: game.city,
            sport: game.sport,
            weather: {
              temperature: weatherData.temperature,
              windSpeed: weatherData.windSpeed,
              windDirection: weatherData.windDirection,
              condition: weatherData.condition
            }
          };

          const weatherState = this.extractGameState(gameWeatherData);
          if (!weatherState) continue;

          const triggeredAlerts = await this.checkAlertConditions(weatherState);
          
          if (triggeredAlerts.length > 0) {
            console.log(`🌪️ Found ${triggeredAlerts.length} weather alerts for ${weatherState.homeTeam} vs ${weatherState.awayTeam}`);
            await this.processAlerts(triggeredAlerts, weatherState);
          }

          // Update weather history
          this.weatherHistory.set(game.gameId, weatherState.currentWeather);
          
        } catch (gameError) {
          console.error(`Error processing weather for game:`, gameError);
        }
      }
      
    } catch (error) {
      console.error('Weather monitoring error:', error);
    }
  }

  private async getAllLiveGames(): Promise<any[]> {
    try {
      const { engineCoordinator } = await import('../engine-coordinator');
      const allGames = await engineCoordinator.getAllLiveGames();
      
      const games = allGames.map(game => ({
        gameId: game.gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        venue: `${game.homeTeam} Stadium`, // Fallback venue name
        city: game.homeTeam, // Use team name as city fallback
        sport: game.sport
      }));
      
      console.log(`🌤️ Weather engine found ${games.length} live games to monitor`);
      return games;
    } catch (error) {
      console.error('Error getting live games for weather monitoring:', error);
      return [];
    }
  }

  async startMonitoring(): Promise<void> {
    console.log(`🌤️ Weather Engine STARTED - ${this.monitoringInterval/1000/60} minute monitoring`);
    
    setInterval(async () => {
      await this.monitorWeatherForAllGames();
    }, this.monitoringInterval);
  }
}

export const weatherEngine = new WeatherEngine();