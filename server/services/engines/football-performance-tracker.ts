/**
 * Football Performance Tracker
 * Tracks in-game performance metrics for quarterbacks, defense, teams and patterns
 * Provides context for alert generation and pattern detection across NFL/NCAAF/CFL
 */

// Interfaces for tracking various football performance aspects

export interface QuarterbackPerformance {
  playerId: string;
  playerName: string;
  gameId: string;
  teamId: string;
  // Passing stats
  completions: number;
  attempts: number;
  passingYards: number;
  touchdownPasses: number;
  interceptions: number;
  sacks: number;
  sacksYardsLost: number;
  qbRating: number;
  // Drive-specific performance
  currentDrive: {
    completions: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
    sacks: number;
    startFieldPosition: number;
  };
  // Recent performance (last 5 drives)
  lastFiveDrives: Array<{
    completions: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
    result: 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'downs' | 'end_of_half';
    duration: number; // seconds
    plays: number;
  }>;
  // Pressure and mobility
  pressureStats: {
    timesUnderPressure: number;
    completionsUnderPressure: number;
    attemptsUnderPressure: number;
    yardsUnderPressure: number;
    pressureRating: number; // calculated metric
  };
  // Situational stats
  redZoneStats: {
    attempts: number;
    completions: number;
    touchdowns: number;
    interceptions: number;
  };
  thirdDownStats: {
    attempts: number;
    completions: number;
    conversions: number;
  };
  fourthDownStats: {
    attempts: number;
    completions: number;
    conversions: number;
  };
  // Current streaks
  currentStreak: {
    type: 'completions' | 'touchdowns' | 'interceptions' | 'sacks' | null;
    count: number;
  };
  // Tracking
  lastUpdated: number;
}

export interface DefensePerformance {
  teamId: string;
  teamName: string;
  gameId: string;
  // Defensive stats
  tackles: number;
  assistedTackles: number;
  sacks: number;
  tacklesForLoss: number;
  interceptions: number;
  passDeflections: number;
  fumbleRecoveries: number;
  forcedFumbles: number;
  // Pressure generation
  quarterbackHits: number;
  pressures: number;
  blitzes: number;
  pressureRate: number; // calculated percentage
  // Coverage stats
  passesDefended: number;
  yardsAllowed: number;
  touchdownsAllowed: number;
  completionPercentageAllowed: number;
  // Recent performance (last 3 drives)
  lastThreeDrives: {
    stops: number; // drives that didn't result in touchdowns
    turnovers: number;
    sacksGenerated: number;
    yardsAllowed: number;
  };
  // Situational defense
  redZoneDefense: {
    attempts: number;
    touchdownsAllowed: number;
    fieldGoalsAllowed: number;
    stops: number;
    efficiency: number; // calculated percentage
  };
  thirdDownDefense: {
    attempts: number;
    conversionsAllowed: number;
    efficiency: number; // calculated percentage
  };
  // Current patterns
  currentMomentum: {
    type: 'dominant' | 'struggling' | 'neutral';
    consecutiveStops: number;
    consecutiveScores: number;
  };
  // Tracking
  lastUpdated: number;
}

export interface FootballTeamMomentum {
  teamId: string;
  teamName: string;
  gameId: string;
  // Scoring and drives
  totalPoints: number;
  pointsByQuarter: number[];
  totalDrives: number;
  scoringDrives: number;
  touchdownDrives: number;
  fieldGoalDrives: number;
  turnovers: number;
  // Current drive info
  currentDrive: {
    active: boolean;
    plays: number;
    yards: number;
    timeElapsed: number; // seconds
    startFieldPosition: number;
    currentFieldPosition: number;
    scoring: boolean; // true if drive has crossed into red zone
  };
  // Recent momentum (last 3 drives)
  lastThreeDrives: {
    points: number;
    yards: number;
    turnovers: number;
    timeOfPossession: number; // seconds
  };
  // Time of possession
  timeOfPossession: {
    total: number; // seconds
    average: number; // average seconds per drive
    currentQuarter: number; // seconds in current quarter
  };
  // Efficiency metrics
  redZoneEfficiency: {
    attempts: number;
    touchdowns: number;
    scores: number; // touchdowns + field goals
    percentage: number; // calculated
  };
  thirdDownEfficiency: {
    attempts: number;
    conversions: number;
    percentage: number; // calculated
  };
  fourthDownEfficiency: {
    attempts: number;
    conversions: number;
    percentage: number; // calculated
  };
  // Scoring patterns
  scoringStreaks: {
    current: number; // consecutive scoring drives
    longest: number; // longest in game
  };
  scorelessStreak: {
    drives: number; // consecutive non-scoring drives
    time: number; // time since last score in seconds
  };
  // Big plays
  bigPlays: {
    plays20Plus: number;
    plays40Plus: number;
    biggestPlay: {
      yards: number;
      quarter: number;
      type: 'pass' | 'run' | 'return';
    };
  };
  // Tracking
  lastUpdated: number;
}

