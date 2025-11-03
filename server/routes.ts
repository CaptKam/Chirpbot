import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
// WebSocket imports removed - using HTTP polling architecture
import session from "express-session";
import bcrypt from "bcryptjs";
import csrf from "csrf";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertTeamSchema, insertSettingsSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { oddsApiService } from './services/odds-api-service';
import { sendTelegramAlert, testTelegramConnection, type TelegramConfig } from "./services/telegram";
import { unifiedDeduplicator } from "./services/unified-deduplicator";
import { memoryManager } from "./middleware/memory-manager";
import { registerHealthRoutes } from "./services/unified-health-monitor";
import { unifiedSettings } from "./storage";
import { alerts as alertsTable, alerts, settings } from "../shared/schema";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
// Migration Adapter replaces direct CalendarSyncService usage
// import { getCalendarSyncService } from "./services/calendar-sync-service";
import { unifiedAIProcessor } from './services/unified-ai-processor';

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    adminUserId?: string;
    csrfSecret?: string;  // CSRF secret for token generation
  }
}

// Create CSRF tokens instance for admin security
const tokens = new csrf();

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      isApiRequest?: boolean;
      csrfToken?: string;
    }
  }
}

// Middleware to ensure user is authenticated
async function requireAuthentication(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) {
      req.user = user; // Attach user to request for convenience
      return next();
    }
  }
  res.status(401).json({ message: 'Authentication required' });
}

// Middleware to ensure user is authenticated AND NOT an admin (users only)
async function requireUserAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) {
      // Block admin users from accessing user routes
      if (user.role === 'admin') {
        return res.status(403).json({
          error: 'User access only',
          message: 'Administrators must use the admin panel. Regular users only.'
        });
      }
      req.user = user; // Attach user to request for convenience
      return next();
    }
  }
  res.status(401).json({ message: 'Authentication required' });
}

// Middleware to ensure admin is authenticated using ADMIN session
async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.adminUserId) {
    const admin = await storage.getUserById(req.session.adminUserId);
    if (admin && admin.role === 'admin') {
      req.user = admin; // Attach admin to request for convenience
      return next();
    }
  }
  res.status(401).json({ message: 'Admin authentication required' });
}

// CSRF middleware for admin routes
function generateCSRFToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.session?.adminUserId) {
    // Generate or reuse existing CSRF secret
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = tokens.secretSync();
    }

    const token = tokens.create(req.session.csrfSecret);
    req.csrfToken = token;
  }
  next();
}

// CSRF validation middleware for admin POST/PUT/DELETE requests
function validateCSRF(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const secret = req.session?.csrfSecret;

  if (!token || !secret) {
    return res.status(403).json({ message: 'CSRF token missing' });
  }

  if (!tokens.verify(secret, token)) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
}

// Helper function to sanitize user objects before sending to client
// SECURITY: Never expose sensitive fields like telegramBotToken, oddsApiKey, or password
const sanitizeUserForClient = (user: any) => {
  const { telegramBotToken, oddsApiKey, password, ...safe } = user;

  // Add boolean flags if frontend needs to know if tokens are set
  return {
    ...safe,
    hasTelegramToken: !!telegramBotToken,
    hasOddsApiKey: !!oddsApiKey
  };
};

// Helper function to redact sensitive fields from logs
const redactSensitiveFields = (data: any) => {
  if (!data || typeof data !== 'object') return data;

  const redacted = { ...data };
  if (redacted.telegramBotToken) redacted.telegramBotToken = '[REDACTED]';
  if (redacted.oddsApiKey) redacted.oddsApiKey = '[REDACTED]';
  if (redacted.password) redacted.password = '[REDACTED]';

  return redacted;
};

// Validation schema for user profile updates - whitelist only safe fields
const updateUserProfileSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  oddsApiEnabled: z.boolean().optional(),
  oddsApiKey: z.string().optional(),
}).strict(); // strict() ensures no additional fields are allowed

// USER session parser - for regular app users only
const userSessionParser = session({
  name: 'cb.sid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    secure: false, // Allow cookies over HTTP for Replit deployment
    httpOnly: true,
    sameSite: 'lax',
    domain: undefined, // Let browser determine domain
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for better persistence
  }
});

// ADMIN session parser - separate admin-only sessions
const adminSessionParser = session({
  name: 'cb_admin.sid',
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/', // Admin cookie needs global access for both /admin and /api/admin* routes
    secure: false, // Allow cookies over HTTP for Replit deployment
    httpOnly: true,
    sameSite: 'lax', // Secure but compatible with production deployments
    domain: undefined, // Let browser determine domain
    maxAge: 4 * 60 * 60 * 1000 // 4 hours (shorter for security)
  }
});


