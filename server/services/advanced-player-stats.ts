import { protectedFetch, mlbApiCircuit } from '../middleware/circuit-breaker';

export interface PlayerAdvancedStats {
  playerId: string;
  playerName: string;
  team: string;
  handedness: 'L' | 'R' | 'S'; // Left, Right, Switch
  xwOBA: number;        // Expected Weighted On-Base Average (0.250-0.450 typical range)
  wRCPlus: number;      // Weighted Runs Created Plus (100 = league average)
  babip: number;        // Batting Average on Balls in Play
  isoSlug: number;      // Isolated Slugging (SLG - AVG)
  plateAppearances: number;
  lastUpdated: string;
  // Recent performance trends (last 15 games)
  recent: {
    xwOBA: number;
    wRCPlus: number;
    plateAppearances: number;
    trend: 'hot' | 'cold' | 'average'; // Performance trend indicator
  };
}

export interface PitcherAdvancedStats {
  playerId: string;
  playerName: string;
  team: string;
  handedness: 'L' | 'R';
  xERA: number;         // Expected ERA based on batted ball quality
  xFIP: number;         // Expected Fielding Independent Pitching
  kwBB: number;         // K% - BB% (strikeout rate minus walk rate)
  babipAgainst: number; // BABIP allowed
  plateAppearancesFaced: number;
  lastUpdated: string;
  // Platoon splits performance
  platoonSplits: {
    vsLefties: { xwOBAAgainst: number; wRCPlusAgainst: number; };
    vsRighties: { xwOBAAgainst: number; wRCPlusAgainst: number; };
  };
}

export interface HandednessMatchup {
  matchupType: 'LvR' | 'RvL' | 'LvL' | 'RvR' | 'SvR' | 'SvL'; // Batter vs Pitcher
  favorsBatter: boolean;
  advantageStrength: 'strong' | 'moderate' | 'slight' | 'neutral';
  expectedWOBAModifier: number; // Multiplier for expected performance
  description: string;
}

export class AdvancedPlayerStatsService {
  private playerCache: Map<string, { stats: PlayerAdvancedStats; timestamp: number }> = new Map();
  private pitcherCache: Map<string, { stats: PitcherAdvancedStats; timestamp: number }> = new Map();
  private matchupCache: Map<string, { matchup: HandednessMatchup; timestamp: number }> = new Map();
  
  // Cache TTLs
  private readonly PLAYER_STATS_TTL = 24 * 60 * 60 * 1000; // 24 hours for season stats
  private readonly RECENT_STATS_TTL = 6 * 60 * 60 * 1000;  // 6 hours for recent trends
  private readonly MATCHUP_TTL = 60 * 60 * 1000;           // 1 hour for matchup calculations
  
  // League averages for 2024 season (fallback data)
  private readonly LEAGUE_AVERAGES = {
    xwOBA: 0.318,
    wRCPlus: 100,
    babip: 0.292,
    isoSlug: 0.162
  };

  private readonly PITCHER_LEAGUE_AVERAGES = {
    xERA: 4.28,
    xFIP: 4.15,
    kwBB: 0.145,
    babipAgainst: 0.292
  };

  /**
   * Get advanced statistics for a batter with caching
   */
  async getBatterAdvancedStats(playerName: string, teamName: string): Promise<PlayerAdvancedStats> {
    const cacheKey = `${playerName}_${teamName}`;
    const now = Date.now();
    
    // Check cache first
    const cached = this.playerCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.PLAYER_STATS_TTL) {
      return cached.stats;
    }

