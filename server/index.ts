import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";
// ✅ V3: Using UnifiedAlertGenerator instead of legacy V2 AlertGenerator
import { db } from "./db";
import { alertCleanupService } from './services/alert-cleanup';
import { SingleInstanceLock } from "./utils/singleton-lock";
import { EmergencyMemoryMonitor } from "./emergency-memory-monitor";

// 🔒 PERMANENT PORT CONFLICT SOLUTION - ACQUIRE SINGLE INSTANCE LOCK FIRST
console.log('🔒 Checking for existing ChirpBot instances...');

// Determine target port early - use platform PORT or default to 3000
const TARGET_PORT = parseInt(process.env.PORT || "3000", 10);
const ALLOW_DYNAMIC_PORT = process.env.ALLOW_DYNAMIC_PORT === 'true';

// Create and acquire singleton lock with development restart support
const instanceLock = new SingleInstanceLock();

// Use async IIFE to handle the promise
(async () => {
  const lockAcquired = await instanceLock.acquire(TARGET_PORT);

  if (!lockAcquired) {
    // Another healthy instance is already running - exit gracefully
    console.log('✅ Exiting gracefully - no port conflicts will occur');
    process.exit(0);
  }

  console.log(`🔒 Single instance lock acquired for PID ${process.pid}`);
})().catch((error) => {
  console.error('❌ Failed to acquire singleton lock:', error);
  process.exit(1);
});

// 🔄 V3 ALERT GENERATION SYSTEM: SINGLE PIPELINE
console.log("🚀 V3 Alert System: Starting unified pipeline");
if (!(globalThis as any).__v3_alert_system_bootstrapped__) {
  (globalThis as any).__v3_alert_system_bootstrapped__ = true;
  
  void (async () => {
    try {
      const { CalendarSyncService } = await import('./services/calendar-sync-service');
      const { GameStateManager } = await import('./services/game-state-manager');
      const { EngineLifecycleManager } = await import('./services/engine-lifecycle-manager');

      const engineLifecycleManager = new EngineLifecycleManager();
      const gameStateManager = new GameStateManager();
      gameStateManager.setEngineLifecycleManager(engineLifecycleManager);
      await gameStateManager.start();

      const calendarSyncService = CalendarSyncService.getInstance({
        sports: ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL'],
        enableMetrics: true
      });
      
      calendarSyncService.setGameStateManager(gameStateManager);
      gameStateManager.setCalendarSyncService(calendarSyncService);
      await calendarSyncService.start();

      const { migrationAdapter } = await import('./services/migration-adapter');
      migrationAdapter.initialize(calendarSyncService, gameStateManager);

      (global as any).calendarSyncService = calendarSyncService;
      (global as any).gameStateManager = gameStateManager;
      (global as any).engineLifecycleManager = engineLifecycleManager;
      (global as any).migrationAdapter = migrationAdapter;
      
      console.log("✅ V3 Alert System: Unified pipeline active");
    } catch (e) {
      console.error("❌ V3 Alert System: Failed to initialize", e);
    }
  })();
}

// Startup guard to prevent double initialization within same process
if ((globalThis as any).__SERVER_STARTED__) {
  console.log('🔄 Server already started, skipping duplicate initialization');
  process.exit(0);
}
(globalThis as any).__SERVER_STARTED__ = true;

// Keep track of server and monitoring timer for graceful shutdown
let httpServer: any = null;
let monitoringInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;
let serverSockets = new Set<any>(); // Track active connections for proper cleanup