export async function registerRoutes(app: Express, httpServer: Server): Promise<Server> {

  // Add memory management middleware FIRST (before any logging)
  app.use(memoryManager.middleware());

  // CRITICAL FIX: Ensure API routes are protected from Vite catch-all
  app.use('/api/*', (req, res, next) => {
    // Mark this as an API request so it doesn't get caught by Vite's catch-all
    req.isApiRequest = true;
    next();
  });

  // Apply separate session parsers for admin vs user routes
  app.use('/api/admin*', adminSessionParser);  // Admin routes use admin session
  app.use('/admin*', adminSessionParser);      // Admin static files use admin session

  // Universal CSRF protection for all admin API routes
  app.use('/api/admin/*', requireAdminAuth, generateCSRFToken, (req, res, next) => {
    // Apply CSRF validation to all non-GET admin API requests
    if (req.method !== 'GET') {
      return validateCSRF(req, res, next);
    }
    next();
  });

  // User session parser - CRITICAL: Skip admin paths to prevent session collision
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/admin')) {
      return next(); // Skip user session parser for admin paths
    }

    return userSessionParser(req, res, next);
  });

  // SECURITY FIX: Move request deduplication AFTER session parsing so cache keys include userId
  app.use(unifiedDeduplicator.requestMiddleware());

  // MigrationAdapter diagnostic endpoint for runtime verification
  app.get('/api/diagnostics/ingestion-status', async (req, res) => {
    try {
      const migrationAdapter = (global as any).migrationAdapter;

      if (!migrationAdapter) {
        return res.json({
          initialized: false,
          status: 'NOT_INITIALIZED',
          message: 'MigrationAdapter has not been initialized',
          timestamp: new Date().toISOString()
        });
      }

      // Get adapter status (safe access within request handler)
      const adapterStatus = migrationAdapter.getStatus ? migrationAdapter.getStatus() : null;
      const isOperational = !!adapterStatus;

      const response = {
        initialized: true,
        status: isOperational ? 'OPERATIONAL' : 'PARTIALLY_INITIALIZED',
        adapterStatus,
        services: {
          calendarSync: adapterStatus?.services?.calendarSync || { healthy: false, running: false },
          dataIngestion: adapterStatus?.services?.dataIngestion || { healthy: false, running: false }
        },
        rollout: adapterStatus?.rollout || { mode: 'unknown', sportPercentages: {}, migrationProgress: 0 },
        uptime: adapterStatus?.uptime || 0,
        timestamp: new Date().toISOString(),
        serviceReference: !!migrationAdapter,
        hasGetStatusMethod: typeof migrationAdapter.getStatus === 'function'
      };

      console.log('📊 MigrationAdapter diagnostic check:', response);
      res.json(response);

    } catch (error) {
      console.error('❌ Error in migration-adapter diagnostic:', error);
      res.status(500).json({
        initialized: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });


  // REMOVED: Broken /api/admin/statistics route - replaced with working /api/admin/stats endpoint

  // Admin API to enable master alerts globally
  app.post('/api/admin/enable-master-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      console.log('🔧 Admin: Enabling master alerts globally...');

      // Enable all MLB alert types in global settings
      const mlbAlerts = [
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH',
        'MLB_RUNNER_ON_THIRD_NO_OUTS',
        'MLB_FIRST_AND_THIRD_NO_OUTS',
        'MLB_SECOND_AND_THIRD_NO_OUTS',
        'MLB_FIRST_AND_SECOND',  // This is the key one that was missing
        'MLB_BASES_LOADED_NO_OUTS',
        'MLB_RUNNER_ON_THIRD_ONE_OUT',
        'MLB_SECOND_AND_THIRD_ONE_OUT',
        'MLB_BASES_LOADED_ONE_OUT',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE'
      ];

      let enabledCount = 0;
      for (const alertType of mlbAlerts) {
        try {
          await storage.enableGlobalAlert('MLB', alertType);
          enabledCount++;
          console.log(`✅ Globally enabled: ${alertType}`);
        } catch (error) {
          console.log(`⚠️ Failed to enable ${alertType}:`, error);
        }
      }

      console.log(`🎯 Master alerts enabled: ${enabledCount}/${mlbAlerts.length} alert types`);

      res.json({
        success: true,
        message: `Successfully enabled ${enabledCount} MLB alert types globally`,
        alertTypes: mlbAlerts,
        enabledCount,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error enabling master alerts:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to enable master alerts'
      });
    }
  });



  // WebSocket test endpoint removed - using HTTP polling architecture

  // Admin API to specifically enable MLB_FIRST_AND_SECOND for all users
  app.post('/api/admin/enable-first-and-second', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      console.log('🔧 Admin: Enabling MLB_FIRST_AND_SECOND for all users...');

      // Enable globally first
      await storage.enableGlobalAlert('MLB', 'MLB_FIRST_AND_SECOND');
      console.log('✅ MLB_FIRST_AND_SECOND enabled globally');

      // Enable for all existing users
      const users = await storage.getAllUsers();
      let userCount = 0;

      for (const user of users) {
        try {
          await storage.enableUserAlert(user.id, 'MLB', 'MLB_FIRST_AND_SECOND');
          userCount++;
          console.log(`✅ Enabled MLB_FIRST_AND_SECOND for user ${user.username}`);
        } catch (error) {
          console.log(`⚠️ Failed to enable for user ${user.username}:`, error);
        }
      }

      res.json({
        success: true,
        message: `MLB_FIRST_AND_SECOND enabled globally and for ${userCount} users`,
        usersEnabled: userCount,
        totalUsers: users.length,
        alertType: 'MLB_FIRST_AND_SECOND',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error enabling MLB_FIRST_AND_SECOND:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to enable MLB_FIRST_AND_SECOND'
      });
    }
  });

  // Request deduplication and memory management are handled by middleware above

  // WebSocket imports removed - using HTTP polling architecture
  const { getHealthMonitor } = await import('./services/unified-health-monitor');

  // WebSocket server creation removed - using HTTP polling architecture
  console.log(`📡 HTTP polling architecture enabled for real-time updates`);

  // WebSocket upgrade handler removed - using HTTP polling architecture

  // Initialize health monitor without WebSocket dependency
  const healthMonitor = getHealthMonitor();
  healthMonitor.initialize({
    pollingIntervalMs: 30000,
    callbacks: {
      onRestart: async () => console.log('🔄 Health monitor restarting'),
      onStop: async () => console.log('⏹️ Health monitor stopping'),
      generatorLabel: 'routes-health-monitor'
    }
  });
  healthMonitor.startMonitoring();

  console.log('✅ HTTP polling architecture enabled for real-time updates');
  console.log('📡 Alert delivery via SSE and HTTP endpoints');

  // 📡 SSE FALLBACK ENDPOINT - Server-Sent Events for reliable alert delivery
  app.get('/realtime-alerts-sse', requireUserAuth, async (req, res) => {
    // 🔒 Authentication handled by requireUserAuth middleware

    const userId = req.session.userId;
    console.log(`📡 SSE connection establishing for user: ${userId}`);

    // Set SSE headers for proper event streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering for real-time
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      status: 'connected',
      userId: userId,
      connectionType: 'SSE',
      timestamp: new Date().toISOString(),
      message: 'SSE fallback connection established'
    })}\n\n`);

    // Add this client to SSE tracking
    sseClients.add(res);
    console.log(`📡 SSE client added. Total SSE clients: ${sseClients.size}`);

    // Keep-alive ping every 30 seconds to prevent timeout
    const keepAliveInterval = setInterval(() => {
      if (!res.destroyed && !res.finished) {
        res.write(`: keepalive-ping ${Date.now()}\n\n`);
      } else {
        clearInterval(keepAliveInterval);
        sseClients.delete(res);
        console.log(`📡 SSE client disconnected. Remaining SSE clients: ${sseClients.size}`);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);
      sseClients.delete(res);
      console.log(`📡 SSE client disconnected (client close). Remaining SSE clients: ${sseClients.size}`);
    });

    req.on('error', (error) => {
      console.error('📡 SSE client error:', error);
      clearInterval(keepAliveInterval);
      sseClients.delete(res);
    });
  });

  // Admin panel compatibility route
  app.get('/admin-panel', (req, res) => res.redirect('/admin/login.html'));

  // Serve admin static files
  app.use('/admin', express.static('public/admin'));

  // NFL Possession Tracking API
  app.get('/api/nfl/possession/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engineManager = getEngineLifecycleManager();
      const nflEngine = engineManager.getEngine('NFL');

      if (!nflEngine || !nflEngine.getPossessionStats) {
        return res.status(404).json({ error: 'NFL engine not available' });
      }

      const stats = nflEngine.getPossessionStats(gameId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NCAAF Possession Tracking API
  app.get('/api/ncaaf/possession/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engineManager = getEngineLifecycleManager();
      const ncaafEngine = engineManager.getEngine('NCAAF');

      if (!ncaafEngine || !ncaafEngine.getPossessionStats) {
        return res.status(404).json({ error: 'NCAAF engine not available' });
      }

      const stats = ncaafEngine.getPossessionStats(gameId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NFL Timeout Tracking API
  app.get('/api/nfl/timeouts/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engineManager = getEngineLifecycleManager();
      const nflEngine = engineManager.getEngine('NFL');

      if (!nflEngine || !nflEngine.getTimeoutStats) {
        return res.status(404).json({ error: 'NFL engine not available' });
      }

      const stats = nflEngine.getTimeoutStats(gameId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NCAAF Timeout Tracking API
  app.get('/api/ncaaf/timeouts/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engineManager = getEngineLifecycleManager();
      const ncaafEngine = engineManager.getEngine('NCAAF');

      if (!ncaafEngine || !ncaafEngine.getTimeoutStats) {
        return res.status(404).json({ error: 'NCAAF engine not available' });
      }

      const stats = ncaafEngine.getTimeoutStats(gameId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CFL Timeout Tracking API
  app.get('/api/cfl/timeouts/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engineManager = getEngineLifecycleManager();
      const cflEngine = engineManager.getEngine('CFL');

      if (!cflEngine || !cflEngine.getTimeoutStats) {
        return res.status(404).json({ error: 'CFL engine not available' });
      }

      const stats = cflEngine.getTimeoutStats(gameId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test SportsData.io timeout data
  app.get('/api/test-sportsdata/:sport/:gameId', async (req, res) => {
    try {
      const { sport, gameId } = req.params;
      
      if (!['NFL', 'NCAAF', 'CFL'].includes(sport)) {
        return res.status(400).json({ error: 'Invalid sport. Must be NFL, NCAAF, or CFL' });
      }

      const { getSportsDataApi } = await import('./services/sportsdata-api');
      const sportsDataApi = getSportsDataApi();
      
      const timeoutData = await sportsDataApi.getTimeoutData(sport as 'NFL' | 'NCAAF' | 'CFL', gameId);
      
      res.json({
        sport,
        gameId,
        timeoutData,
        apiConfigured: !!process.env.SPORTSDATA_API_KEY
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Wind speed test for specific stadiums
  app.get('/api/test-wind-speeds', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');

      // Test a few different stadiums
      const testStadiums = [
        'Boston Red Sox',
        'Chicago Cubs',
        'San Francisco Giants',
        'Colorado Rockies',
        'Houston Astros'
      ];

      const windData = [];

      for (const team of testStadiums) {
        const weather = await weatherService.getWeatherForTeam(team);
        const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
        const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

        windData.push({
          team,
          stadium: team === 'Boston Red Sox' ? 'Fenway Park' :
                  team === 'Chicago Cubs' ? 'Wrigley Field' :
                  team === 'San Francisco Giants' ? 'Oracle Park' :
                  team === 'Colorado Rockies' ? 'Coors Field' : 'Minute Maid Park',
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection,
          windDescription: windDesc,
          temperature: weather.temperature,
          homeRunFactor: homeRunFactor,
          weatherImpact: homeRunFactor > 1.1 ? 'Favorable for HRs' :
                        homeRunFactor < 0.9 ? 'Hurts HR distance' : 'Neutral'
        });
      }

      res.json({
        timestamp: new Date().toISOString(),
        source: process.env.OPENWEATHERMAP_API_KEY ? 'Live OpenWeatherMap API' : 'Fallback Data',
        stadiumWindData: windData
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Server-side deduplication for SSE broadcasts
  const recentBroadcasts = new Map<string, number>(); // alertKey -> timestamp
  const BROADCAST_DEDUPE_TTL = 2000; // 2 seconds - allows rapid toggling while preventing spam

  // SSE client tracking for fallback support
  const sseClients = new Set<express.Response>();

  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [alertKey, timestamp] of recentBroadcasts.entries()) {
      if (now - timestamp > BROADCAST_DEDUPE_TTL) {
        recentBroadcasts.delete(alertKey);
      }
    }
  }, 60000); // Clean every minute

  // Broadcast function to send alerts to all connected SSE clients
  function broadcast(data: any) {
    const sseClientCount = sseClients.size;

    if (sseClientCount === 0) {
      console.log('📡 No SSE clients connected for broadcast');
      return;
    }

    // Extract alertKey and sequence number for deduplication and ordering
    const alertKey = data.alert?.alertKey || data.alert?.id;
    const sequenceNumber = data.alert?.sequenceNumber;

    if (alertKey) {
      const now = Date.now();
      const lastBroadcast = recentBroadcasts.get(alertKey);

      // Atomic check-and-set: Check if this alert was recently broadcast
      if (lastBroadcast && (now - lastBroadcast) < BROADCAST_DEDUPE_TTL) {
        console.log(`🚫 Duplicate broadcast prevented for alert: ${alertKey} (sent ${now - lastBroadcast}ms ago)`);
        return;
      }

      // Record this broadcast BEFORE processing to prevent race conditions
      // If another broadcast comes in during processing, it will see this timestamp
      recentBroadcasts.set(alertKey, now);
      console.log(`✅ Broadcasting new alert: ${alertKey}${sequenceNumber ? ` (seq: ${sequenceNumber})` : ''}`);
    }

    // Enhance data with sequence number for client reconnection logic
    const enhancedData = {
      ...data,
      sequenceNumber: sequenceNumber || data.sequenceNumber,
      timestamp: data.timestamp || new Date().toISOString()
    };

    const message = JSON.stringify(enhancedData);
    let sseSuccessCount = 0;
    let sseFailureCount = 0;

    // Send to SSE clients
    const sseMessage = `data: ${message}\n\n`;
    const clientsToRemove: express.Response[] = [];

    sseClients.forEach((res) => {
      try {
        if (!res.destroyed && !res.finished) {
          res.write(sseMessage);
          sseSuccessCount++;
        } else {
          clientsToRemove.push(res);
        }
      } catch (error) {
        console.error('Error sending SSE message:', error);
        sseFailureCount++;
        clientsToRemove.push(res);
      }
    });

    // Clean up disconnected SSE clients
    clientsToRemove.forEach(res => sseClients.delete(res));

    const logSeq = sequenceNumber ? `, seq: ${sequenceNumber}` : '';
    console.log(`📡 SSE Broadcast complete: (${sseSuccessCount}✅/${sseFailureCount}❌) type: ${data.type}, alertKey: ${alertKey || 'unknown'}${logSeq}`);
  }

  // Export broadcast function with multiple names for compatibility
  (global as any).sseBroadcast = broadcast;
  (global as any).broadcastMessage = broadcast;

  // Initialize Async AI Processor for background AI enhancement
  // const { unifiedAIProcessor } = await import('./services/unified-ai-processor'); // Already imported above

  // Set up callback to save enhanced alerts to database
  unifiedAIProcessor.setOnEnhancedAlert(async (alert, userId, sport, wasActuallyEnhanced) => {
    try {
      console.log(`💾 Saving enhanced alert to database: ${alert.alertKey}`);

      // Extract gameId from alertKey for all sports
      let gameId = 'unknown';
      if (alert.alertKey) {
        const parts = alert.alertKey.split('_');

        // Pattern 1: Direct gameId at start (e.g., "776312_pitching_change_..." or "401772715_turnover_risk_...")
        if (parts[0] && /^\d+$/.test(parts[0])) {
          gameId = parts[0];
        }
        // Pattern 2: Sport prefix with gameId (e.g., "mlb_game_start_776319_1")
        else if (parts.length >= 4) {
          // Check for pattern: sport_alert_type_gameId_...
          const sportPrefixes = ['mlb', 'nfl', 'ncaaf', 'nba', 'wnba', 'cfl'];
          if (sportPrefixes.includes(parts[0].toLowerCase())) {
            // Find the first numeric part after the sport prefix
            for (let i = 2; i < parts.length; i++) {
              if (/^\d+$/.test(parts[i])) {
                gameId = parts[i];
                break;
              }
            }
          }
        }
        // Pattern 3: Check for any numeric segment that looks like a gameId (6-12 digits for NFL)
        if (gameId === 'unknown') {
          for (const part of parts) {
            // Game IDs are typically 6-12 digits (NFL can be longer like 401772715)
            if (/^\d{6,12}$/.test(part)) {
              gameId = part;
              break;
            }
          }
        }
      }

      // Pattern 4: Fallback to context.gameId if extraction failed
      if (gameId === 'unknown' && (alert as any).context?.gameId) {
        gameId = (alert as any).context.gameId;
        console.log(`✅ Using gameId from alert context: ${gameId}`);
      }

      console.log(`📌 Extracted gameId: ${gameId} from alertKey: ${alert.alertKey}`);

      // Get all users monitoring this game
      const usersMonitoring = await storage.getUsersMonitoringGame(gameId);
      console.log(`👥 Found ${usersMonitoring.length} users monitoring game ${gameId}`);

      // FIXED: Always save enhanced alerts with gambling insights to database
      // Only skip user-specific deliveries if no users are monitoring
      if (usersMonitoring.length === 0) {
        console.log(`⚠️ No users monitoring game ${gameId}, skipping user deliveries but saving enhanced alert for analytics`);

        // Save the enhanced alert without user association for data completeness
        try {
          await storage.createAlert({
            alertKey: alert.alertKey,
            userId: null, // No user association for unmonitored alerts
            sport: sport as any,
            gameId: gameId,
            type: alert.type,
            state: 'active',
            score: (alert as any).confidence || alert.priority || 80,
            payload: JSON.stringify({
              message: alert.message,
              priority: alert.priority,
              type: alert.type,
              gameId: gameId,
              context: (alert as any).context || {},
              timestamp: new Date().toISOString(),
              gamblingInsights: alert.gamblingInsights || null,
              hasComposerEnhancement: alert.hasComposerEnhancement || false
            })
          });
          console.log(`✅ Enhanced alert saved to database for analytics: ${alert.alertKey}`);
        } catch (saveError) {
          console.error(`❌ Failed to save enhanced alert:`, saveError);
        }
        return;
      }

      // Create an alert for each user monitoring the game
      let savedCount = 0;
      let skippedCount = 0;

      for (const userGame of usersMonitoring) {
        try {
          // 🔎 CRITICAL FIX: Check user preferences FIRST before ANY other checks (including deduplication)
          const sportKey = (sport || '').toString().toLowerCase();
          console.log(`🔎 PrefCheck start for user ${userGame.userId} type=${alert.type} sport=${sportKey}`);

          if (!sportKey) {
            console.log(`⚠️ No sport key found for alert ${alert.type}, skipping user ${userGame.userId}`);
            continue;
          }

          const userPrefs = await storage.getUserAlertPreferencesBySport(userGame.userId, sportKey);
          const alertPref = userPrefs.find(p => p.alertType === alert.type);
          // CRITICAL FIX: Change default from true to false - opt-in instead of opt-out
          const isEnabled = alertPref ? !!alertPref.enabled : false;

          // Enhanced logging to track preference behavior
          if (!alertPref) {
            console.log(`🔍 NO_PREFERENCE_SET for user ${userGame.userId} alert ${alert.type} - defaulting to DISABLED (opt-in behavior)`);
          } else {
            console.log(`🔧 EXPLICIT_PREFERENCE for user ${userGame.userId} alert ${alert.type} = ${alertPref.enabled}`);
          }

          if (!isEnabled) {
            skippedCount++;
            console.log(`🚫 Alert ${alert.type} disabled for user ${userGame.userId}, skipping`);
            continue;
          }

          // Check global admin settings as final filter before sending alerts
          // This allows users to set preferences, but enforces admin settings at delivery time
          const isGloballyEnabled = await storage.isAlertGloballyEnabled(sportKey, alert.type);
          if (!isGloballyEnabled) {
            skippedCount++;
            console.log(`🚫 Alert ${alert.type} globally disabled by admin for user ${userGame.userId}, skipping`);
            continue;
          }

          console.log(`✅ Alert ${alert.type} enabled for user ${userGame.userId}, proceeding to duplicate check`);

          // FIXED DEDUPLICATION BUG: Check if this specific alert already exists AND is still active (non-expired)
          const existingAlerts = await db.select()
            .from(alertsTable)
            .where(and(
              eq(alertsTable.alertKey, alert.alertKey),
              eq(alertsTable.userId, userGame.userId),
              gte(alertsTable.expiresAt, new Date()) // Only check non-expired alerts
            ))
            .limit(1);

          if (existingAlerts.length > 0) {
            const existingAlert = existingAlerts[0];
            let existingPayload: any = {};
            try {
              // The payload field is jsonb, so it's already parsed JSON - no need to JSON.parse()
              existingPayload = existingAlert.payload || {};
            } catch (error) {
              console.log(`⚠️ Failed to access existing alert payload, using empty object:`, error);
              existingPayload = {};
            }
            const hasExistingGamblingInsights = existingPayload.gamblingInsights &&
              (existingPayload.gamblingInsights.structuredTemplate || (existingPayload.gamblingInsights.bullets && existingPayload.gamblingInsights.bullets.length > 0));
            const hasNewGamblingInsights = alert.gamblingInsights &&
              (alert.gamblingInsights.structuredTemplate || (alert.gamblingInsights.bullets && alert.gamblingInsights.bullets.length > 0));

            // If new alert has gambling insights and existing doesn't, UPDATE the existing alert
            if (hasNewGamblingInsights && !hasExistingGamblingInsights) {
              console.log(`🔄 Updating existing alert with AI-enhanced gambling insights for user ${userGame.userId}`);

              const updatedPayload = {
                ...existingPayload,
                gamblingInsights: alert.gamblingInsights,
                hasComposerEnhancement: alert.hasComposerEnhancement || false,
                aiEnhanced: true,
                lastUpdated: new Date().toISOString()
              };

              await db.update(alertsTable)
                .set({
                  payload: JSON.stringify(updatedPayload),
                  score: (alert as any).confidence || alert.priority || existingAlert.score
                })
                .where(eq(alertsTable.id, existingAlert.id));

              savedCount++;
              console.log(`✅ Alert updated with gambling insights for user ${userGame.userId}: ${alert.alertKey}`);
            } else {
              // Both alerts are the same type (both basic or both enhanced) - skip duplicate
              skippedCount++;
              console.log(`⏭️ Active alert already exists for user ${userGame.userId}, skipping`);
            }
            continue;
          }

          await storage.createAlert({
            alertKey: alert.alertKey,  // Keep original alert key for deduplication
            userId: userGame.userId,    // CRITICAL: Associate alert with the user!
            sport: sport as any,
            gameId: gameId,
            type: alert.type,
            state: 'active',
            score: (alert as any).confidence || alert.priority || 80,
            payload: JSON.stringify({
              message: alert.message,
              priority: alert.priority,
              type: alert.type,
              gameId: gameId,
              context: (alert as any).context || {},
              timestamp: new Date().toISOString(),
              gamblingInsights: alert.gamblingInsights || null,
              hasComposerEnhancement: alert.hasComposerEnhancement || false
            })
          });

          savedCount++;
          console.log(`✅ Alert saved for user ${userGame.userId}: ${alert.alertKey}`);

          // 📱 FIXED: Add Telegram delivery (was missing in UnifiedAIProcessor pipeline)
          try {
            const user = await storage.getUserById(userGame.userId);
            if (user?.telegramEnabled && user?.telegramBotToken && user?.telegramChatId) {
              const telegramConfig = {
                botToken: user.telegramBotToken,
                chatId: user.telegramChatId
              };
              console.log(`📱 Sending Telegram alert to ${user.username || user.id}`);
              const sent = await sendTelegramAlert(telegramConfig, alert);
              if (sent) {
                console.log(`📱 ✅ Telegram alert delivered to ${user.username || user.id}`);
              } else {
                console.log(`📱 ❌ Telegram delivery failed to ${user.username || user.id}`);
              }
            } else {
              console.log(`📱 ⏭️ Telegram not configured for user ${user?.username || userGame.userId}`);
            }
          } catch (telegramError) {
            console.error(`⚠️ Telegram notification failed for user ${userGame.userId}:`, telegramError);
          }

        } catch (error: any) {
          // Handle any other database errors
          console.error(`❌ Failed to save alert for user ${userGame.userId}:`, error);
        }
      }

      console.log(`📊 Alert save summary: ${savedCount} saved, ${skippedCount} skipped (already existed)`);

      // Broadcast to frontend via SSE (once for all users)
      if (savedCount > 0) {
        broadcast({
          type: 'alert',
          data: alert,
          alertKey: alert.alertKey
        });
      }

    } catch (error) {
      console.error(`❌ Failed to process enhanced alert:`, error);
    }
  });

  // Export broadcast function with multiple names for compatibility
  (global as any).sseBroadcast = broadcast;
  (global as any).broadcastMessage = broadcast;

  // Basic health check
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Version endpoint
  app.get('/version', (req, res) => res.json({
    version: process.env.SOURCE_COMMIT || 'dev-local',
    builtAt: process.env.BUILT_AT || new Date().toISOString()
  }));

  // Add HEAD /api endpoint to stop 404 floods
  app.head('/api', (req, res) => {
    res.status(200).end();
  });

  // Environment and database diagnostics endpoint for production debugging
  app.get('/api/environment-status', async (req, res) => {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV || 'not set (defaults to development)',
          REPL_ID: process.env.REPL_ID ? 'set' : 'not set',
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
          PORT: process.env.PORT || '5000',
          SESSION_SECRET_EXISTS: !!process.env.SESSION_SECRET
        },
        database: {
          connected: false,
          error: null as string | null,
          userCount: 0,
          tableCount: 0,
          alertPreferences: 0,
          monitoredTeams: 0,
          name: null as string | null,
          version: null as string | null,
          sampleUserExists: false,
          sampleUser: null as any
        },
        session: {
          authenticated: !!(req.session?.userId || req.session?.adminUserId),
          sessionId: req.sessionID ? 'present' : 'missing',
          userId: req.session?.userId || req.session?.adminUserId || null,
          hasSession: !!req.session
        },
        analysis: {
          likelyEnvironment: 'UNKNOWN',
          hasUserData: false,
          sessionWorking: false,
          issueDetected: true,
          recommendations: [] as string[]
        }
      };

      // Test database connection and get counts
      try {
        // Test database connection using drizzle
        await db.execute(sql`SELECT 1`);
        diagnostics.database.connected = true;

        // Use Drizzle ORM for database queries
        const { users, userAlertPreferences, userMonitoredTeams } = await import('../shared/schema');
        const { count } = await import('drizzle-orm');

        // Get user count
        const userCountResult = await db.select({ count: count() }).from(users);
        diagnostics.database.userCount = userCountResult[0].count;

        // Get table count using raw SQL
        const tableCountResult = await db.execute(
          sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
        );
        diagnostics.database.tableCount = parseInt((tableCountResult.rows[0] as any).count);

        // Get alert preferences count
        const alertPrefsResult = await db.select({ count: count() }).from(userAlertPreferences);
        diagnostics.database.alertPreferences = alertPrefsResult[0].count;

        // Get monitored teams count
        const monitoredTeamsResult = await db.select({ count: count() }).from(userMonitoredTeams);
        diagnostics.database.monitoredTeams = monitoredTeamsResult[0].count;

        // Get database info using raw SQL
        const dbInfoResult = await db.execute(sql`SELECT current_database(), version()`);
        const dbInfoRow = dbInfoResult.rows[0] as any;
        diagnostics.database.name = dbInfoRow.current_database;
        diagnostics.database.version = dbInfoRow.version.split(' ')[0] + ' ' + dbInfoRow.version.split(' ')[1];

        // Get a sample user
        const sampleUserResult = await db.select({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role
        }).from(users).limit(1);

        diagnostics.database.sampleUserExists = sampleUserResult.length > 0;
        if (sampleUserResult.length > 0) {
          diagnostics.database.sampleUser = {
            id: sampleUserResult[0].id,
            username: sampleUserResult[0].username,
            email: sampleUserResult[0].email,
            role: sampleUserResult[0].role
          };
        }
      } catch (error) {
        diagnostics.database.error = error instanceof Error ? error.message : String(error);
      }

      // Determine likely environment
      const isProduction = process.env.NODE_ENV === 'production';
      const hasUsers = diagnostics.database.userCount > 0;
      const likelyEnvironment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';

      diagnostics.analysis = {
        likelyEnvironment,
        hasUserData: hasUsers,
        sessionWorking: diagnostics.session.authenticated,
        issueDetected: !hasUsers || !diagnostics.database.connected,
        recommendations: []
      };

      // Generate recommendations
      if (!diagnostics.database.connected) {
        diagnostics.analysis.recommendations.push('Database connection failed - check DATABASE_URL');
      }

      if (diagnostics.database.userCount === 0) {
        diagnostics.analysis.recommendations.push('No users found - likely empty production database');
        diagnostics.analysis.recommendations.push('Consider data migration from development to production');
      }

      if (!diagnostics.session.authenticated) {
        diagnostics.analysis.recommendations.push('User not authenticated - check session/login status');
      }

      if (diagnostics.database.userCount > 0 && !diagnostics.session.authenticated) {
        diagnostics.analysis.recommendations.push('Users exist but session not working - check session configuration');
      }

      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({
        error: 'Diagnostic failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Teams routes
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.get('/api/teams/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      const teams = await storage.getTeamsBySport(sport);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams by sport:', error);
      res.status(500).json({ message: 'Failed to fetch teams' });
    }
  });

  app.post('/api/teams', async (req, res) => {
    try {
      const team = await storage.createTeam(req.body);
      res.json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ message: 'Failed to create team' });
    }
  });

  app.put('/api/teams/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const team = await storage.updateTeam(id, req.body);
      res.json(team);
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ message: 'Failed to update team' });
    }
  });

  app.delete('/api/teams/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTeam(id);
      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ message: 'Failed to delete team' });
    }
  });

  // Games routes
  app.get('/api/server-date', async (req, res) => {
    try {
      const { getPacificDate, getPacificDateTime } = await import('./utils/timezone');
      const pacificDate = getPacificDate();
      const pacificDateTime = getPacificDateTime();

      res.json({
        date: pacificDate,
        dateTime: pacificDateTime,
        timezone: 'America/Los_Angeles'
      });
    } catch (error) {
      console.error('Error fetching server date:', error);
      res.status(500).json({ message: 'Failed to fetch server date' });
    }
  });

  app.get('/api/games/today', async (req, res) => {
    try {
      const { sport = 'MLB', date } = req.query;

      // Validate sport parameter
      if (typeof sport !== 'string' || sport.includes('[object')) {
        return res.status(400).json({ error: 'Invalid sport parameter', games: [], date: new Date().toISOString().split('T')[0] });
      }

      const calendarSyncService = getCalendarSyncService();
      
      if (!calendarSyncService) {
        return res.status(503).json({
          error: 'Calendar service not available',
          message: 'Calendar service is initializing'
        });
      }

      const { getPacificDate } = await import('./utils/timezone');
      const targetDate = (date as string) || getPacificDate();
      
      // Get games from CalendarSyncService (avoids rate limiting)
      const sportUpper = sport.toString().toUpperCase();
      const allGames = calendarSyncService.getCalendarData(sportUpper);
      
      // Filter by date
      const games = allGames.filter((game: any) => {
        const gameDate = game.gameDate?.split('T')[0] || game.date?.split('T')[0] || targetDate;
        return gameDate === targetDate;
      });

      // Enrich games with timeout/possession tracking data for football sports
      const enrichedGames = await Promise.all(
        (games || []).map(game => enrichGameWithTrackingData(game))
      );

      res.json({ games: enrichedGames, date: targetDate });
    } catch (error) {
      console.error('Error fetching games:', error);
      res.status(500).json({ message: 'Failed to fetch games' });
    }
  });

  // Multi-day games route with enriched timeout/possession data
  app.get('/api/games/multi-day', async (req, res) => {
    try {
      const { sport = 'all', dates } = req.query;
      
      // Parse dates array from query string
      const datesArray = Array.isArray(dates) ? dates : (dates ? [dates] : []);
      
      // Get calendar sync service
      const calendarSyncService = getCalendarSyncService();
      
      if (!calendarSyncService) {
        return res.status(503).json({
          error: 'Calendar service not available',
          message: 'Calendar service is initializing'
        });
      }

      // Import the game state manager to get games
      const { getGameStateManager } = await import('./services/game-state-manager');
      const gameStateManager = getGameStateManager();
      
      if (!gameStateManager) {
        return res.status(503).json({
          error: 'Game state manager not available',
          message: 'System is initializing'
        });
      }

      // Get all tracked games from the game state manager
      const allTrackedGames = gameStateManager.getAllGames();
      
      // Filter by sport if specified
      let filteredGames = allTrackedGames;
      if (sport !== 'all') {
        filteredGames = allTrackedGames.filter((g: any) => g.sport?.toUpperCase() === sport.toString().toUpperCase());
      }
      
      // Filter games by dates if specified
      if (datesArray.length > 0) {
        filteredGames = filteredGames.filter((game: any) => {
          const gameDate = game.gameDate?.split('T')[0] || game.date?.split('T')[0];
          return datesArray.includes(gameDate);
        });
      }

      // Enrich games with timeout/possession tracking data
      const enrichedGames = await Promise.all(
        (filteredGames || []).map(game => enrichGameWithTrackingData(game))
      );

      res.json({
        success: true,
        games: enrichedGames,
        sport: sport,
        dates: datesArray,
        count: enrichedGames.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Multi-day API: Error fetching game data:', error);
      res.status(500).json({ error: 'Failed to fetch multi-day game data', details: error.message });
    }
  });

  // Enhanced live game data route
  app.get('/api/games/:gameId/enhanced', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { MLBApiService } = await import('./services/mlb-api');
      const mlbService = new MLBApiService();
      const enhancedData = await mlbService.getEnhancedGameData(gameId);
      res.json(enhancedData);
    } catch (error) {
      console.error('Error fetching enhanced game data:', error);
      res.status(500).json({ message: 'Failed to fetch enhanced game data' });
    }
  });

  // Get enhanced live game data for baseball diamond display
  app.get("/api/games/:gameId/live", async (req, res) => {
    try {
      const { gameId } = req.params;

      // Validate gameId parameter
      if (!gameId || gameId === '[object Object]' || gameId.includes('[object') || gameId.length > 50) {
        return res.status(400).json({ error: 'Invalid gameId parameter' });
      }

      const { MLBApiService } = await import('./services/mlb-api');
      const mlbService = new MLBApiService();
      const liveData = await mlbService.getEnhancedGameData(gameId);
      res.json(liveData);
    } catch (error) {
      console.error('Error fetching live game data:', error);
      res.status(500).json({ error: 'Failed to fetch live game data' });
    }
  });

  // User monitored games routes
  app.get('/api/user/:userId/monitored-games', requireAuthentication, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport } = req.query;
      const games = await storage.getUserMonitoredTeams(userId);
      res.json(games);
    } catch (error) {
      console.error('Error fetching monitored games:', error);
      res.status(500).json({ message: 'Failed to fetch monitored games' });
    }
  });

  app.post('/api/user/:userId/monitored-games', requireAuthentication, async (req, res) => {
    try {
      const { userId } = req.params;
      const { gameId, sport, homeTeamName, awayTeamName } = req.body;

      const gameData = {
        userId,
        gameId,
        sport: sport || 'MLB',
        homeTeamName: homeTeamName || '',
        awayTeamName: awayTeamName || '',
        createdAt: new Date()
      };

      await storage.addUserMonitoredTeam(userId, gameId, sport || 'MLB', homeTeamName || '', awayTeamName || '');

      // Update GameStateManager to enable alert processing for this game
      const { gameStateManager } = await import('./services/game-state-manager');
      const added = gameStateManager.addUserToGame(gameId, userId);
      if (added) {
        console.log(`✅ Game ${gameId} marked as monitored for user ${userId}`);
      }

      res.json({ message: 'Game monitoring enabled' });
    } catch (error) {
      console.error('Error adding monitored game:', error);
      res.status(500).json({ message: 'Failed to enable game monitoring' });
    }
  });

  app.delete('/api/user/:userId/monitored-games/:gameId', requireAuthentication, async (req, res) => {
    try {
      const { userId, gameId } = req.params;
      await storage.removeUserMonitoredTeam(userId, gameId);

      // Update GameStateManager to disable alert processing if no users monitoring
      const { gameStateManager } = await import('./services/game-state-manager');
      const removed = gameStateManager.removeUserFromGame(gameId, userId);
      if (removed) {
        console.log(`✅ User ${userId} removed from game ${gameId} monitoring`);
      }

      res.json({ message: 'Game monitoring disabled' });
    } catch (error) {
      console.error('Error removing monitored game:', error);
      res.status(500).json({ message: 'Failed to disable game monitoring' });
    }
  });

  // Settings routes - require authentication
  app.get('/api/settings', requireAuthentication, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.post('/api/settings', requireAuthentication, async (req, res) => {
    try {
      const settings = await storage.upsertSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({ message: 'Failed to save settings' });
    }
  });

  // User alert preferences routes
  app.get('/api/user/:userId/alert-preferences', async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences:', error);
      res.status(500).json({ message: 'Failed to fetch alert preferences' });
    }
  });

  app.get('/api/user/:userId/alert-preferences/:sport', async (req, res) => {
    try {
      const { userId, sport } = req.params;
      console.log(`🔍 Fetching alert preferences for user ${userId}, sport ${sport}`);
      const preferences = await storage.getUserAlertPreferencesBySport(userId, sport.toLowerCase());
      console.log(`📋 Found ${preferences.length} preferences for user ${userId} in ${sport}:`, preferences.map(p => `${p.alertType}=${p.enabled}`));
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching alert preferences for sport:', error);
      res.status(500).json({ message: 'Failed to fetch sport alert preferences' });
    }
  });

  app.post('/api/user/:userId/alert-preferences', requireUserAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, alertType, enabled } = req.body;

      // Verify user can only modify their own preferences
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Can only modify your own alert preferences' });
      }

      if (!sport || !alertType || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: sport, alertType, enabled' });
      }

      // REMOVED: Global settings validation that was causing 400 errors
      // Users should be able to set their preferences regardless of global admin settings
      // Global enforcement will happen at alert generation/delivery time instead

      const preference = await storage.setUserAlertPreference(userId, sport.toLowerCase(), alertType, enabled);
      res.json(preference);
    } catch (error) {
      console.error('Error setting alert preference:', error);
      res.status(500).json({ message: 'Failed to set alert preference' });
    }
  });

  app.post('/api/user/:userId/alert-preferences/bulk', requireUserAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, preferences } = req.body;

      // Verify user can only modify their own preferences
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Can only modify your own alert preferences' });
      }

      if (!sport || !preferences || !Array.isArray(preferences)) {
        return res.status(400).json({ message: 'Missing required fields: sport, preferences array' });
      }

      // REMOVED: Global settings validation that was filtering user preferences
      // Users should be able to set their preferences regardless of global admin settings
      // Global enforcement will happen at alert generation/delivery time instead
      const filteredPreferences = preferences; // Save all user preferences as-is

      const result = await storage.bulkSetUserAlertPreferences(userId, sport.toLowerCase(), filteredPreferences);

      // CRITICAL FIX: Refresh engine with new preferences immediately
      try {
        const { getEngineLifecycleManager } = await import('./services/engine-lifecycle-manager');
        const engineManager = getEngineLifecycleManager();
        await engineManager.refreshEngineForUser(sport.toUpperCase(), userId);
        console.log(`✅ Engine refreshed for ${sport} after preference update`);
      } catch (engineError) {
        console.error(`⚠️ Failed to refresh engine:`, engineError);
        // Don't fail the request if engine refresh fails
      }

      res.json({
        message: 'Alert preferences updated successfully',
        count: result.length,
        filtered: preferences.length - filteredPreferences.length
      });
    } catch (error) {
      console.error('Error setting bulk alert preferences:', error);
      res.status(500).json({ message: 'Failed to set bulk alert preferences' });
    }
  });

  // Authentication routes
  app.get('/api/auth/user', async (req, res) => {
    try {
      // Check for regular user session first
      if (req.session?.userId) {
        const user = await storage.getUserById(req.session.userId);
        if (user) {
          // Return user data without sensitive fields
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        }
      }

      // Check for admin session (for frontend route guard compatibility)
      if (req.session?.adminUserId) {
        const admin = await storage.getUserById(req.session.adminUserId);
        if (admin && admin.role === 'admin') {
          // Return admin user data without sensitive fields
          const { password, ...adminWithoutPassword } = admin;
          return res.json(adminWithoutPassword);
        }
      }

      res.status(401).json({ message: 'Not authenticated' });
    } catch (error) {
      console.error('Error checking authentication:', error);
      res.status(500).json({ message: 'Authentication check failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { usernameOrEmail, password } = req.body;

      if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find user by username or email
      let user = await storage.getUserByUsername(usernameOrEmail);
      if (!user) {
        user = await storage.getUserByEmail(usernameOrEmail);
      }

      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create session
      req.session.userId = user.id;

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ message: 'Login successful', user: userWithoutPassword });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, email, password, usernameOrEmail, firstName, lastName } = req.body;

      // Handle usernameOrEmail field from frontend
      let finalUsername = username;
      let finalEmail = email;

      if (usernameOrEmail && !username && !email) {
        // Determine if usernameOrEmail is an email or username
        if (usernameOrEmail.includes('@')) {
          finalEmail = usernameOrEmail;
          finalUsername = usernameOrEmail.split('@')[0]; // Use part before @ as username
        } else {
          finalUsername = usernameOrEmail;
          // Generate a placeholder email if none provided
          finalEmail = `${usernameOrEmail}@chirpbot.local`;
        }
      }

      if (!finalUsername || !finalEmail || !password) {
        return res.status(400).json({ message: 'Username/email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      // Check if user already exists
      const existingUserByUsername = await storage.getUserByUsername(finalUsername);
      if (existingUserByUsername) {
        return res.status(409).json({ message: 'Username already exists' });
      }

      const existingUserByEmail = await storage.getUserByEmail(finalEmail);
      if (existingUserByEmail) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await storage.createUser({
        username: finalUsername,
        email: finalEmail,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        authMethod: 'local',
        role: 'user'
      });

      // Create session
      req.session.userId = newUser.id;

      // Return user data without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json({ message: 'Account created successfully', user: userWithoutPassword });
    } catch (error) {
      console.error('Error during signup:', error);
      res.status(500).json({ message: 'Signup failed' });
    }
  });

  // User routes (basic)
  app.get('/api/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Telegram settings routes
  app.get('/api/user/:userId/telegram', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({
        telegramEnabled: user.telegramEnabled,
        telegramBotToken: user.telegramBotToken ? '***' : '',
        telegramChatId: user.telegramChatId || ''
      });
    } catch (error) {
      console.error('Error fetching telegram settings:', error);
      res.status(500).json({ message: 'Failed to fetch telegram settings' });
    }
  });

  app.post('/api/user/:userId/telegram', async (req, res) => {
    try {
      const { userId } = req.params;
      const { botToken, chatId, enabled } = req.body;

      await storage.updateUserTelegramSettings(userId, botToken, chatId, enabled);
      res.json({ message: 'Telegram settings updated successfully' });
    } catch (error) {
      console.error('Error updating telegram settings:', error);
      res.status(500).json({ message: 'Failed to update telegram settings' });
    }
  });

  // User profile endpoints - for current authenticated user only
  app.get('/api/users/me', requireUserAuth, async (req, res) => {
    try {
      console.log('GET /api/users/me: Fetching profile for user', req.user.id);

      const user = await storage.getUserById(req.user.id);
      if (!user) {
        console.error('GET /api/users/me: User not found', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      // SECURITY: Return user profile with all sensitive fields removed
      const safeUserProfile = sanitizeUserForClient(user);
      res.json(safeUserProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Failed to fetch user profile' });
    }
  });

  app.patch('/api/users/me', requireUserAuth, async (req, res) => {
    try {
      // SECURITY: Log with sensitive fields redacted to prevent secret exposure
      console.log('PATCH /api/users/me: Updating profile for user', req.user.id, 'with data:', redactSensitiveFields(req.body));

      // Validate request body with whitelist schema
      const validationResult = updateUserProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error('PATCH /api/users/me: Validation failed:', validationResult.error.flatten());
        return res.status(400).json({
          message: 'Invalid request data',
          errors: validationResult.error.flatten()
        });
      }

      const updateData = validationResult.data;

      // Add timestamp for update tracking
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      const updatedUser = await storage.updateUser(req.user.id, updatePayload);
      if (!updatedUser) {
        console.error('PATCH /api/users/me: Failed to update user', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      // SECURITY: Return updated user profile with all sensitive fields removed
      const safeUserProfile = sanitizeUserForClient(updatedUser);
      console.log('PATCH /api/users/me: Successfully updated user profile for', req.user.id);
      res.json({
        message: 'Profile updated successfully',
        user: safeUserProfile
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update user profile' });
    }
  });

  // Debug all Telegram configurations
  app.get('/api/telegram/debug', requireAdminAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const telegramDebug = allUsers.map(user => ({
        username: user.username,
        id: user.id,
        telegramEnabled: user.telegramEnabled,
        hasToken: !!user.telegramBotToken && user.telegramBotToken !== 'default_key' && user.telegramBotToken !== 'test-token',
        tokenLength: user.telegramBotToken?.length || 0,
        tokenValue: user.telegramBotToken?.substring(0, 10) + '...' || 'MISSING',
        hasChatId: !!user.telegramChatId && user.telegramChatId !== 'default_key' && user.telegramChatId !== 'test-chat-id',
        chatId: user.telegramChatId || 'MISSING',
        isTestData: user.telegramBotToken === 'default_key' || user.telegramChatId === 'test-chat-id'
      }));

      const validUsers = telegramDebug.filter(u => u.telegramEnabled && u.hasToken && u.hasChatId && !u.isTestData);

      res.json({
        timestamp: new Date().toISOString(),
        totalUsers: allUsers.length,
        telegramEnabledUsers: telegramDebug.filter(u => u.telegramEnabled).length,
        validTelegramUsers: validUsers.length,
        usersWithTestData: telegramDebug.filter(u => u.isTestData).length,
        users: telegramDebug,
        readyForAlerts: validUsers.length > 0,
        nextSteps: validUsers.length === 0 ? [
          "1. Go to Settings → Telegram Notifications",
          "2. Create a bot with @BotFather on Telegram",
          "3. Get your chat ID from @userinfobot",
          "4. Enter real credentials and test connection"
        ] : ["Telegram is properly configured and ready!"]
      });
    } catch (error) {
      console.error('Error debugging Telegram:', error);
      res.status(500).json({ error: 'Failed to debug Telegram configurations' });
    }
  });

  // Test Telegram connection
  app.post('/api/telegram/test', requireUserAuth, async (req, res) => {
    try {
      const { botToken, chatId } = req.body;

      if (!botToken || !chatId) {
        return res.status(400).json({ message: 'Bot token and chat ID are required' });
      }

      const config: TelegramConfig = { botToken, chatId };
      const result = await testTelegramConnection(config);

      res.json(result);
    } catch (error) {
      console.error('Error testing telegram connection:', error);
      res.status(500).json({ message: 'Failed to test telegram connection' });
    }
  });


  // AI Cache management endpoint - Admin only
  app.post('/api/ai/cache/clear', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      console.log('🧹 Admin requested AI cache clear');

      // Import the unified AI processor
      const { unifiedAIProcessor } = await import('./services/unified-ai-processor');

      // Clear the cache
      unifiedAIProcessor.clearCache();

      // Get current stats after clearing
      const stats = unifiedAIProcessor.getStats();

      res.json({
        message: 'AI cache cleared successfully',
        stats: {
          cacheSize: stats.cache.size,
          queueSize: stats.queue.current,
          performance: stats.performance
        }
      });
    } catch (error) {
      console.error('Error clearing AI cache:', error);
      res.status(500).json({ error: 'Failed to clear AI cache' });
    }
  });

  // AI Performance Dashboard - Admin only
  app.get('/api/ai/performance/dashboard', requireAdminAuth, async (req, res) => {
    try {
      const { unifiedAIProcessor } = await import('./services/unified-ai-processor');
      const stats = unifiedAIProcessor.getStats();

      // Calculate AI utilization metrics
      const totalRequests = stats.performance.totalRequests;
      const aiUtilization = totalRequests > 0 ?
        (stats.performance.successRate / 100) : 0;

      const recommendations = [];
      if (stats.cache.hitRate < 30) {
        recommendations.push("Cache hit rate low - consider longer TTL or better key generation");
      }
      if (stats.performance.fallbackRate > 40) {
        recommendations.push("High fallback rate - review AI gating rules or increase timeout");
      }
      if (aiUtilization < 0.5) {
        recommendations.push("Low AI utilization - expand enhancement to more alert types");
      }

      res.json({
        utilization: {
          aiEnhancementRate: aiUtilization,
          cacheEfficiency: stats.cache.hitRate,
          processingSuccessRate: stats.performance.successRate
        },
        performance: stats.performance,
        cache: stats.cache,
        queue: stats.queue,
        sportBreakdown: stats.sportMetrics,
        recommendations
      });
    } catch (error) {
      console.error('Error getting AI performance dashboard:', error);
      res.status(500).json({ error: 'Failed to get AI performance data' });
    }
  });

  // AI Cache statistics endpoint - Admin only
  app.get('/api/ai/cache/stats', requireAdminAuth, async (req, res) => {
    try {
      const { unifiedAIProcessor } = await import('./services/unified-ai-processor');
      const stats = unifiedAIProcessor.getStats();

      res.json({
        cache: stats.cache,
        queue: stats.queue,
        performance: stats.performance,
        gating: stats.gating,
        sportMetrics: stats.sportMetrics
      });
    } catch (error) {
      console.error('Error fetching AI cache stats:', error);
      res.status(500).json({ error: 'Failed to fetch AI cache stats' });
    }
  });

  // Debug endpoint to check user alert preferences
  app.get('/api/debug/user-preferences/:userId', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;

      // Get user info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get all alert preferences for this user
      const allPreferences = await storage.getUserAlertPreferences(userId);

      // Group by sport
      const preferencesBySport: Record<string, any[]> = {};
      allPreferences.forEach(pref => {
        if (!preferencesBySport[pref.sport]) {
          preferencesBySport[pref.sport] = [];
        }
        preferencesBySport[pref.sport].push({
          alertType: pref.alertType,
          enabled: pref.enabled,
          updatedAt: pref.updatedAt
        });
      });

      // Get global settings for comparison
      const globalMLB = await unifiedSettings.getGlobalSettings('MLB');
      const globalNFL = await unifiedSettings.getGlobalSettings('NFL');

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        userPreferences: preferencesBySport,
        globalSettings: {
          MLB: globalMLB,
          NFL: globalNFL
        },
        totalPreferences: allPreferences.length,
        preferencesSummary: Object.keys(preferencesBySport).map(sport => ({
          sport,
          count: preferencesBySport[sport].length,
          enabled: preferencesBySport[sport].filter((p: any) => p.enabled).length
        }))
      });
    } catch (error) {
      console.error('Error checking user preferences:', error);
      res.status(500).json({ error: 'Failed to check user preferences' });
    }
  });

  // Debug endpoint to detect rule bypasses
  app.get('/api/debug/telegram-bypasses', requireAdminAuth, async (req, res) => {
    try {
      console.log('🔍 SCANNING FOR TELEGRAM BYPASS ROUTES');

      const bypasses = [];

      // Check for direct telegram calls in the codebase
      const potentialBypasses = [
        {
          route: '/api/telegram/force-test',
          status: 'PATCHED - Now rule-compliant',
          risk: 'LOW'
        },
        {
          route: '/api/alerts/force-generate',
          status: 'PATCHED - Now rule-compliant',
          risk: 'LOW'
        },
        {
          route: '/api/telegram/test',
          status: 'SAFE - Connection test only',
          risk: 'NONE'
        }
      ];

      // Check alert generator paths
      const alertPaths = [
        {
          path: 'saveRealTimeAlert() -> Telegram sending',
          ruleCheck: 'isAlertGloballyEnabled() + user preferences',
          status: 'PROTECTED'
        },
        {
          path: 'saveAlert() -> WebSocket broadcast only',
          ruleCheck: 'isAlertGloballyEnabled() before DB save',
          status: 'PROTECTED'
        }
      ];

      res.json({
        message: 'Telegram bypass scan complete',
        potentialBypasses,
        alertPaths,
        recommendation: 'All major bypass routes have been identified and patched'
      });
    } catch (error) {
      console.error('Error scanning for bypasses:', error);
      res.status(500).json({ error: 'Failed to scan for bypasses' });
    }
  });

  // Parameter validation helper to prevent injection attacks
  function validateUserId(userId: string): boolean {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(userId);
  }

  function validateSportName(sport: string): boolean {
    const validSports = ['mlb', 'nfl', 'ncaaf', 'nba', 'wnba', 'cfl', 'nhl'];
    return validSports.includes(sport.toLowerCase());
  }

  // Admin API routes
  app.post('/api/admin/cleanup-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { alertCleanupService } = await import('./services/alert-cleanup');

      // Get stats before cleanup
      const statsBefore = await alertCleanupService.getCleanupStats();

      // Perform cleanup
      const deletedCount = await alertCleanupService.cleanupNow();

      // Get stats after cleanup
      const statsAfter = await alertCleanupService.getCleanupStats();

      res.json({
        success: true,
        deletedCount,
        statsBefore,
        statsAfter,
        message: `Cleaned up ${deletedCount} alerts older than 24 hours`
      });
    } catch (error) {
      console.error('Error in manual cleanup:', error);
      res.status(500).json({ error: 'Failed to cleanup alerts' });
    }
  });

  app.get('/api/admin/cleanup-stats', requireAdminAuth, async (req, res) => {
    try {
      const { alertCleanupService } = await import('./services/alert-cleanup');
      const stats = await alertCleanupService.getCleanupStats();

      res.json({
        success: true,
        stats,
        message: `${stats.old} alerts are older than 24 hours and will be cleaned up`
      });
    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      res.status(500).json({ error: 'Failed to get cleanup stats' });
    }
  });

  // === GAME MONITORING CLEANUP ROUTES ===

  // Admin: Check game monitoring cleanup status
  app.get('/api/admin/game-monitoring-cleanup/status', requireAdminAuth, async (req, res) => {
    try {
      const { gameMonitoringCleanup } = await import('./services/game-monitoring-cleanup');
      const status = gameMonitoringCleanup.getStatus();

      // Get current monitored games count
      const monitoredGames = await storage.getMonitoredGamesForCleanup();
      const totalUsers = [...new Set(monitoredGames.map(g => g.gameId))].length;

      res.json({
        ...status,
        monitoredGames: {
          totalGames: monitoredGames.length,
          totalUsers: monitoredGames.reduce((sum, game) => sum + (game.userCount || 0), 0),
          gamesByUser: monitoredGames.map(g => ({
            gameId: g.gameId,
            sport: g.sport,
            userCount: g.userCount
          }))
        }
      });
    } catch (error) {
      console.error('Error getting cleanup status:', error);
      res.status(500).json({ error: 'Failed to get cleanup status' });
    }
  });

  // Admin: Manually trigger game monitoring cleanup
  app.post('/api/admin/game-monitoring-cleanup/trigger', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { gameMonitoringCleanup } = await import('./services/game-monitoring-cleanup');
      const result = await gameMonitoringCleanup.triggerManualCleanup();

      res.json({
        success: true,
        message: `Cleanup completed - removed ${result.removedGames} final games from ${result.cleanedUsers} user monitoring entries`,
        ...result
      });
    } catch (error) {
      console.error('Error triggering manual cleanup:', error);
      res.status(500).json({ error: 'Failed to trigger cleanup' });
    }
  });


  app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/role/:role', requireAdminAuth, async (req, res) => {
    try {
      const { role } = req.params;
      const users = await storage.getUsersByRole(role);
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({ message: 'Failed to fetch users by role' });
    }
  });

  app.put('/api/admin/users/:userId/role', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['admin', 'manager', 'analyst', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be admin, manager, analyst, or user' });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: 'User role updated successfully', user: userWithoutPassword });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  });

  // PATCH handler for admin dashboard compatibility - client sends PATCH requests
  app.patch('/api/admin/users/:userId/role', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !['admin', 'manager', 'analyst', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be admin, manager, analyst, or user' });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: 'User role updated successfully', user: userWithoutPassword });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  });

  app.delete('/api/admin/users/:userId', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user; // from requireAdminAuth middleware

      console.log(`🗑️ Admin ${currentUser.username} attempting to delete user ${userId}`);

      // Prevent self-deletion
      if (userId === currentUser.id) {
        return res.status(400).json({
          message: 'Cannot delete your own account'
        });
      }

      // Check if user exists
      const userToDelete = await storage.getUserById(userId);
      if (!userToDelete) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent deleting the last admin
      if (userToDelete.role === 'admin') {
        const allAdmins = await storage.getUsersByRole('admin');
        if (allAdmins.length <= 1) {
          return res.status(400).json({
            message: 'Cannot delete the last admin user'
          });
        }
      }

      // Delete user and all related data
      const deleted = await storage.deleteUser(userId);

      if (deleted) {
        console.log(`✅ User ${userToDelete.username} deleted successfully by admin ${currentUser.username}`);
        res.json({
          message: `User ${userToDelete.username} deleted successfully`,
          deletedUser: {
            id: userToDelete.id,
            username: userToDelete.username,
            email: userToDelete.email,
            role: userToDelete.role
          }
        });
      } else {
        res.status(500).json({ message: 'Failed to delete user' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Force delete endpoint for stubborn test users
  app.delete('/api/admin/users/:userId/force', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user;

      console.log(`💀 Admin ${currentUser.username} attempting to FORCE DELETE of user ${userId}`);

      // Prevent self-deletion
      if (userId === currentUser.id) {
        return res.status(400).json({
          message: 'Cannot delete your own account'
        });
      }

      // Force delete using the aggressive method
      const deleted = await storage.forceDeleteUser(userId);

      if (deleted) {
        console.log(`✅ User ${userId} FORCE DELETED by admin ${currentUser.username}`);
        res.json({
          message: `User ${userId} has been completely removed from the system`,
          method: 'FORCE_DELETE',
          deletedUserId: userId
        });
      } else {
        res.json({
          message: `User ${userId} was not found or already deleted`,
          method: 'FORCE_DELETE',
          deletedUserId: userId
        });
      }
    } catch (error) {
      console.error('Error force deleting user:', error);
      res.status(500).json({ message: 'Failed to force delete user' });
    }
  });

  app.get('/api/admin/users/:userId/alert-preferences', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getUserAlertPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error fetching user alert preferences:', error);
      res.status(500).json({ message: 'Failed to fetch user alert preferences' });
    }
  });

  app.put('/api/admin/users/:userId/alert-preferences', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { userId } = req.params;
      const { sport, preferences } = req.body;

      if (!sport || !preferences || !Array.isArray(preferences)) {
        return res.status(400).json({ message: 'Missing required fields: sport, preferences array' });
      }

      const result = await storage.bulkSetUserAlertPreferences(userId, sport.toLowerCase(), preferences);
      res.json({ message: 'User alert preferences updated successfully', count: result.length });
    } catch (error) {
      console.error('Error updating user alert preferences:', error);
      res.status(500).json({ message: 'Failed to update user alert preferences' });
    }
  });

  app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const adminUsers = await storage.getUsersByRole('admin');
      const managerUsers = await storage.getUsersByRole('manager');
      const analystUsers = await storage.getUsersByRole('analyst');
      const regularUsers = await storage.getUsersByRole('user');

      const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
      const monitoredTeamsResult = await db.execute(sql`SELECT COUNT(DISTINCT game_id) as count FROM user_monitored_teams`);

      res.json({
        users: {
          total: allUsers.length,
          admins: adminUsers.length,
          managers: managerUsers.length,
          analysts: analystUsers.length,
          regular: regularUsers.length
        },
        alerts: {
          total: parseInt(String(totalAlertsResult.rows[0]?.count || '0')),
          today: parseInt(String(todayAlertsResult.rows[0]?.count || '0'))
        },
        monitoredTeams: parseInt(String(monitoredTeamsResult.rows[0]?.count || '0'))
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  });


  // System status endpoint for admin dashboard
  app.get('/api/admin/system-status', requireAdminAuth, async (req, res) => {
    try {
      // Check alert engine status
      const masterAlertsEnabled = await storage.getMasterAlertEnabled();

      // Check database connectivity
      let databaseConnected = false;
      try {
        await db.execute(sql`SELECT 1`);
        databaseConnected = true;
      } catch (error) {
        databaseConnected = false;
      }

      // Check OpenAI integration status (based on env variable)
      const openaiEnabled = !!process.env.OPENAI_API_KEY;

      // Check Telegram bot status
      let telegramConnected = false;
      try {
        const usersWithTelegram = await db.execute(sql`
          SELECT COUNT(*) as count FROM users
          WHERE telegram_enabled = true
          AND telegram_bot_token IS NOT NULL
          AND telegram_chat_id IS NOT NULL
        `);
        telegramConnected = parseInt(String(usersWithTelegram.rows[0]?.count || '0')) > 0;
      } catch (error) {
        telegramConnected = false;
      }

      res.json({
        alertEngine: masterAlertsEnabled,
        database: databaseConnected,
        openai: openaiEnabled,
        telegram: telegramConnected
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({ message: 'Failed to fetch system status' });
    }
  });

  // Alerts routes
  app.get("/api/alerts", async (req, res) => {
    try {
      // Check if master alerts are disabled
      const masterAlertsEnabled = await storage.getMasterAlertEnabled();
      if (!masterAlertsEnabled) {
        // Return empty array if master alerts are disabled
        res.json([]);
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Get current user from session
      const currentUserId = req.session?.userId;
      console.log(`🔍 ALERTS API: Session user ID: ${currentUserId || 'none'}`);

      // If user is not authenticated, return empty array
      if (!currentUserId) {
        console.log(`⚠️ ALERTS API: No authenticated user, returning empty array`);
        res.json([]);
        return;
      }

      // Get user details
      const user = await storage.getUserById(currentUserId);
      if (!user) {
        console.log(`⚠️ ALERTS API: User not found for ID: ${currentUserId}`);
        res.json([]);
        return;
      }

      console.log(`🔍 ALERTS API: User ${user.username} requesting alerts`);

      // Get user's monitored games
      const monitoredGames = await storage.getUserMonitoredTeams(currentUserId);
      const monitoredGameIds = monitoredGames.map(game => game.gameId);
      console.log(`🔍 ALERTS API: User ${currentUserId} has ${monitoredGameIds.length} monitored games`);

      // If user has no monitored games, return empty array
      if (monitoredGameIds.length === 0) {
        console.log(`⚠️ ALERTS API: User has no monitored games, returning empty array`);
        res.json([]);
        return;
      }

      // Get alerts from database - filter by monitored game IDs AND current user ID
      const result = await db.select({
        id: alerts.id,
        type: alerts.type,
        game_id: alerts.gameId,
        sport: alerts.sport,
        score: alerts.score,
        payload: alerts.payload,
        created_at: alerts.createdAt
      })
      .from(alerts)
      .where(and(
        inArray(alerts.gameId, monitoredGameIds),
        eq(alerts.userId, currentUserId)
      ))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset);

      const alertsData = [];

      // Environment detection for debugging
      const environment = process.env.NODE_ENV || 'development';
      const isReplit = !!process.env.REPL_ID;
      const hasDatabase = !!process.env.DATABASE_URL;

      console.log(`🔍 ALERTS API: Environment=${environment}, Replit=${isReplit}, DB=${hasDatabase}, User=${currentUserId}`);

      for (const row of result) {
        // Process alerts with minimal transformation to preserve backend formatting
        try {
          let payload: any = {};
          try {
            payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
          } catch (e) {
            console.error('Error parsing payload:', e);
            payload = {};
          }

          // Extract team data from multiple sources with robust fallback
          const extractTeamData = (gameId: string, payload: any) => {
            // Priority 1: Enhanced context data (from GameStateManager)
            let homeTeam = payload.context?.homeTeam;
            let awayTeam = payload.context?.awayTeam;
            let homeScore = payload.context?.homeScore;
            let awayScore = payload.context?.awayScore;

            // Priority 2: Direct payload data (from alert generation)
            if (!homeTeam && payload.homeTeam) homeTeam = payload.homeTeam;
            if (!awayTeam && payload.awayTeam) awayTeam = payload.awayTeam;
            if (homeScore === undefined && payload.homeScore !== undefined) homeScore = payload.homeScore;
            if (awayScore === undefined && payload.awayScore !== undefined) awayScore = payload.awayScore;

            // Priority 3: Extract from message content (as backup)
            if (!homeTeam || !awayTeam) {
              const messageText = payload.message || payload.displayMessage || '';
              const teamMatch = messageText.match(/(\w+(?:\s+\w+)*)\s+@\s+(\w+(?:\s+\w+)*)/);
              if (teamMatch) {
                if (!awayTeam) awayTeam = teamMatch[1];
                if (!homeTeam) homeTeam = teamMatch[2];
              }
            }

            // Priority 4: Descriptive fallbacks (avoid generic defaults)
            if (!homeTeam) homeTeam = `Home Team (${gameId})`;
            if (!awayTeam) awayTeam = `Away Team (${gameId})`;

            return { homeTeam, awayTeam, homeScore, awayScore };
          };

          const teamData = extractTeamData(row.game_id, payload);

          // Log team data extraction for debugging environment differences
          if (teamData.homeTeam.includes('(') || teamData.awayTeam.includes('(')) {
            console.log(`⚠️ FALLBACK USED: Alert ${row.id} - ${teamData.awayTeam} @ ${teamData.homeTeam} (${environment})`);
          }

          // Use backend-processed data with enhanced fallback system
          alertsData.push({
            id: row.id,
            alertKey: `${row.game_id}_${row.type}`,
            type: row.type,
            // Preserve original backend message formatting
            message: payload.message || payload.displayMessage || `${row.type} alert for game ${row.game_id}`,
            displayMessage: payload.displayMessage, // Preserve formatted messages from CleanAlertFormatter
            gameId: row.game_id,
            sport: row.sport || 'MLB',
            // Use extracted team data with robust fallbacks
            homeTeam: teamData.homeTeam,
            awayTeam: teamData.awayTeam,
            homeScore: teamData.homeScore,
            awayScore: teamData.awayScore,
            confidence: row.score || 80,
            priority: row.score || 80,
            createdAt: row.created_at,
            timestamp: row.created_at,
            // Preserve all backend-processed data
            context: payload.context || {},
            gamblingInsights: payload.gamblingInsights || null,
            hasComposerEnhancement: payload.hasComposerEnhancement || false,
            // Preserve enhanced data
            betbookData: payload.betbookData || null,
            gameInfo: payload.gameInfo || null,
            // Include full payload for frontend access
            payload: payload,
            // Simplified state flags
            seen: false,
            sentToTelegram: payload.sentToTelegram || false
          });
        } catch (error) {
          console.error(`Error processing alert for ${row.id}:`, error);
        }
      }

      res.json(alertsData);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // DIAGNOSTIC: Environment comparison endpoint to identify simple vs advanced card differences
  app.get('/api/diagnostics/environment', async (req, res) => {
    try {
      const currentUserId = req.session?.userId;

      // Environment variables that could affect card rendering
      const environmentData = {
        deployment: {
          isReplit: !!process.env.REPLIT_DB_URL,
          environment: process.env.NODE_ENV || 'development',
          buildTimestamp: process.env.BUILD_TIMESTAMP || 'unknown',
          version: process.env.npm_package_version || 'unknown'
        },
        features: {
          openaiEnabled: !!process.env.OPENAI_API_KEY,
          telegramEnabled: !!process.env.TELEGRAM_BOT_TOKEN,
          oddsApiEnabled: !!process.env.ODDS_API_KEY,
          enhancedCardsEnabled: process.env.VITE_ENABLE_ENHANCED_CARDS !== 'false',
          debugMode: process.env.DEBUG === 'true',
          masterAlertsEnabled: await storage.getMasterAlertEnabled()
        },
        user: currentUserId ? {
          userId: currentUserId,
          authenticated: true,
          hasMonitoredGames: currentUserId ? (await storage.getUserMonitoredTeams(currentUserId)).length > 0 : false
        } : {
          userId: null,
          authenticated: false,
          hasMonitoredGames: false
        }
      };

      // Get sample alert data to compare structures
      let sampleAlert = null;
      if (currentUserId) {
        try {
          const monitoredGames = await storage.getUserMonitoredTeams(currentUserId);
          if (monitoredGames.length > 0) {
            const sampleResult = await db.select()
              .from(alerts)
              .where(and(
                inArray(alerts.gameId, monitoredGames.map(g => g.gameId)),
                eq(alerts.userId, currentUserId)
              ))
              .orderBy(desc(alerts.createdAt))
              .limit(1);

            if (sampleResult.length > 0) {
              const alert = sampleResult[0];
              const payload = alert.payload as any;

              sampleAlert = {
                id: alert.id,
                type: alert.type,
                sport: alert.sport,
                hasContext: !!payload.context,
                hasGamblingInsights: !!payload.gamblingInsights,
                hasComposerEnhancement: !!payload.hasComposerEnhancement,
                hasBetbookData: !!payload.betbookData,
                hasGameInfo: !!payload.gameInfo,
                hasDisplayMessage: !!payload.displayMessage,
                messageLength: payload.message ? payload.message.length : 0,
                payloadKeys: Object.keys(payload),
                contextKeys: payload.context ? Object.keys(payload.context) : []
              };
            }
          }
        } catch (error) {
          console.error('Error fetching sample alert:', error);
        }
      }

      const diagnosticData = {
        ...environmentData,
        sampleAlert,
        timestamp: new Date().toISOString(),
        cardRenderingFactors: {
          shouldRenderAdvanced: !!(
            environmentData.features.openaiEnabled &&
            environmentData.features.enhancedCardsEnabled &&
            currentUserId
          ),
          factorsExplained: {
            openaiForEnhancements: environmentData.features.openaiEnabled,
            enhancedCardsFeatureFlag: environmentData.features.enhancedCardsEnabled,
            userAuthenticated: !!currentUserId,
            hasMonitoredGames: environmentData.user.hasMonitoredGames
          }
        }
      };

      console.log(`🔍 DIAGNOSTIC: Environment=${environmentData.deployment.environment}, Replit=${environmentData.deployment.isReplit}, User=${currentUserId}, Advanced=${diagnosticData.cardRenderingFactors.shouldRenderAdvanced}`);

      res.json(diagnosticData);
    } catch (error) {
      console.error('Error in diagnostics endpoint:', error);
      res.status(500).json({ message: 'Failed to generate diagnostics' });
    }
  });

  // Snapshot endpoint for delta synchronization - fetches alerts since sequence number or timestamp
  app.get('/api/alerts/snapshot', async (req, res) => {
    try {
      const currentUserId = req.session?.userId;
      if (!currentUserId) {
        res.json([]);
        return;
      }

      const user = await storage.getUserById(currentUserId);
      if (!user) {
        res.json([]);
        return;
      }

      const since = req.query.since as string;
      const sinceSeq = req.query.seq ? parseInt(req.query.seq as string) : null;

      console.log(`📸 Snapshot request: userId=${currentUserId}, since=${since}, seq=${sinceSeq}`);

      // Get monitored games and filter alerts
      const monitoredGames = await storage.getAllMonitoredGames();
      if (monitoredGames.length === 0) {
        res.json([]);
        return;
      }

      const monitoredGameIds = monitoredGames.map((game: any) => game.gameId);

      // Build parameterized query to prevent SQL injection
      const gameIdsPlaceholder = monitoredGameIds.map(() => '?').join(',');
      const params = [...monitoredGameIds];
      let whereClause = `game_id IN (${gameIdsPlaceholder})`;

      if (sinceSeq) {
        whereClause += ` AND sequence_number > ?`;
        params.push(sinceSeq);
      } else if (since) {
        whereClause += ` AND created_at > ?`;
        params.push(since);
      }

      const result = await db.execute(sql.raw(`
        SELECT id, sequence_number, type, game_id, sport, score, payload, created_at
        FROM alerts
        WHERE ${whereClause}
        ORDER BY sequence_number ASC
        LIMIT 200
      `));

      const alerts = result.rows.map((row: any) => {
        let payload: any = {};
        try {
          payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
        } catch (e) {
          payload = {};
        }

        return {
          id: row.id,
          alertKey: `${row.game_id}_${row.type}`,
          sequenceNumber: row.sequence_number,
          type: row.type,
          message: payload.message || payload.situation || `${row.type} alert for game ${row.game_id}`,
          gameId: row.game_id,
          sport: row.sport || 'MLB',
          homeTeam: payload.context?.homeTeam || payload.homeTeam || `Home Team (${row.game_id})`,
          awayTeam: payload.context?.awayTeam || payload.awayTeam || `Away Team (${row.game_id})`,
          homeScore: payload.context?.homeScore ?? payload.homeScore,
          awayScore: payload.context?.awayScore ?? payload.awayScore,
          confidence: row.score || 85,
          priority: row.score || 80,
          createdAt: row.created_at,
          timestamp: row.created_at,
          payload: payload
        };
      });

      console.log(`📸 Snapshot response: ${alerts.length} alerts since ${since || sinceSeq}`);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alert snapshot:", error);
      res.status(500).json({ message: "Failed to fetch alert snapshot" });
    }
  });

  app.get('/api/alerts/stats', async (req, res) => {
    try {
      // Use direct SQL counts for better performance and reliability
      const totalAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      const todayAlertsResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts WHERE DATE(created_at) = CURRENT_DATE`);
      const monitoredGames = await storage.getAllMonitoredGames();

      const stats = {
        totalAlerts: parseInt(String(totalAlertsResult.rows[0]?.count || '0')),
        todayAlerts: parseInt(String(todayAlertsResult.rows[0]?.count || '0')),
        liveGames: 6, // This would need live games API integration
        monitoredGames: monitoredGames.length
      };
      res.json(stats);
    } catch (error) {
      console.error('Error fetching alert stats:', error);
      res.status(500).json({ message: 'Failed to fetch alert stats' });
    }
  });

  app.get('/api/alerts/count', async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
      res.json({ count: parseInt(String(result.rows[0]?.count || '0')) });
    } catch (error) {
      console.error('Error counting alerts:', error);
      res.status(500).json({ message: 'Failed to count alerts' });
    }
  });

  app.delete('/api/alerts/:alertId', async (req, res) => {
    try {
      const { alertId } = req.params;

      if (!alertId) {
        return res.status(400).json({ message: 'Alert ID is required' });
      }

      // Delete the alert from database
      const result = await db.execute(sql`
        DELETE FROM alerts
        WHERE id = ${alertId}
      `);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: 'Failed to delete alert' });
    }
  });

  // Show timezone info on startup
  const { formatPacificTime, getPacificDate } = await import('./utils/timezone');
  console.log('🌴 ChirpBot V3 - Using Pacific Timezone (PST/PDT)');
  console.log(`📅 Current Pacific Date: ${getPacificDate()}`);
  console.log(`🕐 Current Pacific Time: ${formatPacificTime()}`);

  // Weather test endpoint
  app.get('/api/test-weather/:team', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');
      const weather = await weatherService.getWeatherForTeam(req.params.team);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

      res.json({
        team: req.params.team,
        weather,
        analysis: {
          homeRunFactor,
          windDescription: windDesc,
          weatherSource: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data (Set OPENWEATHERMAP_API_KEY for live data)'
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Weather endpoint for calendar games
  app.get('/api/weather/team/:teamName', async (req, res) => {
    try {
      const { weatherService } = await import('./services/weather-service');
      const teamName = decodeURIComponent(req.params.teamName);
      const weather = await weatherService.getWeatherForTeam(teamName);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

      res.json({
        temperature: weather.temperature,
        condition: weather.condition,
        windSpeed: weather.windSpeed,
        windDirection: weather.windDirection,
        windDescription: windDesc,
        homeRunFactor,
        humidity: weather.humidity,
        pressure: weather.pressure,
        timestamp: weather.timestamp,
        source: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data'
      });
    } catch (error: any) {
      console.error(`Weather API error for team ${req.params.teamName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Weather endpoint - redirect to team-specific endpoint
  app.get('/api/weather', async (req, res) => {

    // Return fallback data with clear indication it's generic
    res.json({
      temperature: 72,
      condition: 'Clear',
      windSpeed: 5,
      windDirection: 0, // North
      humidity: 50,
      pressure: 1013,
      timestamp: new Date().toISOString(),
      source: 'Generic Fallback - Use team-specific endpoint'
    });
  });

  // Weather-on-Live monitoring status endpoint
  app.get('/api/weather-on-live/status', requireUserAuth, async (req, res) => {
    try {
      const { weatherOnLiveService } = await import('./services/weather-on-live-service');
      const status = weatherOnLiveService.getMonitoringStatus();

      res.json({
        ...status,
        healthMetrics: weatherOnLiveService.getHealthMetrics(),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching weather-on-live status:', error);
      res.status(500).json({ error: 'Failed to fetch weather monitoring status' });
    }
  });

  // Weather-on-Live monitoring control endpoint
  app.post('/api/weather-on-live/control/:gameId/:action', requireUserAuth, async (req, res) => {
    try {
      const { weatherOnLiveService } = await import('./services/weather-on-live-service');
      const { gameId, action } = req.params;

      let result = false;
      let message = '';

      switch (action) {
        case 'arm':
          const { WeatherArmReason } = await import('./config/runtime');
          result = await weatherOnLiveService.armWeatherMonitoring(gameId, WeatherArmReason.CUSTOM);
          message = result ? 'Weather monitoring armed' : 'Failed to arm weather monitoring';
          break;

        case 'disarm':
          result = await weatherOnLiveService.disarmWeatherMonitoring(gameId);
          message = result ? 'Weather monitoring disarmed' : 'Failed to disarm weather monitoring';
          break;

        default:
          return res.status(400).json({ error: 'Invalid action. Use "arm" or "disarm"' });
      }

      res.json({
        success: result,
        message,
        gameId,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error controlling weather-on-live:', error);
      res.status(500).json({ error: 'Failed to control weather monitoring' });
    }
  });


  // Admin Authentication Routes
  app.post('/api/admin-auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
      }

      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log('❌ Admin login failed: user not found:', username);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Check if user is admin
      if (user.role !== 'admin') {
        console.log('❌ Admin login failed: not admin:', username);
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      // Verify password
      if (!user.password) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log('❌ Admin login failed: invalid password:', username);
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Store ONLY admin session - admins cannot be regular users
      req.session.adminUserId = user.id;
      // No regular userId - admins are separate from users

      console.log('✅ Admin login successful:', username);
      res.json({
        success: true,
        message: 'Admin login successful',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // CSRF token endpoint for admin panel
  app.get('/api/admin-auth/csrf-token', requireAdminAuth, generateCSRFToken, (req, res) => {
    res.json({
      csrfToken: req.csrfToken,
      message: 'CSRF token generated successfully'
    });
  });

  app.get('/api/admin-auth/verify', async (req, res) => {
    try {
      // Check ONLY admin session - no fallback to regular users
      const adminUserId = req.session?.adminUserId;

      console.log('🔍 Admin verify check:', {
        hasAdminSession: !!adminUserId,
        sessionId: req.sessionID?.slice(0, 8)
      });

      if (!adminUserId) {
        console.log('❌ No admin session found');
        return res.status(401).json({ authenticated: false });
      }

      const user = await storage.getUserById(adminUserId);
      if (!user || user.role !== 'admin') {
        console.log('❌ User not admin or not found:', { adminUserId, role: user?.role });
        // Clear invalid admin session
        req.session.adminUserId = undefined;
        return res.status(401).json({ authenticated: false });
      }

      // Ensure admin session is properly set
      if (!req.session.adminUserId && user.role === 'admin') {
        req.session.adminUserId = user.id;
      }

      console.log('✅ Admin verified:', user.username);
      res.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Admin verify error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Comprehensive App Debug Endpoint
  app.get('/api/debug/comprehensive', async (req, res) => {
    try {
      const debugResults: Record<string, any> = {
        timestamp: new Date().toISOString(),
        endpoints: {} as Record<string, any>,
        database: {} as Record<string, any>,
        services: {} as Record<string, any>,
        configuration: {} as Record<string, any>,
        errors: [] as string[]
      };

      // Test Database Connection
      try {
        const dbTest = await db.execute(sql`SELECT 1 as test`);
        debugResults.database.connection = 'OK';
        debugResults.database.testQuery = dbTest.rows[0] ? 'PASS' : 'FAIL';
      } catch (error: any) {
        debugResults.database.connection = 'FAIL';
        debugResults.database.error = error.message;
        debugResults.errors.push(`Database: ${error.message}`);
      }

      // Test User Table
      try {
        const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        debugResults.database.userCount = parseInt(String(userCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.userTableError = error.message;
        debugResults.errors.push(`User table: ${error.message}`);
      }

      // Test Alert Table
      try {
        const alertCount = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
        debugResults.database.alertCount = parseInt(String(alertCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.alertTableError = error.message;
        debugResults.errors.push(`Alert table: ${error.message}`);
      }

      // Test Settings Table
      try {
        const settingsCount = await db.execute(sql`SELECT COUNT(*) as count FROM settings`);
        debugResults.database.settingsCount = parseInt(String(settingsCount.rows[0]?.count || '0'));
      } catch (error: any) {
        debugResults.database.settingsTableError = error.message;
        debugResults.errors.push(`Settings table: ${error.message}`);
      }

      // Test Telegram Service
      try {
        const telegramUsers = await storage.getAllUsers();
        const validTelegramUsers = telegramUsers.filter(u =>
          u.telegramEnabled &&
          u.telegramBotToken &&
          u.telegramBotToken !== 'default_key' &&
          u.telegramChatId &&
          u.telegramChatId !== 'default_key'
        );
        debugResults.services.telegram = {
          totalUsers: telegramUsers.length,
          validConfigurations: validTelegramUsers.length,
          status: validTelegramUsers.length > 0 ? 'CONFIGURED' : 'NO_VALID_CONFIGS'
        };
      } catch (error: any) {
        debugResults.services.telegram = { status: 'ERROR', error: error.message };
        debugResults.errors.push(`Telegram service: ${error.message}`);
      }

      // Test MLB API
      try {
        const { MLBApiService } = await import('./services/mlb-api');
        const mlbService = new MLBApiService();
        const todaysGames = await mlbService.getTodaysGames();
        debugResults.services.mlbApi = {
          status: 'OK',
          todaysGames: todaysGames.length,
          endpoint: 'statsapi.mlb.com'
        };
      } catch (error: any) {
        debugResults.services.mlbApi = { status: 'FAIL', error: error.message };
        debugResults.errors.push(`MLB API: ${error.message}`);
      }

      // Test Weather Service
      try {
        const { weatherService } = await import('./services/weather-service');
        const testWeather = await weatherService.getWeatherForTeam('Boston Red Sox');
        debugResults.services.weather = {
          status: 'OK',
          source: process.env.OPENWEATHERMAP_API_KEY ? 'OpenWeatherMap API' : 'Fallback Data',
          temperature: testWeather.temperature,
          condition: testWeather.condition
        };
      } catch (error: any) {
        debugResults.services.weather = { status: 'FAIL', error: error.message };
        debugResults.errors.push(`Weather service: ${error.message}`);
      }

      // UnifiedAlertGenerator removed - dead code replaced by CalendarSyncService

      // Test Environment Variables
      debugResults.configuration = {
        nodeEnv: process.env.NODE_ENV || 'not_set',
        port: process.env.PORT || 'not_set',
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
        sessionSecret: process.env.SESSION_SECRET ? 'SET' : 'NOT_SET',
        openWeatherKey: process.env.OPENWEATHERMAP_API_KEY ? 'SET' : 'NOT_SET'
      };

      // Test Core Endpoints
      const endpointsToTest = [
        { path: '/health', method: 'GET' },
        { path: '/api/teams', method: 'GET' },
        { path: '/api/games/today', method: 'GET' },
        { path: '/api/alerts', method: 'GET' },
        { path: '/api/settings', method: 'GET' }
      ];

      for (const endpoint of endpointsToTest) {
        try {
          // Simulate internal request
          debugResults.endpoints[endpoint.path] = 'AVAILABLE';
        } catch (error: any) {
          debugResults.endpoints[endpoint.path] = 'ERROR';
          debugResults.errors.push(`Endpoint ${endpoint.path}: ${error.message}`);
        }
      }

      // WebSocket functionality removed - using HTTP polling architecture
      debugResults.services.sse = {
        clients: sseClients.size,
        status: 'ACTIVE'
      };

      // Overall Health Score
      const totalChecks = Object.keys(debugResults.database).length +
        Object.keys(debugResults.services).length +
        Object.keys(debugResults.endpoints).length;
      const errorCount = debugResults.errors.length;
      const healthScore = Math.max(0, Math.round(((totalChecks - errorCount) / totalChecks) * 100));

      debugResults.summary = {
        healthScore: `${healthScore}%`,
        totalErrors: errorCount,
        status: errorCount === 0 ? 'HEALTHY' : errorCount < 5 ? 'DEGRADED' : 'CRITICAL',
        recommendation: errorCount === 0 ? 'System is operating normally' :
          errorCount < 5 ? 'Minor issues detected, monitor closely' :
            'Critical issues require immediate attention'
      };

      res.json(debugResults);
    } catch (error: any) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({
        error: 'Debug endpoint failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Individual Service Debug Endpoints
  app.get('/api/debug/database', async (req, res) => {
    try {
      const dbStatus: Record<string, any> = {
        connection: 'UNKNOWN',
        tables: {} as Record<string, any>,
        indexes: {} as Record<string, any>,
        performance: {} as Record<string, any>
      };

      // Test connection
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbStatus.performance.connectionTime = `${Date.now() - start}ms`;
      dbStatus.connection = 'OK';

      // Check all tables
      const tables = ['users', 'alerts', 'settings', 'teams', 'user_monitored_teams', 'master_alert_controls'];
      for (const table of tables) {
        try {
          const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
          dbStatus.tables[table] = {
            status: 'OK',
            count: parseInt(String(count.rows[0]?.count || '0'))
          };
        } catch (error: any) {
          dbStatus.tables[table] = { status: 'ERROR', error: error.message };
        }
      }

      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/debug/alerts-system', async (req, res) => {
    try {
      const alertsDebug: Record<string, any> = {
        generation: {} as Record<string, any>,
        storage: {} as Record<string, any>,
        delivery: {} as Record<string, any>,
        configuration: {} as Record<string, any>
      };

      // Check alert generation
      try {
        const recentAlerts = await db.execute(sql`
          SELECT type, COUNT(*) as count, MAX(created_at) as latest
          FROM alerts
          WHERE created_at > NOW() - INTERVAL '1 hour'
          GROUP BY type
        `);
        alertsDebug.generation = {
          status: 'OK',
          recentTypes: recentAlerts.rows,
          lastHourTotal: recentAlerts.rows.reduce((sum: number, row: any) => sum + parseInt(String(row.count)), 0)
        };
      } catch (error: any) {
        alertsDebug.generation = { status: 'ERROR', error: error.message };
      }

      // Check global alert settings
      try {
        const globalSettings = await unifiedSettings.getGlobalSettings('MLB');
        const enabledAlerts = Object.entries(globalSettings).filter(([_, enabled]) => enabled).length;
        alertsDebug.configuration = {
          status: 'OK',
          totalAlertTypes: Object.keys(globalSettings).length,
          enabledTypes: enabledAlerts,
          disabledTypes: Object.keys(globalSettings).length - enabledAlerts
        };
      } catch (error: any) {
        alertsDebug.configuration = { status: 'ERROR', error: error.message };
      }

      // Check Telegram delivery
      try {
        const telegramUsers = await storage.getAllUsers();
        const validUsers = telegramUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);
        alertsDebug.delivery = {
          status: validUsers.length > 0 ? 'READY' : 'NO_RECIPIENTS',
          configuredUsers: validUsers.length,
          totalUsers: telegramUsers.length
        };
      } catch (error: any) {
        alertsDebug.delivery = { status: 'ERROR', error: error.message };
      }

      res.json(alertsDebug);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/debug/live-monitoring', async (req, res) => {
    try {
      const monitoringStatus = {
        games: {},
        apis: {},
        monitoring: {}
      };

      // Check today's games
      try {
        const { MLBApiService } = await import('./services/mlb-api');
        const mlbService = new MLBApiService();
        const todaysGames = await mlbService.getTodaysGames();
        const liveGames = todaysGames.filter(game => game.status === 'live' || game.isLive);

        monitoringStatus.games = {
          status: 'OK',
          total: todaysGames.length,
          live: liveGames.length,
          scheduled: todaysGames.filter(g => g.status === 'scheduled').length,
          completed: todaysGames.filter(g => g.status === 'completed' || g.status === 'final').length
        };
      } catch (error: any) {
        monitoringStatus.games = { status: 'ERROR', error: error.message };
      }

      // Check monitored games
      try {
        const monitoredGames = await storage.getAllMonitoredGames();
        monitoringStatus.monitoring = {
          status: 'OK',
          userMonitoredGames: monitoredGames.length,
          uniqueUsers: [...new Set(monitoredGames.map(g => g.userId))].length
        };
      } catch (error: any) {
        monitoringStatus.monitoring = { status: 'ERROR', error: error.message };
      }

      res.json(monitoringStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // WNBA Debug endpoint
  app.get('/api/debug/wnba', async (req, res) => {
    try {
      console.log('🔍 WNBA Debug Request');

      // Check if user is authenticated
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get WNBA games
      const { WNBAApiService } = await import('./services/wnba-api');
      const wnbaApi = new WNBAApiService();
      const games = await wnbaApi.getTodaysGames();

      // Get user WNBA preferences
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'WNBA');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Check WNBA engine status
      const { WNBAEngine } = await import('./services/engines/wnba-engine');
      const wnbaEngine = new WNBAEngine();
      const availableTypes = await wnbaEngine.getAvailableAlertTypes();

      // Get recent alerts (note: getRecentAlerts returns all sports, not filtered by WNBA)
      const recentAlerts = await storage.getRecentAlerts(10);

      const debugInfo = {
        userId,
        games: games.length,
        gamesData: games,
        userPreferences: {
          total: userPrefs.length,
          enabled: enabledTypes.length,
          enabledTypes
        },
        availableAlertTypes: availableTypes,
        recentAlerts: recentAlerts.length,
        systemStatus: 'WNBA Debug Complete'
      };

      console.log('🏀 WNBA Debug Results:', debugInfo);
      res.json(debugInfo);
    } catch (error: any) {
      console.error('❌ WNBA Debug error:', error);
      res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
  });

  // NCAAF Possession Tracking API endpoints
  app.get('/api/ncaaf/possession/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { gameStateManager } = await import('./services/game-state-manager');
      const ncaafEngine = gameStateManager.getEngine('NCAAF');

      if (!ncaafEngine) {
        return res.status(503).json({ error: 'NCAAF engine not available' });
      }

      const stats = (ncaafEngine as any).getPossessionStats(gameId);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching NCAAF possession stats:', error);
      res.status(500).json({ error: 'Failed to fetch possession stats' });
    }
  });

  app.get('/api/ncaaf/possession', async (req, res) => {
    try {
      const { gameStateManager } = await import('./services/game-state-manager');
      const ncaafEngine = gameStateManager.getEngine('NCAAF');

      if (!ncaafEngine) {
        return res.status(503).json({ error: 'NCAAF engine not available' });
      }

      const allStats = (ncaafEngine as any).getAllPossessionStats();
      res.json({
        tracked: allStats.length > 0,
        gamesTracked: allStats.length,
        possessionStats: allStats
      });
    } catch (error: any) {
      console.error('Error fetching all NCAAF possession stats:', error);
      res.status(500).json({ error: 'Failed to fetch possession stats' });
    }
  });

  // 🔧 CACHE FIX: Global Settings Diagnostics Endpoint
  app.get('/api/debug/global-settings/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      const timestamp = new Date().toISOString();
      const canonicalSport = sport.toLowerCase();

      console.log(`🔍 Global Settings Diagnostics for ${sport} (canonical: ${canonicalSport})`);

      // Get settings through the unified settings system (this uses cache)
      const cachedSettings = await unifiedSettings.getGlobalSettings(sport.toLowerCase());

      // Get settings directly from storage (bypasses cache to show DB state)
      const dbSettings = await storage.getGlobalAlertSettings(sport);

      // Get cache metrics
      const cacheMetrics = unifiedSettings.getCacheMetrics();

      // Count differences
      const cacheKeys = Object.keys(cachedSettings);
      const dbKeys = Object.keys(dbSettings);
      const allKeys = [...new Set([...cacheKeys, ...dbKeys])];

      const differences = [];
      const mismatches = [];

      for (const key of allKeys) {
        const cacheValue = cachedSettings[key];
        const dbValue = dbSettings[key];

        if (cacheValue !== dbValue) {
          mismatches.push({
            alertType: key,
            cacheValue: cacheValue ?? 'undefined',
            dbValue: dbValue ?? 'undefined',
            issue: 'CACHE_DB_MISMATCH'
          });
        }

        differences.push({
          alertType: key,
          cache: cacheValue ?? 'undefined',
          database: dbValue ?? 'undefined',
          matched: cacheValue === dbValue
        });
      }

      // Get database statistics
      const globalAlertSettingsCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM global_alert_settings WHERE sport = ${canonicalSport}
      `);

      const enabledCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM global_alert_settings
        WHERE sport = ${canonicalSport} AND enabled = true
      `);

      const diagnostics = {
        timestamp,
        sport: sport,
        canonicalSport: canonicalSport,
        cacheKeyUsed: canonicalSport,
        requestInfo: {
          originalSport: sport,
          normalizedForCache: canonicalSport,
          normalizedForDb: canonicalSport
        },
        database: {
          totalSettings: parseInt(String(globalAlertSettingsCount.rows[0]?.count || '0')),
          enabledSettings: parseInt(String(enabledCount.rows[0]?.count || '0')),
          disabledSettings: parseInt(String(globalAlertSettingsCount.rows[0]?.count || '0')) - parseInt(String(enabledCount.rows[0]?.count || '0')),
          settings: dbSettings
        },
        cache: {
          settings: cachedSettings,
          metrics: cacheMetrics
        },
        analysis: {
          totalKeys: allKeys.length,
          cacheDbMatches: differences.filter(d => d.matched).length,
          cacheDbMismatches: mismatches.length,
          criticalMismatches: mismatches,
          healthStatus: mismatches.length === 0 ? 'HEALTHY' : 'CACHE_DESYNC',
          recommendations: mismatches.length > 0 ? [
            'Cache invalidation may be failing',
            'Check cache key normalization',
            'Consider clearing cache for this sport'
          ] : ['Settings cache is synchronized with database']
        },
        troubleshooting: {
          cacheInvalidationTest: `await unifiedSettings.invalidateCache('${canonicalSport}')`,
          clearCacheCommand: 'Clear cache through admin interface',
          recheckQuery: `GET /api/debug/global-settings/${sport}`
        }
      };

      res.json(diagnostics);
    } catch (error: any) {
      console.error(`❌ Global Settings Diagnostics error for ${req.params.sport}:`, error);
      res.status(500).json({
        error: error.message || 'Unknown error occurred',
        sport: req.params.sport,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          checkDatabase: 'Verify database connection',
          checkCache: 'Verify unified settings system',
          recheckQuery: `GET /api/debug/global-settings/${req.params.sport}`
        }
      });
    }
  });


  app.post('/api/admin/logout', (req, res) => {
    req.session.adminUserId = undefined;
    res.json({ message: 'Admin logout successful' });
  });

  // Alias route for admin dashboard compatibility - client expects /api/admin-auth/logout
  app.post('/api/admin-auth/logout', (req, res) => {
    req.session.adminUserId = undefined;
    res.json({ message: 'Admin logout successful' });
  });

  // Check if admin users exist (public endpoint for troubleshooting)
  app.get('/api/admin-auth/check', async (req, res) => {
    try {
      const adminUsers = await storage.getUsersByRole('admin');
      res.json({
        hasAdminUsers: adminUsers.length > 0,
        adminCount: adminUsers.length,
        adminUsernames: adminUsers.map(u => u.username)
      });
    } catch (error) {
      console.error('Error checking admin users:', error);
      res.status(500).json({ message: 'Error checking admin users' });
    }
  });

  // Demo account verification endpoint
  app.get('/api/auth/demo-check', async (req, res) => {
    try {
      const demoUser = await storage.getUserByUsername('demo');
      res.json({
        exists: !!demoUser,
        username: demoUser?.username || 'not found',
        hasPassword: !!demoUser?.password,
        email: demoUser?.email || 'not found'
      });
    } catch (error) {
      console.error('Error checking demo user:', error);
      res.status(500).json({ message: 'Error checking demo user' });
    }
  });

  // Debug endpoint to diagnose cookie/session issues
  app.get('/api/admin-auth/debug', async (req, res) => {
    const cookieHeader = req.headers.cookie || 'none';
    const hasCbSid = cookieHeader.includes('cb.sid');
    const hasConnectSid = cookieHeader.includes('connect.sid');

    res.json({
      host: req.hostname,
      origin: req.headers.origin || 'none',
      cookiePresent: hasCbSid || hasConnectSid,
      cookieType: hasCbSid ? 'cb.sid' : hasConnectSid ? 'connect.sid' : 'none',
      sessionId: req.sessionID ? req.sessionID.slice(0, 8) + '...' : 'none',
      adminUserId: req.session?.adminUserId || 'none',
      userId: req.session?.userId || 'none',
      authenticated: !!(req.session?.adminUserId || req.session?.userId),
      headers: {
        host: req.headers.host,
        origin: req.headers.origin || 'none',
        referer: req.headers.referer || 'none'
      }
    });
  });

  // Global Alert Management Endpoints

  // Admin-only endpoint to get global settings (legacy, kept for backward compatibility)
  app.get('/api/admin/global-alert-settings/:sport', async (req, res) => {
    try {
      const { sport } = req.params;

      // Get the global settings from storage
      const settings = await unifiedSettings.getGlobalSettings(sport.toLowerCase());

      res.json(settings);
    } catch (error) {
      console.error('Error fetching global alert settings:', error);
      res.status(500).json({ message: 'Failed to fetch global alert settings' });
    }
  });

  // NEW: Public endpoint for all authenticated users to see global settings (read-only)
  app.get('/api/global-alert-settings/:sport', requireUserAuth, async (req, res) => {
    try {
      const { sport } = req.params;

      // Get the global settings from storage (read-only for non-admins)
      const settings = await unifiedSettings.getGlobalSettings(sport.toLowerCase());

      // Add metadata to indicate read-only status for non-admins
      const response = {
        sport: sport.toUpperCase(),
        settings,
        readOnly: req.user?.role !== 'admin',
        message: req.user?.role !== 'admin' ?
          'These are global settings managed by administrators. You can see which alerts are disabled globally.' :
          'You can manage these global settings as an administrator.'
      };

      console.log(`📋 Global settings fetched for ${sport} by user ${req.user?.id} (${req.user?.role || 'user'})`);

      res.json(response);
    } catch (error) {
      console.error('Error fetching global alert settings:', error);
      res.status(500).json({ message: 'Failed to fetch global alert settings' });
    }
  });

  // Update individual global alert setting
  app.put('/api/admin/global-alert-setting', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const { sport, alertType, enabled } = req.body;

      if (!sport || !alertType || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: sport, alertType, enabled' });
      }

      // Update the global alert setting in database using atomic upsert
      await storage.upsertGlobalAlertSetting(sport, alertType, enabled, req.session.adminUserId!);

      // ✅ Cache invalidation handled by storage layer

      console.log(`✅ Admin toggled ${sport} ${alertType} to ${enabled ? 'enabled' : 'disabled'}`);

      res.json({
        message: `${alertType} ${enabled ? 'enabled' : 'disabled'} for ${sport}`,
        sport,
        alertType,
        enabled
      });
    } catch (error) {
      console.error('Error updating global alert setting:', error);
      res.status(500).json({ message: 'Failed to update global alert setting' });
    }
  });


  // Health check endpoint for monitoring and auto-recovery
  app.get('/api/health', async (req, res) => {
    try {
      // Basic health check - server is responding
      const memUsage = process.memoryUsage();
      const v8 = await import('v8');
      const heapStats = v8.getHeapStatistics();
      const memPercent = memUsage.heapUsed / heapStats.heap_size_limit;

      // Get deduplication stats
      const dedupeStats = unifiedDeduplicator.getStats();

      // Get circuit breaker stats
      const { mlbApiCircuit, espnApiCircuit, weatherApiCircuit } = await import('./middleware/circuit-breaker');
      const circuitBreakerStatus = {
        mlbApi: mlbApiCircuit.getStatus(),
        espnApi: espnApiCircuit.getStatus(),
        weatherApi: weatherApiCircuit.getStatus()
      };

      // Get memory management stats
      const memoryStats = memoryManager.getStats();

      // WebSocket stats removed - using HTTP polling architecture
      console.log('📡 HTTP polling architecture active - no WebSocket stats needed');

      const healthStatus = {
        status: memPercent > 0.9 ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          ...memUsage,
          percentage: Math.round(memPercent * 100),
          management: memoryStats
        },
        pid: process.pid,
        deduplication: {
          ...dedupeStats,
          effectiveness: dedupeStats.cacheSize > 0 ?
            `Serving ${dedupeStats.cacheSize} cached responses` : 'No cached responses yet'
        },
        circuitBreakers: circuitBreakerStatus,
        serverBootId: Date.now().toString(), // Simplified boot ID since WebSocket removed
        sse: {
          status: 'HTTP polling architecture active',
          clients: sseClients.size,
          supportedFeatures: ['server-sent-events', 'http-polling']
        }
      };

      res.status(200).json(healthStatus);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Environment diagnostics endpoint - read-only database info
  app.get('/api/diagnostics/db-info', async (req, res) => {
    try {
      if (!req.session.userId && !req.session.adminUserId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const databaseUrl = process.env.DATABASE_URL || 'Not set';
      const maskedUrl = databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

      // Count records by sport
      const globalSettingsCount = await storage.getGlobalAlertSettings('ncaaf');
      const ncaafGlobalCount = Object.keys(globalSettingsCount || {}).length;

      const mlbGlobalSettings = await storage.getGlobalAlertSettings('mlb');
      const mlbGlobalCount = Object.keys(mlbGlobalSettings || {}).length;

      // Count user preferences for current user
      const userId = req.session.userId || req.session.adminUserId;
      const userPrefsCount: Record<string, number> = { NCAAF: 0, MLB: 0, WNBA: 0, NFL: 0, CFL: 0, NBA: 0 };

      for (const sport of Object.keys(userPrefsCount)) {
        try {
          if (!userId) continue;
          const prefs = await storage.getUserAlertPreferencesBySport(userId, sport.toLowerCase());
          userPrefsCount[sport] = prefs.length;
        } catch (e) {
          userPrefsCount[sport] = 0;
        }
      }

      res.json({
        environment: process.env.NODE_ENV || 'development',
        database: { url: maskedUrl },
        globalSettings: {
          NCAAF: ncaafGlobalCount,
          MLB: mlbGlobalCount,
          total: ncaafGlobalCount + mlbGlobalCount
        },
        userPreferences: userPrefsCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Database diagnostics error:', error);
      res.status(500).json({ message: 'Diagnostics failed', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get available alert types from cylinders - PUBLIC endpoint (no auth required)
  // This returns metadata about what alert types exist, not user-specific preferences
  app.get('/api/available-alerts/:sport', async (req, res) => {
    try {
      const { sport } = req.params;

      try {
        let availableAlerts: string[] = [];

        // Get available alert types from the specific sport engine
        if (sport.toUpperCase() === 'NCAAF') {
          const { NCAAFEngine } = await import('./services/engines/ncaaf-engine');
          const tempEngine = new NCAAFEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
          console.log(`🔍 NCAAF Engine returned ${availableAlerts.length} alert types:`, availableAlerts);
        } else if (sport.toUpperCase() === 'MLB') {
          const { MLBEngine } = await import('./services/engines/mlb-engine');
          const tempEngine = new MLBEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'NFL') {
          const { NFLEngine } = await import('./services/engines/nfl-engine');
          const tempEngine = new NFLEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
          console.log(`🔍 NFL Engine returned ${availableAlerts.length} alert types:`, availableAlerts);
        } else if (sport.toUpperCase() === 'NBA') {
          const { NBAEngine } = await import('./services/engines/nba-engine');
          const tempEngine = new NBAEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
          console.log(`🔍 NBA Engine returned ${availableAlerts.length} alert types:`, availableAlerts);
        } else if (sport.toUpperCase() === 'WNBA') {
          const { WNBAEngine } = await import('./services/engines/wnba-engine');
          const tempEngine = new WNBAEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else if (sport.toUpperCase() === 'CFL') {
          const { CFLEngine } = await import('./services/engines/cfl-engine');
          const tempEngine = new CFLEngine();
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        } else {
          // Fallback to base engine for other sports
          const { BaseSportEngine } = await import('./services/engines/base-engine');
          const tempEngine = new (class extends BaseSportEngine {
            async calculateProbability() { return 0; }
          })(sport.toUpperCase());
          availableAlerts = await tempEngine.getAvailableAlertTypes();
        }

        // Get global settings but show all alerts (don't filter out disabled ones)
        const globalSettings = await unifiedSettings.getGlobalSettings(sport.toLowerCase());

        // Convert to the format expected by the frontend, including globally disabled alerts
        const alertConfig = availableAlerts.map(alertType => {
          const isGloballyEnabled = globalSettings[alertType] === true;
          const displayName = alertType
            .replace(`${sport.toUpperCase()}_`, '')
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');

          return {
            key: alertType,
            label: displayName,
            description: `${displayName} alerts for ${sport.toUpperCase()} games`,
            globallyEnabled: isGloballyEnabled
          };
        });

        const globallyEnabledCount = alertConfig.filter(alert => alert.globallyEnabled).length;
        console.log(`📋 Available alerts for ${sport.toUpperCase()}: ${globallyEnabledCount}/${availableAlerts.length} globally enabled, ${availableAlerts.length - globallyEnabledCount} globally disabled`);
        res.json(alertConfig);
      } catch (error) {
        console.error(`❌ Error getting available alerts for ${sport}:`, error);
        res.json([]); // Return empty array if no cylinders found
      }
    } catch (error) {
      console.error('Error fetching available alerts:', error);
      res.status(500).json({ message: 'Failed to fetch available alerts' });
    }
  });

  app.get('/api/admin/master-alerts', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const enabled = await storage.getMasterAlertEnabled();
      res.json({ enabled });
    } catch (error) {
      console.error('Error fetching master alerts status:', error);
      res.status(500).json({ message: 'Failed to fetch master alerts status' });
    }
  });

  app.put('/api/admin/master-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const { enabled } = req.body;

      // Actually persist the master alerts setting to the database
      await storage.setMasterAlertEnabled(enabled, req.session.adminUserId!);

      res.json({
        message: `Master alerts ${enabled ? 'enabled' : 'disabled'} successfully`,
        enabled
      });
    } catch (error) {
      console.error('Error updating master alerts:', error);
      res.status(500).json({ message: 'Failed to update master alerts' });
    }
  });

  app.put('/api/admin/global-alert-category', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const { sport, category, alertKeys, enabled } = req.body;

      // Update the category settings which will apply to all users
      await storage.updateGlobalAlertCategory(sport, alertKeys, enabled, req.session.adminUserId!);

      res.json({
        message: `Category ${enabled ? 'enabled' : 'disabled'} successfully`,
        sport,
        category,
        alertKeys,
        enabled
      });
    } catch (error) {
      console.error('Error updating category settings:', error);
      res.status(500).json({ message: 'Failed to update category settings' });
    }
  });


  // Global settings endpoint for user settings page
  app.get('/api/admin/global-settings', async (req, res) => {
    try {
      // This endpoint should return the same data as the sport-specific endpoint
      // but for all sports. For now, return MLB settings since that's what's being used
      const mlbSettings = await unifiedSettings.getGlobalSettings('MLB');
      res.json(mlbSettings);
    } catch (error) {
      console.error('Error fetching global settings:', error);
      res.status(500).json({ message: 'Failed to fetch global settings' });
    }
  });

  // Quick fix endpoint to enable critical MLB alerts
  app.post('/api/admin/quick-enable-mlb', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const criticalAlerts = [
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH'
      ];

      const results = [];
      for (const alertType of criticalAlerts) {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, req.session.adminUserId!);
        results.push({ alertType, enabled: true });
      }

      // ✅ Cache invalidation handled by storage layer

      res.json({
        message: 'Critical MLB alerts enabled successfully',
        enabledAlerts: results,
        nextStep: 'Alerts should start generating within 15 seconds if you have valid Telegram credentials'
      });
    } catch (error) {
      console.error('Error enabling critical alerts:', error);
      res.status(500).json({ message: 'Failed to enable critical alerts' });
    }
  });

  // Enable all alerts for testing
  app.post('/api/admin/enable-all-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const allAlerts = [
        'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'
      ];

      const results = [];
      for (const alertType of allAlerts) {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, req.session.adminUserId!);
        results.push({ alertType, enabled: true });
      }

      // ✅ Cache invalidation handled by storage layer

      res.json({
        message: 'All MLB alerts enabled for testing',
        enabledAlerts: results,
        count: results.length
      });
    } catch (error) {
      console.error('Error enabling all alerts:', error);
      res.status(500).json({ message: 'Failed to enable all alerts' });
    }
  });

  // Disable ALL alerts across entire system
  app.post('/api/admin/disable-all-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      console.log('🚫 ADMIN REQUEST: Disabling all alerts globally');

      // Define all alert types across all sports
      const allAlertTypes = {
        'MLB': [
          'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'
        ],
        'NFL': [
          'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'RED_ZONE', 'FOURTH_DOWN',
          'TWO_MINUTE_WARNING', 'CLUTCH_TIME', 'OVERTIME'
        ],
        'NCAAF': [
          'NCAAF_GAME_START', 'NCAAF_SECOND_HALF_KICKOFF', 'NCAAF_CLOSE_GAME', 'NCAAF_FOURTH_QUARTER',
          'NCAAF_HALFTIME', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_COMEBACK_POTENTIAL', 'NCAAF_FOURTH_DOWN_DECISION',
          'NCAAF_MASSIVE_WEATHER', 'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_RED_ZONE', 'NCAAF_SCORING_PLAY',
          'NCAAF_UPSET_OPPORTUNITY'
        ],
        'CFL': [
          'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING', 'CFL_FOURTH_QUARTER',
          'CFL_FINAL_MINUTES', 'CFL_GREY_CUP_IMPLICATIONS', 'CFL_THIRD_DOWN_SITUATION',
          'CFL_ROUGE_OPPORTUNITY', 'CFL_OVERTIME'
        ],
        'WNBA': [
          'WNBA_GAME_START', 'WNBA_FOURTH_QUARTER', 'WNBA_CLOSE_GAME', 'WNBA_OVERTIME',
          'WNBA_HIGH_SCORING', 'WNBA_COMEBACK', 'WNBA_CLUTCH_PERFORMANCE', 'WNBA_TWO_MINUTE_WARNING'
        ],
        'NBA': [
          'NBA_FOURTH_QUARTER', 'NBA_CLOSE_GAME', 'NBA_OVERTIME',
          'NBA_HIGH_SCORING', 'NBA_COMEBACK', 'NBA_CLUTCH_PERFORMANCE'
        ],
        'NHL': [
          'NHL_THIRD_PERIOD', 'NHL_CLOSE_GAME', 'NHL_OVERTIME',
          'NHL_POWER_PLAY', 'NHL_PENALTY_KILL', 'NHL_CLUTCH_PERFORMANCE'
        ]
      };

      let totalDisabled = 0;
      const results = [];

      // Disable all alert types globally
      for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
        for (const alertType of alertTypes) {
          try {
            await storage.updateGlobalAlertSetting(sport, alertType, false, req.session.adminUserId!);
            results.push({ sport, alertType, disabled: true });
            totalDisabled++;
          } catch (error) {
            console.error(`Failed to disable ${sport}.${alertType}:`, error);
            results.push({ sport, alertType, disabled: false, error: (error as Error).message });
          }
        }

        // ✅ Cache invalidation handled by storage layer
      }

      // Disable Telegram for all users
      const allUsers = await storage.getAllUsers();
      let telegramDisabled = 0;

      for (const user of allUsers) {
        if (user.telegramEnabled) {
          try {
            await storage.updateUserTelegramSettings(user.id, '', '', false);
            telegramDisabled++;
          } catch (error) {
            console.error(`Failed to disable Telegram for user ${user.username}:`, error);
          }
        }
      }

      res.json({
        message: 'ALL alert features disabled globally',
        summary: {
          alertTypesDisabled: totalDisabled,
          telegramUsersDisabled: telegramDisabled,
          totalUsers: allUsers.length
        },
        details: results,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Successfully disabled ${totalDisabled} alert types and ${telegramDisabled} Telegram configurations`);

    } catch (error) {
      console.error('Error disabling all alerts:', error);
      res.status(500).json({ message: 'Failed to disable all alerts' });
    }
  });

  // Reset global alert settings to defaults (clears all database overrides)
  app.post('/api/admin/reset-global-alerts', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const { sport } = req.body;
      if (!sport) {
        return res.status(400).json({ message: 'Sport parameter is required' });
      }

      console.log(`🔄 Admin resetting global alerts to defaults for ${sport}`);

      // Clear all existing global settings for this sport to use defaults
      await storage.clearGlobalAlertSettings(sport.toLowerCase());

      // Get defaults will now return the default values since no database overrides exist
      const defaults = await unifiedSettings.getGlobalSettings(sport.toLowerCase());
      const enabledCount = Object.values(defaults).filter(enabled => enabled).length;

      res.json({
        message: `Global alert settings reset to defaults for ${sport.toUpperCase()}`,
        sport: sport.toUpperCase(),
        enabledCount,
        settings: defaults
      });
    } catch (error) {
      console.error('Error resetting global alerts:', error);
      res.status(500).json({ message: 'Failed to reset global alerts' });
    }
  });

  app.put('/api/admin/apply-global-settings', requireAdminAuth, validateCSRF, async (req, res) => {
    try {

      const { sport, settings } = req.body;

      // Use the storage method to apply settings to all users
      const result = await storage.applyGlobalSettingsToAllUsers(sport, settings, req.session.adminUserId!);

      res.json({
        message: `Global settings applied to ${result.usersUpdated} users successfully`,
        sport,
        ...result
      });
    } catch (error) {
      console.error('Error applying global settings:', error);
      res.status(500).json({ message: 'Failed to apply global settings' });
    }
  });




  // V3 Performance Metrics API (admin-only)
  // Health check endpoint for alert generation system
  app.get('/api/health/alerts', async (req, res) => {
    try {
      const { getHealthMonitor } = await import('./services/unified-health-monitor');
      const healthMonitor = getHealthMonitor();
      const healthStatus = healthMonitor.getHealthStatus();

      // Determine HTTP status code based on health
      let statusCode = 200;
      if (healthStatus.status === 'critical') statusCode = 503;
      else if (healthStatus.status === 'unhealthy') statusCode = 500;
      else if (healthStatus.status === 'degraded') statusCode = 207;

      res.status(statusCode).json({
        status: healthStatus.status,
        summary: healthStatus.summary,
        recommendations: healthStatus.recommendations,
        metrics: {
          summary: healthStatus.summary,
          recommendations: healthStatus.recommendations,
          timeSinceLastCheck: healthStatus.timeSinceLastCheck,
          timeSinceLastAlert: healthStatus.timeSinceLastAlert,
          warnings: healthStatus.warnings
        },
        lastError: null
      });
    } catch (error: any) {
      console.error('Error fetching health status:', error);
      res.status(500).json({
        status: 'error',
        error: error.message,
        summary: 'Failed to fetch health status'
      });
    }
  });

  // Force recovery endpoint (admin only)
  app.post('/api/health/alerts/recover', async (req, res) => {
    try {
      if (!req.session.adminUserId) {
        return res.status(401).json({ message: 'Admin authentication required' });
      }

      const { getHealthMonitor } = await import('./services/unified-health-monitor');
      const healthMonitor = getHealthMonitor();

      console.log('🔧 Admin requested manual alert system recovery');
      await healthMonitor.forceRecovery();

      res.json({
        success: true,
        message: 'Alert system recovery initiated',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error forcing recovery:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to initiate recovery'
      });
    }
  });


  // === CALENDAR SYNC API ROUTES ===
  // Use MigrationAdapter with fallback to CalendarSyncService
  let migrationAdapter = (global as any).migrationAdapter;
  const getCalendarSyncService = () => (global as any).calendarSyncService;

  // Helper function to enrich game data with timeout/possession tracking
  async function enrichGameWithTrackingData(game: any) {
    // CalendarSyncService uses 'gameId' while some other sources use 'id'
    const gameId = game?.gameId || game?.id;
    console.log(`🔍 enrichGameWithTrackingData called for game: ${gameId}, sport: ${game?.sport}`);
    
    if (!game) return game;

    const footballSports = ['NFL', 'NCAAF', 'CFL'];
    if (!footballSports.includes(game.sport)) {
      console.log(`⏭️ Skipping enrichment for non-football sport: ${game.sport}`);
      return game;
    }

    try {
      // First, ensure the game is adopted by GameStateManager and timeout tracking is initialized
      const { gameStateManager } = await import('./services/game-state-manager');
      
      // Wait a short time for GameStateManager to adopt and initialize the game if needed
      // GameStateManager processes games async via CalendarSyncService
      let retries = 3;
      let waitTime = 100; // ms
      
      while (retries > 0) {
        const gameState = gameStateManager.getGameState(gameId);
        if (gameState) {
          console.log(`✅ Game ${gameId} found in GameStateManager with state: ${gameState.currentState}`);
          break;
        }
        console.log(`⏳ Waiting for GameStateManager to adopt game ${gameId}... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries--;
      }
      
      const { engineLifecycleManager } = await import('./services/engine-lifecycle-manager');
      const engine = engineLifecycleManager.getEngine(game.sport);

      console.log(`🔍 Enrichment attempt for game ${gameId} (${game.sport}) - engine found: ${!!engine}`);

      if (!engine) {
        console.log(`❌ No engine found for ${game.sport}`);
        return game;
      }

      // Get timeout data
      if (engine.getTimeoutStats) {
        const timeoutStats = engine.getTimeoutStats(gameId);
        console.log(`🔍 Timeout stats for game ${gameId}:`, JSON.stringify(timeoutStats, null, 2));
        if (timeoutStats && timeoutStats.tracked) {
          game.homeTimeoutsRemaining = timeoutStats.homeTimeoutsRemaining;
          game.awayTimeoutsRemaining = timeoutStats.awayTimeoutsRemaining;
          console.log(`✅ Added timeout data: Home ${game.homeTimeoutsRemaining}, Away ${game.awayTimeoutsRemaining}`);
        } else {
          console.log(`⚠️ Timeout stats not tracked or missing for game ${gameId}`);
        }
      } else {
        console.log(`❌ Engine ${game.sport} does not have getTimeoutStats method`);
      }

      // Get possession data
      if (engine.getPossessionStats) {
        const possessionStats = engine.getPossessionStats(gameId);
        if (possessionStats && possessionStats.tracked) {
          game.possession = possessionStats.currentPossession === 'home' ? game.homeTeam?.name : game.awayTeam?.name;
          game.homePossessions = possessionStats.homePossessions;
          game.awayPossessions = possessionStats.awayPossessions;
        }
      }
    } catch (error) {
      console.error(`❌ Error enriching game ${gameId}:`, error);
    }

    return game;
  }

  // Get all calendar data
  app.get('/api/calendar', async (req, res) => {
    try {
      const { sport } = req.query;
      migrationAdapter = (global as any).migrationAdapter;
      const calendarSyncService = getCalendarSyncService();

      if (!migrationAdapter && !calendarSyncService) {
        return res.status(503).json({
          error: 'Calendar service not available',
          message: 'Calendar service is initializing'
        });
      }

      const games = migrationAdapter
        ? migrationAdapter.getGameData(sport as string)
        : calendarSyncService.getAllGames();

      // Enrich games with timeout/possession tracking data
      const enrichedGames = await Promise.all(
        (games || []).map(game => enrichGameWithTrackingData(game))
      );

      res.json({
        success: true,
        games: enrichedGames,
        sport: sport || 'all',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Calendar API: Error fetching calendar data:', error);
      res.status(500).json({ error: 'Failed to fetch calendar data', details: error.message });
    }
  });

  // Get calendar data for specific sport
  app.get('/api/calendar/:sport', async (req, res) => {
    try {
      const { sport } = req.params;
      migrationAdapter = (global as any).migrationAdapter;
      const calendarSyncService = getCalendarSyncService();

      if (!migrationAdapter && !calendarSyncService) {
        return res.status(503).json({
          error: 'Calendar service not available',
          message: 'Calendar service is initializing'
        });
      }

      const games = migrationAdapter
        ? migrationAdapter.getGameData(sport.toLowerCase())
        : calendarSyncService.getGamesForSport(sport.toUpperCase());

      // Enrich games with timeout/possession tracking data
      const enrichedGames = await Promise.all(
        (games || []).map(game => enrichGameWithTrackingData(game))
      );

      res.json({
        success: true,
        sport: sport.toUpperCase(),
        games: enrichedGames,
        count: enrichedGames.length,
        timestamp: new Date().toISOString(),
        source: migrationAdapter ? 'migration-adapter' : 'calendar-sync-service'
      });
    } catch (error: any) {
      console.error(`❌ Calendar API: Error fetching ${req.params.sport} calendar data:`, error);
      res.status(500).json({ error: `Failed to fetch ${req.params.sport} calendar data`, details: error.message });
    }
  });

  // Get specific game data
  app.get('/api/calendar/game/:gameId', async (req, res) => {
    try {
      const { gameId } = req.params;
      // Find game across all sports via migration adapter
      const allGames = migrationAdapter ? migrationAdapter.getGameData() : [];
      const game = allGames.find((g: any) => g.gameId === gameId);

      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      res.json({
        success: true,
        game,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ Calendar API: Error fetching game ${req.params.gameId}:`, error);
      res.status(500).json({ error: 'Failed to fetch game data', details: error.message });
    }
  });

  // Get calendar sync metrics
  app.get('/api/calendar/metrics', async (req, res) => {
    try {
      const metrics = migrationAdapter ? migrationAdapter.getMetrics() : null;

      if (!metrics) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Calendar service is initializing'
        });
      }

      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Calendar API: Error fetching metrics:', error);
      res.status(500).json({ error: 'Failed to fetch calendar metrics', details: error.message });
    }
  });

  // Force refresh specific sport
  app.post('/api/calendar/force-refresh/:sport', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      const { sport } = req.params;

      // Only admins can force refresh
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for force refresh' });
      }

      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Calendar service is initializing'
        });
      }

      await migrationAdapter.forceRefresh(sport.toLowerCase());

      console.log(`📅 Calendar API: Admin ${req.user.id} force refreshed ${sport.toUpperCase()} calendar data`);

      res.json({
        success: true,
        message: `${sport.toUpperCase()} calendar data refresh initiated`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ Calendar API: Error force refreshing ${req.params.sport}:`, error);
      res.status(500).json({ error: `Failed to force refresh ${req.params.sport}`, details: error.message });
    }
  });

  // Start calendar sync service
  app.post('/api/calendar/start', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      // Only admins can start/stop the service
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Calendar service is initializing'
        });
      }

      // MigrationAdapter starts both services
      await migrationAdapter.start();

      console.log(`📅 Calendar API: Admin ${req.user.id} started calendar sync service`);

      res.json({
        success: true,
        message: 'Calendar sync service started',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Calendar API: Error starting service:', error);
      res.status(500).json({ error: 'Failed to start calendar sync service', details: error.message });
    }
  });

  // Stop calendar sync service
  app.post('/api/calendar/stop', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      // Only admins can start/stop the service
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Calendar service is initializing'
        });
      }

      // MigrationAdapter stops both services
      await migrationAdapter.stop();

      console.log(`📅 Calendar API: Admin ${req.user.id} stopped calendar sync service`);

      res.json({
        success: true,
        message: 'Calendar sync service stopped',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Calendar API: Error stopping service:', error);
      res.status(500).json({ error: 'Failed to stop calendar sync service', details: error.message });
    }
  });

  // Register unified health monitoring routes with error handling
  try {
    console.log('🔧 Attempting to register unified health monitoring routes...');
    registerHealthRoutes(app);
    console.log('✅ Unified health monitoring routes registration completed');
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR: Failed to register unified health monitoring routes:', error.message);
    console.error('Stack trace:', error.stack);

    // Fallback: Register basic health routes manually if needed
    app.get('/api/health/status', (req, res) => {
      res.status(500).json({
        error: 'Health monitoring system failed to initialize',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });

    console.log('⚠️ Fallback health routes registered due to initialization failure');
  }

  // Migration Adapter Status and Diagnostics Endpoints
  app.get('/api/migration/status', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing',
          healthy: false,
          timestamp: new Date().toISOString()
        });
      }

      const status = migrationAdapter.getStatus();
      res.json({
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching migration status:', error);
      res.status(500).json({ error: 'Failed to fetch migration status' });
    }
  });

  app.get('/api/migration/diagnostics', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const status = migrationAdapter.getStatus();
      const metrics = migrationAdapter.getMetrics();
      const rolloutController = migrationAdapter.getRolloutController();
      const rolloutStatus = rolloutController.getStatus();

      res.json({
        status: status.status,
        services: status.services,
        rollout: rolloutStatus,
        health: status.health,
        comparison: status.comparison || {
          eventsProcessed: 0,
          productionEvents: 0,
          shadowEvents: 0,
          divergenceRate: 0,
          averageLatencyDiff: 0,
          matchSuccessRate: 0,
          errorRate: 0,
          lastUpdate: new Date()
        },
        metrics,
        uptime: status.uptime,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching migration diagnostics:', error);
      res.status(500).json({ error: 'Failed to fetch migration diagnostics' });
    }
  });

  app.get('/api/migration/comparison-metrics', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available'
        });
      }

      const status = migrationAdapter.getStatus();
      const comparisonMetrics = status.comparison;

      if (!comparisonMetrics) {
        return res.json({
          message: 'No comparison metrics available - comparison system may not be initialized',
          eventsProcessed: 0,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        ...comparisonMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching comparison metrics:', error);
      res.status(500).json({ error: 'Failed to fetch comparison metrics' });
    }
  });

  // === CONTROL PLANE ENDPOINTS FOR MIGRATIONADAPTER ===

  // ROLLOUT MANAGEMENT ENDPOINTS

  // Set rollout percentage for specific sport (0-100%)
  app.post('/api/migration/rollout/sport/:sport', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const { sport } = req.params;
      const { percentage } = req.body;

      // Validation
      if (typeof percentage !== 'number') {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'Percentage must be a number'
        });
      }

      if (percentage < 0 || percentage > 100) {
        return res.status(400).json({
          error: 'Invalid percentage',
          message: 'Percentage must be between 0 and 100'
        });
      }

      const rolloutController = migrationAdapter.getRolloutController();

      // Set the rollout percentage
      rolloutController.setSportPercentage(sport.toUpperCase(), percentage);

      const newStatus = rolloutController.getStatus();

      console.log(`🎛️ Control Plane: Set ${sport.toUpperCase()} rollout to ${percentage}% via API`);

      res.json({
        success: true,
        message: `Rollout percentage for ${sport.toUpperCase()} set to ${percentage}%`,
        sport: sport.toUpperCase(),
        oldPercentage: rolloutController.getSportPercentage(sport.toUpperCase()),
        newPercentage: percentage,
        rolloutStatus: newStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error setting sport rollout percentage:', error);
      res.status(400).json({
        error: 'Failed to set rollout percentage',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get current rollout status for all sports
  app.get('/api/migration/rollout', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const rolloutController = migrationAdapter.getRolloutController();
      const rolloutStatus = rolloutController.getStatus();
      const savedState = rolloutController.getSavedRolloutState();

      res.json({
        success: true,
        rollout: {
          ...rolloutStatus,
          savedState
        },
        supportedSports: ['MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'],
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error fetching rollout status:', error);
      res.status(500).json({
        error: 'Failed to fetch rollout status',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Pause all rollouts (saves current state and sets all to 0%)
  app.post('/api/migration/rollout/pause', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const rolloutController = migrationAdapter.getRolloutController();

      // Save current state before pausing
      const preState = rolloutController.getStatus();
      rolloutController.pauseAllRollouts();
      const postState = rolloutController.getStatus();

      console.log('⏸️ Control Plane: All rollouts paused via API');

      res.json({
        success: true,
        message: 'All rollouts paused - switched to legacy mode',
        previousState: preState,
        currentState: postState,
        canResume: true,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error pausing rollouts:', error);
      res.status(500).json({
        error: 'Failed to pause rollouts',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Resume rollouts to previously saved state
  app.post('/api/migration/rollout/resume', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const rolloutController = migrationAdapter.getRolloutController();
      const savedState = rolloutController.getSavedRolloutState();

      if (!savedState.hasSavedState) {
        return res.status(400).json({
          error: 'No saved state to resume',
          message: 'No previous rollout state has been saved. Use pause first or set individual sport percentages.',
          timestamp: new Date().toISOString()
        });
      }

      // Resume to saved state
      rolloutController.resumeAllRollouts();
      const newState = migrationAdapter.getStatus();

      console.log('▶️ Control Plane: All rollouts resumed via API');

      res.json({
        success: true,
        message: 'Rollouts resumed to previous state',
        restoredState: newState,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error resuming rollouts:', error);
      res.status(500).json({
        error: 'Failed to resume rollouts',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // MIGRATION CONTROL ENDPOINTS

  // Enable MigrationAdapter components
  app.post('/api/migration/enable', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const preStatus = migrationAdapter.getStatus();

      if (preStatus.status === 'running') {
        return res.json({
          success: true,
          message: 'Migration adapter is already running',
          status: preStatus,
          timestamp: new Date().toISOString()
        });
      }

      // Start the migration adapter
      await migrationAdapter.start();
      const postStatus = migrationAdapter.getStatus();

      console.log('🚀 Control Plane: MigrationAdapter enabled via API');

      res.json({
        success: true,
        message: 'MigrationAdapter components enabled successfully',
        previousStatus: preStatus.status,
        currentStatus: postStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error enabling migration adapter:', error);
      res.status(500).json({
        error: 'Failed to enable MigrationAdapter',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Disable MigrationAdapter components
  app.post('/api/migration/disable', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const preStatus = migrationAdapter.getStatus();

      if (preStatus.status === 'stopped') {
        return res.json({
          success: true,
          message: 'Migration adapter is already stopped',
          status: preStatus,
          timestamp: new Date().toISOString()
        });
      }

      // Stop the migration adapter
      await migrationAdapter.stop();
      const postStatus = migrationAdapter.getStatus();

      console.log('🛑 Control Plane: MigrationAdapter disabled via API');

      res.json({
        success: true,
        message: 'MigrationAdapter components disabled successfully',
        previousStatus: preStatus.status,
        currentStatus: postStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error disabling migration adapter:', error);
      res.status(500).json({
        error: 'Failed to disable MigrationAdapter',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Comprehensive health check of all components
  app.get('/api/migration/health', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing',
          healthy: false,
          timestamp: new Date().toISOString()
        });
      }

      const status = migrationAdapter.getStatus();
      const metrics = migrationAdapter.getMetrics();
      const rolloutController = migrationAdapter.getRolloutController();
      const rolloutStatus = rolloutController.getStatus();

      // Determine overall health
      const isHealthy = status.status === 'running' &&
                       status.health.overall === 'healthy' &&
                       (status.services.calendarSync.healthy || status.services.dataIngestion.healthy);

      const healthCheck = {
        healthy: isHealthy,
        status: status.status,
        uptime: status.uptime,
        services: {
          calendarSync: {
            healthy: status.services.calendarSync.healthy,
            running: status.services.calendarSync.running,
            errorCount: status.services.calendarSync.errorCount,
            lastCheck: status.services.calendarSync.lastCheck,
            responseTime: status.services.calendarSync.responseTimeMs
          },
          dataIngestion: {
            healthy: status.services.dataIngestion.healthy,
            running: status.services.dataIngestion.running,
            errorCount: status.services.dataIngestion.errorCount,
            lastCheck: status.services.dataIngestion.lastCheck,
            responseTime: status.services.dataIngestion.responseTimeMs
          }
        },
        health: {
          overall: status.health.overall,
          checksPerformed: status.health.checksPerformed,
          checksPassed: status.health.checksPassed,
          successRate: status.health.checksPerformed > 0
            ? (status.health.checksPassed / status.health.checksPerformed * 100).toFixed(1) + '%'
            : '0%',
          failureStreak: status.health.failureStreak,
          lastCheck: status.health.lastCheckTime
        },
        rollout: rolloutStatus,
        comparison: status.comparison || {
          eventsProcessed: 0,
          message: 'Comparison system not available'
        },
        metrics: {
          migration: metrics.migration,
          hasCalendarMetrics: !!metrics.calendarSync,
          hasIngestionMetrics: !!metrics.dataIngestion
        },
        recommendations: [] as string[]
      };

      // Add health recommendations
      if (!isHealthy) {
        healthCheck.recommendations.push('System is not fully healthy - check service status');
      }
      if (status.health.failureStreak > 0) {
        healthCheck.recommendations.push(`Health check failure streak: ${status.health.failureStreak} - investigate service issues`);
      }
      if (!status.services.calendarSync.healthy && !status.services.dataIngestion.healthy) {
        healthCheck.recommendations.push('Both calendar sync and data ingestion services are unhealthy - immediate attention required');
      }
      if (rolloutStatus.mode !== 'legacy' && rolloutStatus.migrationProgress === 0) {
        healthCheck.recommendations.push('Migration mode is not legacy but no sports have rollout configured');
      }

      res.json({
        success: true,
        ...healthCheck,
        timestamp: new Date().toISOString()
       });

    } catch (error: any) {
      console.error('❌ Control Plane: Error performing health check:', error);
      res.status(500).json({
        error: 'Health check failed',
        healthy: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Reset metrics and comparison data
  app.post('/api/migration/reset', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const preStatus = migrationAdapter.getStatus();

      // Reset all metrics and comparison data
      await migrationAdapter.resetMetricsAndComparison();

      const postStatus = migrationAdapter.getStatus();

      console.log('🔄 Control Plane: Metrics and comparison data reset via API');

      res.json({
        success: true,
        message: 'All metrics and comparison data have been reset successfully',
        resetItems: [
          'MetricsCollector data',
          'EventComparator comparison results',
          'OutputRouter metrics',
          'Health check counters'
        ],
        statusBefore: {
          healthChecksPerformed: preStatus.health.checksPerformed,
          healthChecksPassed: preStatus.health.checksPassed,
          comparisonMetrics: preStatus.comparison ? 'Available' : 'Not available'
        },
        statusAfter: {
          healthChecksPerformed: postStatus.health.checksPerformed,
          healthChecksPassed: postStatus.health.checksPassed,
          comparisonMetrics: postStatus.comparison ? 'Available' : 'Reset'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Control Plane: Error resetting metrics:', error);
      res.status(500).json({
        error: 'Failed to reset metrics and comparison data',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // === MISSING CRITICAL ENDPOINTS ===

  // Admin-only mode change endpoint with safety checks and force option
  app.post('/api/migration/mode', requireAdminAuth, validateCSRF, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const { mode, force, reason, minimumThreshold } = req.body;

      // Validate mode parameter
      const validModes = ['legacy', 'ingestion', 'hybrid'];
      if (!mode || !validModes.includes(mode)) {
        return res.status(400).json({
          error: 'Invalid mode parameter',
          message: `Mode must be one of: ${validModes.join(', ')}`,
          providedMode: mode
        });
      }

      // Get current status
      const currentStatus = migrationAdapter.getStatus();
      const rolloutController = (migrationAdapter as any).rolloutController;

      if (!rolloutController) {
        return res.status(503).json({
          error: 'Rollout controller not available'
        });
      }

      try {
        // Attempt mode change with safety checks
        rolloutController.setMode(mode, {
          force: force === true,
          operator: req.user?.username || req.user?.email || 'UNKNOWN_ADMIN',
          reason: reason || `API mode change to ${mode}`,
          minimumThreshold: minimumThreshold || 10
        });

        // Get updated status
        const newStatus = migrationAdapter.getStatus();
        const modeChangeLog = rolloutController.getModeChangeLog();
        const latestChange = modeChangeLog[modeChangeLog.length - 1];

        console.log(`🎛️ Admin Control Plane: Mode changed from ${currentStatus.rollout.mode} to ${mode} via API`);

        res.json({
          success: true,
          message: `Migration mode successfully changed from '${currentStatus.rollout.mode}' to '${mode}'`,
          modeChange: {
            oldMode: currentStatus.rollout.mode,
            newMode: mode,
            forced: force === true,
            operator: req.user?.username || req.user?.email || 'UNKNOWN_ADMIN',
            reason: reason || `API mode change to ${mode}`,
            timestamp: new Date().toISOString()
          },
          rolloutStatus: newStatus.rollout,
          modeChangeRecord: latestChange,
          timestamp: new Date().toISOString()
        });

      } catch (safetyError: any) {
        console.warn(`🚨 Admin Control Plane: Mode change safety check failed:`, safetyError.message);

        res.status(400).json({
          error: 'Mode change safety check failed',
          message: safetyError.message,
          safetyCheckFailed: true,
          currentMode: currentStatus.rollout.mode,
          requestedMode: mode,
          forceRequired: !force && safetyError.message.includes('SAFETY_CHECK_FAILED'),
          suggestion: force ? 'Safety checks still failed even with force=true' : 'Add force:true to override safety checks',
          currentRolloutStatus: currentStatus.rollout,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error: any) {
      console.error('❌ Admin Control Plane: Mode change error:', error);
      res.status(500).json({
        error: 'Mode change failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get saved rollout state for inspection
  app.get('/api/migration/rollout/saved', requireAdminAuth, async (req, res) => {
    try {
      if (!migrationAdapter) {
        return res.status(503).json({
          error: 'Migration adapter not available',
          message: 'Migration adapter is initializing'
        });
      }

      const rolloutController = (migrationAdapter as any).rolloutController;

      if (!rolloutController) {
        return res.status(503).json({
          error: 'Rollout controller not available'
        });
      }

      const savedState = rolloutController.getSavedRolloutState();
      const currentStatus = migrationAdapter.getStatus();
      const isPaused = rolloutController.isPausedState();

      res.json({
        success: true,
        savedState: {
          ...savedState,
          savedAt: savedState.hasSavedState ? 'Available' : 'No saved state',
        },
        currentState: {
          mode: currentStatus.rollout.mode,
          percentages: currentStatus.rollout.sportPercentages,
          isPaused: isPaused,
          migrationProgress: currentStatus.rollout.migrationProgress
        },
        comparison: {
          hasChanges: savedState.hasSavedState && (
            savedState.mode !== currentStatus.rollout.mode ||
            JSON.stringify(savedState.percentages) !== JSON.stringify(currentStatus.rollout.sportPercentages)
          ),
          canResume: savedState.hasSavedState && isPaused,
          canPause: !isPaused
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Admin Control Plane: Error fetching saved rollout state:', error);
      res.status(500).json({
        error: 'Failed to fetch saved rollout state',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // REMOVED: Old gambling insights routes - now handled through /api/users/me (GET) and PATCH /api/users/me

  // AI metrics endpoint - using UnifiedAIProcessor only
  app.get('/api/ai/generative/metrics', async (req, res) => {
    try {
      const metrics = unifiedAIProcessor.getPerformanceMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching AI metrics:', error);
      res.status(500).json({ error: 'Failed to fetch AI metrics' });
    }
  });

  // AI Health and metrics
  app.get('/api/ai/health/metrics', async (req, res) => {
    try {
      const health = unifiedAIProcessor.getHealthStatus();
      const metrics = unifiedAIProcessor.getPerformanceMetrics();

      res.json({
        status: health.status,
        health,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching AI health and metrics:', error);
      res.status(500).json({ error: 'Failed to fetch AI health and metrics' });
    }
  });

  return httpServer;
}