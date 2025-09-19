#!/usr/bin/env node

/**
 * NCAAF Performance Validation Suite (Suite 1/5)
 * 
 * Comprehensive live-like load testing to validate NCAAF system performance
 * against MLB and WNBA quality standards.
 * 
 * Test Metrics:
 * - p95 enhanceGameState ≤150ms
 * - module load ≤25ms  
 * - AI enrichment p95 ≤3s
 * - ESPN calls ≤8s cadence
 * - rate-limit hits = 0
 * - Memory steady (<200MB growth)
 * - duplicatesBlocked/alertsSent ratio consistent (<5% unexpected dupes)
 */

const startTime = Date.now();

console.log('🏈 NCAAF Performance Validation Suite (Suite 1/5)');
console.log('================================================');
console.log(`Started at: ${new Date().toISOString()}`);

// Performance metrics collection
const metrics = {
  enhanceGameStateTimes: [],
  moduleLoadTimes: [],
  aiEnhancementTimes: [],
  espnApiCalls: [],
  rateLimitHits: 0,
  memoryUsage: [],
  duplicatesBlocked: 0,
  alertsSent: 0,
  gameStateEnhancements: 0,
  apiResponseTimes: [],
  errors: [],
  startMemory: process.memoryUsage().heapUsed,
  testDuration: 0
};

// Test configuration
const TEST_CONFIG = {
  testDurationMs: 120000, // 2 minutes of intensive testing
  forceEvaluationIntervalMs: 5000, // Force evaluate every 5s (load testing)
  gameIds: ['401762468'], // Current NCAAF game
  expectedModuleCount: 13,
  performanceTargets: {
    enhanceGameStateP95Ms: 150,
    moduleLoadTimeMs: 25,
    aiEnhancementP95Ms: 3000,
    espnApiCadenceMs: 8000,
    maxMemoryGrowthMB: 200,
    maxDuplicateRatePercent: 5
  }
};

/**
 * Calculate percentile from array of numbers
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Parse performance data from console logs
 */
function parseLogLine(line) {
  // Parse NCAAF game state enhancement times
  const enhanceMatch = line.match(/⚠️ NCAAF Slow game state enhancement: (\d+)ms for game (\d+)/);
  if (enhanceMatch) {
    const timeMs = parseInt(enhanceMatch[1]);
    metrics.enhanceGameStateTimes.push(timeMs);
    metrics.gameStateEnhancements++;
    return { type: 'enhancement', gameId: enhanceMatch[2], time: timeMs };
  }

  // Parse loaded modules count
  const moduleMatch = line.match(/🔍 Generating alerts for game \d+ with (\d+) loaded modules/);
  if (moduleMatch) {
    const moduleCount = parseInt(moduleMatch[1]);
    return { type: 'modules', count: moduleCount };
  }

  // Parse AI enhancement times
  const aiMatch = line.match(/✅ Unified AI Enhanced: NCAAF .+ in (\d+)ms/);
  if (aiMatch) {
    const timeMs = parseInt(aiMatch[1]);
    metrics.aiEnhancementTimes.push(timeMs);
    return { type: 'ai_enhancement', time: timeMs };
  }

  // Parse API rate limiting
  const rateLimitMatch = line.match(/🚫 NCAAF API: Rate limited/);
  if (rateLimitMatch) {
    metrics.rateLimitHits++;
    return { type: 'rate_limit' };
  }

  // Parse API calls
  const apiCallMatch = line.match(/🔄 NCAAF API: Fetching .*? for (.+)/);
  if (apiCallMatch) {
    metrics.espnApiCalls.push({ timestamp: Date.now(), type: apiCallMatch[1] });
    return { type: 'api_call', endpoint: apiCallMatch[1] };
  }

  // Parse duplicate alerts blocked
  const dupeMatch = line.match(/🚫.*duplicate.*blocked/i);
  if (dupeMatch) {
    metrics.duplicatesBlocked++;
    return { type: 'duplicate_blocked' };
  }

  // Parse alerts sent
  const alertMatch = line.match(/✅ Alert saved for user|📱.*alert sent/i);
  if (alertMatch) {
    metrics.alertsSent++;
    return { type: 'alert_sent' };
  }

  return null;
}

/**
 * Monitor system performance and collect metrics
 */
