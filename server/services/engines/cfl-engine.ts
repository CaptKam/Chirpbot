import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { asyncAIProcessor } from '../async-ai-processor';
import { CrossSportContext } from '../cross-sport-ai-enhancement';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class CFLEngine extends BaseSportEngine {
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
    greyCapContextDetections: 0,
    overtimeAlerts: 0,
    threeDownSituations: 0,
    duplicatesBlocked: 0,
    alertsSent: 0
  };

  constructor() {
    super('CFL');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // V3-15: Complete CFL alert types with Canadian football specifics
      const validCFLAlerts = [
        'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING',
        // V3-15: Core CFL professional Canadian football alert types
        'CFL_FOURTH_QUARTER', 'CFL_FINAL_MINUTES', 'CFL_GREY_CUP_IMPLICATIONS',
        // V3-15: Advanced CFL Canadian-specific alert types  
        'CFL_THIRD_DOWN_SITUATION', 'CFL_ROUGE_OPPORTUNITY', 'CFL_OVERTIME'
      ];

      if (!validCFLAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid CFL alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`CFL Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();
    
    try {
      if (!gameState.isLive) return 0;

      let probability = 50; // Base probability
      
      // Enhanced CFL-specific probability calculation (optimized for speed)
      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore, possession } = gameState;

      // Quarter-specific adjustments (optimized calculation for CFL pace)
      if (quarter === 1) probability += 10; // First quarter action
      else if (quarter === 2) probability += 12; // Second quarter momentum
      else if (quarter === 3) probability += 14; // Third quarter adjustments
      else if (quarter === 4) probability += 20; // Fourth quarter drama
      else if (quarter >= 5) probability += 30; // Overtime intensity

      // CFL Time factors (optimized time parsing for 15-minute quarters)
      if (timeRemaining) {
        const timeSeconds = this.parseTimeToSeconds(timeRemaining);
        if (timeSeconds <= 60 && quarter >= 4) {
          probability += 25; // Final minute crunch time
        } else if (timeSeconds <= 120 && quarter >= 4) {
          probability += 18; // Final two minutes (CFL two-minute warning)
        } else if (timeSeconds <= 180 && quarter >= 4) {
          probability += 12; // Final 3 minutes (CFL three-minute warning)
        }
        
        // CFL play clock scenarios (CFL has 20-second play clock)
        if (timeSeconds % 20 <= 3 && quarter >= 3) {
          probability += 8; // Play clock pressure
        }
      }

      // CFL Down and distance factors (3-down system is critical)
      if (down && yardsToGo !== undefined) {
        if (down === 1) probability += 15; // First down advantage
        else if (down === 2) probability += 8; // Second down still good
        else if (down === 3) probability += 25; // Third down is critical in CFL!
        this.performanceMetrics.threeDownSituations++;
        
        // Yards to go adjustments (CFL field specifics)
        if (yardsToGo <= 1) probability += 20; // Very short yardage
        else if (yardsToGo <= 3) probability += 12; // Short yardage
        else if (yardsToGo <= 10) probability += 5; // Medium yardage
        else if (yardsToGo >= 15) probability -= 5; // Long yardage
      }

      // CFL Field position (110-yard field, wider field, different end zones)
      if (fieldPosition !== undefined) {
        if (fieldPosition <= 20) probability += 25; // CFL red zone (closer than NFL)
        else if (fieldPosition <= 35) probability += 15; // CFL scoring territory
        else if (fieldPosition <= 55) probability += 5; // CFL midfield advantage
        
        // CFL Rouge scoring opportunity (missed FG through end zone = 1 point)
        if (fieldPosition <= 45 && down === 3) {
          probability += 10; // Rouge potential adds excitement
        }
      }

      // Score differential (optimized for CFL professional pace)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) probability += 25; // Very close game (one score)
        else if (scoreDiff <= 7) probability += 18; // Close game (one TD)
        else if (scoreDiff <= 14) probability += 12; // Competitive game (two TDs)
        else if (scoreDiff <= 21) probability += 8; // Moderately competitive
        else if (scoreDiff >= 28) probability -= 10; // Blowout
        
        // CFL high-scoring game bonus (CFL average ~27 points per team)
        const totalScore = homeScore + awayScore;
        if (totalScore >= 60 && quarter >= 3) probability += 15; // High-scoring CFL game
        else if (totalScore >= 45 && quarter >= 3) probability += 10; // Above average
        else if (totalScore <= 30 && quarter >= 3) probability += 8; // Defensive battle
      }

      // CFL-specific situational boosts (professional level)
      if (quarter >= 4) {
        // Fourth quarter and overtime get extra weight in CFL
        if (homeScore !== undefined && awayScore !== undefined) {
          const scoreDiff = Math.abs(homeScore - awayScore);
          if (scoreDiff <= 7) probability += 20; // One score games are crucial
          if (scoreDiff <= 3) probability += 10; // Field goal games are most exciting
        }
      }

      // Overtime situations (CFL has different OT rules)
      if (quarter >= 5) {
        probability += 15; // Extra overtime drama
        this.performanceMetrics.overtimeAlerts++;
      }

      // Grey Cup context detection
      if (quarter >= 3 && homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 14) {
          probability += 5; // Grey Cup implications
          this.performanceMetrics.greyCapContextDetections++;
        }
      }

      const finalProbability = Math.min(Math.max(probability, 10), 95);
      
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      
      if (calculationTime > 50) {
        console.log(`⚠️ CFL Slow probability calculation: ${calculationTime}ms for game ${gameState.gameId}`);
      }
      
      return finalProbability;
    } catch (error) {
      const calculationTime = Date.now() - startTime;
      console.error(`❌ CFL Probability calculation failed after ${calculationTime}ms:`, error);
      return 50; // Safe fallback
    }
  }

  // Override to add CFL-specific game state enhancement and performance monitoring
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    
    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ CFL: No gameId provided, skipping alert generation');
        return [];
      }
      
      // Enhance game state with CFL-specific data if needed
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
        console.log(`🔄 CFL: All ${rawAlerts.length} alerts were duplicates for game ${enhancedGameState.gameId}`);
        return [];
      }
      
      console.log(`✅ CFL: Processing ${dedupedAlerts.length} new alerts (blocked ${rawAlerts.length - dedupedAlerts.length} duplicates)`);
      
      // Enhance alerts with time-sensitive intelligence via AlertComposer
      const composedAlerts = await this.composeTimeBasedAlerts(dedupedAlerts, enhancedGameState);
      
      // Process alerts with cross-sport AI enhancement for high-priority situations
      const alerts = await this.processEnhancedCFLAlerts(composedAlerts, enhancedGameState);
      
      // Track CFL-specific metrics
      if (enhancedGameState.quarter >= 4) {
        this.performanceMetrics.overtimeAlerts++;
      }
      if (enhancedGameState.down === 3) {
        this.performanceMetrics.threeDownSituations++;
      }
      
      this.performanceMetrics.totalAlerts += alerts.length;
      
      // Send alerts to both WebSocket and Telegram simultaneously (already deduplicated)
      await this.deliverAlertsToAllChannels(alerts, enhancedGameState);
      
      return alerts;
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
      // Get live data from CFL API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { CFLApiService } = await import('../cfl-api');
        const cflApi = new CFLApiService();
        // Note: CFL API doesn't provide enhanced data like MLB
        // Return game state as-is for now
      }
    } catch (error) {
      console.error('Error enhancing CFL game state with live data:', error);
    } finally {
      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);
    }

    return gameState;
  }

  /**
   * Check if an alert has already been sent recently
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    // Check if this exact alert was sent recently
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.performanceMetrics.duplicatesBlocked++;
      console.log(`🚫 CFL Duplicate blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }
    
    // Check if we've sent too many alerts for this game
    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= this.MAX_ALERTS_PER_GAME) {
      console.log(`⚠️ CFL Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
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
    
    console.log(`✅ CFL Alert tracked: ${alertKey} for game ${gameId}`);
    
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
    
    console.log(`🧹 CFL Alert cleanup: Removing alerts older than ${this.ALERT_COOLDOWN_MS}ms`);
    
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
        console.log(`🧹 CFL Removed tracking for game ${gameId}`);
      }
    }
    
    this.lastCleanup = now;
    console.log(`🧹 CFL Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  // Process alerts with cross-sport AI enhancement for high-priority CFL situations
  private async processEnhancedCFLAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Only enhance high-priority alerts (>= 85 probability)
        const probability = await this.calculateProbability(gameState);
        
        if (probability >= 85) {
          console.log(`🧠 CFL AI Enhancement: Processing ${alert.type} alert (${probability}%)`);
          
          // Build cross-sport context for CFL
          const aiContext: CrossSportContext = {
            sport: 'CFL',
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
            down: gameState.down,
            yardsToGo: gameState.yardsToGo,
            fieldPosition: gameState.fieldPosition,
            possession: gameState.possession,
            originalMessage: alert.message,
            originalContext: alert.context
          };

          // Queue for async AI enhancement (non-blocking) and return base alert immediately
          await asyncAIProcessor.queueAlertForEnhancement(alert, aiContext, 'system');
          console.log(`🚀 CFL Async AI: Queued ${alert.type} for background enhancement`);
        }
        
        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ CFL AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ CFL AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // V3-15: Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'CFL' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'CFL');
      console.log(`📋 CFL User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ CFL Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid CFL alerts that we have modules for
      const validCFLAlerts = [
        'CFL_GAME_START', 'CFL_TWO_MINUTE_WARNING', 'CFL_FOURTH_QUARTER', 
        'CFL_FINAL_MINUTES', 'CFL_GREY_CUP_IMPLICATIONS', 'CFL_THIRD_DOWN_SITUATION',
        'CFL_ROUGE_OPPORTUNITY', 'CFL_OVERTIME'
      ];

      const cflEnabledTypes = enabledTypes.filter(alertType =>
        validCFLAlerts.includes(alertType)
      );
      console.log(`🔍 CFL Valid enabled types: ${cflEnabledTypes.join(', ')}`);

      // Check global settings for these CFL alerts
      const globallyEnabledTypes = [];
      for (const alertType of cflEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 CFL Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing CFL engine for user ${userId} with ${globallyEnabledTypes.length} CFL alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the CFL alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize CFL engine for user ${userId}:`, error);
    }
  }

  // V3-15: Performance monitoring and diagnostics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageAlertGeneration: this.performanceMetrics.alertGenerationTime.length > 0
        ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
        : 0,
      averageProbabilityCalculation: this.performanceMetrics.probabilityCalculationTime.length > 0
        ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
        : 0,
      totalActiveModules: this.alertModules.size,
      requestsPerSecond: this.performanceMetrics.totalRequests / Math.max(1, (Date.now()) / 1000),
      alertSuccessRate: this.performanceMetrics.totalRequests > 0 ? (this.performanceMetrics.totalAlerts / this.performanceMetrics.totalRequests) * 100 : 0
    };
  }





  // Enhanced alert composition with time-sensitive intelligence
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    // For now, return alerts as-is. AlertComposer integration can be added later if needed
    return alerts;
  }

  // Synchronized delivery to both WebSocket and Telegram channels
  private async deliverAlertsToAllChannels(alerts: AlertResult[], gameState: GameState): Promise<void> {
    if (!alerts || alerts.length === 0) return;
    
    try {
      console.log(`🚀 Simultaneously delivering ${alerts.length} CFL alerts to WebSocket and Telegram`);
      
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
            sport: 'CFL',
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
            down: gameState.down,
            yardsToGo: gameState.yardsToGo,
            fieldPosition: gameState.fieldPosition,
            possession: gameState.possession,
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
      
      console.log(`📱 🚀 Delivering ${alerts.length} CFL alerts to ${telegramUsers.length} Telegram users`);
      
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
                down: gameState.down,
                yardsToGo: gameState.yardsToGo,
                fieldPosition: gameState.fieldPosition,
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
          } catch (userError) {
            console.error(`📱 ❌ Error sending alert to user ${user.username || user.id}:`, userError);
          }
        }
      }
    } catch (error) {
      console.error('📱 ❌ Telegram delivery error:', error);
    }
  }

  // V3-15: CFL-specific utility methods with performance optimization
  parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }




}