/**
 * Legacy Bridge - Integration with Existing Services
 * 
 * Provides seamless integration between the new UnifiedEventStream
 * architecture and the existing unified-alert-generator.ts system.
 * 
 * Key Features:
 * - Shadow mode operation for safe parallel execution
 * - Bidirectional event flow between old and new systems
 * - Result comparison and validation
 * - Gradual migration support
 * - Backward compatibility preservation
 * - Performance monitoring and metrics
 */

import { EventEmitter } from 'events';
import type { GameState, AlertResult } from '../engines/base-engine';
import type { 
  UnifiedEvent,
  GameStateChangedEvent,
  AlertGeneratedEvent,
  LegacyBridgeConfig,
  ProcessorContext
} from './types';
import { gameStateToEvent, alertResultToEvent } from './types';
import { getUnifiedEventStream } from './unified-event-stream';
import { ProcessorFactory, processorManager } from './base-processor';
import { MLBProcessor } from './mlb-processor';

// Import existing system components
import { UnifiedAlertGenerator } from '../unified-alert-generator';
import { getUnifiedSettings } from '../unified-settings';

export interface LegacyBridgeMetrics {
  eventsForwarded: number;
  alertsCompared: number;
  discrepanciesFound: number;
  legacyCallsIntercepted: number;
  shadowModeActive: boolean;
  lastActivity: number;
  bridgeUptime: number;
}

export interface ComparisonResult {
  gameId: string;
  timestamp: number;
  legacyAlerts: AlertResult[];
  eventStreamAlerts: AlertResult[];
  matches: boolean;
  differences?: any;
}

/**
 * Main Legacy Bridge class
 */
export class LegacyBridge extends EventEmitter {
  private readonly config: LegacyBridgeConfig;
  private readonly metrics: LegacyBridgeMetrics;
  private readonly comparisonResults: ComparisonResult[] = [];
  private readonly startTime = Date.now();
  
  // Event stream integration
  private eventStream: any; // UnifiedEventStream instance
  private mlbProcessor?: MLBProcessor;
  
  // Legacy system integration
  private legacyGenerator?: UnifiedAlertGenerator;
  private isInitialized = false;
  
  // State tracking
  private readonly gameStates = new Map<string, { current: GameState; previous?: GameState }>();
  private readonly processingQueue = new Map<string, Promise<void>>();

  constructor(config: Partial<LegacyBridgeConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      forwardEvents: true,
      enableComparison: true,
      comparisonTimeout: 5000,
      logDifferences: true,
      ...config
    };
    
    this.metrics = {
      eventsForwarded: 0,
      alertsCompared: 0,
      discrepanciesFound: 0,
      legacyCallsIntercepted: 0,
      shadowModeActive: true,
      lastActivity: Date.now(),
      bridgeUptime: 0
    };
    
