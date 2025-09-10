import { WeatherService } from './weather-service';
import { GameState } from './engines/base-engine';

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

interface WeatherFactors {
  temperatureMultiplier: number;
  windMultiplier: number;
  humidityMultiplier: number;
  overallWeatherImpact: number;
  weatherContext: string;
  significantWeatherEffect: boolean;
}

interface ScoringWeatherFactors extends WeatherFactors {
  homeRunFactor: number;
  batterAdvantage: number;
  pitcherAdvantage: number;
}

interface StealingWeatherFactors extends WeatherFactors {
  gripFactor: number;
  visibilityFactor: number;
  fieldingFactor: number;
}

export class WeatherAlertIntegration {
  private weatherService: WeatherService;
  private weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache for alert modules

  constructor() {
    this.weatherService = new WeatherService();
  }

  /**
   * Get weather data for a team with efficient caching
   */
  async getWeatherForTeam(teamName: string): Promise<WeatherData | null> {
    try {
      const now = Date.now();
      const cached = this.weatherCache.get(teamName);
      
      // Return cached data if still valid
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        return cached.data;
      }

      // Fetch fresh weather data
      const weatherData = await this.weatherService.getWeatherForTeam(teamName);
      
      // Cache the result
      this.weatherCache.set(teamName, { data: weatherData, timestamp: now });
      
      return weatherData;
    } catch (error) {
      console.error(`❌ Weather integration error for ${teamName}:`, error);
      return null;
    }
  }

  /**
   * Calculate weather factors specifically for scoring probability (Batter Due alerts)
   */
  async calculateScoringWeatherFactors(gameState: GameState): Promise<ScoringWeatherFactors> {
    // Determine which team is batting for weather context
    const battingTeam = gameState.isTopInning ? gameState.awayTeam : gameState.homeTeam;
    const weatherData = await this.getWeatherForTeam(battingTeam);

    if (!weatherData) {
      // Return neutral factors if weather data unavailable
      return this.getNeutralScoringFactors();
    }

    const factors = this.calculateBaseWeatherFactors(weatherData);
    
    // Temperature effects on ball flight and hitting
    const temperatureMultiplier = this.calculateTemperatureEffect(weatherData.temperature);
    
    // Wind effects on home run probability and ball carry
    const windMultiplier = this.calculateWindEffect(weatherData.windSpeed, weatherData.windDirection, battingTeam);
    
    // Humidity effects on ball flight (dense air = less carry)
    const humidityMultiplier = this.calculateHumidityEffect(weatherData.humidity);
    
    // Home run probability factor (combines temperature, wind, humidity)
    const homeRunFactor = this.calculateHomeRunFactor(weatherData, battingTeam);
    
    // Batter vs pitcher advantage in conditions
    const batterAdvantage = this.calculateBatterAdvantage(weatherData);
    const pitcherAdvantage = this.calculatePitcherAdvantage(weatherData);

    // Overall impact combines all factors
    const overallWeatherImpact = (temperatureMultiplier + windMultiplier + humidityMultiplier) / 3;
    
    // Generate context description
    const weatherContext = this.generateScoringWeatherContext(weatherData, overallWeatherImpact);
    
    // Determine if weather effect is significant enough to mention
    const significantWeatherEffect = Math.abs(overallWeatherImpact - 1.0) > 0.1; // >10% impact

    return {
      temperatureMultiplier,
      windMultiplier,
      humidityMultiplier,
      overallWeatherImpact,
      homeRunFactor,
      batterAdvantage,
      pitcherAdvantage,
      weatherContext,
      significantWeatherEffect
    };
  }

  /**
   * Calculate weather factors specifically for steal likelihood
   */
  async calculateStealingWeatherFactors(gameState: GameState): Promise<StealingWeatherFactors> {
    // Use home team for weather (stealing happens at home stadium)
    const weatherData = await this.getWeatherForTeam(gameState.homeTeam);

    if (!weatherData) {
      return this.getNeutralStealingFactors();
    }

    const factors = this.calculateBaseWeatherFactors(weatherData);
    
    // Grip effects (cold/wet = worse grip for pitcher/catcher)
    const gripFactor = this.calculateGripEffect(weatherData);
    
    // Visibility effects (rain/fog impacts fielding)
    const visibilityFactor = this.calculateVisibilityEffect(weatherData);
    
    // Overall fielding difficulty
    const fieldingFactor = this.calculateFieldingDifficulty(weatherData);
    
    // Overall impact for stealing
    const overallWeatherImpact = (factors.temperatureMultiplier + gripFactor + visibilityFactor) / 3;
    
    const weatherContext = this.generateStealingWeatherContext(weatherData, overallWeatherImpact);
    const significantWeatherEffect = Math.abs(overallWeatherImpact - 1.0) > 0.08; // >8% impact

    return {
      temperatureMultiplier: factors.temperatureMultiplier,
      windMultiplier: factors.windMultiplier,
      humidityMultiplier: factors.humidityMultiplier,
      overallWeatherImpact,
      gripFactor,
      visibilityFactor,
      fieldingFactor,
      weatherContext,
      significantWeatherEffect
    };
  }

  private calculateBaseWeatherFactors(weatherData: WeatherData): WeatherFactors {
    const temperatureMultiplier = this.calculateTemperatureEffect(weatherData.temperature);
    const windMultiplier = this.calculateWindEffectGeneral(weatherData.windSpeed);
    const humidityMultiplier = this.calculateHumidityEffect(weatherData.humidity);
    
    return {
      temperatureMultiplier,
      windMultiplier,
      humidityMultiplier,
      overallWeatherImpact: (temperatureMultiplier + windMultiplier + humidityMultiplier) / 3,
      weatherContext: '',
      significantWeatherEffect: false
    };
  }

  private calculateTemperatureEffect(temperature: number): number {
    // Optimal baseball temperature is around 70-80°F
    // Hot weather (85°F+): Ball travels farther (1.0-1.15 multiplier)
    // Cold weather (<50°F): Ball travels shorter (0.85-1.0 multiplier)
    
    if (temperature >= 85) {
      // Hot weather bonus: up to 15% increase in scoring probability
      return Math.min(1.15, 1.0 + (temperature - 85) * 0.003);
    } else if (temperature <= 50) {
      // Cold weather penalty: up to 15% decrease in scoring probability
      return Math.max(0.85, 1.0 - (50 - temperature) * 0.005);
    } else if (temperature >= 70 && temperature <= 80) {
      // Optimal temperature range
      return 1.05; // 5% bonus for perfect conditions
    } else {
      // Moderate conditions
      return 1.0;
    }
  }

  private calculateWindEffect(windSpeed: number, windDirection: number, teamName: string): number {
    // This would ideally use stadium orientation data from weather service
    // For now, use general wind impact
    
    if (windSpeed >= 15) {
      // Strong wind (15+ mph) has significant impact
      return windSpeed >= 25 ? 1.2 : 1.1; // Very strong vs strong wind
    } else if (windSpeed <= 5) {
      // Calm conditions
      return 1.0;
    } else {
      // Moderate wind (5-15 mph)
      return 1.05;
    }
  }

  private calculateWindEffectGeneral(windSpeed: number): number {
    // General wind impact without direction consideration
    if (windSpeed >= 20) return 1.1; // Strong wind increases variability
    if (windSpeed <= 3) return 1.0;  // Calm conditions
    return 1.02; // Light wind
  }

  private calculateHumidityEffect(humidity: number): number {
    // High humidity = denser air = less ball carry
    // Low humidity = thinner air = more ball carry
    
    if (humidity >= 80) {
      return 0.95; // 5% penalty for very humid conditions
    } else if (humidity <= 30) {
      return 1.05; // 5% bonus for dry conditions
    } else {
      return 1.0; // Neutral humidity
    }
  }

  private calculateHomeRunFactor(weatherData: WeatherData, teamName: string): number {
    // Combines temperature, wind, and humidity for home run probability
    const tempFactor = this.calculateTemperatureEffect(weatherData.temperature);
    const windFactor = this.calculateWindEffect(weatherData.windSpeed, weatherData.windDirection, teamName);
    const humidityFactor = this.calculateHumidityEffect(weatherData.humidity);
    
    // Home run factor emphasizes favorable conditions more heavily
    const baseHomeFactor = (tempFactor * windFactor * humidityFactor);
    
    // Extra bonus for really favorable conditions
    if (weatherData.temperature >= 85 && weatherData.windSpeed >= 10) {
      return Math.min(1.25, baseHomeFactor * 1.1); // Cap at 25% bonus
    }
    
    return Math.min(1.2, baseHomeFactor); // Cap at 20% bonus
  }

  private calculateBatterAdvantage(weatherData: WeatherData): number {
    // Batters generally prefer warmer, calmer conditions
    let advantage = 1.0;
    
    if (weatherData.temperature >= 75 && weatherData.temperature <= 85) {
      advantage += 0.05; // Optimal hitting temperature
    }
    
    if (weatherData.windSpeed <= 8) {
      advantage += 0.03; // Calm conditions favor batters
    }
    
    return Math.min(1.1, advantage);
  }

  private calculatePitcherAdvantage(weatherData: WeatherData): number {
    // Pitchers generally prefer cooler, breezier conditions
    let advantage = 1.0;
    
    if (weatherData.temperature >= 60 && weatherData.temperature <= 75) {
      advantage += 0.05; // Good pitching temperature
    }
    
    if (weatherData.windSpeed >= 10 && weatherData.windSpeed <= 20) {
      advantage += 0.03; // Wind helps break on pitches
    }
    
    return Math.min(1.1, advantage);
  }

  private calculateGripEffect(weatherData: WeatherData): number {
    // Cold and wet conditions hurt grip for pitchers and catchers
    let gripFactor = 1.0;
    
    if (weatherData.temperature <= 45) {
      gripFactor += 0.08; // Cold hurts grip, helps base stealers
    }
    
    if (weatherData.condition.toLowerCase().includes('rain')) {
      gripFactor += 0.12; // Rain significantly hurts grip
    }
    
    if (weatherData.humidity >= 85) {
      gripFactor += 0.04; // High humidity affects grip slightly
    }
    
    return Math.min(1.2, gripFactor);
  }

  private calculateVisibilityEffect(weatherData: WeatherData): number {
    // Poor visibility conditions help base stealers
    const condition = weatherData.condition.toLowerCase();
    
    if (condition.includes('fog') || condition.includes('mist')) {
      return 1.1; // 10% boost for poor visibility
    }
    
    if (condition.includes('rain') || condition.includes('snow')) {
      return 1.08; // 8% boost for precipitation
    }
    
    return 1.0; // Clear conditions
  }

  private calculateFieldingDifficulty(weatherData: WeatherData): number {
    // Combines grip and visibility effects
    const gripFactor = this.calculateGripEffect(weatherData);
    const visibilityFactor = this.calculateVisibilityEffect(weatherData);
    
    return (gripFactor + visibilityFactor) / 2;
  }

  private generateScoringWeatherContext(weatherData: WeatherData, impact: number): string {
    const temp = Math.round(weatherData.temperature);
    const wind = Math.round(weatherData.windSpeed);
    
    if (impact > 1.1) {
      return `Hot ${temp}°F with ${wind} mph winds favoring hitters`;
    } else if (impact < 0.9) {
      return `Cool ${temp}°F conditions reducing offensive output`;
    } else if (wind >= 15) {
      return `Breezy ${wind} mph winds affecting ball flight`;
    } else {
      return `${temp}°F with light ${wind} mph winds`;
    }
  }

  private generateStealingWeatherContext(weatherData: WeatherData, impact: number): string {
    const temp = Math.round(weatherData.temperature);
    const condition = weatherData.condition.toLowerCase();
    
    if (condition.includes('rain')) {
      return `Wet conditions making defensive plays more difficult`;
    } else if (temp <= 45) {
      return `Cold ${temp}°F weather affecting pitcher/catcher grip`;
    } else if (impact > 1.05) {
      return `Weather conditions slightly favoring base runners`;
    } else {
      return `${temp}°F weather with normal defensive conditions`;
    }
  }

  private getNeutralScoringFactors(): ScoringWeatherFactors {
    return {
      temperatureMultiplier: 1.0,
      windMultiplier: 1.0,
      humidityMultiplier: 1.0,
      overallWeatherImpact: 1.0,
      homeRunFactor: 1.0,
      batterAdvantage: 1.0,
      pitcherAdvantage: 1.0,
      weatherContext: 'Weather data unavailable',
      significantWeatherEffect: false
    };
  }

  private getNeutralStealingFactors(): StealingWeatherFactors {
    return {
      temperatureMultiplier: 1.0,
      windMultiplier: 1.0,
      humidityMultiplier: 1.0,
      overallWeatherImpact: 1.0,
      gripFactor: 1.0,
      visibilityFactor: 1.0,
      fieldingFactor: 1.0,
      weatherContext: 'Weather data unavailable',
      significantWeatherEffect: false
    };
  }

  /**
   * Clear weather cache for specific team (useful for testing)
   */
  clearWeatherCache(teamName?: string): void {
    if (teamName) {
      this.weatherCache.delete(teamName);
    } else {
      this.weatherCache.clear();
    }
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { teamCount: number; oldestEntry: number | null } {
    const now = Date.now();
    let oldestEntry: number | null = null;
    
    for (const cached of this.weatherCache.values()) {
      if (!oldestEntry || cached.timestamp < oldestEntry) {
        oldestEntry = cached.timestamp;
      }
    }
    
    return {
      teamCount: this.weatherCache.size,
      oldestEntry: oldestEntry ? now - oldestEntry : null
    };
  }
}

// Export singleton instance for consistent usage across alert modules
export const weatherAlertIntegration = new WeatherAlertIntegration();