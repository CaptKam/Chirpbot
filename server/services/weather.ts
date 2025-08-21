export interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed?: number;
  windDirection?: string;
}

export async function getWeatherData(location: string): Promise<WeatherData | null> {
  try {
    // Using OpenWeatherMap API
    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;
    
    if (!apiKey || apiKey === "default_key" || apiKey === "your_actual_openweathermap_api_key_here") {
      console.log(`🌤️ Weather API key not configured (${apiKey ? 'placeholder detected' : 'missing'}), returning null for ${location}`);
      return null;
    }

    console.log(`🌤️ Fetching real weather data for ${location}...`);
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
    );

    if (!response.ok) {
      console.error(`🌤️ Weather API request failed for ${location}:`, response.status, response.statusText);
      if (response.status === 401) {
        console.error("🌤️ Invalid API key detected");
      }
      return null;
    }

    const data = await response.json();
    
    console.log(`✅ Real weather data retrieved for ${location}: ${Math.round(data.main.temp)}°F, ${data.weather[0].main}, Wind: ${Math.round(data.wind?.speed || 0)}mph`);

    return {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      windSpeed: Math.round(data.wind?.speed || 0),
      windDirection: getWindDirection(data.wind?.deg || 0),
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
