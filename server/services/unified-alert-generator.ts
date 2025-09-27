import { db } from "../db";
import { sql } from "drizzle-orm";
import { userMonitoredTeams } from "../../shared/schema";
import { storage, unifiedSettings } from "../storage";
import { unifiedDeduplicator } from "./unified-deduplicator";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";
import { getHealthMonitor } from './unified-health-monitor';
import { memoryManager } from '../middleware/memory-manager';
import type { InsertAlert } from "../../shared/schema";
import { GamblingInsightsComposer } from "./gambling-insights-composer";
import { enhancedAlertRouter, type UnifiedEnhancedAlert } from "./enhanced-alert-router";

// Extended interface for local calendar game data (renamed to avoid import conflict)
interface LocalCalendarGameData {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  isLive: boolean;
  startTime: string;
}

// ChirpBot V3 Weather-on-Live Architecture
import { RUNTIME } from '../config/runtime';
import { EngineLifecycleManager as EngineLifecycleManagerClass, EngineState, type EngineStateInfo } from './engine-lifecycle-manager';
import { CalendarSyncService, type CalendarGameData as ImportedCalendarGameData } from './calendar-sync-service';
import { WeatherOnLiveService, type WeatherChangeEvent } from './weather-on-live-service';
import type { GameStateManager, GameStateInfo, EngineLifecycleManager } from './game-state-manager';
import { gameStateManager } from './game-state-manager';
import type { BaseGameData } from './base-sport-api';
import { BaseSportEngine, GameState, AlertResult as EngineAlertResult } from './engines/base-engine';
import type { AlertResult as SharedAlertResult } from '../../shared/schema';

// Backward compatibility imports (only used when engines are ACTIVE)
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { NFLApiService } from "./nfl-api";
import { WNBAApiService } from "./wnba-api";
import { CFLApiService } from "./cfl-api";

// === UNIFIED INTERFACES ===

interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
}

interface AlertData {
  type: string;
  sport: string;
  gameId: string;
  score: number;
  payload: any;
  alertKey: string;
  state: string;
}


interface UnifiedAlertGeneratorOptions {
  logLevel?: 'verbose' | 'quiet';
  mode?: 'production' | 'demo';
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// V3 Weather-Enhanced Alert Interface
interface WeatherEnhancedAlert extends EngineAlertResult {
  weatherContext?: WeatherChangeEvent;
  isWeatherTriggered?: boolean;
  weatherSeverity?: 'low' | 'moderate' | 'high' | 'extreme';
  gamblingInsights?: any; // Add gambling insights field
  hasComposerEnhancement?: boolean;
}

// Sport Engine Status for dynamic access
interface SportEngineStatus {
  sport: string;
  state: EngineState;
  isActive: boolean;
  engine?: BaseSportEngine;
  lastStateChange: Date;
}

// Engine failure tracking interface
interface EngineFailureRecord {
  sport: string;
  failureCount: number;
  lastFailureTime: Date;
  isInRecovery: boolean;
  nextRetryTime: Date;
}

// === UNIFIED ALERT GENERATOR ===

export class UnifiedAlertGenerator {
  private logLevel: 'verbose' | 'quiet' = 'quiet';
  private mode: 'production' | 'demo' = 'production';

  // V3 Weather-on-Live Architecture Services (production only)
  private engineLifecycleManager?: EngineLifecycleManager;
  private calendarSyncService?: CalendarSyncService;
  private weatherOnLiveService?: WeatherOnLiveService;
  private gameStateManager?: GameStateManager;

  // Core services
  private deduplication = unifiedDeduplicator;
  private settingsCache = unifiedSettings;
  private healthMonitor?: any;
  private gamblingInsightsComposer?: GamblingInsightsComposer;

  // Additional monitoring properties
  // adaptivePollingManagers removed - using CalendarSyncService only
  private engineFailures: Map<string, EngineFailureRecord> = new Map();

  // Backward compatibility API services (used for fallback only)
  private mlbApi?: MLBApiService;
  private ncaafApi?: NCAAFApiService;
  private wnbaApi?: WNBAApiService;
  private nflApi?: NFLApiService;
  private cflApi?: CFLApiService;

  // Error recovery tracking (production only) - DISABLED to prevent duplicates
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  };
  // DISABLED: Fallback polling system to prevent duplicate API calls
  // private fallbackPollingActive: Map<string, NodeJS.Timeout> = new Map();

  // Engine status cache for performance
  private engineStatusCache: Map<string, SportEngineStatus> = new Map();
  private lastEngineStatusCheck = 0;
  private readonly engineStatusCacheTTL = 5000; // 5 seconds

  constructor(options: UnifiedAlertGeneratorOptions) {
    this.logLevel = options.logLevel || 'verbose';
    this.initializeProductionServices();
  }

  private initializeProductionServices(): void {
    console.log('🔧 Initializing UnifiedAlertGenerator with V3 Weather-on-Live architecture...');

    try {
      // Initialize core services first
      // 🔧 FIX: Using shared singleton unifiedSettings instead of creating new instance
      this.healthMonitor = getHealthMonitor();
      this.gamblingInsightsComposer = new GamblingInsightsComposer();

      // Initialize health monitor with callback integration
      this.healthMonitor.initialize({
        pollingIntervalMs: 30000,
        callbacks: {
          onRestart: () => this.startMonitoring(),
          onStop: () => this.stopMonitoring(),
          generatorLabel: 'unified-alert-generator-v3'
        }
      });

      // V3 Architecture: Initialize new services
      this.engineLifecycleManager = new EngineLifecycleManagerClass();
      
      // 🔧 FIX: Use singleton CalendarSyncService instead of creating duplicate
      this.calendarSyncService = CalendarSyncService.getInstance({
        sports: ['MLB', 'NFL', 'NCAAF', 'NBA', 'WNBA', 'CFL'],
        defaultPollInterval: RUNTIME.calendarPoll.defaultMs,
        preStartWindowMinutes: RUNTIME.calendarPoll.preStartWindowMin,
        preStartPollInterval: RUNTIME.calendarPoll.preStartPollMs,
        enableMetrics: true
      });
      this.weatherOnLiveService = new WeatherOnLiveService();
      
      console.log('🔧 Using singleton CalendarSyncService to prevent duplicate API calls');

      // CRITICAL FIX: Connect GameStateManager to EngineLifecycleManager
      this.gameStateManager = gameStateManager;
      this.gameStateManager.setEngineLifecycleManager(this.engineLifecycleManager);
      this.gameStateManager.setCalendarSyncService(this.calendarSyncService);
      this.gameStateManager.setWeatherOnLiveService(this.weatherOnLiveService);
      this.gameStateManager.setGamblingInsightsComposer(this.gamblingInsightsComposer);

      // Connect CalendarSyncService to GameStateManager for state transitions
      this.calendarSyncService.setGameStateManager(this.gameStateManager);

      console.log('🔗 GameStateManager connected to EngineLifecycleManager - engines will start when games go LIVE');

      // DISABLED: Backward compatibility API services to prevent duplicate calls
      // These were causing duplicate NBA/WNBA API calls
      // this.mlbApi = new MLBApiService();
      // this.ncaafApi = new NCAAFApiService();
      // this.nflApi = new NFLApiService();
      // this.wnbaApi = new WNBAApiService();
      // this.cflApi = new CFLApiService();
      
      console.log('🚫 Backward compatibility API services disabled to prevent duplicates');

      console.log('✅ V3 Weather-on-Live architecture initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize V3 architecture:', error);
      throw error;
    }
  }

