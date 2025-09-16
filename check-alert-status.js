import { storage } from './server/storage.js';
// ✅ V3: No longer using legacy V2 AlertGenerator - script uses storage directly

async function checkAlertSystemStatus() {
  try {
    console.log('🔍 CHECKING ALERT SYSTEM STATUS');
    console.log('================================\n');

    // Check if master alerts are enabled
    const masterEnabled = await storage.isMasterAlertsEnabled();
    console.log('🎛️ Master alerts enabled:', masterEnabled);

    // Get all global alert settings for MLB
    const mlbSettings = await storage.getGlobalAlertSettings('MLB');
    console.log('📊 Total MLB alert settings:', mlbSettings.length);

    if (mlbSettings.length > 0) {
      const enabledTypes = mlbSettings.filter(s => s.enabled);
      const disabledTypes = mlbSettings.filter(s => !s.enabled);
      
      console.log('\n✅ ENABLED MLB Alert Types:');
      enabledTypes.forEach(alert => {
        console.log(`  - ${alert.alertType}`);
      });

      console.log('\n❌ DISABLED MLB Alert Types:');
      disabledTypes.forEach(alert => {
        console.log(`  - ${alert.alertType}`);
      });
    }

    // Check for RUNNERS_1ST_2ND specifically
    const runnersAlert = mlbSettings.find(s => s.alertType === 'RUNNERS_1ST_2ND');
    if (!runnersAlert) {
      console.log('\n⚠️ CRITICAL MISSING: RUNNERS_1ST_2ND alert type not found!');
      console.log('   This explains why games with runners on 1st & 2nd generate no alerts.');
    } else {
      console.log(`\n🎯 RUNNERS_1ST_2ND status: ${runnersAlert.enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    // Check recent alerts generated
    const recentAlerts = await storage.getRecentAlerts(10);
    console.log(`\n📝 Recent alerts count: ${recentAlerts.length}`);
    
    if (recentAlerts.length > 0) {
      console.log('📋 Recent alert types:');
      recentAlerts.slice(0, 5).forEach(alert => {
        const payload = JSON.parse(alert.payload);
        console.log(`  - ${payload.type} (${alert.createdAt})`);
      });
    }

    console.log('\n🚦 SYSTEM STATUS SUMMARY:');
    console.log(`   Master Alerts: ${masterEnabled ? '✅' : '❌'}`);
    console.log(`   Total MLB Settings: ${mlbSettings.length}`);
    console.log(`   Enabled Types: ${mlbSettings.filter(s => s.enabled).length}`);
    console.log(`   Recent Alerts: ${recentAlerts.length}`);

  } catch (error) {
    console.error('❌ Error checking alert status:', error);
  }
}

checkAlertSystemStatus();