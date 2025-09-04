
const { storage } = require('./storage');
const { AlertGenerator } = require('./services/alert-generator');

async function debugAlertSystem() {
  console.log('🔍 ALERT SYSTEM DEBUG REPORT');
  console.log('=' .repeat(50));
  
  try {
    // 1. Check Global Alert Settings
    console.log('\n📋 GLOBAL ALERT SETTINGS:');
    const globalSettings = await storage.getGlobalAlertSettings('MLB');
    console.log(globalSettings);
    
    // 2. Check Recent Alerts in Database
    console.log('\n📊 RECENT ALERTS (last 1 hour):');
    const recentAlerts = await storage.db.execute(`
      SELECT type, COUNT(*) as count, MAX(created_at) as latest, sport
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY type, sport
      ORDER BY latest DESC
    `);
    console.log(recentAlerts.rows);
    
    // 3. Check User Telegram Configurations
    console.log('\n📱 TELEGRAM CONFIGURATIONS:');
    const allUsers = await storage.getAllUsers();
    const telegramUsers = allUsers.filter(u => u.telegramEnabled);
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Telegram enabled: ${telegramUsers.length}`);
    
    telegramUsers.forEach(user => {
      console.log(`- ${user.username}: Token=${user.telegramBotToken ? 'SET' : 'MISSING'}, ChatId=${user.telegramChatId || 'MISSING'}`);
    });
    
    // 4. Check User Alert Preferences
    console.log('\n⚙️ USER ALERT PREFERENCES:');
    for (const user of telegramUsers) {
      const prefs = await storage.getUserAlertPreferencesBySport(user.id, 'mlb');
      console.log(`${user.username}:`, prefs.map(p => `${p.alertType}=${p.enabled}`));
    }
    
    // 5. Test Alert Generation
    console.log('\n🧪 TESTING ALERT GENERATION:');
    const alertGenerator = new AlertGenerator();
    console.log('Generating test alerts...');
    await alertGenerator.generateLiveGameAlerts();
    
    // 6. Check if any alerts were created in the last 5 minutes
    console.log('\n⏰ VERY RECENT ALERTS (last 5 minutes):');
    const veryRecentAlerts = await storage.db.execute(`
      SELECT id, type, sport, created_at, payload 
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log(veryRecentAlerts.rows);

    // 7. LAW #3 COMPLIANCE CHECK
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

    // 8. Check for telegram sending failures
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
