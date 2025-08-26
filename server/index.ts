import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const { Pool } = pg;

const app = express();

// Security and CORS
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Vite dev mode
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// PostgreSQL session store for persistent sessions
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Acquire a DB advisory lock so only one monitor engine runs
async function acquireEngineLock(): Promise<boolean> {
  const client = await pgPool.connect();
  try {
    // Choose app-unique key; stable across deploys
    const res = await client.query("SELECT pg_try_advisory_lock($1)", [842_240_001]);
    return res.rows?.[0]?.pg_try_advisory_lock === true;
  } finally { 
    client.release(); 
  }
}

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Express error handler:', err);
    res.status(status).json({ message });
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
  const PORT = parseInt(process.env.PORT || '5000', 10);
  
  // Graceful error handling for port conflicts
  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(JSON.stringify({ t:"FATAL", msg:"Port in use", port: PORT }));
      process.exit(1); // fail fast so supervisor restarts cleanly
    } else {
      console.error(JSON.stringify({ t:"FATAL", msg:String(err) }));
    }
  });

  // Acquire engine lock before starting
  const haveLock = await acquireEngineLock();
  if (!haveLock) {
    console.error(JSON.stringify({ t:"FATAL", msg:"Engine lock not acquired; another instance is running"}));
    // Still serve HTTP so health checks don't flap, but skip engine start:
    server.listen({
      port: PORT,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(JSON.stringify({ t:"HTTP_READY", port: PORT, engine: false }));
    });
    return;
  }
  
  server.listen({
    port: PORT,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(JSON.stringify({ t:"HTTP_READY", port: PORT, engine: true }));
    log(`serving on port ${PORT}`);
  });
})();

// Graceful shutdown
["SIGINT","SIGTERM"].forEach(sig => process.on(sig as NodeJS.Signals, () => {
  console.log(JSON.stringify({ t:"SHUTDOWN", sig }));
  process.exit(0);
}));
