// mlb-engine-v3.ts
//
// ChirpBot v3 compliant MLB engine implementing mandatory alert engine laws:
// - Game status gating (only live games)
// - 4-tier alert system (L1-L4) with decision rules
// - User settings override
// - Advanced deduplication with context-aware keys
// - MLB scoring probability model integration
// - Betbook engine integration

import { storage } from '../../storage';
import { mlbApi } from '../mlb-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { getWeatherData } from '../weather';
import { calculateMLBSeverity, mlbL1WithProb, mlbL2WithProb, mlbL3WithProb, type MLBGameState as MLBScoringGameState } from './mlb-alert-model';
import { shouldNotifyUser, type UserSettings } from './user-settings';
import { getBetbookData, shouldShowBetbook, type AlertContext } from './betbook-engine';

// === V3 INTERFACES ===

export interface MLBGameStateV3 {
  gameId: string;
  gamePk: number;
  status: 'Scheduled' | 'Live' | 'Final' | 'Postponed';
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  currentBatter?: {
    id: number;
    name: string;
    stats: { hr: number; avg: number; ops: number };
  };
  currentPitcher?: {
    id: number;
    name: string;
    stats: { era: number; whip: number };
  };
  ballpark?: string;
  weather?: {
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
  };
  venue?: string;
}

export interface AlertTierResult {
  tier: 1 | 2 | 3 | 4;
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  metadata: {
    l1: boolean;
    l2: boolean;
    l3: boolean;
    l4: boolean;
    aiConfident: boolean;
    severity: string;
  };
}

export interface DeduplicationContext {
  gamePk: number;
  alertType: string;
  inning: number;
  inningState: string;
  outs: number;
  basesHash: string;
  batterId?: number;
  pitcherId?: number;
  paId?: string;
}

export class MLBEngineV3 {
  private deduplicationCache = new Map<string, { timestamp: number; tier: number }>();
  private readonly COOLDOWN_MS = {
    1: 60000,   // L1: 1 minute
    2: 90000,   // L2: 1.5 minutes  
    3: 120000,  // L3: 2 minutes
    4: 180000   // L4: 3 minutes
  };
  
  onAlert?: (alert: any) => void;

  /**
   * V3 Law #1: Game Status Gating
   * Only process live games, ignore scheduled/final games
   */
  async processLiveGamesOnly(): Promise<void> {
    try {
      // Use the multi-source service that correctly transforms games - MLB ONLY
      const liveSportsService = await import('../live-sports');
      const todaysData = await liveSportsService.liveSportsService.getTodaysGames('MLB');
      const allGames = todaysData.games || [];
      
      console.log(`🎯 V3 Engine Processing ${allGames.length} total games`);
      
      const liveGames = allGames.filter((game: any) => {
        const isLive = game.status?.toLowerCase() === 'live';
        
        if (!isLive) {
          console.log(`⏭️ V3 Skipping ${game.awayTeam?.name || 'Unknown'} @ ${game.homeTeam?.name || 'Unknown'} - Status: ${game.status || 'Unknown'}`);
        } else {
          console.log(`🎯 V3 Processing live game: ${game.awayTeam?.name || 'Unknown'} @ ${game.homeTeam?.name || 'Unknown'}`);
        }
        
        return isLive;
      });

      console.log(`🎯 V3 Game Status Gating: Processing ${liveGames.length}/${allGames.length} live games`);

      for (const game of liveGames) {
        const gameState = await this.extractGameStateFromTransformedGame(game);
        if (gameState) {
          await this.evaluateFourTierSystem(gameState);
        }
      }
    } catch (error) {
      console.error('Error in V3 live game processing:', error);
    }
  }

  private normalizeGameStatus(game: any): 'Scheduled' | 'Live' | 'Final' | 'Postponed' {
    const status = game.status?.abstractGameState || game.status?.detailedState || '';
    
    if (status.includes('Live') || status.includes('In Progress')) return 'Live';
    if (status.includes('Final') || status.includes('Complete')) return 'Final';
    if (status.includes('Postponed') || status.includes('Suspended')) return 'Postponed';
    return 'Scheduled';
  }