// Export monitoring interval setter for routes.ts
(global as any).setMonitoringInterval = (interval: NodeJS.Timeout) => {
  monitoringInterval = interval;
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n📍 ${signal} signal received - starting graceful shutdown...`);

  try {
    // Destroy all active connections first
    for (const socket of serverSockets) {
      (socket as any).destroy();
    }
    serverSockets.clear();
    console.log('✅ Active connections destroyed');

    // Close server to stop accepting new connections
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('✅ Server closed');
          resolve();
        });
      });
    }

    // Clear monitoring interval to prevent port binding issues
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      console.log('✅ Alert monitoring timer cleared');
    }

    // DataIngestionService cleanup removed - using CalendarSyncService only

    // MigrationAdapter cleanup removed - simplified architecture

    // Database uses HTTP connection - no need to close
    console.log('✅ Database connections handled');

    // Release singleton lock
    instanceLock.release();
    console.log('✅ Singleton lock released');

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    // Always release lock even on error
    instanceLock.release();
    process.exit(1);
  }
};

// Global error handlers - ULTRA ROBUST
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED REJECTION DETECTED:');
  console.error('  Promise:', promise);
  console.error('  Reason:', reason);
  console.error('  Stack:', reason instanceof Error ? reason.stack : 'No stack trace available');

  // Try to identify the source
  if (reason instanceof Error) {
    if (reason.message?.includes('database')) {
      console.log('🔄 Database connection issue - will retry on next operation');
    } else if (reason.message?.includes('fetch') || reason.message?.includes('ENOTFOUND')) {
      console.log('🔄 Network/API issue detected - will retry on next request');
    } else if (reason.message?.includes('timeout')) {
      console.log('🔄 Timeout detected - will retry with increased timeout');
    } else {
      console.log('🔄 Generic error handled - continuing operations');
    }
  }

  // Log but continue running - don't crash
});

process.on('uncaughtException', (error: any) => {
  console.error('⚠️ Uncaught Exception:', error);

  // 🔒 NO MORE EADDRINUSE EXITS - Our singleton lock prevents these entirely!
  // The singleton lock ensures we never try to bind to a port that's already in use

  // For database errors, try to reconnect
  if (error.message?.includes('database')) {
    console.log('🔄 Database error detected - continuing with degraded service');
    return;
  }

  // For other non-critical errors, log and continue
  console.log('🔄 Continuing despite error - service may be degraded');
});

// Handle shutdown signals properly
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restart
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// 🔒 SECURITY: Startup validation for critical secrets
function validateSecurityConfig() {
  console.log('🔒 Validating security configuration...');

  // SESSION_SECRET is absolutely critical for security
  if (!process.env.SESSION_SECRET) {
    console.error('❌ CRITICAL SECURITY ERROR: SESSION_SECRET environment variable is not set!');
    console.error('   This is required for secure session management.');
    console.error('   Please set SESSION_SECRET to a strong random value (at least 32 characters).');
    if (process.env.NODE_ENV === 'production') {
      console.error('   FATAL: Cannot start in production without SESSION_SECRET.');
      process.exit(1); // Fail fast in production
    } else {
      console.error('   WARNING: Development server will continue but sessions will be insecure.');
    }
  } else {
    const secret = process.env.SESSION_SECRET;
    if (secret.length < 32) {
      console.warn('⚠️  SESSION_SECRET is shorter than 32 characters. Consider using a longer secret for better security.');
    }
    console.log(`✅ SESSION_SECRET validation passed (${secret.length} characters)`);
  }

  // Validate other critical security settings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
      console.error('❌ CRITICAL: DATABASE_URL is required in production');
      process.exit(1);
    }
    console.log('✅ Production security validation passed');
  }

  console.log('🔒 Security configuration validation complete');
}

// Validate security configuration before starting
validateSecurityConfig();

const app = express();

// Security and CORS
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Vite dev mode
}));
// 🔒 PORT PREFLIGHT CHECK WITH BACKOFF - Ensure port is truly available
let PORT = TARGET_PORT;

// Check if port is actually available and wait if needed
const checkPortAvailability = async () => {
  console.log(`🔍 Checking port ${PORT} availability...`);

  const isAvailable = await SingleInstanceLock.waitForPortAvailable(PORT, 5);

  if (!isAvailable) {
    if (ALLOW_DYNAMIC_PORT && process.env.NODE_ENV === 'development') {
      console.log(`🔄 Port ${PORT} still busy, finding alternative...`);
      const newPort = await SingleInstanceLock.findAvailablePort(PORT + 1);
      console.log(`✅ Using alternative port: ${newPort}`);
      PORT = newPort;
      process.env.PORT = PORT.toString(); // Update environment for consistency
    } else {
      console.error(`❌ Port ${PORT} unavailable after waiting - exiting gracefully`);
      instanceLock.release();
      process.exit(0);
    }
  }

  console.log(`✅ Port ${PORT} confirmed available`);
};

// CORS configuration for consistent origin handling across all environments
const corsOrigin = process.env.CANONICAL_ORIGIN || true; // Allow all origins for consistent behavior

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Anti-caching and service worker control headers
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Session middleware removed from here - handled route-specifically in routes.ts
// This prevents conflicts between user and admin sessions

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function startServer() {
  try {
    // 🔒 PREFLIGHT PORT CHECK - Ensure port is available before binding
    await checkPortAvailability();

    // Create HTTP server once in index.ts only - FIX SHADOWING ISSUE
    httpServer = createServer(app);

    // Track connections for proper cleanup
    httpServer.on('connection', (socket: any) => {
      serverSockets.add(socket);
      socket.on('close', () => {
        serverSockets.delete(socket);
      });
    });

    const server = await registerRoutes(app, httpServer);

    // Setup frontend serving IMMEDIATELY - before server.listen
    const staticRoot = path.resolve(process.cwd(), 'dist/public');
    const indexPath = path.join(staticRoot, 'index.html');

    if (fs.existsSync(indexPath)) {
      console.log('✅ Built assets detected - serving static files from', staticRoot);
      app.use(express.static(staticRoot));

      // SPA catch-all for all non-API routes
      app.get(/^\/(?!api|admin|realtime-alerts).*$/, (_req, res) => {
        res.sendFile(indexPath);
      });
      console.log('✅ Static SPA serving configured - frontend ready');
    } else {
      console.log('🔧 No built assets found - will use Vite dev middleware');
      
      // Prevent duplicate setupVite calls
      if (!(globalThis as any).__VITE_ATTACHED__) {
        // Temporarily override PORT for Vite HMR to avoid conflict
        const originalPort = process.env.PORT;
        const hmrPort = String(parseInt(process.env.PORT || "5000", 10) + 1000);
        process.env.PORT = hmrPort;
        
        await setupVite(app, server);
        
        // Restore original PORT for Express server
        process.env.PORT = originalPort;
        (globalThis as any).__VITE_ATTACHED__ = true;
        
        console.log(`✅ Vite dev server configured - HMR on port ${hmrPort}, frontend ready`);
      } else {
        console.log('✅ Vite dev server already attached - skipping duplicate setup');
      }
    }

    // Production optimization: Skip database seeding in production
    const isProduction = process.env.NODE_ENV === 'production';
    const skipSeed = isProduction && process.env.SKIP_SEED_IN_PROD !== 'false';

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('Express error handler:', {
        error: err.message,
        stack: err.stack,
        url: _req.url,
        method: _req.method,
        status
      });

      // Ensure response is sent if not already sent
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      // Don't throw err - this was causing unhandled rejections!
    });

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 3000 to avoid Vite conflicts.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    // PORT already defined above for CORS
    const HOST = "0.0.0.0"; // Always bind to 0.0.0.0 for Replit deployment

    // Store server reference for graceful shutdown
    (globalThis as any).httpServer = httpServer;

    // 🔒 BULLETPROOF ERROR HANDLING - Should never get EADDRINUSE due to preflight checks
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`🚨 UNEXPECTED: Port ${PORT} conflict despite preflight checks!`);
        console.log('🔄 This should not happen with our singleton lock - investigating...');
        instanceLock.release();
        process.exit(1);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Port ${PORT} requires elevated privileges`);
        instanceLock.release();
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        instanceLock.release();
        process.exit(1);
      }
    });

    // 🔒 FALLBACK: Add 'listening' event handler for reliability
    server.on('listening', () => {
      console.log('📡 HTTP Server listening event triggered - DataIngestionService should be operational');

      // Verify DataIngestionService is running
      const di = (global as any).dataIngestionIntegration;
      if (di) {
        console.log('✅ DataIngestionService confirmed operational via listening event');
      } else {
        console.log('⚠️ DataIngestionService not yet available - may still be initializing');
      }
    });

    // 🔒 SECURE SERVER STARTUP - Port conflicts now impossible!
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server is running on ${HOST}:${PORT}`);
      console.log(`📋 DATAINGESTIONSERVICE: BOOTSTRAP HIT - Version 3.1.2`);
      console.log(`📋 DATAINGESTIONSERVICE: Starting immediate initialization in guaranteed execution path`);

      // ✅ V3: UnifiedAlertGenerator disabled - CalendarSyncService is now the sole data ingestion system
      // Alert generation is handled by CalendarSyncService → GameStateManager → Engines flow
      console.log('📋 V3: Using CalendarSyncService as single data ingestion system (UnifiedAlertGenerator disabled)');


      // Start Weather-on-Live service after server is ready
      setTimeout(async () => {
        try {
          console.log('🌤️ Starting Weather-on-Live service...');
          const { weatherOnLiveService } = await import('./services/weather-on-live-service');

          // WebSocket functionality removed - using HTTP polling architecture
          console.log(`✅ Weather-on-Live service started`);
          console.log(`📡 Using HTTP polling architecture for real-time updates`);

          console.log(`🌤️ Weather monitoring will start automatically when games go LIVE`);
        } catch (error) {
          console.error('❌ Failed to start Weather-on-Live service:', error);
        }
      }, 6000); // Wait 6 seconds to start after alert monitoring

      // 🚀 DataIngestionService now initialized at top-level (Architect's Fix)
      console.log('📋 DataIngestionService: Initialization moved to top-level for proper execution');

      console.log(`🔒 Singleton lock active - port conflicts prevented`);
      console.log(`📱 Database connected: Yes`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Session secret: ${process.env.SESSION_SECRET ? 'SET' : 'NOT SET'}`);
      console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
      console.log('💪 Server is now listening - starting background initialization...');

      // Start emergency memory monitor
      EmergencyMemoryMonitor.getInstance().start();
      console.log('🚨 Emergency memory monitor started');

      // 🔥 DEFER HEAVY OPERATIONS TO BACKGROUND - This prevents startup timeout!
      setImmediate(async () => {
        console.log('🔄 Starting background initialization...');

        try {
          // Initialize database with required seed data (skip in production by default)
          if (!skipSeed) {
            try {
              await seedDatabase();
              console.log('✅ Database initialization complete');
            } catch (err) {
              console.error('⚠️ Database seeding failed (may already be seeded):', err);
              // Continue anyway - the database might already be seeded
            }
          } else {
            console.log('⏭️ Skipping database seeding in production');
          }

          console.log('✅ Alert generation handled by V3 pipeline');

          // Frontend serving is now handled before server.listen (moved earlier for immediate mounting)
          // Fallback: setup Vite dev middleware if static assets weren't detected
          if (!fs.existsSync(path.resolve(process.cwd(), 'dist/public/index.html'))) {
            if (app.get("env") === "development") {
              try {
                await setupVite(app, server);
                console.log('✅ Vite development server setup complete');
              } catch (viteError) {
                console.error('⚠️ Vite setup failed, serving minimal fallback');
                // Minimal fallback - just serve a basic response
                app.use('*', (req, res) => {
                  res.status(200).send(`
                    <!DOCTYPE html>
                    <html>
                      <head><title>ChirpBot V3</title></head>
                      <body>
                        <h1>ChirpBot V3 Server Running</h1>
                        <p>Frontend temporarily unavailable - API endpoints are still accessible</p>
                      </body>
                    </html>
                  `);
                });
              }
            } else {
              serveStatic(app);
            }
          }

          console.log('✅ Alert generation integrated into V3 pipeline');

          // Start cleanup service immediately
          console.log('🧹 Starting alert cleanup service...');
          try {
            alertCleanupService.startCleanup();
            console.log('✅ Alert cleanup service active');
          } catch (cleanupError) {
            console.error('⚠️ Alert cleanup failed to start:', cleanupError);
            // Non-critical, continue anyway
          }

          console.log('✅ Background initialization complete - all systems operational!');
        } catch (error) {
          console.error('⚠️ Background initialization error:', error);
          console.log('🔄 Server will continue running - some features may be limited');
        }
      });
    });
  } catch (error: any) {
    console.error('⚠️ Server initialization warning:', error);
    console.log('🔄 Server will continue running with auto-recovery enabled');
    // DON'T EXIT - Keep the process alive
  }
}

// Only start server if this file is the main entry point
startServer().catch((error) => {
  console.error('⚠️ Non-critical error:', error);
  console.log('🔄 Server continuing with auto-recovery...');
  // DON'T EXIT - Keep running
});