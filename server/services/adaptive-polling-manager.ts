import { MLBApiService } from './mlb-api';
import { NFLApiService } from './nfl-api';
import { NCAAFApiService } from './ncaaf-api';
import { WNBAApiService } from './wnba-api';
import { NBAApiService } from './nba-api';
import { CFLApiService } from './cfl-api';
import { MLBEngine } from './engines/mlb-engine';
import { GameState, AlertResult } from './engines/base-engine';

export type Sport = 'MLB' | 'NFL' | 'NCAAF' | 'WNBA' | 'NBA' | 'CFL';

export interface GamePollingState {
  gameId: string;
  sport: Sport;
  currentState: 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended';
  lastPolled: number;
  pollInterval: number;
  stateChangeCount: number;
  lastStateChange: number;
  isUserMonitored: boolean;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  quarter?: number; // For NFL/NCAAF/CFL/WNBA/NBA games  
  timeRemaining?: string; // For time-based sports
  down?: number; // For football games (NFL/NCAAF/CFL)
  yardsToGo?: number; // For football games (NFL/NCAAF/CFL)
  fieldPosition?: number; // For football games (NFL/NCAAF/CFL)
  possession?: string; // For basketball games (WNBA/NBA)
  shotClock?: number; // For basketball games (WNBA/NBA)
}

export interface PollingConfig {
  scheduled: { interval: number; cacheTTL: number };
  live: { interval: number; cacheTTL: number };
  final: { interval: number; cacheTTL: number };
  delayed: { interval: number; cacheTTL: number };
  suspended: { interval: number; cacheTTL: number };
}

export interface SportApiServices {
  MLB?: MLBApiService;
  NFL?: NFLApiService;
  NCAAF?: NCAAFApiService;
  WNBA?: WNBAApiService;
  NBA?: NBAApiService;
  CFL?: CFLApiService;
}

export class AdaptivePollingManager {
  private gameStates: Map<string, GamePollingState> = new Map();
  private apiServices: SportApiServices;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastBatchPoll: number = 0;
  private isEnabled: boolean = true;
  private sport: Sport;
  private mlbEngine: MLBEngine;

  // Sport-specific intelligent polling intervals
  private readonly SPORT_POLLING_CONFIGS: Record<Sport, PollingConfig> = {
    MLB: {
      scheduled: { interval: 10000, cacheTTL: 30000 },    // 10s for pre-game
      live: { interval: 750, cacheTTL: 1500 },            // 750ms for live games (reduced from 250ms)
      final: { interval: 60000, cacheTTL: 300000 },       // 1min for completed games  
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    NFL: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-2)
      live: { interval: 1000, cacheTTL: 2000 },           // 1s for live games (V3-2)
      final: { interval: 300000, cacheTTL: 600000 },      // 300s for completed games (V3-2)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    NCAAF: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-7)
      live: { interval: 1000, cacheTTL: 2000 },           // 1s for live games (V3-7)
      final: { interval: 300000, cacheTTL: 600000 },      // 5min for completed games (V3-7)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    WNBA: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-10)
      live: { interval: 500, cacheTTL: 1000 },            // 500ms for live games (V3-10)
      final: { interval: 300000, cacheTTL: 600000 },      // 5min for completed games (V3-10)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    NBA: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-12)
      live: { interval: 500, cacheTTL: 1000 },            // 500ms for live games (V3-12)
      final: { interval: 300000, cacheTTL: 600000 },      // 5min for completed games (V3-12)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    },
    CFL: {
      scheduled: { interval: 30000, cacheTTL: 60000 },    // 30s for pre-game (V3-15)
      live: { interval: 750, cacheTTL: 1500 },            // 750ms for live games (V3-15)
      final: { interval: 300000, cacheTTL: 600000 },      // 5min for completed games (V3-15)
      delayed: { interval: 5000, cacheTTL: 15000 },       // 5s for delayed games
      suspended: { interval: 5000, cacheTTL: 15000 }      // 5s for suspended games
    }
  };

  // Criticality-based adjustments
  private readonly CRITICALITY_MULTIPLIERS = {
    low: 2.0,      // 2x slower for blowouts
    medium: 1.5,   // 1.5x slower for moderate games
    high: 1.0,     // Standard rate for competitive games
    critical: 0.5  // 2x faster for clutch situations
  };

  constructor(sport: Sport, apiServices: SportApiServices) {
    this.sport = sport;
    this.apiServices = apiServices;
    this.mlbEngine = new MLBEngine(); // Initialize MLB engine for alert generation
    console.log(`🎯 AdaptivePollingManager initialized for ${sport} with intelligent intervals`);

    // Initialize MLB engine modules asynchronously after construction
    if (sport === 'MLB') {
      this.initializeMLBEngineModules();
    }
  }

