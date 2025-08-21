import { fetchJson } from './http';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection?: string;
  humidity?: number;
  conditions: string;
  visibility?: number;
  pressure?: number;
  hrBoostPercentage?: number;
}

interface VenueLocation {
  venue: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
}

// MLB Stadium locations for weather fetching
const MLB_VENUES: Record<string, VenueLocation> = {
  'Yankee Stadium': { venue: 'Yankee Stadium', city: 'New York', state: 'NY', lat: 40.8296, lon: -73.9262 },
  'Fenway Park': { venue: 'Fenway Park', city: 'Boston', state: 'MA', lat: 42.3467, lon: -71.0972 },
  'Wrigley Field': { venue: 'Wrigley Field', city: 'Chicago', state: 'IL', lat: 41.9484, lon: -87.6553 },
  'Dodger Stadium': { venue: 'Dodger Stadium', city: 'Los Angeles', state: 'CA', lat: 34.0739, lon: -118.2400 },
  'Oracle Park': { venue: 'Oracle Park', city: 'San Francisco', state: 'CA', lat: 37.7786, lon: -122.3893 },
  'Coors Field': { venue: 'Coors Field', city: 'Denver', state: 'CO', lat: 39.7559, lon: -104.9942 },
  'Kauffman Stadium': { venue: 'Kauffman Stadium', city: 'Kansas City', state: 'MO', lat: 39.0517, lon: -94.4803 },
  'Target Field': { venue: 'Target Field', city: 'Minneapolis', state: 'MN', lat: 44.9818, lon: -93.2775 },
  'Citi Field': { venue: 'Citi Field', city: 'New York', state: 'NY', lat: 40.7571, lon: -73.8458 },
  'Citizens Bank Park': { venue: 'Citizens Bank Park', city: 'Philadelphia', state: 'PA', lat: 39.9061, lon: -75.1665 },
  'Minute Maid Park': { venue: 'Minute Maid Park', city: 'Houston', state: 'TX', lat: 29.7573, lon: -95.3555 },
  'Globe Life Field': { venue: 'Globe Life Field', city: 'Arlington', state: 'TX', lat: 32.7473, lon: -97.0822 },
  'Petco Park': { venue: 'Petco Park', city: 'San Diego', state: 'CA', lat: 32.7073, lon: -117.1566 },
  'T-Mobile Park': { venue: 'T-Mobile Park', city: 'Seattle', state: 'WA', lat: 47.5914, lon: -122.3325 },
  'Busch Stadium': { venue: 'Busch Stadium', city: 'St. Louis', state: 'MO', lat: 38.6226, lon: -90.1928 },
  'PNC Park': { venue: 'PNC Park', city: 'Pittsburgh', state: 'PA', lat: 40.4468, lon: -80.0057 },
  'Great American Ball Park': { venue: 'Great American Ball Park', city: 'Cincinnati', state: 'OH', lat: 39.0979, lon: -84.5082 },
  'American Family Field': { venue: 'American Family Field', city: 'Milwaukee', state: 'WI', lat: 43.0280, lon: -87.9712 },
  'Truist Park': { venue: 'Truist Park', city: 'Atlanta', state: 'GA', lat: 33.8907, lon: -84.4677 },
  'Nationals Park': { venue: 'Nationals Park', city: 'Washington', state: 'DC', lat: 38.8730, lon: -77.0074 },
  'Angel Stadium': { venue: 'Angel Stadium', city: 'Anaheim', state: 'CA', lat: 33.8003, lon: -117.8827 },
  'Tropicana Field': { venue: 'Tropicana Field', city: 'St. Petersburg', state: 'FL', lat: 27.7682, lon: -82.6534 },
  'Comerica Park': { venue: 'Comerica Park', city: 'Detroit', state: 'MI', lat: 42.3390, lon: -83.0485 },
  'Progressive Field': { venue: 'Progressive Field', city: 'Cleveland', state: 'OH', lat: 41.4962, lon: -81.6852 },
  'Guaranteed Rate Field': { venue: 'Guaranteed Rate Field', city: 'Chicago', state: 'IL', lat: 41.8299, lon: -87.6338 },
  'Oakland Coliseum': { venue: 'Oakland Coliseum', city: 'Oakland', state: 'CA', lat: 37.7516, lon: -122.2005 },
  'Camden Yards': { venue: 'Camden Yards', city: 'Baltimore', state: 'MD', lat: 39.2838, lon: -76.6218 },
  'Rogers Centre': { venue: 'Rogers Centre', city: 'Toronto', state: 'ON', lat: 43.6414, lon: -79.3894 },
  'Marlins Park': { venue: 'Marlins Park', city: 'Miami', state: 'FL', lat: 25.7781, lon: -80.2196 },
  'Chase Field': { venue: 'Chase Field', city: 'Phoenix', state: 'AZ', lat: 33.4455, lon: -112.0667 }
};

