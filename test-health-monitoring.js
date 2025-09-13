#!/usr/bin/env node

/**
 * Test script for Alert Health Monitoring System
 * This script tests the health check endpoint and verifies monitoring is working
 */

const http = require('http');

function makeRequest(path, method = 'GET', postData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    
    req.end();
  });
}

async function testHealthMonitoring() {
  console.log('🧪 Alert Health Monitoring System Test');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Check health endpoint
    console.log('\n📊 Test 1: Checking health endpoint...');
    const healthResponse = await makeRequest('/api/health/alerts');
    
    console.log(`  Status Code: ${healthResponse.statusCode}`);
    console.log(`  Health Status: ${healthResponse.data.status}`);
    console.log(`  Summary: ${healthResponse.data.summary}`);
    
    if (healthResponse.data.metrics) {
      const metrics = healthResponse.data.metrics;
      console.log('\n  📈 Metrics:');
      console.log(`    - Checks Performed: ${metrics.checksPerformed}`);
      console.log(`    - Alerts Generated: ${metrics.alertsGenerated}`);
      console.log(`    - Time Since Last Check: ${metrics.timeSinceLastCheck}`);
      console.log(`    - Time Since Last Alert: ${metrics.timeSinceLastAlert}`);
      console.log(`    - Consecutive Failures: ${metrics.consecutiveFailures}`);
      console.log(`    - Uptime: ${Math.floor(metrics.uptimeSeconds / 60)} minutes`);
      console.log(`    - Memory Usage: ${metrics.memoryUsageMB}MB`);
      console.log(`    - Auto-Recovery Active: ${metrics.isAutoRecovering ? 'Yes' : 'No'}`);
      console.log(`    - Recovery Attempts: ${metrics.recoveryAttempts}`);
    }
    
    if (healthResponse.data.recommendations && healthResponse.data.recommendations.length > 0) {
      console.log('\n  ⚠️ Recommendations:');
      healthResponse.data.recommendations.forEach(rec => {
        console.log(`    - ${rec}`);
      });
    }
    
    // Determine if health is acceptable
    const isHealthy = ['healthy', 'degraded'].includes(healthResponse.data.status);
    
    if (isHealthy) {
      console.log('\n✅ PASS: Alert monitoring system is operational');
    } else {
      console.log('\n❌ FAIL: Alert monitoring system is in critical/unhealthy state');
    }
    
    // Test 2: Verify monitoring is active
    console.log('\n📊 Test 2: Verifying monitoring is active...');
    if (healthResponse.data.metrics) {
      const timeSinceCheck = healthResponse.data.metrics.timeSinceLastCheck;
      const checkTime = parseInt(timeSinceCheck);
      
      if (!isNaN(checkTime) && checkTime < 45) {
        console.log(`  ✅ PASS: Monitoring is active (last check: ${timeSinceCheck})`);
      } else if (timeSinceCheck === 'Never') {
        console.log('  ⚠️ WARNING: Monitoring just started, no checks yet');
      } else {
        console.log(`  ❌ FAIL: Monitoring appears stalled (last check: ${timeSinceCheck})`);
      }
    }
    
    // Test 3: Check alert generation status
    console.log('\n📊 Test 3: Checking alert generation status...');
    if (healthResponse.data.metrics) {
      const timeSinceAlert = healthResponse.data.metrics.timeSinceLastAlert;
      
      if (timeSinceAlert === 'Never') {
        console.log('  ℹ️ INFO: No alerts generated yet (may be normal if no alert conditions met)');
      } else {
        const alertTime = parseInt(timeSinceAlert);
        if (!isNaN(alertTime)) {
          const minutes = Math.floor(alertTime / 60);
          if (minutes > 10) {
            console.log(`  ⚠️ WARNING: No alerts for ${minutes} minutes (may be normal during quiet periods)`);
          } else {
            console.log(`  ✅ PASS: Alert generation active (last alert: ${timeSinceAlert})`);
          }
        }
      }
    }
    
    // Test summary
    console.log('\n' + '=' .repeat(50));
    console.log('🏁 Test Summary:');
    console.log(`  Health Status: ${healthResponse.data.status.toUpperCase()}`);
    console.log(`  Monitoring: ${healthResponse.data.metrics?.checksPerformed > 0 ? 'Active' : 'Starting'}`);
    console.log(`  Auto-Recovery: ${healthResponse.data.metrics?.isAutoRecovering ? 'In Progress' : 'Standby'}`);
    
    // Overall assessment
    if (isHealthy && healthResponse.data.metrics?.checksPerformed > 0) {
      console.log('\n✅ Overall: Alert health monitoring system is working correctly!');
    } else if (healthResponse.data.metrics?.checksPerformed === 0) {
      console.log('\n⏳ Overall: System is initializing, please wait a moment and test again');
    } else {
      console.log('\n⚠️ Overall: System needs attention, check recommendations above');
    }
    
  } catch (error) {
    console.error('❌ Error testing health monitoring:', error.message);
    console.error('   Make sure the server is running on port 3000');
  }
}

// Run the test
testHealthMonitoring().then(() => {
  console.log('\n✨ Health monitoring test complete!');
}).catch(console.error);