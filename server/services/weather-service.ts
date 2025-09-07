import { db } from '../db';

interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  humidity: number;
  pressure: number;
  timestamp: string;
  stadiumWindContext?: string;
}

interface StadiumCoordinates {
  lat: number;
  lon: number;
  city: string;
  stadium: string;
  homePlateDirection?: number; // Degrees from north to center field
  isDome?: boolean;
  elevation?: number; // Feet above sea level
}

// MLB Stadium coordinates with home plate orientations (degrees from north to center field)
const STADIUMS: Record<string, StadiumCoordinates> = {
  'Arizona Diamondbacks': { lat: 33.4453, lon: -112.0667, city: 'Phoenix', stadium: 'Chase Field', homePlateDirection: 95, isDome: true },
  'Atlanta Braves': { lat: 33.8902, lon: -84.4677, city: 'Atlanta', stadium: 'Truist Park', homePlateDirection: 95 },
  'Baltimore Orioles': { lat: 39.2837, lon: -76.6218, city: 'Baltimore', stadium: 'Oriole Park', homePlateDirection: 62 },
  'Boston Red Sox': { lat: 42.3467, lon: -71.0972, city: 'Boston', stadium: 'Fenway Park', homePlateDirection: 95 },
  'Chicago Cubs': { lat: 41.9484, lon: -87.6553, city: 'Chicago', stadium: 'Wrigley Field', homePlateDirection: 95 },
  'Chicago White Sox': { lat: 41.8299, lon: -87.6338, city: 'Chicago', stadium: 'Guaranteed Rate Field', homePlateDirection: 176 },
  'Cincinnati Reds': { lat: 39.0974, lon: -84.5068, city: 'Cincinnati', stadium: 'Great American Ball Park', homePlateDirection: 95 },
  'Cleveland Guardians': { lat: 41.4958, lon: -81.6852, city: 'Cleveland', stadium: 'Progressive Field', homePlateDirection: 169 },
  'Colorado Rockies': { lat: 39.7559, lon: -104.9942, city: 'Denver', stadium: 'Coors Field', homePlateDirection: 95, elevation: 5200 },
  'Detroit Tigers': { lat: 42.3391, lon: -83.0485, city: 'Detroit', stadium: 'Comerica Park', homePlateDirection: 95 },
  'Houston Astros': { lat: 29.7572, lon: -95.3555, city: 'Houston', stadium: 'Minute Maid Park', homePlateDirection: 107, isDome: true },
  'Kansas City Royals': { lat: 39.0517, lon: -94.4803, city: 'Kansas City', stadium: 'Kauffman Stadium', homePlateDirection: 95 },
  'Los Angeles Angels': { lat: 33.8003, lon: -117.8827, city: 'Anaheim', stadium: 'Angel Stadium', homePlateDirection: 95 },
  'Los Angeles Dodgers': { lat: 34.0739, lon: -118.2400, city: 'Los Angeles', stadium: 'Dodger Stadium', homePlateDirection: 95 },
  'Miami Marlins': { lat: 25.7781, lon: -80.2197, city: 'Miami', stadium: 'loanDepot park', homePlateDirection: 95, isDome: true },
  'Milwaukee Brewers': { lat: 43.0280, lon: -87.9712, city: 'Milwaukee', stadium: 'American Family Field', homePlateDirection: 95, isDome: true },
  'Minnesota Twins': { lat: 44.9817, lon: -93.2776, city: 'Minneapolis', stadium: 'Target Field', homePlateDirection: 104 },
  'New York Mets': { lat: 40.7571, lon: -73.8458, city: 'New York', stadium: 'Citi Field', homePlateDirection: 95 },
  'New York Yankees': { lat: 40.8296, lon: -73.9262, city: 'New York', stadium: 'Yankee Stadium', homePlateDirection: 95 },
  'Oakland Athletics': { lat: 37.7516, lon: -122.2005, city: 'Oakland', stadium: 'Oakland Coliseum', homePlateDirection: 95 },
  'Philadelphia Phillies': { lat: 39.9061, lon: -75.1665, city: 'Philadelphia', stadium: 'Citizens Bank Park', homePlateDirection: 95 },
  'Pittsburgh Pirates': { lat: 40.4469, lon: -80.0057, city: 'Pittsburgh', stadium: 'PNC Park', homePlateDirection: 95 },
  'San Diego Padres': { lat: 32.7073, lon: -117.1566, city: 'San Diego', stadium: 'Petco Park', homePlateDirection: 95 },
  'San Francisco Giants': { lat: 37.7786, lon: -122.3893, city: 'San Francisco', stadium: 'Oracle Park', homePlateDirection: 95 },
  'Seattle Mariners': { lat: 47.5914, lon: -122.3326, city: 'Seattle', stadium: 'T-Mobile Park', homePlateDirection: 95, isDome: true },
  'St. Louis Cardinals': { lat: 38.6226, lon: -90.1928, city: 'St. Louis', stadium: 'Busch Stadium', homePlateDirection: 95 },
  'Tampa Bay Rays': { lat: 27.7682, lon: -82.6534, city: 'St. Petersburg', stadium: 'Tropicana Field', homePlateDirection: 95, isDome: true },
  'Texas Rangers': { lat: 32.7472, lon: -97.0833, city: 'Arlington', stadium: 'Globe Life Field', homePlateDirection: 95, isDome: true },
  'Toronto Blue Jays': { lat: 43.6414, lon: -79.3894, city: 'Toronto', stadium: 'Rogers Centre', homePlateDirection: 95, isDome: true },
  'Washington Nationals': { lat: 38.8730, lon: -77.0074, city: 'Washington', stadium: 'Nationals Park', homePlateDirection: 95 }
};

