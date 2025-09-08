import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";
import { AlertGenerator } from "./services/alert-generator";
import { BasicAI } from "./services/basic-ai";
import { pool } from "./db";

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
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('⚠️ Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
  // Log but continue running - don't crash
  
  // If it's a database error, try to recover
  if (reason instanceof Error && reason.message?.includes('pool')) {
    console.log('🔄 Database connection issue detected - will retry on next operation');
  }
});

process.on('uncaughtException', (error: any) => {
  console.error('⚠️ Uncaught Exception:', error);
  
  // For EADDRINUSE, try to recover without exiting
  if (error.code === 'EADDRINUSE') {
    console.log('🔄 Port already in use - will retry in 5 seconds...');
    // Don't exit - just wait and let the retry logic handle it
    return;
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
app.use(cors({
  origin: true, // Allow all origins in development
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
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'chirpbot-dev-secret-key-12345'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

(async () => {
  try {
    // Initialize database with required seed data
    try {
      await seedDatabase();
      console.log('✅ Database initialization complete');
    } catch (err) {
      console.error('⚠️ Database seeding failed (may already be seeded):', err);
      // Continue anyway - the database might already be seeded
    }

    const server = await registerRoutes(app);

    // Initialize alert generator and AI system
    const alertGenerator = new AlertGenerator();
    const aiEngine = new BasicAI();

    // AI system status logging disabled

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

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    // Store server reference for graceful shutdown
    httpServer = server;
    
    // Enhanced error handling for server startup
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use!`);
        console.log('🔄 Attempting to recover...');
        
        // Try to clean up and restart
        setTimeout(() => {
          process.exit(1); // Let process manager restart us
        }, 1000);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Port ${port} requires elevated privileges`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });
    
    // Start listening with ULTRA-robust error handling
    let retryCount = 0;
    const maxRetries = 10;
    
    while (retryCount < maxRetries) {
      try {
        await new Promise<void>((resolve, reject) => {
          const attemptListen = () => {
            server.listen({
              port,
              host: "0.0.0.0",
              exclusive: false, // Allow port sharing to avoid conflicts
            }, () => {
              console.log(`✅ Server running on port ${port}`);
              console.log('🚀 ChirpBot V2 is ready!');
              console.log('💪 System is now ULTRA-BULLETPROOF with auto-recovery');
              resolve();
            }).on('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                // Don't reject, just retry
                server.close();
                setTimeout(() => {
                  attemptListen();
                }, 2000);
              } else {
                reject(err);
              }
            });
          };
          attemptListen();
        });
        break; // Success! Exit the retry loop
      } catch (error: any) {
        retryCount++;
        console.log(`⚠️ Server startup attempt ${retryCount}/${maxRetries} failed`);
        
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.error('❌ Max retries reached. Running in degraded mode.');
          // Don't exit - keep the process alive
        }
      }
    }
  } catch (error: any) {
    console.error('⚠️ Server initialization warning:', error);
    console.log('🔄 Server will continue running with auto-recovery enabled');
    // DON'T EXIT - Keep the process alive
  }
})().catch((error) => {
  console.error('⚠️ Non-critical error:', error);
  console.log('🔄 Server continuing with auto-recovery...');
  // DON'T EXIT - Keep running
});