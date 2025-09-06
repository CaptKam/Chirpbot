import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";

const { Pool } = pg;

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

// PostgreSQL session store for persistent sessions
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PgSession = connectPgSimple(session);

// Session middleware with PostgreSQL store
app.use(session({
  store: new PgSession({
    pool: pgPool,
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
  // Initialize database with required seed data
  try {
    await seedDatabase();
    console.log('✅ Database initialization complete');
  } catch (err) {
    console.error('⚠️ Database seeding failed (may already be seeded):', err);
    // Continue anyway - the database might already be seeded
  }

  const server = await registerRoutes(app);

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

// This is a placeholder for the WebSocket server setup.
// In a real application, you would initialize your WebSocket server here.
// For example:
// import WebSocket from 'ws';
// const wss = new WebSocket.Server({ server });
//
// Replace the following placeholder with your actual WebSocket server initialization and alert callback handling.
// For the purpose of this example, we'll assume 'wss' and 'alertEngineManager' are defined elsewhere and accessible.

// Example placeholder for WebSocket server and alert manager
const wss: any = { clients: new Set() }; // Mock WebSocket server
const alertEngineManager: any = {
  setAlertCallback: (callback: (alert: any) => void) => {
    // Simulate an alert being generated
    // setTimeout(() => {
    //   callback({ id: 'a1b2c3d4', type: 'System', message: 'CPU Usage High', data: { cpu: 95 } });
    // }, 5000);
    // setTimeout(() => {
    //   callback({ id: 'e5f6g7h8', type: 'Network', message: 'High Latency', data: { latency: 200 } });
    // }, 10000);
  }
};

// Applying the requested changes to the alert callback
alertEngineManager.setAlertCallback((alert: any) => {
    const alertId = alert.id || alert.data?.id || 'unknown';
    const debugId = alert.debugId || alert.data?.debugId || alertId.substring(0, 8);
    console.log(`📡 WEBSOCKET: Broadcasting alert | ID: ${alertId} | Debug ID: ${debugId} | Type: ${alert.type || alert.data?.type}`);

    // Broadcast to all connected clients
    wss.clients.forEach((client: any) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'new_alert',
          data: alert
        }));
      }
    });

    console.log(`📡 WEBSOCKET: Alert broadcasted to ${wss.clients.size} clients`);
  });