export interface FootballPatternDetection {
  gameId: string;
  lastOccurred?: number; // Timestamp for cleanup tracking
  // Scoring patterns
  consecutiveTouchdowns: {
    current: number;
    max: number;
    lastOccurred: number; // quarter
  };
  consecutiveTurnovers: {
    current: number;
    max: number;
    lastOccurred: number;
    team: string; // which team is turning over
  };
  consecutiveStops: {
    current: number;
    max: number;
    lastOccurred: number;
    team: string; // which defense
  };
  // Quarterback patterns
  quarterbackHotStreak: {
    active: boolean;
    completionsInRow: number;
    yardsInStreak: number;
    touchdownsInStreak: number;
  };
  quarterbackStruggles: {
    active: boolean;
    incompletionsInRow: number;
    interceptionsInDrives: number;
    sacksInDrives: number;
  };
  // Team patterns
  comeback: {
    active: boolean;
    pointsNeeded: number;
    timeRemaining: number; // seconds
    momentum: 'building' | 'stalled' | 'strong';
  };
  blowout: {
    active: boolean;
    leadSize: number;
    timeWhenStarted: number; // seconds remaining when blowout began
  };
  // Special situations
  redZoneMastery: {
    active: boolean;
    consecutiveRedZoneScores: number;
    redZoneTouchdowns: number;
    efficiency: number;
  };
  defensiveDominance: {
    active: boolean;
    consecutiveThreeAndOuts: number;
    turnoversForced: number;
    yardsAllowedPerDrive: number;
  };
  // Rare events
  rareEvents: Array<{
    type: 'pick_six' | 'safety' | 'blocked_punt' | 'onside_kick' | 'fake_punt' | 'two_point_conversion' | 'missed_extra_point' | 'long_field_goal' | 'punt_return_td' | 'kickoff_return_td';
    quarter: number;
    description: string;
    timestamp: number;
    impact: 'high' | 'medium' | 'low';
  }>;
  // Game flow anomalies
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
    quarter: number;
  }>;
}

// Main Football Performance Tracker Class
export class FootballPerformanceTracker {
  // Storage maps for different performance aspects
  private quarterbackPerformance: Map<string, Map<string, QuarterbackPerformance>> = new Map(); // gameId -> playerId -> performance
  private defensePerformance: Map<string, Map<string, DefensePerformance>> = new Map(); // gameId -> teamId -> defense
  private teamMomentum: Map<string, Map<string, FootballTeamMomentum>> = new Map(); // gameId -> teamId -> momentum
  private patterns: Map<string, FootballPatternDetection> = new Map(); // gameId -> patterns

  // Cache management
  private lastCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour
  private readonly MAX_GAME_AGE = 14400000; // 4 hours

  constructor() {
    console.log('🏈 Football Performance Tracker initialized');
  }

