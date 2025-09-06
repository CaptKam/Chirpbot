import { db } from '../db';

interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
  timestamp: string;
}

interface StadiumCoordinates {
  lat: number;
  lon: number;
  city: string;
  stadium: string;
}

// MLB Stadium coordinates for weather lookups
const STADIUMS: Record<string, StadiumCoordinates> = {
  'Arizona Diamondbacks': { lat: 33.4453, lon: -112.0667, city: 'Phoenix', stadium: 'Chase Field' },
  'Atlanta Braves': { lat: 33.8902, lon: -84.4677, city: 'Atlanta', stadium: 'Truist Park' },
  'Baltimore Orioles': { lat: 39.2837, lon: -76.6218, city: 'Baltimore', stadium: 'Oriole Park' },
  'Boston Red Sox': { lat: 42.3467, lon: -71.0972, city: 'Boston', stadium: 'Fenway Park' },
  'Chicago Cubs': { lat: 41.9484, lon: -87.6553, city: 'Chicago', stadium: 'Wrigley Field' },
  'Chicago White Sox': { lat: 41.8299, lon: -87.6338, city: 'Chicago', stadium: 'Guaranteed Rate Field' },
  'Cincinnati Reds': { lat: 39.0974, lon: -84.5068, city: 'Cincinnati', stadium: 'Great American Ball Park' },
  'Cleveland Guardians': { lat: 41.4958, lon: -81.6852, city: 'Cleveland', stadium: 'Progressive Field' },
  'Colorado Rockies': { lat: 39.7559, lon: -104.9942, city: 'Denver', stadium: 'Coors Field' },
  'Detroit Tigers': { lat: 42.3391, lon: -83.0485, city: 'Detroit', stadium: 'Comerica Park' },
  'Houston Astros': { lat: 29.7572, lon: -95.3555, city: 'Houston', stadium: 'Minute Maid Park' },
  'Kansas City Royals': { lat: 39.0517, lon: -94.4803, city: 'Kansas City', stadium: 'Kauffman Stadium' },
  'Los Angeles Angels': { lat: 33.8003, lon: -117.8827, city: 'Anaheim', stadium: 'Angel Stadium' },
  'Los Angeles Dodgers': { lat: 34.0739, lon: -118.2400, city: 'Los Angeles', stadium: 'Dodger Stadium' },
  'Miami Marlins': { lat: 25.7781, lon: -80.2197, city: 'Miami', stadium: 'loanDepot park' },
  'Milwaukee Brewers': { lat: 43.0280, lon: -87.9712, city: 'Milwaukee', stadium: 'American Family Field' },
  'Minnesota Twins': { lat: 44.9817, lon: -93.2776, city: 'Minneapolis', stadium: 'Target Field' },
  'New York Mets': { lat: 40.7571, lon: -73.8458, city: 'New York', stadium: 'Citi Field' },
  'New York Yankees': { lat: 40.8296, lon: -73.9262, city: 'New York', stadium: 'Yankee Stadium' },
  'Oakland Athletics': { lat: 37.7516, lon: -122.2005, city: 'Oakland', stadium: 'Oakland Coliseum' },
  'Philadelphia Phillies': { lat: 39.9061, lon: -75.1665, city: 'Philadelphia', stadium: 'Citizens Bank Park' },
  'Pittsburgh Pirates': { lat: 40.4469, lon: -80.0057, city: 'Pittsburgh', stadium: 'PNC Park' },
  'San Diego Padres': { lat: 32.7073, lon: -117.1566, city: 'San Diego', stadium: 'Petco Park' },
  'San Francisco Giants': { lat: 37.7786, lon: -122.3893, city: 'San Francisco', stadium: 'Oracle Park' },
  'Seattle Mariners': { lat: 47.5914, lon: -122.3326, city: 'Seattle', stadium: 'T-Mobile Park' },
  'St. Louis Cardinals': { lat: 38.6226, lon: -90.1928, city: 'St. Louis', stadium: 'Busch Stadium' },
  'Tampa Bay Rays': { lat: 27.7682, lon: -82.6534, city: 'St. Petersburg', stadium: 'Tropicana Field' },
  'Texas Rangers': { lat: 32.7472, lon: -97.0833, city: 'Arlington', stadium: 'Globe Life Field' },
  'Toronto Blue Jays': { lat: 43.6414, lon: -79.3894, city: 'Toronto', stadium: 'Rogers Centre' },
  'Washington Nationals': { lat: 38.8730, lon: -77.0074, city: 'Washington', stadium: 'Nationals Park' }
};

export class WeatherService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OpenWeatherMap API key not configured - using fallback data');
    }
  }

  async getWeatherForTeam(teamName: string): Promise<WeatherData> {
    const stadium = STADIUMS[teamName];
    
    if (!stadium) {
      console.warn(`🌤️ No stadium coordinates found for ${teamName}, using fallback`);
      return this.getFallbackWeather();
    }

    if (!this.apiKey) {
      return this.getFallbackWeather();
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${stadium.lat}&lon=${stadium.lon}&appid=${this.apiKey}&units=imperial`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        temperature: Math.round(data.main.temp),
        condition: data.weather[0].main,
        windSpeed: Math.round(data.wind?.speed || 0),
        windDirection: data.wind?.deg || 0,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`🌤️ Weather API error for ${teamName}:`, error);
      return this.getFallbackWeather();
    }
  }

  private getFallbackWeather(): WeatherData {
    return {
      temperature: 72,
      condition: 'Clear',
      windSpeed: 5,
      windDirection: 270,
      humidity: 50,
      pressure: 1013,
      timestamp: new Date().toISOString()
    };
  }

  // Calculate home run probability based on weather conditions
  calculateHomeRunFactor(weather: WeatherData): number {
    let factor = 1.0;

    // Temperature effect (warmer = better carry)
    if (weather.temperature > 80) factor += 0.1;
    else if (weather.temperature < 60) factor -= 0.1;

    // Wind effect (tailwind helps, headwind hurts)
    if (weather.windSpeed > 10) {
      // Assuming wind direction 180-360 is favorable (outfield direction)
      if (weather.windDirection >= 180 && weather.windDirection <= 360) {
        factor += 0.15; // Tailwind
      } else {
        factor -= 0.1; // Headwind
      }
    }

    // Humidity effect (lower humidity = better carry)
    if (weather.humidity < 40) factor += 0.05;
    else if (weather.humidity > 70) factor -= 0.05;

    // Pressure effect (higher pressure = denser air = less carry)
    if (weather.pressure < 1000) factor += 0.05;
    else if (weather.pressure > 1020) factor -= 0.05;

    return Math.max(0.7, Math.min(1.4, factor)); // Clamp between 0.7 and 1.4
  }

  getWindDescription(windSpeed: number, windDirection: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const directionIndex = Math.round(windDirection / 22.5) % 16;
    const direction = directions[directionIndex];
    
    if (windSpeed < 5) return 'Light winds';
    if (windSpeed < 15) return `${windSpeed}mph ${direction}`;
    return `Strong ${windSpeed}mph ${direction} winds`;
  }
}

export const weatherService = new WeatherService();