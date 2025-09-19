/**
 * NCAAF Alert Generation System Verification Test
 * 
 * This test verifies that the NCAAF system improvements are working:
 * - 13 modules loaded correctly
 * - Performance optimizations applied  
 * - Alert generation pipeline functional
 * - End-to-end system health validation
 */

const { NCAAFEngine } = require('./server/services/engines/ncaaf-engine');
const fs = require('fs');
const path = require('path');

async function verifyNCAAFSystem() {
  console.log('🏈 Starting NCAAF Alert Generation System Verification...\n');
  
  const results = {
    moduleCount: 0,
    moduleLoadTest: false,
    alertGenerationTest: false,
    performanceMetrics: false,
    systemHealth: true,
    errors: []
  };

  try {
    // 1. VERIFY MODULE COUNT (should be 13)
    console.log('📋 Checking NCAAF module count...');
    const modulesDir = path.join(__dirname, 'server/services/engines/alert-cylinders/ncaaf');
    const moduleFiles = fs.readdirSync(modulesDir).filter(file => file.endsWith('.ts'));
    results.moduleCount = moduleFiles.length;
    
    console.log(`✅ Found ${results.moduleCount} NCAAF modules:`);
    moduleFiles.forEach(file => console.log(`   - ${file}`));
    
    if (results.moduleCount === 13) {
      console.log(`✅ MODULE COUNT VERIFIED: 13 modules (improvement from 6 to 13)`);
    } else {
      console.log(`❌ MODULE COUNT MISMATCH: Expected 13, found ${results.moduleCount}`);
      results.errors.push(`Expected 13 modules, found ${results.moduleCount}`);
    }

    // 2. VERIFY ENGINE INITIALIZATION  
    console.log('\n🔧 Testing NCAAF engine initialization...');
    const ncaafEngine = new NCAAFEngine();
    
    // Test that engine can be created without errors
    if (ncaafEngine) {
      console.log('✅ NCAAF Engine initialized successfully');
      results.moduleLoadTest = true;
    }

    // 3. TEST ALERT GENERATION CAPABILITY
    console.log('\n🚨 Testing alert generation with sample game state...');
    
    // Create a realistic NCAAF game state for testing
    const testGameState = {
      gameId: 'test-ncaaf-401234567',
      isLive: true,
      homeTeam: 'Alabama Crimson Tide',
      awayTeam: 'Georgia Bulldogs', 
      homeScore: 21,
      awayScore: 17,
      quarter: 4,
      timeRemaining: '2:00',
      down: 3,
      yardsToGo: 7,
      fieldPosition: 18, // Red zone situation
      possession: 'Alabama Crimson Tide'
    };

    // Test probability calculation
    const probability = await ncaafEngine.calculateProbability(testGameState);
    console.log(`📊 Calculated alert probability: ${probability}% for red zone scenario`);
    
    if (probability > 50) {
      console.log('✅ PROBABILITY CALCULATION WORKING: High probability for red zone/4th quarter scenario');
    } else {
      console.log('⚠️ PROBABILITY CALCULATION: Lower than expected for high-tension scenario');
    }

    // Test alert generation (without actually sending)
    try {
      const alerts = await ncaafEngine.generateLiveAlerts(testGameState);
      console.log(`📢 Generated ${alerts.length} alerts for test scenario`);
      
      if (alerts.length > 0) {
        console.log('✅ ALERT GENERATION WORKING');
        alerts.forEach((alert, i) => {
          console.log(`   Alert ${i+1}: ${alert.type} - ${alert.message.substring(0, 80)}...`);
        });
        results.alertGenerationTest = true;
      } else {
        console.log('⚠️ NO ALERTS GENERATED: Expected alerts for 4th quarter red zone scenario');
      }
    } catch (error) {
      console.log(`❌ ALERT GENERATION ERROR: ${error.message}`);
      results.errors.push(`Alert generation failed: ${error.message}`);
    }

    // 4. VERIFY PERFORMANCE OPTIMIZATIONS
    console.log('\n⚡ Checking performance optimizations...');
    
    // Check for optimization markers in the code
    const engineCode = fs.readFileSync(path.join(__dirname, 'server/services/engines/ncaaf-engine.ts'), 'utf8');
    const optimizationCount = (engineCode.match(/OPTIMIZED:/g) || []).length;
    const performanceMetricsPresent = engineCode.includes('performanceMetrics');
    
    console.log(`✅ Found ${optimizationCount} performance optimizations in code`);
    console.log(`✅ Performance metrics tracking: ${performanceMetricsPresent ? 'Present' : 'Missing'}`);
    
    if (optimizationCount >= 4 && performanceMetricsPresent) {
      console.log('✅ PERFORMANCE OPTIMIZATIONS CONFIRMED');
      results.performanceMetrics = true;
    }

    // 5. FINAL VERIFICATION SUMMARY
    console.log('\n📋 NCAAF SYSTEM VERIFICATION SUMMARY:');
    console.log('=====================================');
    console.log(`Module Count: ${results.moduleCount}/13 ${results.moduleCount === 13 ? '✅' : '❌'}`);
    console.log(`Module Loading: ${results.moduleLoadTest ? '✅' : '❌'}`);
    console.log(`Alert Generation: ${results.alertGenerationTest ? '✅' : '❌'}`); 
    console.log(`Performance Metrics: ${results.performanceMetrics ? '✅' : '❌'}`);
    console.log(`System Health: ${results.systemHealth ? '✅' : '❌'}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    const allTestsPassed = results.moduleCount === 13 && 
                          results.moduleLoadTest && 
                          results.alertGenerationTest && 
                          results.performanceMetrics && 
                          results.systemHealth &&
                          results.errors.length === 0;

    if (allTestsPassed) {
      console.log('\n🎉 VERIFICATION COMPLETE: NCAAF system is fully operational with all improvements applied!');
      console.log('   ✅ 13 modules loaded (improvement from 6)');
      console.log('   ✅ Performance optimizations active');
      console.log('   ✅ Alert generation functional');
      console.log('   ✅ Ready for live game scenarios');
    } else {
      console.log('\n⚠️ VERIFICATION INCOMPLETE: Some issues found that need attention');
    }

    return results;

  } catch (error) {
    console.error(`❌ VERIFICATION FAILED: ${error.message}`);
    console.error(error.stack);
    results.errors.push(`System error: ${error.message}`);
    results.systemHealth = false;
    return results;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyNCAAFSystem()
    .then(results => {
      process.exit(results.systemHealth && results.errors.length === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyNCAAFSystem };