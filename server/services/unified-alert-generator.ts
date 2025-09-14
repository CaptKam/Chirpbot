import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { NFLApiService } from "./nfl-api";
import { WNBAApiService } from "./wnba-api";
import { CFLApiService } from "./cfl-api";
import { storage } from "../storage";
import { unifiedDeduplicator } from "./unified-deduplicator";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";
import { SettingsCache } from "./settings-cache";
import { AdaptivePollingManager } from './adaptive-polling-manager';
import { getHealthMonitor } from './unified-health-monitor';
import type { InsertAlert } from "../../shared/schema";

// Import sport engines
import { MLBEngine } from './engines/mlb-engine';
import { NCAAFEngine } from './engines/ncaaf-engine';
import { WNBAEngine } from './engines/wnba-engine';
import { NFLEngine } from './engines/nfl-engine';
import { CFLEngine } from './engines/cfl-engine';
import { BaseSportEngine, GameState, AlertResult } from './engines/base-engine';

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

interface DemoAlertPayload {
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  inning?: number;
  isTopInning?: boolean;
  priority?: number;
  confidence?: number;
  message?: string;
  context?: string;
  aiAdvice?: string;
  betting?: {
    home?: number;
    away?: number;
    total?: number;
  };
  [key: string]: any;
}

interface UnifiedAlertGeneratorOptions {
  mode: 'production' | 'demo';
  demoUserId?: string;
  logLevel?: 'verbose' | 'quiet';
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface EngineFailureRecord {
  sport: string;
  failureCount: number;
  lastFailureTime: Date;
  isInRecovery: boolean;
  nextRetryTime: Date;
}

// === UNIFIED ALERT GENERATOR ===

export class UnifiedAlertGenerator {
  private mode: 'production' | 'demo';
  private demoUserId?: string;
  private logLevel: 'verbose' | 'quiet' = 'verbose';

  // Production-only services
  private mlbApi?: MLBApiService;
  private ncaafApi?: NCAAFApiService;
  private wnbaApi?: WNBAApiService;
  private nflApi?: NFLApiService;
  private cflApi?: CFLApiService;
  private deduplication = unifiedDeduplicator;
  private settingsCache?: SettingsCache;
  private healthMonitor?: any;

  // Error recovery tracking (production only)
  private engineFailures: Map<string, EngineFailureRecord> = new Map();
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  };
  private fallbackPollingActive: Map<string, NodeJS.Timeout> = new Map();

  // Sport engines (production only)
  private sportEngines?: Map<string, BaseSportEngine>;
  private adaptivePollingManagers?: Map<string, AdaptivePollingManager>;

  constructor(options: UnifiedAlertGeneratorOptions) {
    this.mode = options.mode;
    this.demoUserId = options.demoUserId;
    this.logLevel = options.logLevel || 'verbose';

    if (this.mode === 'production') {
      this.initializeProductionServices();
    } else if (this.mode === 'demo') {
      if (!this.demoUserId) {
        throw new Error('Demo mode requires demoUserId');
      }
    }
  }

  private initializeProductionServices(): void {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
    this.nflApi = new NFLApiService();
    this.wnbaApi = new WNBAApiService();
    this.cflApi = new CFLApiService();
    this.settingsCache = new SettingsCache(storage);
    this.healthMonitor = getHealthMonitor();
    
    // Initialize health monitor with callback integration
    this.healthMonitor.initialize({
      pollingIntervalMs: 30000,
      callbacks: {
        onRestart: () => this.startMonitoring(),
        onStop: () => this.stopMonitoring(),
        generatorLabel: 'unified-alert-generator'
      }
    });

    // Initialize sport engines
    this.sportEngines = new Map();
    this.sportEngines.set('MLB', new MLBEngine());
    this.sportEngines.set('NCAAF', new NCAAFEngine());
    this.sportEngines.set('WNBA', new WNBAEngine());
    this.sportEngines.set('NFL', new NFLEngine());
    this.sportEngines.set('CFL', new CFLEngine());

    // Initialize adaptive polling managers
    this.adaptivePollingManagers = new Map();
    this.adaptivePollingManagers.set('MLB', new AdaptivePollingManager('MLB', { MLB: this.mlbApi }));
    this.adaptivePollingManagers.set('NCAAF', new AdaptivePollingManager('NCAAF', { NCAAF: this.ncaafApi }));

    // Initialize other polling managers
    this.initializeNFLPollingManager();
  }

