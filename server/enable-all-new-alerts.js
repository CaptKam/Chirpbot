import { db } from './db.js';
import { userAlertSettings } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// List of all new alert types to enable
const NEW_ALERT_TYPES = {
  NCAAF: [
    'NCAAF_CLOSE_GAME',
    'NCAAF_SCORING_PLAY', 
    'NCAAF_FOURTH_QUARTER',
    'NCAAF_HALFTIME'
  ],
  MLB: [
    'MLB_LATE_INNING_CLOSE',
    'MLB_SCORING_OPPORTUNITY',
    'MLB_PITCHING_CHANGE'
  ],
  TEST: [
    'TEST_ALERT'
  ]
};

async function enableNewAlerts() {
  console.log('🚀 Enabling new alert types for superadmin...');
  
  try {
    // Get superadmin's current settings
    const superadminSettings = await db.select()
      .from(userAlertSettings)
      .where(eq(userAlertSettings.username, 'superadmin'));
    
    if (superadminSettings.length === 0) {
      console.log('❌ No settings found for superadmin');
      return;
    }
    
    // Process each sport
    for (const [sport, alertTypes] of Object.entries(NEW_ALERT_TYPES)) {
      for (const alertType of alertTypes) {
        const existingSetting = superadminSettings.find(s => 
          s.sport === sport && s.alertType === alertType
        );
        
        if (existingSetting) {
          // Update existing setting to enabled
          await db.update(userAlertSettings)
            .set({ enabled: true })
            .where(eq(userAlertSettings.id, existingSetting.id));
          console.log(`✅ Updated ${alertType} to enabled`);
        } else {
          // Insert new setting
          await db.insert(userAlertSettings).values({
            userId: superadminSettings[0].userId,
            username: 'superadmin',
            sport,
            alertType,
            enabled: true
          });
          console.log(`✅ Added and enabled ${alertType}`);
        }
      }
    }
    
    // Also enable for kameronfrisby user if they exist
    const kameronSettings = await db.select()
      .from(userAlertSettings)
      .where(eq(userAlertSettings.username, 'kameronfrisby'))
      .limit(1);
    
    if (kameronSettings.length > 0) {
      console.log('🚀 Enabling alerts for kameronfrisby too...');
      
      // Enable NCAAF and MLB alerts for kameron
      for (const sport of ['NCAAF', 'MLB']) {
        if (NEW_ALERT_TYPES[sport]) {
          for (const alertType of NEW_ALERT_TYPES[sport]) {
            const existingSetting = await db.select()
              .from(userAlertSettings)
              .where(eq(userAlertSettings.username, 'kameronfrisby'))
              .where(eq(userAlertSettings.alertType, alertType))
              .limit(1);
            
            if (existingSetting.length === 0) {
              await db.insert(userAlertSettings).values({
                userId: kameronSettings[0].userId,
                username: 'kameronfrisby',
                sport,
                alertType,
                enabled: true
              });
              console.log(`✅ Added ${alertType} for kameronfrisby`);
            }
          }
        }
      }
    }
    
    console.log('✨ All new alert types enabled successfully!');
    
    // Show current enabled alerts
    const allEnabled = await db.select()
      .from(userAlertSettings)
      .where(eq(userAlertSettings.enabled, true));
    
    const byUser = {};
    for (const setting of allEnabled) {
      if (!byUser[setting.username]) {
        byUser[setting.username] = [];
      }
      byUser[setting.username].push(setting.alertType);
    }
    
    console.log('\n📊 Current enabled alerts by user:');
    for (const [user, alerts] of Object.entries(byUser)) {
      console.log(`${user}: ${alerts.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error enabling alerts:', error);
  }
  
  process.exit(0);
}

enableNewAlerts();