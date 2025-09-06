
import { storage } from './server/storage.js';

async function enableUserAlerts() {
  try {
    console.log('🎯 Enabling alerts for kameronfrisby@gmail.com...');
    
    // Find the user
    const user = await storage.getUserByEmail('kameronfrisby@gmail.com');
    if (!user) {
      console.log('❌ User not found: kameronfrisby@gmail.com');
      return;
    }
    
    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
    
    // Enable MLB alerts
    const mlbAlerts = ['MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'];
    for (const alertType of mlbAlerts) {
      await storage.setUserAlertPreference(user.id, 'MLB', alertType, true);
      console.log(`✅ Enabled ${alertType} for ${user.username}`);
    }
    
    // Enable NFL alerts 
    const nflAlerts = ['NFL_GAME_START', 'NFL_TWO_MINUTE_WARNING'];
    for (const alertType of nflAlerts) {
      await storage.setUserAlertPreference(user.id, 'NFL', alertType, true);
      console.log(`✅ Enabled ${alertType} for ${user.username}`);
    }
    
    // Enable NCAAF alerts
    const ncaafAlerts = ['NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING'];
    for (const alertType of ncaafAlerts) {
      await storage.setUserAlertPreference(user.id, 'NCAAF', alertType, true);
      console.log(`✅ Enabled ${alertType} for ${user.username}`);
    }
    
    console.log('🚀 User is now ready to receive alerts!');
    console.log('🔔 Alerts will start generating within 15 seconds for live games');
    
  } catch (error) {
    console.error('❌ Error enabling user alerts:', error);
  }
  
  process.exit(0);
}

enableUserAlerts();
