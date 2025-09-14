import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { storage } from "../storage";
import { AlertDeduplication } from "./alert-deduplication";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";
import { SettingsCache } from "./settings-cache";
import { AdaptivePollingManager } from './adaptive-polling-manager';
import { getHealthMonitor } from './alert-health-monitor';

// Import sport engines
import { MLBEngine } from './engines/mlb-engine';
import { NCAAFEngine } from './engines/ncaaf-engine';
import { WNBAEngine } from './engines/wnba-engine';
import { NFLEngine } from './engines/nfl-engine';
import { CFLEngine } from './engines/cfl-engine';
import { BaseSportEngine, GameState, AlertResult } from './engines/base-engine';

// AI Betting Analysis Engine
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

interface V3Analysis {
  tier: number;
  probability: number;
  reasons: string[];
  recommendation: string;
  confidence: number;
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

// Helper function to generate AI betting insights
function getBetbookData(context: any): BetbookData {
  const { sport, gameId, homeTeam, awayTeam, homeScore, awayScore, type, probability, inning, outs } = context;
  const totalScore = homeScore + awayScore;
  const scoreDiff = homeScore - awayScore;

  // Calculate realistic live betting lines based on current game state
  const currentInning = inning || 5;
  const gameProgress = Math.min(currentInning / 9, 1); // How far through the game

  // Dynamic total calculation based on current pace
  let totalLine: number;
  if (sport === 'MLB') {
    const currentPace = (totalScore / Math.max(currentInning, 1)) * 9;
    const standardTotal = 8.5;
    totalLine = Math.round(((currentPace + standardTotal) / 2) * 2) / 2; // Round to nearest 0.5
    totalLine = Math.max(totalLine, totalScore + 0.5); // Never set below current score
  } else {
    totalLine = Math.max(totalScore + 3, 45);
  }

  // Dynamic odds calculation
  let homeOdds = -110;
  let awayOdds = -110;

  // Adjust for current score difference and game situation
  if (scoreDiff > 0) {
    const advantage = Math.min(scoreDiff * 25 + (gameProgress * 50), 150);
    homeOdds = Math.max(-250, -110 - advantage);
    awayOdds = Math.min(+200, -110 + advantage + 10);
  } else if (scoreDiff < 0) {
    const advantage = Math.min(Math.abs(scoreDiff) * 25 + (gameProgress * 50), 150);
    awayOdds = Math.max(-250, -110 - advantage);
    homeOdds = Math.min(+200, -110 + advantage + 10);
  }

  // Generate contextual AI advice based on actual game situation
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
      { name: 'FanDuel', url: 'https://sportsbook. FanDuel.com' },
      { name: 'DraftKings', url: 'https://sportsbook.draftkings.com' },
      { name: 'Bet365', url: 'https://www.bet365.com' },
      { name: 'BetMGM', url: 'https://sports.betmgm.com' }
    ]
  };
}

// Error recovery configuration
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

export class AlertGenerator {
  private mlbApi: MLBApiService;
  private ncaafApi: NCAAFApiService;
  private wnbaApi: any; // Will be initialized dynamically
  private nflApi: any; // Will be initialized dynamically
  private cflApi: any; // Will be initialized dynamically
  private deduplication: AlertDeduplication;
  private settingsCache: SettingsCache;
  private logLevel: 'verbose' | 'quiet' = 'verbose'; // Default to verbose logging
  private healthMonitor = getHealthMonitor();

