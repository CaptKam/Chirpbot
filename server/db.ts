import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool with optimizations for stability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 second connection timeout
});

export const db = drizzle({ client: pool, schema });

// Connection health monitoring
let connectionErrors = 0;
let lastConnectionTest = 0;
const CONNECTION_TEST_INTERVAL = 30000; // Test every 30 seconds

// Database health check function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const now = Date.now();
    if (now - lastConnectionTest < CONNECTION_TEST_INTERVAL) {
      return connectionErrors === 0;
    }
    
    lastConnectionTest = now;
    const result = await pool.query('SELECT 1 as test');
    connectionErrors = 0;
    return true;
  } catch (error) {
    connectionErrors++;
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

// Automatic connection recovery
export async function ensureDatabaseConnection(): Promise<void> {
  const isHealthy = await testDatabaseConnection();
  
  if (!isHealthy && connectionErrors > 3) {
    console.log('🔄 Attempting database connection recovery...');
    try {
      // Force a new connection test
      await pool.query('SELECT current_timestamp');
      connectionErrors = 0;
      console.log('✅ Database connection recovered');
    } catch (error) {
      console.error('💥 Database recovery failed:', error);
    }
  }
}

// Start periodic health monitoring
setInterval(async () => {
  try {
    await ensureDatabaseConnection();
  } catch (error) {
    console.error('Database monitoring error:', error);
  }
}, CONNECTION_TEST_INTERVAL);