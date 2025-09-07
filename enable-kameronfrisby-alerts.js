
import { storage } from './server/storage.ts';

async function fixAllUserAlerts() {
  try {
    console.log('🔧 FIXING ALERT PREFERENCES FOR ALL USERS');
    console.log('==========================================\n');
    
    // Get all users
    const allUsers = await storage.getAllUsers();
    console.log(`📊 Found ${allUsers.length} total users to check`);
    
    for (const user of allUsers) {
      console.log(`\n👤 Checking user: ${user.username} (${user.email})`);
      
      try {
        // Enable ALL 9 MLB alerts for every user
        const mlbAlerts = [
          'MLB_GAME_START',
          'MLB_SEVENTH_INNING_STRETCH',
          'MLB_RUNNER_ON_THIRD_NO_OUTS',
          'MLB_FIRST_AND_THIRD_NO_OUTS',
          'MLB_SECOND_AND_THIRD_NO_OUTS',
          'MLB_BASES_LOADED_NO_OUTS',
          'MLB_RUNNER_ON_THIRD_ONE_OUT',
          'MLB_SECOND_AND_THIRD_ONE_OUT',
          'MLB_BASES_LOADED_ONE_OUT'
        ];
        
        let mlbUpdated = 0;
        for (const alertType of mlbAlerts) {
          await storage.setUserAlertPreference(user.id, 'MLB', alertType, true);
          mlbUpdated++;
        }
        console.log(`  ✅ MLB: Enabled ${mlbUpdated}/9 alert types`);
        
        // Enable NFL alerts 
        const nflAlerts = ['NFL_GAME_START', 'NFL_TWO_MINUTE_WARNING'];
        let nflUpdated = 0;
        for (const alertType of nflAlerts) {
          await storage.setUserAlertPreference(user.id, 'NFL', alertType, true);
          nflUpdated++;
        }
        console.log(`  ✅ NFL: Enabled ${nflUpdated}/2 alert types`);
        
        // Enable NCAAF alerts
        const ncaafAlerts = ['NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING'];
        let ncaafUpdated = 0;
        for (const alertType of ncaafAlerts) {
          await storage.setUserAlertPreference(user.id, 'NCAAF', alertType, true);
          ncaafUpdated++;
        }
        console.log(`  ✅ NCAAF: Enabled ${ncaafUpdated}/2 alert types`);
        
        // Enable WNBA alerts
        const wnbaAlerts = ['WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING'];
        let wnbaUpdated = 0;
        for (const alertType of wnbaAlerts) {
          await storage.setUserAlertPreference(user.id, 'WNBA', alertType, true);
          wnbaUpdated++;
        }
        console.log(`  ✅ WNBA: Enabled ${wnbaUpdated}/2 alert types`);
        
        console.log(`  🎯 Total: ${mlbUpdated + nflUpdated + ncaafUpdated + wnbaUpdated} alerts enabled for ${user.username}`);
        
      } catch (userError) {
        console.error(`  ❌ Error updating ${user.username}:`, userError.message);
      }
    }
    
    console.log('\n🎉 COMPLETED: All users now have consistent alert preferences');
    console.log('🔔 All enabled alerts will start generating within 15 seconds for live games');
    
    // Verify the fix worked
    console.log('\n🔍 VERIFICATION: Checking kameronfrisby specifically...');
    const kameronfrisby = await storage.getUserByEmail('kameronfrisby@gmail.com');
    if (kameronfrisby) {
      const mlbPrefs = await storage.getUserAlertPreferencesBySport(kameronfrisby.id, 'MLB');
      const enabledMLB = mlbPrefs.filter(p => p.enabled).length;
      console.log(`✅ kameronfrisby now has ${enabledMLB} MLB alerts enabled (should be 9)`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing user alerts:', error);
  }
  
  process.exit(0);
}

fixAllUserAlerts();