    console.log('🌉 Legacy Bridge initializing...');
  }

  /**
   * Initialize the bridge with both systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Legacy Bridge already initialized');
      return;
    }
    
    try {
      // Initialize event stream
      this.eventStream = getUnifiedEventStream({
        shadowMode: {
          enabled: true,
          logLevel: 'detailed',
          compareWithLegacy: this.config.enableComparison,
          sampleRate: 1.0,
          metricsEnabled: true,
          alertOnDifferences: this.config.logDifferences
        }
      });
      
      // Initialize MLB processor
      this.mlbProcessor = new MLBProcessor();
      await this.mlbProcessor.configure({
        id: 'mlb_legacy_bridge_processor',
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
      
      // Register MLB processor
      ProcessorFactory.registerProcessor('MLB', MLBProcessor);
      processorManager.addProcessor(this.mlbProcessor);
      
      // Set up event stream subscriptions
      this.setupEventStreamSubscriptions();
      
      // Set up legacy system hooks
      this.setupLegacyIntegration();
      
      this.isInitialized = true;
      console.log('✅ Legacy Bridge initialized successfully');
      
      // Start metrics collection
      this.startMetricsCollection();
      
    } catch (error) {
      console.error('💥 Legacy Bridge initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up event stream subscriptions
   */
  private setupEventStreamSubscriptions(): void {
    if (!this.eventStream) return;
    
    // Subscribe to game state changes
    this.eventStream.subscribe('game_state_changed', async (event: GameStateChangedEvent) => {
      await this.handleGameStateChanged(event);
    });
    
    // Subscribe to alert generation events
    this.eventStream.subscribe('alert_generated', async (event: AlertGeneratedEvent) => {
      await this.handleAlertGenerated(event);
    });
    
    console.log('📡 Event stream subscriptions configured');
  }

  /**
   * Set up legacy system integration hooks
   */
  private setupLegacyIntegration(): void {
    try {
      // Hook into existing UnifiedAlertGenerator - import it lazily to avoid circular imports
      const { UnifiedAlertGenerator } = require('../unified-alert-generator');
      this.legacyGenerator = new UnifiedAlertGenerator({ logLevel: 'quiet' });
      
      // Hook into GameStateManager events
      const { gameStateManager } = require('../game-state-manager');
      
      // Set up game state change listener
      if (gameStateManager && typeof gameStateManager.on === 'function') {
        gameStateManager.on('gameStateChanged', async (gameInfo: any) => {
          await this.onLegacyGameStateChanged(gameInfo);
        });
        console.log('✅ Hooked into GameStateManager events');
      }
      
      console.log('🔗 Legacy system hooks configured successfully');
      
    } catch (error) {
      console.error('⚠️ Legacy system integration failed:', error);
      // Continue in shadow mode without legacy integration
      console.log('🌟 Continuing in pure shadow mode without legacy comparison');
    }
  }

  /**
   * Handle game state changes from either system
   */
  async handleGameStateChanged(event: GameStateChangedEvent): Promise<void> {
    const { gameId, currentState, previousState } = event.payload;
    
    this.updateMetrics();
    
    try {
      // Track game state
      this.gameStates.set(gameId, {
        current: currentState,
        previous: previousState || undefined
      });
      
      // Process with event stream processor (shadow mode)
      if (this.mlbProcessor && currentState.sport === 'MLB') {
        await this.processWithEventStream(currentState, previousState);
      }
      
      // Forward to legacy system if enabled
      if (this.config.forwardEvents) {
        await this.forwardToLegacySystem(currentState);
      }
      
    } catch (error) {
      console.error(`💥 Error handling game state change for ${gameId}:`, error);
    }
  }

  /**
   * Handle alert generation events
   */
  async handleAlertGenerated(event: AlertGeneratedEvent): Promise<void> {
    this.updateMetrics();
    
    if (this.config.logDifferences) {
      console.log(`🎯 [Shadow Mode] Alert generated: ${event.payload.alertResult.type} for game ${event.payload.gameId}`);
    }
  }

  /**
   * Process game state with event stream system (shadow mode)
   */
  private async processWithEventStream(
    gameState: GameState,
    previousState?: GameState | null
  ): Promise<AlertResult[]> {
    if (!this.mlbProcessor) return [];
    
    try {
      // Create processor context
      const context: ProcessorContext = {
        gameId: gameState.gameId,
        sport: gameState.sport,
        gameState,
        previousState: previousState || undefined,
        settings: await this.getSettings(gameState.sport),
        processorId: this.mlbProcessor.id,
        requestId: `legacy_bridge_${Date.now()}`,
        timestamp: Date.now()
      };
      
      // Process with MLB processor
      const result = await this.mlbProcessor.processGameState(context);
      
      if (result.success) {
        // Emit alert events
        for (const alert of result.alerts) {
          const alertEvent = alertResultToEvent(alert, gameState, this.mlbProcessor.id);
          await this.eventStream.emitEvent(alertEvent);
        }
        
        return result.alerts;
      }
      
      return [];
      
    } catch (error) {
      console.error(`💥 Event stream processing error for game ${gameState.gameId}:`, error);
      return [];
    }
  }

  /**
   * Forward events to legacy system and compare results
   */
  private async forwardToLegacySystem(gameState: GameState): Promise<void> {
    this.metrics.eventsForwarded++;
    
    if (this.legacyGenerator && this.config.enableComparison) {
      try {
        // Process with legacy system (if available)
        const legacyAlerts = await this.processWithLegacySystem(gameState);
        
        // Process with event stream system
        const eventStreamAlerts = await this.processWithEventStream(gameState);
        
        // Compare results
        if (legacyAlerts.length > 0 || eventStreamAlerts.length > 0) {
          const comparison = await this.compareResults(gameState.gameId, legacyAlerts, eventStreamAlerts);
          
          if (this.config.logDifferences && !comparison.matches) {
            console.log(`🔍 [Shadow Mode] Alert discrepancy detected for game ${gameState.gameId}`);
          }
        }
        
      } catch (error) {
        console.error(`💥 Legacy comparison error for game ${gameState.gameId}:`, error);
      }
    }
    
    if (this.config.logDifferences) {
      console.log(`📤 [Shadow Mode] Processed game state: ${gameState.gameId}`);
    }
  }

  /**
   * Get settings for a sport
   */
  private async getSettings(sport: string): Promise<Record<string, boolean>> {
    try {
      const unifiedSettings = getUnifiedSettings();
      return await unifiedSettings.getGlobalSettings(sport);
    } catch (error) {
      console.error(`Error getting settings for ${sport}:`, error);
      return {};
    }
  }

  /**
   * Compare results between systems
   */
  async compareResults(
    gameId: string,
    legacyAlerts: AlertResult[],
    eventStreamAlerts: AlertResult[]
  ): Promise<ComparisonResult> {
    this.metrics.alertsCompared++;
    
    const matches = this.alertsMatch(legacyAlerts, eventStreamAlerts);
    
    const result: ComparisonResult = {
      gameId,
      timestamp: Date.now(),
      legacyAlerts,
      eventStreamAlerts,
      matches
    };
    
    if (!matches) {
      this.metrics.discrepanciesFound++;
      result.differences = this.analyzeDiscrepancies(legacyAlerts, eventStreamAlerts);
      
      if (this.config.logDifferences) {
        console.warn(`🔍 Alert discrepancy detected for game ${gameId}:`, result.differences);
      }
    }
    
    // Store comparison result
    this.comparisonResults.push(result);
    
    // Keep only recent results (last 100)
    if (this.comparisonResults.length > 100) {
      this.comparisonResults.shift();
    }
    
    return result;
  }

  /**
   * Handle game state changes from legacy GameStateManager
   */
  private async onLegacyGameStateChanged(gameInfo: any): Promise<void> {
    try {
      // Convert legacy game info to our GameState format
      const gameState: GameState = {
        gameId: gameInfo.gameId,
        sport: gameInfo.sport || 'MLB',
        homeTeam: gameInfo.homeTeam,
        awayTeam: gameInfo.awayTeam,
        homeScore: gameInfo.homeScore || 0,
        awayScore: gameInfo.awayScore || 0,
        status: gameInfo.currentState || 'unknown',
        isLive: gameInfo.currentState === 'LIVE',
        // Preserve all other fields
        ...gameInfo.rawGameData
      };
      
      // Create and emit game state changed event
      const event = gameStateToEvent(gameState, null, []);
      await this.eventStream.emitEvent(event);
      
      if (this.config.logDifferences) {
        console.log(`🎯 [Shadow Mode] Processed legacy game state change: ${gameState.gameId} (${gameState.status})`);
      }
      
    } catch (error) {
      console.error('💥 Error processing legacy game state change:', error);
    }
  }

  /**
   * Process game state with legacy system
   */
  private async processWithLegacySystem(gameState: GameState): Promise<AlertResult[]> {
    if (!this.legacyGenerator) return [];
    
    try {
      // This would call the legacy alert generation
      // For now, return empty array as we're in shadow mode
      return [];
      
    } catch (error) {
      console.error(`💥 Legacy processing error for game ${gameState.gameId}:`, error);
      return [];
    }
  }

  /**
   * Check if alert arrays match
   */
  private alertsMatch(alerts1: AlertResult[], alerts2: AlertResult[]): boolean {
    if (alerts1.length !== alerts2.length) return false;
    
    // Sort by alert key for comparison
    const sorted1 = alerts1.slice().sort((a, b) => a.alertKey.localeCompare(b.alertKey));
    const sorted2 = alerts2.slice().sort((a, b) => a.alertKey.localeCompare(b.alertKey));
    
    for (let i = 0; i < sorted1.length; i++) {
      const alert1 = sorted1[i];
      const alert2 = sorted2[i];
      
      if (alert1.alertKey !== alert2.alertKey ||
          alert1.type !== alert2.type ||
          Math.abs(alert1.priority - alert2.priority) > 5) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Analyze discrepancies between alert sets
   */
  private analyzeDiscrepancies(legacyAlerts: AlertResult[], eventStreamAlerts: AlertResult[]): any {
    const legacyTypes = new Set(legacyAlerts.map(a => a.type));
    const eventStreamTypes = new Set(eventStreamAlerts.map(a => a.type));
    
    return {
      countDifference: eventStreamAlerts.length - legacyAlerts.length,
      legacyOnly: legacyAlerts.filter(a => !eventStreamTypes.has(a.type)).map(a => a.type),
      eventStreamOnly: eventStreamAlerts.filter(a => !legacyTypes.has(a.type)).map(a => a.type),
      legacyCount: legacyAlerts.length,
      eventStreamCount: eventStreamAlerts.length
    };
  }

  /**
   * Intercept calls to legacy alert generation
   */
  interceptLegacyCall(
    gameState: GameState,
    originalCallback: (gameState: GameState) => Promise<AlertResult[]>
  ): Promise<AlertResult[]> {
    this.metrics.legacyCallsIntercepted++;
    
    // Run both systems in parallel and compare
    return this.runParallelComparison(gameState, originalCallback);
  }

  /**
   * Run both systems in parallel and compare results
   */
  private async runParallelComparison(
    gameState: GameState,
    legacyCallback: (gameState: GameState) => Promise<AlertResult[]>
  ): Promise<AlertResult[]> {
    const promises = [
      // Run legacy system
      legacyCallback(gameState).catch(error => {
        console.error('Legacy system error:', error);
        return [];
      }),
      
      // Run event stream system
      this.processWithEventStream(gameState).catch(error => {
        console.error('Event stream system error:', error);
        return [];
      })
    ];
    
    const [legacyResults, eventStreamResults] = await Promise.all(promises);
    
    // Compare results
    if (this.config.enableComparison) {
      await this.compareResults(gameState.gameId, legacyResults, eventStreamResults);
    }
    
    // Return legacy results (shadow mode - no user impact)
    return legacyResults;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.lastActivity = Date.now();
    this.metrics.bridgeUptime = Date.now() - this.startTime;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.metrics.bridgeUptime = Date.now() - this.startTime;
      this.emit('metrics_update', this.metrics);
    }, 30000); // Every 30 seconds
  }

  /**
   * Public API methods
   */

  getMetrics(): LegacyBridgeMetrics {
    return { ...this.metrics };
  }

  getComparisonResults(): ComparisonResult[] {
    return [...this.comparisonResults];
  }

  getRecentComparisons(count = 10): ComparisonResult[] {
    return this.comparisonResults.slice(-count);
  }

  getDiscrepancies(): ComparisonResult[] {
    return this.comparisonResults.filter(r => !r.matches);
  }

  clearComparisonResults(): void {
    this.comparisonResults.length = 0;
    console.log('🧹 Cleared comparison results');
  }

  async enableActiveMode(): Promise<void> {
    if (!this.mlbProcessor) return;
    
    console.log('🚀 Transitioning to ACTIVE MODE - event stream will handle alerts');
    
    // Disable shadow mode on processor
    await this.mlbProcessor.configure({
      ...this.mlbProcessor.getStats(),
      shadowMode: false
    } as any);
    
    this.metrics.shadowModeActive = false;
  }

  async enableShadowMode(): Promise<void> {
    if (!this.mlbProcessor) return;
    
    console.log('🌟 Returning to SHADOW MODE - legacy system will handle alerts');
    
    // Enable shadow mode on processor
    await this.mlbProcessor.configure({
      ...this.mlbProcessor.getStats(),
      shadowMode: true
    } as any);
    
    this.metrics.shadowModeActive = true;
  }

  isShadowModeActive(): boolean {
    return this.metrics.shadowModeActive;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check event stream health
      const eventStreamHealthy = this.eventStream && this.eventStream.getMetrics;
      
      // Check processor health
      const processorHealthy = this.mlbProcessor ? await this.mlbProcessor.healthCheck() : false;
      
      return eventStreamHealthy && processorHealthy;
    } catch (error) {
      console.error('💥 Legacy Bridge health check failed:', error);
      return false;
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Legacy Bridge...');
    
    // Stop event stream
    if (this.eventStream && this.eventStream.stop) {
      await this.eventStream.stop();
    }
    
    // Clear intervals and cleanup
    this.removeAllListeners();
    
    console.log('✅ Legacy Bridge stopped');
  }
}

