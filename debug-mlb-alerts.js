
const { MLBEngine } = require('./server/services/engines/mlb-engine.ts');

async function debugMLBAlerts() {
  console.log('🔍 Testing MLB Alert Generation...');
  
  const mlbEngine = new MLBEngine();
  
  // Initialize with key alert types
  await mlbEngine.initializeUserAlertModules([
    'MLB_BASES_LOADED_NO_OUTS',
    'MLB_RUNNER_ON_THIRD_NO_OUTS',
    'MLB_GAME_START'
  ]);
  
  // Test game state
  const testGameState = {
    gameId: 'test_123',
    sport: 'MLB',
    homeTeam: 'Yankees',
    awayTeam: 'Red Sox',
    homeScore: 3,
    awayScore: 2,
    status: 'live',
    isLive: true,
    inning: 7,
    isTopInning: false,
    outs: 0,
    balls: 2,
    strikes: 1,
    hasFirst: true,
    hasSecond: true,
    hasThird: true,
    currentBatter: 'Aaron Judge',
    currentPitcher: 'Chris Sale'
  };
  
  console.log('🎯 Testing with game state:', testGameState);
  
  try {
    const alerts = await mlbEngine.generateLiveAlerts(testGameState);
    console.log(`✅ Generated ${alerts.length} alerts:`, alerts);
  } catch (error) {
    console.error('❌ Error generating alerts:', error);
  }
}

debugMLBAlerts().catch(console.error);
