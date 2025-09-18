import { storage } from './storage';

async function enableAllAlertsForSuperadmin() {
  console.log('🚀 Enabling ALL global alert settings...');
  
  // All alert types to enable - focus on WNBA alerts
  const wnbaAlertTypes = [
    'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'WNBA_FINAL_MINUTES',
    'WNBA_FOURTH_QUARTER', 'WNBA_HIGH_SCORING_QUARTER', 'WNBA_LOW_SCORING_QUARTER',
    'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL', 
    'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
  ];
  
  try {
    // Enable global alerts for WNBA (this is what controls module loading)
    console.log('🔧 Enabling global WNBA alert settings...');
    
    for (const alertType of wnbaAlertTypes) {
      await storage.updateGlobalAlertSetting('WNBA', alertType, true, '9126c8a9-54df-4c31-9565-9f908f44a6f3');
      console.log(`✅ Enabled global setting: ${alertType}`);
    }
    
    console.log('✅ Enabled', wnbaAlertTypes.length, 'WNBA alert types globally:');
    console.log('  WNBA:', wnbaAlertTypes.join(', '));
    
    // Also enable user preferences for the superadmin user
    console.log('🔧 Enabling user preferences for superadmin...');
    const preferences = wnbaAlertTypes.map(alertType => ({
      alertType,
      enabled: true
    }));
    
    await storage.bulkSetUserAlertPreferences('9126c8a9-54df-4c31-9565-9f908f44a6f3', 'WNBA', preferences);
    console.log('✅ User preferences enabled for superadmin');
    
    // Check the result
    const settings = await storage.getUserAlertPreferencesBySport('9126c8a9-54df-4c31-9565-9f908f44a6f3', 'WNBA');
    console.log('🔍 Verification - Superadmin WNBA settings:');
    console.log('  Total preferences:', settings.length);
    console.log('  Enabled alerts:', settings.filter(s => s.enabled).length);
    
  } catch (error) {
    console.error('❌ Error enabling alerts:', error);
    throw error;
  }
}

// Run the script
enableAllAlertsForSuperadmin()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });