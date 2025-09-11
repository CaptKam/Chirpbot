/**
 * Environment Detection Utility
 * Creates a simple endpoint to detect current environment and database status
 * Can be called from both development and production to compare
 */

import express from 'express';
import { pool } from './db.js';

export async function createEnvironmentDetector() {
  const router = express.Router();

  router.get('/environment-status', async (req, res) => {
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
          error: null,
          userCount: 0,
          tableCount: 0,
          alertPreferences: 0,
          monitoredTeams: 0
        },
        session: {
          authenticated: !!req.session?.userId,
          sessionId: req.sessionID ? 'present' : 'missing',
          user: req.session?.user || null
        }
      };

      // Test database connection and get counts
      try {
        const client = await pool.connect();
        diagnostics.database.connected = true;

        // Get user count
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        diagnostics.database.userCount = parseInt(userCount.rows[0].count);

        // Get table count
        const tableCount = await client.query(
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        );
        diagnostics.database.tableCount = parseInt(tableCount.rows[0].count);

        // Get alert preferences
        const alertPrefs = await client.query('SELECT COUNT(*) FROM user_alert_preferences');
        diagnostics.database.alertPreferences = parseInt(alertPrefs.rows[0].count);

        // Get monitored teams
        const monitoredTeams = await client.query('SELECT COUNT(*) FROM user_monitored_teams');
        diagnostics.database.monitoredTeams = parseInt(monitoredTeams.rows[0].count);

        // Get database info
        const dbInfo = await client.query('SELECT current_database(), version()');
        diagnostics.database.name = dbInfo.rows[0].current_database;
        diagnostics.database.version = dbInfo.rows[0].version.split(' ')[0] + ' ' + dbInfo.rows[0].version.split(' ')[1];

        client.release();
      } catch (error) {
        diagnostics.database.error = error.message;
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
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

// Standalone function for server-side diagnostics
export async function logEnvironmentStatus() {
  console.log('\n🔍 ENVIRONMENT DIAGNOSTICS');
  console.log('=' .repeat(50));
  
  console.log('📊 Environment Variables:');
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`  REPL_ID: ${process.env.REPL_ID ? 'set' : 'not set'}`);
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
  console.log(`  SESSION_SECRET: ${process.env.SESSION_SECRET ? 'set' : 'not set'}`);
  
  try {
    const client = await pool.connect();
    console.log('✅ Database connection: SUCCESS');
    
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👤 Users in database: ${userCount.rows[0].count}`);
    
    const prefCount = await client.query('SELECT COUNT(*) FROM user_alert_preferences');
    console.log(`⚙️ Alert preferences: ${prefCount.rows[0].count}`);
    
    client.release();
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('=' .repeat(50));
}