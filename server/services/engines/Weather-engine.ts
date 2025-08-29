// Centralized Weather Engine for ChirpBot V2
// Consolidates all weather data collection and stadium calculations

export interface WeatherData {
  windMph: number;
  windDirToDeg: number | null; // 0–360, direction TOWARD which wind blows
  temperatureF: number | null;
  pressureHpa: number | null;
  humidity: number | null;
  condition: string | null;
}

export interface StadiumMetadata {
  lat: number;
  lon: number;
  cfAzimuthDeg: number;
  roof?: "open" | "closed" | "retractable";
}

export interface EnhancedWeather extends WeatherData {
  stadium?: string;
  windTowardCF: boolean; // true if wind is blowing toward center field
  windAdvantage: "helping" | "hurting" | "neutral"; // for home runs
  isIndoor: boolean;
  homeRunFactor: number; // 0.5-2.0 multiplier
}

// Comprehensive stadium database
const STADIUMS: Record<string, StadiumMetadata> = {
  // American League East
  "yankee-stadium": { lat: 40.8296, lon: -73.9262, cfAzimuthDeg: 280, roof: "open" },
  "fenway-park": { lat: 42.3467, lon: -71.0972, cfAzimuthDeg: 310, roof: "open" },
  "rogers-centre": { lat: 43.6414, lon: -79.3894, cfAzimuthDeg: 270, roof: "retractable" },
  "tropicana-field": { lat: 27.7682, lon: -82.6534, cfAzimuthDeg: 315, roof: "closed" },
  "oriole-park": { lat: 39.2840, lon: -76.6218, cfAzimuthDeg: 354, roof: "open" },

  // American League Central
  "guaranteed-rate-field": { lat: 41.8300, lon: -87.6338, cfAzimuthDeg: 347, roof: "open" },
  "progressive-field": { lat: 41.4958, lon: -81.6852, cfAzimuthDeg: 325, roof: "open" },
  "comerica-park": { lat: 42.3391, lon: -83.0485, cfAzimuthDeg: 339, roof: "open" },
  "kauffman-stadium": { lat: 39.0517, lon: -94.4803, cfAzimuthDeg: 8, roof: "open" },
  "target-field": { lat: 44.9817, lon: -93.2776, cfAzimuthDeg: 195, roof: "open" },

  // American League West
  "angel-stadium": { lat: 33.8003, lon: -117.8827, cfAzimuthDeg: 230, roof: "open" },
  "minute-maid-park": { lat: 29.7571, lon: -95.3550, cfAzimuthDeg: 25, roof: "retractable" },
  "oakland-coliseum": { lat: 37.7516, lon: -122.2005, cfAzimuthDeg: 285, roof: "open" },
  "t-mobile-park": { lat: 47.5914, lon: -122.3326, cfAzimuthDeg: 215, roof: "retractable" },
  "globe-life-field": { lat: 32.7472, lon: -97.0825, cfAzimuthDeg: 13, roof: "retractable" },

  // National League East
  "nationals-park": { lat: 38.8730, lon: -77.0074, cfAzimuthDeg: 295, roof: "open" },
  "citizens-bank-park": { lat: 39.9061, lon: -75.1665, cfAzimuthDeg: 320, roof: "open" },
  "citi-field": { lat: 40.7571, lon: -73.8458, cfAzimuthDeg: 285, roof: "open" },
  "truist-park": { lat: 33.8902, lon: -84.4677, cfAzimuthDeg: 300, roof: "open" },
  "loanDepot-park": { lat: 25.7781, lon: -80.2195, cfAzimuthDeg: 346, roof: "retractable" },

  // National League Central
  "wrigley-field": { lat: 41.9484, lon: -87.6553, cfAzimuthDeg: 355, roof: "open" },
  "great-american-ball-park": { lat: 39.0975, lon: -84.5068, cfAzimuthDeg: 325, roof: "open" },
  "american-family-field": { lat: 43.0280, lon: -87.9712, cfAzimuthDeg: 200, roof: "retractable" },
  "pnc-park": { lat: 40.4469, lon: -80.0057, cfAzimuthDeg: 320, roof: "open" },
  "busch-stadium": { lat: 38.6226, lon: -90.1928, cfAzimuthDeg: 345, roof: "open" },

  // National League West
  "coors-field": { lat: 39.7559, lon: -104.9942, cfAzimuthDeg: 347, roof: "open" },
  "chase-field": { lat: 33.4453, lon: -112.0667, cfAzimuthDeg: 338, roof: "retractable" },
  "petco-park": { lat: 32.7073, lon: -117.1566, cfAzimuthDeg: 285, roof: "open" },
  "oracle-park": { lat: 37.7786, lon: -122.3893, cfAzimuthDeg: 310, roof: "open" },
  "dodger-stadium": { lat: 34.0739, lon: -118.2400, cfAzimuthDeg: 295, roof: "open" }
};