  // === PUBLIC API METHODS ===

  getMode(): 'production' | 'demo' {
    return this.mode;
  }

  async generateLiveGameAlerts(): Promise<number> {
    if (this.mode === 'demo') {
      console.log('🚫 Demo mode: generateLiveGameAlerts disabled. Use generateAllDemoAlerts() instead.');
      return 0;
    }

    return this.runProductionPipeline();
  }

  async generateAllDemoAlerts(): Promise<void> {
    if (this.mode === 'production') {
      console.log('🚫 Production mode: generateAllDemoAlerts disabled. Use generateLiveGameAlerts() instead.');
      return;
    }

    return this.runDemoSeed();
  }

  async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    if (this.mode === 'demo') {
      return true; // Demo mode allows all alerts
    }

    if (!this.settingsCache) {
      console.error('Settings cache not initialized in production mode');
      return false;
    }

    return this.settingsCache.isAlertEnabled(sport, alertType);
  }

  async startMonitoring(): Promise<void> {
    if (this.mode === 'demo') {
      console.log('🚫 Demo mode: No monitoring needed. Use generateAllDemoAlerts() to populate demo data.');
      return;
    }

    console.log('⚡ Starting production alert monitoring...');
    // Implementation would start adaptive polling managers
  }

  async stopMonitoring(): Promise<void> {
    if (this.mode === 'demo') {
      return;
    }

    console.log('🛑 Stopping production alert monitoring...');
    // Clear all fallback polling intervals
    for (const [sport, interval] of this.fallbackPollingActive) {
      clearInterval(interval);
    }
    this.fallbackPollingActive.clear();
  }

  getStats(): any {
    if (this.mode === 'demo') {
      return { mode: 'demo', demoUserId: this.demoUserId };
    }

    return {
      mode: 'production',
      engineFailures: this.engineFailures.size,
      fallbackPollingActive: this.fallbackPollingActive.size,
      healthMonitor: this.healthMonitor?.getHealthStatus() || null
    };
  }

  getPerformanceMetrics(): any {
    if (this.mode === 'demo') {
      return { mode: 'demo', metrics: 'disabled' };
    }

    return this.healthMonitor?.getPerformanceMetrics() || {};
  }

  // === PRODUCTION PIPELINE ===

  private async runProductionPipeline(): Promise<number> {
    if (this.logLevel !== 'quiet') {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
    }

    this.healthMonitor?.recordCheck();

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

      // Process each sport
      const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
      let totalAlerts = 0;

      for (const sport of sports) {
        try {
          const enabledAlerts = await this.settingsCache!.getEnabledAlertTypes(sport).catch(error => {
            console.error(`❌ Error getting ${sport} settings:`, error);
            this.healthMonitor?.recordError(error);
            return [];
          });

          if (enabledAlerts.length === 0) {
            if (['MLB', 'NFL'].includes(sport)) {
              console.log(`🚫 No ${sport} alert types enabled globally - skipping ${sport} monitoring`);
            }
            continue;
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
            continue;
          }

          if (this.logLevel !== 'quiet') {
            console.log(`✅ ${sport} monitoring: ${enabledAlerts.length} alerts enabled, ${usersWithActiveMonitoring.length} active users`);
          }

          let games: any[] = [];
          try {
            switch (sport) {
              case 'MLB':
                games = await this.mlbApi!.getTodaysGames();
                break;
              case 'NFL':
                games = await this.getNFLGames();
                break;
              case 'NCAAF':
                games = await this.ncaafApi!.getTodaysGames();
                break;
              case 'WNBA':
                games = await this.getWNBAGames();
                break;
              case 'CFL':
                games = await this.getCFLGames();
                break;
            }

            if (this.logLevel !== 'quiet') {
              console.log(`📊 Fetched ${games.length} ${sport} games from API`);
            }
          } catch (gameError) {
            console.error(`❌ Error fetching ${sport} games:`, gameError);
            continue;
          }

          if (games.length > 0) {
            try {
              const alerts = await this.processGamesWithEngine(sport, games);
              totalAlerts += alerts;
            } catch (processError) {
              console.error(`❌ Error processing ${sport} games:`, processError);
              this.healthMonitor?.recordError(processError as Error);
              await this.activateFallbackPolling(sport);
            }
          }
        } catch (sportError) {
          console.error(`❌ Sport ${sport} processing failed:`, sportError);
        }
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

  // === DEMO PIPELINE ===

  private async runDemoSeed(): Promise<void> {
    console.log('🎯 Starting demo alert generation for user:', this.demoUserId);
    
    // Clear existing demo alerts first
    await storage.clearDemoAlerts();
    
    const alerts: Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> = [
      ...this.getMLBDemoAlerts(),
      ...this.getNFLDemoAlerts(), 
      ...this.getNBADemoAlerts(),
      ...this.getNCAAFDemoAlerts(),
      ...this.getWNBADemoAlerts(),
      ...this.getCFLDemoAlerts()
    ];

    // Create alerts with staggered timestamps
    for (let i = 0; i < alerts.length; i++) {
      const alertData = {
        ...alerts[i],
        userId: this.demoUserId!
      };
      
      await storage.createDemoAlert(alertData);
      
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`✅ Generated ${alerts.length} demo alerts successfully`);
  }

  // === SHARED HELPER METHODS ===

  private normalizeGameState(game: any, sport: string): GameState {
    return {
      gameId: game.gameId || game.id,
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

  // === PRODUCTION-ONLY HELPER METHODS ===

  private async hasAnyGloballyEnabledAlerts(): Promise<boolean> {
    if (this.mode === 'demo') return true;
    
    const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
    for (const sport of sports) {
      const enabledAlerts = await this.settingsCache!.getEnabledAlertTypes(sport);
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
      const gameSpecificMonitoring = allMonitoredGames.filter(game => 
        game.sport === sport && game.gameId === gameId
      );
      
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

  private async processGamesWithEngine(sport: string, games: any[]): Promise<number> {
    if (this.mode === 'demo') return 0;
    
    let totalAlerts = 0;
    const engine = this.sportEngines?.get(sport);
    
    if (!engine) {
      console.error(`❌ No engine found for sport ${sport}`);
      return 0;
    }
    
    try {
      // Get enabled alert types for this sport
      const enabledAlerts = await this.settingsCache!.getEnabledAlertTypes(sport);
      
      // Initialize the engine with user alert modules
      await engine.initializeUserAlertModules(enabledAlerts);
      
      // Process each game
      for (const game of games) {
        if (!game.isLive) continue; // Only process live games
        
        try {
          // OPTIMIZATION: Check monitoring users FIRST (before alert processing)
          const gameMonitoringUsers = await this.getUsersMonitoringGame(sport, game.gameId);
          
          // Skip entire alert processing if no users monitoring this game
          if (gameMonitoringUsers.length === 0) {
            if (this.logLevel !== 'quiet') {
              console.log(`⏭️  Skipping ${sport} game ${game.gameId} - no users monitoring`);
            }
            continue;
          }
          
          // Convert game data to GameState format
          const gameState = this.normalizeGameState(game, sport);
          
          // Generate alerts using the sport engine
          const alertResults = await engine.generateLiveAlerts(gameState);
          
          if (alertResults && alertResults.length > 0) {
            if (this.logLevel !== 'quiet') {
              console.log(`✅ Generated ${alertResults.length} alerts for ${sport} game ${game.gameId} (${gameMonitoringUsers.length} monitoring users)`);
            }
            
            // Process and persist each alert
            for (const alertResult of alertResults) {
              // Create stable deduplication key (without Date.now())
              const baseState = `${game.hasFirst ? '1' : ''}${game.hasSecond ? '2' : ''}${game.hasThird ? '3' : ''}`;
              const situationKey = `${game.gameId}_${alertResult.type}_${game.inning}_${game.isTopInning ? 'top' : 'bot'}_${game.outs}_${baseState}_${game.currentBatter?.name?.replace(/[^a-zA-Z0-9]/g, '') || 'unknown'}`;
              
              // Check deduplication using UnifiedDeduplicator
              const alertKeyObj = {
                gameId: game.gameId,
                type: alertResult.type,
                inning: game.inning,
                half: game.isTopInning ? 'top' : 'bottom',
                outs: game.outs,
                bases: baseState,
                batter: game.currentBatter?.name || 'unknown',
                paId: situationKey  // Use stable key for deduplication
              };
              
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
                    const alertData = {
                      alertKey: `${situationKey}_${userId}`,
                      sport: sport,
                      gameId: game.gameId,
                      type: alertResult.type,
                      state: 'active' as const,
                      userId: userId,
                      payload: {
                        ...alertResult.context,
                        message: alertResult.message,
                        homeTeam: game.homeTeam,
                        awayTeam: game.awayTeam,
                        homeScore: game.homeScore,
                        awayScore: game.awayScore,
                        priority: alertResult.priority,
                        betting: betbookData.odds,
                        aiAdvice: betbookData.aiAdvice,
                        sportsbookLinks: betbookData.sportsbookLinks
                      }
                    };
                    
                    // Persist the alert
                    await storage.createAlert(alertData);
                    totalAlerts++;
                    
                    // Send Telegram notification if configured
                    try {
                      const user = await storage.getUserById(userId);
                      if (user?.telegramBotToken && user?.telegramChatId) {
                        const telegramConfig = {
                          botToken: user.telegramBotToken,
                          chatId: user.telegramChatId
                        };
                        await sendTelegramAlert(telegramConfig, alertData);
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
          }
        } catch (gameError) {
          console.error(`❌ Error processing ${sport} game ${game.gameId}:`, gameError);
        }
      }
      
      return totalAlerts;
    } catch (error) {
      console.error(`❌ Critical error in processGamesWithEngine for ${sport}:`, error);
      throw error;
    }
  }

  private async getNFLGames(): Promise<any[]> {
    if (this.mode === 'demo') return [];
    
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
    if (this.mode === 'demo') return [];
    
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
    if (this.mode === 'demo') return [];
    
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
    if (this.mode === 'demo') return;
    
    try {
      if (this.nflApi && this.adaptivePollingManagers) {
        this.adaptivePollingManagers.set('NFL', new AdaptivePollingManager('NFL', { NFL: this.nflApi }));
        if (this.logLevel !== 'quiet') {
          console.log('✅ NFL polling manager initialized');
        }
      }
    } catch (error) {
      console.error('❌ Error initializing NFL polling manager:', error);
    }
  }

  private async activateFallbackPolling(sport: string): Promise<void> {
    if (this.mode === 'demo') return;
    
    try {
      // Clear any existing fallback polling for this sport
      const existingInterval = this.fallbackPollingActive.get(sport);
      if (existingInterval) {
        clearInterval(existingInterval);
      }
      
      // Set up fallback polling with exponential backoff
      const failureRecord = this.engineFailures.get(sport);
      const retryDelay = Math.min(
        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, failureRecord?.failureCount || 0),
        this.retryConfig.maxDelay
      );
      
      console.log(`🔄 Activating fallback polling for ${sport} with ${retryDelay}ms interval`);
      
      const interval = setInterval(async () => {
        try {
          console.log(`⚡ Fallback polling: Checking ${sport} alerts...`);
          
          // Try to generate alerts for this sport
          let games: any[] = [];
          switch (sport) {
            case 'MLB':
              games = await this.mlbApi!.getTodaysGames();
              break;
            case 'NFL':
              games = await this.getNFLGames();
              break;
            case 'NCAAF':
              games = await this.ncaafApi!.getTodaysGames();
              break;
            case 'WNBA':
              games = await this.getWNBAGames();
              break;
            case 'CFL':
              games = await this.getCFLGames();
              break;
          }
          
          if (games.length > 0) {
            const alerts = await this.processGamesWithEngine(sport, games);
            if (alerts > 0) {
              console.log(`✅ Fallback polling recovered for ${sport}: ${alerts} alerts generated`);
              // Clear the failure record and stop fallback polling
              this.engineFailures.delete(sport);
              clearInterval(interval);
              this.fallbackPollingActive.delete(sport);
            }
          }
        } catch (error) {
          console.error(`❌ Fallback polling failed for ${sport}:`, error);
          // Update failure record
          const record = this.engineFailures.get(sport) || {
            sport,
            failureCount: 0,
            lastFailureTime: new Date(),
            isInRecovery: true,
            nextRetryTime: new Date(Date.now() + retryDelay)
          };
          record.failureCount++;
          record.lastFailureTime = new Date();
          this.engineFailures.set(sport, record);
          
          // Stop fallback polling if we've exceeded max retries
          if (record.failureCount >= this.retryConfig.maxRetries) {
            console.error(`❌ Fallback polling exhausted for ${sport} after ${this.retryConfig.maxRetries} attempts`);
            clearInterval(interval);
            this.fallbackPollingActive.delete(sport);
          }
        }
      }, retryDelay);
      
      this.fallbackPollingActive.set(sport, interval);
    } catch (error) {
      console.error(`❌ Error setting up fallback polling for ${sport}:`, error);
    }
  }

  // === DEMO ALERT GENERATORS ===

  private getMLBDemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_mlb_bases_loaded_001',
        sport: 'MLB',
        gameId: 'demo_game_mlb_001',
        type: 'BASES_LOADED_NO_OUTS',
        state: 'active',
        score: 94,
        payload: {
          homeTeam: 'New York Yankees',
          awayTeam: 'Boston Red Sox',
          homeScore: 4,
          awayScore: 3,
          inning: 8,
          isTopInning: false,
          priority: 94,
          confidence: 87,
          message: 'BASES LOADED, 0 OUTS! Yankees threatening in bottom 8th.',
          context: '2-1 count, Aaron Judge at bat, 85% historical scoring rate',
          aiAdvice: 'Strong OVER 8.5 value. Yankees excel in clutch situations. Live momentum shift opportunity.',
          betting: { home: -140, away: +120, total: 8.5 }
        }
      },
      {
        alertKey: 'demo_mlb_walk_off_setup',
        sport: 'MLB',
        gameId: 'demo_game_mlb_003',
        type: 'WALK_OFF_OPPORTUNITY',
        state: 'active',
        score: 96,
        payload: {
          homeTeam: 'Chicago Cubs',
          awayTeam: 'Milwaukee Brewers',
          homeScore: 5,
          awayScore: 6,
          inning: 9,
          isTopInning: false,
          priority: 96,
          confidence: 89,
          message: 'WALK-OFF SETUP! Runner on 3rd, 1 out. Cubs down by 1.',
          context: 'Seiya Suzuki batting .340 in clutch situations',
          aiAdvice: 'CHC ML +180 offers massive value. Historical walk-off rate: 32%',
          betting: { home: +180, away: -220, total: 9.5 }
        }
      }
    ];
  }

  private getNFLDemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_nfl_red_zone_001',
        sport: 'NFL',
        gameId: 'demo_game_nfl_001',
        type: 'RED_ZONE_OPPORTUNITY',
        state: 'active',
        score: 88,
        payload: {
          homeTeam: 'Kansas City Chiefs',
          awayTeam: 'Buffalo Bills',
          homeScore: 14,
          awayScore: 10,
          priority: 88,
          confidence: 82,
          message: 'RED ZONE! Chiefs 1st & Goal at the 5-yard line.',
          context: 'Patrick Mahomes 85% TD rate inside the 10',
          aiAdvice: 'KC anytime TD prop +110 shows strong value.',
          betting: { home: -140, away: +120, total: 47.5 }
        }
      }
    ];
  }

  private getNBADemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_nba_clutch_001',
        sport: 'NBA',
        gameId: 'demo_game_nba_001',
        type: 'CLUTCH_PERFORMANCE',
        state: 'active',
        score: 92,
        payload: {
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Boston Celtics',
          homeScore: 108,
          awayScore: 106,
          priority: 92,
          confidence: 88,
          message: 'CLUTCH TIME! LeBron James 30 pts, 2 min remaining.',
          context: 'Lakers down 2, LeBron shooting 60% in clutch this season',
          aiAdvice: 'LAL ML +130 trending. LeBron props all showing value.',
          betting: { home: +130, away: -150, total: 218.5 }
        }
      }
    ];
  }

  private getNCAAFDemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_ncaaf_upset_001',
        sport: 'NCAAF',
        gameId: 'demo_game_ncaaf_001',
        type: 'UPSET_OPPORTUNITY',
        state: 'active',
        score: 85,
        payload: {
          homeTeam: 'App State',
          awayTeam: 'North Carolina',
          homeScore: 21,
          awayScore: 14,
          priority: 85,
          confidence: 79,
          message: 'UPSET ALERT! App State leads ranked UNC 21-14.',
          context: '4th quarter, App State driving in red zone',
          aiAdvice: 'APP ST ML +280 was the bet. Now +140 live.',
          betting: { home: +140, away: -160, total: 56.5 }
        }
      }
    ];
  }

  private getWNBADemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_wnba_clutch_001',
        sport: 'WNBA',
        gameId: 'demo_game_wnba_001',
        type: 'CLUTCH_TIME_OPPORTUNITY',
        state: 'active',
        score: 87,
        payload: {
          homeTeam: 'Las Vegas Aces',
          awayTeam: 'New York Liberty',
          homeScore: 78,
          awayScore: 76,
          priority: 87,
          confidence: 83,
          message: 'CLUTCH TIME! A\'ja Wilson 28 pts, 3 min left.',
          context: 'Aces down 2, Wilson perfect from FT line tonight',
          aiAdvice: 'LV ML +110 trending up. Wilson props showing value.',
          betting: { home: +110, away: -130, total: 162.5 }
        }
      }
    ];
  }

  private getCFLDemoAlerts(): Array<Omit<InsertAlert, 'isDemo'> & { payload: DemoAlertPayload }> {
    return [
      {
        alertKey: 'demo_cfl_rouge_001',
        sport: 'CFL',
        gameId: 'demo_game_cfl_001',
        type: 'ROUGE_OPPORTUNITY',
        state: 'active',
        score: 75,
        payload: {
          homeTeam: 'Toronto Argonauts',
          awayTeam: 'Montreal Alouettes',
          homeScore: 24,
          awayScore: 23,
          priority: 75,
          confidence: 70,
          message: 'ROUGE SETUP! 55-yard FG attempt for the win.',
          context: 'Wind at kicker\'s back, 82% accuracy from 50+',
          aiAdvice: 'TOR ML -110 solid value. Unique CFL scoring opportunity.',
          betting: { home: -110, away: -110, total: 48.5 }
        }
      }
    ];
  }
}