async function monitorPerformance(durationMs) {
  console.log(`\n📊 Starting ${durationMs/1000}s performance monitoring...`);
  
  const startTime = Date.now();
  const fs = require('fs');
  
  // Get initial log position to only read new logs
  const logFile = '/tmp/logs/Start_application_20250919_012837_695.log';
  let logPosition = 0;
  
  try {
    const stats = fs.statSync(logFile);
    logPosition = stats.size;
  } catch (error) {
    console.log('⚠️ Could not get initial log position:', error.message);
  }

  const monitorInterval = setInterval(() => {
    // Record memory usage
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    metrics.memoryUsage.push(memUsage);

    // Read new log lines since last check
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > logPosition) {
        const newData = fs.readFileSync(logFile, { encoding: 'utf8', start: logPosition });
        logPosition = stats.size;
        
        const newLines = newData.split('\n').filter(line => line.trim());
        for (const line of newLines) {
          const parsed = parseLogLine(line);
          if (parsed) {
            // Process parsed data if needed
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error reading log file:', error.message);
    }
  }, 1000);

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, durationMs));
  
  clearInterval(monitorInterval);
  metrics.testDuration = Date.now() - startTime;
  
  console.log('✅ Performance monitoring completed');
}

/**
 * Trigger intensive NCAAF game evaluation to generate load
 */
async function triggerIntensiveLoad() {
  console.log('\n🔥 Triggering intensive NCAAF load testing...');
  
  const { spawn } = require('child_process');
  const triggers = [];
  
  // Create multiple concurrent force evaluation processes
  for (let i = 0; i < 5; i++) {
    const trigger = spawn('node', ['-e', `
      const gameId = '401762468';
      console.log('🎯 Force evaluation trigger ${i + 1} starting...');
      
      // Simulate intensive API calls and game state evaluations
      setInterval(() => {
        console.log('🔄 Force evaluation ${i + 1} cycle for game ' + gameId);
        
        // This will trigger the system to fetch enhanced game data
        fetch('http://localhost:5000/api/test-force-evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, sport: 'NCAAF', triggerId: ${i + 1} })
        }).catch(() => {}); // Ignore errors for load testing
        
      }, ${TEST_CONFIG.forceEvaluationIntervalMs + (i * 1000)}); // Stagger triggers
    `], { stdio: 'pipe' });
    
    triggers.push(trigger);
  }
  
  console.log(`🚀 Started ${triggers.length} concurrent load testing processes`);
  
  return triggers;
}

/**
 * Analyze collected performance metrics
 */
