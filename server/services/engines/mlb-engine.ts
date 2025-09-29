import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';
import { mlbPerformanceTracker } from './mlb-performance-tracker';

export class MLBEngine extends BaseSportEngine {
  private lineMovementCache: Map<string, any> = new Map(); // Track line movements


  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    probabilityCalculationTime: [] as number[],
    gameStateEnhancementTime: [] as number[],
    basesLoadedSituations: 0,
    seventhInningDetections: 0,
    runnerScoringOpportunities: 0,
  };

  constructor() {
    super('MLB');
  }

  /**
   * Update performance tracking based on game state changes
   */
  private updatePerformanceTracking(gameState: GameState): void {
    try {
      const gameId = gameState.gameId;
      const inning = gameState.inning || 1;
      const outs = gameState.outs || 0;
      
      // Track batter performance if we have current batter info
      if (gameState.currentBatter && gameState.lastPlay?.description) {
        const outcome = this.parsePlayOutcome(gameState.lastPlay.description);
        if (outcome) {
          // Check for RISP (runners on 2nd or 3rd, NOT 1st)
          const runnersInScoringPosition = gameState.hasSecond || gameState.hasThird;
          
          mlbPerformanceTracker.updateBatterPerformance(
            gameId,
            gameState.currentBatterId || `batter_${gameState.currentBatter.replace(/\s+/g, '_')}`,
            gameState.currentBatter,
            gameState.isTopInning ? gameState.awayTeam : gameState.homeTeam,
            {
              type: outcome.type,
              inning: inning,
              pitcher: gameState.currentPitcher || 'Unknown',
              pitchCount: gameState.pitchCount || 0,
              rbis: outcome.rbis,
              runnersOn: gameState.hasFirst || gameState.hasSecond || gameState.hasThird,
              runnersInScoringPosition: runnersInScoringPosition,
              outs: outs
            }
          );
        }
      }
      
      // Track pitcher performance with proper stats
      if (gameState.currentPitcher && gameState.lastPitch?.call) {
        const pitchOutcome = this.parsePitchOutcome(gameState.lastPitch.call);
        if (pitchOutcome) {
          mlbPerformanceTracker.updatePitcherPerformance(
            gameId,
            gameState.currentPitcherId || `pitcher_${gameState.currentPitcher.replace(/\s+/g, '_')}`,
            gameState.currentPitcher,
            gameState.isTopInning ? gameState.homeTeam : gameState.awayTeam,
            {
              type: pitchOutcome.type,
              velocity: pitchOutcome.velocity,
              batter: gameState.currentBatter || 'Unknown',
              inning: inning,
              balls: gameState.balls || 0,
              strikes: gameState.strikes || 0,
              isFullCount: (gameState.balls === 3 && gameState.strikes === 2),
              isThreeBalls: (gameState.balls === 3)
            }
          );
        }
      }
      
      // Track team momentum for various events
      const scoringTeam = gameState.isTopInning ? gameState.awayTeam : gameState.homeTeam;
      const teamId = gameState.isTopInning ? 'away' : 'home';
      
      // Parse last play for various team events
      if (gameState.lastPlay?.description) {
        const play = gameState.lastPlay.description.toLowerCase();
        
        // Check for different event types
        if (play.includes('scores') || play.includes('run')) {
          const runs = this.extractRBIs(play) || 1;
          mlbPerformanceTracker.updateTeamMomentum(
            gameId,
            teamId,
            scoringTeam,
            inning,
            {
              type: 'run',
              runs: runs,
              outs: outs
            }
          );
        } else if (play.includes('single') || play.includes('double') || play.includes('triple') || play.includes('hit')) {
          mlbPerformanceTracker.updateTeamMomentum(
            gameId,
            teamId,
            scoringTeam,
            inning,
            {
              type: 'hit',
              outs: outs
            }
          );
        } else if (play.includes('strikes out') || play.includes('struck out')) {
          mlbPerformanceTracker.updateTeamMomentum(
            gameId,
            teamId,
            scoringTeam,
            inning,
            {
              type: 'strikeout',
              outs: outs
            }
          );
        } else if (play.includes('error')) {
          mlbPerformanceTracker.updateTeamMomentum(
            gameId,
            teamId,
            scoringTeam,
            inning,
            {
              type: 'error',
              outs: outs
            }
          );
        } else if (play.includes('double play')) {
          mlbPerformanceTracker.updateTeamMomentum(
            gameId,
            teamId,
            scoringTeam,
            inning,
            {
              type: 'double_play',
              outs: outs
            }
          );
        }
      }
      
      // Check for inning end (3 outs)
      if (outs === 3 || gameState.inningJustEnded) {
        mlbPerformanceTracker.updateTeamMomentum(
          gameId,
          teamId,
          scoringTeam,
          inning,
          {
            type: 'inning_end',
            outs: 3
          }
        );
      }
      
      // Clean up old games periodically
      mlbPerformanceTracker.cleanupOldGames();
      
    } catch (error) {
      console.error('❌ MLB Performance tracking error:', error);
      // Don't let tracking errors stop alert generation
    }
  }
  
  /**
   * Parse play outcome from play description
   */
  private parsePlayOutcome(playDescription: string): { type: 'hit' | 'walk' | 'strikeout' | 'out' | 'homerun' | 'double' | 'triple'; rbis?: number } | null {
    if (!playDescription) return null;
    
    const play = playDescription.toLowerCase();
    
    if (play.includes('home run') || play.includes('homer')) {
      const rbis = this.extractRBIs(play);
      return { type: 'homerun', rbis };
    }
    if (play.includes('triple')) return { type: 'triple', rbis: this.extractRBIs(play) };
    if (play.includes('double')) return { type: 'double', rbis: this.extractRBIs(play) };
    if (play.includes('single') || play.includes('hit')) return { type: 'hit', rbis: this.extractRBIs(play) };
    if (play.includes('walk') || play.includes('bb')) return { type: 'walk' };
    if (play.includes('strikes out') || play.includes('struck out')) return { type: 'strikeout' };
    if (play.includes('grounds out') || play.includes('flies out') || play.includes('lines out')) return { type: 'out' };
    
    return null;
  }
  
  /**
   * Parse pitch outcome from pitch description
   */
  private parsePitchOutcome(pitchDescription: string): { type: 'strike' | 'ball' | 'foul' | 'hit' | 'homerun'; velocity?: number } | null {
    if (!pitchDescription) return null;
    
    const pitch = pitchDescription.toLowerCase();
    
    // Extract velocity if present
    const velocityMatch = pitch.match(/(\d+)\s*mph/);
    const velocity = velocityMatch ? parseInt(velocityMatch[1]) : undefined;
    
    if (pitch.includes('strike')) return { type: 'strike', velocity };
    if (pitch.includes('ball')) return { type: 'ball', velocity };
    if (pitch.includes('foul')) return { type: 'foul', velocity };
    if (pitch.includes('home run') || pitch.includes('homer')) return { type: 'homerun', velocity };
    if (pitch.includes('hit') || pitch.includes('single') || pitch.includes('double') || pitch.includes('triple')) {
      return { type: 'hit', velocity };
    }
    
    return null;
  }
  
  /**
   * Extract RBI count from play description
   */
  private extractRBIs(playDescription: string): number {
    const rbiMatch = playDescription.match(/(\d+)\s*rbi/i);
    if (rbiMatch) return parseInt(rbiMatch[1]);
    
    // Check for specific RBI indicators
    if (playDescription.includes('grand slam')) return 4;
    if (playDescription.includes('scores') || playDescription.includes('driven in')) {
      // Count number of players mentioned as scoring
      const scoreMatches = playDescription.match(/scores/gi);
      return scoreMatches ? scoreMatches.length : 1;
    }
    
    return 0;
  }
  



  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual MLB alert types that have corresponding modules
      const validMLBAlerts = [
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
        'MLB_RUNNER_ON_SECOND_NO_OUTS',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE',
        'MLB_LATE_INNING_CLOSE',
        'MLB_SCORING_OPPORTUNITY',
        'MLB_PITCHING_CHANGE',
        'MLB_BASES_LOADED_TWO_OUTS',
        'MLB_HIGH_SCORING_SITUATION',
        'MLB_STRIKEOUT'
      ];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      const { inning, outs, homeScore, awayScore } = gameState;

      let probability = 40; // Base probability

    // Simple inning adjustments
    if (inning >= 7) probability += 20; // Late innings are more exciting
    else if (inning >= 4) probability += 10; // Middle innings
    else probability += 5; // Early innings

    // Outs situation - simple rules
    if (outs === 0) probability += 20; // No outs - high potential
    else if (outs === 1) probability += 10; // One out - still good
    else probability += 5; // Two outs - pressure but still possible

    // Score differential
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 1) probability += 25; // Very close game
    else if (scoreDiff <= 3) probability += 15; // Close game
    else if (scoreDiff <= 6) probability += 5; // Moderately competitive
    else probability -= 10; // Blowout

    // Simple base runner boost
    let runnerBonus = 0;
    if (gameState.hasThird) runnerBonus += 15; // Runner on third
    if (gameState.hasSecond) runnerBonus += 10; // Runner on second
    if (gameState.hasFirst) runnerBonus += 5; // Runner on first

    probability += runnerBonus;

    // Keep probability within reasonable bounds
    return Math.min(Math.max(probability, 15), 90);
    } finally {
      // Track performance metrics
      const calculationTime = Date.now() - startTime;
      this.performanceMetrics.probabilityCalculationTime.push(calculationTime);
      this.performanceMetrics.totalRequests++;

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.probabilityCalculationTime.length > 100) {
        this.performanceMetrics.probabilityCalculationTime = this.performanceMetrics.probabilityCalculationTime.slice(-100);
      }
    }
  }

  // Override to add MLB-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();

    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ MLB: No gameId provided, skipping alert generation');
        console.log('⚠️ MLB: GameState received:', JSON.stringify({
          id: gameState.id,
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          isLive: gameState.isLive,
          status: gameState.status
        }, null, 2));
        return [];
      }

      console.log(`🎯 MLB: Processing game ${gameState.gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      console.log(`🎯 MLB: Status=${gameState.status}, isLive=${gameState.isLive}, inning=${gameState.inning}`)

      // Enhance game state with MLB-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Update performance tracking before generating alerts
      this.updatePerformanceTracking(enhancedGameState);
      
      // Get performance context for enriching alerts
      const performanceSummary = mlbPerformanceTracker.getGamePerformanceSummary(enhancedGameState.gameId);
      const unusualPatterns = performanceSummary ? performanceSummary.unusualPatterns : [];
      
      if (unusualPatterns.length > 0) {
        console.log(`🎯 MLB Unusual patterns detected for game ${enhancedGameState.gameId}:`, unusualPatterns);
      }

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);

      // Enrich alerts with performance context
      if (rawAlerts.length > 0 && performanceSummary) {
        for (const alert of rawAlerts) {
          // Add batter performance if relevant
          if (enhancedGameState.currentBatter && performanceSummary.batters.size > 0) {
            const batterSummary = mlbPerformanceTracker.getBatterSummary(
              enhancedGameState.gameId,
              enhancedGameState.currentBatterId || 'unknown'
            );
            if (batterSummary) {
              alert.context.batterPerformance = batterSummary;
            }
          }
          
          // Add pitcher performance if relevant
          if (enhancedGameState.currentPitcher && performanceSummary.pitchers.size > 0) {
            const pitcherSummary = mlbPerformanceTracker.getPitcherSummary(
              enhancedGameState.gameId,
              enhancedGameState.currentPitcherId || 'unknown'
            );
            if (pitcherSummary) {
              alert.context.pitcherPerformance = pitcherSummary;
            }
          }
          
          // Add team momentum if significant
          const teamId = enhancedGameState.isTopInning ? 'away' : 'home';
          const momentumSummary = mlbPerformanceTracker.getTeamMomentumSummary(
            enhancedGameState.gameId,
            teamId
          );
          if (momentumSummary) {
            alert.context.teamMomentum = momentumSummary;
          }
          
          // Add unusual patterns if any
          if (unusualPatterns.length > 0) {
            alert.context.unusualPatterns = unusualPatterns;
            console.log(`🎯 MLB: Alert enriched with patterns: ${unusualPatterns.join(', ')}`);
          }
        }
      }

      // Return raw alerts - GameStateManager will handle enhancement pipeline
      if (rawAlerts.length > 0) {
        console.log(`🔄 MLB: Generated ${rawAlerts.length} raw alerts - GameStateManager will handle enhancement`);
      } else {
        console.log(`🔄 MLB: No alerts generated for game ${enhancedGameState.gameId}`);
      }

      // Track MLB-specific metrics
      if (enhancedGameState.hasFirst && enhancedGameState.hasSecond && enhancedGameState.hasThird) {
        this.performanceMetrics.basesLoadedSituations++;
      }
      if (enhancedGameState.inning === 7) {
        this.performanceMetrics.seventhInningDetections++;
      }
      if (enhancedGameState.hasThird && enhancedGameState.outs <= 1) {
        this.performanceMetrics.runnerScoringOpportunities++;
      }

      this.performanceMetrics.totalAlerts += rawAlerts.length;

      // Return raw alerts for GameStateManager enhancement pipeline
      return rawAlerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const startTime = Date.now();

    try {
      console.log(`🔧 MLB Enhancement: Game ${gameState.gameId} - status=${gameState.status}, isLive=${gameState.isLive}`);

      // Get live data from MLB API for any non-final game (fixes catch-22 gating loop)
      if (gameState.gameId && gameState.status !== 'final') {
        console.log(`✅ MLB Enhancement: Fetching enhanced data for non-final game ${gameState.gameId}`);
        const { MLBApiService } = await import('../mlb-api');
        const mlbApi = new MLBApiService();
        const enhancedData = await mlbApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          this.performanceMetrics.cacheHits++;
          // Fetch weather data if available
          let weatherContext = gameState.weatherContext;
          try {
            const { WeatherService } = await import('../weather-service');
            const weatherService = new WeatherService();
            // Get weather for home team (where game is played)
            const weatherData = await weatherService.getWeatherForTeam(
              gameState.homeTeam
            );
            if (weatherData) {
              weatherContext = {
                windSpeed: weatherData.windSpeed,
                windDirection: weatherData.windDirection,
                temperature: weatherData.temperature,
                humidity: weatherData.humidity
              };
            }
          } catch (error) {
            // Weather fetch failed, continue without it
          }

          const enhancedGameState = {
            ...gameState,
            hasFirst: enhancedData.runners?.first || false,
            hasSecond: enhancedData.runners?.second || false,
            hasThird: enhancedData.runners?.third || false,
            balls: enhancedData.balls || 0,
            strikes: enhancedData.strikes || 0,
            outs: enhancedData.outs || 0,
            inning: enhancedData.inning || gameState.inning || 1,
            isTopInning: enhancedData.isTopInning,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            currentBatter: enhancedData.currentBatter || gameState.currentBatter,
            currentBatterId: enhancedData.currentBatterId || gameState.currentBatterId,
            currentPitcher: enhancedData.currentPitcher || gameState.currentPitcher,
            currentPitcherId: enhancedData.currentPitcherId || gameState.currentPitcherId,
            onDeckBatter: enhancedData.onDeckBatter || gameState.onDeckBatter,
            lastPlay: enhancedData.lastPlay || gameState.lastPlay,
            lastPitch: enhancedData.lastPitch || gameState.lastPitch,
            pitchCount: enhancedData.pitchCount || gameState.pitchCount || 0,
            weatherContext,
            // Respect original game status - only force false for finished games, preserve original live state
            isLive: gameState.status === 'final' ? false : gameState.isLive
          };
          console.log(`🚀 MLB Enhancement: Game ${gameState.gameId} enhanced - isLive=${enhancedGameState.isLive}, runners=[${enhancedGameState.hasFirst ? '1B' : ''}${enhancedGameState.hasSecond ? '2B' : ''}${enhancedGameState.hasThird ? '3B' : ''}], outs=${enhancedGameState.outs}, inning=${enhancedGameState.inning}`);
          return enhancedGameState;
        } else {
          this.performanceMetrics.cacheMisses++;
        }
      }
    } catch (error) {
      console.error('Error enhancing game state with live data:', error);
      this.performanceMetrics.cacheMisses++;
    } finally {
      const enhanceTime = Date.now() - startTime;
      this.performanceMetrics.gameStateEnhancementTime.push(enhanceTime);

      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.gameStateEnhancementTime.length > 100) {
        this.performanceMetrics.gameStateEnhancementTime = this.performanceMetrics.gameStateEnhancementTime.slice(-100);
      }
    }

    return gameState;
  }

  // Process alerts with cross-sport AI enhancement for high-priority MLB situations
  private async processEnhancedMLBAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Process all alerts for AI enhancement to ensure maximum coverage
        const probability = await this.calculateProbability(gameState);

        console.log(`🧠 MLB AI Enhancement: Processing ${alert.type} alert (${probability}%)`);

        // Build cross-sport context for MLB
        const aiContext: CrossSportContext = {
            sport: 'MLB',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            inning: gameState.inning,
            outs: gameState.outs,
            balls: gameState.balls,
            strikes: gameState.strikes,
            baseRunners: {
              first: gameState.hasFirst || false,
              second: gameState.hasSecond || false,
              third: gameState.hasThird || false
            },
            originalMessage: alert.message,
            originalContext: alert.context
          };

        // NON-BLOCKING: Queue for async AI enhancement and return base alert immediately
        unifiedAIProcessor.queueAlert(alert, aiContext, 'system').catch(error => {
          console.warn(`⚠️ MLB AI Queue failed for ${alert.type}:`, error);
        });
        console.log(`🚀 MLB Async AI: Queued ${alert.type} for background enhancement`);

        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ MLB AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ MLB AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'MLB' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'MLB');
      console.log(`📋 MLB User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ MLB Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid MLB alerts that have corresponding module files
      const validMLBAlerts = [
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
        'MLB_RUNNER_ON_SECOND_NO_OUTS',
        'MLB_BATTER_DUE',
        'MLB_STEAL_LIKELIHOOD',
        'MLB_ON_DECK_PREDICTION',
        'MLB_WIND_CHANGE',
        'MLB_LATE_INNING_CLOSE',
        'MLB_SCORING_OPPORTUNITY',
        'MLB_PITCHING_CHANGE',
        'MLB_BASES_LOADED_TWO_OUTS',
        'MLB_HIGH_SCORING_SITUATION',
        'MLB_STRIKEOUT'
      ];

      const mlbEnabledTypes = enabledTypes.filter(alertType =>
        validMLBAlerts.includes(alertType)
      );

      // Check global settings for these MLB alerts
      const globallyEnabledTypes = [];
      for (const alertType of mlbEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 MLB Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing MLB engine for user ${userId} with ${globallyEnabledTypes.length} MLB alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the MLB alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize MLB engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'MLB_GAME_START': './alert-cylinders/mlb/game-start-module.ts',
        'MLB_SEVENTH_INNING_STRETCH': './alert-cylinders/mlb/seventh-inning-stretch-module.ts',
        'MLB_BASES_LOADED_ONE_OUT': './alert-cylinders/mlb/bases-loaded-one-out-module.ts',
        'MLB_RUNNER_ON_THIRD_NO_OUTS': './alert-cylinders/mlb/runner-on-third-no-outs-module.ts',
        'MLB_FIRST_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/first-and-third-no-outs-module.ts',
        'MLB_SECOND_AND_THIRD_NO_OUTS': './alert-cylinders/mlb/second-and-third-no-outs-module.ts',
        'MLB_BASES_LOADED_NO_OUTS': './alert-cylinders/mlb/bases-loaded-no-outs-module.ts',
        'MLB_RUNNER_ON_THIRD_ONE_OUT': './alert-cylinders/mlb/runner-on-third-one-out-module.ts',
        'MLB_FIRST_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/first-and-third-one-out-module.ts',
        'MLB_SECOND_AND_THIRD_ONE_OUT': './alert-cylinders/mlb/second-and-third-one-out-module.ts',
        'MLB_RUNNER_ON_THIRD_TWO_OUTS': './alert-cylinders/mlb/runner-on-third-two-outs-module.ts',
        'MLB_FIRST_AND_THIRD_TWO_OUTS': './alert-cylinders/mlb/first-and-third-two-outs-module.ts',
        'MLB_RUNNER_ON_SECOND_NO_OUTS': './alert-cylinders/mlb/runner-on-second-no-outs-module.ts',
        'MLB_BATTER_DUE': './alert-cylinders/mlb/batter-due-module.ts',
        'MLB_STEAL_LIKELIHOOD': './alert-cylinders/mlb/steal-likelihood-module.ts',
        'MLB_ON_DECK_PREDICTION': './alert-cylinders/mlb/on-deck-prediction-module.ts',
        'MLB_WIND_CHANGE': './alert-cylinders/mlb/wind-change-module.ts',
        'MLB_FIRST_AND_SECOND': './alert-cylinders/mlb/first-and-second-module.ts',
        'MLB_LATE_INNING_CLOSE': './alert-cylinders/mlb/late-inning-close-module.ts',
        'MLB_SCORING_OPPORTUNITY': './alert-cylinders/mlb/scoring-opportunity-module.ts',
        'MLB_PITCHING_CHANGE': './alert-cylinders/mlb/pitching-change-module.ts',
        'MLB_BASES_LOADED_TWO_OUTS': './alert-cylinders/mlb/bases-loaded-two-outs-module.ts',
        'MLB_HIGH_SCORING_SITUATION': './alert-cylinders/mlb/high-scoring-situation-module.ts',
        'MLB_STRIKEOUT': './alert-cylinders/mlb/strikeout-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No MLB module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const instance = new module.default();
      console.log(`✅ MLB ENGINE: Successfully registered alert module: ${alertType} from ${modulePath}`);
      return instance;
    } catch (error) {
      console.error(`❌ Failed to load MLB alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    // Only clear if the alert types have changed - prevents memory leak from constant reloading
    const currentTypes = Array.from(this.alertModules.keys()).sort();
    const newTypes = [...enabledAlertTypes].sort();
    const typesChanged = JSON.stringify(currentTypes) !== JSON.stringify(newTypes);

    if (!typesChanged && this.alertModules.size > 0) {
      console.log(`🔄 MLB alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }

    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared MLB alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded MLB alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} MLB alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  /**
   * Compose time-based, actionable alerts
   */
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    return alerts;
  }

  /**
   * Get recent line movement for context
   */
  private getRecentLineMovement(gameState: GameState): any {
    // In production, this would connect to real-time odds feeds
    // For now, simulate based on game state
    const key = `${gameState.gameId}_line`;
    const previous = this.lineMovementCache.get(key);
    const current = {
      total: gameState.homeScore + gameState.awayScore,
      spread: gameState.homeScore - gameState.awayScore,
      timestamp: Date.now()
    };

    if (previous && (current.timestamp - previous.timestamp) < 60000) {
      const totalMove = current.total - previous.total;
      const spreadMove = current.spread - previous.spread;

      if (Math.abs(totalMove) >= 0.5 || Math.abs(spreadMove) >= 0.5) {
        this.lineMovementCache.set(key, current);
        return {
          totalMove,
          spreadMove,
          timeAgo: Math.floor((current.timestamp - previous.timestamp) / 1000)
        };
      }
    }

    this.lineMovementCache.set(key, current);
    return null;
  }

  /**
   * Get sharp money indicators
   */
  private getSharpMoneyIndicator(gameState: GameState): any {
    // In production, this would use real betting data
    // Simulate based on game flow
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inning = gameState.inning || 1;

    if (scoreDiff <= 1 && inning >= 7) {
      return { indicator: 'heavy', direction: 'over', confidence: 85 };
    }
    if (gameState.hasFirst && gameState.hasSecond && gameState.hasThird) {
      return { indicator: 'moderate', direction: 'over', confidence: 70 };
    }

    return null;
  }




  // Override to return all available MLB alert types
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
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
      'MLB_RUNNER_ON_SECOND_NO_OUTS',
      'MLB_BATTER_DUE',
      'MLB_STEAL_LIKELIHOOD',
      'MLB_ON_DECK_PREDICTION',
      'MLB_WIND_CHANGE',
      'MLB_LATE_INNING_CLOSE',
      'MLB_SCORING_OPPORTUNITY',
      'MLB_PITCHING_CHANGE',
      'MLB_BASES_LOADED_TWO_OUTS',
      'MLB_HIGH_SCORING_SITUATION',
      'MLB_STRIKEOUT'
    ];
  }

  getPerformanceMetrics() {
    const avgCalculationTime = this.performanceMetrics.probabilityCalculationTime.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;

    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
      : 0;

    const avgEnhanceTime = this.performanceMetrics.gameStateEnhancementTime.length > 0
      ? this.performanceMetrics.gameStateEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.gameStateEnhancementTime.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    const deduplicationRate = 0; // Now handled by unified deduplicator

    return {
      sport: 'MLB',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        cacheHitRate,
        deduplicationRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        basesLoadedSituations: this.performanceMetrics.basesLoadedSituations,
        seventhInningDetections: this.performanceMetrics.seventhInningDetections,
        runnerScoringOpportunities: this.performanceMetrics.runnerScoringOpportunities,
        activeGameTracking: 0, // Now handled by unified deduplicator
        totalTrackedAlerts: 0  // Now handled by unified deduplicator
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime.slice(-20),
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.gameStateEnhancementTime.slice(-20)
      }
    };
  }
}