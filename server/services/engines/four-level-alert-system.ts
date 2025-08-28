// 4-Level Alert System Implementation
// Based on: Game Monitoring Master Switch + Tiered Alert Levels

import { getWeatherData } from '../weather';
import { getEnhancedWeather } from '../enhanced-weather';
import { generateAdvancedPredictions } from '../ai-analysis';
const { 
  mlbL1WithProb, 
  mlbL2WithProb, 
  mlbL3WithProb, 
  calcMLBScoringAlert
} = require('./mlbAlertModel.js');

export interface GameState {
  gameId: string;
  sport: string;
  status: 'Scheduled' | 'Live' | 'Final' | 'Postponed';
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  clock?: {
    inning?: number;
    period?: number;
    timeRemaining?: string;
    outs?: number;
  };
  bases?: {
    on1B?: boolean;
    on2B?: boolean;
    on3B?: boolean;
  };
  currentBatter?: {
    id: number;
    name: string;
    seasonHR?: number;
    stats?: any;
  };
  currentPitcher?: {
    id: number;
    name: string;
    stats?: any;
  };
  venue?: string;
  weather?: any;
}

export interface LevelCheck {
  yes: boolean;
  reason?: string;
  priorityHint?: number;
  data?: any;
}

export interface LevelResults {
  L1: LevelCheck;
  L2: LevelCheck;
  L3: LevelCheck;
  L4?: LevelCheck & { upgradeTierTo?: number };
}

export interface AlertTier {
  tier: 1 | 2 | 3 | 4;
  levels: LevelResults;
  priority: number;
  description: string;
  metadata: {
    deduplicationKey: string;
    cooldownMs: number;
  };
}

export class FourLevelAlertSystem {
  private cooldownCache = new Map<string, number>();
  
  // Main evaluation function
  async maybeEvaluateGameAndAlert(game: GameState): Promise<AlertTier | null> {
    // Game Status Check (Master Switch)
    if (game.status === 'Scheduled' || game.status === 'Final') {
      return null;
    }
    
    if (game.status !== 'Live') {
      return null; // fail-safe
    }

    console.log(`🔍 Evaluating 4-level alert system for ${game.awayTeam} @ ${game.homeTeam}`);

    const levels = await this.evaluateLevels(game);
    const tier = this.decideTier(levels);

    // No alert if L1 is false and AI did not elevate
    if (!tier) {
      return null;
    }

    const alert = this.buildAlert(game, levels, tier);
    
    if (this.isDuplicateOrCoolingDown(alert)) {
      console.log(`🚫 Alert blocked due to cooldown: ${alert.description}`);
      return null;
    }

    this.persistAlertForCooldown(alert);
    return alert;
  }

  // Level evaluation functions
  async evaluateLevels(game: GameState): Promise<LevelResults> {
    const L1 = this.runLevel1HardCoded(game);
    const L2 = await this.runLevel2PlayerHistory(game);
    const L3 = await this.runLevel3Weather(game);
    const L4 = await this.runLevel4AISynthesis(game, { L1, L2, L3 });

    console.log(`📊 Level Results: L1=${L1.yes}, L2=${L2.yes}, L3=${L3.yes}, L4=${L4?.yes || false}`);
    
    return { L1, L2, L3, L4 };
  }

  // Level 1: Hard-coded sport logic (fail-safe)
  runLevel1HardCoded(game: GameState): LevelCheck {
    if (game.sport === 'MLB') {
      return this.mlbL1(game);
    }
    // TODO: Add other sports
    return { yes: false };
  }