// Calculate home run boost based on weather conditions
function calculateHRBoost(weather: WeatherData): number {
  let boost = 0;
  
  // Temperature impact (hot weather = more HRs)
  if (weather.temperature > 85) {
    boost += 15;
  } else if (weather.temperature > 75) {
    boost += 10;
  } else if (weather.temperature > 65) {
    boost += 5;
  } else if (weather.temperature < 50) {
    boost -= 10;
  }
  
  // Wind impact (outward wind = more HRs)
  if (weather.windSpeed > 10 && weather.windDirection?.includes('out')) {
    boost += 20;
  } else if (weather.windSpeed > 5 && weather.windDirection?.includes('out')) {
    boost += 10;
  } else if (weather.windSpeed > 10 && weather.windDirection?.includes('in')) {
    boost -= 15;
  }
  
  // Humidity impact (low humidity = ball travels farther)
  if (weather.humidity && weather.humidity < 40) {
    boost += 5;
  } else if (weather.humidity && weather.humidity > 70) {
    boost -= 5;
  }
  
  // Altitude boost for Denver (Coors Field)
  if (weather.temperature && boost > 0) {
    // Coors Field gets extra boost
    const isDenver = weather.conditions?.includes('Denver') || weather.conditions?.includes('Coors');
    if (isDenver) {
      boost += 15;
    }
  }
  
  return Math.max(-30, Math.min(50, boost)); // Cap between -30% and +50%
}