/**
 * Bridge Factory - Creates and manages bridge instances
 */
export class BridgeFactory {
  private static instances = new Map<string, LegacyBridge>();
  
  /**
   * Get or create a bridge instance
   */
  static async getBridge(
    id: string = 'main',
    config?: Partial<LegacyBridgeConfig>
  ): Promise<LegacyBridge> {
    if (!this.instances.has(id)) {
      const bridge = new LegacyBridge(config);
      await bridge.initialize();
      this.instances.set(id, bridge);
    }
    
    return this.instances.get(id)!;
  }

  /**
   * Stop all bridges
   */
  static async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.instances.values()).map(bridge => bridge.stop());
    await Promise.all(stopPromises);
    this.instances.clear();
  }

  /**
   * Get all bridge metrics
   */
  static getAllMetrics(): Record<string, LegacyBridgeMetrics> {
    const metrics: Record<string, LegacyBridgeMetrics> = {};
    
    for (const [id, bridge] of this.instances.entries()) {
      metrics[id] = bridge.getMetrics();
    }
    
    return metrics;
  }
}

// Export singleton bridge instance
export let legacyBridge: LegacyBridge | null = null;

export async function getLegacyBridge(config?: Partial<LegacyBridgeConfig>): Promise<LegacyBridge> {
  if (!legacyBridge) {
    legacyBridge = await BridgeFactory.getBridge('main', config);
  }
  return legacyBridge;
}