// Stadium name mapping for venue resolution
const VENUE_MAPPINGS: Record<string, string> = {
  "Yankee Stadium": "yankee-stadium",
  "Fenway Park": "fenway-park",
  "Rogers Centre": "rogers-centre",
  "Tropicana Field": "tropicana-field",
  "Oriole Park at Camden Yards": "oriole-park",
  "Guaranteed Rate Field": "guaranteed-rate-field",
  "Progressive Field": "progressive-field",
  "Comerica Park": "comerica-park",
  "Kauffman Stadium": "kauffman-stadium",
  "Target Field": "target-field",
  "Angel Stadium": "angel-stadium",
  "Minute Maid Park": "minute-maid-park",
  "Oakland Coliseum": "oakland-coliseum",
  "T-Mobile Park": "t-mobile-park",
  "Globe Life Field": "globe-life-field",
  "Nationals Park": "nationals-park",
  "Citizens Bank Park": "citizens-bank-park",
  "Citi Field": "citi-field",
  "Truist Park": "truist-park",
  "loanDepot park": "loanDepot-park",
  "Wrigley Field": "wrigley-field",
  "Great American Ball Park": "great-american-ball-park",
  "American Family Field": "american-family-field",
  "PNC Park": "pnc-park",
  "Busch Stadium": "busch-stadium",
  "Coors Field": "coors-field",
  "Chase Field": "chase-field",
  "Petco Park": "petco-park",
  "Oracle Park": "oracle-park",
  "Dodger Stadium": "dodger-stadium"
};

