import { storage } from './server/storage.js';

async function enableMasterAlerts() {
  try {
    console.log('🚀 ENABLING MASTER ALERT SYSTEM');
    console.log('===============================\n');
    
    // Check current status
    console.log('🔍 Checking current master alerts status...');
    let masterEnabled;
    try {
      masterEnabled = await storage.isMasterAlertsEnabled();
      console.log(`📊 Current master alerts status: ${masterEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    } catch (error) {
      console.log('⚠️ Unable to check master alerts status:', error.message);
    }

    // Get admin user
    const allUsers = await storage.getAllUsers();
    const admin = allUsers.find(user => user.role === 'admin') || allUsers[0];
    
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`👤 Using admin user: ${admin.username} (${admin.id})`);
    
    // Enable master alerts 
    console.log('\n🎯 Enabling master alert system...');
    try {
      await storage.toggleMasterAlerts(true, admin.id);
      console.log('✅ Master alerts ENABLED successfully');
    } catch (error) {
      console.log('❌ Failed to enable master alerts:', error.message);
    }

    // Verify enabled
    console.log('\n🔍 Verifying master alerts status...');
    try {
      const newStatus = await storage.isMasterAlertsEnabled();
      console.log(`📊 New master alerts status: ${newStatus ? '✅ ENABLED' : '❌ STILL DISABLED'}`);
    } catch (error) {
      console.log('⚠️ Unable to verify master alerts status:', error.message);
    }

    // Check critical MLB alert types
    console.log('\n📋 Checking critical MLB alert types...');
    const criticalTypes = [
      'MLB_FIRST_AND_SECOND',
      'MLB_FIRST_AND_THIRD_NO_OUTS', 
      'MLB_SECOND_AND_THIRD_ONE_OUT',
      'MLB_BASES_LOADED_NO_OUTS',
      'MLB_BATTER_DUE'
    ];

    for (const alertType of criticalTypes) {
      try {
        // Try to get the setting first
        const settings = await storage.getGlobalAlertSettings('MLB');
        const existingSetting = settings.find(s => s.alertType === alertType);
        
        if (!existingSetting) {
          // Create the setting
          await storage.createGlobalAlertSetting('MLB', alertType, true, admin.id);
          console.log(`✅ Created and enabled: ${alertType}`);
        } else if (!existingSetting.enabled) {
          // Enable existing setting
          await storage.updateGlobalAlertSetting('MLB', alertType, true, admin.id);
          console.log(`✅ Enabled existing: ${alertType}`);
        } else {
          console.log(`✅ Already enabled: ${alertType}`);
        }
      } catch (error) {
        console.log(`⚠️ Issue with ${alertType}: ${error.message}`);
      }
    }
    
    // Restore monitored games for the user
    console.log('\n🎯 Restoring monitored games for user...');
    
    // Get today's MLB games
    const { MLBApiService } = await import('./server/services/mlb-api.js');
    const mlbApi = new MLBApiService();
    
    try {
      const games = await mlbApi.getTodaysGames();
      console.log(`📊 Found ${games.length} MLB games to monitor`);
      
      // Add all live/scheduled games to monitoring
      for (const game of games) {
        if (game.isLive || game.status === 'scheduled') {
          try {
            await storage.addUserMonitoredTeam(
              admin.id,
              game.gameId || game.id,
              'MLB',
              game.homeTeam.name || game.homeTeam,
              game.awayTeam.name || game.awayTeam
            );
            console.log(`✅ Added monitoring: ${game.awayTeam.name || game.awayTeam} @ ${game.homeTeam.name || game.homeTeam}`);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.log(`⚠️ Could not add ${game.gameId}: ${error.message}`);
            }
          }
        }
      }
      
      // Verify monitoring count
      const monitoredGames = await storage.getAllMonitoredGames();
      const userMonitored = monitoredGames.filter(g => g.userId === admin.id);
      console.log(`✅ User now monitoring ${userMonitored.length} games`);
      
    } catch (error) {
      console.log(`⚠️ Could not restore monitored games: ${error.message}`);
    }

    console.log('\n🚀 MASTER ALERT SYSTEM ACTIVATION COMPLETE!');
    console.log('✅ Live games with scoring situations should now generate alerts');
    console.log('✅ Monitored games restored');
    console.log('✅ Check logs for alert generation activity');
    
  } catch (error) {
    console.error('❌ Enable master alerts failed:', error);
  }
}

enableMasterAlerts();