  /**
   * Update quarterback performance based on a play outcome
   */
  updateQuarterbackPerformance(
    gameId: string,
    playerId: string,
    playerName: string,
    teamId: string,
    play: {
      type: 'pass' | 'sack' | 'run' | 'scramble';
      completed?: boolean; // for passes
      yards: number;
      touchdown?: boolean;
      interception?: boolean;
      underPressure?: boolean;
      quarter: number;
      down?: number;
      yardsToGo?: number;
      fieldPosition?: number;
      redZone?: boolean;
      thirdDown?: boolean;
      fourthDown?: boolean;
    }
  ): void {
    // Initialize if needed
    if (!this.quarterbackPerformance.has(gameId)) {
      this.quarterbackPerformance.set(gameId, new Map());
    }

    const gamePerformance = this.quarterbackPerformance.get(gameId)!;
    
    // Get or create quarterback record
    let qb = gamePerformance.get(playerId);
    if (!qb) {
      qb = this.initializeQuarterbackPerformance(playerId, playerName, gameId, teamId);
      gamePerformance.set(playerId, qb);
    }

    // Update based on play type
    if (play.type === 'pass') {
      qb.attempts++;
      qb.currentDrive.attempts++;

      if (play.completed) {
        qb.completions++;
        qb.currentDrive.completions++;
        qb.passingYards += play.yards;
        qb.currentDrive.yards += play.yards;

        // Update current streak
        if (qb.currentStreak.type === 'completions') {
          qb.currentStreak.count++;
        } else {
          qb.currentStreak = { type: 'completions', count: 1 };
        }
      } else {
        // Reset completion streak
        if (qb.currentStreak.type === 'completions') {
          qb.currentStreak = { type: null, count: 0 };
        }
      }

      if (play.touchdown) {
        qb.touchdownPasses++;
        qb.currentDrive.touchdowns++;
        
        // Update touchdown streak
        if (qb.currentStreak.type === 'touchdowns') {
          qb.currentStreak.count++;
        } else {
          qb.currentStreak = { type: 'touchdowns', count: 1 };
        }
      }

      if (play.interception) {
        qb.interceptions++;
        qb.currentDrive.interceptions++;
        
        // Update interception streak
        if (qb.currentStreak.type === 'interceptions') {
          qb.currentStreak.count++;
        } else {
          qb.currentStreak = { type: 'interceptions', count: 1 };
        }
      }

      // Track pressure stats
      if (play.underPressure) {
        qb.pressureStats.timesUnderPressure++;
        qb.pressureStats.attemptsUnderPressure++;
        if (play.completed) {
          qb.pressureStats.completionsUnderPressure++;
          qb.pressureStats.yardsUnderPressure += play.yards;
        }
      }

      // Situational stats
      if (play.redZone) {
        qb.redZoneStats.attempts++;
        if (play.completed) qb.redZoneStats.completions++;
        if (play.touchdown) qb.redZoneStats.touchdowns++;
        if (play.interception) qb.redZoneStats.interceptions++;
      }

      if (play.thirdDown) {
        qb.thirdDownStats.attempts++;
        if (play.completed) qb.thirdDownStats.completions++;
        // Conversion tracking would need yards to go info
        if (play.yards >= (play.yardsToGo || 0)) {
          qb.thirdDownStats.conversions++;
        }
      }

      if (play.fourthDown) {
        qb.fourthDownStats.attempts++;
        if (play.completed) qb.fourthDownStats.completions++;
        if (play.yards >= (play.yardsToGo || 0)) {
          qb.fourthDownStats.conversions++;
        }
      }

    } else if (play.type === 'sack') {
      qb.sacks++;
      qb.sacksYardsLost += Math.abs(play.yards);
      
      // Update sack streak
      if (qb.currentStreak.type === 'sacks') {
        qb.currentStreak.count++;
      } else {
        qb.currentStreak = { type: 'sacks', count: 1 };
      }
    }

    // Calculate QB rating (simplified version)
    qb.qbRating = this.calculateQBRating(qb);
    
    // Calculate pressure rating
    qb.pressureStats.pressureRating = this.calculatePressureRating(qb.pressureStats);

    qb.lastUpdated = Date.now();

    // Update pattern detection
    this.updatePatternDetection(gameId, 'quarterback', play);
  }

  /**
   * Update defense performance
   */
  updateDefensePerformance(
    gameId: string,
    teamId: string,
    teamName: string,
    play: {
      type: 'tackle' | 'sack' | 'interception' | 'pass_deflection' | 'fumble_recovery' | 'forced_fumble' | 'tackle_for_loss';
      quarter: number;
      yardsAllowed?: number;
      touchdown?: boolean;
      redZone?: boolean;
      thirdDown?: boolean;
      conversion?: boolean;
      pressure?: boolean;
      blitz?: boolean;
    }
  ): void {
    if (!this.defensePerformance.has(gameId)) {
      this.defensePerformance.set(gameId, new Map());
    }

    const gamePerformance = this.defensePerformance.get(gameId)!;
    
    let defense = gamePerformance.get(teamId);
    if (!defense) {
      defense = this.initializeDefensePerformance(teamId, teamName, gameId);
      gamePerformance.set(teamId, defense);
    }

    // Update based on play type
    switch (play.type) {
      case 'tackle':
        defense.tackles++;
        if (play.yardsAllowed !== undefined) {
          defense.yardsAllowed += play.yardsAllowed;
        }
        break;
      case 'sack':
        defense.sacks++;
        defense.quarterbackHits++;
        defense.tacklesForLoss++;
        break;
      case 'interception':
        defense.interceptions++;
        defense.turnovers++;
        break;
      case 'pass_deflection':
        defense.passDeflections++;
        defense.passesDefended++;
        break;
      case 'fumble_recovery':
        defense.fumbleRecoveries++;
        defense.turnovers++;
        break;
      case 'forced_fumble':
        defense.forcedFumbles++;
        break;
      case 'tackle_for_loss':
        defense.tacklesForLoss++;
        break;
    }

    // Track pressure
    if (play.pressure) {
      defense.pressures++;
    }
    if (play.blitz) {
      defense.blitzes++;
    }

    // Situational defense
    if (play.redZone) {
      defense.redZoneDefense.attempts++;
      if (play.touchdown) {
        defense.redZoneDefense.touchdownsAllowed++;
        defense.touchdownsAllowed++;
      }
    }

    if (play.thirdDown) {
      defense.thirdDownDefense.attempts++;
      if (play.conversion) {
        defense.thirdDownDefense.conversionsAllowed++;
      }
    }

    // Calculate efficiency percentages
    defense.redZoneDefense.efficiency = defense.redZoneDefense.attempts > 0 
      ? ((defense.redZoneDefense.attempts - defense.redZoneDefense.touchdownsAllowed) / defense.redZoneDefense.attempts) * 100
      : 100;

    defense.thirdDownDefense.efficiency = defense.thirdDownDefense.attempts > 0
      ? ((defense.thirdDownDefense.attempts - defense.thirdDownDefense.conversionsAllowed) / defense.thirdDownDefense.attempts) * 100
      : 100;

    // Update momentum
    this.updateDefensiveMomentum(defense, play);

    defense.lastUpdated = Date.now();
  }