export class WeatherEngine {
  private apiKey: string | null;
  private cache = new Map<string, { data: EnhancedWeather; expires: number }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly API_TIMEOUT = 5000; // 5 seconds

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || null;
    if (!this.apiKey) {
      console.warn('⚠️  OpenWeather API key not found - using mock weather data');
    }
  }

  // Get stadium key from venue name
  public getStadiumKey(venueName: string): string | null {
    return VENUE_MAPPINGS[venueName] || null;
  }

  // Get stadium metadata by key
  public getStadiumMetadata(stadiumKey: string): StadiumMetadata | null {
    return STADIUMS[stadiumKey] || null;
  }

  // Fetch raw weather data from OpenWeatherMap API
  private async fetchOpenWeatherData(lat: number, lon: number): Promise<WeatherData> {
    if (!this.apiKey) {
      // Return mock data when no API key
      return {
        windMph: 8 + Math.random() * 12, // 8-20 mph
        windDirToDeg: Math.floor(Math.random() * 360),
        temperatureF: 65 + Math.random() * 25, // 65-90°F
        pressureHpa: 1010 + Math.random() * 20, // 1010-1030 hPa
        humidity: 40 + Math.random() * 40, // 40-80%
        condition: ["Clear", "Partly Cloudy", "Overcast"][Math.floor(Math.random() * 3)]
      };
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=imperial`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);
    
    try {
      const res = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'ChirpBot-Weather/2.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`OpenWeather API returned ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();

      // Convert meteorological wind direction (FROM) to geographic direction (TO)
      const fromDeg = typeof data?.wind?.deg === "number" ? data.wind.deg : null;
      const toDeg = fromDeg == null ? null : ((fromDeg + 180) % 360);

      return {
        windMph: Number(data?.wind?.speed ?? 0),
        windDirToDeg: toDeg,
        temperatureF: typeof data?.main?.temp === "number" ? data.main.temp : null,
        pressureHpa: typeof data?.main?.pressure === "number" ? data.main.pressure : null,
        humidity: typeof data?.main?.humidity === "number" ? data.main.humidity : null,
        condition: data?.weather?.[0]?.main || null
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Weather API request timeout');
      }
      throw error;
    }
  }

  // Calculate enhanced weather with stadium-specific analysis
  public async getEnhancedWeather(venueNameOrStadiumKey: string): Promise<EnhancedWeather> {
    const cacheKey = venueNameOrStadiumKey.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    try {
      // Resolve stadium key from venue name if needed
      let stadiumKey = venueNameOrStadiumKey;
      if (!STADIUMS[stadiumKey]) {
        const resolvedKey = this.getStadiumKey(venueNameOrStadiumKey);
        if (!resolvedKey) {
          throw new Error(`Stadium not found: ${venueNameOrStadiumKey}`);
        }
        stadiumKey = resolvedKey;
      }

      const stadium = STADIUMS[stadiumKey];
      if (!stadium) {
        throw new Error(`Stadium metadata not found: ${stadiumKey}`);
      }

      // Fetch weather data
      const weather = await this.fetchOpenWeatherData(stadium.lat, stadium.lon);

      // Calculate wind analysis relative to center field
      const windTowardCF = this.isWindTowardCenterField(weather.windDirToDeg, stadium.cfAzimuthDeg);
      const windAdvantage = this.calculateWindAdvantage(weather.windMph, windTowardCF);
      const isIndoor = stadium.roof === "closed";
      const homeRunFactor = this.calculateHomeRunFactor(weather, stadium, windAdvantage, isIndoor);

      const enhancedWeather: EnhancedWeather = {
        ...weather,
        stadium: stadiumKey,
        windTowardCF,
        windAdvantage,
        isIndoor,
        homeRunFactor
      };

      // Cache for 10 minutes
      this.cache.set(cacheKey, {
        data: enhancedWeather,
        expires: Date.now() + this.CACHE_DURATION
      });

      return enhancedWeather;

    } catch (error) {
      console.error(`🌤️  Weather fetch failed for ${venueNameOrStadiumKey}:`, error);
      
      // Return fallback weather data
      return {
        windMph: 10,
        windDirToDeg: null,
        temperatureF: 75,
        pressureHpa: 1013,
        humidity: 50,
        condition: "Unknown",
        stadium: cacheKey,
        windTowardCF: false,
        windAdvantage: "neutral",
        isIndoor: false,
        homeRunFactor: 1.0
      };
    }
  }

  // Check if wind is blowing toward center field (within 45° tolerance)
  private isWindTowardCenterField(windDirToDeg: number | null, cfAzimuthDeg: number): boolean {
    if (windDirToDeg === null) return false;
    
    const angleDiff = Math.abs(windDirToDeg - cfAzimuthDeg);
    const normalizedDiff = Math.min(angleDiff, 360 - angleDiff);
    
    return normalizedDiff <= 45; // Within 45° of center field direction
  }

  // Calculate wind advantage for home run probability
  private calculateWindAdvantage(windMph: number, windTowardCF: boolean): "helping" | "hurting" | "neutral" {
    if (windMph < 5) return "neutral";
    
    if (windTowardCF) {
      return windMph >= 10 ? "hurting" : "neutral"; // Wind toward CF hurts HRs
    } else {
      return windMph >= 12 ? "helping" : "neutral"; // Wind away from CF helps HRs
    }
  }

  // Calculate home run factor based on weather conditions
  private calculateHomeRunFactor(
    weather: WeatherData, 
    stadium: StadiumMetadata, 
    windAdvantage: "helping" | "hurting" | "neutral",
    isIndoor: boolean
  ): number {
    if (isIndoor) return 1.0; // Indoor stadiums not affected by weather

    let factor = 1.0;

    // Wind factor (most significant)
    if (windAdvantage === "helping") {
      factor *= 1.15 + (weather.windMph * 0.02); // 1.15-1.55x
    } else if (windAdvantage === "hurting") {
      factor *= 0.85 - (weather.windMph * 0.015); // 0.55-0.85x
    }

    // Temperature factor (warmer = less air density = longer fly balls)
    if (weather.temperatureF) {
      if (weather.temperatureF >= 85) {
        factor *= 1.08;
      } else if (weather.temperatureF <= 55) {
        factor *= 0.94;
      }
    }

    // Pressure factor (lower pressure = less air density = longer fly balls)
    if (weather.pressureHpa) {
      if (weather.pressureHpa <= 1005) {
        factor *= 1.05;
      } else if (weather.pressureHpa >= 1025) {
        factor *= 0.97;
      }
    }

    // Stadium-specific adjustments (Coors Field high altitude effect)
    if (stadium.cfAzimuthDeg && Math.abs(stadium.lat - 39.7559) < 0.1) { // Coors Field
      factor *= 1.12;
    }

    // Clamp between reasonable bounds
    return Math.max(0.5, Math.min(2.0, factor));
  }

  // Get basic weather for display purposes
  public async getBasicWeather(venueName: string): Promise<{ temperature: number; condition: string }> {
    try {
      const enhanced = await this.getEnhancedWeather(venueName);
      return {
        temperature: Math.round(enhanced.temperatureF || 75),
        condition: enhanced.condition || "Clear"
      };
    } catch (error) {
      console.error(`🌤️  Basic weather fetch failed for ${venueName}:`, error);
      return {
        temperature: 72,
        condition: "Clear"
      };
    }
  }

  // Clear expired cache entries
  public clearExpiredCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, cached] of entries) {
      if (now >= cached.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const weatherEngine = new WeatherEngine();

// Export functions for backward compatibility
export async function getEnhancedWeather(venueNameOrStadiumKey: string): Promise<EnhancedWeather> {
  return weatherEngine.getEnhancedWeather(venueNameOrStadiumKey);
}

export function getStadiumKey(venueName: string): string | null {
  return weatherEngine.getStadiumKey(venueName);
}

export async function getWeatherData(venueName: string): Promise<{ temperature: number; condition: string }> {
  return weatherEngine.getBasicWeather(venueName);
}