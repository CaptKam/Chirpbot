import { getWeatherData } from '../weather';
import { storage } from '../../storage';
import { mlbApi } from '../mlb-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert, generateAdvancedPredictions } from '../ai-analysis';
import { analyzeHybridRE24, generateHybridAlertDescription, cleanupCache } from './hybrid-re24-ai';
import { getEnhancedWeather } from '../enhanced-weather';
import { getActiveRE24Level } from './re24-levels';
import { alertDeduplicator, type MLBGameState as DeduplicationMLBGameState } from './alert-deduplication';
import { FourLevelAlertSystem, type GameState, type AlertTier } from './four-level-alert-system';
import { BaseSportEngine, type AlertConfig } from './base-engine';
// Betting analysis imports removed for unified compatibility

// === UNIFIED MLB GAME STATE (Compatible with both old and V3 systems) ===
export interface MLBGameState {
  gameId: string;
  gamePk: number;
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
    battingOrder?: number;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      obp: number;
      ops: number;
      slg: number;
    };
  };
  currentPitcher?: {
    id: number;
    name: string;
    throwHand: string;
    stats: {
      era: number;
      whip: number;
      strikeOuts: number;
      wins: number;
      losses: number;
    };
  };
  recentPlay?: {
    result?: string;
    description?: string;
    isHomeRun?: boolean;
    isScoringPlay?: boolean;
    isHit?: boolean;
    isStrikeout?: boolean;
    runnersMoved?: boolean;
    rbiCount?: number;
    hitType?: string;
  };
  ballpark?: {
    name?: string;
    dimensions?: any;
  };
  weather?: {
    temp?: number;
    windSpeed?: number;
    windDirection?: string;
    condition?: string;
  };
  venue?: string;
}

// V3 Alert Tier System
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

// V3 Level Results
export interface LevelResult {
  reasons: string[];
  probability: number;
  severity: string;
  confidence?: number;
}

// User Settings for V3 Law #3
export interface UserSettings {
  alertsEnabled: boolean;
  sports: { [key: string]: boolean };
  tiers: { [key: string]: any };
  betbookEnabled: boolean;
}

/**
 * 🚀 UNIFIED MLB ENGINE - ChirpBot V3 with 4 Laws + Betbook Engine
 * Combines working game state extraction with V3 architecture
 * No conflicts between old and new systems
 */
