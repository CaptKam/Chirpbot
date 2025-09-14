#!/usr/bin/env node

/**
 * DEPRECATED: Database and Environment Diagnostics Tool
 * 
 * This file is now a backward-compatible wrapper around the unified diagnostics system.
 * For new development, use: server/unified-diagnostics.ts
 * 
 * Original functionality preserved for backward compatibility.
 */

import { runBasicDiagnostics, toConsole } from './unified-diagnostics.js';

async function runDiagnostics() {
  try {
    console.log('⚠️  DEPRECATION NOTICE: This tool has been superseded by unified-diagnostics.ts');
    console.log('📝 For new features and better TypeScript support, use: node server/unified-diagnostics.ts');
    console.log('');

    // Use the unified diagnostics system
    const result = await runBasicDiagnostics();
    
    // Display output in the original format with enhanced connection analysis
    console.log(toConsole(result, { 
      verboseOutput: true, 
      showRecommendations: true, 
      showTimestamp: false 
    }));

    // Additional connection string analysis (original functionality)
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

    // Summary and Recommendations (preserved original format)
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log('=' .repeat(50));
    
    const likelyEnvironment = result.analysis?.likelyEnvironment || 'UNKNOWN';
    
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
    console.log('\n💡 TIP: Use "node server/unified-diagnostics.ts --mode=all --verbose" for advanced diagnostics');

  } catch (error) {
    console.error('❌ Diagnostics failed:', error.message);
    console.error('🔧 Try using the unified diagnostics tool: node server/unified-diagnostics.ts');
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);