  // === PUBLIC API METHODS ===

  async generateLiveGameAlerts(): Promise<number> {
    return this.runProductionPipeline();
  }

  async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    // Settings cache is now always available as shared singleton

    return this.settingsCache.isAlertEnabled(sport, alertType);
  }

  async startMonitoring(): Promise<void> {
    console.log('⚡ Starting V3 Weather-on-Live alert monitoring...');

    try {
      // Start health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.startMonitoring();
      }

      // V3 Architecture: Start calendar sync service for lightweight game data
      if (this.calendarSyncService) {
        await this.calendarSyncService.start();
        console.log('✅ Calendar sync service started');
      }

      // V3 Architecture: Weather service starts automatically when games go LIVE
      // (No manual initialization needed - weather-on-live architecture handles this)

      // V3 Architecture: Engine Lifecycle Manager handles engine state transitions
      // (Engines are started/stopped based on game states automatically)

      console.log('✅ V3 Weather-on-Live monitoring started successfully!');
      console.log('🎯 Alert generation will be dynamically activated when games transition to LIVE state');

    } catch (error) {
      console.error('❌ Failed to start V3 monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    console.log('🛑 Stopping V3 Weather-on-Live monitoring...');

    try {
      // Stop calendar sync service
      if (this.calendarSyncService) {
        await this.calendarSyncService.stop();
        console.log('✅ Calendar sync service stopped');
      }

      // Clear engine status cache
      this.engineStatusCache.clear();
      this.lastEngineStatusCheck = 0;

      // DISABLED: Fallback polling system to prevent duplicates
      // for (const [sport, interval] of this.fallbackPollingActive) {
      //   clearInterval(interval);
      // }
      // this.fallbackPollingActive.clear();
      
      console.log('🚫 Fallback polling system disabled');

      console.log('✅ V3 Weather-on-Live monitoring stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping V3 monitoring:', error);
    }
  }

  getStats(): any {
    // V3: Enhanced stats with architecture status
    return {
      mode: 'production',
      architecture: 'weather-on-live-v3',
      engineFailures: 0, // Legacy - no longer applicable in V3
      fallbackPollingActive: 0, // Disabled to prevent duplicates
      healthMonitor: this.healthMonitor?.getHealthStatus() || null,
      // V3 specific stats
      engineStatusCacheSize: this.engineStatusCache.size,
      lastEngineStatusCheck: new Date(this.lastEngineStatusCheck).toISOString(),
      servicesStatus: {
        engineLifecycleManager: !!this.engineLifecycleManager,
        calendarSyncService: !!this.calendarSyncService,
        weatherOnLiveService: !!this.weatherOnLiveService
      }
    };
  }

  getPerformanceMetrics(): any {
    return this.healthMonitor?.getPerformanceMetrics() || {};
  }

  // === PRODUCTION PIPELINE ===

  private async runProductionPipeline(): Promise<number> {
    // CRITICAL: Record health check FIRST to prevent auto-recovery loops
    this.healthMonitor?.recordCheck();

    // Check memory and clean up if needed, but DON'T skip the cycle
    if (memoryManager.shouldCleanup()) {
      memoryManager.cleanupBackground();
    }

    if (this.logLevel !== 'quiet') {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
    }

    try {
      // Use cached settings with intelligent TTL - no need to clear cache every cycle

      // Check if any alerts are globally enabled
      const hasAnyEnabledAlerts = await this.hasAnyGloballyEnabledAlerts().catch(error => {
        console.error('❌ Error checking globally enabled alerts:', error);
        this.healthMonitor?.recordError(error);
        return false;
      });

      if (!hasAnyEnabledAlerts) {
        console.log('🚫 No alert types are globally enabled by admin - skipping all alert generation');
        this.healthMonitor?.recordSuccessfulPoll();
        return 0;
      }

      // Process each sport in parallel for better performance
      const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
      let totalAlerts = 0;

      // FIXED: Process sports in true parallel with Promise.allSettled for error isolation
      const sportProcessingPromises = sports.map(async (sport) => {
        let sportAlerts = 0;
        try {
          // Use cached settings to avoid sequential blocking
          const enabledAlerts: string[] = await Promise.race([
            this.settingsCache.getEnabledAlertTypes(sport),
            new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('Settings timeout')), 5000))
          ]).catch(error => {
            console.error(`❌ Error getting ${sport} settings:`, error);
            this.healthMonitor?.recordError(error);
            return [] as string[];
          });

          if (enabledAlerts.length === 0) {
            if (['MLB', 'NFL'].includes(sport)) {
              console.log(`🚫 No ${sport} alert types enabled globally - skipping ${sport} monitoring`);
            }
            return 0;
          }

          const usersWithActiveMonitoring = await this.getUsersWithActiveMonitoring(sport).catch(error => {
            console.error(`❌ Error checking active monitoring for ${sport}:`, error);
            this.healthMonitor?.recordError(error);
            return [];
          });

          if (usersWithActiveMonitoring.length === 0) {
            if (['MLB', 'NFL'].includes(sport)) {
              console.log(`🚫 No users actively monitoring ${sport} games - skipping data fetch`);
            }
            return 0;
          }

          if (this.logLevel !== 'quiet') {
            console.log(`✅ ${sport} monitoring: ${enabledAlerts.length} alerts enabled, ${usersWithActiveMonitoring.length} active users`);
          }

          // V3: Dynamic game data sourcing based on engine state
          let games: any[] = [];
          let dataSource = 'unknown';
          try {
            const gameData = await this.getGameDataForSport(sport);
            games = gameData.games;
            dataSource = gameData.source;

            if (this.logLevel !== 'quiet') {
              console.log(`📊 V3: Fetched ${games.length} ${sport} games from ${dataSource} source`);
            }
          } catch (gameError) {
            console.error(`❌ Error fetching ${sport} games:`, gameError);
            return 0;
          }

          if (games.length > 0) {
            try {
              const alerts = await this.processGamesWithEngine(sport, games);
              sportAlerts += alerts;
            } catch (processError) {
              console.error(`❌ Error processing ${sport} games:`, processError);
              this.healthMonitor?.recordError(processError as Error);
              // DISABLED: Fallback polling to prevent duplicate API calls
              // await this.activateFallbackPolling(sport);
              console.log(`🚫 Fallback polling disabled for ${sport} to prevent duplicates`);
            }
          }
        } catch (sportError) {
          console.error(`❌ Sport ${sport} processing failed:`, sportError);
        }
        return sportAlerts;
      });

      // FIXED: Use Promise.allSettled to prevent one sport failure from blocking others
      const sportResults = await Promise.allSettled(sportProcessingPromises);
      totalAlerts = sportResults
        .filter(result => result.status === 'fulfilled')
        .reduce((sum, result) => sum + (result as PromiseFulfilledResult<number>).value, 0);

      // Log any sport processing failures
      const failures = sportResults.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`⚠️ ${failures.length} sports failed processing:`, 
          failures.map(f => (f as PromiseRejectedResult).reason.message).join(', '));
      }

      if (this.logLevel !== 'quiet') {
        console.log(`📊 Generated ${totalAlerts} total alerts across all sports`);
      }

      if (totalAlerts > 0) {
        this.healthMonitor?.recordAlertGenerated(totalAlerts);
      }
      this.healthMonitor?.recordSuccessfulPoll();

      return totalAlerts;

    } catch (error: any) {
      console.error('❌ Critical error in generateLiveGameAlerts:', error);
      this.healthMonitor?.recordError(error);
      return 0;
    }
  }


  // === SHARED HELPER METHODS ===

  private normalizeGameState(game: any, sport: string): GameState {
    // Ensure we always have a valid gameId with proper fallbacks
    const gameId = game.gameId || game.id || game.gamePk?.toString() || `${sport}_${game.homeTeam?.name || 'home'}_${game.awayTeam?.name || 'away'}_${Date.now()}`;

    return {
      gameId: gameId,
      sport: sport,
      homeTeam: typeof game.homeTeam === 'string' ? game.homeTeam : game.homeTeam?.name || game.homeTeam?.displayName,
      awayTeam: typeof game.awayTeam === 'string' ? game.awayTeam : game.awayTeam?.name || game.awayTeam?.displayName,
      homeScore: game.homeScore || 0,
      awayScore: game.awayScore || 0,
      status: game.status || 'unknown',
      isLive: game.isLive || false,
      // Sport-specific fields
      inning: game.inning,
      isTopInning: game.isTopInning,
      outs: game.outs,
      balls: game.balls,
      strikes: game.strikes,
      hasFirst: game.hasFirst,
      hasSecond: game.hasSecond,
      hasThird: game.hasThird,
      runners: game.runners,
      currentBatter: game.currentBatter,
      currentPitcher: game.currentPitcher,
      // Additional fields preserved
      ...game
    };
  }

  private getBetbookData(context: any): BetbookData {
    const { sport, gameId, homeTeam, awayTeam, homeScore, awayScore, type, probability, inning, outs } = context;
    const totalScore = homeScore + awayScore;
    const scoreDiff = homeScore - awayScore;

    const currentInning = inning || 5;
    const gameProgress = Math.min(currentInning / 9, 1);

    let totalLine: number;
    if (sport === 'MLB') {
      const currentPace = (totalScore / Math.max(currentInning, 1)) * 9;
      const standardTotal = 8.5;
      totalLine = Math.round(((currentPace + standardTotal) / 2) * 2) / 2;
      totalLine = Math.max(totalLine, totalScore + 0.5);
    } else {
      totalLine = Math.max(totalScore + 3, 45);
    }

    let homeOdds = -110;
    let awayOdds = -110;

    if (scoreDiff > 0) {
      const advantage = Math.min(scoreDiff * 25 + (gameProgress * 50), 150);
      homeOdds = Math.max(-250, -110 - advantage);
      awayOdds = Math.min(+200, -110 + advantage + 10);
    } else if (scoreDiff < 0) {
      const advantage = Math.min(Math.abs(scoreDiff) * 25 + (gameProgress * 50), 150);
      awayOdds = Math.max(-250, -110 - advantage);
      homeOdds = Math.min(+200, -110 + advantage + 10);
    }

    const awayTeamName = typeof awayTeam === 'string' ? awayTeam : awayTeam?.name || 'Away';
    const homeTeamName = typeof homeTeam === 'string' ? homeTeam : homeTeam?.name || 'Home';
    let aiAdvice = `${awayTeamName.split(' ').pop()} ${awayScore}-${homeScore} ${homeTeamName.split(' ').pop()}`;

    if (type === 'BASES_LOADED') {
      aiAdvice += ` | BASES LOADED: Strong over ${totalLine} value. Historical 75%+ scoring rate.`;
    } else if (type === 'RISP') {
      aiAdvice += ` | Runner in scoring position. Over ${totalLine} shows value at ${inning}th inning.`;
    } else if (type === 'HOME_RUN') {
      aiAdvice += ` | Momentum shift! Live betting window for over ${totalLine}.`;
    } else if (totalScore < totalLine - 1) {
      aiAdvice += ` | Current pace suggests OVER ${totalLine} value (${totalScore} through ${currentInning}).`;
    } else if (totalScore > totalLine + 1) {
      aiAdvice += ` | High-scoring game. Consider UNDER ${totalLine} (${totalScore} runs already).`;
    } else {
      aiAdvice += ` | Live total ${totalLine}. Monitor for value based on next few plays.`;
    }

    return {
      odds: {
        home: homeOdds,
        away: awayOdds,
        total: totalLine
      },
      aiAdvice,
      sportsbookLinks: [
        { name: 'FanDuel', url: 'https://sportsbook.fanduel.com' },
        { name: 'DraftKings', url: 'https://sportsbook.draftkings.com' },
        { name: 'Bet365', url: 'https://www.bet365.com' },
        { name: 'BetMGM', url: 'https://sports.betmgm.com' }
      ]
    };
  }

  // === V3 ENGINE STATE MANAGEMENT METHODS ===

  /**
   * Get current engine status with caching for performance
   */
  private async getEngineStatus(sport: string): Promise<SportEngineStatus | null> {
    const now = Date.now();

    // Check cache first (TTL: 5 seconds)
    if (now - this.lastEngineStatusCheck < this.engineStatusCacheTTL) {
      const cached = this.engineStatusCache.get(sport);
      if (cached) return cached;
    }

    if (!this.engineLifecycleManager) {
      console.warn(`⚠️ EngineLifecycleManager not available for ${sport}`);
      return null;
    }

    try {
      const stateInfo = await this.engineLifecycleManager.getEngineStatus(sport);
      if (!stateInfo) return null;

      const engine = stateInfo.state === 'ACTIVE' 
        ? this.engineLifecycleManager.getEngine(sport) 
        : undefined;

      const status: SportEngineStatus = {
        sport,
        state: stateInfo.state,
        isActive: stateInfo.state === 'ACTIVE',
        engine,
        lastStateChange: stateInfo.lastStateChange || new Date()
      };

      // Update cache
      this.engineStatusCache.set(sport, status);
      if (this.engineStatusCache.size === 1) {
        this.lastEngineStatusCheck = now;
      }

      return status;

    } catch (error) {
      console.error(`❌ Error getting engine status for ${sport}:`, error);
      return null;
    }
  }

  /**
   * Check if engine is available and ready for alert processing
   */
  private async isEngineReadyForProcessing(sport: string): Promise<boolean> {
    const status = await this.getEngineStatus(sport);
    return status?.isActive === true && status.engine !== undefined;
  }

  /**
   * Get game data from appropriate source based on engine availability
   */
  private async getGameDataForSport(sport: string): Promise<{ games: any[], source: 'engine' | 'calendar' | 'fallback' }> {
    if (this.mode === 'demo') return { games: [], source: 'fallback' };

    // Check engine availability first
    const isEngineReady = await this.isEngineReadyForProcessing(sport);

    if (isEngineReady) {
      // Use traditional API when engine is ACTIVE
      return await this.getGameDataFromApi(sport);
    } else {
      // Use CalendarSyncService for lightweight data when engines aren't active
      return await this.getGameDataFromCalendar(sport);
    }
  }

  /**
   * Get game data from CalendarSyncService (lightweight, no engine required)
   */
  private async getGameDataFromCalendar(sport: string): Promise<{ games: any[], source: 'calendar' }> {
    try {
      if (!this.calendarSyncService) {
        console.warn(`⚠️ CalendarSyncService not available for ${sport}`);
        return { games: [], source: 'calendar' };
      }

      const calendarData = this.calendarSyncService.getCalendarData(sport);

      // Check for valid calendar data before processing
      if (!calendarData || !Array.isArray(calendarData)) {
        if (this.logLevel !== 'quiet') {
          console.log(`⚠️ No calendar data available for ${sport}`);
        }
        return { games: [], source: 'calendar' };
      }

      // Convert calendar data to unified format
      const games = calendarData.map((game: ImportedCalendarGameData) => ({
        gameId: game.gameId,
        id: game.gameId,
        homeTeam: typeof game.homeTeam === 'string' ? game.homeTeam : game.homeTeam.name,
        awayTeam: typeof game.awayTeam === 'string' ? game.awayTeam : game.awayTeam.name,
        status: game.status,
        isLive: game.status === 'live',
        startTime: game.startTime,
        // Calendar data is lightweight, no detailed game state
        homeScore: typeof game.homeTeam === 'string' ? 0 : game.homeTeam.score || 0,
        awayScore: typeof game.awayTeam === 'string' ? 0 : game.awayTeam.score || 0,
        inning: 1,
        isTopInning: true
      }));

      if (this.logLevel !== 'quiet') {
        console.log(`📅 Calendar: Retrieved ${games.length} ${sport} games (engines not active)`);
      }

      return { games, source: 'calendar' };

    } catch (error) {
      console.error(`❌ Error getting calendar data for ${sport}:`, error);
      return { games: [], source: 'calendar' };
    }
  }

  /**
   * Get game data from traditional APIs (requires engine to be ACTIVE)
   */
  private async getGameDataFromApi(sport: string): Promise<{ games: any[], source: 'engine' | 'fallback' }> {
    try {
      let games: any[] = [];

      switch (sport) {
        case 'MLB':
          if (this.mlbApi) {
            games = await this.mlbApi.getTodaysGames();
          }
          break;
        case 'NFL':
          games = await this.getNFLGames();
          break;
        case 'NCAAF':
          if (this.ncaafApi) {
            games = await this.ncaafApi.getTodaysGames();
          }
          break;
        case 'WNBA':
          games = await this.getWNBAGames();
          break;
        case 'CFL':
          games = await this.getCFLGames();
          break;
      }

      if (this.logLevel !== 'quiet') {
        console.log(`🏟️ Engine: Retrieved ${games.length} ${sport} games (engine ACTIVE)`);
      }

      return { games: Array.isArray(games) ? games : [], source: 'engine' };

    } catch (error) {
      console.error(`❌ Error getting API data for ${sport}:`, error);
      return { games: [], source: 'fallback' };
    }
  }

  /**
   * V3 Weather Enhancement - Enhance alerts with weather context for live games
   */
  private async enhanceAlertsWithWeatherContext(
    alerts: EngineAlertResult[], 
    gameState: GameState, 
    sport: string
  ): Promise<WeatherEnhancedAlert[]> {
    if (!alerts || alerts.length === 0) return [];

    // V3: Only enhance with weather for live games
    if (!gameState.isLive) {
      // Return alerts without weather enhancement for non-live games
      return alerts.map(alert => ({ ...alert }));
    }

    try {
      if (!this.weatherOnLiveService) {
        if (this.logLevel !== 'quiet') {
          console.log(`⚠️ WeatherOnLiveService not available for ${sport} game ${gameState.gameId}`);
        }
        return alerts.map(alert => ({ ...alert }));
      }

      // Get weather context for this game/location
      // Note: weather service method will be available when service is properly initialized
      const weatherContext = null;

      if (!weatherContext) {
        return alerts.map(alert => ({ ...alert }));
      }

      // Enhance alerts with weather context
      const enhancedAlerts: WeatherEnhancedAlert[] = alerts.map(alert => {
        // Check if this alert type benefits from weather enhancement
        const isWeatherRelevant = this.isAlertWeatherRelevant(alert.type, sport);

        if (isWeatherRelevant) {
          const severity = this.calculateWeatherSeverity(weatherContext);

          return {
            ...alert,
            weatherContext,
            isWeatherTriggered: severity === 'high' || severity === 'extreme',
            weatherSeverity: severity,
            // Boost priority for weather-enhanced alerts
            priority: alert.priority + (severity === 'high' ? 10 : severity === 'extreme' ? 20 : 0)
          };
        }

        return { ...alert };
      });

      if (this.logLevel !== 'quiet') {
        const weatherEnhanced = enhancedAlerts.filter(a => a.weatherContext).length;
        console.log(`🌤️ V3 Weather: Enhanced ${weatherEnhanced}/${alerts.length} alerts for ${sport} game ${gameState.gameId}`);
      }

      return enhancedAlerts;

    } catch (error) {
      console.error(`❌ Error enhancing alerts with weather context:`, error);
      // Return original alerts on error
      return alerts.map(alert => ({ ...alert }));
    }
  }

  /**
   * Enhance alerts with gambling insights using batch method
   */
  private async enhanceAlertsWithGamblingInsights(
    alerts: WeatherEnhancedAlert[], 
    gameState: GameState, 
    sport: string
  ): Promise<WeatherEnhancedAlert[]> {
    // UNCONDITIONAL LOGGING: Always log entry regardless of conditions
    console.log(`🎲 Composer: Starting enhancement for ${sport} with ${alerts.length} alerts`);
    
    if (!alerts || alerts.length === 0) {
      console.log(`🎲 Composer: ${sport} - No alerts to enhance (alerts=${alerts?.length || 0})`);
      return alerts || [];
    }
    
    if (!this.gamblingInsightsComposer) {
      console.log(`🎲 Composer: ${sport} - GamblingInsightsComposer not initialized`);
      return alerts;
    }

    try {
      // GAME STATE VALIDATION: Log the game state being passed to composer
      console.log(`🎮 Game State Validation for ${sport} game ${gameState.gameId}:`, {
        sport: gameState.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        status: gameState.status,
        isLive: gameState.isLive,
        // Sport-specific context
        inning: gameState.inning,
        outs: gameState.outs,
        quarter: gameState.quarter,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        timeRemaining: gameState.timeRemaining
      });
      
      console.log(`🎲 Composer: ${sport} enhancing ${alerts.length} alerts`);

      // Convert WeatherEnhancedAlert to SharedAlertResult for the composer
      const alertResults: SharedAlertResult[] = alerts.map(alert => ({
        ...alert,
        // Add game state context properties to alert context
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        status: gameState.status,
        isLive: gameState.isLive,
        // Add weather context from alert to context property for composer
        context: {
          ...alert.context,
          // Add game state context
          inning: gameState.inning,
          isTopInning: gameState.isTopInning,
          hasFirst: gameState.runners?.first,
          hasSecond: gameState.runners?.second,
          hasThird: gameState.runners?.third,
          outs: gameState.outs,
          balls: gameState.balls,
          strikes: gameState.strikes,
          currentBatter: gameState.currentBatter?.name,
          onDeckBatter: gameState.onDeckBatter?.name,
          currentPitcher: gameState.currentPitcher?.name,
          pitchCount: gameState.pitchCount,
          quarter: gameState.quarter || gameState.period,
          down: gameState.down,
          yardsToGo: gameState.yardsToGo,
          fieldPosition: gameState.fieldPosition,
          timeRemaining: gameState.timeRemaining || gameState.time,
          possession: gameState.possession,
          redZoneEfficiency: gameState.redZoneEfficiency,
          turnovers: gameState.turnovers,
          fouls: gameState.fouls,
          timeouts: gameState.timeouts,
          shotClock: gameState.shotClock,
          recentScoring: gameState.recentScoring,
          starPlayers: gameState.starPlayers
        },
        // Add weather context from weather enhancement
        weatherContext: alert.weatherContext ? {
          windSpeed: alert.weatherContext?.currentWeather?.windSpeed,
          windDirection: alert.weatherContext?.currentWeather?.windDirection,
          temperature: alert.weatherContext?.currentWeather?.temperature,
          condition: alert.weatherContext?.currentWeather?.condition,
          severity: alert.weatherSeverity as 'low' | 'medium' | 'high'
        } : undefined
      }));

      // Use the batch enhancement method from GamblingInsightsComposer
      const enhancedAlerts = await this.gamblingInsightsComposer!.enhanceAlertsWithGamblingInsights(alertResults, sport);

      // PER-ALERT LOGGING: Log each alert enhancement attempt
      let bulletsTotal = 0;
      enhancedAlerts.forEach(alert => {
        const bullets = alert.gamblingInsights?.bullets || [];
        // Note: mapperUsed is not a property of GamblingInsights interface
        bulletsTotal += bullets.length;
        
        console.log(`🎯 Composer bullets: alertKey=${alert.alertKey}, sport=${sport}, bullets=${bullets.length}`);
        
        // Log bullet content for debugging
        if (bullets.length > 0) {
          console.log(`📝 Bullet content for ${alert.alertKey}:`, bullets.slice(0, 2)); // First 2 bullets for brevity
        }
      });

      // UNCONDITIONAL LOGGING: Always log completion with bullet totals
      console.log(`🎲 Composer: Completed enhancement for ${sport}, added ${bulletsTotal} total bullets`);

      // Convert back to WeatherEnhancedAlert type while preserving weather enhancements
      return enhancedAlerts.map(enhancedAlert => {
        const originalAlert = alerts.find(a => a.alertKey === enhancedAlert.alertKey) || alerts[0];
        return {
          ...enhancedAlert,
          // Preserve weather enhancement fields from original alert
          weatherContext: originalAlert.weatherContext,
          isWeatherTriggered: originalAlert.isWeatherTriggered,
          weatherSeverity: originalAlert.weatherSeverity
        } as WeatherEnhancedAlert;
      });

    } catch (error) {
      // ENHANCED ERROR HANDLING: Detailed error logging
      const err = error as Error;
      console.error(`❌ ERROR in gambling insights enhancement for ${sport}:`, {
        errorMessage: err.message,
        errorStack: err.stack,
        alertsCount: alerts.length,
        gameId: gameState.gameId,
        sport: sport,
        composerInitialized: !!this.gamblingInsightsComposer
      });
      
      // Log original alerts being returned due to error
      console.log(`🔄 Returning ${alerts.length} original alerts due to error`);
      
      // Return original alerts on error to maintain pipeline stability
      return alerts;
    }
  }

  /**
   * Check if alert type benefits from weather enhancement
   */
  private isAlertWeatherRelevant(alertType: string, sport: string): boolean {
    // V3: Use RUNTIME config to determine weather relevance
    const sportConfig = RUNTIME.cylinders[sport];
    if (!sportConfig) return false;

    // Check if alert type relates to weather-sensitive situations
    const weatherKeywords = ['WIND', 'WEATHER', 'RAIN', 'TEMP'];
    return weatherKeywords.some((trigger: string) => 
      alertType.includes(trigger.toUpperCase())
    );
  }

  /**
   * Calculate weather severity from weather context
   */
  private calculateWeatherSeverity(weatherContext: WeatherChangeEvent): 'low' | 'moderate' | 'high' | 'extreme' {
    // Extract weather data from current weather since WeatherChangeEvent doesn't have direct properties
    const currentWeather = weatherContext.currentWeather;
    const windSpeed = currentWeather?.windSpeed || 0;
    const temperature = currentWeather?.temperature || 70;
    // Note: WeatherData interface doesn't have precipitation property
    const hasRain = currentWeather?.condition?.toLowerCase().includes('rain') || false;

    let severityScore = 0;

    // Wind impact
    if (windSpeed > 25) severityScore += 3;
    else if (windSpeed > 15) severityScore += 2;
    else if (windSpeed > 10) severityScore += 1;

    // Temperature impact
    if (temperature > 95 || temperature < 40) severityScore += 2;
    else if (temperature > 90 || temperature < 50) severityScore += 1;

    // Weather condition impact (rain, snow, etc.)
    if (hasRain) severityScore += 2;
    else if (currentWeather?.condition?.toLowerCase().includes('cloud')) severityScore += 1;

    if (severityScore >= 5) return 'extreme';
    if (severityScore >= 3) return 'high';
    if (severityScore >= 1) return 'moderate';
    return 'low';
  }

  // === PRODUCTION-ONLY HELPER METHODS ===

  private async hasAnyGloballyEnabledAlerts(): Promise<boolean> {
    if (this.mode === 'demo') return true;

    const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
    for (const sport of sports) {
      const enabledAlerts = await this.settingsCache.getEnabledAlertTypes(sport);
      if (enabledAlerts.length > 0) {
        return true;
      }
    }
    return false;
  }

  private async getUsersWithActiveMonitoring(sport: string): Promise<any[]> {
    if (this.mode === 'demo') return [];

    try {
      // Get all monitored games for the sport
      const allMonitoredGames = await storage.getAllMonitoredGames();
      const sportMonitoredGames = allMonitoredGames.filter(game => game.sport === sport);

      // Extract unique users who have monitoring enabled for this sport
      const uniqueUsers = [...new Set(sportMonitoredGames.map(game => game.userId))];

      if (this.logLevel !== 'quiet') {
        console.log(`📊 Found ${uniqueUsers.length} users monitoring ${sport} games`);
      }

      return uniqueUsers;
    } catch (error) {
      console.error(`❌ Error getting users with active monitoring for ${sport}:`, error);
      return [];
    }
  }

  /**
   * CRITICAL FIX: Get users monitoring a SPECIFIC game (not all sport users)
   * Replaces incorrect usage of getUsersWithActiveMonitoring() for game-specific alerts
   */
  private async getUsersMonitoringGame(sport: string, gameId: string): Promise<any[]> {
    if (this.mode === 'demo') return [];

    try {
      // Get monitored games filtered by BOTH sport AND gameId
      const allMonitoredGames = await storage.getAllMonitoredGames();
      const gameIdStr = gameId.toString();
      const gameIdNum = parseInt(gameId);
      const gameSpecificMonitoring = allMonitoredGames.filter(game => {
        const monitoredGameId = game.gameId;
        const monitoredGameIdStr = monitoredGameId.toString();
        const monitoredGameIdNum = parseInt(monitoredGameId);

        return game.sport === sport && (
          monitoredGameId === gameIdStr || 
          monitoredGameId === gameId ||
          monitoredGameIdStr === gameIdStr ||
          (monitoredGameIdNum === gameIdNum && !isNaN(gameIdNum))
        );
      });

      // Extract unique users monitoring this SPECIFIC game
      const uniqueUsers = [...new Set(gameSpecificMonitoring.map(game => game.userId))];

      if (this.logLevel !== 'quiet') {
        console.log(`🎯 Found ${uniqueUsers.length} users monitoring ${sport} game ${gameId}`);
      }

      return uniqueUsers;
    } catch (error) {
      console.error(`❌ Error getting users monitoring game ${sport}:${gameId}:`, error);
      return [];
    }
  }

  /**
   * V3 State-Aware Alert Processing
   * Only generates alerts when engines are in ACTIVE state
   */
  private async processGamesWithEngine(sport: string, games: any[]): Promise<number> {
    if (this.mode === 'demo') return 0;

    let totalAlerts = 0;

    // V3: Check engine state before processing
    const engineStatus = await this.getEngineStatus(sport);
    if (!engineStatus) {
      if (this.logLevel !== 'quiet') {
        console.log(`⚠️ ${sport}: Engine status unavailable - skipping alert processing`);
      }
      return 0;
    }

    // V3: Only process alerts when engine is ACTIVE
    if (!engineStatus.isActive || !engineStatus.engine) {
      if (this.logLevel !== 'quiet') {
        console.log(`🔄 ${sport}: Engine state=${engineStatus.state} - skipping alert processing (games: ${games.length})`);
      }
      return 0;
    }

    const engine = engineStatus.engine;

    if (this.logLevel !== 'quiet') {
      console.log(`🎯 ${sport}: Engine ACTIVE - processing ${games.length} games for alerts`);
    }

    try {
      // Get enabled alert types for this sport
      const enabledAlerts = await this.settingsCache.getEnabledAlertTypes(sport);

      // Initialize the engine with user alert modules
      await engine.initializeUserAlertModules(enabledAlerts);

      // Process each game
      for (const game of games) {
        if (!game.isLive) continue; // Only process live games

        try {
          // OPTIMIZATION: Check monitoring users FIRST (before alert processing)
          const gameId = game.gameId || game.id;
          const gameMonitoringUsers = await this.getUsersMonitoringGame(sport, gameId);

          // Skip entire alert processing if no users monitoring this game
          if (gameMonitoringUsers.length === 0) {
            if (this.logLevel !== 'quiet') {
              console.log(`⏭️  Skipping ${sport} game ${gameId} - no users monitoring`);
            }
            continue;
          }

          // Convert game data to GameState format
          const gameState = this.normalizeGameState(game, sport);

          // Generate alerts using the sport engine
          const alertResults = await engine.generateLiveAlerts(gameState);

          // UNIFIED AI ENHANCEMENT: Parallel processing for improved throughput
          console.log(`🚀 Processing ${alertResults.length} alerts in parallel through Enhanced Alert Router`);
          
          const enhancementPromises = alertResults.map(async (alertResult) => {
            try {
              // Single enhancement call that consolidates all AI capabilities
              const unifiedAlert = await enhancedAlertRouter.enhanceAlert(alertResult, gameState);
              return { success: true, alert: unifiedAlert };
            } catch (enhancementError) {
              console.warn(`⚠️ Enhancement failed for ${alertResult.type}, using fallback:`, enhancementError);
              // Fallback: convert to basic enhanced alert format
              const fallbackAlert: UnifiedEnhancedAlert = {
                type: alertResult.type,
                sport: gameState.sport,
                gameId: gameState.gameId,
                alertKey: alertResult.alertKey || `${gameState.gameId}_${alertResult.type}_${Date.now()}`,
                priority: alertResult.priority,
                headline: `${sport}: ${alertResult.type}`,
                enhancedMessage: alertResult.message || 'Alert detected',
                timing: { whyNow: 'Alert triggered', urgencyLevel: 'moderate' as const },
                action: { primaryAction: 'Monitor situation', confidence: 50, reasoning: ['Alert detected'] },
                prediction: { nextCriticalMoment: 'Watch developments', probability: 50, keyFactors: ['Game evolving'] },
                enhancement: { aiProcessingTime: 0, confidenceScore: 40, enhancementSources: ['fallback'], cacheUsed: false },
                sportSpecificContext: alertResult.context
              };
              return { success: false, alert: fallbackAlert, error: enhancementError };
            }
          });
          
          // Wait for all enhancements to complete (parallel processing)
          const enhancementResults = await Promise.allSettled(enhancementPromises);
          
          // Extract successful alerts and log any failures
          const enhancedAlerts: UnifiedEnhancedAlert[] = [];
          let successCount = 0;
          let fallbackCount = 0;
          
          enhancementResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              enhancedAlerts.push(result.value.alert);
              if (result.value.success) {
                successCount++;
              } else {
                fallbackCount++;
              }
            } else {
              console.error(`❌ Enhancement promise failed for alert ${index}:`, result.reason);
              // Create emergency fallback alert
              const alertResult = alertResults[index];
              enhancedAlerts.push({
                type: alertResult.type,
                sport: gameState.sport,
                gameId: gameState.gameId,
                alertKey: alertResult.alertKey || `${gameState.gameId}_${alertResult.type}_${Date.now()}`,
                priority: alertResult.priority,
                headline: `${sport}: ${alertResult.type}`,
                enhancedMessage: 'Alert detected (emergency fallback)',
                timing: { whyNow: 'Alert triggered', urgencyLevel: 'moderate' as const },
                action: { primaryAction: 'Monitor situation', confidence: 30, reasoning: ['Emergency fallback'] },
                prediction: { nextCriticalMoment: 'Watch developments', probability: 50, keyFactors: ['System recovery'] },
                enhancement: { aiProcessingTime: 0, confidenceScore: 30, enhancementSources: ['emergency-fallback'], cacheUsed: false },
                sportSpecificContext: alertResult.context
              });
              fallbackCount++;
            }
          });
          
          if (this.logLevel !== 'quiet') {
            console.log(`✅ Enhanced ${alertResults.length} alerts: ${successCount} successful, ${fallbackCount} fallback`);
          }

          if (enhancedAlerts && enhancedAlerts.length > 0) {
            if (this.logLevel !== 'quiet') {
              console.log(`✅ Generated ${alertResults.length} alerts for ${sport} game ${gameId} (${gameMonitoringUsers.length} monitoring users)`);
            }

            // Process and persist each weather-enhanced alert
            for (const alertResult of enhancedAlerts) {
              // Create sport-specific stable deduplication key (without Date.now())
              let situationKey: string;
              let alertKeyObj: any;

              if (sport === 'MLB') {
                // MLB-specific situationKey with baseball context
                const baseState = `${game.hasFirst ? '1' : ''}${game.hasSecond ? '2' : ''}${game.hasThird ? '3' : ''}`;
                situationKey = `${gameId}_${alertResult.type}_${game.inning}_${game.isTopInning ? 'top' : 'bot'}_${game.outs}_${baseState}_${game.currentBatter?.name?.replace(/[^a-zA-Z0-9]/g, '') || 'unknown'}`;

                alertKeyObj = {
                  gameId: gameId,
                  type: alertResult.type,
                  inning: game.inning,
                  half: game.isTopInning ? 'top' : 'bottom',
                  outs: game.outs,
                  bases: baseState,
                  batter: game.currentBatter?.name || 'unknown',
                  paId: situationKey
                };
              } else {
                // NFL/NBA/NCAAF/WNBA/CFL - simpler situationKey with sport context
                const quarter = game.quarter || game.period || 1;
                const time = game.timeRemaining || game.time || '15:00';
                const homeScore = game.homeScore || 0;
                const awayScore = game.awayScore || 0;

                situationKey = `${gameId}_${alertResult.type}_Q${quarter}_${time.replace(':', '')}_${homeScore}-${awayScore}`;

                alertKeyObj = {
                  gameId: gameId,
                  type: alertResult.type,
                  quarter: quarter,
                  time: time,
                  homeScore: homeScore,
                  awayScore: awayScore,
                  paId: situationKey
                };
              }

              if (this.deduplication.shouldSendAlert(alertKeyObj)) {
                // Create betbook data
                const betbookData = this.getBetbookData({
                  sport,
                  gameId: game.gameId,
                  homeTeam: game.homeTeam,
                  awayTeam: game.awayTeam,
                  homeScore: game.homeScore,
                  awayScore: game.awayScore,
                  type: alertResult.type,
                  probability: alertResult.priority,
                  inning: game.inning,
                  outs: game.outs
                });

                // Use pre-fetched monitoring users (already checked at game level)
                // Create alert for each user monitoring this game
                for (const userId of gameMonitoringUsers) {
                  try {
                    // 🔒 CRITICAL FIX: Check if this specific user has this alert type enabled
                    const userPrefs = await storage.getUserAlertPreferencesBySport(userId, sport.toUpperCase());
                    const userPref = userPrefs.find(pref => pref.alertType === alertResult.type);
                    
                    // If user has explicit preference, respect it. If no preference, fall back to global settings.
                    let userHasAlertEnabled = false;
                    if (userPref) {
                      // User has explicit preference - respect it
                      userHasAlertEnabled = userPref.enabled === true;
                    } else {
                      // No explicit user preference - check global default
                      userHasAlertEnabled = await this.settingsCache.isAlertEnabled(sport, alertResult.type);
                    }
                    
                    if (!userHasAlertEnabled) {
                      const reason = userPref ? 'explicitly disabled by user' : 'not enabled globally';
                      if (this.logLevel !== 'quiet') {
                        console.log(`🚫 User ${userId} doesn't get ${alertResult.type}: ${reason} - skipping`);
                      }
                      continue; // Skip this user - they don't want this alert type
                    }
                    
                    // CRITICAL: Validate alertResult before processing to prevent constraint violations
                    if (!alertResult || !alertResult.type || !alertResult.alertKey || !alertResult.enhancedMessage) {
                      console.error(`❌ Invalid AlertResult object from ${sport} engine:`, {
                        alertResultExists: !!alertResult,
                        type: alertResult?.type,
                        alertKey: alertResult?.alertKey,
                        enhancedMessage: alertResult?.enhancedMessage,
                        gameId: gameId
                      });
                      continue; // Skip this alert and move to next user
                    }

                    // V3: Enhanced alert data (now unified)
                    const alertData = {
                      alertKey: `${situationKey}_${userId}`,
                      sport: sport,
                      gameId: gameId,
                      type: alertResult.type,
                      state: 'active' as const,
                      score: alertResult.priority || 0,
                      userId: userId,
                      payload: {
                        ...alertResult.sportSpecificContext,
                        message: alertResult.enhancedMessage, // Map enhancedMessage -> message for API compatibility
                        homeTeam: game.homeTeam,
                        awayTeam: game.awayTeam,
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        priority: alertResult.priority,
                        betting: betbookData.odds,
                        aiAdvice: betbookData.aiAdvice,
                        sportsbookLinks: betbookData.sportsbookLinks,
                        // V3: Weather enhancement data
                        weatherContext: alertResult.weather?.impact,
                        isWeatherTriggered: alertResult.weather?.isWeatherTriggered || false,
                        weatherSeverity: alertResult.weather?.severity
                      }
                    };

                    // CRITICAL: Final validation before database insert to prevent constraint violations
                    if (!alertData.type || !alertData.alertKey || !alertData.userId || !alertData.sport) {
                      console.error(`❌ Invalid alertData object before database insert:`, {
                        type: alertData.type,
                        alertKey: alertData.alertKey,
                        userId: alertData.userId,
                        sport: alertData.sport,
                        gameId: alertData.gameId
                      });
                      continue; // Skip this alert
                    }

                    // Check if alert already exists in database before creating
                    try {
                      await storage.createAlert(alertData);
                      totalAlerts++;
                    } catch (error: any) {
                      if (error.code === '23505' && error.constraint === 'ux_alerts_key') {
                        // Alert already exists - this is expected and not an error
                        if (this.logLevel !== 'quiet') {
                          console.log(`🔄 Alert already exists (expected): ${alertData.alertKey}`);
                        }
                        continue; // Skip this alert, move to next user
                      } else {
                        // Re-throw unexpected errors
                        throw error;
                      }
                    }

                    // ✅ Broadcast via SSE AFTER successful database save
                    try {
                      const broadcastFunction = (global as any).broadcastAlertAfterSave;
                      if (broadcastFunction) {
                        console.log(`📡 Broadcasting alert after successful DB save: ${alertResult.type}`);
                        broadcastFunction({
                          type: 'new_alert',
                          alert: {
                            id: alertData.alertKey,
                            alertKey: alertData.alertKey,
                            alertType: alertData.type,
                            type: alertData.type,
                            sport: alertData.sport,
                            gameId: alertData.gameId,
                            score: alertData.score,
                            message: alertResult.enhancedMessage,
                            payload: alertData.payload,
                            createdAt: new Date().toISOString()
                          },
                          timestamp: new Date().toISOString()
                        });
                      } else {
                        console.warn('⚠️ SSE broadcast function not available');
                      }
                    } catch (broadcastError) {
                      console.error(`❌ SSE broadcast failed:`, broadcastError);
                    }

                    // Send Telegram notification if configured
                    try {
                      const user = await storage.getUserById(userId);
                      if (user?.telegramBotToken && user?.telegramChatId) {
                        const telegramConfig = {
                          botToken: user.telegramBotToken,
                          chatId: user.telegramChatId
                        };

                        // Create properly structured alert for Telegram with gameInfo context
                        const telegramAlert = {
                          type: alertData.type,
                          gameInfo: {
                            sport: sport, // Use the sport variable directly
                            awayTeam: game.awayTeam,
                            homeTeam: game.homeTeam,
                            score: {
                              away: game.awayScore,
                              home: game.homeScore
                            },
                            awayScore: game.awayScore,
                            homeScore: game.homeScore,
                            // MLB-specific context - use actual game data
                            inning: game.inning,
                            isTopInning: game.isTopInning, // Use boolean instead of inningState
                            outs: game.outs,
                            balls: game.balls,
                            strikes: game.strikes,
                            runners: game.runners,
                            // Runner flags for compatibility
                            hasFirst: game.runners?.first,
                            hasSecond: game.runners?.second,
                            hasThird: game.runners?.third,
                            // Additional context from alertResult
                            ...alertResult.sportSpecificContext
                          },
                          message: alertResult.enhancedMessage,
                          payload: alertData.payload
                        };

                        await sendTelegramAlert(telegramConfig, telegramAlert);
                      }
                    } catch (telegramError) {
                      console.error(`⚠️ Telegram notification failed for user ${userId}:`, telegramError);
                    }
                  } catch (alertError) {
                    console.error(`❌ Failed to create alert for user ${userId}:`, alertError);
                  }
                }

                // Alert successfully processed and deduplication handled by shouldSendAlert()
              }
            }
          } else {
            // Debug logging if no alerts generated but live games exist
            if (this.logLevel !== 'quiet' && games.length > 0) {
              console.log(`🔍 DEBUG: No alerts generated for ${sport} despite ${games.length} live games`);
            }
          }
        } catch (gameError) {
          console.error(`❌ Error processing ${sport} game ${game.gameId || game.id}:`, gameError);
        }
      }

      return totalAlerts;
    } catch (error) {
      console.error(`❌ Critical error in V3 processGamesWithEngine for ${sport}:`, error);

      // V3: Enhanced error handling - invalidate cache and check service availability
      this.engineStatusCache.delete(sport);
      this.lastEngineStatusCheck = 0;

      // Check if this is a service availability error (non-critical)
      if ((error as Error).message?.includes('not available') || (error as Error).message?.includes('unavailable')) {
        if (this.logLevel !== 'quiet') {
          console.log(`⚠️ ${sport}: Service temporarily unavailable - this is expected in V3 architecture`);
        }
        return 0; // Return 0 alerts instead of throwing
      }

      throw error;
    }
  }

  private async getNFLGames(): Promise<any[]> {
    try {
      if (!this.nflApi) {
        console.error('❌ NFL API service not initialized');
        return [];
      }
      return await this.nflApi.getTodaysGames();
    } catch (error) {
      console.error('❌ Error fetching NFL games:', error);
      return [];
    }
  }

  private async getWNBAGames(): Promise<any[]> {
    try {
      if (!this.wnbaApi) {
        console.error('❌ WNBA API service not initialized');
        return [];
      }
      return await this.wnbaApi.getTodaysGames();
    } catch (error) {
      console.error('❌ Error fetching WNBA games:', error);
      return [];
    }
  }

  private async getCFLGames(): Promise<any[]> {
    try {
      if (!this.cflApi) {
        console.error('❌ CFL API service not initialized');
        return [];
      }
      return await this.cflApi.getTodaysGames();
    } catch (error) {
      console.error('❌ Error fetching CFL games:', error);
      return [];
    }
  }

  private async initializeNFLPollingManager(): Promise<void> {
    try {
      // Polling managed by CalendarSyncService - no separate manager needed
      if (this.logLevel !== 'quiet') {
        console.log('✅ NFL polling managed by CalendarSyncService');
      }
    } catch (error: any) {
      console.error('❌ Error in NFL polling setup:', error?.message || 'Unknown error');
    }
  }

  // DISABLED: Fallback polling method to prevent duplicate API calls
  private async activateFallbackPolling(sport: string): Promise<void> {
    console.log(`🚫 Fallback polling disabled for ${sport} to prevent duplicate API calls`);
    console.log(`🔧 Using CalendarSyncService singleton for all ${sport} data instead`);
    // This method is intentionally disabled to prevent architectural duplication
    return;
  }






}