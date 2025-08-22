import { BaseSportEngine, AlertConfig } from './base-engine';
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
      // Weather monitoring doesn't depend on AI settings - always run
      const settings = await storage.getSettingsBySport('MLB');
      if (!settings?.telegramEnabled) {
        return;
      }
      
      console.log(`🌤️ Checking weather conditions for user-monitored games...`);
      
      // Get only games that users are actually monitoring
      const allMonitoredGames = await storage.getAllMonitoredGames();
      
      // Create unique set of games to avoid duplicate weather requests
      const uniqueGames = new Map<string, { homeTeam: string; awayTeam: string; sport: string }>();
      
      for (const monitoredGame of allMonitoredGames) {
        const gameKey = `${monitoredGame.homeTeamName}_${monitoredGame.awayTeamName}`;
        if (!uniqueGames.has(gameKey)) {
          uniqueGames.set(gameKey, {
            homeTeam: monitoredGame.homeTeamName,
            awayTeam: monitoredGame.awayTeamName,
            sport: monitoredGame.sport
          });
        }
      }
      
      console.log(`🌤️ Found ${uniqueGames.size} unique monitored games (from ${allMonitoredGames.length} user selections)`);
      
      // Map team names to cities for weather data
      const teamCityMap: Record<string, string> = {
        'Los Angeles Angels': 'Los Angeles', 'Los Angeles Dodgers': 'Los Angeles',
        'Oakland Athletics': 'Oakland', 'San Francisco Giants': 'San Francisco',
        'Seattle Mariners': 'Seattle', 'Texas Rangers': 'Arlington',
        'Houston Astros': 'Houston', 'Minnesota Twins': 'Minneapolis',
        'Kansas City Royals': 'Kansas City', 'Chicago White Sox': 'Chicago',
        'Chicago Cubs': 'Chicago', 'Cleveland Guardians': 'Cleveland',
        'Detroit Tigers': 'Detroit', 'Milwaukee Brewers': 'Milwaukee',
        'St. Louis Cardinals': 'St. Louis', 'Atlanta Braves': 'Atlanta',
        'Miami Marlins': 'Miami', 'New York Yankees': 'New York',
        'New York Mets': 'New York', 'Philadelphia Phillies': 'Philadelphia',
        'Washington Nationals': 'Washington', 'Boston Red Sox': 'Boston',
        'Toronto Blue Jays': 'Toronto', 'Baltimore Orioles': 'Baltimore',
        'Tampa Bay Rays': 'Tampa', 'Pittsburgh Pirates': 'Pittsburgh',
        'Cincinnati Reds': 'Cincinnati', 'Colorado Rockies': 'Denver',
        'Arizona Diamondbacks': 'Phoenix', 'San Diego Padres': 'San Diego'
      };

      for (const [gameKey, game] of Array.from(uniqueGames)) {
        try {
          const cityName = teamCityMap[game.homeTeam] || game.homeTeam;
          const weatherData = await getWeatherData(cityName);
          if (!weatherData) continue;
          
          const previousWeather = this.weatherHistory.get(gameKey);
          
          const weatherState: WeatherState = {
            gameId: `weather-${gameKey}`,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            venue: `${game.homeTeam} Stadium`,
            city: cityName,
            currentWeather: {
              temperature: weatherData.temperature || 0,
              windSpeed: weatherData.windSpeed || 0,
              windDirection: weatherData.windDirection || 'N',
              condition: weatherData.condition
            },
            previousWeather,
            sport: game.sport
          };
          
          // Check for weather alerts
          const triggeredAlerts = await this.checkAlertConditions(weatherState);
          
          if (triggeredAlerts.length > 0) {
            console.log(`🌪️ Weather alerts for ${game.homeTeam} vs ${game.awayTeam}:`, triggeredAlerts.length);
            await this.processAlerts(triggeredAlerts, weatherState);
          }
          
          // Update weather history
          this.weatherHistory.set(gameKey, weatherState.currentWeather);
          
        } catch (error) {
          console.error(`Weather check failed for ${game.homeTeam} vs ${game.awayTeam}:`, error);
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

  protected buildGameContext(gameState: WeatherState): any {
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
      console.log('🌤️ Monitoring weather conditions for user-monitored games...');
      
      // Get only games that users are actually monitoring
      const allMonitoredGames = await storage.getAllMonitoredGames();
      
      // Create unique set of games to avoid duplicate weather requests
      const uniqueGames = new Map<string, { homeTeam: string; awayTeam: string; sport: string; gameId: string }>();
      
      for (const monitoredGame of allMonitoredGames) {
        const gameKey = `${monitoredGame.homeTeamName}_${monitoredGame.awayTeamName}`;
        if (!uniqueGames.has(gameKey)) {
          uniqueGames.set(gameKey, {
            homeTeam: monitoredGame.homeTeamName,
            awayTeam: monitoredGame.awayTeamName,
            sport: monitoredGame.sport,
            gameId: monitoredGame.gameId
          });
        }
      }
      
      console.log(`🌤️ Found ${uniqueGames.size} unique monitored games (from ${allMonitoredGames.length} user selections)`);
      
      // Map team names to their actual cities for better weather data
      const teamCityMap: Record<string, string> = {
        // MLB Teams
        'Los Angeles Angels': 'Los Angeles',
        'Los Angeles Dodgers': 'Los Angeles',
        'Oakland Athletics': 'Oakland',
        'San Francisco Giants': 'San Francisco',
        'Seattle Mariners': 'Seattle',
        'Texas Rangers': 'Arlington',
        'Houston Astros': 'Houston',
        'Minnesota Twins': 'Minneapolis',
        'Kansas City Royals': 'Kansas City',
        'Chicago White Sox': 'Chicago',
        'Chicago Cubs': 'Chicago',
        'Cleveland Guardians': 'Cleveland',
        'Detroit Tigers': 'Detroit',
        'Milwaukee Brewers': 'Milwaukee',
        'St. Louis Cardinals': 'St. Louis',
        'Atlanta Braves': 'Atlanta',
        'Miami Marlins': 'Miami',
        'New York Yankees': 'New York',
        'New York Mets': 'New York',
        'Philadelphia Phillies': 'Philadelphia',
        'Washington Nationals': 'Washington',
        'Boston Red Sox': 'Boston',
        'Toronto Blue Jays': 'Toronto',
        'Baltimore Orioles': 'Baltimore',
        'Tampa Bay Rays': 'Tampa',
        'Pittsburgh Pirates': 'Pittsburgh',
        'Cincinnati Reds': 'Cincinnati',
        'Colorado Rockies': 'Denver',
        'Arizona Diamondbacks': 'Phoenix',
        'San Diego Padres': 'San Diego'
      };
      
      for (const [gameKey, game] of Array.from(uniqueGames)) {
        try {
          // Use the mapped city instead of team name
          const cityName = teamCityMap[game.homeTeam] || game.homeTeam;
          const weatherData = await getWeatherData(cityName);
          if (!weatherData) continue;

          const gameWeatherData = {
            gameId: game.gameId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            venue: `${game.homeTeam} Stadium`,
            city: cityName,
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
          console.error(`Error processing weather for game ${game.homeTeam} vs ${game.awayTeam}:`, gameError);
        }
      }
      
    } catch (error) {
      console.error('Weather monitoring error:', error);
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