  /**
   * Update team momentum
   */
  updateTeamMomentum(
    gameId: string,
    teamId: string,
    teamName: string,
    quarter: number,
    event: {
      type: 'score' | 'turnover' | 'drive_start' | 'drive_end' | 'big_play' | 'possession_change';
      points?: number;
      scoreType?: 'touchdown' | 'field_goal' | 'safety' | 'two_point';
      driveResult?: 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'downs' | 'end_of_half';
      yards?: number;
      playType?: 'pass' | 'run' | 'return';
      timeOfPossession?: number;
      fieldPosition?: number;
      redZone?: boolean;
    }
  ): void {
    if (!this.teamMomentum.has(gameId)) {
      this.teamMomentum.set(gameId, new Map());
    }

    const gameMomentum = this.teamMomentum.get(gameId)!;
    
    let momentum = gameMomentum.get(teamId);
    if (!momentum) {
      momentum = this.initializeTeamMomentum(teamId, teamName, gameId);
      gameMomentum.set(teamId, momentum);
    }

    // Ensure pointsByQuarter array is long enough
    while (momentum.pointsByQuarter.length <= quarter) {
      momentum.pointsByQuarter.push(0);
    }

    // Update based on event type
    switch (event.type) {
      case 'score':
        const points = event.points || 0;
        momentum.totalPoints += points;
        momentum.pointsByQuarter[quarter] += points;
        momentum.scoringDrives++;
        
        if (event.scoreType === 'touchdown') {
          momentum.touchdownDrives++;
        } else if (event.scoreType === 'field_goal') {
          momentum.fieldGoalDrives++;
        }

        // Update scoring streaks
        momentum.scoringStreaks.current++;
        if (momentum.scoringStreaks.current > momentum.scoringStreaks.longest) {
          momentum.scoringStreaks.longest = momentum.scoringStreaks.current;
        }
        momentum.scorelessStreak.drives = 0;
        momentum.scorelessStreak.time = 0;
        break;

      case 'turnover':
        momentum.turnovers++;
        break;

      case 'drive_start':
        momentum.totalDrives++;
        momentum.currentDrive = {
          active: true,
          plays: 0,
          yards: 0,
          timeElapsed: 0,
          startFieldPosition: event.fieldPosition || 25,
          currentFieldPosition: event.fieldPosition || 25,
          scoring: false
        };
        break;

      case 'drive_end':
        momentum.currentDrive.active = false;
        
        if (event.driveResult && !['touchdown', 'field_goal'].includes(event.driveResult)) {
          momentum.scorelessStreak.drives++;
        }

        // Add to recent drives tracking
        momentum.lastThreeDrives.timeOfPossession += event.timeOfPossession || 0;
        break;

      case 'big_play':
        const yards = event.yards || 0;
        if (yards >= 20) {
          momentum.bigPlays.plays20Plus++;
        }
        if (yards >= 40) {
          momentum.bigPlays.plays40Plus++;
        }
        
        if (yards > momentum.bigPlays.biggestPlay.yards) {
          momentum.bigPlays.biggestPlay = {
            yards,
            quarter,
            type: event.playType || 'pass'
          };
        }
        break;
    }

    // Update red zone efficiency
    if (event.redZone && event.type === 'score') {
      momentum.redZoneEfficiency.attempts++;
      momentum.redZoneEfficiency.scores++;
      if (event.scoreType === 'touchdown') {
        momentum.redZoneEfficiency.touchdowns++;
      }
      momentum.redZoneEfficiency.percentage = 
        (momentum.redZoneEfficiency.scores / momentum.redZoneEfficiency.attempts) * 100;
    }

    // Update time of possession
    if (event.timeOfPossession) {
      momentum.timeOfPossession.total += event.timeOfPossession;
      momentum.timeOfPossession.average = momentum.totalDrives > 0
        ? momentum.timeOfPossession.total / momentum.totalDrives
        : 0;
    }

    momentum.lastUpdated = Date.now();

    // Update pattern detection
    this.updatePatternDetection(gameId, 'team', event);
  }

