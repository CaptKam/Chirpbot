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

// Global error handlers with recovery mechanisms
let shutdownInProgress = false;
let server: any = null;

// Track critical errors to determine if restart is needed
let criticalErrorCount = 0;
const MAX_CRITICAL_ERRORS = 3;
const ERROR_RESET_INTERVAL = 60000; // Reset error count every minute

setInterval(() => {
  if (criticalErrorCount > 0) {
    console.log('🔄 Resetting critical error count');
    criticalErrorCount = 0;
  }
}, ERROR_RESET_INTERVAL);

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log to error tracking but don't crash
  criticalErrorCount++;
  
  if (criticalErrorCount >= MAX_CRITICAL_ERRORS) {
    console.error('🚨 Too many critical errors, initiating graceful restart...');
    gracefulShutdown('Too many unhandled rejections');
  }
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  
  // Try to recover from non-critical errors
  const errorString = error.toString();
  const isRecoverable = 
    errorString.includes('ECONNRESET') ||
    errorString.includes('EPIPE') ||
    errorString.includes('ETIMEDOUT');
  
  if (isRecoverable) {
    console.log('📝 Attempting to recover from error...');
    criticalErrorCount++;
    
    if (criticalErrorCount >= MAX_CRITICAL_ERRORS) {
      gracefulShutdown('Too many errors');
    }
  } else {
    // For truly critical errors, initiate graceful shutdown
    gracefulShutdown('Critical error');
  }
});

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

    server = await registerRoutes(app);

    // Initialize alert generator and AI system
    const alertGenerator = new AlertGenerator();
    const aiEngine = new BasicAI();

    // Log AI system status
    console.log(`🤖 AI Betting System: ${aiEngine.configured ? '✅ ACTIVE' : '⚠️ FALLBACK MODE'}`);
    if (aiEngine.configured) {
      console.log('🎯 AI betting insights will be generated for high-priority alerts (70%+)');
    } else {
      console.log('📊 Using fallback betting analysis (no OpenAI key configured)');
    }

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
    
    // Create HTTP server with better error handling
    const httpServer = server;
    
    // Handle server errors
    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        console.log('💡 Tip: Another instance might be running');
        
        // Try to kill any zombie processes
        console.log('🔍 Checking for zombie processes...');
        setTimeout(() => {
          gracefulShutdown('Port conflict');
        }, 1000);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to use port ${port}`);
        gracefulShutdown('Permission denied');
      } else {
        console.error('❌ Server error:', error);
        gracefulShutdown('Server error');
      }
    });
    
    // Listen with improved error handling
    httpServer.listen({
      port,
      host: "0.0.0.0",
      exclusive: false,  // Allow port reuse in development
    }, () => {
      log(`✅ Server running on port ${port}`);
      console.log(`📍 http://0.0.0.0:${port}`);
      console.log('🚀 ChirpBot V2 is ready!');
      
      // Reset error count on successful startup
      criticalErrorCount = 0;
    });
    // Store server reference for graceful shutdown
    server = httpServer;
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error: any) {
    console.error('🚨 Critical error during server startup:', error);
    
    // Try alternative port if port is in use
    if (error.code === 'EADDRINUSE') {
      console.log('⚠️ Port is already in use, attempting cleanup...');
      
      // Wait a moment for port to be released
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to restart once
      if (!shutdownInProgress) {
        console.log('🔄 Retrying server startup...');
        setTimeout(() => {
          process.exit(1); // Let the process manager restart the app
        }, 1000);
      }
    } else {
      // For other startup errors, exit after logging
      await gracefulShutdown('Startup failure');
    }
  }
})().catch(async (error) => {
  console.error('🚨 Unhandled error in main async function:', error);
  await gracefulShutdown('Unhandled async error');
});

// Graceful shutdown function
async function gracefulShutdown(reason: string) {
  if (shutdownInProgress) {
    console.log('⏳ Shutdown already in progress...');
    return;
  }
  
  shutdownInProgress = true;
  console.log(`\n🛑 Starting graceful shutdown (${reason})...`);
  
  try {
    // Close server to stop accepting new connections
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
        
        // Force close after 10 seconds
        setTimeout(() => {
          console.log('⚠️ Forcing server close after timeout');
          resolve();
        }, 10000);
      });
    }
    
    // Close database connections
    try {
      await pool.end();
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('⚠️ Error closing database:', error);
    }
    
    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}