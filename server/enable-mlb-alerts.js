// Re-enable MLB Alert Types
// This script re-enables the MLB alert types that were disabled globally

import { createStorage } from './storage.ts';

const MLB_ALERT_TYPES = [
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

async function enableMLBAlerts() {
  console.log('🔄 Re-enabling MLB alert types...');
  
  try {
    const storage = createStorage();
    
    for (const alertType of MLB_ALERT_TYPES) {
      try {
        // Enable the alert type globally
        await storage.updateGlobalAlertSetting('MLB', alertType, true);
        console.log(`✅ Enabled: ${alertType}`);
      } catch (error) {
        console.log(`⚠️ Could not enable ${alertType}:`, error.message);
      }
    }
    
    console.log('\n🎉 MLB alert types have been re-enabled!');
    console.log('📱 Users should now see MLB alert options in their settings page.');
    console.log('🔧 Admin panel alert configuration should also be available.');
    
  } catch (error) {
    console.error('❌ Error re-enabling MLB alerts:', error);
  }
}

// Run the script
enableMLBAlerts().then(() => {
  console.log('\n✅ Script completed. You can now access your settings page with MLB alert options.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});