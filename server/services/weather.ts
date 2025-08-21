export interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed?: number;
  windDirection?: string;
  humidity?: number;
  pressure?: number;
  uvIndex?: number;
  visibility?: number; // in miles
  cloudCover?: number; // percentage
  dewPoint?: number;
  feelsLike?: number;
}

export async function getWeatherData(location: string): Promise<WeatherData | null> {
  try {
    // Using OpenWeatherMap One Call API 3.0
    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
    
    if (!apiKey || apiKey === "default_key" || apiKey === "your_actual_openweathermap_api_key_here") {
      console.log(`🌤️ Weather API key not configured (${apiKey ? 'placeholder detected' : 'missing'}), returning null for ${location}`);
      return null;
    }

    console.log(`🌤️ Fetching enhanced weather data for ${location}...`);
    
    // First get coordinates for the location
    const geocodeResponse = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
    );

    if (!geocodeResponse.ok) {
      console.error(`🌤️ Geocoding failed for ${location}:`, geocodeResponse.status);
      return null;
    }

    const geocodeData = await geocodeResponse.json();
    if (!geocodeData || geocodeData.length === 0) {
      console.error(`🌤️ No coordinates found for ${location}`);
      return null;
    }

    const { lat, lon } = geocodeData[0];
    
    // Now get enhanced weather data using One Call API 3.0
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&exclude=minutely,alerts`
    );

    if (!weatherResponse.ok) {
      console.error(`🌤️ One Call API request failed for ${location}:`, weatherResponse.status, weatherResponse.statusText);
      if (weatherResponse.status === 401) {
        console.error("🌤️ Invalid API key or One Call API access denied");
      }
      return null;
    }

    const data = await weatherResponse.json();
    const current = data.current;
    
    console.log(`✅ Enhanced weather data retrieved for ${location}: ${Math.round(current.temp)}°F, ${current.weather[0].main}, Wind: ${Math.round(current.wind_speed || 0)}mph, Humidity: ${current.humidity}%, UV: ${current.uvi}`);

    return {
      temperature: Math.round(current.temp),
      condition: current.weather[0].main,
      windSpeed: Math.round(current.wind_speed || 0),
      windDirection: getWindDirection(current.wind_deg || 0),
      humidity: current.humidity,
      pressure: Math.round(current.pressure),
      uvIndex: current.uvi,
      visibility: Math.round((current.visibility || 10000) / 1609.34), // Convert meters to miles
      cloudCover: current.clouds,
      dewPoint: Math.round(current.dew_point),
      feelsLike: Math.round(current.feels_like)
    };
  } catch (error) {
    console.error(`🌤️ Weather service error for ${location}:`, error);
    return null;
  }
}



function getWindDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
