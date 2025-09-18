
import { storage } from './storage.ts';

async function disableAllAlerts() {
  try {
    console.log('🚫 DISABLING ALL ALERT FEATURES GLOBALLY');
    console.log('=======================================\n');

    // Get admin user to perform the operation
    const allUsers = await storage.getAllUsers();
    const admin = allUsers.find(user => user.role === 'admin') || allUsers[0];
    
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`Using admin: ${admin.username}`);
    
    // Define all alert types across all sports
    const allAlertTypes = {
      'MLB': [
        'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH'
      ],
      'NFL': [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'RED_ZONE', 'FOURTH_DOWN',
        'TWO_MINUTE_WARNING', 'CLUTCH_TIME', 'OVERTIME'
      ],
      'NCAAF': [
        'NCAAF_GAME_START', 'NCAAF_SECOND_HALF_KICKOFF', 'RED_ZONE', 'FOURTH_DOWN',
        'TWO_MINUTE_WARNING', 'CLUTCH_TIME', 'OVERTIME'
      ],
      'CFL': [
        'CFL_GAME_START', 'CFL_SECOND_HALF_KICKOFF', 'THIRD_DOWN', 'THREE_MINUTE_WARNING'
      ],
      'WNBA': [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'WNBA_FINAL_MINUTES',
        'WNBA_FOURTH_QUARTER', 'WNBA_HIGH_SCORING_QUARTER', 'WNBA_LOW_SCORING_QUARTER',
        'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL', 
        'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ],
      'NBA': [
        'NBA_FOURTH_QUARTER', 'NBA_CLOSE_GAME', 'NBA_OVERTIME',
        'NBA_HIGH_SCORING', 'NBA_COMEBACK', 'NBA_CLUTCH_PERFORMANCE'
      ],
      'NHL': [
        'NHL_THIRD_PERIOD', 'NHL_CLOSE_GAME', 'NHL_OVERTIME',
        'NHL_POWER_PLAY', 'NHL_PENALTY_KILL', 'NHL_CLUTCH_PERFORMANCE'
      ]
    };
    
    let totalDisabled = 0;
    
    console.log('\n🚫 Disabling all alert types globally:');
    
    for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
      console.log(`\n📊 Processing ${sport} alerts:`);
      
      for (const alertType of alertTypes) {
        try {
          await storage.updateGlobalAlertSetting(sport, alertType, false, admin.id);
          console.log(`  ❌ ${alertType}: DISABLED`);
          totalDisabled++;
        } catch (error) {
          console.log(`  ⚠️ ${alertType}: FAILED - ${error.message}`);
        }
      }
    }
    
    // Also disable Telegram for all users
    console.log('\n📱 Disabling Telegram notifications for all users:');
    for (const user of allUsers) {
      if (user.telegramEnabled) {
        try {
          await storage.updateUserTelegramSettings(user.id, '', '', false);
          console.log(`  ❌ ${user.username}: Telegram disabled`);
        } catch (error) {
          console.log(`  ⚠️ ${user.username}: Failed to disable Telegram - ${error.message}`);
        }
      }
    }
    
    console.log('\n🛑 ALL ALERT FEATURES DISABLED');
    console.log(`✅ ${totalDisabled} alert types disabled globally`);
    console.log(`✅ Telegram notifications disabled for all users`);
    console.log(`✅ No alerts will be generated or sent until re-enabled`);
    
  } catch (error) {
    console.error('❌ Disable all alerts failed:', error);
  }
}

disableAllAlerts();
