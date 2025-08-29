// Enhanced weather aggregator with precise stadium calculations
// Implements centerfield wind projection, caching, and roof awareness

import { STADIUMS, getStadiumKey } from "./weather/stadiums";
import { fetchOWM, type OWMWeather } from "./weather/providers/openweather";

export type EnhancedWeather = {
  windMph: number;
  windDirToDeg: number | null;  // 0..360 (toward)
  cfAzimuthDeg: number | null;
  carryMult: number;            // 1 + 0.018 * outMph
  outMph: number;               // projected mph toward CF (>=0)
  temperatureF?: number | null;
  pressureHpa?: number | null;
  humidity?: number | null;
  condition?: string | null;
  roof?: "open" | "closed" | "retractable";
  tag?: string;                 // e.g., "Wind +18%"
};

const cache = new Map<string, { data: EnhancedWeather; ts: number }>();
const TTL_MS = 90_000; // 90 seconds

function carryMultiplier(cfAzimuthDeg: number | null, windDirToDeg: number | null, windMph: number): { outMph: number; mult: number } {
  // No stadium data or invalid centerfield azimuth
  if (!cfAzimuthDeg && cfAzimuthDeg !== 0) return { outMph: 0, mult: 1 };
  
  // No wind data
  if (windDirToDeg == null || windMph <= 0) return { outMph: 0, mult: 1 };
  
  // Calculate angle difference between wind direction and centerfield
  let diff = Math.abs(windDirToDeg - cfAzimuthDeg) % 360;
  if (diff > 180) diff = 360 - diff;
  
  // Project wind component toward centerfield (cosine gives us the component)
  const towardCF = Math.cos((diff * Math.PI) / 180); // +1 = directly toward CF, -1 = directly away
  
  // Only count helping wind (toward centerfield)
  const outMph = Math.max(0, windMph * towardCF);
  
  // Apply ChirpBot's 1.8% per mph carry boost formula
  const mult = 1 + 0.018 * outMph;
  
  return { outMph, mult };
}

export async function getEnhancedWeather(venueName: string): Promise<EnhancedWeather> {
  const now = Date.now();
  
  // Normalize venue name to stadium key
  const venueKey = getStadiumKey(venueName) || venueName.toLowerCase().replace(/\s+/g, '-');
  
  // Check cache first
  const cached = cache.get(venueKey);
  if (cached && now - cached.ts < TTL_MS) {
    return cached.data;
  }

  const stadium = STADIUMS[venueKey];
  
  // Unknown stadium - return neutral conditions
  if (!stadium) {
    console.log(`🏟️ Unknown stadium: ${venueName} (${venueKey}), returning neutral weather`);
    const data: EnhancedWeather = { 
      windMph: 0, 
      windDirToDeg: null, 
      cfAzimuthDeg: null, 
      carryMult: 1, 
      outMph: 0 
    };
    cache.set(venueKey, { data, ts: now });
    return data;
  }

  // Handle closed roof - zero out carry and suppress wind tag
  const roof = stadium.roof ?? "open";
  if (roof === "closed") {
    console.log(`🏟️ ${venueName} has closed roof, wind effects disabled`);
    const data: EnhancedWeather = { 
      windMph: 0, 
      windDirToDeg: null, 
      cfAzimuthDeg: stadium.cfAzimuthDeg, 
      carryMult: 1, 
      outMph: 0, 
      roof 
    };
    cache.set(venueKey, { data, ts: now });
    return data;
  }

  // Get API key
  const apiKey = process.env.OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!apiKey || apiKey === "default_key" || apiKey === "your_actual_openweathermap_api_key_here") {
    console.log(`🌤️ No valid weather API key, returning neutral conditions for ${venueName}`);
    const data: EnhancedWeather = { 
      windMph: 0, 
      windDirToDeg: null, 
      cfAzimuthDeg: stadium.cfAzimuthDeg, 
      carryMult: 1, 
      outMph: 0, 
      roof 
    };
    cache.set(venueKey, { data, ts: now });
    return data;
  }

  try {
    // Fetch real weather data
    console.log(`🌤️ Fetching enhanced weather for ${venueName} (${stadium.lat}, ${stadium.lon})`);
    const owm = await fetchOWM(stadium.lat, stadium.lon, apiKey);
    
    // Calculate wind carry effects
    const { outMph, mult } = carryMultiplier(stadium.cfAzimuthDeg, owm.windDirToDeg, owm.windMph);

    const data: EnhancedWeather = {
      windMph: owm.windMph,
      windDirToDeg: owm.windDirToDeg,
      cfAzimuthDeg: stadium.cfAzimuthDeg,
      carryMult: mult,
      outMph,
      temperatureF: owm.temperatureF,
      pressureHpa: owm.pressureHpa,
      humidity: owm.humidity,
      condition: owm.condition,
      roof,
      // Only show wind tag if meaningful carry (>=5mph toward CF) and roof isn't closed
      tag: outMph >= 5 && roof !== "closed" ? `Wind +${Math.round((mult - 1) * 100)}%` : undefined
    };

    console.log(`✅ Enhanced weather for ${venueName}: ${owm.windMph}mph ${owm.windDirToDeg}° → ${outMph.toFixed(1)}mph toward CF (${Math.round((mult - 1) * 100)}% boost)`);
    
    cache.set(venueKey, { data, ts: now });
    return data;
    
  } catch (error) {
    console.error(`❌ Weather fetch failed for ${venueName}:`, error instanceof Error ? error.message : String(error));
    
    // Return neutral conditions on error (don't mislead users)
    const data: EnhancedWeather = { 
      windMph: 0, 
      windDirToDeg: null, 
      cfAzimuthDeg: stadium.cfAzimuthDeg, 
      carryMult: 1, 
      outMph: 0, 
      roof 
    };
    cache.set(venueKey, { data, ts: now });
    return data;
  }
}

// Enhanced weather functionality complete - legacy file removed