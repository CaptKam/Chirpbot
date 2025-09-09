
import { storage } from './storage.ts';

async function debugAlertSystem() {
  try {
    console.log('🔍 CHIRPBOT V2 ALERT SYSTEM DEBUG');
    console.log('=====================================\n');

    // 1. Database Connection Test
    console.log('📊 DATABASE CONNECTION:');
    try {
      const testQuery = await storage.db.execute(`SELECT 1 as test`);
      console.log('✅ Database connection: OK');
    } catch (error) {
      console.log('❌ Database connection: FAILED');
      console.error(error);
      return;
    }

    // 2. Global Alert Settings Check
    console.log('\n⚙️ GLOBAL ALERT SETTINGS:');
    const globalSettings = await storage.getGlobalAlertSettings('MLB');
    console.log('Global settings for MLB:', globalSettings);
    
    const disabledAlerts = Object.entries(globalSettings).filter(([_, enabled]) => !enabled);
    if (disabledAlerts.length > 0) {
      console.log('❌ DISABLED ALERT TYPES:');
      disabledAlerts.forEach(([type, _]) => {
        console.log(`  - ${type}: BLOCKED`);
      });
    }

    // 3. User Count and Configuration
    console.log('\n👥 USER CONFIGURATION:');
    const allUsers = await storage.getAllUsers();
    console.log(`Total users: ${allUsers.length}`);
    
    // 4. Recent Alert Generation
    console.log('\n🚨 RECENT ALERT ACTIVITY:');
    const recentAlerts = await storage.db.execute(`
      SELECT type, COUNT(*) as count, MAX(created_at) as latest
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY type
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('Alert types in last 24 hours:');
    console.log(recentAlerts.rows);

    // 5. Very Recent Alerts (last hour)
    console.log('\n⏰ VERY RECENT ALERTS (Last Hour):');
    const veryRecentAlerts = await storage.db.execute(`
      SELECT id, type, title, created_at, metadata
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log(veryRecentAlerts.rows);

    // 6. LAW #3 COMPLIANCE CHECK
    console.log('\n⚖️ LAW #3 COMPLIANCE CHECK:');
    console.log('Rule: Same messages on alerts page MUST be sent to Telegram');
    
    const alertsPageAlerts = await storage.db.execute(`
      SELECT type, COUNT(*) as count
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY type
      ORDER BY count DESC
    `);
    
    console.log('Alert types appearing on alerts page:');
    for (const alert of alertsPageAlerts.rows) {
      const isGloballyEnabled = globalSettings[alert.type];
      const status = isGloballyEnabled ? '✅ ENABLED' : '❌ BLOCKED';
      console.log(`  ${alert.type}: ${alert.count} alerts - Telegram: ${status}`);
      
      if (!isGloballyEnabled) {
        console.log(`    ⚠️ LAW #3 VIOLATION: ${alert.type} appears on alerts page but blocked from Telegram`);
      }
    }

    // 7. Check for telegram sending failures
    console.log('\n📱 TELEGRAM DIAGNOSTIC:');
    const telegramEnabledUsers = allUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);
    console.log(`Users with valid Telegram config: ${telegramEnabledUsers.length}/${allUsers.length}`);
    
    if (telegramEnabledUsers.length === 0) {
      console.log('❌ NO USERS with valid Telegram configuration found!');
      console.log('This explains why no Telegram alerts are being sent.');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAlertSystem();
