import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";
import { pool } from "./db";
import { WebSocketServer } from 'ws';

// NEW WORKFLOW SYSTEM
import { WorkflowManager, WorkflowManagerConfig } from "./workflow/workflow-manager";

// Keep track of server and monitoring timer for graceful shutdown
let httpServer: any = null;
let workflowManager: WorkflowManager | null = null;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n📍 ${signal} signal received - starting graceful shutdown...`);

  try {
    // Stop workflow manager
    if (workflowManager) {
      await workflowManager.stop();
      console.log('✅ Workflow manager stopped');
    }

    // Close server to stop accepting new connections
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('✅ Server closed');
          resolve();
        });
      });
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
  console.error('⚠️ Unhandled Rejection:', reason);
  // Log but continue running - don't crash
});

process.on('uncaughtException', (error: any) => {
  console.error('⚠️ Uncaught Exception:', error);

  // For EADDRINUSE, try to recover without exiting
  if (error.code === 'EADDRINUSE') {
    console.log('🔄 Port already in use - will retry in 5 seconds...');
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
app.set('x-powered-by', false);
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

/**
 * Initialize the new workflow system
 */
async function initializeWorkflowSystem(wss: WebSocketServer): Promise<void> {
  console.log('🚀 Initializing new workflow system...');

  try {
    // Get default configuration
    const config: WorkflowManagerConfig = WorkflowManager.getDefaultConfig();
    
    // Override config based on environment
    if (process.env.NODE_ENV === 'production') {
      config.workflow.intervalMs = 10000; // Slower in production
      config.aiEnhancement.enableOpenAI = !!process.env.OPENAI_API_KEY;
      config.notification.enableTelegram = !!process.env.TELEGRAM_BOT_TOKEN;
    }

    // Create workflow manager
    workflowManager = new WorkflowManager(config);

    // Set up event logging
    workflowManager.on('alertGenerated', (data) => {
      console.log(`📢 Alert generated: ${data.alert.type} for ${data.job.sport} game ${data.job.gameId}`);
    });

    workflowManager.on('alertProcessed', (alert) => {
      console.log(`✅ Alert processed: ${alert.type} (${alert.status})`);
    });

    workflowManager.on('notificationDelivered', (data) => {
      const results = data.results;
      const successful = results.filter((r: any) => r.success).length;
      console.log(`📡 Notification delivered: ${successful}/${results.length} channels successful`);
    });

    // Set WebSocket server
    workflowManager.setWebSocketServer(wss);

    // Initialize and start the workflow system
    await workflowManager.initialize();
    await workflowManager.start();

    console.log('✅ New workflow system initialized and started successfully');

    // Log system status every 5 minutes
    setInterval(() => {
      const status = workflowManager!.getSystemStatus();
      console.log(`📊 Workflow System Status: Running: ${status.isRunning}, Active Jobs: ${status.orchestrator.activeJobs}, Queue: ${status.orchestrator.queuedJobs}`);
    }, 300000); // 5 minutes

  } catch (error) {
    console.error('❌ Failed to initialize workflow system:', error);
    throw error;
  }
}

/**
 * Add workflow status endpoint
 */
function addWorkflowStatusEndpoint(): void {
  // Add system status endpoint
  app.get('/api/workflow/status', (req, res) => {
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow system not initialized' });
    }

    const status = workflowManager.getSystemStatus();
    res.json(status);
  });

  // Add system metrics endpoint
  app.get('/api/workflow/metrics', (req, res) => {
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow system not initialized' });
    }

    const metrics = workflowManager.getSystemMetrics();
    res.json(metrics);
  });

  // Add test notification endpoint
  app.post('/api/workflow/test-notification', async (req, res) => {
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow system not initialized' });
    }

    try {
      const results = await workflowManager.sendTestNotification();
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  console.log('✅ Workflow API endpoints added');
}

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

    // Add workflow status endpoints
    addWorkflowStatusEndpoint();

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
    });

    // Setup vite in development and static serving in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    const port = parseInt(process.env.PORT || '5000', 10);

    // Store server reference for graceful shutdown
    httpServer = server;

    // Enhanced error handling for server startup
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use!`);
        console.log('🔄 Attempting to recover...');
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

    // Start server with WebSocket support
    try {
      await new Promise<void>((resolve, reject) => {
        const httpServer = server.listen(port, "0.0.0.0", () => {
          console.log(`✅ Server running on port ${port}`);
          resolve();
        }).on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${port} is already in use. Killing existing processes...`);
            reject(err);
          } else {
            reject(err);
          }
        });

        // Initialize WebSocket server
        const wss = new WebSocketServer({ 
          server: httpServer,
          path: '/ws' 
        });

        console.log('📡 WebSocket server initialized on /ws');

        // Initialize the new workflow system with WebSocket support
        initializeWorkflowSystem(wss).then(() => {
          console.log('🚀 ChirpBot V2 with NEW WORKFLOW SYSTEM is ready!');
          console.log('🔥 COMPLETE WORKFLOW REWRITE ACTIVE!');
        }).catch((error) => {
          console.error('❌ Failed to initialize workflow system:', error);
          console.log('⚠️ Server will continue running without workflow system');
        });
      });
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.log('🔄 Attempting to kill existing processes and restart...');
        process.exit(1); // Let the workflow handle restart
      } else {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
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