/**
 * Utility function to create a GameStateChangedEvent from game state
 */
export function createGameStateChangedEvent(
  gameState: GameState,
  previousState?: GameState,
  changes: string[] = []
): GameStateChangedEvent {
  return gameStateToEvent(gameState, previousState || null, changes);
}

/**
 * Utility function to determine what changed between game states
 */
export function detectGameStateChanges(
  currentState: GameState,
  previousState?: GameState
): string[] {
  if (!previousState) return ['initial_state'];
  
  const changes: string[] = [];
  
  // Check score changes
  if (currentState.homeScore !== previousState.homeScore) {
    changes.push('home_score');
  }
  if (currentState.awayScore !== previousState.awayScore) {
    changes.push('away_score');
  }
  
  // Check status changes
  if (currentState.status !== previousState.status) {
    changes.push('status');
  }
  
  // Check inning changes
  if (currentState.inning !== previousState.inning) {
    changes.push('inning');
  }
  
  // Check outs changes
  if (currentState.outs !== previousState.outs) {
    changes.push('outs');
  }
  
  // Check base runner changes
  if (currentState.hasFirst !== previousState.hasFirst) {
    changes.push('first_base');
  }
  if (currentState.hasSecond !== previousState.hasSecond) {
    changes.push('second_base');
  }
  if (currentState.hasThird !== previousState.hasThird) {
    changes.push('third_base');
  }
  
  // Check count changes
  if (currentState.balls !== previousState.balls) {
    changes.push('balls');
  }
  if (currentState.strikes !== previousState.strikes) {
    changes.push('strikes');
  }
  
  return changes;
}