  /**
   * Get quarterback's current performance summary for alerts
   */
  getQuarterbackSummary(gameId: string, playerId: string): string | null {
    const gamePerformance = this.quarterbackPerformance.get(gameId);
    if (!gamePerformance) return null;

    const qb = gamePerformance.get(playerId);
    if (!qb) return null;

    const parts: string[] = [];
    
    // Current drive performance
    if (qb.currentDrive.attempts > 0) {
      parts.push(`${qb.currentDrive.completions}/${qb.currentDrive.attempts} for ${qb.currentDrive.yards} yards this drive`);
    }

    // Overall game stats
    const completionPct = qb.attempts > 0 
      ? ((qb.completions / qb.attempts) * 100).toFixed(1) 
      : '0.0';
    parts.push(`${qb.completions}/${qb.attempts} (${completionPct}%) for ${qb.passingYards} yards`);

    // Touchdowns and interceptions
    if (qb.touchdownPasses > 0 || qb.interceptions > 0) {
      parts.push(`${qb.touchdownPasses} TD, ${qb.interceptions} INT`);
    }

    // Current streak
    if (qb.currentStreak.type && qb.currentStreak.count >= 2) {
      parts.push(`${qb.currentStreak.count} ${qb.currentStreak.type} in a row`);
    }

    // Pressure performance
    if (qb.pressureStats.attemptsUnderPressure > 0) {
      const pressurePct = ((qb.pressureStats.completionsUnderPressure / qb.pressureStats.attemptsUnderPressure) * 100).toFixed(1);
      parts.push(`${pressurePct}% under pressure`);
    }

    // QB Rating
    if (qb.qbRating > 0) {
      parts.push(`${qb.qbRating.toFixed(1)} QBR`);
    }

    return parts.join(', ');
  }

