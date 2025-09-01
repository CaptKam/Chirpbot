// Weather service stub - cache per-venue weather snapshot + bucket
// (OUT_TO_CF_10_15, CROSS_15_20, CALM, INDOOR)

export interface WeatherData {
  bucket: string;
  windSpeed: number;
  windDirection: number;
  temperature: number;
  humidity: number;
}

const weatherCache = new Map<string, { data: WeatherData; expires: number }>();

export async function getWeatherBucket(lat?: number, lon?: number): Promise<string> {
  // Stub implementation - in production would call weather API
  if (!lat || !lon) return 'INDOOR';
  
  const key = `${lat},${lon}`;
  const cached = weatherCache.get(key);
  
  if (cached && Date.now() < cached.expires) {
    return cached.data.bucket;
  }
  
  // Mock weather data based on coordinates
  const windSpeed = Math.random() * 20; // 0-20 mph
  const windDirection = Math.random() * 360; // 0-360 degrees
  
  let bucket = 'CALM';
  if (windSpeed > 10) {
    // Simplified wind bucket calculation
    if (windDirection >= 45 && windDirection <= 135) {
      bucket = windSpeed > 15 ? 'OUT_TO_CF_15_20' : 'OUT_TO_CF_10_15';
    } else if (windDirection >= 225 && windDirection <= 315) {
      bucket = windSpeed > 15 ? 'IN_FROM_CF_15_20' : 'IN_FROM_CF_10_15';
    } else {
      bucket = windSpeed > 15 ? 'CROSS_15_20' : 'CROSS_10_15';
    }
  }
  
  const weatherData: WeatherData = {
    bucket,
    windSpeed,
    windDirection,
    temperature: 70 + Math.random() * 40, // 70-110°F
    humidity: 30 + Math.random() * 50     // 30-80%
  };
  
  // Cache for 10 minutes
  const refreshMinutes = parseInt(process.env.WEATHER_REFRESH_MIN || '10', 10);
  weatherCache.set(key, {
    data: weatherData,
    expires: Date.now() + refreshMinutes * 60 * 1000
  });
  
  return bucket;
}

export async function refreshWeatherForVenue(lat: number, lon: number): Promise<void> {
  // Force refresh weather data
  const key = `${lat},${lon}`;
  weatherCache.delete(key);
  await getWeatherBucket(lat, lon);
}