  private async extractGameStateFromTransformedGame(game: any): Promise<MLBGameStateV3 | null> {
    try {
      console.log(`🔍 V3 Extracting game state for ${game.id}`);
      
      // Game is already transformed by multi-source service
      // Convert to V3 format directly
      const v3GameState: MLBGameStateV3 = {
        gameId: game.id,
        gamePk: parseInt(game.id.split('-')[1]) || 0,
        status: 'Live',
        homeTeam: game.homeTeam?.name || 'Unknown',
        awayTeam: game.awayTeam?.name || 'Unknown',
        homeScore: game.homeScore || 0,
        awayScore: game.awayScore || 0,
        inning: game.inning || 1,
        inningState: game.inningState || 'Top',
        outs: game.outs || 0,
        runners: game.runners || { first: false, second: false, third: false },
        currentBatter: game.currentBatter ? {
          id: game.currentBatter.id || 0,
          name: game.currentBatter.name || 'Unknown',
          stats: {
            hr: game.currentBatter.stats?.hr || 0,
            avg: game.currentBatter.stats?.avg || 0.250,
            ops: game.currentBatter.stats?.ops || 0.750
          }
        } : undefined,
        currentPitcher: game.currentPitcher ? {
          id: game.currentPitcher.id || 0,
          name: game.currentPitcher.name || 'Unknown',
          stats: {
            era: game.currentPitcher.stats?.era || 4.00,
            whip: game.currentPitcher.stats?.whip || 1.30
          }
        } : undefined,
        ballpark: game.ballpark?.name || game.venue,
        venue: game.venue,
        weather: game.weather
      };

      // Enhanced logging to show base runner details
      const runnerSummary = [
        v3GameState.runners.first ? "1st" : "",
        v3GameState.runners.second ? "2nd" : "",
        v3GameState.runners.third ? "3rd" : ""
      ].filter(Boolean).join(", ") || "Bases empty";
      
      console.log(`✅ V3 Extracted game state: ${v3GameState.awayTeam} @ ${v3GameState.homeTeam} (${v3GameState.inning} ${v3GameState.inningState})`);
      console.log(`   🏃‍♂️ Runners: ${runnerSummary}, Outs: ${v3GameState.outs}`);
      return v3GameState;
    } catch (error) {
      console.error('Error extracting V3 game state:', error);
      return null;
    }
  }

  /**
   * V3 Law #2: 4-Tier Alert System with Decision Rules
   * Implements the IF chain logic for tier determination
   */
  async evaluateFourTierSystem(gameState: MLBGameStateV3): Promise<void> {
    try {
      console.log(`🔍 V3 4-Tier Evaluation: ${gameState.awayTeam} @ ${gameState.homeTeam}`);

      // Convert to scoring model format
      const scoringState: MLBScoringGameState = {
        runners: gameState.runners,
        outs: gameState.outs,
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher,
        inning: gameState.inning,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inningState: gameState.inningState,
        ballpark: gameState.ballpark,
        weather: gameState.weather
      };

      // Level 1: Hard Logic (Fail-safe)
      const l1Result = await this.runLevel1HardCoded(scoringState);
      
      // Level 2: Player & Historical Triggers
      const l2Result = await this.runLevel2PlayerHistory(scoringState);
      
      // Level 3: Weather & Environmental Factors
      const l3Result = await this.runLevel3Weather(scoringState);
      
      // Level 4: AI Synthesis
      const l4Result = await this.runLevel4AISynthesis(scoringState);

      // V3 Decision Rules Implementation
      let alertTier: AlertTierResult | null = null;

      if (l1Result && !l2Result && !l3Result) {
        // If L1 = yes, L2 = no, L3 = no → emit Alert 1
        alertTier = {
          tier: 1,
          priority: 75,
          description: `⚾ SCORING SITUATION: ${l1Result.reasons.join(', ')}`,
          reasons: l1Result.reasons,
          probability: l1Result.probability,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'L1'),
          metadata: { l1: true, l2: false, l3: false, l4: false, aiConfident: false, severity: l1Result.severity }
        };
      } else if (l1Result && (l2Result || l3Result) && !(l2Result && l3Result)) {
        // If L1 = yes and exactly one of L2 or L3 = yes → emit Alert 2
        const activeLevel = l2Result || l3Result!;
        alertTier = {
          tier: 2,
          priority: 85,
          description: `⚡ ENHANCED SITUATION: ${l1Result.reasons.concat(activeLevel.reasons).join(', ')}`,
          reasons: l1Result.reasons.concat(activeLevel.reasons),
          probability: Math.max(l1Result.probability, activeLevel.probability),
          deduplicationKey: this.generateDeduplicationKey(gameState, 'L2'),
          metadata: { l1: true, l2: !!l2Result, l3: !!l3Result, l4: false, aiConfident: false, severity: activeLevel.severity }
        };
      } else if (l1Result && l2Result && l3Result) {
        // If L1 = yes, L2 = yes, and L3 = yes → emit Alert 3
        alertTier = {
          tier: 3,
          priority: 95,
          description: `🚨 OPTIMAL CONDITIONS: ${l1Result.reasons.concat(l2Result.reasons, l3Result.reasons).join(', ')}`,
          reasons: l1Result.reasons.concat(l2Result.reasons, l3Result.reasons),
          probability: Math.max(l1Result.probability, l2Result.probability, l3Result.probability),
          deduplicationKey: this.generateDeduplicationKey(gameState, 'L3'),
          metadata: { l1: true, l2: true, l3: true, l4: false, aiConfident: false, severity: l3Result.severity }
        };
      } else if (!l1Result && l4Result && l4Result.probability >= 0.85) {
        // If L1 = no, but AI is highly confident → emit Alert 4
        alertTier = {
          tier: 4,
          priority: 90,
          description: `🤖 AI INSIGHT: ${l4Result.reasons.join(', ')}`,
          reasons: l4Result.reasons,
          probability: l4Result.probability,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'L4'),
          metadata: { l1: false, l2: !!l2Result, l3: !!l3Result, l4: true, aiConfident: true, severity: l4Result.severity }
        };
      }

