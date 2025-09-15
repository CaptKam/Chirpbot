import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class MLBEngine extends BaseSportEngine {
  private lineMovementCache: Map<string, any> = new Map(); // Track line movements

  // Deduplication tracking - tracks sent alerts to prevent duplicates
  private sentAlerts: Map<string, Set<string>> = new Map(); // gameId -> Set of alertKeys
  private alertTimestamps: Map<string, number> = new Map(); // alertKey -> timestamp
  private lastCleanup: number = Date.now();
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes cooldown per alert
  private readonly CLEANUP_INTERVAL_MS = 600000; // Clean up old entries every 10 minutes
  private readonly MAX_ALERTS_PER_GAME = 50; // Prevent memory overload per game

  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    probabilityCalculationTime: [] as number[],
    gameStateEnhancementTime: [] as number[],
    basesLoadedSituations: 0,
    seventhInningDetections: 0,
    runnerScoringOpportunities: 0,
    duplicatesBlocked: 0,
    alertsSent: 0
  };

  constructor() {
    super('MLB');
  }

  /**
   * Check if an alert has already been sent recently
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    // Check if this exact alert was sent recently
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.performanceMetrics.duplicatesBlocked++;
      console.log(`🚫 MLB Duplicate blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }

    // Check if we've sent too many alerts for this game
    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= this.MAX_ALERTS_PER_GAME) {
      console.log(`⚠️ MLB Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
      return true;
    }

    return false;
  }

  /**
   * Mark an alert as sent
   */
  private markAlertSent(gameId: string, alertKey: string): void {
    // Track by game
    if (!this.sentAlerts.has(gameId)) {
      this.sentAlerts.set(gameId, new Set());
    }
    this.sentAlerts.get(gameId)!.add(alertKey);

    // Track timestamp
    this.alertTimestamps.set(alertKey, Date.now());
    this.performanceMetrics.alertsSent++;

    console.log(`✅ MLB Alert tracked: ${alertKey} for game ${gameId}`);

    // Periodic cleanup to prevent memory leaks
    this.cleanupOldAlerts();
  }

  /**
   * Clean up old alert tracking data to prevent memory leaks
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();

    // Only run cleanup periodically
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) {
      return;
    }

    console.log(`🧹 MLB Alert cleanup: Removing alerts older than ${this.ALERT_COOLDOWN_MS}ms`);

    // Clean up old timestamps
    let removedCount = 0;
    for (const [alertKey, timestamp] of this.alertTimestamps.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN_MS) {
        this.alertTimestamps.delete(alertKey);
        removedCount++;
      }
    }

    // Clean up game tracking for finished games (no alerts in last hour)
    const oneHourAgo = now - 3600000;
    for (const [gameId, alerts] of this.sentAlerts.entries()) {
      let hasRecentAlert = false;
      for (const alertKey of alerts) {
        const timestamp = this.alertTimestamps.get(alertKey);
        if (timestamp && timestamp > oneHourAgo) {
          hasRecentAlert = true;
          break;
        }
      }

      if (!hasRecentAlert) {
        this.sentAlerts.delete(gameId);
        console.log(`🧹 MLB Removed tracking for game ${gameId}`);
      }
    }

    this.lastCleanup = now;
    console.log(`🧹 MLB Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual MLB alert types that have corresponding modules
      const validMLBAlerts = [
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
        'TEST_ALERT'
      ];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      const { inning, outs, homeScore, awayScore } = gameState;

      let probability = 40; // Base probability

    // Simple inning adjustments
    if (inning >= 7) probability += 20; // Late innings are more exciting
    else if (inning >= 4) probability += 10; // Middle innings
    else probability += 5; // Early innings

    // Outs situation - simple rules
    if (outs === 0) probability += 20; // No outs - high potential
    else if (outs === 1) probability += 10; // One out - still good
    else probability += 5; // Two outs - pressure but still possible

    // Score differential
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 1) probability += 25; // Very close game
    else if (scoreDiff <= 3) probability += 15; // Close game
    else if (scoreDiff <= 6) probability += 5; // Moderately competitive
    else probability -= 10; // Blowout

    // Simple base runner boost
    let runnerBonus = 0;
    if (gameState.hasThird) runnerBonus += 15; // Runner on third
    if (gameState.hasSecond) runnerBonus += 10; // Runner on second
    if (gameState.hasFirst) runnerBonus += 5; // Runner on first

    probability += runnerBonus;

    // Keep probability within reasonable bounds
    return Math.min(Math.max(probability, 15), 90);
    } finally {
      // Track performance metrics
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      this.performanceMetrics.totalRequests++;

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.probabilityCalculationTime.length > 100) {
        this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-100);
      }
    }
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();

    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ MLB: No gameId provided, skipping alert generation');
        console.log('⚠️ MLB: GameState received:', JSON.stringify({
          id: gameState.id,
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          isLive: gameState.isLive,
          status: gameState.status
        }, null, 2));
        return [];
      }

      console.log(`🎯 MLB: Processing game ${gameState.gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      console.log(`🎯 MLB: Status=${gameState.status}, isLive=${gameState.isLive}, inning=${gameState.inning}`)

      // Enhance game state with MLB-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);

      // ✅ SEND RAW ALERTS TO ASYNCAI PROCESSOR FOR ENHANCEMENT FIRST
      // Process ALL generated alerts through AI enhancement before deduplication
      if (rawAlerts.length > 0) {
        console.log(`🔄 MLB: Sending ${rawAlerts.length} raw alerts to AsyncAI processor for enhancement`);
        const { unifiedAIProcessor } = await import('../unified-ai-processor');

        // Send each raw alert to AsyncAI processor with proper context
        for (const alert of rawAlerts) {
          const context: CrossSportContext = {
            sport: 'MLB' as const,
            alertType: alert.type,
            gameId: enhancedGameState.gameId,
            priority: alert.priority || 75,
            probability: alert.priority || 75,
            homeTeam: enhancedGameState.homeTeam || 'Home',
            awayTeam: enhancedGameState.awayTeam || 'Away',
            homeScore: enhancedGameState.homeScore || 0,
            awayScore: enhancedGameState.awayScore || 0,
            isLive: enhancedGameState.isLive || false,
            inning: enhancedGameState.inning || 1,
            outs: enhancedGameState.outs || 0,
            balls: enhancedGameState.balls || 0,
            strikes: enhancedGameState.strikes || 0,
            baseRunners: {
              first: enhancedGameState.hasFirst || false,
              second: enhancedGameState.hasSecond || false,
              third: enhancedGameState.hasThird || false
            },
            originalMessage: alert.message,
            originalContext: alert.context
          };

          console.log(`🎯 MLB AsyncAI: Queuing ${alert.type} alert for enhancement`);
          // NON-BLOCKING: Queue for AI enhancement in background
          unifiedAIProcessor.queueAlert(alert, context, enhancedGameState.gameId).catch(error => {
            console.warn(`⚠️ MLB AI Queue failed for ${alert.type}:`, error);
          });
        }
      } else {
        console.log(`🔄 MLB: No alerts generated for game ${enhancedGameState.gameId}`);
      }

      // Track MLB-specific metrics
      if (enhancedGameState.hasFirst && enhancedGameState.hasSecond && enhancedGameState.hasThird) {
        this.performanceMetrics.basesLoadedSituations++;
      }
      if (enhancedGameState.inning === 7) {
        this.performanceMetrics.seventhInningDetections++;
      }
      if (enhancedGameState.hasThird && enhancedGameState.outs <= 1) {
        this.performanceMetrics.runnerScoringOpportunities++;
      }

      this.performanceMetrics.totalAlerts += rawAlerts.length;

      // Return raw alerts for tracking (AsyncAI will handle the actual broadcasting)
      return rawAlerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();

    try {
      console.log(`🔧 MLB Enhancement: Game ${gameState.gameId} - status=${gameState.status}, isLive=${gameState.isLive}`);

      // Get live data from MLB API for any non-final game (fixes catch-22 gating loop)
      if (gameState.gameId && gameState.status !== 'final') {
        console.log(`✅ MLB Enhancement: Fetching enhanced data for non-final game ${gameState.gameId}`);
        const { MLBApiService } = await import('../mlb-api');
        const mlbApi = new MLBApiService();
        const enhancedData = await mlbApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          this.performanceMetrics.cacheHits++;
          // Fetch weather data if available
          let weatherContext = gameState.weatherContext;
          try {
            const { weatherAlertIntegration } = await import('../weather-alert-integration');
            // Get weather for home team (where game is played)
            const weatherData = await weatherAlertIntegration.getWeatherForTeam(
              gameState.homeTeam
            );
            if (weatherData) {
              weatherContext = {
                windSpeed: weatherData.windSpeed,
                windDirection: weatherData.windDirection,
                temperature: weatherData.temperature,
                humidity: weatherData.humidity
              };
            }
          } catch (error) {
            // Weather fetch failed, continue without it
          }

          const enhancedGameState = {
            ...gameState,
            hasFirst: enhancedData.runners?.first || false,
            hasSecond: enhancedData.runners?.second || false,
            hasThird: enhancedData.runners?.third || false,
            balls: enhancedData.balls || 0,
            strikes: enhancedData.strikes || 0,
            outs: enhancedData.outs || 0,
            inning: enhancedData.inning || gameState.inning || 1,
            isTopInning: enhancedData.isTopInning,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            currentBatter: enhancedData.currentBatter || gameState.currentBatter,
            currentPitcher: enhancedData.currentPitcher || gameState.currentPitcher,
            onDeckBatter: enhancedData.onDeckBatter || gameState.onDeckBatter,
            weatherContext,
            // Respect original game status - only force false for finished games, preserve original live state
            isLive: gameState.status === 'final' ? false : gameState.isLive
          };
          console.log(`🚀 MLB Enhancement: Game ${gameState.gameId} enhanced - isLive=${enhancedGameState.isLive}, runners=[${enhancedGameState.hasFirst ? '1B' : ''}${enhancedGameState.hasSecond ? '2B' : ''}${enhancedGameState.hasThird ? '3B' : ''}], outs=${enhancedGameState.outs}, inning=${enhancedGameState.inning}`);
          return enhancedGameState;
        } else {
          this.performanceMetrics.cacheMisses++;
        }
      }
    } catch (error) {
      console.error('Error enhancing game state with live data:', error);
      this.performanceMetrics.cacheMisses++;
    } finally {
      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.gameStateEnhancementTime.length > 100) {
        this.performanceMetrics.gameStateEnhancementTime = this.performanceMetrics.gameStateEnhancementTime.slice(-100);
      }
    }

    return gameState;
  }

  // Process alerts with cross-sport AI enhancement for high-priority MLB situations
  private async processEnhancedMLBAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Process all alerts for AI enhancement to ensure maximum coverage
        const probability = await this.calculateProbability(gameState);

        console.log(`🧠 MLB AI Enhancement: Processing ${alert.type} alert (${probability}%)`);

        // Build cross-sport context for MLB
        const aiContext: CrossSportContext = {
            sport: 'MLB',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            inning: gameState.inning,
            outs: gameState.outs,
            balls: gameState.balls,
            strikes: gameState.strikes,
            baseRunners: {
              first: gameState.hasFirst || false,
              second: gameState.hasSecond || false,
              third: gameState.hasThird || false
            },
            originalMessage: alert.message,
            originalContext: alert.context
          };

        // NON-BLOCKING: Queue for async AI enhancement and return base alert immediately
        unifiedAIProcessor.queueAlert(alert, aiContext, 'system').catch(error => {
          console.warn(`⚠️ MLB AI Queue failed for ${alert.type}:`, error);
        });
        console.log(`🚀 MLB Async AI: Queued ${alert.type} for background enhancement`);

        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ MLB AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ MLB AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'MLB' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'MLB');
      console.log(`📋 MLB User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ MLB Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid MLB alerts that have corresponding module files
      const validMLBAlerts = [
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
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE',
        'MLB_LATE_INNING_CLOSE',
        'MLB_SCORING_OPPORTUNITY',
        'MLB_PITCHING_CHANGE',
        'MLB_FIRST_AND_THIRD_ONE_OUT',
        'MLB_FIRST_AND_THIRD_TWO_OUTS',
        'MLB_RUNNER_ON_THIRD_TWO_OUTS',
        'MLB_BASES_LOADED_TWO_OUTS',
        'TEST_ALERT'
      ];

      const mlbEnabledTypes = enabledTypes.filter(alertType =>
        validMLBAlerts.includes(alertType)
      );

      // Check global settings for these MLB alerts
      const globallyEnabledTypes = [];
      for (const alertType of mlbEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 MLB Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing MLB engine for user ${userId} with ${globallyEnabledTypes.length} MLB alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the MLB alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'MLB_GAME_START': './alert-cylinders/mlb/game-start-module.ts',
        'MLB_SEVENTH_INNING_STRETCH': './alert-cylinders/mlb/seventh-inning-stretch-module.ts',
        'MLB_BASES_LOADED_ONE_OUT': './alert-cylinders/mlb/bases-loaded-one-out-module.ts',
        'MLB_RUNNER_ON_THIRD_NO_OUTS': './alert-cylinders/mlb/runner-on-third-no-outs-module.ts',
        'MLB_FIRST_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/first-and-third-no-outs-module.ts',
        'MLB_SECOND_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/second-and-third-no-outs-module.ts',
        'MLB_BASES_LOADED_NO_OUTS': './alert-cylinders/mlb/bases-loaded-no-outs-module.ts',
        'MLB_RUNNER_ON_THIRD_ONE_OUT': './alert-cylinders/mlb/runner-on-third-one-out-module.ts',
        'MLB_FIRST_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/first-and-third-one-out-module.ts',
        'MLB_SECOND_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/second-and-third-one-out-module.ts',
        'MLB_RUNNER_ON_THIRD_TWO_OUTS': './alert-cylinders/mlb/runner-on-third-two-outs-module.ts',
        'MLB_FIRST_AND_THIRD_TWO_OUTS': './alert-cylinders/mlb/first-and-third-two-outs-module.ts',
        'MLB_RUNNER_ON_SECOND_NO_OUTS': './alert-cylinders/mlb/runner-on-second-no-outs-module.ts',
        'MLB_BATTER_DUE': './alert-cylinders/mlb/batter-due-module.ts',
        'MLB_STEAL_LIKELIHOOD': './alert-cylinders/mlb/steal-likelihood-module.ts',
        'MLB_ON_DECK_PREDICTION': './alert-cylinders/mlb/on-deck-prediction-module.ts',
        'MLB_WIND_CHANGE': './alert-cylinders/mlb/wind-change-module.ts',
        'MLB_FIRST_AND_SECOND': './alert-cylinders/mlb/first-and-second-module.ts',
        'MLB_LATE_INNING_CLOSE': './alert-cylinders/mlb/late-inning-close-module.ts',
        'MLB_SCORING_OPPORTUNITY': './alert-cylinders/mlb/scoring-opportunity-module.ts',
        'MLB_PITCHING_CHANGE': './alert-cylinders/mlb/pitching-change-module.ts',
        'MLB_BASES_LOADED_TWO_OUTS': './alert-cylinders/mlb/bases-loaded-two-outs-module.ts',
        'TEST_ALERT': './alert-cylinders/test-alert-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No MLB module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const instance = new module.default();
      console.log(`✅ MLB ENGINE: Successfully registered alert module: ${alertType} from ${modulePath}`);
      return instance;
    } catch (error) {
      console.error(`❌ Failed to load MLB alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);

    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 MLB alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }

    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared MLB alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded MLB alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} MLB alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  /**
   * Compose time-based, actionable alerts using AlertComposer
   */
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const composedAlerts: AlertResult[] = [];

    for (const alert of alerts) {
      try {
        // Generate enhanced payload with time-sensitive intelligence
        const enhancedPayload = await alertComposer.composeEnhancedAlert(alert, gameState, {
          // Add any MLB-specific context
          recentLineMovement: this.getRecentLineMovement(gameState),
          sharpMoney: this.getSharpMoneyIndicator(gameState)
        });

        // Create enhanced alert with rich messaging
        const enhancedAlert: AlertResult = {
          ...alert,
          message: enhancedPayload.headline,
          context: {
            ...alert.context,
            enhanced: enhancedPayload,
            displayText: alertComposer.formatForDisplay(enhancedPayload),
            mobileText: alertComposer.formatForMobileNotification(enhancedPayload),
            timing: enhancedPayload.timing,
            action: enhancedPayload.action,
            insight: enhancedPayload.insight,
            riskReward: enhancedPayload.riskReward
          }
        };

        composedAlerts.push(enhancedAlert);
        console.log(`⚡ MLB Alert Composed: ${alert.type} - ${enhancedPayload.timing.urgencyLevel} priority`);
      } catch (error) {
        console.error(`Failed to compose MLB alert:`, error);
        composedAlerts.push(alert); // Fallback to original
      }
    }

    return composedAlerts;
  }

  /**
   * Get recent line movement for context
   */
  private getRecentLineMovement(gameState: GameState): any {
    // In production, this would connect to real-time odds feeds
    // For now, simulate based on game state
    const key = `${gameState.gameId}_line`;
    const previous = this.lineMovementCache.get(key);
    const current = {
      total: gameState.homeScore + gameState.awayScore,
      spread: gameState.homeScore - gameState.awayScore,
      timestamp: Date.now()
    };

    if (previous && (current.timestamp - previous.timestamp) < 60000) {
      const totalMove = current.total - previous.total;
      const spreadMove = current.spread - previous.spread;

      if (Math.abs(totalMove) >= 0.5 || Math.abs(spreadMove) >= 0.5) {
        this.lineMovementCache.set(key, current);
        return {
          totalMove,
          spreadMove,
          timeAgo: Math.floor((current.timestamp - previous.timestamp) / 1000)
        };
      }
    }

    this.lineMovementCache.set(key, current);
    return null;
  }

  /**
   * Get sharp money indicators
   */
  private getSharpMoneyIndicator(gameState: GameState): any {
    // In production, this would use real betting data
    // Simulate based on game flow
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inning = gameState.inning || 1;

    if (scoreDiff <= 1 && inning >= 7) {
      return { indicator: 'heavy', direction: 'over', confidence: 85 };
    }
    if (gameState.hasFirst && gameState.hasSecond && gameState.hasThird) {
      return { indicator: 'moderate', direction: 'over', confidence: 70 };
    }

    return null;
  }

  // Get performance metrics for V3 dashboard
  // Send alerts to Telegram for users with notifications enabled
  // Note: WebSocket broadcasting removed - alerts now only go through AsyncAI processor for enhancement
  private async deliverAlertsToAllChannels(alerts: AlertResult[], gameState: GameState): Promise<void> {
    if (!alerts || alerts.length === 0) return;

    try {
      console.log(`🚀 Delivering ${alerts.length} MLB alerts to Telegram (WebSocket handled by AsyncAI processor)`);

      // Only Telegram delivery - WebSocket broadcasting removed to prevent duplicates
      await this.deliverAlertsToTelegram(alerts, gameState);

      console.log(`✅ Telegram delivery complete for ${alerts.length} alerts`);

    } catch (error) {
      console.error('❌ Alert delivery system error:', error);
    }
  }

  // REMOVED: WebSocket delivery method - prevents duplicate alerts
  // WebSocket broadcasting now handled exclusively by AsyncAI processor in routes.ts
  // This ensures all alerts go through AI enhancement before being broadcast
  // 
  // private async deliverAlertsToWebSocket(alerts: AlertResult[], gameState: GameState): Promise<void> {
  //   // Method removed to prevent duplicate WebSocket broadcasts
  //   // All WebSocket delivery now handled by AsyncAI processor for proper enhancement
  // }

  private async deliverAlertsToTelegram(alerts: AlertResult[], gameState: GameState): Promise<void> {
    try {
      // Get all users with Telegram enabled
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(user => 
        user.telegramEnabled && 
        user.telegramBotToken && 
        user.telegramChatId &&
        user.telegramBotToken !== 'default_key' &&
        user.telegramChatId !== 'test-chat-id'
      );

      if (telegramUsers.length === 0) {
        console.log('📱 ℹ️ No users with valid Telegram configurations found');
        return;
      }

      console.log(`📱 🚀 Delivering ${alerts.length} MLB alerts to ${telegramUsers.length} Telegram users`);

      // Send alerts to each user
      for (const alert of alerts) {
        // Double-check alert hasn't been sent (extra safety)
        const telegramKey = `telegram_${alert.alertKey}`;
        if (this.hasAlertBeenSent(gameState.gameId, telegramKey)) {
          console.log(`📱 🚫 Telegram alert already sent: ${telegramKey}`);
          continue;
        }

        for (const user of telegramUsers) {
          try {
            const telegramConfig: TelegramConfig = {
              botToken: user.telegramBotToken!,
              chatId: user.telegramChatId!
            };

            const telegramAlert = {
              id: alert.alertKey,
              type: alert.type,
              title: alert.message.split('|')[0].trim(),
              description: alert.message,
              gameInfo: {
                sport: 'MLB',
                awayTeam: gameState.awayTeam,
                homeTeam: gameState.homeTeam,
                awayScore: gameState.awayScore,
                homeScore: gameState.homeScore,
                score: {
                  away: gameState.awayScore,
                  home: gameState.homeScore
                },
                inning: gameState.inning,
                inningState: gameState.isTopInning ? 'top' : 'bottom',
                outs: gameState.outs,
                balls: gameState.balls,
                strikes: gameState.strikes,
                runners: {
                  first: gameState.hasFirst,
                  second: gameState.hasSecond,
                  third: gameState.hasThird
                }
              }
            };

            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);

            if (sent) {
              console.log(`📱 ✅ Sent ${alert.type} alert to ${user.username || user.id}`);
              // Mark this specific telegram alert as sent after successful delivery
              this.markAlertSent(gameState.gameId, telegramKey);
            } else {
              console.log(`📱 ❌ Failed to send ${alert.type} alert to ${user.username || user.id}`);
            }
          } catch (error) {
            console.error(`📱 ❌ Telegram delivery error for user ${user.username || user.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('📱 ❌ Telegram delivery system error:', error);
    }
  }

  getPerformanceMetrics() {
    const avgCalculationTime = this.performanceMetrics.probabilityCalculationTime.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;

    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
      : 0;

    const avgEnhanceTime = this.performanceMetrics.gameStateEnhancementTime.length > 0
      ? this.performanceMetrics.gameStateEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.gameStateEnhancementTime.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    const deduplicationRate = this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked > 0
      ? (this.performanceMetrics.duplicatesBlocked / (this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked)) * 100
      : 0;

    return {
      sport: 'MLB',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        cacheHitRate,
        deduplicationRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        alertsSent: this.performanceMetrics.alertsSent,
        duplicatesBlocked: this.performanceMetrics.duplicatesBlocked,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        basesLoadedSituations: this.performanceMetrics.basesLoadedSituations,
        seventhInningDetections: this.performanceMetrics.seventhInningDetections,
        runnerScoringOpportunities: this.performanceMetrics.runnerScoringOpportunities,
        activeGameTracking: this.sentAlerts.size,
        totalTrackedAlerts: this.alertTimestamps.size
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20)
      }
    };
  }
}