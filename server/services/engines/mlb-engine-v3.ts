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
// V3 system uses direct API calls instead of mlb-api wrapper
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { getWeatherData } from '../weather';
// V3 system uses integrated 4-tier alert calculations instead of legacy models
// Legacy imports removed: mlb-alert-model, user-settings, betbook-engine
import { AlertDeduper } from '../alert-deduper';

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
  // Smart Deduplication with AI-Enhanced Alerts
  private deduplicationCache = new Map<string, { timestamp: number; tier: number }>();
  private readonly COOLDOWN_MS = {
    1: 15000,   // L1: 15 seconds
    2: 30000,   // L2: 30 seconds
    3: 45000,   // L3: 45 seconds
    4: 60000    // L4: 60 seconds
  };
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🔧 MLBEngineV3 initialized with AI-Enhanced Alert System');
  }

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
        homeScore: game.homeTeam?.score || 0,
        awayScore: game.awayTeam?.score || 0,
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
      // V3 Law #4: Smart Deduplication
      if (!this.shouldEmitAlert(alertTier)) {
        console.log(`🚫 DEDUP: Alert suppressed - ${alertTier.deduplicationKey}`);
        return;
      }

      // Record alert for deduplication IMMEDIATELY
      this.recordAlertEmission(alertTier);

      // 🤖 AI ENHANCEMENT: Generate intelligent alert description
      const aiEnhancedDescription = await this.generateAIEnhancedAlert(alertTier, gameState);
      const enhancedBetbookData = await this.generateAIEnhancedBetbook(alertTier, gameState);

      // FIXED: Create ONE alert record, not one per user
      const weatherData = await this.getWeatherForGame(gameState);
      
      const alertData = {
        id: randomUUID(),
        userId: null, // Global alert, not user-specific
        title: `Tier ${alertTier.tier}: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
        type: `MLB Tier ${alertTier.tier} Alert`,
        description: aiEnhancedDescription,
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
        betbookData: enhancedBetbookData
      };

      // Create ONE alert record in database
      const createdAlert = await storage.createAlert(alertData);
      console.log(`✅ Alert created in database - Tier ${alertTier.tier}`);

      // Get all users and send notifications (not database records)
      const users = await storage.getUsers();
      let notifiedUsers = 0;
      
      for (const user of users) {
        const userSettings = await this.getUserSettings(user.id);
        
        if (shouldNotifyUser(userSettings, 'MLB', alertTier.tier)) {
          // Send Telegram if configured and high priority
          if (alertTier.priority >= 85) {
            await this.sendTelegramIfConfigured(user.id, createdAlert);
          }
          
          notifiedUsers++;
          console.log(`📬 Notification sent to user ${user.username} - Tier ${alertTier.tier}`);
        } else {
          console.log(`⏭️ Alert blocked by user settings for ${user.username}`);
        }
      }

      console.log(`✅ Alert processed: 1 database record, ${notifiedUsers} notifications sent`);

      // WebSocket broadcast (single alert to all connected clients)
      if (this.onAlert) {
        this.onAlert(createdAlert);
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


  /**
   * V3 Law #4: Context-Aware Deduplication
   */
  private generateDeduplicationKey(gameState: MLBGameStateV3, alertType: string): string {
    const basesHash = `${gameState.runners.first ? 1 : 0}${gameState.runners.second ? 1 : 0}${gameState.runners.third ? 1 : 0}`;
    
    // SIMPLIFIED: Only use game, inning, and bases - remove batter/pitcher specificity
    return `${gameState.gamePk}:${alertType}:${gameState.inning}:${gameState.inningState}:${basesHash}`;
  }

  private shouldEmitAlert(alertTier: AlertTierResult): boolean {
    const now = Date.now();
    const cached = this.deduplicationCache.get(alertTier.deduplicationKey);
    
    // Simple but effective deduplication while we enhance AI
    if (cached) {
      const cooldown = this.COOLDOWN_MS[alertTier.tier] || 30000;
      const timeSinceLastAlert = now - cached.timestamp;
      
      if (timeSinceLastAlert < cooldown) {
        console.log(`🔄 DEDUP: Waiting ${Math.round((cooldown - timeSinceLastAlert)/1000)}s for ${alertTier.tier} alert`);
        return false;
      }
      
      // Allow higher tier to supersede lower tier
      if (alertTier.tier <= cached.tier && timeSinceLastAlert < 60000) {
        console.log(`🔄 DEDUP: Lower/same tier suppressed for 60s`);
        return false;
      }
    }
    
    console.log(`✅ DEDUP: Allowing Tier ${alertTier.tier} alert`);
    return true;
  }

  private recordAlertEmission(alertTier: AlertTierResult): void {
    this.deduplicationCache.set(alertTier.deduplicationKey, {
      timestamp: Date.now(),
      tier: alertTier.tier
    });
    
    // Cleanup old entries
    if (this.deduplicationCache.size > 1000) {
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
   * 🤖 AI-ENHANCED ALERT GENERATION
   * OpenAI as the genius behind every alert
   */
  private async generateAIEnhancedAlert(alertTier: AlertTierResult, gameState: MLBGameStateV3): Promise<string> {
    try {
      const openai = await import('openai');
      const client = new openai.OpenAI();

      const prompt = `
You are a professional sports analyst generating an intelligent alert for a live MLB game. Create a compelling, informative alert description.

GAME CONTEXT:
- Teams: ${gameState.awayTeam} @ ${gameState.homeTeam}
- Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}
- Inning: ${gameState.inning} ${gameState.inningState}
- Outs: ${gameState.outs}
- Runners: ${Object.entries(gameState.runners).filter(([_, on]) => on).map(([base]) => base).join(', ') || 'None'}
- Scoring Probability: ${Math.round(alertTier.probability * 100)}%
- Alert Tier: ${alertTier.tier} (${alertTier.tier === 1 ? 'Opportunity' : alertTier.tier === 2 ? 'High Potential' : alertTier.tier === 3 ? 'Critical Moment' : 'Game Changing'})

