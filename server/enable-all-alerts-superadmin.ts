import { storage } from './storage';

async function enableAllAlertsForSuperadmin() {
  console.log('🚀 Enabling ALL alerts for superadmin user...');
  
  // All alert types to enable
  const allAlertTypes = [
    // MLB alerts
    'MLB_GAME_START', 'MLB_SEVENTH_INNING_STRETCH', 'MLB_RUNNER_ON_THIRD_NO_OUTS',
    'MLB_FIRST_AND_THIRD_NO_OUTS', 'MLB_SECOND_AND_THIRD_NO_OUTS', 'MLB_FIRST_AND_SECOND',
    'MLB_BASES_LOADED_NO_OUTS', 'MLB_RUNNER_ON_THIRD_ONE_OUT', 'MLB_SECOND_AND_THIRD_ONE_OUT',
    'MLB_BASES_LOADED_ONE_OUT', 'MLB_BATTER_DUE', 'MLB_STEAL_LIKELIHOOD', 'MLB_ON_DECK_PREDICTION',
    'MLB_WIND_CHANGE', 'MLB_LATE_INNING_CLOSE', 'MLB_SCORING_OPPORTUNITY', 'MLB_PITCHING_CHANGE',
    // NCAAF alerts  
    'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_RED_ZONE', 'NCAAF_FOURTH_DOWN_DECISION',
    'NCAAF_UPSET_OPPORTUNITY', 'NCAAF_RED_ZONE_EFFICIENCY', 'NCAAF_COMEBACK_POTENTIAL',
    'NCAAF_MASSIVE_WEATHER', 'NCAAF_SECOND_HALF_KICKOFF', 'NCAAF_CLOSE_GAME', 'NCAAF_SCORING_PLAY',
    'NCAAF_FOURTH_QUARTER', 'NCAAF_HALFTIME',
    // Test alert
    'TEST_ALERT'
  ];
  
  try {
    // Enable alerts for superadmin
    const result = await storage.updateUserAlertSettings('superadmin', {
      enabled: true,
      telegramEnabled: false,
      soundEnabled: true,
      alertTypes: allAlertTypes
    });
    
    console.log('✅ Enabled', allAlertTypes.length, 'alert types for superadmin:');
    console.log('  MLB:', allAlertTypes.filter(a => a.startsWith('MLB_')).join(', '));
    console.log('  NCAAF:', allAlertTypes.filter(a => a.startsWith('NCAAF_')).join(', '));
    console.log('  TEST:', allAlertTypes.filter(a => a === 'TEST_ALERT').join(', '));
    
    // Also ensure global alerts are enabled
    await storage.updateGlobalAlertSettings({ alertsEnabled: true });
    console.log('✅ Global alerts enabled');
    
    // Check the result
    const settings = await storage.getUserAlertSettings('superadmin');
    console.log('🔍 Verification - Superadmin settings:');
    console.log('  Enabled:', settings.enabled);
    console.log('  Alert types count:', settings.alertTypes?.length || 0);
    
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