  // Initialize MLB engine with all available alert modules
  private async initializeMLBEngineModules(): Promise<void> {
    try {
      console.log(`🔧 Initializing MLB engine alert modules for adaptive polling...`);

      // Load all available MLB alert modules
      const allMLBAlerts = [
        'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH',
        'MLB_RUNNER_ON_THIRD_NO_OUTS',
        'MLB_FIRST_AND_THIRD_NO_OUTS',
        'MLB_SECOND_AND_THIRD_NO_OUTS',
        'MLB_FIRST_AND_SECOND',
        'MLB_BASES_LOADED_NO_OUTS',
        'MLB_RUNNER_ON_THIRD_ONE_OUT',
        'MLB_FIRST_AND_THIRD_ONE_OUT',
        'MLB_SECOND_AND_THIRD_ONE_OUT',
        'MLB_BASES_LOADED_ONE_OUT',
        'MLB_RUNNER_ON_THIRD_TWO_OUTS',
        'MLB_FIRST_AND_THIRD_TWO_OUTS',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE',
        'MLB_LATE_INNING_CLOSE',
        'MLB_SCORING_OPPORTUNITY',
        'MLB_PITCHING_CHANGE'
      ];

      // Initialize all modules for the polling engine
      await this.mlbEngine.initializeUserAlertModules(allMLBAlerts);

      console.log(`✅ MLB engine initialized with ${allMLBAlerts.length} alert modules for adaptive polling`);
    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine modules:`, error);
    }
  }

  /**
   * Initialize polling for a set of games with their current states
   */
  async initializeGamePolling(games: any[], userMonitoredGameIds: Set<string>): Promise<void> {
    console.log(`🔧 Initializing adaptive polling for ${games.length} games`);

    for (const game of games) {
      const gameId = game.id || game.gameId;
      const gameState = this.analyzeGameState(game);
      const isUserMonitored = userMonitoredGameIds.has(gameId);

      // Calculate initial criticality
      const criticality = this.calculateGameCriticality(game);

      const pollingState: GamePollingState = {
        gameId,
        sport: this.sport,
        currentState: gameState,
        lastPolled: 0,
        pollInterval: this.calculatePollInterval(gameState, criticality, isUserMonitored),
        stateChangeCount: 0,
        lastStateChange: Date.now(),
        isUserMonitored,
        criticality,
        quarter: (this.sport === 'NFL' || this.sport === 'NCAAF' || this.sport === 'CFL' || this.sport === 'WNBA' || this.sport === 'NBA') ? (game.quarter || 1) : undefined,
        timeRemaining: game.timeRemaining || undefined,
        down: (this.sport === 'NFL' || this.sport === 'NCAAF' || this.sport === 'CFL') ? game.down : undefined,
        yardsToGo: (this.sport === 'NFL' || this.sport === 'NCAAF' || this.sport === 'CFL') ? game.yardsToGo : undefined,
        fieldPosition: (this.sport === 'NFL' || this.sport === 'NCAAF' || this.sport === 'CFL') ? game.fieldPosition : undefined,
        possession: (this.sport === 'WNBA' || this.sport === 'NBA') ? game.possession : undefined,
        shotClock: (this.sport === 'WNBA' || this.sport === 'NBA') ? game.shotClock : undefined
      };

      this.gameStates.set(gameId, pollingState);

      // Only start individual polling for OFFICIALLY live games (not just critical scheduled games)
      if (gameState === 'live') {
        await this.startIndividualPolling(gameId);
      }
    }

    // Start batch polling for non-live games
    this.startBatchPolling();

    console.log(`✅ Adaptive polling initialized: ${this.gameStates.size} games tracked`);
    this.logPollingStatistics();
  }

  /**
   * Analyze game to determine current state
   */
  private analyzeGameState(game: any): 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended' {
    const status = game.status?.toLowerCase() || '';

    // Check for final state first
    if (status.includes('final') || status.includes('completed')) {
      return 'final';
    }

    if (status.includes('delayed') || status.includes('postponed')) {
      return 'delayed';
    }

    if (status.includes('suspended')) {
      return 'suspended';
    }

    // For MLB games, check actual game data to determine if live
    if (this.sport === 'MLB') {
      const inning = game.inning || 0;
      const homeScore = game.homeTeam?.score || game.homeScore || 0;
      const awayScore = game.awayTeam?.score || game.awayScore || 0;

      // Game is live if:
      // - Inning > 1 (game has progressed beyond first inning)
      // - OR inning === 1 AND there's a score (runs have been scored)
      // - OR status indicates live
      if (inning > 1 || (inning === 1 && (homeScore > 0 || awayScore > 0))) {
        return 'live';
      }

      // Also check if isLive flag is explicitly set
      if (game.isLive === true) {
        return 'live';
      }
    }

    // STRICT: Only mark as live if status explicitly indicates it's live AND not in pre-game state
    const isPreGameOrScheduled = status.includes('preview') || status.includes('pre-game') || 
                                status.includes('scheduled') || status.includes('warmup');

    // Must be explicitly marked as live by official status
    const isOfficiallyLive = status.includes('live') || status.includes('progress') || status.includes('inning');

    if (isOfficiallyLive && !isPreGameOrScheduled) {
      return 'live';
    }

    return 'scheduled';
  }

  /**
   * Calculate game criticality based on sport, score, and game situation
   */
  private calculateGameCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    if (this.sport === 'NFL') {
      return this.calculateNFLCriticality(game);
    } else if (this.sport === 'NCAAF') {
      return this.calculateNCAAFCriticality(game);
    } else if (this.sport === 'WNBA') {
      return this.calculateWNBACriticality(game);
    } else if (this.sport === 'NBA') {
      return this.calculateNBACriticality(game);
    } else if (this.sport === 'CFL') {
      return this.calculateCFLCriticality(game);
    } else {
      return this.calculateMLBCriticality(game);
    }
  }

  /**
   * Calculate MLB game criticality based on score, inning, and situation
   */
  private calculateMLBCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const inning = game.inning || 1;
    const totalScore = homeScore + awayScore;

    // Critical: Close games in late innings
    if (scoreDiff <= 2 && inning >= 7) {
      return 'critical';
    }

    // High: Close games or late innings
    if (scoreDiff <= 3 || inning >= 6) {
      return 'high';
    }

    // Medium: Moderate competition
    if (scoreDiff <= 6 && totalScore > 3) {
      return 'medium';
    }

    // Low: Blowouts or very early games
    return 'low';
  }

  /**
   * Calculate NFL game criticality based on score, quarter, and game situation
   */
  private calculateNFLCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || 1;
    const timeRemaining = game.timeRemaining || '';
    const fieldPosition = game.fieldPosition;
    const down = game.down;

    // Parse time remaining in seconds
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 7) {
      return 'critical';
    }

    // Critical: Two-minute warning situations (only when timeRemaining data is available)
    if (timeRemaining && quarter >= 4 && timeSeconds <= 120) {
      return 'critical';
    }

    // Critical: Red zone situations (within 20 yards)
    if (fieldPosition !== undefined && fieldPosition <= 20) {
      return 'critical';
    }

    // Critical: Fourth down situations
    if (down === 4) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 10) {
      return 'high';
    }

    // High: Close to scoring territory
    if (fieldPosition !== undefined && fieldPosition <= 40) {
      return 'high';
    }

    // Medium: Competitive games
    if (scoreDiff <= 14) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Calculate WNBA game criticality based on score, quarter, and game situation
   */
  private calculateWNBACriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || game.period || 1;
    const timeRemaining = game.timeRemaining || game.clock || '';
    const possession = game.possession;
    const shotClock = game.shotClock;

    // Parse time remaining in seconds  
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 5) {
      return 'critical';
    }

    // Critical: Final 2 minutes of any quarter with close score
    if (timeRemaining && quarter >= 4 && timeSeconds <= 120 && scoreDiff <= 8) {
      return 'critical';
    }

    // Critical: Overtime periods (any score differential)
    if (quarter >= 5) {
      return 'critical';
    }

    // Critical: Shot clock pressure situations in close games
    if (shotClock !== undefined && shotClock <= 8 && quarter >= 3 && scoreDiff <= 10) {
      return 'critical';
    }

    // Critical: Final minute of regulation
    if (timeRemaining && quarter === 4 && timeSeconds <= 60) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 8) {
      return 'high';
    }

    // High: Final 5 minutes of 4th quarter
    if (timeRemaining && quarter === 4 && timeSeconds <= 300) {
      return 'high';
    }

    // High: Shot clock pressure in competitive games
    if (shotClock !== undefined && shotClock <= 8 && quarter >= 2) {
      return 'high';
    }

    // High: Potential comeback situations
    if (quarter >= 3 && scoreDiff >= 8 && scoreDiff <= 15) {
      return 'high';
    }

    // Medium: Competitive games in later periods
    if (scoreDiff <= 12 && quarter >= 2) {
      return 'medium';
    }

    // Medium: Second half action
    if (quarter >= 3) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Calculate NBA game criticality based on score, quarter, and game situation
   */
  private calculateNBACriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || game.period || 1;
    const timeRemaining = game.timeRemaining || game.clock || '';
    const possession = game.possession;
    const shotClock = game.shotClock;

    // Parse time remaining in seconds  
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 5) {
      return 'critical';
    }

    // Critical: Final 2 minutes with close score (NBA two-minute report scenarios)
    if (timeRemaining && quarter >= 4 && timeSeconds <= 120 && scoreDiff <= 8) {
      return 'critical';
    }

    // Critical: Overtime periods (any score differential)
    if (quarter >= 5) {
      return 'critical';
    }

    // Critical: Shot clock pressure situations in close games (24-second NBA shot clock)
    if (shotClock !== undefined && shotClock <= 8 && quarter >= 3 && scoreDiff <= 10) {
      return 'critical';
    }

    // Critical: Final minute of regulation (NBA clutch time)
    if (timeRemaining && quarter === 4 && timeSeconds <= 60) {
      return 'critical';
    }

    // Critical: Professional playoff scenarios (if game data indicates playoffs)
    if (quarter >= 3 && scoreDiff <= 3 && timeSeconds <= 180) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 8) {
      return 'high';
    }

    // High: Final 5 minutes of 4th quarter (NBA clutch time range)
    if (timeRemaining && quarter === 4 && timeSeconds <= 300) {
      return 'high';
    }

    // High: Shot clock pressure in competitive games
    if (shotClock !== undefined && shotClock <= 8 && quarter >= 2) {
      return 'high';
    }

    // High: Potential comeback situations (NBA-level competition)
    if (quarter >= 3 && scoreDiff >= 8 && scoreDiff <= 15) {
      return 'high';
    }

    // High: Professional basketball high-scoring games (over 220 combined points)
    const totalScore = homeScore + awayScore;
    if (totalScore >= 220 && quarter >= 3) {
      return 'high';
    }

    // Medium: Competitive games in later periods
    if (scoreDiff <= 12 && quarter >= 2) {
      return 'medium';
    }

    // Medium: Second half action
    if (quarter >= 3) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Calculate NCAAF game criticality based on score, quarter, and game situation
   */
  private calculateNCAAFCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || 1;
    const timeRemaining = game.timeRemaining || '';
    const fieldPosition = game.fieldPosition;
    const down = game.down;
    const yardsToGo = game.yardsToGo;

    // Parse time remaining in seconds
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 7) {
      return 'critical';
    }

    // Critical: Two-minute warning situations (only when timeRemaining data is available)
    if (timeRemaining && quarter >= 4 && timeSeconds <= 120) {
      return 'critical';
    }

    // Critical: Overtime periods
    if (quarter >= 5) {
      return 'critical';
    }

    // Critical: Red zone situations (within 20 yards)
    if (fieldPosition !== undefined && fieldPosition <= 20) {
      return 'critical';
    }

    // Critical: Fourth down situations
    if (down === 4) {
      return 'critical';
    }

    // Critical: Goal line situations (within 5 yards)
    if (fieldPosition !== undefined && fieldPosition <= 5) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 10) {
      return 'high';
    }

    // High: Close to scoring territory
    if (fieldPosition !== undefined && fieldPosition <= 40) {
      return 'high';
    }

    // High: Third down situations
    if (down === 3) {
      return 'high';
    }

    // High: Short yardage situations
    if (yardsToGo && yardsToGo <= 3) {
      return 'high';
    }

    // High: Final 5 minutes of any quarter (only when timeRemaining is available)
    if (timeRemaining && timeSeconds <= 300) {
      return 'high';
    }

    // Medium: Competitive games
    if (scoreDiff <= 14) {
      return 'medium';
    }

    // Medium: Second half action
    if (quarter >= 3) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Calculate CFL game criticality based on score, quarter, and Canadian football specifics
   */
  private calculateCFLCriticality(game: any): 'low' | 'medium' | 'high' | 'critical' {
    const homeScore = game.homeTeam?.score || game.homeScore || 0;
    const awayScore = game.awayTeam?.score || game.awayScore || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const quarter = game.quarter || 1;
    const timeRemaining = game.timeRemaining || '';
    const fieldPosition = game.fieldPosition;
    const down = game.down;
    const yardsToGo = game.yardsToGo;

    // Parse time remaining in seconds (CFL has 15-minute quarters)
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Critical: Close games in 4th quarter or overtime
    if (quarter >= 4 && scoreDiff <= 8) {
      return 'critical';
    }

    // Critical: CFL Three-minute warning situations (critical window in CFL)
    if (timeRemaining && quarter >= 4 && timeSeconds <= 180) {
      return 'critical';
    }

    // Critical: Two-minute warning situations 
    if (timeRemaining && quarter >= 4 && timeSeconds <= 120) {
      return 'critical';
    }

    // Critical: Overtime periods (sudden death in CFL playoffs)
    if (quarter >= 5) {
      return 'critical';
    }

    // Critical: Third down situations (CFL 3-down system makes this crucial!)
    if (down === 3) {
      return 'critical';
    }

    // Critical: CFL Red zone (within 20 yards, considering wider CFL field)
    if (fieldPosition !== undefined && fieldPosition <= 20) {
      return 'critical';
    }

    // Critical: Rouge scoring opportunity (missed FG can still score 1 point)
    if (fieldPosition !== undefined && fieldPosition <= 45 && down === 3 && yardsToGo && yardsToGo >= 10) {
      return 'critical';
    }

    // Critical: Goal line situations (within 10 yards on CFL's wider field)
    if (fieldPosition !== undefined && fieldPosition <= 10) {
      return 'critical';
    }

    // High: Close games in 3rd/4th quarter
    if (quarter >= 3 && scoreDiff <= 10) {
      return 'high';
    }

    // High: Close to CFL scoring territory (within 45 yards due to rouge potential)
    if (fieldPosition !== undefined && fieldPosition <= 45) {
      return 'high';
    }

    // High: Second down situations (still manageable in 3-down system)
    if (down === 2) {
      return 'high';
    }

    // High: Short yardage situations (critical in 3-down system)
    if (yardsToGo && yardsToGo <= 3) {
      return 'high';
    }

    // High: Final 5 minutes of any half (CFL 15-minute quarters)
    if (timeRemaining && timeSeconds <= 300) {
      return 'high';
    }

    // High: Grey Cup implications (playoff pressure boost)
    if (quarter >= 3 && scoreDiff <= 7) {
      return 'high';
    }

    // Medium: Competitive games in CFL (higher scoring than NFL)
    if (scoreDiff <= 15) {
      return 'medium';
    }

    // Medium: Second half action (important in CFL pacing)
    if (quarter >= 3) {
      return 'medium';
    }

    // Medium: First down opportunities (important in 3-down system)
    if (down === 1 && yardsToGo && yardsToGo >= 10) {
      return 'medium';
    }

    // Low: Blowouts or early game
    return 'low';
  }

  /**
   * Parse time string to seconds for NFL/NCAAF games
   */
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  /**
   * Calculate optimal polling interval for a game using sport-specific config
   */
  private calculatePollInterval(
    gameState: 'scheduled' | 'live' | 'final' | 'delayed' | 'suspended',
    criticality: 'low' | 'medium' | 'high' | 'critical',
    isUserMonitored: boolean
  ): number {
    const sportConfig = this.SPORT_POLLING_CONFIGS[this.sport];
    let baseInterval = sportConfig[gameState].interval;

    // Apply criticality multiplier
    const multiplier = this.CRITICALITY_MULTIPLIERS[criticality];
    baseInterval = Math.round(baseInterval * multiplier);

    // User-monitored games get priority (25% faster, subject to minimum limits)
    if (isUserMonitored) {
      baseInterval = Math.round(baseInterval * 0.75);
    }

    // Enforce sport-specific minimum intervals for safety
    const minimums = this.sport === 'NFL' ? {
      live: 1000,    // 1s minimum for NFL live (V3-2)
      scheduled: 15000, // 15s minimum for NFL scheduled
      final: 60000,    // 1min minimum for NFL final
      delayed: 3000,
      suspended: 3000
    } : this.sport === 'NCAAF' ? {
      live: 500,     // 500ms minimum for NCAAF live (V3-7) - allows critical situations to reach 500ms
      scheduled: 15000, // 15s minimum for NCAAF scheduled
      final: 60000,    // 1min minimum for NCAAF final
      delayed: 3000,
      suspended: 3000
    } : this.sport === 'WNBA' ? {
      live: 250,     // 250ms minimum for WNBA live (V3-10) - basketball is fast-paced
      scheduled: 15000, // 15s minimum for WNBA scheduled
      final: 60000,    // 1min minimum for WNBA final
      delayed: 3000,
      suspended: 3000
    } : this.sport === 'NBA' ? {
      live: 250,     // 250ms minimum for NBA live (V3-12) - professional basketball
      scheduled: 15000, // 15s minimum for NBA scheduled
      final: 60000,    // 1min minimum for NBA final
      delayed: 3000,
      suspended: 3000
    } : {
      live: 200,     // 200ms minimum for MLB live
      scheduled: 5000,
      final: 30000,
      delayed: 3000,
      suspended: 3000
    };

    return Math.max(baseInterval, minimums[gameState]);
  }

  /**
   * Start individual high-frequency polling for critical games
   */
  private async startIndividualPolling(gameId: string): Promise<void> {
    const state = this.gameStates.get(gameId);
    if (!state) return;

    // Clear any existing timer
    const existingTimer = this.pollingTimers.get(gameId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const poll = async () => {
      try {
        await this.pollIndividualGame(gameId);

        // Schedule next poll if still needed
        const updatedState = this.gameStates.get(gameId);
        if (updatedState && (updatedState.currentState === 'live' || updatedState.criticality === 'critical')) {
          const timer = setTimeout(poll, updatedState.pollInterval);
          this.pollingTimers.set(gameId, timer);
        }
      } catch (error) {
        console.error(`❌ Individual polling error for game ${gameId}:`, error);
        // Retry with exponential backoff
        const retryDelay = Math.min(state.pollInterval * 2, 10000);
        const timer = setTimeout(poll, retryDelay);
        this.pollingTimers.set(gameId, timer);
      }
    };

    // Start polling immediately
    await poll();

    console.log(`🚀 Individual polling started for game ${gameId} (${state.pollInterval}ms)`);
  }

  /**
   * Poll a single game with enhanced data using sport-specific API
   */
  private async pollIndividualGame(gameId: string): Promise<void> {
    const state = this.gameStates.get(gameId);
    if (!state) return;

    const now = Date.now();
    if (now - state.lastPolled < state.pollInterval) {
      return; // Too soon
    }

    try {
      let enhancedData = null;

      // Use sport-specific API service
      if (this.sport === 'MLB' && this.apiServices.MLB) {
        enhancedData = await this.apiServices.MLB.getEnhancedGameData(gameId);
      } else if (this.sport === 'NFL' && this.apiServices.NFL) {
        enhancedData = await this.apiServices.NFL.getEnhancedGameData(gameId, 'live');
      } else if (this.sport === 'NCAAF' && this.apiServices.NCAAF) {
        enhancedData = await this.apiServices.NCAAF.getEnhancedGameData(gameId);
      } else if (this.sport === 'WNBA' && this.apiServices.WNBA) {
        enhancedData = await this.apiServices.WNBA.getEnhancedGameData(gameId);
      } else if (this.sport === 'NBA' && this.apiServices.NBA) {
        enhancedData = await this.apiServices.NBA.getEnhancedGameData(gameId);
      }

      if (enhancedData && !enhancedData.error) {
        // Update game state and detect transitions
        await this.updateGameState(gameId, enhancedData);
        state.lastPolled = now;

        console.log(`🔄 ${this.sport} Individual poll: Game ${gameId} (${state.currentState}/${state.criticality})`);
      }
    } catch (error) {
      console.error(`❌ ${this.sport} Individual game polling failed for ${gameId}:`, error);
    }
  }

  /**
   * Start batch polling for non-critical games
   */
  private startBatchPolling(): void {
    const BATCH_INTERVAL = 8000; // 8 second batch cycles

    const batchPoll = async () => {
      try {
        await this.batchPollGames();
      } catch (error) {
        console.error('❌ Batch polling error:', error);
      }

      // Schedule next batch
      setTimeout(batchPoll, BATCH_INTERVAL);
    };

    // Start batch polling
    batchPoll();
    console.log(`🔄 Batch polling started (${BATCH_INTERVAL}ms cycles)`);
  }

  /**
   * Poll multiple non-critical games in batches using sport-specific API
   */
  private async batchPollGames(): Promise<void> {
    const now = Date.now();

    // Find games ready for batch polling
    const gamesToPoll = Array.from(this.gameStates.entries())
      .filter(([gameId, state]) => {
        // Don't batch poll live/critical games (they have individual polling)
        if (state.currentState === 'live' || state.criticality === 'critical') {
          return false;
        }

        // Check if it's time to poll this game
        return (now - state.lastPolled) >= state.pollInterval;
      })
      .map(([gameId]) => gameId);

    if (gamesToPoll.length === 0) {
      return;
    }

    try {
      let allGames = [];

      // Use sport-specific API service for batch fetching
      if (this.sport === 'MLB' && this.apiServices.MLB) {
        allGames = await this.apiServices.MLB.getTodaysGames();
      } else if (this.sport === 'NFL' && this.apiServices.NFL) {
        allGames = await this.apiServices.NFL.getTodaysGames();
      } else if (this.sport === 'NCAAF' && this.apiServices.NCAAF) {
        allGames = await this.apiServices.NCAAF.getTodaysGames();
      } else if (this.sport === 'WNBA' && this.apiServices.WNBA) {
        allGames = await this.apiServices.WNBA.getTodaysGames();
      } else if (this.sport === 'NBA' && this.apiServices.NBA) {
        allGames = await this.apiServices.NBA.getTodaysGames();
      }

      const gameMap = new Map(allGames.map(game => [game.id, game]));

      console.log(`📦 ${this.sport} Batch polling ${gamesToPoll.length} games`);

      for (const gameId of gamesToPoll) {
        const gameData = gameMap.get(gameId);
        if (gameData) {
          // For user-monitored scheduled games in pre-game window, fetch enhanced data
          const gameState = this.gameStates.get(gameId);
          console.log(`🔍 Checking enhanced data conditions for ${this.sport} game ${gameId}: state=${gameState?.currentState}, userMonitored=${gameState?.isUserMonitored}, withinWindow=${this.isWithinPreGameWindow(gameData)}`);
          if (gameState && gameData && gameState.currentState !== 'live' && gameState.isUserMonitored && this.isWithinPreGameWindow(gameData)) {
            try {
              console.log(`🔄 Fetching enhanced data for scheduled ${this.sport} game ${gameId} (user-monitored, pre-game window)`);

              let enhancedData = null;
              if (this.sport === 'MLB' && this.apiServices.MLB) {
                enhancedData = await this.apiServices.MLB.getEnhancedGameData(gameId);
              } else if (this.sport === 'NFL' && this.apiServices.NFL) {
                enhancedData = await this.apiServices.NFL.getEnhancedGameData(gameId, 'scheduled');
              } else if (this.sport === 'NCAAF' && this.apiServices.NCAAF) {
                enhancedData = await this.apiServices.NCAAF.getEnhancedGameData(gameId);
              } else if (this.sport === 'WNBA' && this.apiServices.WNBA) {
                enhancedData = await this.apiServices.WNBA.getEnhancedGameData(gameId);
              } else if (this.sport === 'NBA' && this.apiServices.NBA) {
                enhancedData = await this.apiServices.NBA.getEnhancedGameData(gameId);
              }

              if (enhancedData && !enhancedData.error) {
                // Merge enhanced data with game data
                Object.assign(gameData, enhancedData);
                console.log(`✅ Merged enhanced data for ${this.sport} game ${gameId}`);
              }
            } catch (error) {
              console.error(`⚠️ Failed to get enhanced data for ${this.sport} game ${gameId}:`, error);
            }
          }

          await this.updateGameState(gameId, gameData);
          const state = this.gameStates.get(gameId);
          if (state) {
            state.lastPolled = now;
          }
        }
      }

      // Enhanced data summary logging
      const enhancedDataSummary = {
        total: allGames.length,
        live: allGames.filter(g => this.analyzeGameState(g) === 'live').length,
        userMonitored: allGames.filter(g => this.gameStates.get(g.id || g.gameId)?.isUserMonitored).length,
        withinWindow: allGames.filter(g => this.isWithinPreGameWindow(g)).length,
        fetchedEnhanced: 0,
        mergedEnhanced: 0
      };

      console.log(`📊 ${this.sport} Enhanced Data Summary: ${enhancedDataSummary.fetchedEnhanced}/${enhancedDataSummary.total} fetched, ${enhancedDataSummary.mergedEnhanced} merged (${enhancedDataSummary.userMonitored} monitored, ${enhancedDataSummary.withinWindow} within window, ${enhancedDataSummary.live} live)`);

      this.lastBatchPoll = now;
    } catch (error) {
      console.error(`❌ ${this.sport} Batch polling failed:`, error);
    }
  }

  /**
   * Check if a scheduled game is within pre-game window for enhanced data fetching
   */
  private isWithinPreGameWindow(gameData: any): boolean {
    if (!gameData || !gameData.startTime) return false;

    try {
      const startTime = new Date(gameData.startTime).getTime();
      const now = Date.now();
      const timeToStart = startTime - now;

      // Within 6 hours before game start (expanded for testing)
      return timeToStart > 0 && timeToStart <= (6 * 60 * 60 * 1000);
    } catch (error) {
      console.error(`⚠️ Error checking pre-game window for game:`, error);
      return false;
    }
  }

  /**
   * Update game state and detect transitions
   */
  private async updateGameState(gameId: string, gameData: any): Promise<void> {
    const currentState = this.gameStates.get(gameId);
    if (!currentState) return;

    const newState = this.analyzeGameState(gameData);
    const newCriticality = this.calculateGameCriticality(gameData);

    // DO NOT promote scheduled/pre-game games to live status based on enhanced data
    // This was causing runaway live-state loops preventing server startup
    // Games should only be live if explicitly marked as such by official game status

    // Persist enhanced game data to database for alert system (all sports)
    try {
      if (gameData) {
        await this.persistEnhancedGameData(gameId, gameData);
      }
    } catch (error) {
      console.error(`❌ Failed to persist enhanced game data for ${gameId}:`, error);
    }

    // Detect state transitions
    if (newState !== currentState.currentState) {
      console.log(`🔄 Game ${gameId}: ${currentState.currentState} → ${newState}`);

      currentState.currentState = newState;
      currentState.stateChangeCount++;
      currentState.lastStateChange = Date.now();

      // Recalculate polling interval
      const newInterval = this.calculatePollInterval(newState, newCriticality, currentState.isUserMonitored);
      currentState.pollInterval = newInterval;

      // Handle transition logic
      await this.handleStateTransition(gameId, currentState.currentState, newState);
    }

    // Update criticality
    if (newCriticality !== currentState.criticality) {
      console.log(`🎯 Game ${gameId} criticality: ${currentState.criticality} → ${newCriticality}`);
      currentState.criticality = newCriticality;

      // Recalculate interval with new criticality
      const newInterval = this.calculatePollInterval(newState, newCriticality, currentState.isUserMonitored);
      currentState.pollInterval = newInterval;
    }
  }

  /**
   * Select primary player based on sport with intelligent fallbacks
   */
  private selectPrimaryPlayerBySport(gameData: any): string {
    let primaryPlayer: string | null = null;

    // Sport-aware player selection
    if (this.sport === 'MLB') {
      primaryPlayer = gameData.currentBatter || gameData.currentPitcher || gameData.onDeckBatter;
    } else if (this.sport === 'NFL' || this.sport === 'NCAAF') {
      // For football: prioritize active player, then QB, then possession-based QB
      primaryPlayer = gameData.currentPlayer || gameData.currentQuarterback || 
                     gameData.possessionPlayer || gameData.topPlayer;

      // Enhanced fallbacks for NFL/NCAAF pre-game
      if (!primaryPlayer) {
        if (gameData.possessionSide === 'home' && gameData.preGameHomeQB) {
          primaryPlayer = gameData.preGameHomeQB;
        } else if (gameData.possessionSide === 'away' && gameData.preGameAwayQB) {
          primaryPlayer = gameData.preGameAwayQB;
        } else if (gameData.preGameHomeQB) {
          primaryPlayer = gameData.preGameHomeQB;
        } else if (gameData.preGameAwayQB) {
          primaryPlayer = gameData.preGameAwayQB;
        }
      }
    } else if (this.sport === 'NBA' || this.sport === 'WNBA') {
      // For basketball: prioritize active player, then possession-based player
      primaryPlayer = gameData.currentPlayer || gameData.possessionPlayer || gameData.topPlayer;
    } else if (this.sport === 'CFL') {
      // For CFL: similar to NFL logic
      primaryPlayer = gameData.currentPlayer || gameData.currentQuarterback || 
                     gameData.possessionPlayer || gameData.topPlayer;
    }

    console.log(`🎯 ${this.sport} Player selection for game ${gameData.id}: ${primaryPlayer || 'N/A'} (available fields: ${Object.keys(gameData).filter(k => k.includes('player') || k.includes('batter') || k.includes('quarterback') || k.includes('QB')).join(', ')})`);

    return primaryPlayer || 'N/A';
  }

  /**
   * Persist enhanced game data to database for alert system
   */
  private async persistEnhancedGameData(gameId: string, gameData: any): Promise<void> {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { storage } = await import('../storage');

      // Extract enhanced data with weather context integration
      const weatherContext = gameData.weatherContext || {};

      // Get team names from gameData or game state
      const homeTeam = gameData.homeTeam?.name || gameData.homeTeam || 'Unknown Home';
      const awayTeam = gameData.awayTeam?.name || gameData.awayTeam || 'Unknown Away';

      const gameStateData = {
        extGameId: gameId,
        sport: this.sport,
        homeTeam,
        awayTeam,
        homeScore: gameData.homeScore || 0,
        awayScore: gameData.awayScore || 0,
        status: gameData.status || 'live',
        inning: gameData.inning,
        isTopInning: gameData.isTopInning,
        balls: gameData.balls || 0,
        strikes: gameData.strikes || 0,
        outs: gameData.outs || 0,
        hasFirst: gameData.runners?.first || false,
        hasSecond: gameData.runners?.second || false,
        hasThird: gameData.runners?.third || false,
        currentBatter: gameData.currentBatter,
        currentPitcher: gameData.currentPitcher,
        onDeckBatter: gameData.onDeckBatter,
        windSpeed: weatherContext.windSpeed,
        windDirection: weatherContext.windDirection,
        temperature: weatherContext.temperature,
        humidity: weatherContext.humidity,
        enhancedData: {
          lineupData: gameData.lineupData || null,
          weatherContext: weatherContext || null,
          gameState: JSON.stringify(gameData.gameState || {}),
          lastUpdated: gameData.lastUpdated || new Date().toISOString()
        }
      };

      await storage.saveGameState(gameStateData);
      // Get primary player based on sport with enhanced fallbacks - sport-aware selection
      let primaryPlayer = this.selectPrimaryPlayerBySport(gameData);

      // For NFL/NCAAF, use pre-game QB fallbacks if no current player found
      if (!primaryPlayer && (this.sport === 'NFL' || this.sport === 'NCAAF')) {
        // Try pre-game QBs as fallback (prioritize possessing team)
        if (gameData.possessionSide === 'home' && gameData.preGameHomeQB) {
          primaryPlayer = gameData.preGameHomeQB;
        } else if (gameData.possessionSide === 'away' && gameData.preGameAwayQB) {
          primaryPlayer = gameData.preGameAwayQB;
        } else if (gameData.preGameHomeQB) {
          // Default to home team QB if no possession info
          primaryPlayer = gameData.preGameHomeQB;
        } else if (gameData.preGameAwayQB) {
          primaryPlayer = gameData.preGameAwayQB;
        }
      }

      // Final fallback
      primaryPlayer = primaryPlayer || 'N/A';
      console.log(`💾 Persisted enhanced game data for ${gameId} with player: ${primaryPlayer}`);

      // CRITICAL FIX: Add missing alert generation call for MLB games 
      if (this.sport === 'MLB' && gameStateData) {
        try {
          console.log(`🚨 Processing alerts for MLB game ${gameId}`);

          // Construct proper GameState object from persisted data
          const gameState: GameState = {
            gameId: gameId,
            sport: this.sport,
            isLive: gameStateData.status === 'live' || gameStateData.status === 'progress', 
            homeTeam: gameStateData.homeTeam,
            awayTeam: gameStateData.awayTeam,
            homeScore: gameStateData.homeScore || 0,
            awayScore: gameStateData.awayScore || 0,
            inning: gameStateData.inning || 1,
            isTopInning: gameStateData.isTopInning || false,
            outs: gameStateData.outs || 0,
            balls: gameStateData.balls || 0,
            strikes: gameStateData.strikes || 0,
            hasFirst: gameStateData.hasFirst || false,
            hasSecond: gameStateData.hasSecond || false,
            hasThird: gameStateData.hasThird || false,
            currentBatter: gameStateData.currentBatter,
            currentPitcher: gameStateData.currentPitcher,
            windSpeed: gameStateData.windSpeed,
            windDirection: gameStateData.windDirection,
            status: gameStateData.status
          };

          // Generate alerts for this game
          const { MLBEngine } = await import('./engines/mlb-engine');
          const mlbEngine = new MLBEngine();
          await mlbEngine.initializeUserAlertModules([
            'MLB_LATE_INNING_CLOSE', 'MLB_SCORING_OPPORTUNITY', 'MLB_PITCHING_CHANGE',
            'MLB_BASES_LOADED_NO_OUTS', 'MLB_RUNNER_ON_THIRD_NO_OUTS'
          ]);

          const alerts = await mlbEngine.generateLiveAlerts(gameState);
          console.log(`📊 Generated ${alerts.length} alerts for game ${gameId}`);

        } catch (alertError) {
          console.error(`❌ Alert generation failed for game ${gameId}:`, alertError);
        }
      }
    } catch (error) {
      console.error(`❌ Error persisting enhanced game data for ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Handle game state transitions
   */
  private async handleStateTransition(gameId: string, oldState: string, newState: string): Promise<void> {
    // Game going live - start individual polling ONLY if truly live by official status
    // Do NOT start individual polling for scheduled games marked as "live" due to enhanced data
    if (newState === 'live' && oldState !== 'live') {
      console.log(`🚀 Game ${gameId} went live - starting individual polling`);
      await this.startIndividualPolling(gameId);
    }

    // Game finished - stop individual polling
    if (newState === 'final' && oldState === 'live') {
      console.log(`🏁 Game ${gameId} finished - stopping individual polling`);
      const timer = this.pollingTimers.get(gameId);
      if (timer) {
        clearTimeout(timer);
        this.pollingTimers.delete(gameId);
      }
    }
  }

  /**
   * Get current polling statistics
   */
  getPollingStatistics(): { [key: string]: number } {
    const stats = {
      totalGames: this.gameStates.size,
      liveGames: 0,
      scheduledGames: 0,
      finalGames: 0,
      delayedGames: 0,
      suspendedGames: 0,
      criticalGames: 0,
      highPriorityGames: 0,
      individualPollingActive: this.pollingTimers.size
    };

    for (const state of this.gameStates.values()) {
      // Type-safe game state counting
      switch (state.currentState) {
        case 'live':
          stats.liveGames++;
          break;
        case 'scheduled':
          stats.scheduledGames++;
          break;
        case 'final':
          stats.finalGames++;
          break;
        case 'delayed':
          stats.delayedGames++;
          break;
        case 'suspended':
          stats.suspendedGames++;
          break;
      }

      if (state.criticality === 'critical') stats.criticalGames++;
      if (state.criticality === 'high' || state.criticality === 'critical') stats.highPriorityGames++;
    }

    return stats;
  }

  /**
   * Log polling statistics for monitoring
   */
  private logPollingStatistics(): void {
    const stats = this.getPollingStatistics();
    console.log(`📊 Polling Stats: ${stats.liveGames} live, ${stats.scheduledGames} scheduled, ${stats.finalGames} final, ${stats.criticalGames} critical`);
    console.log(`⚡ Individual polling: ${stats.individualPollingActive} games, Batch polling: ${stats.totalGames - stats.individualPollingActive} games`);
  }

  /**
   * Update user monitoring preferences
   */
  updateUserMonitoring(gameId: string, isMonitored: boolean): void {
    const state = this.gameStates.get(gameId);
    if (state && state.isUserMonitored !== isMonitored) {
      state.isUserMonitored = isMonitored;

      // Recalculate polling interval
      const newInterval = this.calculatePollInterval(state.currentState, state.criticality, isMonitored);
      state.pollInterval = newInterval;

      console.log(`👤 Game ${gameId} monitoring updated: ${isMonitored} (${newInterval}ms interval)`);
    }
  }

  /**
   * Get games ready for alert processing
   */
  getGamesReadyForProcessing(): string[] {
    const now = Date.now();
    return Array.from(this.gameStates.entries())
      .filter(([gameId, state]) => {
        // Always process live games
        if (state.currentState === 'live') return true;

        // Process critical games regardless of state
        if (state.criticality === 'critical') return true;

        // Process user-monitored games more frequently
        if (state.isUserMonitored && (now - state.lastPolled) >= state.pollInterval) return true;

        return false;
      })
      .map(([gameId]) => gameId);
  }

  /**
   * Clean up resources
   */
  shutdown(): void {
    console.log('🛑 Shutting down AdaptivePollingManager');

    // Clear all timers
    for (const timer of this.pollingTimers.values()) {
      clearTimeout(timer);
    }
    this.pollingTimers.clear();

    // Clear game states
    this.gameStates.clear();

    console.log('✅ AdaptivePollingManager shutdown complete');
  }
}