  // Error recovery tracking
  private engineFailures: Map<string, EngineFailureRecord> = new Map();
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000,    // 30 seconds
    backoffMultiplier: 2
  };
  private fallbackPollingActive: Map<string, NodeJS.Timeout> = new Map();

  // Sport-specific engines
  private sportEngines: Map<string, BaseSportEngine>;

  // Adaptive polling managers for different sports
  private adaptivePollingManagers: Map<string, AdaptivePollingManager>;

  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
    this.deduplication = new AlertDeduplication();
    this.settingsCache = new SettingsCache(storage);

    // Initialize sport engines
    this.sportEngines = new Map();
    this.sportEngines.set('MLB', new MLBEngine());
    this.sportEngines.set('NCAAF', new NCAAFEngine());
    this.sportEngines.set('WNBA', new WNBAEngine());
    this.sportEngines.set('NFL', new NFLEngine());
    this.sportEngines.set('CFL', new CFLEngine());

    // Initialize adaptive polling managers for each sport
    this.adaptivePollingManagers = new Map();

    // MLB adaptive polling manager
    this.adaptivePollingManagers.set('MLB', new AdaptivePollingManager('MLB', { MLB: this.mlbApi }));

    // NCAAF adaptive polling manager (V3-7)
    this.adaptivePollingManagers.set('NCAAF', new AdaptivePollingManager('NCAAF', { NCAAF: this.ncaafApi }));
    console.log('🏈 NCAAF AdaptivePollingManager initialized with V3-7 intervals');

    // NFL adaptive polling manager - initialize NFL API dynamically when needed
    this.initializeNFLPollingManager();
  }

  // Initialize NFL polling manager with dynamic NFL API and recovery
  private async initializeNFLPollingManager(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { NFLApiService } = await import('./nfl-api');
      const nflApi = new NFLApiService();
      this.nflApi = nflApi;
      this.adaptivePollingManagers.set('NFL', new AdaptivePollingManager('NFL', { NFL: nflApi }));
      console.log('🏈 NFL AdaptivePollingManager initialized with V3-2 intervals');

      // Clear any failure records on successful initialization
      this.engineFailures.delete('NFL');
      this.clearFallbackPolling('NFL');
    } catch (error) {
      console.error('❌ Failed to initialize NFL AdaptivePollingManager:', error);
      await this.handleEngineFailure('NFL', error as Error);
    }
  }

  // Handle sport engine failures with automatic recovery
  private async handleEngineFailure(sport: string, error: Error): Promise<void> {
    const failure = this.engineFailures.get(sport) || {
      sport,
      failureCount: 0,
      lastFailureTime: new Date(),
      isInRecovery: false,
      nextRetryTime: new Date()
    };

    failure.failureCount++;
    failure.lastFailureTime = new Date();

    // Calculate next retry time with exponential backoff
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, failure.failureCount - 1),
      this.retryConfig.maxDelay
    );
    failure.nextRetryTime = new Date(Date.now() + delay);

    this.engineFailures.set(sport, failure);

    // Report to health monitor
    this.healthMonitor.recordError(error);
    this.healthMonitor.recordEngineFailure(sport);

    console.log(`🔧 ${sport} engine failure #${failure.failureCount}. Activating fallback polling. Next retry in ${delay}ms`);

    // Activate fallback polling for this sport
    await this.activateFallbackPolling(sport);

    // Schedule automatic recovery attempt
    if (failure.failureCount <= this.retryConfig.maxRetries) {
      setTimeout(() => this.attemptEngineRecovery(sport), delay);
    } else {
      console.error(`❌ ${sport} engine failed ${failure.failureCount} times. Manual intervention required.`);
      // Continue with fallback polling indefinitely
    }
  }

  // Activate fallback polling for a failed sport
  private async activateFallbackPolling(sport: string): Promise<void> {
    // Clear any existing fallback polling
    this.clearFallbackPolling(sport);

    console.log(`🔄 Activating fallback polling for ${sport}`);
    this.healthMonitor.recordFallbackPolling(sport, true);

    // Create a simple polling mechanism that checks for game updates
    const fallbackInterval = setInterval(async () => {
      try {
        await this.performFallbackCheck(sport);
      } catch (error) {
        console.error(`❌ Fallback polling error for ${sport}:`, error);
        // Don't stop fallback polling on errors
      }
    }, 60000); // Check every minute as fallback

    this.fallbackPollingActive.set(sport, fallbackInterval);
  }

  // Clear fallback polling for a sport
  private clearFallbackPolling(sport: string): void {
    const interval = this.fallbackPollingActive.get(sport);
    if (interval) {
      clearInterval(interval);
      this.fallbackPollingActive.delete(sport);
      console.log(`✅ Cleared fallback polling for ${sport}`);
      this.healthMonitor.recordFallbackPolling(sport, false);
    }
  }

  // Perform basic fallback check for a sport
  private async performFallbackCheck(sport: string): Promise<void> {
    console.log(`📋 Performing fallback check for ${sport}`);

    try {
      // Try to get basic game data depending on sport
      switch (sport) {
        case 'NFL':
          if (this.nflApi) {
            const games = await this.nflApi.getTodaysGames();
            console.log(`📊 Fallback: Found ${games.length} ${sport} games`);
          }
          break;
        case 'WNBA':
          if (this.wnbaApi) {
            const games = await this.wnbaApi.getTodaysGames();
            console.log(`📊 Fallback: Found ${games.length} ${sport} games`);
          }
          break;
        case 'CFL':
          if (this.cflApi) {
            const games = await this.cflApi.getTodaysGames();
            console.log(`📊 Fallback: Found ${games.length} ${sport} games`);
          }
          break;
      }
    } catch (error) {
      console.error(`❌ Fallback check failed for ${sport}:`, error);
    }
  }

  // Attempt to recover a failed engine
  private async attemptEngineRecovery(sport: string): Promise<void> {
    const failure = this.engineFailures.get(sport);
    if (!failure || failure.isInRecovery) return;

    failure.isInRecovery = true;
    this.engineFailures.set(sport, failure);

    console.log(`🔧 Attempting recovery for ${sport} engine (attempt ${failure.failureCount}/${this.retryConfig.maxRetries})`);

    try {
      // Try to reinitialize the specific sport's polling manager
      switch (sport) {
        case 'NFL':
          await this.initializeNFLPollingManager();
          break;
        case 'WNBA':
          await this.initializeWNBAPollingManager();
          break;
        case 'CFL':
          await this.initializeCFLPollingManager();
          break;
        default:
          console.warn(`⚠️ No recovery handler for ${sport}`);
      }

      console.log(`✅ ${sport} engine recovered successfully`);
      this.engineFailures.delete(sport);
      this.clearFallbackPolling(sport);
      this.healthMonitor.recordEngineRecovery(sport);
    } catch (error) {
      failure.isInRecovery = false;
      console.error(`❌ Recovery failed for ${sport}:`, error);
      await this.handleEngineFailure(sport, error as Error);
    }
  }

  // Initialize WNBA polling manager with error recovery
  private async initializeWNBAPollingManager(): Promise<void> {
    try {
      const { WNBAApiService } = await import('./wnba-api');
      const wnbaApi = new WNBAApiService();
      this.wnbaApi = wnbaApi;
      this.adaptivePollingManagers.set('WNBA', new AdaptivePollingManager('WNBA', { WNBA: wnbaApi }));
      console.log('🏀 WNBA AdaptivePollingManager initialized');

      this.engineFailures.delete('WNBA');
      this.clearFallbackPolling('WNBA');
    } catch (error) {
      console.error('❌ Failed to initialize WNBA AdaptivePollingManager:', error);
      await this.handleEngineFailure('WNBA', error as Error);
    }
  }

  // Initialize CFL polling manager with error recovery
  private async initializeCFLPollingManager(): Promise<void> {
    try {
      const { CFLApiService } = await import('./cfl-api');
      const cflApi = new CFLApiService();
      this.cflApi = cflApi;
      this.adaptivePollingManagers.set('CFL', new AdaptivePollingManager('CFL', { CFL: cflApi }));
      console.log('🏈 CFL AdaptivePollingManager initialized');

      this.engineFailures.delete('CFL');
      this.clearFallbackPolling('CFL');
    } catch (error) {
      console.error('❌ Failed to initialize CFL AdaptivePollingManager:', error);
      await this.handleEngineFailure('CFL', error as Error);
    }
  }

  // Check if a specific alert type is globally enabled (CACHED - No DB spam!)
  private async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    // Check master controls from settings cache
    return await this.settingsCache.isAlertEnabled(sport, alertType);
  }

  // Check if ANY alert types are globally enabled across all sports
  private async hasAnyGloballyEnabledAlerts(): Promise<boolean> {
    const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];

    for (const sport of sports) {
      const enabledAlerts = await this.settingsCache.getEnabledAlertTypes(sport);
      if (enabledAlerts.length > 0) {
        return true;
      }
    }

    return false;
  }

  // Generate realistic alerts from today's completed games
  async generateAlertsFromCompletedGames(): Promise<void> {
    // ALL ALERTS HAVE BEEN DISABLED BY USER REQUEST
    console.log('🚫 Alert generation from completed games is disabled - no alerts will be generated');
    return;
  }

  private async generateGameAlerts(game: any): Promise<void> {
    const alerts: AlertData[] = [];

    // Close Game Alert - if final score difference is <= 3
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);
    if (scoreDiff <= 3) {
      alerts.push({
        type: 'CLOSE_GAME',
        sport: 'MLB',
        gameId: game.gameId,
        score: 90 - (scoreDiff * 10), // Higher score for closer games
        payload: JSON.stringify({
          type: 'CLOSE_GAME',
          sport: 'MLB',
          gameId: game.gameId,
          context: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            scoreDifference: scoreDiff
          },
          message: `Close game! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} - Decided by ${scoreDiff} run${scoreDiff !== 1 ? 's' : ''}`,
          situation: `${game.awayTeam} ${game.awayScore}-${game.homeTeam} ${game.homeScore} (${scoreDiff} run game)`
        }),
        alertKey: `${game.gameId}_CLOSE_GAME`,
        state: 'NEW'
      });
    }

    // Save all alerts to database
    for (const alert of alerts) {
      await this.saveAlert(alert);
    }

    if (alerts.length > 0) {
      console.log(`Generated ${alerts.length} alerts for game ${game.gameId}: ${game.awayTeam} vs ${game.homeTeam}`);
      // Track that alerts were generated
      this.healthMonitor.recordAlertGenerated(alerts.length);
    }
  }

  private async saveAlert(alertData: AlertData): Promise<void> {
    try {
      // 🛡️ FAIL-SAFE: Check global settings BEFORE database creation
      const isEnabled = await this.isAlertGloballyEnabled(alertData.sport, alertData.type);
      if (!isEnabled) {
        console.log(`🚫 Alert type ${alertData.type} is globally disabled for ${alertData.sport} - not saving`);
        return;
      }

      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertData.alertKey}, ${alertData.sport}, ${alertData.gameId},
                ${alertData.type}, ${alertData.state}, ${alertData.score}, ${alertData.payload}, NOW())
        ON CONFLICT (alert_key) DO NOTHING
      `);

      // REMOVED: WebSocket broadcast is now handled by asyncAIProcessor.setOnEnhancedAlert in routes.ts
      // This prevents duplicate broadcasts. The alert is sent to AsyncAI for enhancement
      // and then broadcast once from the single broadcast source.
    } catch (error) {
      console.error('Error saving alert:', error);
    }
  }

  // Method to generate alerts for live games (when they're happening)
  async generateLiveGameAlerts(): Promise<void> {
    if (this.logLevel !== 'quiet') {
      console.log('⚡ Real-time monitoring: Checking for live game alerts...');
    }

    // Record health check - we're starting to check for alerts
    this.healthMonitor.recordCheck();

    try {
      // Clear settings cache to ensure fresh sport-specific configurations
      this.settingsCache.clearAll();
      // Cache cleared silently to reduce log noise

      // Check if any alerts are globally enabled before proceeding
      const hasAnyEnabledAlerts = await this.hasAnyGloballyEnabledAlerts().catch(error => {
        console.error('❌ Error checking globally enabled alerts:', error);
        this.healthMonitor.recordError(error);
        return false; // Fail safely
      });

      if (!hasAnyEnabledAlerts) {
        console.log('🚫 No alert types are globally enabled by admin - skipping all alert generation');
        // Still record successful poll even if no alerts are enabled
        this.healthMonitor.recordSuccessfulPoll();
        return;
      }

      // Process each sport only if it has enabled alert types
      const sports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];
      let totalAlerts = 0;

      for (const sport of sports) {
        try {
          // 🎯 STEP 1: Check if sport has globally enabled alerts
          const enabledAlerts = await this.settingsCache.getEnabledAlertTypes(sport).catch(error => {
            console.error(`❌ Error getting ${sport} settings:`, error);
            this.healthMonitor.recordError(error);
            return [];
          });

          if (enabledAlerts.length === 0) {
            // Only log skipped sports for major leagues to reduce console noise
            if (['MLB', 'NFL'].includes(sport)) {
              console.log(`🚫 No ${sport} alert types enabled globally - skipping ${sport} monitoring`);
            }
            continue;
          }

          // 🎯 STEP 2: Check if any users have active monitoring for this sport (NEW OPTIMIZATION)
          const usersWithActiveMonitoring = await this.getUsersWithActiveMonitoring(sport).catch(error => {
            console.error(`❌ Error checking active monitoring for ${sport}:`, error);
            this.healthMonitor.recordError(error);
            return []; // Continue with no users rather than failing
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

          // 🎯 STEP 3: Only fetch game data if users are actively monitoring (OPTIMIZATION!)
          let games: any[] = [];
          try {
            switch (sport) {
              case 'MLB':
                games = await this.mlbApi.getTodaysGames();
                break;
              case 'NFL':
                games = await this.getNFLGames();
                break;
              case 'NCAAF':
                games = await this.ncaafApi.getTodaysGames();
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
            continue; // Skip this sport if API fails
          }

          if (games.length > 0) {
            try {
              const alerts = await this.processGamesWithEngine(sport, games);
              totalAlerts += alerts;
            } catch (processError) {
              console.error(`❌ Error processing ${sport} games:`, processError);
              this.healthMonitor.recordError(processError as Error);
              // Try fallback polling for this sport
              await this.activateFallbackPolling(sport);
            }
          }
        } catch (sportError) {
          console.error(`❌ Sport ${sport} processing failed:`, sportError);
          // Continue with next sport
        }
      }

      if (this.logLevel !== 'quiet') {
        console.log(`📊 Generated ${totalAlerts} total alerts across all sports`);
      }

      // Record health monitoring metrics
      if (totalAlerts > 0) {
        this.healthMonitor.recordAlertGenerated(totalAlerts);
      }
      this.healthMonitor.recordSuccessfulPoll();

    } catch (error: any) {
      console.error('❌ Critical error in generateLiveGameAlerts:', error);
      // Record error in health monitor
      this.healthMonitor.recordError(error);
      // Don't re-throw - this prevents crashes
    }
  }

  private async processSportAlerts(sport: string, enabledAlerts: Record<string, boolean>): Promise<void> {
    if (this.logLevel !== 'quiet') {
      console.log(`🔍 Processing ${sport} alerts...`);
    }

    try {
      const enabledAlertTypes = Object.keys(enabledAlerts).filter(key => enabledAlerts[key]);

      if (enabledAlertTypes.length === 0) {
        // Only log skipped sports for major leagues to reduce console noise
        if (['MLB', 'NFL'].includes(sport)) {
          console.log(`🚫 No ${sport} alert types enabled - skipping ${sport} monitoring`);
        }
        return;
      }

      // Reduce verbosity during routine monitoring cycles
      // Only show essential sport processing information
      if (this.logLevel !== 'quiet') {
        console.log(`✅ ${sport} monitoring: ${enabledAlertTypes.length} alerts enabled`);
      }

      // Get games for this sport
      let games: any[] = [];
      try {
        switch (sport) {
          case 'MLB':
            // Use batch polling for initial game fetch with adaptive cache
            games = await this.mlbApi.getTodaysGames(undefined, 'batch');
            break;
          case 'NFL':
            games = await this.getNFLGames();
            break;
          case 'NCAAF':
            games = await this.ncaafApi.getTodaysGames();
            break;
          case 'WNBA':
            games = await this.getWNBAGames();
            break;
          case 'CFL':
            games = await this.getCFLGames();
            break;
        }
      } catch (gameError) {
        console.error(`❌ Error fetching ${sport} games:`, gameError);
        return;
      }

      if (games.length > 0) {
        try {
          const alerts = await this.processGamesWithEngine(sport, games);
          if (this.logLevel !== 'quiet') {
            console.log(`📊 Generated ${alerts} ${sport} alerts`);
          }
          // Track alerts generated per sport
          if (alerts > 0) {
            this.healthMonitor.recordAlertGenerated(alerts);
          }
        } catch (processError) {
          console.error(`❌ Error processing ${sport} games:`, processError);
        }
      }
    } catch (error) {
      console.error(`❌ Error in ${sport} alert processing:`, error);
    }
  }

  private async processGamesWithEngine(sport: string, games: any[]): Promise<number> {
    let alertCount = 0;
    const engine = this.sportEngines.get(sport);

    if (!engine) {
      console.log(`❌ No engine found for sport: ${sport}`);
      await this.handleEngineFailure(sport, new Error(`No engine available for ${sport}`));
      return 0;
    }

    // 🎯 NEW OPTIMIZED FLOW: Check user preferences FIRST before any game processing
    const usersWithActiveMonitoring = await this.getUsersWithActiveMonitoring(sport).catch(error => {
      console.error(`❌ Error getting active monitoring users for ${sport}:`, error);
      this.healthMonitor.recordError(error);
      return []; // Continue with empty array rather than failing
    });

    if (usersWithActiveMonitoring.length === 0) {
      console.log(`🚫 No users actively monitoring ${sport} games - skipping all processing`);
      return 0;
    }

    // Get the set of games that users are actually monitoring
    const monitoredGameIds = new Set<string>();
    for (const user of usersWithActiveMonitoring) {
      for (const gameId of user.monitoredGameIds) {
        monitoredGameIds.add(gameId);
      }
    }

    // 🎯 ADAPTIVE POLLING: Initialize for supported sports with intelligent intervals
    if ((sport === 'MLB' || sport === 'NFL' || sport === 'NCAAF') && games.length > 0) {
      try {
        const pollingManager = this.adaptivePollingManagers.get(sport);
        if (pollingManager) {
          await pollingManager.initializeGamePolling(games, monitoredGameIds);
          const versionLabel = sport === 'NCAAF' ? 'V3-7' : 'V3-2';
          console.log(`🎯 ${sport} Adaptive polling initialized for ${games.length} games with ${versionLabel} intervals`);
        } else {
          console.log(`⚠️ ${sport} Adaptive polling manager not yet initialized - will set up later`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize ${sport} adaptive polling:`, error);
        // Continue with fallback processing
      }
    }

    // 🎯 OPTIMIZATION: Filter games to only those being monitored BEFORE expensive processing
    const relevantGames = games.filter(game => {
      const gameId = game.gameId || game.id;
      return game.isLive && monitoredGameIds.has(gameId);
    });

    if (relevantGames.length === 0) {
      console.log(`🚫 No live games being monitored by users in ${sport} - skipping processing`);
      return 0;
    }

    if (this.logLevel !== 'quiet') {
      console.log(`🎯 Processing ${relevantGames.length}/${games.length} ${sport} games (only monitored games)`);
      console.log(`👥 Processing for ${usersWithActiveMonitoring.length} users with active monitoring`);
    }

    // Initialize alert cylinders for users with enabled alerts
    for (const userInfo of usersWithActiveMonitoring) {
      try {
        // Initialize user-specific alert cylinders for this sport
        await engine.initializeUserAlertModules(userInfo.enabledAlertTypes);
        if (this.logLevel !== 'quiet') {
          console.log(`🔧 Loaded ${userInfo.enabledAlertTypes.length} alert cylinders for user ${userInfo.username} in ${sport}`);
        }
      } catch (error) {
        console.error(`❌ Error initializing alert cylinders for user ${userInfo.username}:`, error);
      }
    }

    // Process only the relevant games
    for (const game of relevantGames) {
      try {
        const gameState = this.normalizeGameState(game, sport);

        // Process alerts for users monitoring this specific game
        const usersForThisGame = usersWithActiveMonitoring.filter(user => 
          user.monitoredGameIds.includes(gameState.gameId)
        );

        for (const userInfo of usersForThisGame) {
          try {
            if (this.logLevel !== 'quiet') {
              console.log(`✅ User ${userInfo.username} monitoring ${sport} game ${gameState.gameId} - processing alerts`);
            }

            // Initialize engine with this user's specific alert modules
            if ('initializeForUser' in engine) {
              await (engine as any).initializeForUser(userInfo.userId);
            }

            const alerts = await engine.generateLiveAlerts(gameState);

            for (const alert of alerts) {
              const saved = await this.saveRealTimeAlert(
                alert.alertKey,
                alert.type,
                gameState.gameId,
                alert.message,
                alert.context,
                alert.priority,
                sport
              );
              alertCount += saved;
            }
          } catch (userError) {
            console.error(`❌ Error processing ${sport} alerts for user ${userInfo.username}:`, userError);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${sport} game ${game.gameId}:`, error);
      }
    }

    return alertCount;
  }

  // 🎯 NEW METHOD: Pre-filter users and their monitored games for efficient processing
  private async getUsersWithActiveMonitoring(sport: string): Promise<Array<{
    userId: string;
    username: string;
    enabledAlertTypes: string[];
    monitoredGameIds: string[];
  }>> {
    const allUsers = await storage.getAllUsers();
    const usersWithActiveMonitoring = [];

    if (this.logLevel !== 'quiet') {
      console.log(`🔍 Pre-filtering ${allUsers.length} users for active ${sport} monitoring...`);
    }

    for (const user of allUsers) {
      try {
        // First check if user has enabled alert preferences for this sport
        const userPrefs = await storage.getUserAlertPreferencesBySport(user.id, sport.toUpperCase());
        const enabledAlertTypes = userPrefs
          .filter(pref => pref.enabled)
          .map(pref => pref.alertType);

        // Handle inherited defaults for MLB - but respect explicit user disables
        if (enabledAlertTypes.length === 0 && sport === 'MLB') {
          const globalSettings = await storage.getGlobalAlertSettings(sport.toUpperCase());
          const hasAnyEnabledGlobally = Object.values(globalSettings).some(enabled => enabled === true);

          if (hasAnyEnabledGlobally) {
            // Check for explicit user disables first
            const allUserPrefs = await storage.getUserAlertPreferencesBySport(user.id, sport.toUpperCase());
            const explicitlyDisabled = new Set(
              allUserPrefs.filter(pref => pref.enabled === false).map(pref => pref.alertType)
            );

            // User inherits global settings - but exclude explicitly disabled alerts
            const globalEnabledTypes = Object.entries(globalSettings)
              .filter(([alertType, enabled]) => enabled && !explicitlyDisabled.has(alertType))
              .map(([alertType]) => alertType);
            enabledAlertTypes.push(...globalEnabledTypes);

            if (this.logLevel !== 'quiet') {
              console.log(`👤 User ${user.username}: Inherited ${enabledAlertTypes.length} global ${sport} settings (excluded ${explicitlyDisabled.size} user-disabled)`);
            }
          }
        }

        if (enabledAlertTypes.length === 0) {
          if (this.logLevel !== 'quiet') {
            console.log(`👤 User ${user.username}: No ${sport} alerts enabled - skipping`);
          }
          continue;
        }

        // Now check if user is monitoring any games for this sport
        const userMonitoredGames = await storage.getUserMonitoredTeams(user.id);
        const monitoredGameIds = userMonitoredGames
          .filter(game => game.sport === sport)
          .map(game => game.gameId);

        if (monitoredGameIds.length === 0) {
          if (this.logLevel !== 'quiet') {
            console.log(`👤 User ${user.username}: Has ${sport} alerts but no monitored games - skipping`);
          }
          continue;
        }

        // This user has both enabled alerts AND monitored games
        usersWithActiveMonitoring.push({
          userId: user.id,
          username: user.username || `user_${user.id.slice(0, 8)}`,
          enabledAlertTypes,
          monitoredGameIds
        });

        if (this.logLevel !== 'quiet') {
          console.log(`✅ User ${user.username}: Active monitoring - ${enabledAlertTypes.length} alerts, ${monitoredGameIds.length} games`);
        }

      } catch (error) {
        console.error(`❌ Error checking user ${user.username} monitoring status:`, error);
      }
    }

    if (this.logLevel !== 'quiet') {
      console.log(`✅ Found ${usersWithActiveMonitoring.length} users with active ${sport} monitoring`);
    }

    return usersWithActiveMonitoring;
  }

  private normalizeGameState(game: any, sport: string): GameState {
    // Extract common fields and normalize them
    const gameId = game.gameId || game.id;

    // Enhanced team name extraction with multiple fallback strategies
    let homeTeam = 'Home Team';
    let awayTeam = 'Away Team';

    if (typeof game.homeTeam === 'string') {
      homeTeam = game.homeTeam;
    } else if (game.homeTeam && typeof game.homeTeam === 'object') {
      homeTeam = game.homeTeam.displayName ||
                 game.homeTeam.name ||
                 game.homeTeam.teamName ||
                 game.homeTeam.shortDisplayName ||
                 game.homeTeam.abbreviation ||
                 'Home Team';
    }

    if (typeof game.awayTeam === 'string') {
      awayTeam = game.awayTeam;
    } else if (game.awayTeam && typeof game.awayTeam === 'object') {
      awayTeam = game.awayTeam.displayName ||
                 game.awayTeam.name ||
                 game.awayTeam.teamName ||
                 game.awayTeam.shortDisplayName ||
                 game.awayTeam.abbreviation ||
                 'Away Team';
    }

    // Enhanced score extraction
    let homeScore = 0;
    let awayScore = 0;

    if (typeof game.homeScore === 'number') {
      homeScore = game.homeScore;
    } else if (game.homeScore && typeof game.homeScore === 'object') {
      homeScore = game.homeScore.score || game.homeScore.value || 0;
    }

    if (typeof game.awayScore === 'number') {
      awayScore = game.awayScore;
    } else if (game.awayScore && typeof game.awayScore === 'object') {
      awayScore = game.awayScore.score || game.awayScore.value || 0;
    }

    // Preserve critical game data while excluding team objects
    const gameState: GameState = {
      gameId,
      sport,
      homeTeam,  // Use normalized string
      awayTeam,  // Use normalized string  
      homeScore, // Use normalized number
      awayScore, // Use normalized number
      status: game.status || 'live',
      isLive: game.isLive || false,
      // Preserve enhanced live data
      inning: game.inning,
      outs: game.outs,
      balls: game.balls,
      strikes: game.strikes,
      isTopInning: game.isTopInning,
      runners: game.runners,
      hasFirst: game.hasFirst || (game.runners && game.runners.first),
      hasSecond: game.hasSecond || (game.runners && game.runners.second),
      hasThird: game.hasThird || (game.runners && game.runners.third),
      currentBatter: game.currentBatter,
      currentPitcher: game.currentPitcher,
      weather: game.weather,
      // Include other sport-specific fields
      quarter: game.quarter,
      timeRemaining: game.timeRemaining,
      down: game.down,
      yardsToGo: game.yardsToGo,
      fieldPosition: game.fieldPosition,
      possession: game.possession
    };

    return gameState;
  }

  // Helper method to get WNBA games
  private async getWNBAGames(): Promise<any[]> {
    try {
      if (!this.wnbaApi) {
        const { WNBAApiService } = await import('./wnba-api');
        this.wnbaApi = new WNBAApiService();
      }
      return await this.wnbaApi.getTodaysGames();
    } catch (error) {
      console.error('Error fetching WNBA games:', error);
      return [];
    }
  }

  // Helper method to get NFL games
  private async getNFLGames(): Promise<any[]> {
    try {
      if (!this.nflApi) {
        const { NFLApiService } = await import('./nfl-api');
        this.nflApi = new NFLApiService();
      }
      return await this.nflApi.getTodaysGames();
    } catch (error) {
      console.error('Error fetching NFL games:', error);
      return [];
    }
  }

  // Helper method to get CFL games
  private async getCFLGames(): Promise<any[]> {
    try {
      if (!this.cflApi) {
        const { CFLApiService } = await import('./cfl-api');
        this.cflApi = new CFLApiService();
      }
      return await this.cflApi.getTodaysGames();
    } catch (error) {
      console.error('Error fetching CFL games:', error);
      return [];
    }
  }

  // Generate V3 AI Analysis
  private generateV3Analysis(context: any, priority: number, type: string): V3Analysis {
    const tier = Math.ceil(priority / 25); // 1-4 tier system
    const probability = context.scoringProbability || Math.min(95, priority);

    const reasons = [];
    let recommendation = "Monitor situation";
    let confidence = priority;

    // Build analysis reasons based on context
    if (context.hasFirst && context.hasSecond && context.hasThird) {
      reasons.push("Bases loaded - maximum scoring potential");
      recommendation = "Bet Over immediately";
      confidence = Math.min(95, confidence + 10);
    } else if (context.hasSecond || context.hasThird) {
      reasons.push("Runner in scoring position");
      recommendation = "Consider Over bet";
    }

    if (context.outs <= 1) {
      reasons.push(`Only ${context.outs} out${context.outs === 1 ? '' : 's'} - high leverage`);
      confidence += 5;
    }

    // Type-specific analysis
    if (type === 'BASES_LOADED') {
      reasons.push("Historical: 85% chance of at least 1 run scoring");
      recommendation = "STRONG BET: Over current total";
      confidence = Math.min(95, confidence + 15);
    }

    return {
      tier,
      probability,
      reasons: reasons.slice(0, 3), // Keep top 3 reasons
      recommendation,
      confidence: Math.min(95, Math.max(25, confidence))
    };
  }

  private async saveRealTimeAlert(alertKey: string, type: string, gameId: string, message: string, context: any, priority: number | undefined, sport: string = 'MLB'): Promise<number> {
    try {
      // Ensure priority has a default value
      let finalPriority = priority || 50;

      // Check if alert already exists (conflict check)
      const existingAlert = await db.execute(sql`
        SELECT 1 FROM alerts WHERE alert_key = ${alertKey}
      `);

      if (existingAlert.rows.length > 0) {
        return 0; // Alert already exists
      }

      // Generate AI betting insights for ALL alerts (always run AI)
      if (!context.betbookData) {
        try {
          const betbookData = getBetbookData({
            sport: sport,
            gameId: gameId,
            homeTeam: context.homeTeam,
            awayTeam: context.awayTeam,
            homeScore: context.homeScore || 0,
            awayScore: context.awayScore || 0,
            type: type,
            probability: finalPriority,
            inning: context.inning,
            outs: context.outs || 0
          });

          context.betbookData = betbookData;
          if (this.logLevel !== 'quiet') {
            console.log(`🤖 AI: Generated betting insights for ${type} alert (priority: ${finalPriority}) - ${betbookData.aiAdvice}`);
          }
        } catch (error) {
          console.error('❌ AI betting insights generation failed:', error);
        }
      }

      // AI Context Controller takes full control for medium-value alerts and above
      if (finalPriority >= 50) {
        try {
          if (this.logLevel !== 'quiet') {
            console.log(`🤖 AI Context Controller: Taking control of ${type} alert (priority: ${finalPriority})`);
          }

          const alertContext: AlertContext = {
            gameId,
            sport,
            alertType: type,
            priority: finalPriority,
            probability: finalPriority,
            homeTeam: context.homeTeam,
            awayTeam: context.awayTeam,
            homeScore: context.homeScore || 0,
            awayScore: context.awayScore || 0,
            inning: context.inning,
            outs: context.outs,
            balls: context.balls,
            strikes: context.strikes,
            baseRunners: [
              context.hasFirst && '1B',
              context.hasSecond && '2B',
              context.hasThird && '3B'
            ].filter(Boolean),
            weather: context.weather,
            betbookData: context.betbookData,
            recentEvents: context.recentEvents || [],
            playerStats: context.batter || {},
            originalMessage: message,
            originalContext: context
          };

          const aiEnhancedAlert = await this.aiContextController.enhanceAlertWithFullControl(alertContext);

          // PRESERVE ORIGINAL V3 MESSAGE - Don't let AI overwrite it!
          const originalV3Message = message; // Store the perfect V3 format message

          if (aiEnhancedAlert.confidenceScore > finalPriority) {
            // AI has enhanced the alert - ADD insights but KEEP original message
            context.aiMessage = aiEnhancedAlert.message; // Store AI message separately
            context.aiTitle = aiEnhancedAlert.title;
            context.aiInsights = aiEnhancedAlert.insights;
            context.aiRecommendation = aiEnhancedAlert.recommendation;
            context.aiUrgency = aiEnhancedAlert.urgency;
            context.aiBettingAdvice = aiEnhancedAlert.bettingAdvice;
            context.aiGameProjection = aiEnhancedAlert.gameProjection;
            context.aiCallToAction = aiEnhancedAlert.callToAction;
            context.aiFollowUpActions = aiEnhancedAlert.followUpActions;
            context.aiConfidenceScore = aiEnhancedAlert.confidenceScore;
            context.aiProcessingTime = aiEnhancedAlert.aiProcessingTime;

            // Update priority with AI confidence
            finalPriority = Math.min(95, aiEnhancedAlert.confidenceScore);

            if (this.logLevel !== 'quiet') {
              console.log(`✅ AI Context Controller: Enhanced ${type} alert - New priority: ${finalPriority}, Processing: ${aiEnhancedAlert.aiProcessingTime}ms`);
              console.log(`🔥 PRESERVED V3 MESSAGE: ${originalV3Message}`);
            }
          } else {
            if (this.logLevel !== 'quiet') {
              console.log(`📊 AI Context Controller: Alert not enhanced (confidence: ${aiEnhancedAlert.confidenceScore} vs ${finalPriority})`);
            }
          }

          // CRITICAL: Always use the original V3 message for non-AI fields, preserve AI enhancements
          const finalAlert = {
            type,
            sport,
            message: originalV3Message, // Keep the V3 format intact
            title: originalV3Message,   // V3 title
            homeTeam,
            awayTeam,
            priority: finalPriority,
            confidence,
            gameId,
            context: {
              ...context,
              // AI enhancements are preserved in context
              originalV3Message: originalV3Message
            },
            createdAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            id: `${sport}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };

          // CRITICAL: Never override AI content, keep V3 in message field the AI's message
          message = originalV3Message;

        } catch (error) {
          console.error('❌ AI Context Controller failed:', error);
        }
      }

      // Enhanced payload with AI insights and full context
      const enhancedPayload = {
        message,
        context: {
          ...context,
          // Ensure key context fields are always present
          sport: sport,
          gameId: gameId,
          alertType: type,
          priority: finalPriority,
          timestamp: new Date().toISOString(),
          // Add betting context if available
          betbookData: context.betbookData,
          // Add AI context if available (with fallbacks)
          aiTitle: context.aiTitle || null,
          aiInsights: context.aiInsights || [],
          aiBettingAdvice: context.aiBettingAdvice || null,
          aiGameProjection: context.aiGameProjection || null,
          aiRecommendation: context.aiRecommendation || null,
          aiUrgency: context.aiUrgency || null,
          aiCallToAction: context.aiCallToAction || null,
          aiFollowUpActions: context.aiFollowUpActions || [],
          aiConfidenceScore: context.aiConfidenceScore || finalPriority,
          aiProcessingTime: context.aiProcessingTime || 0,
          // Ensure game state context with proper defaults
          homeTeam: context.homeTeam || 'Home Team',
          awayTeam: context.awayTeam || 'Away Team',
          homeScore: context.homeScore || 0,
          awayScore: context.awayScore || 0,
          inning: context.inning || 1,
          outs: context.outs || 0,
          balls: context.balls || 0,
          strikes: context.strikes || 0,
          isTopInning: context.isTopInning !== undefined ? context.isTopInning : true,
          // Base runners with proper defaults
          hasFirst: context.hasFirst || false,
          hasSecond: context.hasSecond || false,
          hasThird: context.hasThird || false
        },
        gameInfo: {
          v3Analysis: this.generateV3Analysis(context, finalPriority, type)
        }
      };

      // No filtering - all alerts pass through

      if (this.logLevel !== 'quiet') {
        console.log(`💾 Saving alert: ${type} for game ${gameId}`);
      }

      // Insert new alert
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertKey}, ${sport}, ${gameId},
                ${type}, 'NEW', ${finalPriority}, ${JSON.stringify(enhancedPayload)}, NOW())
      `);

      if (this.logLevel !== 'quiet') {
        console.log(`🚨 REAL-TIME ALERT: ${message}`);
      }

      // REMOVED: WebSocket broadcast is now handled by asyncAIProcessor.setOnEnhancedAlert in routes.ts
      // This prevents duplicate broadcasts. The alert is sent to AsyncAI for enhancement
      // and then broadcast once from the single broadcast source.

      // DISABLED: Send to Telegram for users monitoring this game
      // ALL TELEGRAM NOTIFICATIONS HAVE BEEN DISABLED
      console.log(`🚫 Telegram notifications disabled for ${type} alert`);
      /*
      try {
        console.log(`📡 LAW #3: Sending ${type} alert to Telegram (priority: ${priority})`);

        const allUsers = await storage.getAllUsers();
        const telegramUsers = allUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);
        console.log(`📱 Found ${telegramUsers.length} users with Telegram configured`);

        for (const user of telegramUsers) {
          console.log(`📱 🔍 Processing Telegram for user: ${user.username}`);

          // RULE 2: Check if globally enabled by admin first
          // No filtering - always send to Telegram

          // RULE 1: Check individual user preferences
          try {
            const userPrefs = await storage.getUserAlertPreferencesBySport(user.id, sport.toUpperCase());
            const userPref = userPrefs.find(p => p.alertType === type);
            // CRITICAL FIX: If user has no preference, default to FALSE (opt-in required!)
            const userHasEnabled = userPref ? userPref.enabled : false;

            if (!userHasEnabled) {
              console.log(`⛔ RULE 1: User ${user.username} has ${type} disabled or not explicitly enabled`);
              continue;
            }
          } catch (prefError) {
            console.error(`❌ Error checking preferences for ${user.username}:`, prefError);
            // No filtering
          }

          const telegramConfig: TelegramConfig = {
            botToken: user.telegramBotToken || '',
            chatId: user.telegramChatId || ''
          };

          const telegramAlert = {
            type,
            title: `${type.replace('_', ' ')} Alert`,
            description: message,
            gameInfo: {
              homeTeam: context.homeTeam,
              awayTeam: context.awayTeam,
              score: { home: context.homeScore, away: context.awayScore },
              inning: context.inning,
              inningState: context.isTopInning ? 'top' : 'bottom',
              outs: context.outs,
              balls: context.balls,
              strikes: context.strikes,
              runners: {
                first: context.hasFirst,
                second: context.hasSecond,
                third: context.hasThird
              },
              weather: context.weather
            }
          };

          try {
            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
            if (sent) {
              console.log(`📱 ✅ ${type} Telegram alert sent successfully to user ${user.username}`);
            } else {
              console.log(`📱 ❌ Failed to send ${type} Telegram alert to user ${user.username}`);
            }
          } catch (telegramError) {
            console.error(`📱 ❌ Telegram error for ${type} alert to user ${user.username}:`, telegramError);
          }
        }
      } catch (telegramError) {
        console.error('Error sending Telegram alerts:', telegramError);
      }
      */

      return 1;
    } catch (error) {
      console.error('Error saving real-time alert:', error);
      return 0;
    }
  }

  // Helper to refresh user engines when preferences or new users change
  private async refreshUserEngines(): Promise<void> {
    const allUsers = await storage.getAllUsers();
    const usersWithPrefs = [];

    for (const user of allUsers) {
      const userAlertPreferences = await storage.getUserAlertPreferences(user.id);
      if (userAlertPreferences && userAlertPreferences.length > 0) {
        usersWithPrefs.push({ id: user.id, username: user.username });
      }
    }

    // Initialize sport-specific engines for users with enabled preferences
    for (const user of usersWithPrefs) {
      try {
        // Initialize engines for all supported sports
        const supportedSports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];

        for (const sport of supportedSports) {
          try {
            // Check if user has any preferences for this sport
            const userPrefs = await storage.getUserAlertPreferencesBySport(user.id, sport);
            const hasEnabledAlerts = userPrefs.some(pref => pref.enabled);

            if (hasEnabledAlerts || userPrefs.length === 0) {
              // Initialize engine for this sport
              switch (sport) {
                case 'MLB':
                  const { MLBEngine } = await import('./engines/mlb-engine');
                  const mlbEngine = new MLBEngine();
                  await mlbEngine.initializeForUser(user.id);
                  this.sportEngines.set(`${user.id}_MLB`, mlbEngine);
                  break;

                case 'NFL':
                  const { NFLEngine } = await import('./engines/nfl-engine');
                  const nflEngine = new NFLEngine();
                  await nflEngine.initializeForUser(user.id);
                  this.sportEngines.set(`${user.id}_NFL`, nflEngine);
                  break;

                case 'NCAAF':
                  const { NCAAFEngine } = await import('./engines/ncaaf-engine');
                  const ncaafEngine = new NCAAFEngine();
                  await ncaafEngine.initializeForUser(user.id);
                  this.sportEngines.set(`${user.id}_NCAAF`, ncaafEngine);
                  break;

                case 'WNBA':
                  const { WNBAEngine } = await import('./engines/wnba-engine');
                  const wnbaEngine = new WNBAEngine();
                  await wnbaEngine.initializeForUser(user.id);
                  this.sportEngines.set(`${user.id}_WNBA`, wnbaEngine);
                  break;

                case 'CFL':
                  const { CFLEngine } = await import('./engines/cfl-engine');
                  const cflEngine = new CFLEngine();
                  await cflEngine.initializeForUser(user.id);
                  this.sportEngines.set(`${user.id}_CFL`, cflEngine);
                  break;
              }

              if (this.logLevel !== 'quiet') {
                console.log(`✅ Initialized ${sport} engine for user ${user.username}`);
              }
            }
          } catch (sportError) {
            console.error(`❌ Failed to initialize ${sport} engine for user ${user.id}:`, sportError);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to initialize engines for user ${user.id}:`, error);
      }
    }
  }

  // Process alerts for a specific sport
  private async processSport(sport: string): Promise<number> {
    let totalAlerts = 0;

    if (this.logLevel !== 'quiet') {
      console.log(`🚀 Processing ${sport} alerts...`);
    }

    // Get globally enabled alerts for this sport
    const enabledAlerts = await this.settingsCache.getEnabledAlertTypes(sport);

    if (enabledAlerts.length === 0) {
      if (['MLB', 'NFL'].includes(sport)) {
        console.log(`🚫 No ${sport} alerts enabled globally - skipping ${sport} monitoring.`);
      }
      return 0;
    }

    // Fetch games for the sport
    let games: any[] = [];
    try {
      switch (sport) {
        case 'MLB':
          games = await this.mlbApi.getTodaysGames();
          break;
        case 'NFL':
          games = await this.getNFLGames();
          break;
        case 'NCAAF':
          games = await this.ncaafApi.getTodaysGames();
          break;
        case 'WNBA':
          games = await this.getWNBAGames();
          break;
        case 'CFL':
          games = await this.getCFLGames();
          break;
        default:
          if (this.logLevel !== 'quiet') {
            console.log(`ℹ️ No game fetching logic defined for ${sport}.`);
          }
          return 0;
      }
    } catch (error) {
      console.error(`❌ Error fetching ${sport} games:`, error);
      return 0;
    }

    if (games.length === 0) {
      if (this.logLevel !== 'quiet') {
        console.log(`📊 No live games found for ${sport} today.`);
      }
      return 0;
    }

    if (this.logLevel !== 'quiet') {
      console.log(`✅ Found ${games.length} live games for ${sport}.`);
    }

    // Debug WNBA games specifically
    if (sport === 'WNBA' && games.length > 0) {
      console.log(`🏀 WNBA Games Found: ${games.length}`);
      games.forEach((game, index) => {
        console.log(`  Game ${index + 1}: ${game.awayTeam} @ ${game.homeTeam} - Status: ${game.status} - Live: ${game.isLive}`);
      });
    }

    // Process each live game
    for (const game of games) {
      try {
        const gameState = this.normalizeGameState(game, sport);
        const engine = this.sportEngines.get(sport);

        if (!engine) {
          console.log(`❌ No engine found for sport: ${sport}`);
          continue;
        }

        const alerts = await engine.generateLiveAlerts(gameState);
        totalAlerts += alerts.length;

        for (const alert of alerts) {
          await this.saveRealTimeAlert(
            alert.alertKey,
            alert.type,
            gameState.gameId,
            alert.message,
            alert.context,
            alert.priority,
            sport
          );
        }
      } catch (error) {
        console.error(`❌ Error processing ${sport} game ${game.gameId}:`, error);
      }
    }

    if (this.logLevel !== 'quiet') {
      console.log(`📊 ${sport}: Processed ${games.length} games, generated ${totalAlerts} alerts.`);
    }

    return totalAlerts;
  }

  // Main monitoring loop
  async runMonitoringCycle(): Promise<void> {
    try {
      if (this.logLevel !== 'quiet') {
        console.log('⚡ Real-time monitoring: Checking for live game alerts...');
      }

      // Check for any new users or preference changes
      await this.refreshUserEngines();

      let totalAlerts = 0;

      // Process all supported sports explicitly
      const allSports = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'CFL'];

      for (const sport of allSports) {
        try {
          const sportAlerts = await this.processSport(sport);
          totalAlerts += sportAlerts;
        } catch (sportError) {
          console.error(`❌ Error processing ${sport}:`, sportError);
        }
      }

      if (this.logLevel !== 'quiet') {
        console.log(`📊 Generated ${totalAlerts} total alerts across all sports`);
      }

    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error);
    }
  }

  async destroy() {
    this.deduplication.destroy();
  }
}