// Legacy Enhanced Weather Service for backward compatibility
// This maintains the existing complex interface while new code uses the streamlined version

export interface StadiumData {
  name: string;
  city: string;
  coordinates: { lat: number; lng: number };
  altitude: number;
  orientation: number;
  parkFactor: number;
  dimensions: {
    leftField: number;
    centerField: number;
    rightField: number;
    leftFieldHeight: number;
    centerFieldHeight: number;
    rightFieldHeight: number;
  };
  features: {
    dome: boolean;
    retractableRoof: boolean;
    windPatterns: string[];
  };
}

export interface EnhancedWeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  humidity: number;
  pressure: number;
  visibility: number;
  dewPoint: number;
  uvIndex: number;
  airQuality: number;
  timestamp: number;
  stadium: StadiumData;
  calculations: {
    airDensity: number;
    windComponent: number;
    ballFlightMultiplier: number;
    hrProbabilityBoost: number;
  };
}

export interface WeatherCache {
  [stadiumName: string]: {
    data: EnhancedWeatherData;
    expires: number;
  };
}

export class EnhancedWeatherService {
  private weatherCache: WeatherCache = {};
  private readonly CACHE_TTL = 300000;

  private readonly MLB_STADIUMS: Record<string, StadiumData> = {
    'Angel Stadium': {
      name: 'Angel Stadium',
      city: 'Anaheim',
      coordinates: { lat: 33.8003, lng: -117.8827 },
      altitude: 160,
      orientation: 230,
      parkFactor: 0.97,
      dimensions: { leftField: 330, centerField: 400, rightField: 330, leftFieldHeight: 18, centerFieldHeight: 18, rightFieldHeight: 18 },
      features: { dome: false, retractableRoof: false, windPatterns: ['Santa Ana winds', 'Marine layer'] }
    }
    // ... truncated for brevity, add other stadiums if needed
  };

  async getEnhancedWeatherData(stadiumName: string): Promise<EnhancedWeatherData | null> {
    console.log(`🌤️ Legacy weather service called for ${stadiumName}, consider upgrading to getEnhancedWeather()`);
    
    // Return mock data for backward compatibility
    const stadium = this.MLB_STADIUMS[stadiumName];
    if (!stadium) return null;

    return {
      temperature: 75,
      windSpeed: 5,
      windDirection: 270,
      windGust: 8,
      humidity: 65,
      pressure: 30.1,
      visibility: 10,
      dewPoint: 65,
      uvIndex: 6,
      airQuality: 50,
      timestamp: Date.now(),
      stadium,
      calculations: {
        airDensity: 1.2,
        windComponent: 2.5,
        ballFlightMultiplier: 1.05,
        hrProbabilityBoost: 5
      }
    };
  }
}