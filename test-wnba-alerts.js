
const { WNBAEngine } = require('./server/services/engines/wnba-engine');
const { WNBAApiService } = require('./server/services/wnba-api');

async function testWNBAAlerts() {
  try {
    console.log('🏀 Testing WNBA Alert System...');
    
    // Test WNBA API
    const wnbaApi = new WNBAApiService();
    const games = await wnbaApi.getTodaysGames();
    console.log(`📊 WNBA Games Found: ${games.length}`);
    
    if (games.length === 0) {
      console.log('⚠️ No WNBA games today - alerts won\'t generate');
      return;
    }
    
    // Test WNBA Engine
    const wnbaEngine = new WNBAEngine();
    const availableTypes = await wnbaEngine.getAvailableAlertTypes();
    console.log(`🎯 Available WNBA Alert Types: ${availableTypes.length}`);
    console.log(availableTypes.join(', '));
    
    // Test alert generation for first game
    const firstGame = games[0];
    console.log(`🎮 Testing with game: ${firstGame.awayTeam} @ ${firstGame.homeTeam}`);
    
    const gameState = {
      gameId: firstGame.gameId,
      sport: 'WNBA',
      homeTeam: firstGame.homeTeam,
      awayTeam: firstGame.awayTeam,
      homeScore: firstGame.homeScore,
      awayScore: firstGame.awayScore,
      status: firstGame.status,
      isLive: firstGame.isLive,
      quarter: firstGame.quarter || 1,
      timeRemaining: firstGame.timeRemaining || '10:00'
    };
    
    // Test probability calculation
    const probability = await wnbaEngine.calculateProbability(gameState);
    console.log(`📊 Calculated Probability: ${probability}%`);
    
    // Initialize with sample alert types
    await wnbaEngine.initializeUserAlertModules(['WNBA_GAME_START', 'FINAL_MINUTES']);
    
    // Generate alerts
    const alerts = await wnbaEngine.generateLiveAlerts(gameState);
    console.log(`🚨 Generated Alerts: ${alerts.length}`);
    
    alerts.forEach((alert, index) => {
      console.log(`  Alert ${index + 1}: ${alert.type} - ${alert.message}`);
    });
    
    if (alerts.length === 0) {
      console.log('⚠️ No alerts generated - check game state and alert conditions');
    }
    
  } catch (error) {
    console.error('❌ WNBA Test Error:', error);
  }
}

testWNBAAlerts();