    try {
      // In a production system, this would fetch from MLB Stats API or Baseball Savant
      // For now, we'll generate sophisticated deterministic stats based on player/team
      const advancedStats = await this.generateAdvancedBatterStats(playerName, teamName);
      
      // Cache the result
      this.playerCache.set(cacheKey, { stats: advancedStats, timestamp: now });
      
      console.log(`📊 Advanced stats for ${playerName}: xwOBA=${advancedStats.xwOBA.toFixed(3)}, wRC+=${advancedStats.wRCPlus}`);
      return advancedStats;
    } catch (error) {
      console.error(`❌ Error fetching advanced stats for ${playerName}:`, error);
      return this.getDefaultBatterStats(playerName, teamName);
    }
  }

  /**
   * Get advanced statistics for a pitcher with caching
   */
  async getPitcherAdvancedStats(playerName: string, teamName: string): Promise<PitcherAdvancedStats> {
    const cacheKey = `pitcher_${playerName}_${teamName}`;
    const now = Date.now();
    
    // Check cache first
    const cached = this.pitcherCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.PLAYER_STATS_TTL) {
      return cached.stats;
    }

    try {
      const advancedStats = await this.generateAdvancedPitcherStats(playerName, teamName);
      
      // Cache the result
      this.pitcherCache.set(cacheKey, { stats: advancedStats, timestamp: now });
      
      return advancedStats;
    } catch (error) {
      console.error(`❌ Error fetching pitcher advanced stats for ${playerName}:`, error);
      return this.getDefaultPitcherStats(playerName, teamName);
    }
  }

  /**
   * Analyze handedness matchup between batter and pitcher
   */
  analyzeHandednessMatchup(batterHandedness: 'L' | 'R' | 'S', pitcherHandedness: 'L' | 'R'): HandednessMatchup {
    const matchupKey = `${batterHandedness}v${pitcherHandedness}`;
    const now = Date.now();
    
    // Check cache first
    const cached = this.matchupCache.get(matchupKey);
    if (cached && (now - cached.timestamp) < this.MATCHUP_TTL) {
      return cached.matchup;
    }

    const matchup = this.calculateHandednessMatchup(batterHandedness, pitcherHandedness);
    
    // Cache the result
    this.matchupCache.set(matchupKey, { matchup, timestamp: now });
    
    return matchup;
  }

  /**
   * Calculate comprehensive batter advantage considering advanced stats and handedness
   */
  calculateBatterAdvantage(
    batterStats: PlayerAdvancedStats, 
    pitcherStats: PitcherAdvancedStats
  ): number {
    // Base advantage from wRC+ differential
    const wrcAdvantage = (batterStats.wRCPlus - 100) / 100; // Convert to multiplier

    // xwOBA quality modifier
    const xwobaAdvantage = (batterStats.xwOBA - this.LEAGUE_AVERAGES.xwOBA) / this.LEAGUE_AVERAGES.xwOBA;

    // Pitcher quality adjustment
    const pitcherXERAAdvantage = (this.PITCHER_LEAGUE_AVERAGES.xERA - pitcherStats.xERA) / this.PITCHER_LEAGUE_AVERAGES.xERA;

    // Handedness matchup
    const handednessMatchup = this.analyzeHandednessMatchup(batterStats.handedness, pitcherStats.handedness);
    
    // Combine factors with weighted importance
    const totalAdvantage = (
      (wrcAdvantage * 0.4) +           // 40% weight on run creation
      (xwobaAdvantage * 0.3) +         // 30% weight on expected contact quality
      (pitcherXERAAdvantage * 0.2) +   // 20% weight on pitcher quality
      ((handednessMatchup.expectedWOBAModifier - 1.0) * 0.1) // 10% weight on handedness
    );

    // Apply recent performance trends
    const recentTrendBonus = this.calculateTrendBonus(batterStats.recent.trend);
    
    return Math.max(-0.5, Math.min(0.5, totalAdvantage + recentTrendBonus)); // Cap at ±50%
  }

  /**
   * Generate sophisticated deterministic advanced stats for a batter
   */
  private async generateAdvancedBatterStats(playerName: string, teamName: string): Promise<PlayerAdvancedStats> {
    // Generate deterministic but realistic stats based on name/team hash
    const nameHash = this.generateNameHash(playerName);
    const teamHash = this.generateNameHash(teamName);
    
    // Determine handedness (roughly 90% R, 8% L, 2% S in MLB)
    const handedness = this.determineHandedness(nameHash);
    
    // Generate xwOBA (realistic range 0.250-0.420)
    const xwOBA = Math.max(0.250, Math.min(0.420, 
      this.LEAGUE_AVERAGES.xwOBA + ((nameHash % 200 - 100) / 1000)
    ));
    
    // Generate wRC+ (realistic range 60-160)
    const wRCPlus = Math.max(60, Math.min(160,
      100 + Math.round((nameHash % 120 - 60) * 0.8)
    ));
    
    // Generate supporting stats
    const babip = Math.max(0.200, Math.min(0.400,
      this.LEAGUE_AVERAGES.babip + ((teamHash % 100 - 50) / 1000)
    ));
    
    const isoSlug = Math.max(0.080, Math.min(0.300,
      this.LEAGUE_AVERAGES.isoSlug + ((nameHash % 80 - 40) / 1000)
    ));
    
    // Generate recent performance trends
    const recentTrend = this.generateRecentTrend(nameHash, xwOBA, wRCPlus);
    
    return {
      playerId: `${nameHash}`,
      playerName,
      team: teamName,
      handedness,
      xwOBA: Math.round(xwOBA * 1000) / 1000,
      wRCPlus,
      babip: Math.round(babip * 1000) / 1000,
      isoSlug: Math.round(isoSlug * 1000) / 1000,
      plateAppearances: 450 + (nameHash % 200), // Realistic PA range
      lastUpdated: new Date().toISOString(),
      recent: recentTrend
    };
  }

  /**
   * Generate sophisticated deterministic advanced stats for a pitcher
   */
  private async generateAdvancedPitcherStats(playerName: string, teamName: string): Promise<PitcherAdvancedStats> {
    const nameHash = this.generateNameHash(playerName);
    const teamHash = this.generateNameHash(teamName);
    
    // Determine handedness (roughly 70% R, 30% L for pitchers)
    const handedness = (nameHash % 10) < 3 ? 'L' : 'R';
    
    // Generate xERA (realistic range 2.80-6.50)
    const xERA = Math.max(2.80, Math.min(6.50,
      this.PITCHER_LEAGUE_AVERAGES.xERA + ((nameHash % 200 - 100) / 100)
    ));
    
    // Generate xFIP (realistic range 3.00-6.00)
    const xFIP = Math.max(3.00, Math.min(6.00,
      this.PITCHER_LEAGUE_AVERAGES.xFIP + ((teamHash % 180 - 90) / 100)
    ));
    
    // Generate K%-BB% (realistic range -0.05 to 0.30)
    const kwBB = Math.max(-0.05, Math.min(0.30,
      this.PITCHER_LEAGUE_AVERAGES.kwBB + ((nameHash % 70 - 35) / 1000)
    ));
    
    // Generate BABIP against
    const babipAgainst = Math.max(0.240, Math.min(0.350,
      this.PITCHER_LEAGUE_AVERAGES.babipAgainst + ((teamHash % 60 - 30) / 1000)
    ));
    
    // Generate platoon splits
    const platoonSplits = this.generatePlatoonSplits(nameHash, handedness);
    
    return {
      playerId: `p_${nameHash}`,
      playerName,
      team: teamName,
      handedness,
      xERA: Math.round(xERA * 100) / 100,
      xFIP: Math.round(xFIP * 100) / 100,
      kwBB: Math.round(kwBB * 1000) / 1000,
      babipAgainst: Math.round(babipAgainst * 1000) / 1000,
      plateAppearancesFaced: 600 + (nameHash % 300),
      lastUpdated: new Date().toISOString(),
      platoonSplits
    };
  }

  /**
   * Calculate handedness matchup with sophisticated analysis
   */
  private calculateHandednessMatchup(
    batterHandedness: 'L' | 'R' | 'S', 
    pitcherHandedness: 'L' | 'R'
  ): HandednessMatchup {
    let matchupType: HandednessMatchup['matchupType'];
    let favorsBatter: boolean;
    let advantageStrength: HandednessMatchup['advantageStrength'];
    let expectedWOBAModifier: number;
    let description: string;

    // Handle switch hitters
    if (batterHandedness === 'S') {
      // Switch hitters bat opposite of pitcher
      if (pitcherHandedness === 'R') {
        matchupType = 'SvR';
        favorsBatter = true;
        advantageStrength = 'moderate';
        expectedWOBAModifier = 1.08; // 8% boost
        description = 'Switch hitter batting left vs RHP - favorable platoon advantage';
      } else {
        matchupType = 'SvL';
        favorsBatter = true;
        advantageStrength = 'slight';
        expectedWOBAModifier = 1.05; // 5% boost
        description = 'Switch hitter batting right vs LHP - slight platoon advantage';
      }
    }
    // Opposite handedness matchups (traditionally favor batter)
    else if (
      (batterHandedness === 'L' && pitcherHandedness === 'R') ||
      (batterHandedness === 'R' && pitcherHandedness === 'L')
    ) {
      matchupType = `${batterHandedness}v${pitcherHandedness}` as HandednessMatchup['matchupType'];
      favorsBatter = true;
      
      if (batterHandedness === 'L' && pitcherHandedness === 'R') {
        advantageStrength = 'strong';
        expectedWOBAModifier = 1.12; // 12% boost for LvR
        description = 'Lefty vs righty - strong platoon advantage';
      } else {
        advantageStrength = 'moderate';
        expectedWOBAModifier = 1.08; // 8% boost for RvL
        description = 'Righty vs lefty - good platoon advantage';
      }
    }
    // Same handedness matchups (traditionally favor pitcher)
    else {
      matchupType = `${batterHandedness}v${pitcherHandedness}` as HandednessMatchup['matchupType'];
      favorsBatter = false;
      
      if (batterHandedness === 'L') {
        advantageStrength = 'moderate';
        expectedWOBAModifier = 0.92; // 8% penalty for LvL
        description = 'Lefty vs lefty - pitcher has platoon advantage';
      } else {
        advantageStrength = 'slight';
        expectedWOBAModifier = 0.95; // 5% penalty for RvR
        description = 'Righty vs righty - slight pitcher advantage';
      }
    }

    return {
      matchupType,
      favorsBatter,
      advantageStrength,
      expectedWOBAModifier,
      description
    };
  }

  /**
   * Generate deterministic name-based hash for consistent stats
   */
  private generateNameHash(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Determine handedness based on name hash
   */
  private determineHandedness(nameHash: number): 'L' | 'R' | 'S' {
    const mod = nameHash % 100;
    if (mod < 8) return 'L';      // 8% lefties
    if (mod < 10) return 'S';     // 2% switch hitters
    return 'R';                   // 90% righties
  }

  /**
   * Generate recent performance trends
   */
  private generateRecentTrend(
    nameHash: number, 
    baseXwOBA: number, 
    baseWRCPlus: number
  ): PlayerAdvancedStats['recent'] {
    const trendMod = nameHash % 10;
    let trend: 'hot' | 'cold' | 'average';
    let xwOBAMod: number;
    let wrcMod: number;

    if (trendMod < 2) {
      trend = 'hot';
      xwOBAMod = 1.08;  // 8% boost when hot
      wrcMod = 1.15;    // 15% boost in run creation
    } else if (trendMod < 4) {
      trend = 'cold';
      xwOBAMod = 0.92;  // 8% penalty when cold
      wrcMod = 0.85;    // 15% penalty in run creation
    } else {
      trend = 'average';
      xwOBAMod = 1.0;   // No change
      wrcMod = 1.0;
    }

    return {
      xwOBA: Math.round(baseXwOBA * xwOBAMod * 1000) / 1000,
      wRCPlus: Math.round(baseWRCPlus * wrcMod),
      plateAppearances: 45 + (nameHash % 20), // Last 15 games
      trend
    };
  }

  /**
   * Generate platoon splits for pitchers
   */
  private generatePlatoonSplits(nameHash: number, handedness: 'L' | 'R') {
    // Realistic platoon split differentials
    const splitMod = nameHash % 50;
    
    // Same-handed batters typically perform worse against pitcher
    // Opposite-handed batters typically perform better
    
    let vsLefties: { xwOBAAgainst: number; wRCPlusAgainst: number };
    let vsRighties: { xwOBAAgainst: number; wRCPlusAgainst: number };

    if (handedness === 'R') {
      // RHP: tougher on RHB, easier on LHB
      vsRighties = {
        xwOBAAgainst: Math.max(0.280, this.LEAGUE_AVERAGES.xwOBA - 0.015 - (splitMod / 5000)),
        wRCPlusAgainst: Math.max(70, 95 - Math.round(splitMod / 10))
      };
      vsLefties = {
        xwOBAAgainst: Math.min(0.360, this.LEAGUE_AVERAGES.xwOBA + 0.020 + (splitMod / 4000)),
        wRCPlusAgainst: Math.min(130, 105 + Math.round(splitMod / 8))
      };
    } else {
      // LHP: tougher on LHB, easier on RHB
      vsLefties = {
        xwOBAAgainst: Math.max(0.285, this.LEAGUE_AVERAGES.xwOBA - 0.010 - (splitMod / 6000)),
        wRCPlusAgainst: Math.max(75, 98 - Math.round(splitMod / 12))
      };
      vsRighties = {
        xwOBAAgainst: Math.min(0.355, this.LEAGUE_AVERAGES.xwOBA + 0.015 + (splitMod / 5000)),
        wRCPlusAgainst: Math.min(125, 102 + Math.round(splitMod / 10))
      };
    }

    return { vsLefties, vsRighties };
  }

  /**
   * Calculate trend bonus for recent performance
   */
  private calculateTrendBonus(trend: 'hot' | 'cold' | 'average'): number {
    switch (trend) {
      case 'hot': return 0.08;    // 8% boost
      case 'cold': return -0.06;  // 6% penalty
      default: return 0.0;        // No change
    }
  }

  /**
   * Get default batter stats for error cases
   */
  private getDefaultBatterStats(playerName: string, teamName: string): PlayerAdvancedStats {
    return {
      playerId: 'unknown',
      playerName,
      team: teamName,
      handedness: 'R',
      xwOBA: this.LEAGUE_AVERAGES.xwOBA,
      wRCPlus: 100,
      babip: this.LEAGUE_AVERAGES.babip,
      isoSlug: this.LEAGUE_AVERAGES.isoSlug,
      plateAppearances: 500,
      lastUpdated: new Date().toISOString(),
      recent: {
        xwOBA: this.LEAGUE_AVERAGES.xwOBA,
        wRCPlus: 100,
        plateAppearances: 50,
        trend: 'average'
      }
    };
  }

  /**
   * Get default pitcher stats for error cases
   */
  private getDefaultPitcherStats(playerName: string, teamName: string): PitcherAdvancedStats {
    return {
      playerId: 'unknown',
      playerName,
      team: teamName,
      handedness: 'R',
      xERA: this.PITCHER_LEAGUE_AVERAGES.xERA,
      xFIP: this.PITCHER_LEAGUE_AVERAGES.xFIP,
      kwBB: this.PITCHER_LEAGUE_AVERAGES.kwBB,
      babipAgainst: this.PITCHER_LEAGUE_AVERAGES.babipAgainst,
      plateAppearancesFaced: 650,
      lastUpdated: new Date().toISOString(),
      platoonSplits: {
        vsLefties: { xwOBAAgainst: 0.315, wRCPlusAgainst: 98 },
        vsRighties: { xwOBAAgainst: 0.320, wRCPlusAgainst: 102 }
      }
    };
  }

  /**
   * Clear expired cache entries (called periodically)
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear expired player stats
    for (const [key, value] of this.playerCache.entries()) {
      if (now - value.timestamp > this.PLAYER_STATS_TTL) {
        this.playerCache.delete(key);
      }
    }
    
    // Clear expired pitcher stats  
    for (const [key, value] of this.pitcherCache.entries()) {
      if (now - value.timestamp > this.PLAYER_STATS_TTL) {
        this.pitcherCache.delete(key);
      }
    }
    
    // Clear expired matchup cache
    for (const [key, value] of this.matchupCache.entries()) {
      if (now - value.timestamp > this.MATCHUP_TTL) {
        this.matchupCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const advancedPlayerStats = new AdvancedPlayerStatsService();