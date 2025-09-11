#!/usr/bin/env node

/**
 * Database and Environment Diagnostics Tool
 * Helps identify if we're in development or production mode
 * and checks database connectivity and content
 */

import { pool } from './db.ts';

async function runDiagnostics() {
  console.log('🔍 Database and Environment Diagnostics');
  console.log('=' .repeat(50));

  // Environment Detection
  console.log('\n📊 ENVIRONMENT STATUS:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}`);
  console.log(`REPL_ID: ${process.env.REPL_ID ? 'set' : 'not set'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);
  console.log(`Port: ${process.env.PORT || '5000'}`);
  
  // Determine likely environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isReplit = !!process.env.REPL_ID;
  const likelyEnvironment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';
  
  console.log(`\n🎯 LIKELY ENVIRONMENT: ${likelyEnvironment}`);
  console.log(`🏢 Platform: ${isReplit ? 'Replit' : 'Unknown'}`);

  // Database Connection Test
  console.log('\n🔌 DATABASE CONNECTION TEST:');
  
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Get database name and version
    const dbInfo = await client.query('SELECT current_database(), version()');
    console.log(`📊 Database: ${dbInfo.rows[0].current_database}`);
    console.log(`🔧 Version: ${dbInfo.rows[0].version.split(' ')[0]} ${dbInfo.rows[0].version.split(' ')[1]}`);
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }

  // Check Tables and Data
  console.log('\n📋 DATABASE CONTENT ANALYSIS:');
  
  try {
    const client = await pool.connect();
    
    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tables = await client.query(tablesQuery);
    console.log(`📊 Tables found: ${tables.rows.length}`);
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      try {
        const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`  📄 ${tableName}: ${count.rows[0].count} records`);
      } catch (err) {
        console.log(`  📄 ${tableName}: Error counting (${err.message})`);
      }
    }

    // Check users specifically
    console.log('\n👤 USER ANALYSIS:');
    try {
      const users = await client.query('SELECT id, username, email, role, "authMethod", "createdAt" FROM users ORDER BY "createdAt"');
      console.log(`Total users: ${users.rows.length}`);
      
      if (users.rows.length > 0) {
        console.log('User details:');
        users.rows.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.username || user.email || user.id} (${user.role}) - ${user.authMethod} - Created: ${user.createdAt}`);
        });
      } else {
        console.log('⚠️  NO USERS FOUND - This suggests empty production database');
      }
    } catch (err) {
      console.log(`❌ Error querying users: ${err.message}`);
    }

    // Check user alert preferences
    console.log('\n⚙️ USER ALERT PREFERENCES:');
    try {
      const preferences = await client.query('SELECT COUNT(*) as total, COUNT(DISTINCT "userId") as unique_users FROM user_alert_preferences');
      console.log(`Alert preferences: ${preferences.rows[0].total} total for ${preferences.rows[0].unique_users} users`);
    } catch (err) {
      console.log(`❌ Error querying preferences: ${err.message}`);
    }

    // Check monitored teams
    console.log('\n🎯 MONITORED TEAMS:');
    try {
      const monitored = await client.query('SELECT COUNT(*) as total, COUNT(DISTINCT "userId") as unique_users FROM user_monitored_teams');
      console.log(`Monitored teams: ${monitored.rows[0].total} total for ${monitored.rows[0].unique_users} users`);
    } catch (err) {
      console.log(`❌ Error querying monitored teams: ${err.message}`);
    }

    client.release();
  } catch (error) {
    console.error('❌ Database analysis failed:', error.message);
  }

  // Connection string analysis (safely)
  console.log('\n🔗 DATABASE CONNECTION ANALYSIS:');
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      console.log(`Host: ${url.hostname}`);
      console.log(`Database: ${url.pathname.substring(1)}`);
      console.log(`User: ${url.username}`);
      console.log(`SSL: ${url.searchParams.get('sslmode') || 'not specified'}`);
      
      // Check if it looks like a Neon database
      if (url.hostname.includes('neon') || url.hostname.includes('pooler')) {
        console.log('🔧 Database type: Neon PostgreSQL');
        
        // Try to determine environment from hostname patterns
        if (url.hostname.includes('prod') || url.hostname.includes('production')) {
          console.log('🎯 Connection appears to be: PRODUCTION');
        } else if (url.hostname.includes('dev') || url.hostname.includes('development')) {
          console.log('🎯 Connection appears to be: DEVELOPMENT');
        } else {
          console.log('🎯 Connection environment: UNCLEAR from hostname');
        }
      }
    } catch (err) {
      console.log('❌ Could not parse DATABASE_URL');
    }
  }

  // Summary and Recommendations
  console.log('\n📋 DIAGNOSIS SUMMARY:');
  console.log('=' .repeat(50));
  
  if (likelyEnvironment === 'DEVELOPMENT') {
    console.log('✅ Environment appears to be DEVELOPMENT');
    console.log('📝 User settings should work normally here');
  } else {
    console.log('⚠️  Environment appears to be PRODUCTION');
    console.log('📝 This may explain why user settings are not visible');
  }
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('1. Check if users exist in the current database');
  console.log('2. If no users, this confirms separate dev/prod databases');
  console.log('3. Consider data migration or sync strategy');
  console.log('4. Verify DATABASE_URL environment variable in production');
  console.log('5. Check Replit database deployment configuration');
  
  console.log('\n🔧 Next steps: Run this on both dev and production to compare');
}

// Run diagnostics
runDiagnostics().catch(console.error);