  // MLB Level 1 implementation with Mathematical Model Enhancement
  mlbL1(game: GameState): LevelCheck {
    const inning = game.clock?.inning || 1;
    const outs = game.clock?.outs || 0;
    const on2B = game.bases?.on2B || false;
    const on3B = game.bases?.on3B || false;
    const on1B = game.bases?.on1B || false;

    // Try mathematical model first if we have complete data
    try {
      const mlbGameState = this.convertToMLBGameState(game);
      if (mlbGameState) {
        const probResult = mlbL1WithProb(mlbGameState);
        if (probResult.yes) {
          console.log(`🧮 Math-driven L1: ${probResult.reason}`);
          return probResult;
        }
      }
    } catch (error) {
      console.log(`⚠️  Math model failed, falling back to hard logic:`, error);
    }

    // Fallback to existing hard-coded logic
    // Runners on 2nd & 3rd with 0 outs
    if (on2B && on3B && outs === 0) {
      return { 
        yes: true, 
        reason: 'Runners on 2nd & 3rd, 0 outs', 
        priorityHint: 90 
      };
    }

    // Bases loaded ≤1 out
    if (on1B && on2B && on3B && outs <= 1) {
      return { 
        yes: true, 
        reason: 'Bases loaded ≤1 out', 
        priorityHint: 95 
      };
    }

    // Tie game in 9th+ inning
    if (inning >= 9 && game.homeScore === game.awayScore) {
      return { 
        yes: true, 
        reason: 'Tie game in 9th+', 
        priorityHint: 90 
      };
    }

    // Runners in scoring position (2nd or 3rd base)
    if (on2B || on3B) {
      return {
        yes: true,
        reason: 'Runners in scoring position',
        priorityHint: 75
      };
    }

    // Close game in late innings
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);
    if (inning >= 7 && scoreDiff <= 2) {
      return {
        yes: true,
        reason: 'Close game in late innings',
        priorityHint: 70
      };
    }

