/**
 * ChirpBot V3 Runtime Configuration
 * Weather-on-Live Architecture
 * 
 * Defines timing, thresholds, and behavior for the dynamic engine system
 * where sport and weather engines only run when games are Live.
 */

export const RUNTIME = {
  // === GAME STATE POLLING ===
  calendarPoll: {
    defaultMs: 30_000,              // Faster baseline: poll status every 30s (was 60s)
    preStartWindowMin: 10,          // T-10m to T+5m tighten polling  
    preStartPollMs: 5_000,          // Faster pre-start: every 5s (was 10s)
    criticalWindowMin: 2,           // Critical detection window (T-2m to T+5m)
    criticalPollMs: 1_000,          // ULTRA-FAST: 1s polling for live games (was 2s)
    liveConfirmMs: 250,             // ULTRA-FAST: 250ms confirmation (was 500ms)
    requireConsecutive: 1,          // Single confirmation
    finalConfirmMs: 2_000,          // Faster final confirmation (was 5s)
    pausedPollMs: 30_000,           // Faster paused polling (was 45s)
  },

  // === WEATHER SYSTEM ===
  weather: {
    livePollMs: 90_000,             // Default weather polling (90s)
    armedPollMs: 20_000,            // When weather-sensitive alert armed (20s)
    armedDecayMin: 10,              // Relax after 10 min if quiet
    maxRetries: 3,                  // API retry attempts
    timeoutMs: 8_000,               // Weather API timeout
  },

  // === ENGINE LIFECYCLE ===
  engine: {
    tickMs: 1_000,                  // Evaluate cylinders every second
    prewarmTminusMin: 5,            // Start pre-warm at T-5min
    prewarmLazyFetchTminusMin: 2,   // Lazy fetch at T-2min  
    spinupTimeoutMs: 1_000,         // Max engine startup time
    shutdownTimeoutMs: 5_000,       // Max engine shutdown time
    healthCheckMs: 30_000,          // Engine health check interval
  },

  // === SPORT-SPECIFIC WEATHER THRESHOLDS ===
  cylinders: {
    // === MLB WEATHER TRIGGERS ===
    mlb: {
      // Wind alerts
      windShiftDeg: 20,             // Wind direction change ≥20°
      windMinMph: 8,                // Minimum wind speed for shift alert
      windOutMph: 14,               // Outbound wind boost (HR carry)
      windInMph: 14,                // Inbound wind suppression (HR block)
      
      // Temperature extremes  
      tempColdF: 45,                // Cold affects ball flight
      tempHotF: 90,                 // Heat affects pitcher stamina
      
      // Other conditions
      humidityDeltaPct: 10,         // Humidity spike ≥10% in 15min
      precipitationSensitive: true, // Alert on rain start/stop
      roofStateSensitive: true,     // Alert on retractable roof changes
    },

    // === NFL/NCAAF/CFL WEATHER TRIGGERS ===
    nfl: {
      sustainedWindMph: 18,         // Affects passing/kicking
      gustMph: 28,                  // Field goal/punt risk  
      coldF: 20,                    // Wind chill threshold
      heatIndexF: 95,               // Heat index threshold
      precipitationSensitive: true, // Rain/snow impacts
      lightningDelay: true,         // Stadium weather delay
    },
    ncaaf: {
      sustainedWindMph: 18,
      gustMph: 28, 
      coldF: 20,
      heatIndexF: 95,
      precipitationSensitive: true,
      lightningDelay: true,
    },
    cfl: {
      sustainedWindMph: 18,
      gustMph: 28,
      coldF: 20,
      heatIndexF: 95, 
      precipitationSensitive: true,
      lightningDelay: true,
    },

    // === INDOOR SPORTS (minimal weather) ===
    wnba: {
      // Indoor - only venue advisories
      venueAdvisories: true,
      roofLeaks: true,
    },
    nba: {
      // Indoor - only venue advisories  
      venueAdvisories: true,
      roofLeaks: true,
    },
  },

  // === GAME STATE WINDOWS ===
  gameStates: {
    // Pre-start detection window (T-10m to T+5m)
    preStartWindowMs: 10 * 60 * 1000,  // 10 minutes before
    postStartWindowMs: 5 * 60 * 1000,   // 5 minutes after
    
    // State confirmation requirements
    liveConfirmationRequired: true,
    finalConfirmationRequired: true,
    
    // Timezone handling
    useVenueTimezone: true,
    fallbackTimezone: 'America/New_York',
  },

  // === API RATE LIMITS & CACHING ===
  api: {
    maxConcurrentCalls: 10,
    defaultTtlMs: 30_000,           // 30s default cache TTL
    weatherTtlMs: 60_000,           // 60s weather cache TTL  
    gamesTtlMs: 15_000,             // 15s games cache TTL
    batchSize: 50,                  // Max games per batch
  },

  // === PERFORMANCE TARGETS ===
  performance: {
    startupMaxMs: 3_000,            // App startup time
    liveDetectionMaxMs: 20_000,     // Baseline detection (T-10m to T-2m)
    criticalDetectionMaxMs: 5_000,  // GUARANTEED ≤5s in critical window (T-2m to T+5m)
    confirmationMaxMs: 500,         // Confirmation adds <500ms latency
    engineStartupMaxMs: 1_000,      // Engine spin-up time
    firstAlertMaxMs: 3_000,         // First alert after Live
    
    // Realistic timing guarantees by window
    guaranteedDetection: {
      criticalWindow: 5_000,        // T-2m to T+5m: ≤5s GUARANTEED
      preStartWindow: 20_000,       // T-10m to T-2m: ≤20s acceptable
      baselineWindow: 120_000,      // Far future: ~2min acceptable
    },
  },
} as const & {
  cylinders: {
    [sport: string]: any;
  } & typeof RUNTIME.cylinders;
};

// === GAME STATES ENUM ===
export enum GameState {
  SCHEDULED = 'SCHEDULED',
  PREWARM = 'PREWARM',           // T-5min: pre-warming
  LIVE = 'LIVE',                 // Active game with engines running
  PAUSED = 'PAUSED',             // Delayed/Suspended (engines idle)
  FINAL = 'FINAL',               // Game finished
  TERMINATED = 'TERMINATED',      // Cleanup complete
}

// === WEATHER ARMING REASONS ===
export enum WeatherArmReason {
  WIND_SENSITIVE = 'WIND_SENSITIVE',
  PRECIPITATION = 'PRECIPITATION', 
  TEMPERATURE = 'TEMPERATURE',
  ROOF_STATE = 'ROOF_STATE',
  LIGHTNING = 'LIGHTNING',
  CUSTOM = 'CUSTOM',
}

// === TYPE EXPORTS ===
export type RuntimeConfig = typeof RUNTIME;
export type SportConfig = typeof RUNTIME.cylinders.mlb;
export type WeatherConfig = typeof RUNTIME.weather;
export type EngineConfig = typeof RUNTIME.engine;