export class MLBEngineUnified extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 30000; // 30 seconds

  // V3 Alert deduplication intervals per tier
  private tierCooldowns = {
    1: 60000,   // L1: 1 minute
    2: 90000,   // L2: 1.5 minutes  
    3: 120000,  // L3: 2 minutes
    4: 180000   // L4: 3 minutes
  };

  // V3 Default tier settings
  private defaultTierSettings = {
    1: { enabled: true, priority: 75 },
    2: { enabled: true, priority: 85 },
    3: { enabled: true, priority: 95 },
    4: { enabled: true, priority: 90 }
  };

  alertConfigs: AlertConfig[] = []; // V3 uses dynamic tier system

  /**
   * V3 Compatible monitor() method - implements 4 Laws
   */
  async monitor(): Promise<void> {
    console.log('🚀 ChirpBot V3 Unified - Processing with 4 Laws & Betbook Engine');
    try {
      await this.processLiveGamesOnly();
    } catch (error: any) {
      console.error('❌ V3 Error in monitor():', error);
      console.error('❌ V3 Stack:', error.stack);
    }
  }

  /**
   * UNIFIED GAME STATE EXTRACTION
   * Works with both basic Game interface and detailed live feed data
   */
  extractGameState(gameData: any): MLBGameState | null {
    try {
      // Handle basic Game interface (from getTodaysGames)
      if (gameData.id && gameData.homeTeam && gameData.awayTeam) {
        return this.extractFromBasicGame(gameData);
      }
      
      // Handle detailed live feed data (from specific game API)
      if (gameData.gameData || gameData.liveData) {
        return this.extractFromLiveFeed(gameData);
      }
      
      return null;
    } catch (error) {
      console.error('Error in unified game state extraction:', error);
      return null;
    }
  }

  /**
   * Extract from basic Game interface (compatible with getTodaysGames)
   */
  private extractFromBasicGame(game: any): MLBGameState | null {
    try {
      return {
        gameId: game.id,
        gamePk: parseInt(game.id.replace('mlb-', '')),
        homeTeam: game.homeTeam?.name || 'Unknown Home',
        awayTeam: game.awayTeam?.name || 'Unknown Away', 
        homeScore: game.homeTeam?.score || 0,
        awayScore: game.awayTeam?.score || 0,
        inning: game.inning || 1,
        inningState: game.inningState || 'top',
        outs: game.outs || 0,
        runners: {
          first: game.runners?.first || false,
          second: game.runners?.second || false, 
          third: game.runners?.third || false
        },
        currentBatter: game.currentBatter,
        currentPitcher: game.currentPitcher,
        ballpark: { name: game.venue },
        venue: game.venue
      };
    } catch (error) {
      console.error('Error extracting from basic game:', error);
      return null;
    }
  }

  /**
   * Extract from detailed live feed (for future live feed integration)
   */
  private extractFromLiveFeed(gameData: any): MLBGameState | null {
    try {
      const liveData = gameData.liveData?.linescore;
      const game = gameData.gameData;
      
      if (!liveData || !game) return null;

      return {
        gameId: `mlb-${game.game.pk}`,
        gamePk: game.game.pk,
        homeTeam: game.teams.home.name,
        awayTeam: game.teams.away.name,
        homeScore: liveData.teams?.home?.runs || 0,
        awayScore: liveData.teams?.away?.runs || 0,
        inning: liveData.currentInning || 1,
        inningState: liveData.inningState === 'Top' ? 'top' : 'bottom',
        outs: liveData.outs || 0,
        runners: {
          first: !!liveData.offense?.first,
          second: !!liveData.offense?.second,
          third: !!liveData.offense?.third
        },
        ballpark: { name: game.venue?.name },
        venue: game.venue?.name
      };
    } catch (error) {
      console.error('Error extracting from live feed:', error);
      return null;
    }
  }

  /**
   * V3 Law #1: Game Status Gating
   * Only process live games, ignore scheduled/final games
   */
  async processLiveGamesOnly(): Promise<void> {
    try {
      console.log('🔍 V3 Starting processLiveGamesOnly...');
      const games = await mlbApi.getTodaysGames();
      console.log(`🔍 V3 Debug - Got ${games.length} games from API`);
      
      if (games.length > 0) {
        console.log(`🔍 V3 Debug - First game:`, {
          id: games[0].id,
          homeTeam: games[0].homeTeam?.name,
          awayTeam: games[0].awayTeam?.name,  
          status: games[0].status,
          isLive: games[0].isLive
        });
      }
      
      const liveGames = games.filter((game: any) => {
        const status = game.status || 'Unknown';
        const isLive = game.isLive === true;
        
        const awayTeam = game.awayTeam?.name || 'Unknown Away';
        const homeTeam = game.homeTeam?.name || 'Unknown Home';
        
        if (!isLive) {
          console.log(`⏭️ V3 Skipping ${awayTeam} @ ${homeTeam} - Status: ${status}`);
        } else {
          console.log(`🚀 V3 Processing LIVE GAME: ${awayTeam} @ ${homeTeam}`);
        }
        
        return isLive;
      });

      console.log(`🎯 Game Status Gating: Processing ${liveGames.length}/${games.length} live games`);

      for (const game of liveGames) {
        const awayTeam = game.awayTeam?.name || 'Unknown Away';
        const homeTeam = game.homeTeam?.name || 'Unknown Home';
        console.log(`🎯 V3 Processing: ${awayTeam} @ ${homeTeam}`);
        
        try {
          const gameState = this.extractGameState(game);
          if (gameState) {
            console.log(`🔬 V3 Starting 4-Tier Evaluation for ${awayTeam} @ ${homeTeam}`);
            console.log(`   Base Runners: 1B=${gameState.runners?.first || 'Empty'} 2B=${gameState.runners?.second || 'Empty'} 3B=${gameState.runners?.third || 'Empty'}`);
            await this.evaluateFourTierSystem(gameState);
          } else {
            console.log(`❌ V3 Failed to extract game state for ${awayTeam} @ ${homeTeam}`);
          }
        } catch (error: any) {
          console.error(`❌ V3 Error processing ${awayTeam} @ ${homeTeam}:`, error);
        }
      }
    } catch (error: any) {
      console.error('❌ V3 Error in processLiveGamesOnly:', error);
      console.error('❌ V3 Stack:', error.stack);
    }
  }

  /**
   * V3 Law #2: 4-Tier Alert System with Decision Rules
   * Implements the IF chain logic for tier determination
   */
  async evaluateFourTierSystem(gameState: MLBGameState): Promise<void> {
    try {
      console.log(`🔍 V3 4-Tier Evaluation: ${gameState.awayTeam} @ ${gameState.homeTeam}`);

      // Level 1: Hard Logic (Fail-safe)
      const l1Result = await this.runLevel1HardCoded(gameState);
      
      // Level 2: Player & Historical Triggers  
      const l2Result = await this.runLevel2PlayerHistory(gameState);
      
      // Level 3: Weather & Environmental Factors
      const l3Result = await this.runLevel3Weather(gameState);
      
      // Level 4: AI Synthesis
      const l4Result = await this.runLevel4AISynthesis(gameState);

      console.log(`📊 V3 Level Results: L1=${!!l1Result} L2=${!!l2Result} L3=${!!l3Result} L4=${!!l4Result}`);

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
        console.log(`🚨 V3 Alert Tier ${alertTier.tier}: ${alertTier.description}`);
        await this.processAlertWithUserSettings(alertTier, gameState);
        
        // V3 Law #4: Betbook Engine Analysis
        await this.runBetbookAnalysis(gameState, alertTier);
      } else {
        console.log(`⏭️ No alert tier qualified for ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      }

    } catch (error: any) {
      console.error('Error in 4-tier evaluation:', error);
    }
  }

  /**
   * Level 1: Hard-coded fail-safe rules
   */
  private async runLevel1HardCoded(gameState: MLBGameState): Promise<LevelResult | null> {
    const reasons: string[] = [];
    let probability = 0.3;

    // RISP (Runners in Scoring Position)
    if (gameState.runners.second || gameState.runners.third) {
      reasons.push('RISP detected');
      probability += 0.25;
    }

    // Close game + late innings
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 2 && gameState.inning >= 7) {
      reasons.push('Close game, late inning');
      probability += 0.15;
    }

    // High-leverage situation
    if (gameState.outs === 2 && (gameState.runners.first || gameState.runners.second || gameState.runners.third)) {
      reasons.push('2 outs with runners');
      probability += 0.2;
    }

    if (reasons.length > 0) {
      return {
        reasons,
        probability: Math.min(probability, 0.9),
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * Level 2: Player history and performance
   */
  private async runLevel2PlayerHistory(gameState: MLBGameState): Promise<LevelResult | null> {
    const reasons: string[] = [];
    let probability = 0.4;

    if (gameState.currentBatter) {
      const batter = gameState.currentBatter;
      
      // Power hitter
      if (batter.stats.hr >= 20) {
        reasons.push(`Power hitter: ${batter.stats.hr} HR`);
        probability += 0.2;
      }

      // High average
      if (batter.stats.avg >= 0.300) {
        reasons.push(`Contact hitter: .${Math.round(batter.stats.avg * 1000)} AVG`);
        probability += 0.15;
      }

      // High OPS
      if (batter.stats.ops >= 0.900) {
        reasons.push(`Elite hitter: ${batter.stats.ops.toFixed(3)} OPS`);
        probability += 0.1;
      }
    }

    if (reasons.length > 0) {
      return {
        reasons,
        probability: Math.min(probability, 0.85),
        severity: 'high'
      };
    }

    return null;
  }

  /**
   * Level 3: Weather and environmental factors
   */
  private async runLevel3Weather(gameState: MLBGameState): Promise<LevelResult | null> {
    const reasons: string[] = [];
    let probability = 0.35;

    try {
      // Get weather data if available  
      if (gameState.ballpark?.name) {
        const weather = await getEnhancedWeather(gameState.ballpark.name);
        if (weather) {
          // Favorable wind conditions (simplified)
          if (weather.windMPH && weather.windMPH > 8) {
            reasons.push(`Favorable wind: ${weather.windMPH}mph`);
            probability += 0.15;
          }

          // Temperature factor (simplified)
          if (weather.temperature && weather.temperature > 75) {
            reasons.push(`Hot conditions: ${weather.temperature}°F`);
            probability += 0.1;
          }
        }
      }

      // Ballpark factors (simplified)
      if (gameState.ballpark?.name) {
        const hitterFriendlyParks = ['Fenway Park', 'Yankee Stadium', 'Coors Field'];
        if (hitterFriendlyParks.some(park => gameState.ballpark?.name?.includes(park))) {
          reasons.push('Hitter-friendly ballpark');
          probability += 0.1;
        }
      }
    } catch (error) {
      console.error('Error in Level 3 weather analysis:', error);
    }

    if (reasons.length > 0) {
      return {
        reasons,
        probability: Math.min(probability, 0.8),
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * Level 4: AI synthesis and advanced analysis
   */
  private async runLevel4AISynthesis(gameState: MLBGameState): Promise<LevelResult | null> {
    try {
      // Use hybrid RE24 analysis for AI insights
      const hybridAnalysis = await analyzeHybridRE24(gameState);
      
      if (hybridAnalysis.finalProbability >= 0.6) {
        return {
          reasons: [`AI analysis: ${Math.round(hybridAnalysis.finalProbability * 100)}% scoring probability`],
          probability: hybridAnalysis.finalProbability,
          severity: 'high'
        };
      }
    } catch (error) {
      console.error('Error in Level 4 AI synthesis:', error);
    }

    return null;
  }

  /**
   * V3 Law #4: Betbook Engine Analysis (Simplified)
   */
  private async runBetbookAnalysis(gameState: MLBGameState, alertTier: AlertTierResult): Promise<void> {
    try {
      console.log(`💰 V3 Betbook Analysis for Tier ${alertTier.tier}`);
      
      // Simplified betting recommendations based on tier and probability
      const recommendations = [];
      
      if (alertTier.tier >= 3 && alertTier.probability >= 0.7) {
        recommendations.push(`🎰 STRONG BET: Over 0.5 runs this half-inning (+120) - ${Math.round(alertTier.probability * 100)}% confidence`);
      }
      
      if (alertTier.tier >= 2 && gameState.runners.second && gameState.runners.third) {
        recommendations.push(`🎯 VALUE BET: RISP success (+150) - Bases loaded situation`);
      }
      
      if (recommendations.length > 0) {
        console.log(`🎰 Found ${recommendations.length} betting opportunities:`);
        recommendations.forEach(rec => console.log(`   ${rec}`));
      }
    } catch (error) {
      console.error('Error in Betbook analysis:', error);
    }
  }

  /**
   * V3 Law #3: User Settings Override
   */
  private async processAlertWithUserSettings(alertTier: AlertTierResult, gameState: MLBGameState): Promise<void> {
    try {
      console.log(`📤 V3 Processing alert with user settings - Tier ${alertTier.tier}`);

      // Get all users and check their settings
      const users = await storage.getUsers();
      
      for (const user of users) {
        const userSettings = await this.getUserSettings(user.id);
        
        if (this.shouldNotifyUser(userSettings, 'MLB', alertTier.tier)) {
          await this.emitAlertToUser(user.id, alertTier, gameState, userSettings);
          console.log(`✅ Alert emitted to user ${user.username} - Tier ${alertTier.tier}`);
        } else {
          console.log(`⏭️ Alert blocked by user settings for ${user.username}`);
        }
      }

      // Record alert for deduplication
      this.recordAlertEmission(alertTier);

    } catch (error) {
      console.error('Error processing alert with user settings:', error);
    }
  }

  private async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const settings = await storage.getSettingsByUserId(userId);
      return settings ? {
        alertsEnabled: true, // V3: Use existing settings structure
        sports: { MLB: true }, // V3: Always enabled for MLB processing
        tiers: {}, // V3: Use default tier settings
        betbookEnabled: true // V3: Always enabled for betting analysis
      } : null;
    } catch (error) {
      console.error(`Error fetching user settings for ${userId}:`, error);
      return null;
    }
  }

  private shouldNotifyUser(userSettings: UserSettings | null, sport: string, tier: number): boolean {
    if (!userSettings) return true; // Default to allow
    if (!userSettings.alertsEnabled) return false;
    if (!userSettings.sports[sport]) return false;
    
    const tierSettings = this.defaultTierSettings[tier as keyof typeof this.defaultTierSettings];
    return tierSettings?.enabled !== false;
  }

  private async emitAlertToUser(
    userId: string, 
    alertTier: AlertTierResult, 
    gameState: MLBGameState,
    userSettings: UserSettings | null
  ): Promise<void> {
    try {
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
          status: 'live',
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          gameId: gameState.gameId,
          gamePk: gameState.gamePk,
          inning: gameState.inning,
          inningState: gameState.inningState,
          outs: gameState.outs,
          runners: gameState.runners,
          score: `${gameState.awayScore}-${gameState.homeScore}`
        },
        metadata: alertTier.metadata
      };

      // Store alert
      await storage.createAlert(alertData);

      // Send via callback if available
      if (this.onAlert) {
        this.onAlert(alertData);
      }

    } catch (error) {
      console.error('Error emitting alert to user:', error);
    }
  }

  private generateDeduplicationKey(gameState: MLBGameState, level: string): string {
    return `${gameState.gamePk}-${level}-${gameState.inning}-${gameState.inningState}-${gameState.outs}`;
  }

  private recordAlertEmission(alertTier: AlertTierResult): void {
    // Simple in-memory deduplication tracking
    this.lastAlertStates.set(alertTier.deduplicationKey, {
      hash: alertTier.deduplicationKey,
      ts: Date.now()
    });
  }

  // Required by base class but not used in V3 system
  async checkAlertConditions(gameState: any): Promise<AlertConfig[]> {
    return [];
  }

  async processAlerts(alerts: AlertConfig[], gameState: any): Promise<void> {
    // V3 uses tier-based processing instead
  }
}

export const mlbEngineUnified = new MLBEngineUnified();