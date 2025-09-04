
const { storage } = require('./storage');

async function enableCriticalAlerts() {
  console.log('🔧 ENABLING CRITICAL ALERTS FOR LAW #3 COMPLIANCE');
  console.log('=' .repeat(50));
  
  try {
    // Get admin user to make global changes
    const adminUsers = await storage.getAllUsers();
    const admin = adminUsers.find(u => u.role === 'admin') || adminUsers[0];
    
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
      await storage.updateGlobalAlertSetting('MLB', alertType, true, admin.id);
      console.log(`✅ Enabled: ${alertType}`);
    }
    
    // Verify settings
    console.log('\n🔍 Current global settings:');
    const globalSettings = await storage.getGlobalAlertSettings('MLB');
    alertsToEnable.forEach(alertType => {
      console.log(`${alertType}: ${globalSettings[alertType] ? '✅ ENABLED' : '❌ DISABLED'}`);
    });
    
    console.log('\n🎯 LAW #3 COMPLIANCE: All critical alerts now enabled');
    console.log('Alerts will now appear on alerts page AND be sent to Telegram');
    
  } catch (error) {
    console.error('❌ Failed to enable alerts:', error);
  }
}

enableCriticalAlerts();