export class WeatherService {
  private apiKey: string;
  private weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minute cache

  constructor() {
    this.apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
    
    // Check for disable flags first
    if (!this.checkIfEnabled()) {
      this.apiKey = ''; // Disable weather API calls
      console.log('🚫 Weather System: DISABLED via disable flags');
      return;
    }
    
    if (!this.apiKey) {
      console.warn('⚠️ OpenWeatherMap API key not configured - using fallback data');
      console.warn('⚠️ Set OPENWEATHERMAP_API_KEY in Secrets for live weather data');
    }
  }

  // Check if Weather system is enabled
  private checkIfEnabled(): boolean {
    // Weather system is enabled by default
    // Could add environment variable check here if needed
    return true;
  }

  async getWeatherForTeam(teamName: string): Promise<WeatherData> {
    const now = Date.now();
    const cached = this.weatherCache.get(teamName);
    
    // Return cached data if it's less than 1 minute old
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    const stadium = STADIUMS[teamName];
    
    if (!stadium) {
      console.warn(`🌤️ No stadium coordinates found for ${teamName}, using fallback`);
      const fallbackData = this.getFallbackWeather();
      this.weatherCache.set(teamName, { data: fallbackData, timestamp: now });
      return fallbackData;
    }

    if (!this.apiKey) {
      const fallbackData = this.getFallbackWeather();
      this.weatherCache.set(teamName, { data: fallbackData, timestamp: now });
      return fallbackData;
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${stadium.lat}&lon=${stadium.lon}&appid=${this.apiKey}&units=imperial`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      const weatherData = {
        temperature: Math.round(data.main.temp),
        condition: data.weather[0].main,
        windSpeed: Math.round(data.wind?.speed || 0),
        windDirection: data.wind?.deg || 0,
        windGust: data.wind?.gust ? Math.round(data.wind.gust) : undefined,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        timestamp: new Date().toISOString(),
        stadiumWindContext: this.getStadiumWindContext(data.wind?.deg || 0, data.wind?.speed || 0, stadium)
      };

      // Cache the fresh data
      this.weatherCache.set(teamName, { data: weatherData, timestamp: now });
      
      return weatherData;
    } catch (error) {
      console.error(`🌤️ Weather API error for ${teamName}:`, error);
      const fallbackData = this.getFallbackWeather();
      this.weatherCache.set(teamName, { data: fallbackData, timestamp: now });
      return fallbackData;
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

  // Get wind direction relative to stadium layout
  getStadiumWindContext(windDirection: number, windSpeed: number, stadium: StadiumCoordinates): string {
    if (stadium.isDome) {
      return 'Dome - No wind impact';
    }

    if (windSpeed < 5) {
      return 'Light winds';
    }

    const homePlateDirection = stadium.homePlateDirection || 95;
    
    // Calculate relative wind direction to stadium
    let relativeDegree = windDirection - homePlateDirection;
    if (relativeDegree < 0) relativeDegree += 360;
    if (relativeDegree >= 360) relativeDegree -= 360;

    // Determine field impact
    let fieldContext = '';
    if (relativeDegree >= 315 || relativeDegree < 45) {
      fieldContext = 'to center field';
    } else if (relativeDegree >= 45 && relativeDegree < 135) {
      fieldContext = 'to left field';
    } else if (relativeDegree >= 135 && relativeDegree < 225) {
      fieldContext = 'in from center field';
    } else {
      fieldContext = 'to right field';
    }

    // Add elevation context for Coors Field
    let elevationNote = '';
    if (stadium.elevation && stadium.elevation > 3000) {
      elevationNote = ' (high altitude)';
    }

    return `${windSpeed}mph ${fieldContext}${elevationNote}`;
  }

  // Check if using live weather data
  isUsingLiveData(): boolean {
    return !!this.apiKey;
  }

  // Get current weather data source
  getDataSource(): string {
    return this.apiKey ? 'OpenWeatherMap API' : 'Fallback Data';
  }
}

export const weatherService = new WeatherService();