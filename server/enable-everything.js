
import { storage } from './storage.js';

async function enableEverything() {
  try {
    console.log('🚀 ENABLING ALL ALERT SYSTEMS');
    console.log('=============================\n');

    // Get admin user
    const allUsers = await storage.getAllUsers();
    const admin = allUsers.find(user => user.role === 'admin') || allUsers[0];
    
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`Using admin: ${admin.username}`);
    
    // Define ALL alert types across ALL sports
    const allAlertTypes = {
      'MLB': [
        'RISP', 'BASES_LOADED', 'RUNNERS_1ST_2ND', 'CLOSE_GAME', 
        'LATE_PRESSURE', 'HIGH_SCORING', 'SHUTOUT', 'BLOWOUT',
        'FULL_COUNT', 'STRIKEOUT', 'POWER_HITTER', 'HOT_HITTER',
        'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH', 'TEST_ALERT',
        // RE24 System
        'RE24_ENABLED', 'RE24_CONTEXT_FACTORS', 'RE24_MINIMUM_THRESHOLDS', 'RE24_DYNAMIC_PRIORITY',
        // AI Enhancements  
        'AI_ENHANCED_MESSAGES', 'AI_PREDICTIVE_AT_BAT', 'AI_SCORING_PROBABILITY',
        'AI_SITUATION_ANALYSIS', 'AI_EVENT_SUMMARIES', 'AI_ROI_ALERTS'
      ],
      'NFL': [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'RED_ZONE', 'FOURTH_DOWN', 'CLUTCH_TIME', 'OVERTIME'
      ],
      'NCAAF': [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'RED_ZONE', 
        'FOURTH_DOWN', 'CLUTCH_TIME', 'OVERTIME'
      ],
      'CFL': [
        'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING', 'THIRD_DOWN', 'THREE_MINUTE_WARNING'
      ],
      'WNBA': [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER',
        'WNBA_CLOSE_GAME', 'WNBA_OVERTIME', 'WNBA_HIGH_SCORING', 
        'WNBA_COMEBACK', 'WNBA_CLUTCH_PERFORMANCE'
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
    
    let totalEnabled = 0;
    
    console.log('\n📊 ENABLING GLOBAL SETTINGS:');
    
    // Enable all global settings
    for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
      console.log(`\n🏆 Processing ${sport} alerts:`);
      
      for (const alertType of alertTypes) {
        try {
          await storage.updateGlobalAlertSetting(sport, alertType, true, admin.id);
          console.log(`  ✅ ${alertType}: ENABLED`);
          totalEnabled++;
        } catch (error) {
          console.log(`  ⚠️ ${alertType}: FAILED - ${error.message}`);
        }
      }
    }
    
    console.log('\n👥 ENABLING USER PREFERENCES:');
    
    // Enable user preferences for all sports for all users
    for (const user of allUsers) {
      console.log(`\n👤 Enabling alerts for user: ${user.username}`);
      
      for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
        console.log(`  📱 ${sport} alerts:`);
        
        for (const alertType of alertTypes) {
          try {
            await storage.updateUserAlertPreference(user.id, sport, alertType, true);
            console.log(`    ✅ ${alertType}`);
          } catch (error) {
            console.log(`    ⚠️ ${alertType}: ${error.message}`);
          }
        }
      }
    }
    
    // Enable Telegram for all users (if they have chat IDs)
    console.log('\n📱 ENABLING TELEGRAM NOTIFICATIONS:');
    for (const user of allUsers) {
      if (user.telegramChatId && user.telegramBotToken) {
        try {
          await storage.updateUserTelegramSettings(
            user.id, 
            user.telegramChatId, 
            user.telegramBotToken, 
            true
          );
          console.log(`  ✅ ${user.username}: Telegram enabled`);
        } catch (error) {
          console.log(`  ⚠️ ${user.username}: ${error.message}`);
        }
      } else {
        console.log(`  ⏸️ ${user.username}: No Telegram credentials`);
      }
    }
    
    console.log('\n🎉 ALL SYSTEMS ENABLED!');
    console.log(`✅ ${totalEnabled} global alert types enabled`);
    console.log(`✅ User preferences enabled for all sports`);
    console.log(`✅ All users have maximum alert coverage`);
    console.log(`✅ System ready for comprehensive monitoring`);
    
    // Show what's enabled
    console.log('\n📋 SUMMARY OF ENABLED SYSTEMS:');
    for (const [sport, alertTypes] of Object.entries(allAlertTypes)) {
      console.log(`  ${sport}: ${alertTypes.length} alert types`);
    }
    
  } catch (error) {
    console.error('❌ Enable everything failed:', error);
  }
}

enableEverything();
