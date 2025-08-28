// OpenWeatherMap API client for weather data
// Handles wind direction conversion from meteorological to geographic

export type OWMWeather = {
  windMph: number;             // mph
  windDirToDeg: number | null; // 0–360, direction TOWARD which wind blows
  temperatureF: number | null;
  pressureHpa: number | null;
  humidity: number | null;
  condition: string | null;
};

const API = "https://api.openweathermap.org/data/2.5/weather";

export async function fetchOWM(lat: number, lon: number, apiKey: string): Promise<OWMWeather> {
  const url = `${API}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChirpBot-Weather/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`OWM API returned ${res.status}: ${res.statusText}`);
    }
    
    const j = await res.json();

    // OWM wind.deg = direction the wind is COMING FROM (meteorological convention)
    // Convert to "toward" direction by adding 180° for our calculations
    const fromDeg = typeof j?.wind?.deg === "number" ? j.wind.deg : null;
    const toDeg = fromDeg == null ? null : ((fromDeg + 180) % 360);

    return {
      windMph: Number(j?.wind?.speed ?? 0), // already mph due to units=imperial
      windDirToDeg: toDeg,
      temperatureF: typeof j?.main?.temp === "number" ? j.main.temp : null,
      pressureHpa: typeof j?.main?.pressure === "number" ? j.main.pressure : null,
      humidity: typeof j?.main?.humidity === "number" ? j.main.humidity : null,
      condition: j?.weather?.[0]?.main || null
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Weather API request timeout');
    }
    throw error;
  }
}