  /**
   * Get team momentum summary for alerts
   */
  getTeamMomentumSummary(gameId: string, teamId: string): string | null {
    const gameMomentum = this.teamMomentum.get(gameId);
    if (!gameMomentum) return null;

    const momentum = gameMomentum.get(teamId);
    if (!momentum) return null;

    const parts: string[] = [];

    // Current drive
    if (momentum.currentDrive.active && momentum.currentDrive.yards > 0) {
      parts.push(`${momentum.currentDrive.yards} yards on current drive`);
    }

    // Scoring efficiency
    if (momentum.totalDrives > 0) {
      const scoringPct = ((momentum.scoringDrives / momentum.totalDrives) * 100).toFixed(1);
      parts.push(`${scoringPct}% scoring drives`);
    }

    // Red zone efficiency
    if (momentum.redZoneEfficiency.attempts > 0) {
      parts.push(`${momentum.redZoneEfficiency.percentage.toFixed(1)}% in red zone`);
    }

    // Recent momentum
    if (momentum.scoringStreaks.current >= 2) {
      parts.push(`${momentum.scoringStreaks.current} straight scoring drives`);
    } else if (momentum.scorelessStreak.drives >= 3) {
      parts.push(`${momentum.scorelessStreak.drives} straight scoreless drives`);
    }

    // Big plays
    if (momentum.bigPlays.plays20Plus > 0) {
      parts.push(`${momentum.bigPlays.plays20Plus} plays of 20+ yards`);
    }

    // Time of possession
    const avgTOP = momentum.timeOfPossession.average;
    if (avgTOP > 0) {
      const minutes = Math.floor(avgTOP / 60);
      const seconds = Math.floor(avgTOP % 60);
      parts.push(`${minutes}:${seconds.toString().padStart(2, '0')} avg TOP`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Get defense performance summary for alerts
   */
  getDefenseSummary(gameId: string, teamId: string): string | null {
    const gamePerformance = this.defensePerformance.get(gameId);
    if (!gamePerformance) return null;

    const defense = gamePerformance.get(teamId);
    if (!defense) return null;

    const parts: string[] = [];

    // Key defensive stats
    if (defense.sacks > 0) {
      parts.push(`${defense.sacks} sacks`);
    }

    if (defense.interceptions > 0) {
      parts.push(`${defense.interceptions} INT`);
    }

    if (defense.fumbleRecoveries > 0) {
      parts.push(`${defense.fumbleRecoveries} fumble recoveries`);
    }

    // Efficiency stats
    if (defense.thirdDownDefense.attempts > 0) {
      parts.push(`${defense.thirdDownDefense.efficiency.toFixed(1)}% 3rd down stops`);
    }

    if (defense.redZoneDefense.attempts > 0) {
      parts.push(`${defense.redZoneDefense.efficiency.toFixed(1)}% red zone defense`);
    }

    // Current momentum
    if (defense.currentMomentum.consecutiveStops >= 2) {
      parts.push(`${defense.currentMomentum.consecutiveStops} straight stops`);
    }

    // Pressure stats
    if (defense.pressures > 0) {
      parts.push(`${defense.pressures} QB pressures`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Get detected patterns for a game
   */
  getPatterns(gameId: string): FootballPatternDetection | null {
    return this.patterns.get(gameId) || null;
  }

  /**
   * Detect unusual patterns for enhanced alerts
   */
  detectUnusualPatterns(gameId: string): string[] {
    const patterns = this.patterns.get(gameId);
    if (!patterns) return [];

    const unusual: string[] = [];

    // Quarterback patterns
    if (patterns.quarterbackHotStreak.active) {
      unusual.push(`QB hot streak: ${patterns.quarterbackHotStreak.completionsInRow} straight completions`);
    }

    if (patterns.quarterbackStruggles.active) {
      unusual.push(`QB struggling: ${patterns.quarterbackStruggles.incompletionsInRow} straight incompletions`);
    }

    // Scoring patterns
    if (patterns.consecutiveTouchdowns.current >= 2) {
      unusual.push(`${patterns.consecutiveTouchdowns.current} straight touchdowns`);
    }

    if (patterns.consecutiveTurnovers.current >= 2) {
      unusual.push(`${patterns.consecutiveTurnovers.current} straight turnovers by ${patterns.consecutiveTurnovers.team}`);
    }

    // Team patterns
    if (patterns.comeback.active) {
      unusual.push(`Comeback attempt: ${patterns.comeback.pointsNeeded} points needed, momentum ${patterns.comeback.momentum}`);
    }

    if (patterns.blowout.active) {
      unusual.push(`Blowout situation: ${patterns.blowout.leadSize} point lead`);
    }

    // Special situations
    if (patterns.redZoneMastery.active) {
      unusual.push(`Red zone mastery: ${patterns.redZoneMastery.consecutiveRedZoneScores} straight red zone scores`);
    }

    if (patterns.defensiveDominance.active) {
      unusual.push(`Defensive dominance: ${patterns.defensiveDominance.consecutiveThreeAndOuts} straight three-and-outs`);
    }

    // Rare events
    patterns.rareEvents.forEach(event => {
      unusual.push(`RARE: ${event.description}`);
    });

    return unusual;
  }

  /**
   * Clean up old game data
   */
  cleanupOldGames(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) {
      return;
    }

    console.log('🧹 Cleaning up old Football performance data');

    // Clean up each storage map
    this.cleanupMap(this.quarterbackPerformance);
    this.cleanupMap(this.defensePerformance);
    this.cleanupMap(this.teamMomentum);
    
    // Clean up patterns (single level map)
    for (const [gameId, pattern] of this.patterns) {
      if (this.isGameDataOld(pattern.lastOccurred || 0)) {
        this.patterns.delete(gameId);
        console.log(`🗑️ Removed pattern data for game ${gameId}`);
      }
    }

    this.lastCleanup = now;
  }

  /**
   * Clear all data for a specific game
   */
  clearGameData(gameId: string): void {
    this.quarterbackPerformance.delete(gameId);
    this.defensePerformance.delete(gameId);
    this.teamMomentum.delete(gameId);
    this.patterns.delete(gameId);
    
    console.log(`🧹 Cleared all performance data for game ${gameId}`);
  }

  // Private helper methods

  private initializeQuarterbackPerformance(playerId: string, playerName: string, gameId: string, teamId: string): QuarterbackPerformance {
    return {
      playerId,
      playerName,
      gameId,
      teamId,
      completions: 0,
      attempts: 0,
      passingYards: 0,
      touchdownPasses: 0,
      interceptions: 0,
      sacks: 0,
      sacksYardsLost: 0,
      qbRating: 0,
      currentDrive: {
        completions: 0,
        attempts: 0,
        yards: 0,
        touchdowns: 0,
        interceptions: 0,
        sacks: 0,
        startFieldPosition: 25
      },
      lastFiveDrives: [],
      pressureStats: {
        timesUnderPressure: 0,
        completionsUnderPressure: 0,
        attemptsUnderPressure: 0,
        yardsUnderPressure: 0,
        pressureRating: 0
      },
      redZoneStats: {
        attempts: 0,
        completions: 0,
        touchdowns: 0,
        interceptions: 0
      },
      thirdDownStats: {
        attempts: 0,
        completions: 0,
        conversions: 0
      },
      fourthDownStats: {
        attempts: 0,
        completions: 0,
        conversions: 0
      },
      currentStreak: {
        type: null,
        count: 0
      },
      lastUpdated: Date.now()
    };
  }

  private initializeDefensePerformance(teamId: string, teamName: string, gameId: string): DefensePerformance {
    return {
      teamId,
      teamName,
      gameId,
      tackles: 0,
      assistedTackles: 0,
      sacks: 0,
      tacklesForLoss: 0,
      interceptions: 0,
      passDeflections: 0,
      fumbleRecoveries: 0,
      forcedFumbles: 0,
      quarterbackHits: 0,
      pressures: 0,
      blitzes: 0,
      pressureRate: 0,
      passesDefended: 0,
      yardsAllowed: 0,
      touchdownsAllowed: 0,
      completionPercentageAllowed: 0,
      lastThreeDrives: {
        stops: 0,
        turnovers: 0,
        sacksGenerated: 0,
        yardsAllowed: 0
      },
      redZoneDefense: {
        attempts: 0,
        touchdownsAllowed: 0,
        fieldGoalsAllowed: 0,
        stops: 0,
        efficiency: 100
      },
      thirdDownDefense: {
        attempts: 0,
        conversionsAllowed: 0,
        efficiency: 100
      },
      currentMomentum: {
        type: 'neutral',
        consecutiveStops: 0,
        consecutiveScores: 0
      },
      turnovers: 0,
      lastUpdated: Date.now()
    };
  }

  private initializeTeamMomentum(teamId: string, teamName: string, gameId: string): FootballTeamMomentum {
    return {
      teamId,
      teamName,
      gameId,
      totalPoints: 0,
      pointsByQuarter: [],
      totalDrives: 0,
      scoringDrives: 0,
      touchdownDrives: 0,
      fieldGoalDrives: 0,
      turnovers: 0,
      currentDrive: {
        active: false,
        plays: 0,
        yards: 0,
        timeElapsed: 0,
        startFieldPosition: 25,
        currentFieldPosition: 25,
        scoring: false
      },
      lastThreeDrives: {
        points: 0,
        yards: 0,
        turnovers: 0,
        timeOfPossession: 0
      },
      timeOfPossession: {
        total: 0,
        average: 0,
        currentQuarter: 0
      },
      redZoneEfficiency: {
        attempts: 0,
        touchdowns: 0,
        scores: 0,
        percentage: 0
      },
      thirdDownEfficiency: {
        attempts: 0,
        conversions: 0,
        percentage: 0
      },
      fourthDownEfficiency: {
        attempts: 0,
        conversions: 0,
        percentage: 0
      },
      scoringStreaks: {
        current: 0,
        longest: 0
      },
      scorelessStreak: {
        drives: 0,
        time: 0
      },
      bigPlays: {
        plays20Plus: 0,
        plays40Plus: 0,
        biggestPlay: {
          yards: 0,
          quarter: 1,
          type: 'pass'
        }
      },
      lastUpdated: Date.now()
    };
  }

  private calculateQBRating(qb: QuarterbackPerformance): number {
    if (qb.attempts === 0) return 0;

    // Simplified QB rating calculation
    const completionPct = (qb.completions / qb.attempts) * 100;
    const yardsPerAttempt = qb.passingYards / qb.attempts;
    const tdRate = (qb.touchdownPasses / qb.attempts) * 100;
    const intRate = (qb.interceptions / qb.attempts) * 100;

    // Simplified formula (real NFL passer rating is more complex)
    const rating = Math.max(0, Math.min(158.3, 
      (completionPct - 30) * 0.05 +
      (yardsPerAttempt - 3) * 0.25 +
      tdRate * 0.2 +
      (2.375 - intRate * 0.25) +
      39.375
    ));

    return Math.round(rating * 10) / 10;
  }

  private calculatePressureRating(pressureStats: QuarterbackPerformance['pressureStats']): number {
    if (pressureStats.attemptsUnderPressure === 0) return 100;

    const completionPctUnderPressure = (pressureStats.completionsUnderPressure / pressureStats.attemptsUnderPressure) * 100;
    const yardsPerAttemptUnderPressure = pressureStats.yardsUnderPressure / pressureStats.attemptsUnderPressure;

    // Simple pressure rating (0-100, higher is better under pressure)
    return Math.max(0, Math.min(100, 
      completionPctUnderPressure * 0.6 + yardsPerAttemptUnderPressure * 5
    ));
  }

  private updateDefensiveMomentum(defense: DefensePerformance, play: any): void {
    // Update current momentum based on recent plays
    if (['sack', 'interception', 'fumble_recovery', 'tackle_for_loss'].includes(play.type)) {
      defense.currentMomentum.consecutiveStops++;
      defense.currentMomentum.consecutiveScores = 0;
      
      if (defense.currentMomentum.consecutiveStops >= 3) {
        defense.currentMomentum.type = 'dominant';
      } else {
        defense.currentMomentum.type = 'neutral';
      }
    } else if (play.touchdown) {
      defense.currentMomentum.consecutiveScores++;
      defense.currentMomentum.consecutiveStops = 0;
      
      if (defense.currentMomentum.consecutiveScores >= 2) {
        defense.currentMomentum.type = 'struggling';
      }
    }
  }

  private updatePatternDetection(gameId: string, context: string, data: any): void {
    if (!this.patterns.has(gameId)) {
      this.patterns.set(gameId, this.initializePatternDetection(gameId));
    }

    const patterns = this.patterns.get(gameId)!;

    // Update patterns based on context and data
    if (context === 'quarterback' && data.type === 'pass') {
      if (data.completed) {
        patterns.quarterbackHotStreak.completionsInRow++;
        patterns.quarterbackStruggles.incompletionsInRow = 0;
        
        if (patterns.quarterbackHotStreak.completionsInRow >= 5) {
          patterns.quarterbackHotStreak.active = true;
          patterns.quarterbackHotStreak.yardsInStreak += data.yards || 0;
          if (data.touchdown) patterns.quarterbackHotStreak.touchdownsInStreak++;
        }
      } else {
        patterns.quarterbackStruggles.incompletionsInRow++;
        patterns.quarterbackHotStreak.completionsInRow = 0;
        patterns.quarterbackHotStreak.active = false;
        
        if (patterns.quarterbackStruggles.incompletionsInRow >= 3) {
          patterns.quarterbackStruggles.active = true;
        }
      }

      if (data.interception) {
        patterns.consecutiveTurnovers.current++;
        patterns.quarterbackStruggles.interceptionsInDrives++;
      }
    }

    if (context === 'team') {
      if (data.type === 'score' && data.scoreType === 'touchdown') {
        patterns.consecutiveTouchdowns.current++;
        patterns.consecutiveTouchdowns.max = Math.max(
          patterns.consecutiveTouchdowns.max, 
          patterns.consecutiveTouchdowns.current
        );
      }
    }

    patterns.lastOccurred = Date.now();
  }

  private initializePatternDetection(gameId: string): FootballPatternDetection {
    return {
      gameId,
      lastOccurred: Date.now(),
      consecutiveTouchdowns: {
        current: 0,
        max: 0,
        lastOccurred: 0
      },
      consecutiveTurnovers: {
        current: 0,
        max: 0,
        lastOccurred: 0,
        team: ''
      },
      consecutiveStops: {
        current: 0,
        max: 0,
        lastOccurred: 0,
        team: ''
      },
      quarterbackHotStreak: {
        active: false,
        completionsInRow: 0,
        yardsInStreak: 0,
        touchdownsInStreak: 0
      },
      quarterbackStruggles: {
        active: false,
        incompletionsInRow: 0,
        interceptionsInDrives: 0,
        sacksInDrives: 0
      },
      comeback: {
        active: false,
        pointsNeeded: 0,
        timeRemaining: 0,
        momentum: 'building'
      },
      blowout: {
        active: false,
        leadSize: 0,
        timeWhenStarted: 0
      },
      redZoneMastery: {
        active: false,
        consecutiveRedZoneScores: 0,
        redZoneTouchdowns: 0,
        efficiency: 0
      },
      defensiveDominance: {
        active: false,
        consecutiveThreeAndOuts: 0,
        turnoversForced: 0,
        yardsAllowedPerDrive: 0
      },
      rareEvents: [],
      anomalies: []
    };
  }

  private cleanupMap(map: Map<string, Map<string, any>>): void {
    for (const [gameId, gameData] of map) {
      let hasValidData = false;
      
      for (const [id, data] of gameData) {
        if (this.isGameDataOld(data.lastUpdated)) {
          gameData.delete(id);
        } else {
          hasValidData = true;
        }
      }
      
      if (!hasValidData) {
        map.delete(gameId);
        console.log(`🗑️ Removed all data for game ${gameId}`);
      }
    }
  }

  private isGameDataOld(timestamp: number): boolean {
    return Date.now() - timestamp > this.MAX_GAME_AGE;
  }
}

// Export singleton instance
export const footballPerformanceTracker = new FootballPerformanceTracker();