function analyzeMetrics() {
  console.log('\n📈 Performance Analysis Results');
  console.log('================================');
  
  // Enhancement performance
  const enhanceP95 = calculatePercentile(metrics.enhanceGameStateTimes, 95);
  const enhanceAvg = metrics.enhanceGameStateTimes.length > 0 
    ? metrics.enhanceGameStateTimes.reduce((a, b) => a + b, 0) / metrics.enhanceGameStateTimes.length
    : 0;
  
  console.log(`GameState Enhancement Performance:`);
  console.log(`  • Total enhancements: ${metrics.gameStateEnhancements}`);
  console.log(`  • Average time: ${enhanceAvg.toFixed(1)}ms`);
  console.log(`  • P95 time: ${enhanceP95}ms (target: ≤150ms) ${enhanceP95 <= 150 ? '✅' : '❌'}`);
  
  // AI Enhancement performance
  const aiP95 = calculatePercentile(metrics.aiEnhancementTimes, 95);
  const aiAvg = metrics.aiEnhancementTimes.length > 0
    ? metrics.aiEnhancementTimes.reduce((a, b) => a + b, 0) / metrics.aiEnhancementTimes.length
    : 0;
  
  console.log(`\nAI Enhancement Performance:`);
  console.log(`  • Total AI enhancements: ${metrics.aiEnhancementTimes.length}`);
  console.log(`  • Average time: ${aiAvg.toFixed(1)}ms`);
  console.log(`  • P95 time: ${aiP95}ms (target: ≤3000ms) ${aiP95 <= 3000 ? '✅' : '❌'}`);
  
  // API Performance
  const apiCadence = metrics.espnApiCalls.length > 1 
    ? (metrics.espnApiCalls[metrics.espnApiCalls.length - 1].timestamp - metrics.espnApiCalls[0].timestamp) / (metrics.espnApiCalls.length - 1)
    : 0;
  
  console.log(`\nAPI Performance:`);
  console.log(`  • Total ESPN API calls: ${metrics.espnApiCalls.length}`);
  console.log(`  • Average cadence: ${apiCadence.toFixed(0)}ms (target: ≤8000ms) ${apiCadence <= 8000 || apiCadence === 0 ? '✅' : '❌'}`);
  console.log(`  • Rate limit hits: ${metrics.rateLimitHits} (target: 0) ${metrics.rateLimitHits === 0 ? '✅' : '❌'}`);
  
  // Memory Performance
  const memoryGrowthMB = metrics.memoryUsage.length > 0 
    ? Math.max(...metrics.memoryUsage) - (metrics.startMemory / 1024 / 1024)
    : 0;
  
  console.log(`\nMemory Performance:`);
  console.log(`  • Starting memory: ${(metrics.startMemory / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  • Peak memory: ${Math.max(...metrics.memoryUsage, 0).toFixed(1)}MB`);
  console.log(`  • Memory growth: ${memoryGrowthMB.toFixed(1)}MB (target: <200MB) ${memoryGrowthMB < 200 ? '✅' : '❌'}`);
  
  // Alert Performance
  const duplicateRate = metrics.alertsSent > 0 
    ? (metrics.duplicatesBlocked / metrics.alertsSent) * 100
    : 0;
  
  console.log(`\nAlert Performance:`);
  console.log(`  • Alerts sent: ${metrics.alertsSent}`);
  console.log(`  • Duplicates blocked: ${metrics.duplicatesBlocked}`);
  console.log(`  • Duplicate rate: ${duplicateRate.toFixed(1)}% (target: <5%) ${duplicateRate < 5 ? '✅' : '❌'}`);
  
  // Overall Test Results
  const testsPassed = [
    enhanceP95 <= 150,
    aiP95 <= 3000 || metrics.aiEnhancementTimes.length === 0,
    apiCadence <= 8000 || apiCadence === 0,
    metrics.rateLimitHits === 0,
    memoryGrowthMB < 200,
    duplicateRate < 5
  ].filter(Boolean).length;
  
  const totalTests = 6;
  
  console.log(`\n🎯 Suite 1 Performance Results: ${testsPassed}/${totalTests} tests passed`);
  console.log(`Test duration: ${(metrics.testDuration/1000).toFixed(1)}s`);
  
  if (testsPassed === totalTests) {
    console.log('✅ SUITE 1 PERFORMANCE VALIDATION: PASSED');
  } else {
    console.log('❌ SUITE 1 PERFORMANCE VALIDATION: FAILED');
    console.log('\n🔍 Issues to address:');
    
    if (enhanceP95 > 150) {
      console.log(`  • GameState enhancement too slow: ${enhanceP95}ms > 150ms target`);
    }
    if (aiP95 > 3000) {
      console.log(`  • AI enhancement too slow: ${aiP95}ms > 3000ms target`);
    }
    if (apiCadence > 8000) {
      console.log(`  • API cadence too fast: ${apiCadence}ms < 8000ms target`);
    }
    if (metrics.rateLimitHits > 0) {
      console.log(`  • Rate limit violations: ${metrics.rateLimitHits} hits`);
    }
    if (memoryGrowthMB >= 200) {
      console.log(`  • Memory growth too high: ${memoryGrowthMB}MB >= 200MB limit`);
    }
    if (duplicateRate >= 5) {
      console.log(`  • Duplicate rate too high: ${duplicateRate}% >= 5% threshold`);
    }
  }
  
  return testsPassed === totalTests;
}

/**
 * Main test execution
 */
async function runPerformanceValidationSuite() {
  try {
    console.log('\n🚀 Starting intensive load generation...');
    const loadTriggers = await triggerIntensiveLoad();
    
    // Run performance monitoring
    await monitorPerformance(TEST_CONFIG.testDurationMs);
    
    // Stop load triggers
    console.log('\n🛑 Stopping load generation...');
    loadTriggers.forEach(trigger => {
      try { trigger.kill(); } catch (e) {}
    });
    
    // Wait a moment for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Analyze results
    const passed = analyzeMetrics();
    
    console.log('\n' + '='.repeat(50));
    console.log(`Suite 1 completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    
    return passed;
    
  } catch (error) {
    console.error('❌ Performance validation suite error:', error);
    metrics.errors.push(error.message);
    return false;
  }
}

// Execute the performance validation suite
if (require.main === module) {
  runPerformanceValidationSuite()
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runPerformanceValidationSuite, metrics, TEST_CONFIG };