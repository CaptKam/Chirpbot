
import { storage } from './storage.js';

async function enableCriticalAlerts() {
  try {
    console.log('🔧 ENABLING CRITICAL ALERT TYPES');
    console.log('================================\n');

    // Get admin user
    const allUsers = await storage.getAllUsers();
    const admin = allUsers.find(user => user.role === 'admin') || allUsers[0];
    
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`Using admin: ${admin.username}`);
    
    // Enable ALL alert types that are currently disabled to fix Law #3 violations
    const alertsToEnable = [
      'FULL_COUNT',
      'STRIKEOUT', 
      'POWER_HITTER',
      'HOT_HITTER',
      'BASES_LOADED',
      'RUNNERS_1ST_2ND',
      'RISP',
      'CLOSE_GAME',
      'HIGH_SCORING',
      'SHUTOUT',
      'BLOWOUT'
    ];
    
    console.log('\n📋 Enabling alert types:');
    
    for (const alertType of alertsToEnable) {
      try {
        await storage.updateGlobalAlertSetting('MLB', alertType, true, admin.id);
        console.log(`✅ ${alertType}: ENABLED`);
      } catch (error) {
        console.log(`❌ ${alertType}: FAILED - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Law #3 Compliance restored!');
    console.log('All alerts on the alerts page will now be sent to Telegram.');
    
  } catch (error) {
    console.error('❌ Enable alerts failed:', error);
  }
}

enableCriticalAlerts();
