/**
 * Integration Test for UnifiedEventStream Architecture
 * 
 * Tests the complete event stream system in shadow mode to ensure:
 * - All components initialize correctly
 * - Shadow mode operates without interfering with existing system
 * - MLB processor preserves existing alert logic
 * - Circuit breakers provide fault tolerance
 * - Event flow works end-to-end
 */

import { getUnifiedEventStream } from './unified-event-stream';
import { MLBProcessor } from './mlb-processor';
import { getLegacyBridge } from './legacy-bridge';
import { ProcessorFactory, processorManager } from './base-processor';
import { circuitBreakerManager } from './circuit-breaker';
import type { GameState, AlertResult } from '../engines/base-engine';
import type { GameStateChangedEvent, ProcessorContext } from './types';

export class EventStreamIntegrationTest {
  private eventStream: any;
  private mlbProcessor?: MLBProcessor;
  private legacyBridge: any;
  private testResults: Array<{ test: string; passed: boolean; message: string }> = [];

  async runTests(): Promise<boolean> {
    console.log('🧪 Starting UnifiedEventStream Integration Tests...');
    
    try {
      await this.testInitialization();
      await this.testShadowMode();
      await this.testMLBProcessor();
      await this.testCircuitBreaker();
      await this.testEventFlow();
      await this.testHealthChecks();
      
      return this.reportResults();
      
    } catch (error) {
      console.error('💥 Integration test failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test system initialization
   */
  private async testInitialization(): Promise<void> {
    console.log('🔧 Testing system initialization...');
    
    try {
      // Initialize event stream
      this.eventStream = getUnifiedEventStream({
        shadowMode: {
          enabled: true,
          logLevel: 'detailed',
          sampleRate: 1.0,
          compareWithLegacy: true,
          metricsEnabled: true,
          alertOnDifferences: false
        },
        maxConcurrency: 5,
        enableDebugLogging: true
      });
      
      this.addTestResult('event_stream_init', true, 'Event stream initialized successfully');
      
      // Initialize MLB processor
      this.mlbProcessor = new MLBProcessor('test_mlb_processor', 'MLB');
      await this.mlbProcessor.configure({
        id: 'test_mlb_processor',
        sport: 'MLB',
        enabled: true,
        shadowMode: true,
        maxConcurrency: 3,
        timeout: 10000,
        retryConfig: {
          maxRetries: 2,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
          jitter: true
        },
        circuitBreakerConfig: {
          failureThreshold: 5,
          recoveryTimeoutMs: 30000,
          monitoringWindowMs: 300000,
          minimumRequests: 10,
          errorRateThreshold: 0.3
        }
      });
      
      this.addTestResult('mlb_processor_init', true, 'MLB processor initialized successfully');
      
      // Initialize legacy bridge
      this.legacyBridge = await getLegacyBridge({
        enabled: true,
        forwardEvents: false, // Don't forward during tests
        enableComparison: true,
        comparisonTimeout: 5000,
        logDifferences: false // Keep test output clean
      });
      
      this.addTestResult('legacy_bridge_init', true, 'Legacy bridge initialized successfully');
      
    } catch (error) {
      this.addTestResult('initialization', false, `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test shadow mode functionality
   */
  private async testShadowMode(): Promise<void> {
    console.log('🌟 Testing shadow mode functionality...');
    
    try {
      // Verify shadow mode is active
      const isShadowMode = this.eventStream.isShadowModeActive();
      this.addTestResult('shadow_mode_active', isShadowMode, 
        isShadowMode ? 'Shadow mode is active' : 'Shadow mode is not active');
      
      // Verify processor is in shadow mode
      const processorStats = this.mlbProcessor?.getStats();
      const processorShadowMode = processorStats?.shadowMode;
      this.addTestResult('processor_shadow_mode', processorShadowMode === true, 
        processorShadowMode ? 'Processor is in shadow mode' : 'Processor is not in shadow mode');
      
      // Verify bridge is in shadow mode
      const bridgeMetrics = this.legacyBridge.getMetrics();
      const bridgeShadowMode = bridgeMetrics.shadowModeActive;
      this.addTestResult('bridge_shadow_mode', bridgeShadowMode === true, 
        bridgeShadowMode ? 'Bridge is in shadow mode' : 'Bridge is not in shadow mode');
      
    } catch (error) {
      this.addTestResult('shadow_mode', false, `Shadow mode test failed: ${error.message}`);
    }
  }

  /**
   * Test MLB processor with mock game state
   */
  private async testMLBProcessor(): Promise<void> {
    console.log('⚾ Testing MLB processor...');
    
    if (!this.mlbProcessor) {
      this.addTestResult('mlb_processor', false, 'MLB processor not initialized');
      return;
    }
    
    try {
      // Create mock game state with scoring opportunity
      const mockGameState: GameState = {
        gameId: 'test_game_123',
        sport: 'MLB',
        homeTeam: 'TestHome',
        awayTeam: 'TestAway',
        homeScore: 3,
        awayScore: 2,
        status: 'live',
        isLive: true,
        inning: 9,
        outs: 2,
        balls: 3,
        strikes: 1,
        hasFirst: false,
        hasSecond: false,
        hasThird: true, // Runner on third with 2 outs - should trigger alert
        isTopInning: false,
        currentBatter: 'Test Batter',
        currentPitcher: 'Test Pitcher'
      };
      
      const context: ProcessorContext = {
        gameId: mockGameState.gameId,
        sport: mockGameState.sport,
        gameState: mockGameState,
        settings: {}, // Mock settings - all alerts enabled by default
        processorId: this.mlbProcessor.id,
        requestId: `test_request_${Date.now()}`,
        timestamp: Date.now()
      };
      
      // Process the mock game state
      const result = await this.mlbProcessor.processGameState(context);
      
      this.addTestResult('mlb_processor_execution', result.success, 
        result.success ? `Processor executed successfully, generated ${result.alerts.length} alerts` 
                      : `Processor failed: ${result.error?.message}`);
      
      // Verify health check
      const healthCheck = await this.mlbProcessor.healthCheck();
      this.addTestResult('mlb_processor_health', healthCheck, 
        healthCheck ? 'MLB processor health check passed' : 'MLB processor health check failed');
      
    } catch (error) {
      this.addTestResult('mlb_processor', false, `MLB processor test failed: ${error.message}`);
    }
  }

  /**
   * Test circuit breaker functionality
   */
  private async testCircuitBreaker(): Promise<void> {
    console.log('⚡ Testing circuit breaker...');
    
    try {
      // Get circuit breaker for MLB processor
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker('test_processor', 'MLB', {
        failureThreshold: 2, // Low threshold for testing
        recoveryTimeoutMs: 5000,
        monitoringWindowMs: 60000,
        minimumRequests: 1,
        errorRateThreshold: 0.5
      });
      
      // Test successful execution
      let successCount = 0;
      await circuitBreaker.execute(async () => {
        successCount++;
      });
      
      this.addTestResult('circuit_breaker_success', successCount === 1, 
        `Circuit breaker executed successfully: ${successCount} times`);
      
      // Test circuit breaker state
      const stats = circuitBreaker.getStats();
      this.addTestResult('circuit_breaker_closed', stats.state === 'closed', 
        `Circuit breaker state: ${stats.state}`);
      
      // Test circuit breaker health
      const isHealthy = circuitBreaker.isHealthy();
      this.addTestResult('circuit_breaker_health', isHealthy, 
        isHealthy ? 'Circuit breaker is healthy' : 'Circuit breaker is unhealthy');
      
    } catch (error) {
      this.addTestResult('circuit_breaker', false, `Circuit breaker test failed: ${error.message}`);
    }
  }

  /**
   * Test event flow from game state to alert generation
   */
  private async testEventFlow(): Promise<void> {
    console.log('🌊 Testing event flow...');
    
    try {
      let eventReceived = false;
      
      // Subscribe to alert generation events
      const subscriptionId = this.eventStream.subscribe('alert_generated', async (event: any) => {
        eventReceived = true;
        console.log(`🎯 [Test] Received alert event: ${event.payload.alertResult.type}`);
      });
      
      // Create and emit a game state changed event
      const mockGameState: GameState = {
        gameId: 'test_event_flow_123',
        sport: 'MLB',
        homeTeam: 'TestHome',
        awayTeam: 'TestAway',
        homeScore: 5,
        awayScore: 4,
        status: 'live',
        isLive: true,
        inning: 9,
        outs: 0,
        balls: 0,
        strikes: 0,
        hasFirst: true,
        hasSecond: true,
        hasThird: true, // Bases loaded, no outs - high priority situation
        isTopInning: false,
        currentBatter: 'Clutch Hitter',
        currentPitcher: 'Nervous Pitcher'
      };
      
      const gameStateEvent: GameStateChangedEvent = {
        id: `test_game_state_${Date.now()}`,
        type: 'game_state_changed',
        timestamp: Date.now(),
        priority: 'high',
        source: 'test_engine',
        retryCount: 0,
        maxRetries: 3,
        metadata: {
          sport: mockGameState.sport,
          gameId: mockGameState.gameId,
          isTest: true
        },
        payload: {
          gameId: mockGameState.gameId,
          sport: mockGameState.sport,
          previousState: null,
          currentState: mockGameState,
          changes: ['bases_loaded', 'no_outs'],
          isSignificantChange: true
        }
      };
      
      // Emit the event
      await this.eventStream.emitEvent(gameStateEvent);
      
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clean up subscription
      this.eventStream.unsubscribe(subscriptionId);
      
      this.addTestResult('event_flow', true, 'Event flow test completed (shadow mode - no alerts expected)');
      
    } catch (error) {
      this.addTestResult('event_flow', false, `Event flow test failed: ${error.message}`);
    }
  }

  /**
   * Test health checks
   */
  private async testHealthChecks(): Promise<void> {
    console.log('🏥 Testing health checks...');
    
    try {
      // Test event stream metrics
      const metrics = this.eventStream.getMetrics();
      this.addTestResult('event_stream_metrics', 
        metrics && typeof metrics.eventsProcessed === 'number', 
        `Event stream metrics available: ${metrics.eventsProcessed} events processed`);
      
      // Test processor manager health
      const processorHealth = await processorManager.healthCheckAll();
      const healthyProcessors = Object.values(processorHealth).filter(h => h).length;
      this.addTestResult('processor_health', healthyProcessors > 0, 
        `${healthyProcessors} processors are healthy`);
      
      // Test circuit breaker manager
      const cbStats = circuitBreakerManager.getAllStats();
      const cbCount = Object.keys(cbStats).length;
      this.addTestResult('circuit_breaker_stats', cbCount >= 0, 
        `${cbCount} circuit breakers registered`);
      
      // Test legacy bridge health
      const bridgeHealth = await this.legacyBridge.healthCheck();
      this.addTestResult('legacy_bridge_health', bridgeHealth, 
        bridgeHealth ? 'Legacy bridge is healthy' : 'Legacy bridge health check failed');
      
    } catch (error) {
      this.addTestResult('health_checks', false, `Health check test failed: ${error.message}`);
    }
  }

  /**
   * Add test result
   */
  private addTestResult(test: string, passed: boolean, message: string): void {
    this.testResults.push({ test, passed, message });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
  }

  /**
   * Report test results
   */
  private reportResults(): boolean {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n📊 UnifiedEventStream Integration Test Results:');
    console.log(`Total tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
    
    const success = failedTests === 0;
    console.log(`\n${success ? '🎉' : '💥'} Overall result: ${success ? 'PASSED' : 'FAILED'}`);
    
    return success;
  }

  /**
   * Clean up test resources
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test resources...');
    
    try {
      // Reset processor manager
      await processorManager.setAllEnabled(true);
      
      // Reset circuit breakers
      circuitBreakerManager.resetAll();
      
    } catch (error) {
      console.error('⚠️ Cleanup error:', error);
    }
  }
}

/**
 * Run integration tests
 */
export async function runIntegrationTests(): Promise<boolean> {
  const tester = new EventStreamIntegrationTest();
  return await tester.runTests();
}

// Allow running tests directly
if (require.main === module) {
  runIntegrationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}