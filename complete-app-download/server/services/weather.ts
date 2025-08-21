export interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed?: number;
  windDirection?: string;
}

export async function getWeatherData(location: string): Promise<WeatherData | null> {
  try {
    // Using AccuWeather API
    const apiKey = process.env.ACCUWEATHER_API_KEY;
    
    if (!apiKey || apiKey === "default_key" || apiKey === "your_actual_accuweather_api_key_here") {
      console.log(`🌤️ AccuWeather API key not configured (${apiKey ? 'placeholder detected' : 'missing'}), returning null for ${location}`);
      return null;
    }

    console.log(`🌤️ Fetching weather data from AccuWeather for ${location}...`);
    
    // First, get the location key from AccuWeather
    const locationResponse = await fetch(
      `https://dataservice.accuweather.com/locations/v1/search?apikey=${apiKey}&q=${encodeURIComponent(location)}`
    );

    if (!locationResponse.ok) {
      console.error(`🌤️ AccuWeather location search failed for ${location}:`, locationResponse.status, locationResponse.statusText);
      if (locationResponse.status === 401) {
        console.error("🌤️ Invalid AccuWeather API key detected");
      }
      return null;
    }

    const locationData = await locationResponse.json();
    
    if (!locationData || locationData.length === 0) {
      console.error(`🌤️ No location found for ${location}`);
      return null;
    }

    const locationKey = locationData[0].Key;
    
    // Now get current conditions using the location key
    const weatherResponse = await fetch(
      `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`
    );

    if (!weatherResponse.ok) {
      console.error(`🌤️ AccuWeather current conditions failed for ${location}:`, weatherResponse.status, weatherResponse.statusText);
      return null;
    }

    const weatherData = await weatherResponse.json();
    
    if (!weatherData || weatherData.length === 0) {
      console.error(`🌤️ No weather data found for ${location}`);
      return null;
    }

    const currentWeather = weatherData[0];
    
    console.log(`✅ AccuWeather data retrieved for ${location}: ${Math.round(currentWeather.Temperature.Imperial.Value)}°F, ${currentWeather.WeatherText}, Wind: ${Math.round(currentWeather.Wind?.Speed?.Imperial?.Value || 0)}mph`);

    return {
      temperature: Math.round(currentWeather.Temperature.Imperial.Value),
      condition: currentWeather.WeatherText,
      windSpeed: Math.round(currentWeather.Wind?.Speed?.Imperial?.Value || 0),
      windDirection: currentWeather.Wind?.Direction?.English || 'N/A',
    };
  } catch (error) {
    console.error(`🌤️ AccuWeather service error for ${location}:`, error);
    return null;
  }
}



function getWindDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
