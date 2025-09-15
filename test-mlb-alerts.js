// Test script to verify MLB getAvailableAlertTypes method
const testMLBAlertTypes = async () => {
  try {
    // Import the MLB engine
    const { MLBEngine } = await import('./server/services/engines/mlb-engine.ts');
    const mlbEngine = new MLBEngine();
    
    // Get available alert types
    const alertTypes = await mlbEngine.getAvailableAlertTypes();
    
    console.log('✅ MLB Engine getAvailableAlertTypes() returned:', alertTypes.length, 'alert types');
    console.log('📋 Alert types:', alertTypes);
    
    // Check if MLB_STRIKEOUT is included
    if (alertTypes.includes('MLB_STRIKEOUT')) {
      console.log('✅ SUCCESS: MLB_STRIKEOUT is properly included in available alert types');
    } else {
      console.error('❌ ERROR: MLB_STRIKEOUT is missing from available alert types');
    }
    
    // Verify all expected alerts are present
    const expectedAlerts = [
      'MLB_GAME_START',
      'MLB_SEVENTH_INNING_STRETCH',
      'MLB_RUNNER_ON_THIRD_NO_OUTS',
      'MLB_FIRST_AND_THIRD_NO_OUTS',
      'MLB_SECOND_AND_THIRD_NO_OUTS',
      'MLB_FIRST_AND_SECOND',
      'MLB_BASES_LOADED_NO_OUTS',
      'MLB_RUNNER_ON_THIRD_ONE_OUT',
      'MLB_FIRST_AND_THIRD_ONE_OUT',
      'MLB_SECOND_AND_THIRD_ONE_OUT',
      'MLB_BASES_LOADED_ONE_OUT',
      'MLB_RUNNER_ON_THIRD_TWO_OUTS',
      'MLB_FIRST_AND_THIRD_TWO_OUTS',
      'MLB_RUNNER_ON_SECOND_NO_OUTS',
      'MLB_BATTER_DUE',
      'MLB_STEAL_LIKELIHOOD',
      'MLB_ON_DECK_PREDICTION',
      'MLB_WIND_CHANGE',
      'MLB_LATE_INNING_CLOSE',
      'MLB_SCORING_OPPORTUNITY',
      'MLB_PITCHING_CHANGE',
      'MLB_BASES_LOADED_TWO_OUTS',
      'MLB_STRIKEOUT'
    ];
    
    const missingAlerts = expectedAlerts.filter(alert => !alertTypes.includes(alert));
    if (missingAlerts.length === 0) {
      console.log('✅ All expected MLB alert types are present');
    } else {
      console.error('❌ Missing alerts:', missingAlerts);
    }
    
    console.log('\n🎯 Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testMLBAlertTypes();