      if (alertTier) {
        await this.processAlertWithUserSettings(alertTier, gameState);
      } else {
        console.log(`⏭️ No alert tier qualified for ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      }

    } catch (error) {
      console.error('Error in 4-tier evaluation:', error);
    }
  }

  /**
   * Level 1: Fail-safe Hard Logic
   * Always runs when game is live, searches for pre-defined high-probability scoring conditions
   */
  private async runLevel1HardCoded(gameState: MLBScoringGameState): Promise<any> {
    const result = calculateMLBSeverity(gameState);
    
    console.log(`🔍 L1 Debug: Prob=${result.probability.toFixed(3)}, Severity=${result.severity}, Runners=${JSON.stringify(gameState.runners)}, Outs=${gameState.outs}`);
    
    // L1 triggers for ANY meaningful scoring situation (Low, Medium, OR High severity)
    if (result.severity === 'Low' || result.severity === 'Medium' || result.severity === 'High') {
      console.log(`✅ L1 TRIGGERED: ${result.probability.toFixed(3)} probability (${result.severity})`);
      return result;
    }
    
    console.log(`❌ L1 NOT TRIGGERED: ${result.severity} severity does not qualify`);
    return null;
  }

  /**
   * Level 2: Player & Historical Triggers
   * Activates when player stats or trends amplify scoring odds
   */
  private async runLevel2PlayerHistory(gameState: MLBScoringGameState): Promise<any> {
    const l2Result = mlbL2WithProb(gameState);
    
    if (l2Result.severity === 'Medium') {
      console.log(`✅ L2 TRIGGERED: ${l2Result.probability.toFixed(3)} probability (${l2Result.severity})`);
      return l2Result;
    }
    
    return null;
  }

  /**
   * Level 3: Weather & Environmental Factors
   * Triggers when wind, temperature or other conditions materially affect scoring
   */
  private async runLevel3Weather(gameState: MLBScoringGameState): Promise<any> {
    const l3Result = mlbL3WithProb(gameState);
    
    if (l3Result.severity === 'High') {
      console.log(`✅ L3 TRIGGERED: ${l3Result.probability.toFixed(3)} probability (${l3Result.severity})`);
      return l3Result;
    }
    
    return null;
  }

  /**
   * Level 4: AI Synthesis
   * Final layer that synthesizes all data to generate natural-language alerts
   */
  private async runLevel4AISynthesis(gameState: MLBScoringGameState): Promise<any> {
    // AI synthesis - stub implementation
    // In production, this would use OpenAI to analyze all game context
    const baseProb = calculateMLBSeverity(gameState);
    
    if (baseProb.probability >= 0.85) {
      return {
        probability: baseProb.probability,
        reasons: ['AI detected high-leverage situation', ...baseProb.reasons],
        severity: 'AI-Confident'
      };
    }
    
    return null;
  }

  /**
   * V3 Law #3: User Settings Override
   * Check per-user preferences before emitting any alert
   */
  private async processAlertWithUserSettings(alertTier: AlertTierResult, gameState: MLBGameStateV3): Promise<void> {
    try {
      // V3 Law #4: Advanced Deduplication - CHECK AND RECORD IMMEDIATELY
      if (!this.shouldEmitAlert(alertTier)) {
        console.log(`🚫 DEDUP: Alert suppressed - ${alertTier.deduplicationKey}`);
        return;
      }

      // Record alert for deduplication IMMEDIATELY to prevent duplicates
      this.recordAlertEmission(alertTier);

      // Get all users and check their settings
      const users = await storage.getUsers();
      
      for (const user of users) {
        const userSettings = await this.getUserSettings(user.id);
        
        if (shouldNotifyUser(userSettings, 'MLB', alertTier.tier)) {
          await this.emitAlertToUser(user.id, alertTier, gameState, userSettings);
          console.log(`✅ Alert emitted to user ${user.username} - Tier ${alertTier.tier}`);
        } else {
          console.log(`⏭️ Alert blocked by user settings for ${user.username}`);
        }
      }

    } catch (error) {
      console.error('Error processing alert with user settings:', error);
    }
  }

  private async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const settings = await storage.getSettingsByUserId(userId);
      return settings ? {
        alertsEnabled: settings.telegramEnabled !== false,
        sports: { MLB: settings.sport === 'MLB' },
        tiers: {}, // Default empty tiers
        betbookEnabled: true // Default enabled
      } : null;
    } catch (error) {
      console.error(`Error fetching user settings for ${userId}:`, error);
      return null;
    }
  }

  private async emitAlertToUser(
    userId: string, 
    alertTier: AlertTierResult, 
    gameState: MLBGameStateV3,
    userSettings: UserSettings | null
  ): Promise<void> {
    try {
      const weatherData = await this.getWeatherForGame(gameState);
      
      const alertData = {
        id: randomUUID(),
        userId,
        title: `Tier ${alertTier.tier}: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
        type: `MLB Tier ${alertTier.tier} Alert`,
        description: alertTier.description,
        sport: 'MLB',
        team: gameState.homeTeam,
        opponent: gameState.awayTeam,
        priority: alertTier.priority,
        probability: alertTier.probability,
        createdAt: new Date(),
        timestamp: new Date(),
        gameInfo: {
          gameId: gameState.gameId,
          gamePk: gameState.gamePk,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          status: gameState.status,
          inning: gameState.inning,
          inningState: gameState.inningState,
          outs: gameState.outs,
          runners: gameState.runners,
          v3Analysis: {
            tier: alertTier.tier,
            metadata: alertTier.metadata,
            reasons: alertTier.reasons,
            deduplicationKey: alertTier.deduplicationKey
          }
        },
        weatherData,
        // V3 Betbook Integration
        betbookData: userSettings?.betbookEnabled ? this.generateBetbookData(alertTier, gameState) : null
      };

      // Store alert
      await storage.createAlert(alertData);

      // Send Telegram if configured and high priority
      if (alertTier.priority >= 85) {
        await this.sendTelegramIfConfigured(userId, alertData);
      }

      // WebSocket broadcast
      if (this.onAlert) {
        this.onAlert(alertData);
      }

    } catch (error) {
      console.error('Error emitting alert to user:', error);
    }
  }

  /**
   * V3 Law #4: Context-Aware Deduplication
   */
  private generateDeduplicationKey(gameState: MLBGameStateV3, alertType: string): string {
    const basesHash = `${gameState.runners.first ? 1 : 0}${gameState.runners.second ? 1 : 0}${gameState.runners.third ? 1 : 0}`;
    const batterId = gameState.currentBatter?.id || 0;
    const pitcherId = gameState.currentPitcher?.id || 0;
    
    return `${gameState.gamePk}:${alertType}:${gameState.inning}:${gameState.inningState}:${gameState.outs}:${basesHash}:${batterId}:${pitcherId}`;
  }

  private shouldEmitAlert(alertTier: AlertTierResult): boolean {
    const now = Date.now();
    const cached = this.deduplicationCache.get(alertTier.deduplicationKey);
    
    // For L1 alerts, allow more frequent alerts (less aggressive deduplication)
    if (alertTier.tier === 1) {
      if (cached && (now - cached.timestamp) < 30000) { // Only 30s cooldown for L1
        return false;
      }
      return true;
    }
    
    if (cached) {
      const cooldown = this.COOLDOWN_MS[alertTier.tier] || 60000;
      const timeSinceLastAlert = now - cached.timestamp;
      
      if (timeSinceLastAlert < cooldown) {
        return false;
      }
      
      // V3 Law #5: Supersession - Higher tier supersedes lower tier
      if (alertTier.tier <= cached.tier) {
        return false;
      }
    }
    
    return true;
  }

  private recordAlertEmission(alertTier: AlertTierResult): void {
    this.deduplicationCache.set(alertTier.deduplicationKey, {
      timestamp: Date.now(),
      tier: alertTier.tier
    });
    
    // Cleanup old entries to prevent memory leaks
    if (this.deduplicationCache.size > 10000) {
      const now = Date.now();
      const entries = Array.from(this.deduplicationCache.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > 3600000) { // 1 hour
          this.deduplicationCache.delete(key);
        }
      }
    }
  }

  /**
   * V3 Betbook Engine Integration
   */
  private generateBetbookData(alertTier: AlertTierResult, gameState: MLBGameStateV3): any {
    const context: AlertContext = {
      sport: 'MLB',
      gameId: gameState.gameId,
      tier: alertTier.tier,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      inning: gameState.inning,
      probability: alertTier.probability
    };
    
    return shouldShowBetbook(context) ? getBetbookData(context) : null;
  }

  private async getWeatherForGame(gameState: MLBGameStateV3): Promise<any> {
    try {
      const cityName = this.getCityForTeam(gameState.homeTeam);
      return await getWeatherData(cityName);
    } catch (error) {
      console.error('Error getting weather data:', error);
      return null;
    }
  }

  private getCityForTeam(teamName: string): string {
    const teamCityMap: Record<string, string> = {
      'Los Angeles Angels': 'Los Angeles',
      'Los Angeles Dodgers': 'Los Angeles',
      'Oakland Athletics': 'Oakland',
      'San Francisco Giants': 'San Francisco',
      'Seattle Mariners': 'Seattle',
      'Texas Rangers': 'Arlington',
      'Houston Astros': 'Houston',
      'Minnesota Twins': 'Minneapolis',
      'Kansas City Royals': 'Kansas City',
      'Chicago White Sox': 'Chicago',
      'Chicago Cubs': 'Chicago',
      'Cleveland Guardians': 'Cleveland',
      'Detroit Tigers': 'Detroit',
      'Milwaukee Brewers': 'Milwaukee',
      'St. Louis Cardinals': 'St. Louis',
      'Atlanta Braves': 'Atlanta',
      'Miami Marlins': 'Miami',
      'New York Yankees': 'New York',
      'New York Mets': 'New York',
      'Philadelphia Phillies': 'Philadelphia',
      'Washington Nationals': 'Washington',
      'Boston Red Sox': 'Boston',
      'Toronto Blue Jays': 'Toronto',
      'Baltimore Orioles': 'Baltimore',
      'Tampa Bay Rays': 'Tampa',
      'Pittsburgh Pirates': 'Pittsburgh',
      'Cincinnati Reds': 'Cincinnati',
      'Colorado Rockies': 'Denver',
      'Arizona Diamondbacks': 'Phoenix',
      'San Diego Padres': 'San Diego'
    };
    
    return teamCityMap[teamName] || teamName;
  }

  private async sendTelegramIfConfigured(userId: string, alertData: any): Promise<void> {
    try {
      const userWithTelegram = await storage.getUserWithTelegramSettings(userId);
      
      if (userWithTelegram?.telegramBotToken && userWithTelegram?.telegramChatId) {
        const telegramConfig = {
          botToken: userWithTelegram.telegramBotToken,
          chatId: userWithTelegram.telegramChatId
        };
        
        const sent = await sendTelegramAlert(telegramConfig, alertData);
        if (sent) {
          console.log(`📱 V3 Alert sent via Telegram: Tier ${alertData.gameInfo.v3Analysis.tier}`);
        }
      }
    } catch (error) {
      console.error('Error sending Telegram alert:', error);
    }
  }
}