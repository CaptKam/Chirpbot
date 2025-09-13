
#!/usr/bin/env node

/**
 * Alert System Debug Check - Comprehensive Diagnostic Tool
 * Checks all critical components of the alert system
 */

import { storage } from './server/storage.js';
import { AlertGenerator } from './server/services/alert-generator.js';
import { getHealthMonitor } from './server/services/alert-health-monitor.js';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

console.log('🔍 ALERT SYSTEM DEBUG CHECK');
console.log('=' .repeat(60));
console.log('Starting comprehensive diagnostic...\n');

async function runAlertSystemDebugCheck() {
  const results = {
    masterControl: null,
    globalSettings: {},
    userPreferences: {},
    activeMonitoring: {},
    recentAlerts: null,
    healthStatus: null,
    apiConnectivity: {},
    databaseStatus: null,
    webSocketStatus: null,
    issues: [],
    recommendations: []
  };

  try {
    // 1. MASTER CONTROL CHECK
    console.log('🎛️ PHASE 1: Master Control Check');
    console.log('-' .repeat(40));
    
    try {
      const masterEnabled = await storage.isMasterAlertsEnabled();
      results.masterControl = masterEnabled;
      console.log(`   Master Alerts Enabled: ${masterEnabled ? '✅ YES' : '❌ NO'}`);
      
      if (!masterEnabled) {
        results.issues.push('CRITICAL: Master alerts are disabled');
        results.recommendations.push('Enable master alerts in admin panel');
      }
    } catch (error) {
      results.issues.push(`Master control check failed: ${error.message}`);
      console.log(`   ❌ Error checking master control: ${error.message}`);
    }

    // 2. GLOBAL SETTINGS CHECK
    console.log('\n⚙️ PHASE 2: Global Alert Settings Check');
    console.log('-' .repeat(40));
    
    const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
    for (const sport of sports) {
      try {
        const settings = await storage.getGlobalAlertSettings(sport);
        const enabledCount = Object.values(settings).filter(Boolean).length;
        const totalCount = Object.keys(settings).length;
        
        results.globalSettings[sport] = {
          total: totalCount,
          enabled: enabledCount,
          disabled: totalCount - enabledCount,
          settings: settings
        };
        
        console.log(`   ${sport}: ${enabledCount}/${totalCount} alert types enabled`);
        
        if (enabledCount === 0) {
          results.issues.push(`No ${sport} alert types are globally enabled`);
        }
      } catch (error) {
        results.issues.push(`Failed to check ${sport} global settings: ${error.message}`);
        console.log(`   ❌ ${sport}: Error - ${error.message}`);
      }
    }

    // 3. USER PREFERENCES CHECK
    console.log('\n👤 PHASE 3: User Preferences Check');
    console.log('-' .repeat(40));
    
    try {
      const allUsers = await storage.getAllUsers();
      console.log(`   Total users: ${allUsers.length}`);
      
      for (const user of allUsers) {
        const userStats = { sports: {} };
        
        for (const sport of sports) {
          try {
            const prefs = await storage.getUserAlertPreferencesBySport(user.id, sport);
            const enabledPrefs = prefs.filter(p => p.enabled).length;
            userStats.sports[sport] = {
              total: prefs.length,
              enabled: enabledPrefs
            };
          } catch (error) {
            userStats.sports[sport] = { error: error.message };
          }
        }
        
        results.userPreferences[user.username || user.id] = userStats;
        console.log(`   ${user.username}: ${Object.values(userStats.sports).reduce((sum, s) => sum + (s.enabled || 0), 0)} total enabled`);
      }
    } catch (error) {
      results.issues.push(`User preferences check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 4. ACTIVE MONITORING CHECK
    console.log('\n🎯 PHASE 4: Active Game Monitoring Check');
    console.log('-' .repeat(40));
    
    try {
      const allUsers = await storage.getAllUsers();
      
      for (const user of allUsers) {
        try {
          const monitoredTeams = await storage.getUserMonitoredTeams(user.id);
          const sportCounts = {};
          
          for (const team of monitoredTeams) {
            sportCounts[team.sport] = (sportCounts[team.sport] || 0) + 1;
          }
          
          results.activeMonitoring[user.username || user.id] = {
            totalGames: monitoredTeams.length,
            bySport: sportCounts,
            games: monitoredTeams.map(t => ({ gameId: t.gameId, sport: t.sport }))
          };
          
          console.log(`   ${user.username}: Monitoring ${monitoredTeams.length} games`);
        } catch (error) {
          console.log(`   ${user.username}: Error - ${error.message}`);
        }
      }
    } catch (error) {
      results.issues.push(`Active monitoring check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 5. RECENT ALERTS CHECK
    console.log('\n📋 PHASE 5: Recent Alerts Check');
    console.log('-' .repeat(40));
    
    try {
      const recentAlerts = await storage.getRecentAlerts(20);
      results.recentAlerts = {
        count: recentAlerts.length,
        alerts: recentAlerts.map(alert => ({
          type: JSON.parse(alert.payload).type || alert.type,
          sport: alert.sport,
          gameId: alert.gameId,
          createdAt: alert.createdAt,
          age: Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 60000)
        }))
      };
      
      console.log(`   Recent alerts (last 20): ${recentAlerts.length}`);
      
      if (recentAlerts.length > 0) {
        const latestAlert = recentAlerts[0];
        const ageMinutes = Math.floor((Date.now() - new Date(latestAlert.createdAt).getTime()) / 60000);
        console.log(`   Latest alert: ${ageMinutes} minutes ago`);
        
        // Show recent alert types
        const alertTypes = {};
        recentAlerts.forEach(alert => {
          const payload = JSON.parse(alert.payload);
          const type = payload.type || alert.type;
          alertTypes[type] = (alertTypes[type] || 0) + 1;
        });
        
        console.log('   Alert types breakdown:');
        Object.entries(alertTypes).forEach(([type, count]) => {
          console.log(`     - ${type}: ${count}`);
        });
      } else {
        results.issues.push('No recent alerts found - system may not be generating alerts');
        console.log('   ⚠️ No recent alerts found');
      }
    } catch (error) {
      results.issues.push(`Recent alerts check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 6. HEALTH MONITOR CHECK
    console.log('\n🏥 PHASE 6: Health Monitor Check');
    console.log('-' .repeat(40));
    
    try {
      const healthMonitor = getHealthMonitor();
      const healthStatus = healthMonitor.getHealthStatus();
      results.healthStatus = healthStatus;
      
      console.log(`   Status: ${healthStatus.status.toUpperCase()}`);
      console.log(`   Checks Performed: ${healthStatus.checksPerformed}`);
      console.log(`   Alerts Generated: ${healthStatus.alertsGenerated}`);
      console.log(`   Last Check: ${healthStatus.timeSinceLastCheck}`);
      console.log(`   Last Alert: ${healthStatus.timeSinceLastAlert}`);
      console.log(`   Memory Usage: ${healthStatus.memoryUsageMB}MB`);
      console.log(`   Uptime: ${Math.floor(healthStatus.uptimeSeconds / 60)} minutes`);
      
      if (healthStatus.status !== 'healthy') {
        results.issues.push(`Health monitor status: ${healthStatus.status}`);
        if (healthStatus.recommendations.length > 0) {
          results.recommendations.push(...healthStatus.recommendations);
        }
      }
    } catch (error) {
      results.issues.push(`Health monitor check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 7. DATABASE STATUS CHECK
    console.log('\n💾 PHASE 7: Database Status Check');
    console.log('-' .repeat(40));
    
    try {
      // Test database connection
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const connectionTime = Date.now() - start;
      
      // Check table counts
      const tables = ['alerts', 'users', 'user_alert_preferences', 'user_monitored_teams', 'global_alert_settings'];
      const tableCounts = {};
      
      for (const table of tables) {
        try {
          const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
          tableCounts[table] = parseInt(result.rows[0]?.count || '0');
        } catch (error) {
          tableCounts[table] = `Error: ${error.message}`;
        }
      }
      
      results.databaseStatus = {
        connectionTime: `${connectionTime}ms`,
        tableCounts
      };
      
      console.log(`   Connection time: ${connectionTime}ms`);
      console.log('   Table counts:');
      Object.entries(tableCounts).forEach(([table, count]) => {
        console.log(`     - ${table}: ${count}`);
      });
      
      if (connectionTime > 1000) {
        results.issues.push('Database connection is slow (>1000ms)');
      }
    } catch (error) {
      results.issues.push(`Database check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // 8. API CONNECTIVITY CHECK
    console.log('\n🌐 PHASE 8: API Connectivity Check');
    console.log('-' .repeat(40));
    
    const apiTests = [
      { name: 'MLB', test: async () => {
        const { MLBApiService } = await import('./server/services/mlb-api.js');
        const api = new MLBApiService();
        const games = await api.getTodaysGames();
        return { gamesFound: games.length, status: 'OK' };
      }},
      { name: 'NCAAF', test: async () => {
        const { NCAAFApiService } = await import('./server/services/ncaaf-api.js');
        const api = new NCAAFApiService();
        const games = await api.getTodaysGames();
        return { gamesFound: games.length, status: 'OK' };
      }}
    ];
    
    for (const { name, test } of apiTests) {
      try {
        const result = await Promise.race([
          test(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        results.apiConnectivity[name] = result;
        console.log(`   ${name}: ✅ ${result.gamesFound} games found`);
      } catch (error) {
        results.apiConnectivity[name] = { status: 'ERROR', error: error.message };
        console.log(`   ${name}: ❌ ${error.message}`);
        results.issues.push(`${name} API connectivity issue: ${error.message}`);
      }
    }

    // 9. WEBSOCKET STATUS CHECK
    console.log('\n📡 PHASE 9: WebSocket Status Check');
    console.log('-' .repeat(40));
    
    try {
      // Check if WebSocket broadcast function exists
      const wsBroadcast = (global as any).wsBroadcast;
      results.webSocketStatus = {
        broadcastFunctionExists: typeof wsBroadcast === 'function',
        globalWSExists: !!(global as any).wss
      };
      
      console.log(`   Broadcast function: ${results.webSocketStatus.broadcastFunctionExists ? '✅' : '❌'}`);
      console.log(`   WebSocket server: ${results.webSocketStatus.globalWSExists ? '✅' : '❌'}`);
      
      if (!results.webSocketStatus.broadcastFunctionExists) {
        results.issues.push('WebSocket broadcast function not available');
      }
    } catch (error) {
      results.issues.push(`WebSocket check failed: ${error.message}`);
      console.log(`   ❌ Error: ${error.message}`);
    }

    // SUMMARY
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('=' .repeat(60));
    
    const totalIssues = results.issues.length;
    console.log(`Issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('🎉 ALL SYSTEMS OPERATIONAL - No issues detected!');
    } else {
      console.log('\n⚠️ ISSUES DETECTED:');
      results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      
      if (results.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        results.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }
    }

    // SYSTEM HEALTH SCORE
    const maxScore = 100;
    let score = maxScore;
    
    // Deduct points for issues
    if (!results.masterControl) score -= 30;
    if (Object.values(results.globalSettings).every(s => s.enabled === 0)) score -= 25;
    if (totalIssues > 0) score -= Math.min(20, totalIssues * 5);
    if (results.recentAlerts?.count === 0) score -= 15;
    if (results.healthStatus?.status !== 'healthy') score -= 10;
    
    console.log(`\n🎯 SYSTEM HEALTH SCORE: ${score}/100`);
    
    if (score >= 90) {
      console.log('   Status: EXCELLENT ✅');
    } else if (score >= 70) {
      console.log('   Status: GOOD ⚠️');
    } else if (score >= 50) {
      console.log('   Status: NEEDS ATTENTION ⚠️');
    } else {
      console.log('   Status: CRITICAL ISSUES ❌');
    }

    console.log('\n🔧 QUICK FIXES:');
    if (!results.masterControl) {
      console.log('   Run: node enable-master-alerts.js');
    }
    if (Object.values(results.globalSettings).every(s => s.enabled === 0)) {
      console.log('   Run: node enable-critical-alerts.js');
    }
    if (totalIssues > 5) {
      console.log('   Check server logs for detailed error information');
    }

    console.log('\n✅ Alert system debug check complete!');
    return results;

  } catch (error) {
    console.error('❌ Fatal error during diagnostic:', error);
    return { error: error.message, results };
  }
}

// Run the diagnostic
runAlertSystemDebugCheck().catch(console.error);
