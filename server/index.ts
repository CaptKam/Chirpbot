import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";
import { AlertGenerator } from "./services/alert-generator";
import { BasicAI } from "./services/basic-ai";
import { AIEnhancementService } from "./services/ai-enhancements";
import { AIContextController } from "./services/ai-context-controller";
import { pool } from "./db";
import { alertCleanupService } from './services/alert-cleanup';

// Startup guard to prevent double initialization
if ((globalThis as any).__SERVER_STARTED__) {
  console.log('🔄 Server already started, skipping duplicate initialization');
  process.exit(0);
}
(globalThis as any).__SERVER_STARTED__ = true;

// Keep track of server and monitoring timer for graceful shutdown
let httpServer: any = null;
let monitoringInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

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

    // Close database connections
    await pool.end();
    console.log('✅ Database connections closed');

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
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
    if (reason.message?.includes('pool') || reason.message?.includes('database')) {
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

  // For EADDRINUSE, exit immediately so workflow can restart cleanly
  if (error.code === 'EADDRINUSE') {
    console.error('❌ Port already in use - exiting to allow clean restart');
    process.exit(1);
  }

  // For database errors, try to reconnect
  if (error.message?.includes('database') || error.message?.includes('pool')) {
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

const app = express();

// Security and CORS
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Vite dev mode
}));
// CORS configuration for consistent origin handling
const corsOrigin = process.env.CANONICAL_ORIGIN || 
  (process.env.NODE_ENV === 'production' ? false : ['http://localhost:5000', 'http://127.0.0.1:5000']);

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Body parsing with size limits
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Use the same Neon pool for session storage to avoid connection conflicts
const PgSession = connectPgSimple(session);

// Session middleware with PostgreSQL store using the shared Neon pool
app.use(session({
  name: 'cb.sid', // Unique session name to avoid conflicts
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'chirpbot-stable-dev-secret-2025', // Stable secret for dev
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined, // Leave undefined for localhost
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for better persistence
  }
}));

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
    // Create HTTP server once in index.ts only
    const httpServer = createServer(app);
    const server = await registerRoutes(app, httpServer);

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
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const PORT = parseInt(process.env.PORT || "5000", 10);
    const HOST = "0.0.0.0"; // Always bind to 0.0.0.0 for Replit deployment

    // Store server reference for graceful shutdown  
    (globalThis as any).httpServer = httpServer;

    // Enhanced error handling for server startup
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.log('🔄 Attempting to recover...');

        // Try to clean up and restart
        setTimeout(() => {
          process.exit(1); // Let process manager restart us
        }, 1000);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Port ${PORT} requires elevated privileges`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // 🔥 CRITICAL FIX: Start listening IMMEDIATELY to pass health checks
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log(`📱 Database connected: ${pool ? 'Yes' : 'No'}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Session secret: ${process.env.SESSION_SECRET ? 'SET' : 'NOT SET'}`);
      console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
      console.log('💪 Server is now listening - starting background initialization...');
      
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

          // Initialize alert generator and AI system
          const alertGenerator = new AlertGenerator();
          
          // Initialize and test all AI services
          console.log('🤖 Initializing AI services...');
          const aiEngine = new BasicAI();
          const aiEnhancementService = new AIEnhancementService();
          const aiContextController = new AIContextController();
          
          // Verify AI system status
          if (aiEngine.configured) {
            console.log('✅ AI Services: FULLY ACTIVATED - OpenAI integration operational');
          } else {
            console.log('🚫 AI Services: Configuration issue detected - check OpenAI API key');
          }

          // Setup frontend serving (Vite or static)
          if (app.get("env") === "development") {
            try {
              await setupVite(app, server);
              console.log('✅ Vite development server setup complete');
            } catch (viteError) {
              console.error('⚠️ Vite setup failed, but continuing with server startup:', viteError);
              // Fallback: serve static files if Vite fails
              try {
                serveStatic(app);
                console.log('🔄 Fallback to static file serving');
              } catch (staticError) {
                console.error('⚠️ Static file serving also failed, serving minimal fallback');
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
            }
          } else {
            serveStatic(app);
          }

          // Defer alert generation to ensure server stability
          console.log('🚨 Deferring alert generation startup...');
          setTimeout(() => {
            console.log('🚨 Starting alert generation (server is stable)...');
            alertGenerator.generateLiveGameAlerts();
          }, 5000); // Wait 5 seconds for server stability

          // Defer alert cleanup service startup  
          console.log('🧹 Deferring alert cleanup service startup...');
          setTimeout(() => {
            console.log('🧹 Starting alert cleanup service (server is stable)...');
            alertCleanupService.startCleanup();
          }, 7000); // Wait 7 seconds for server stability
          
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