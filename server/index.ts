import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-database";
import { health } from "./http/health";
import { alertsApi } from "./api/alerts";
import { initializeScheduler } from "./scheduler";
import { gameMonitor } from "./engines/game-monitor";

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

const PgSession = connectPgSimple(session);

// Session configuration with PostgreSQL backing
app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'chirpbot-v2-secret-key-change-in-production',
  name: 'connect.sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Health and readiness endpoints
app.use(health);

// Alert API endpoints
app.use('/api/alerts', alertsApi);

// Apply global error handler for async errors
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Initialize components
async function initializeServer() {
  try {
    // Seed database
    console.log('🌱 Starting database seeding...');
    await seedDatabase();
    console.log('✅ Database seeding completed successfully!');
    
    // Initialize scheduler for background tasks
    initializeScheduler();
    
    // Initialize game monitoring system
    setTimeout(async () => {
      await gameMonitor.startMonitoring();
    }, 5000); // Start monitoring after 5 seconds to allow server to fully start
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Register API routes and start server
(async () => {
  await initializeServer();
  
  const server = await registerRoutes(app);
  
  // Setup Vite for development or static file serving for production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start server
  const PORT = parseInt(process.env.PORT || "5000");
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();