    return { yes: false };
  }

  // Level 2: Player/Historical trends with Mathematical Model Enhancement
  async runLevel2PlayerHistory(game: GameState): Promise<LevelCheck> {
    try {
      if (game.sport === 'MLB') {
        // Try mathematical model first
        try {
          const mlbGameState = this.convertToMLBGameState(game);
          if (mlbGameState) {
            const probResult = mlbL2WithProb(mlbGameState);
            if (probResult.yes) {
              console.log(`🧮 Math-driven L2: ${probResult.reason}`);
              return probResult;
            }
          }
        } catch (error) {
          console.log(`⚠️  Math model L2 failed, using traditional logic:`, error);
        }

        const batter = game.currentBatter;
        
        // Power hitter check
        if (batter && batter.seasonHR && batter.seasonHR >= 20) {
          // Check if runners in scoring position
          const risp = game.bases?.on2B || game.bases?.on3B;
          if (risp) {
            return {
              yes: true,
              reason: `Power hitter (${batter.seasonHR} HR) with RISP`,
              priorityHint: 80,
              data: { batterHR: batter.seasonHR }
            };
          }
        }

        // Hot streak detection (placeholder - could integrate with more detailed stats)
        if (batter && batter.stats && (batter.stats as any).ops && (batter.stats as any).ops > 0.900) {
          return {
            yes: true,
            reason: `Hot hitter (${((batter.stats as any).ops).toFixed(3)} OPS)`,
            priorityHint: 75,
            data: { batterOPS: (batter.stats as any).ops }
          };
        }
      }

      return { yes: false };
    } catch (error) {
      console.error('Level 2 evaluation error:', error);
      return { yes: false };
    }
  }

  // Level 3: Weather/Environment with Mathematical Model Enhancement  
  async runLevel3Weather(game: GameState): Promise<LevelCheck> {
    try {
      if (game.sport === 'MLB' && game.venue) {
        // Try mathematical model first
        try {
          const mlbGameState = this.convertToMLBGameState(game);
          if (mlbGameState) {
            const probResult = mlbL3WithProb(mlbGameState);
            if (probResult.yes) {
              console.log(`🧮 Math-driven L3: ${probResult.reason}`);
              return probResult;
            }
          }
        } catch (error) {
          console.log(`⚠️ Math model L3 failed, using traditional logic:`, error);
        }

        const weather = await getEnhancedWeather(game.venue);
        
        if (weather) {
          // Wind helping home runs (simplified - no direction check due to type issues)
          if (weather.windMph && weather.windMph >= 10) {
            return {
              yes: true,
              reason: `Strong wind conditions (${weather.windMph} mph)`,
              priorityHint: 70,
              data: { windMph: weather.windMph }
            };
          }

          // High temperature boosting offense
          if (weather.temperatureF && weather.temperatureF >= 85) {
            return {
              yes: true,
              reason: `Hot weather boosting offense (${weather.temperatureF}°F)`,
              priorityHint: 65,
              data: { temperature: weather.temperatureF }
            };
          }
        }
      }

      return { yes: false };
    } catch (error) {
      console.error('Level 3 evaluation error:', error);
      return { yes: false };
    }
  }

  // Level 4: AI Synthesis
  async runLevel4AISynthesis(game: GameState, priorLevels: Omit<LevelResults, 'L4'>): Promise<LevelCheck & { upgradeTierTo?: number }> {
    try {
      // Only run AI if we have something interesting to analyze
      if (!priorLevels.L1.yes && !priorLevels.L2.yes && !priorLevels.L3.yes) {
        return { yes: false };
      }

      // Prepare context for AI
      const context = {
        game,
        priorLevels,
        analysis: 'Evaluate if this situation warrants an upgraded alert tier'
      };

      // Use existing AI analysis (simplified for now)
      const aiResult = await generateAdvancedPredictions(
        game.gameId,
        context
      );

      if (aiResult && aiResult.leverageIndex && aiResult.leverageIndex > 2.0) {
        return {
          yes: true,
          reason: `AI elevated alert (leverage: ${aiResult.leverageIndex.toFixed(1)})`,
          priorityHint: 85,
          upgradeTierTo: 4,
          data: { aiLeverage: aiResult.leverageIndex, aiOutcome: aiResult.predictedOutcome }
        };
      }

      return { yes: false };
    } catch (error) {
      console.error('Level 4 evaluation error:', error);
      return { yes: false };
    }
  }

  // Tier decision logic
  decideTier(levels: LevelResults): 1 | 2 | 3 | 4 | null {
    // AI-only path
    if (!levels.L1.yes && levels.L4?.upgradeTierTo === 4) {
      return 4;
    }

    // Need L1 to be true for tiers 1-3
    if (!levels.L1.yes) {
      return null;
    }

    // All L1-L3 triggered
    if (levels.L1.yes && levels.L2.yes && levels.L3.yes) {
      return 3;
    }

    // Level1 + exactly one of L2 or L3
    if (levels.L1.yes && (levels.L2.yes !== levels.L3.yes)) {
      return 2;
    }

    // Only Level1
    if (levels.L1.yes && !levels.L2.yes && !levels.L3.yes) {
      return 1;
    }

    return null;
  }

  // Build alert object
  buildAlert(game: GameState, levels: LevelResults, tier: 1 | 2 | 3 | 4): AlertTier {
    const reasons = [
      levels.L1.yes ? `L1: ${levels.L1.reason}` : null,
      levels.L2.yes ? `L2: ${levels.L2.reason}` : null,
      levels.L3.yes ? `L3: ${levels.L3.reason}` : null,
      levels.L4?.yes ? `L4: ${levels.L4.reason}` : null
    ].filter(Boolean).join(' | ');

    const priority = this.calculatePriority(levels, tier);
    const description = this.generateDescription(game, levels, tier, reasons);
    const dedupKey = this.generateDeduplicationKey(game, levels, tier);

    return {
      tier,
      levels,
      priority,
      description,
      metadata: {
        deduplicationKey: dedupKey,
        cooldownMs: this.getCooldownMs(tier)
      }
    };
  }

  private calculatePriority(levels: LevelResults, tier: number): number {
    let priority = 50; // base priority
    
    if (levels.L1.priorityHint) priority = Math.max(priority, levels.L1.priorityHint);
    if (levels.L2.priorityHint) priority = Math.max(priority, levels.L2.priorityHint);
    if (levels.L3.priorityHint) priority = Math.max(priority, levels.L3.priorityHint);
    if (levels.L4?.priorityHint) priority = Math.max(priority, levels.L4.priorityHint);
    
    // Tier bonus
    priority += (tier - 1) * 10;
    
    return Math.min(priority, 100); // cap at 100
  }

  private generateDescription(game: GameState, levels: LevelResults, tier: number, reasons: string): string {
    const tierEmoji = ['', '🟢', '🟡', '🔵', '🟣'][tier];
    return `${tierEmoji} Tier ${tier} Alert: ${game.awayTeam} @ ${game.homeTeam} - ${reasons}`;
  }

  private generateDeduplicationKey(game: GameState, levels: LevelResults, tier: number): string {
    // Combine sport, game ID, inning/period, outs/time, bases, batter
    const parts = [
      game.sport,
      game.gameId,
      game.clock?.inning || game.clock?.period || 0,
      game.clock?.outs || 0,
      game.bases ? `${game.bases.on1B ? '1' : '0'}${game.bases.on2B ? '1' : '0'}${game.bases.on3B ? '1' : '0'}` : '000',
      game.currentBatter?.id || 'unknown',
      `tier${tier}`
    ];
    
    return parts.join(':');
  }

  private getCooldownMs(tier: number): number {
    // Higher tiers get longer cooldowns
    const cooldowns = [0, 60000, 90000, 120000, 180000]; // 0, 1min, 1.5min, 2min, 3min
    return cooldowns[tier] || 60000;
  }

  // Duplicate/cooldown checking
  private isDuplicateOrCoolingDown(alert: AlertTier): boolean {
    const key = alert.metadata.deduplicationKey;
    const lastSent = this.cooldownCache.get(key);
    
    if (!lastSent) {
      return false;
    }
    
    const elapsed = Date.now() - lastSent;
    return elapsed < alert.metadata.cooldownMs;
  }

  private persistAlertForCooldown(alert: AlertTier): void {
    this.cooldownCache.set(alert.metadata.deduplicationKey, Date.now());
    
    // Cleanup old entries (prevent memory leaks)
    if (this.cooldownCache.size > 1000) {
      const entries = Array.from(this.cooldownCache.entries());
      const cutoff = Date.now() - 3600000; // 1 hour
      
      for (const [key, timestamp] of entries) {
        if (timestamp < cutoff) {
          this.cooldownCache.delete(key);
        }
      }
    }
  }

  // Convert GameState to MLBGameState for mathematical model
  private convertToMLBGameState(game: GameState): any | null {
    if (game.sport !== 'MLB' || !game.clock?.inning || game.clock.outs === undefined) {
      return null;
    }

    const outs = game.clock.outs as 0 | 1 | 2;
    const half = game.clock.inning % 2 === 0 ? 'Bottom' : 'Top'; // Simple approximation
    
    return {
      gameId: game.gameId,
      clock: {
        inning: game.clock.inning,
        half,
        outs
      },
      score: {
        home: game.homeScore,
        away: game.awayScore
      },
      bases: {
        on1B: game.bases?.on1B || false,
        on2B: game.bases?.on2B || false,
        on3B: game.bases?.on3B || false
      },
      batter: game.currentBatter ? {
        hrSeason: game.currentBatter.seasonHR,
        xwOBA: (game.currentBatter.stats as any)?.xwOBA
      } : undefined,
      pitcher: game.currentPitcher ? {
        whip: (game.currentPitcher.stats as any)?.whip,
        gbRate: (game.currentPitcher.stats as any)?.gbRate
      } : undefined
    };
  }
}