// Enhanced weather data with AI analysis
export async function getEnhancedWeatherData(venue: string): Promise<WeatherData | null> {
  try {
    console.log(`🌤️ Fetching enhanced weather data for venue: ${venue}`);
    
    const location = MLB_VENUES[venue] || Object.values(MLB_VENUES).find(v => 
      v.venue.toLowerCase().includes(venue.toLowerCase()) ||
      venue.toLowerCase().includes(v.venue.toLowerCase())
    );
    
    if (!location) {
      console.log(`⚠️ No location found for venue: ${venue}`);
      return null;
    }
    
    const apiKey = process.env.ACCUWEATHER_API_KEY;
    if (!apiKey || apiKey === 'default_key') {
      // Return simulated weather with AI enhancement
      const mockWeather: WeatherData = {
        temperature: Math.floor(Math.random() * 30) + 60,
        windSpeed: Math.floor(Math.random() * 15) + 3,
        windDirection: ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'][Math.floor(Math.random() * 8)],
        humidity: Math.floor(Math.random() * 40) + 40,
        conditions: 'Partly Cloudy',
        visibility: 10,
        pressure: 30.1,
        hrBoostPercentage: 0
      };
      
      mockWeather.hrBoostPercentage = calculateHRBoost(mockWeather);
      console.log(`⚠️ Using simulated weather for ${venue}: ${mockWeather.temperature}°F, Wind: ${mockWeather.windSpeed}mph ${mockWeather.windDirection}, HR Boost: ${mockWeather.hrBoostPercentage}%`);
      return mockWeather;
    }
    
    // Get AccuWeather location key
    const locationUrl = `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=${location.lat},${location.lon}`;
    const locationData = await fetchJson(locationUrl, { timeoutMs: 5000 }) as any;
    
    if (!locationData?.Key) {
      console.log(`⚠️ Could not get location key for ${venue}`);
      return null;
    }
    
    // Get current conditions
    const weatherUrl = `https://dataservice.accuweather.com/currentconditions/v1/${locationData.Key}?apikey=${apiKey}&details=true`;
    const weatherResponse = await fetchJson(weatherUrl, { timeoutMs: 5000 }) as any[];
    
    if (!weatherResponse || !weatherResponse[0]) {
      return null;
    }
    
    const current = weatherResponse[0];
    const weather: WeatherData = {
      temperature: current.Temperature?.Imperial?.Value || 70,
      windSpeed: current.Wind?.Speed?.Imperial?.Value || 5,
      windDirection: current.Wind?.Direction?.English || 'N',
      humidity: current.RelativeHumidity || 50,
      conditions: current.WeatherText || 'Clear',
      visibility: current.Visibility?.Imperial?.Value || 10,
      pressure: current.Pressure?.Imperial?.Value || 30.0,
      hrBoostPercentage: 0
    };
    
    weather.hrBoostPercentage = calculateHRBoost(weather);
    
    // Add AI-powered weather analysis if OpenAI is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const aiAnalysis = await analyzeWeatherForBaseball(weather, venue);
        console.log(`🤖 AI Weather Analysis for ${venue}: ${aiAnalysis}`);
        weather.conditions = `${weather.conditions} - ${aiAnalysis}`;
      } catch (error) {
        console.error('AI weather analysis failed:', error);
      }
    }
    
    console.log(`✅ Weather data for ${venue}: ${weather.temperature}°F, Wind: ${weather.windSpeed}mph ${weather.windDirection}, HR Boost: ${weather.hrBoostPercentage}%`);
    return weather;
    
  } catch (error) {
    console.error(`Error fetching weather for ${venue}:`, error);
    return null;
  }
}

// AI-powered weather analysis for baseball
async function analyzeWeatherForBaseball(weather: WeatherData, venue: string): Promise<string> {
  try {
    const prompt = `Analyze these weather conditions for a baseball game at ${venue}:
Temperature: ${weather.temperature}°F
Wind: ${weather.windSpeed} mph ${weather.windDirection}
Humidity: ${weather.humidity}%
Conditions: ${weather.conditions}

Provide a brief (50 chars max) insight on how this affects the game (favors hitters, pitchers, or neutral).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: "You are a baseball weather analyst. Provide very concise insights on weather impact."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 50
    });

    return response.choices[0].message.content || "Normal conditions";
  } catch (error) {
    console.error('Weather AI analysis error:', error);
    return "Weather analysis pending";
  }
}

// Generate weather alert if extreme conditions
export async function generateWeatherAlert(weather: WeatherData, venue: string): Promise<string | null> {
  if (!weather) return null;
  
  const extremeConditions = [];
  
  if (weather.temperature > 95) {
    extremeConditions.push('extreme heat');
  } else if (weather.temperature < 40) {
    extremeConditions.push('cold conditions');
  }
  
  if (weather.windSpeed > 20) {
    extremeConditions.push('high winds');
  }
  
  if (weather.hrBoostPercentage !== undefined && weather.hrBoostPercentage > 25) {
    extremeConditions.push('HR-friendly conditions');
  } else if (weather.hrBoostPercentage !== undefined && weather.hrBoostPercentage < -20) {
    extremeConditions.push('pitcher-friendly conditions');
  }
  
  if (extremeConditions.length > 0 && process.env.OPENAI_API_KEY) {
    try {
      const prompt = `Create a brief weather alert (60 chars max) for ${venue} with ${extremeConditions.join(', ')}. Make it exciting for baseball fans.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 50
      });
      
      return response.choices[0].message.content || null;
    } catch (error) {
      console.error('Weather alert generation error:', error);
      return `⚠️ ${extremeConditions.join(', ')} at ${venue}`;
    }
  }
  
  return extremeConditions.length > 0 ? `⚠️ ${extremeConditions.join(', ')} at ${venue}` : null;
}

export { WeatherData, VenueLocation };