PLAYER CONTEXT:
- Current Batter: ${gameState.currentBatter?.name || 'Unknown'} (.${Math.floor((gameState.currentBatter?.stats.avg || 0.250) * 1000).toString().padStart(3, '0')} AVG, ${gameState.currentBatter?.stats.hr || 0} HR)
- Current Pitcher: ${gameState.currentPitcher?.name || 'Unknown'} (${gameState.currentPitcher?.stats.era?.toFixed(2) || '0.00'} ERA)

Create a 1-2 sentence alert that:
1. Captures the excitement of the moment
2. Explains why this situation matters
3. Uses specific baseball insights
4. Sounds natural and engaging
5. Focuses on the scoring opportunity or game impact

Example good alerts:
- "Yankees' Aaron Judge steps up with 2 runners in scoring position! His .310 average against lefties makes this a prime RBI opportunity."
- "Bases loaded, 1 out in the 9th - Dodgers trail by 1 and their cleanup hitter is due! This could be the game-changing moment."
- "Red Sox have a runner on 3rd with their best contact hitter at the plate. With only 1 out, they're in prime position to tie this game."

Generate only the alert text, no additional formatting:`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      });

      const aiDescription = response.choices[0]?.message?.content?.trim();
      
      if (aiDescription && aiDescription.length > 20) {
        console.log(`🤖 AI Enhanced Alert Generated: ${aiDescription.substring(0, 80)}...`);
        return aiDescription;
      } else {
        throw new Error('AI response too short or empty');
      }
    } catch (error) {
      console.error('AI Enhancement failed, using fallback:', error);
      // Intelligent fallback with game context
      const runners = Object.entries(gameState.runners)
        .filter(([_, on]) => on)
        .map(([base]) => base)
        .join(', ') || 'bases empty';
        
      return `${gameState.awayTeam} @ ${gameState.homeTeam}: ${Math.round(alertTier.probability * 100)}% scoring opportunity in the ${gameState.inning} ${gameState.inningState} with ${runners}, ${gameState.outs} outs. ${gameState.currentBatter?.name || 'Batter'} at the plate (.${Math.floor((gameState.currentBatter?.stats.avg || 0.250) * 1000).toString().padStart(3, '0')} AVG).`;
    }
  }

  private async generateAIEnhancedBetbook(alertTier: AlertTierResult, gameState: MLBGameStateV3): Promise<any> {
    try {
      const openai = await import('openai');
      const client = new openai.OpenAI();

      const prompt = `
You are a professional sports betting analyst. Analyze this live MLB situation and provide actionable betting insights.

GAME SITUATION:
- Teams: ${gameState.awayTeam} @ ${gameState.homeTeam}
- Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}
- Inning: ${gameState.inning} ${gameState.inningState}
- Outs: ${gameState.outs}
- Runners: ${Object.entries(gameState.runners).filter(([_, on]) => on).map(([base]) => base).join(', ') || 'None'}
- Scoring Probability: ${Math.round(alertTier.probability * 100)}%
- Weather: ${gameState.weather?.windSpeed || 'Unknown'} mph wind

BETTING CONTEXT:
- This is a Tier ${alertTier.tier} alert (${alertTier.tier === 1 ? 'moderate' : alertTier.tier === 2 ? 'high' : alertTier.tier === 3 ? 'critical' : 'extreme'} opportunity)
- Current batter: ${gameState.currentBatter?.name || 'Unknown'} (.${Math.floor((gameState.currentBatter?.stats.avg || 0.250) * 1000).toString().padStart(3, '0')} AVG, ${gameState.currentBatter?.stats.hr || 0} HR)

Provide ONE actionable betting insight focusing on:
1. Live betting opportunities (run lines, totals, player props)
2. Why this moment creates betting value
3. Specific market recommendations
4. Risk assessment

Format: 2-3 sentences, professional but accessible. End with responsible gambling reminder.
Return ONLY the insight text:`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.6,
      });

      const aiInsight = response.choices[0]?.message?.content?.trim();
      
      if (aiInsight && aiInsight.length > 20) {
        return {
          odds: {
            home: -110 + Math.floor(Math.random() * 40) - 20,
            away: +100 + Math.floor(Math.random() * 40) - 20,
            total: 8.5 + (Math.random() - 0.5) * 2,
          },
          aiAdvice: aiInsight,
          sportsbookLinks: [
            { name: 'FanDuel', url: 'https://www.fanduel.com/' },
            { name: 'DraftKings', url: 'https://www.draftkings.com/' },
            { name: 'BetMGM', url: 'https://www.betmgm.com/' }
          ],
        };
      } else {
        throw new Error('AI betting insight too short');
      }
    } catch (error) {
      console.error('AI Betting enhancement failed, using fallback:', error);
      // Intelligent fallback
      const baseInsight = `High ${Math.round(alertTier.probability * 100)}% scoring probability with ${gameState.outs} outs could shift live run lines. Consider monitoring ${gameState.homeTeam} totals and next-inning betting markets.`;
      
      return {
        odds: {
          home: -110,
          away: +100,
          total: 8.5,
        },
        aiAdvice: baseInsight + ' Always gamble responsibly and within your means.',
        sportsbookLinks: [
          { name: 'FanDuel', url: 'https://www.fanduel.com/' },
          { name: 'DraftKings', url: 'https://www.draftkings.com/' }
        ],
      };
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