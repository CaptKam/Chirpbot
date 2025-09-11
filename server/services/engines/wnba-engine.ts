
import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { asyncAIProcessor } from '../async-ai-processor';
import { CrossSportContext } from '../cross-sport-ai-enhancement';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class WNBAEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
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
    clutchTimeDetections: 0,
    fourthQuarterSituations: 0,
    overtimeDetections: 0,
    duplicatesBlocked: 0,
    alertsSent: 0
  };

  constructor() {
    super('WNBA');
    this.settingsCache = new SettingsCache(storage);
  }
  
  /**
   * Check if an alert has already been sent recently
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    // Check if this exact alert was sent recently
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.performanceMetrics.duplicatesBlocked++;
      console.log(`🚫 WNBA Duplicate blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }
    
    // Check if we've sent too many alerts for this game
    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= this.MAX_ALERTS_PER_GAME) {
      console.log(`⚠️ WNBA Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
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
    
    console.log(`✅ WNBA Alert tracked: ${alertKey} for game ${gameId}`);
    
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
    
    console.log(`🧹 WNBA Alert cleanup: Removing alerts older than ${this.ALERT_COOLDOWN_MS}ms`);
    
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
        console.log(`🧹 WNBA Removed tracking for game ${gameId}`);
      }
    }
    
    this.lastCleanup = now;
    console.log(`🧹 WNBA Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual WNBA alert types
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER',
        // V3-10: New WNBA predictive alert types
        'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL',
        'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ];

      if (!validWNBAAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid WNBA alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`WNBA Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();
    
    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability
      
      // Enhanced WNBA-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, homeScore, awayScore, possession } = gameState;

      // Quarter-specific adjustments (optimized calculation)
      if (quarter === 1) probability += 10; // First quarter action
      else if (quarter === 2) probability += 12; // Second quarter momentum
      else if (quarter === 3) probability += 14; // Third quarter adjustments
      else if (quarter === 4) probability += 20; // Fourth quarter drama
      else if (quarter >= 5) probability += 30; // Overtime intensity

      // Time factors (optimized time parsing)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 60 && (quarter >= 4)) {
          probability += 25; // Final minute crunch time
        } else if (timeSeconds <= 120 && (quarter >= 4)) {
          probability += 18; // Final two minutes
        } else if (timeSeconds <= 300 && (quarter >= 4)) {
          probability += 12; // Final 5 minutes
        }
        
        // Shot clock scenarios (24-second WNBA shot clock)
        if (timeSeconds % 24 <= 5 && quarter >= 3) {
          probability += 8; // Shot clock pressure
        }
      }

      // Score differential (quick calculation)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 2) probability += 25; // Very close game (WNBA pace)
        else if (scoreDiff <= 5) probability += 18; // Close game
        else if (scoreDiff <= 10) probability += 10; // Competitive game
        else if (scoreDiff <= 15) probability += 5; // Moderately competitive
        else if (scoreDiff >= 20) probability -= 15; // Blowout
        
        // High-scoring game bonus (WNBA average ~85 points per team)
        const totalScore = homeScore + awayScore;
        if (totalScore >= 160 && quarter >= 3) probability += 12; // High-scoring
        else if (totalScore >= 140 && quarter >= 3) probability += 8; // Above average
        else if (totalScore <= 120 && quarter >= 3) probability += 6; // Defensive battle
      }

      // Possession and momentum factors
      if (possession && quarter >= 3) {
        probability += 3; // Possession adds context in later quarters
      }

      // Basketball-specific situational boosts
      if (quarter >= 4) {
        // Fourth quarter and overtime get extra weight
        if (homeScore !== undefined && awayScore !== undefined) {
          const scoreDiff = Math.abs(homeScore - awayScore);
          if (scoreDiff <= 8) probability += 15; // One possession games are crucial
        }
      }

      const finalProbability = Math.min(Math.max(probability, 10), 95);
      
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      
      if (calculationTime > 50) {
        console.log(`⚠️ WNBA Slow probability calculation: ${calculationTime}ms for game ${gameState.gameId}`);
      }
      
      return finalProbability;
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      console.error(`❌ WNBA Probability calculation failed after ${calculationTime}ms:`, error);
      return 50; // Safe fallback
    }
  }

  // Override to add WNBA-specific game state enhancement and performance monitoring
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    
    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ WNBA: No gameId provided, skipping alert generation');
        return [];
      }
      
      // Enhance game state with WNBA-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      
      // Filter out duplicate alerts before processing
      const dedupedAlerts: AlertResult[] = [];
      for (const alert of rawAlerts) {
        // Check if this alert has already been sent
        if (!this.hasAlertBeenSent(enhancedGameState.gameId, alert.alertKey)) {
          dedupedAlerts.push(alert);
          // Mark as sent immediately to prevent duplicates in same processing cycle
          this.markAlertSent(enhancedGameState.gameId, alert.alertKey);
        }
      }
      
      // If all alerts were duplicates, return early
      if (dedupedAlerts.length === 0) {
        console.log(`🔄 WNBA: All ${rawAlerts.length} alerts were duplicates for game ${enhancedGameState.gameId}`);
        return [];
      }
      
      console.log(`✅ WNBA: Processing ${dedupedAlerts.length} new alerts (blocked ${rawAlerts.length - dedupedAlerts.length} duplicates)`);
      
      // Enhance alerts with time-sensitive intelligence via AlertComposer
      const composedAlerts = await this.composeTimeBasedAlerts(dedupedAlerts, enhancedGameState);
      
      // Process alerts with cross-sport AI enhancement for high-priority WNBA situations
      const alerts = await this.processEnhancedWNBAAlerts(composedAlerts, enhancedGameState);
      
      // Track WNBA-specific metrics
      if (enhancedGameState.quarter === 4) {
        this.performanceMetrics.fourthQuarterSituations++;
      }
      if (enhancedGameState.quarter >= 5) {
        this.performanceMetrics.overtimeDetections++;
      }
      const timeSeconds = this.parseTimeToSeconds(enhancedGameState.timeRemaining || '');
      if (enhancedGameState.quarter >= 4 && timeSeconds <= 300) {
        this.performanceMetrics.clutchTimeDetections++;
      }
      
      this.performanceMetrics.totalAlerts += alerts.length;
      
      // Send alerts to both WebSocket and Telegram simultaneously (already deduplicated)
      await this.deliverAlertsToAllChannels(alerts, enhancedGameState);
      
      return alerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      this.performanceMetrics.totalRequests++;
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      // Get live data from WNBA API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { WNBAApiService } = await import('../wnba-api');
        const wnbaApi = new WNBAApiService();
        const enhancedData = await wnbaApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          return {
            ...gameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
            possession: enhancedData.possession || null,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            // WNBA-specific fields
            period: enhancedData.period || gameState.quarter,
            clock: enhancedData.clock || gameState.timeRemaining,
            situation: enhancedData.situation || {}
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing WNBA game state with live data:', error);
    }

    return gameState;
  }

  // Process alerts with cross-sport AI enhancement for high-priority WNBA situations
  private async processEnhancedWNBAAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Only enhance high-priority alerts (>= 85 probability)
        const probability = await this.calculateProbability(gameState);
        
        if (probability >= 85) {
          console.log(`🧠 WNBA AI Enhancement: Processing ${alert.type} alert (${probability}%)`);
          
          // Build cross-sport context for WNBA
          const aiContext: CrossSportContext = {
            sport: 'WNBA',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            quarter: gameState.quarter,
            timeRemaining: gameState.timeRemaining,
            timeLeft: gameState.timeRemaining,
            shotClock: (gameState as any).shotClock || 24,
            fouls: {
              home: (gameState as any).homeFouls || 0,
              away: (gameState as any).awayFouls || 0
            },
            possession: gameState.possession,
            originalMessage: alert.message,
            originalContext: alert.context
          };

          // Queue for async AI enhancement (non-blocking) and return base alert immediately
          await asyncAIProcessor.queueAlertForEnhancement(alert, aiContext, 'system');
          console.log(`🚀 WNBA Async AI: Queued ${alert.type} for background enhancement`);
        }
        
        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ WNBA AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ WNBA AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
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
          // Add any WNBA-specific context
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
        console.log(`⚡ WNBA Alert Composed: ${alert.type} - ${enhancedPayload.timing.urgencyLevel} priority`);
      } catch (error) {
        console.error(`Failed to compose WNBA alert:`, error);
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
    // Simulate based on game flow for WNBA
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const quarter = gameState.quarter || 1;
    
    if (scoreDiff <= 2 && quarter >= 4) {
      return { indicator: 'heavy', direction: 'over', confidence: 85 };
    }
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '');
    if (quarter >= 4 && timeSeconds <= 120) {
      return { indicator: 'moderate', direction: 'over', confidence: 70 };
    }
    
    return null;
  }

  // Send alerts to both WebSocket and Telegram simultaneously
  private async deliverAlertsToAllChannels(alerts: AlertResult[], gameState: GameState): Promise<void> {
    if (!alerts || alerts.length === 0) return;
    
    try {
      console.log(`🚀 Simultaneously delivering ${alerts.length} WNBA alerts to WebSocket and Telegram`);
      
      // Create delivery promises for parallel execution
      const deliveryPromises: Promise<void>[] = [];
      
      // 1. WebSocket delivery promise
      deliveryPromises.push(this.deliverAlertsToWebSocket(alerts, gameState));
      
      // 2. Telegram delivery promise
      deliveryPromises.push(this.deliverAlertsToTelegram(alerts, gameState));
      
      // Execute both deliveries simultaneously
      await Promise.all(deliveryPromises);
      
      console.log(`✅ Synchronized delivery complete for ${alerts.length} alerts`);
      
    } catch (error) {
      console.error('❌ Synchronized alert delivery system error:', error);
    }
  }

  private async deliverAlertsToWebSocket(alerts: AlertResult[], gameState: GameState): Promise<void> {
    try {
      const wsBroadcast = (global as any).wsBroadcast;
      if (!wsBroadcast) {
        console.warn('📡 WebSocket broadcast function not available');
        return;
      }

      for (const alert of alerts) {
        const alertData = {
          type: 'new_alert',
          data: {
            id: alert.alertKey,
            type: alert.type,
            sport: 'WNBA',
            priority: alert.priority,
            message: alert.message,
            context: alert.context,
            gameId: gameState.gameId,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter: gameState.quarter,
            timeRemaining: gameState.timeRemaining,
            possession: gameState.possession,
            shotClock: (gameState as any).shotClock || 24,
            fouls: {
              home: (gameState as any).homeFouls || 0,
              away: (gameState as any).awayFouls || 0
            },
            timestamp: new Date().toISOString()
          }
        };

        wsBroadcast(alertData);
        console.log(`📡 ✅ WebSocket: ${alert.type} alert broadcasted`);
      }
    } catch (error) {
      console.error('📡 ❌ WebSocket delivery error:', error);
    }
  }

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
      
      console.log(`📱 🚀 Delivering ${alerts.length} WNBA alerts to ${telegramUsers.length} Telegram users`);
      
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
              title: alert.message.split('|')[0].trim(), // Extract title from message
              description: alert.message,
              gameInfo: {
                awayTeam: gameState.awayTeam,
                homeTeam: gameState.homeTeam,
                score: {
                  away: gameState.awayScore,
                  home: gameState.homeScore
                },
                quarter: gameState.quarter,
                timeRemaining: gameState.timeRemaining,
                possession: gameState.possession
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

  // These legacy methods are now replaced by the modular alert cylinder system
  // Keeping them for backward compatibility but they should not be called in V3

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;
    
    try {
      const cleanTime = timeString.trim().split(' ')[0];
      if (cleanTime.includes(':')) {
        const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
        return (minutes * 60) + seconds;
      }
      return parseInt(cleanTime) || 0;
    } catch (error) {
      console.warn(`WNBA: Failed to parse time string "${timeString}":`, error);
      return 0;
    }
  }

  // Optimized time checking for basketball game situations
  private isWithinTimeWindow(timeRemaining: string, maxSeconds: number): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;
    
    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= maxSeconds && totalSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Memory optimization - periodically clean up performance metrics
  public performPeriodicCleanup(): void {
    try {
      // Clean up old performance metrics
      this.cleanupPerformanceMetrics();
      
      // Log performance stats for monitoring
      const metrics = this.getPerformanceMetrics();
      if (metrics.performance.totalRequests > 0) {
        console.log(`🏀 WNBA Engine Performance: ${metrics.performance.totalRequests} requests, ${metrics.performance.avgAlertGenerationTime}ms avg, ${this.alertModules.size} modules, ${metrics.performance.cacheHitRate}% cache hit rate`);
        
        // Warn on performance degradation
        if (metrics.performance.avgAlertGenerationTime > 150) {
          console.warn(`⚠️ WNBA Engine performance degraded: ${metrics.performance.avgAlertGenerationTime}ms average (target: <150ms)`);
        }
      }
    } catch (error) {
      console.error('WNBA Engine cleanup error:', error);
    }
  }

  // Basketball-specific optimizations for shot clock and possession tracking
  private optimizedBasketballTimeCalculation(timeRemaining: string, quarter: number): { 
    isClutchTime: boolean,
    isCrunchTime: boolean,
    isShotClockPressure: boolean,
    gamePhase: 'early' | 'middle' | 'late' | 'crunch' | 'overtime'
  } {
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);
    const isOT = quarter >= 5;
    
    // Optimized basketball timing calculations
    return {
      isClutchTime: quarter >= 4 && timeSeconds <= 300, // Final 5 minutes of regulation
      isCrunchTime: (quarter >= 4 && timeSeconds <= 120) || (isOT && timeSeconds <= 300), // Final 2 minutes
      isShotClockPressure: timeSeconds % 24 <= 5, // Shot clock pressure (24 seconds in WNBA)
      gamePhase: isOT ? 'overtime' : 
                quarter >= 4 && timeSeconds <= 120 ? 'crunch' :
                quarter >= 4 ? 'late' :
                quarter >= 2 ? 'middle' : 'early'
    };
  }

  // Initialize alert modules based on user's enabled preferences (optimized)
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'WNBA' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'WNBA');
      console.log(`📋 WNBA User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ WNBA Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid WNBA alerts that have corresponding module files
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER',
        // V3-10: New WNBA predictive alert types
        'WNBA_CLUTCH_TIME_OPPORTUNITY', 'WNBA_COMEBACK_POTENTIAL',
        'WNBA_CRUNCH_TIME_DEFENSE', 'WNBA_CHAMPIONSHIP_IMPLICATIONS'
      ];

      const wnbaEnabledTypes = enabledTypes.filter(alertType =>
        validWNBAAlerts.includes(alertType)
      );

      // Check global settings for these WNBA alerts (optimized batch check)
      const globallyEnabledTypes = [];
      for (const alertType of wnbaEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 WNBA Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing WNBA engine for user ${userId} with ${globallyEnabledTypes.length} WNBA alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the WNBA alert modules using optimized parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize WNBA engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type (optimized with performance monitoring)
  async loadAlertModule(alertType: string): Promise<any | null> {
    const startTime = Date.now();
    
    try {
      const moduleMap: Record<string, string> = {
        'WNBA_GAME_START': './alert-cylinders/wnba/game-start-module.ts',
        'WNBA_TWO_MINUTE_WARNING': './alert-cylinders/wnba/two-minute-warning-module.ts',
        'FINAL_MINUTES': './alert-cylinders/wnba/final-minutes-module.ts',
        'HIGH_SCORING_QUARTER': './alert-cylinders/wnba/high-scoring-quarter-module.ts',
        'LOW_SCORING_QUARTER': './alert-cylinders/wnba/low-scoring-quarter-module.ts',
        'FOURTH_QUARTER': './alert-cylinders/wnba/fourth-quarter-module.ts',
        // V3-10: New WNBA predictive alert modules
        'WNBA_CLUTCH_TIME_OPPORTUNITY': './alert-cylinders/wnba/clutch-time-opportunity-module.ts',
        'WNBA_COMEBACK_POTENTIAL': './alert-cylinders/wnba/comeback-potential-module.ts',
        'WNBA_CRUNCH_TIME_DEFENSE': './alert-cylinders/wnba/crunch-time-defense-module.ts',
        'WNBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/wnba/wnba-championship-implications-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No WNBA module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);
      
      if (loadTime > 50) {
        console.log(`⚠️ WNBA Slow module load: ${alertType} took ${loadTime}ms`);
      }
      
      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load WNBA alert module ${alertType} after ${loadTime}ms:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types (memory-optimized)
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);
    
    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 WNBA alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }
    
    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared WNBA alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded WNBA alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} WNBA alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
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
      sport: 'WNBA',
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
        clutchTimeDetections: this.performanceMetrics.clutchTimeDetections,
        fourthQuarterSituations: this.performanceMetrics.fourthQuarterSituations,
        overtimeDetections: this.performanceMetrics.overtimeDetections,
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

  // Clean up old performance metrics to prevent memory growth
  cleanupPerformanceMetrics(): void {
    const maxSamples = 100; // Keep last 100 samples
    
    if (this.performanceMetrics.alertGenerationTime.length > maxSamples) {
      this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.moduleLoadTime.length > maxSamples) {
      this.performanceMetrics.moduleLoadTime = this.performanceMetrics.moduleLoadTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.enhanceDataTime.length > maxSamples) {
      this.performanceMetrics.enhanceDataTime = this.performanceMetrics.enhanceDataTime.slice(-maxSamples);
    }
    if (this.performanceMetrics.probabilityCalculationTime.length > maxSamples) {
      this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-maxSamples);
    }
  }

  // Override to return only valid WNBA alert types
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'WNBA_GAME_START',
      'WNBA_TWO_MINUTE_WARNING',
      'FINAL_MINUTES',
      'HIGH_SCORING_QUARTER',
      'LOW_SCORING_QUARTER',
      'FOURTH_QUARTER',
      // V3-10: New WNBA predictive alert types
      'WNBA_CLUTCH_TIME_OPPORTUNITY',
      'WNBA_COMEBACK_POTENTIAL',
      'WNBA_CRUNCH_TIME_DEFENSE',
      'WNBA_CHAMPIONSHIP_IMPLICATIONS'
    ];
  }
}
