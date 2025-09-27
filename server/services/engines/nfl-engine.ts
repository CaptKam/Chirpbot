import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { unifiedSettings } from '../../storage';
import { storage } from '../../storage';
import { unifiedAIProcessor, CrossSportContext } from '../unified-ai-processor';
import { weatherService } from '../weather-service';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';

export class NFLEngine extends BaseSportEngine {
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
    redZoneOpportunities: 0,
    fourthDownSituations: 0,
    twoMinuteWarnings: 0,
  };

  constructor() {
    super('NFL');
  }




  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual NFL alert types
      const validNFLAlerts = [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD',
        'NFL_MASSIVE_WEATHER'
      ];

      if (!validNFLAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NFL alert type - rejecting`);
        return false;
      }

      return await unifiedSettings.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NFL Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const startTime = Date.now();

    try {
      if (!gameState.isLive) return 0;

      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore, weather } = gameState;

      let probability = 50; // Base probability

      // Quarter-specific adjustments (optimized for faster calculation)
      if (quarter === 1) probability += 10; // Game start excitement
      else if (quarter === 3) probability += 8; // Second half start
      else if (quarter === 4) probability += 15; // Fourth quarter drama

      // Down and distance (enhanced with field position context)
      if (down === 1) probability += 15;
      else if (down === 2) probability += 5;
      else if (down === 3) probability -= 5;
      else if (down === 4) probability += 25; // Fourth down is actually exciting!

      // Enhanced field position logic (optimized calculations)
      if (fieldPosition && fieldPosition <= 20) {
        probability += 20; // Red zone
        if (down === 4) probability += 10; // Fourth down in red zone
      } else if (fieldPosition && fieldPosition <= 40) {
        probability += 10; // Scoring territory
      }

      // Score differential (quick calculation)
      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) probability += 20; // Very close game
        else if (scoreDiff <= 7) probability += 10; // Close game
        else if (scoreDiff <= 14) probability += 5; // Competitive game
      }

      // Time factors (optimized time parsing)
      const timeSeconds = this.parseTimeToSeconds(timeRemaining);
      if (timeSeconds <= 120) {
        probability += 20; // Two-minute warning
        if (quarter === 4) probability += 10; // End of game drama
      }

      // Yards to go consideration
      if (yardsToGo && yardsToGo <= 3) {
        probability += 10; // Short yardage situations are exciting
      }

      // Weather impact adjustments (for outdoor stadiums only)
      if (weather && weather.isOutdoorStadium) {
        const weatherImpact = weather.impact;
        
        // Extreme weather conditions increase excitement/unpredictability
        if (weatherImpact.weatherAlert) {
          probability += 15; // Weather makes games more unpredictable/exciting
          
          // Specific weather situation adjustments
          if (weatherImpact.fieldGoalDifficulty === 'extreme') {
            probability += 10; // Very difficult field goal conditions
          }
          
          if (weatherImpact.passingConditions === 'dangerous') {
            probability += 8; // Poor passing conditions create more drama
          }
          
          // Fourth down in extreme weather is extra exciting
          if (down === 4 && weatherImpact.fieldGoalDifficulty !== 'low') {
            probability += 5; // Weather complicates fourth down decisions
          }
        }
        
        // Red zone weather impact - field goal difficulty affects strategy
        if (fieldPosition && fieldPosition <= 20 && weatherImpact.fieldGoalDifficulty === 'high') {
          probability += 5; // Weather makes red zone decisions more critical
        }
      }

      return Math.min(Math.max(probability, 10), 95);
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

  // Override to add NFL-specific game state normalization
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();

    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ NFL: No gameId provided, skipping alert generation');
        return [];
      }

      // Enhance game state with NFL-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);

      // Return raw alerts - GameStateManager will handle enhancement pipeline
      if (rawAlerts.length > 0) {
        console.log(`🔄 NFL: Generated ${rawAlerts.length} raw alerts - GameStateManager will handle enhancement`);
      } else {
        console.log(`🔄 NFL: No alerts generated for game ${enhancedGameState.gameId}`);
      }

      // Track NFL-specific metrics
      if (enhancedGameState.fieldPosition && enhancedGameState.fieldPosition <= 20) {
        this.performanceMetrics.redZoneOpportunities++;
      }
      if (enhancedGameState.down === 4) {
        this.performanceMetrics.fourthDownSituations++;
      }
      const timeSeconds = this.parseTimeToSeconds(enhancedGameState.timeRemaining || '');
      if (timeSeconds <= 120 && enhancedGameState.quarter >= 4) {
        this.performanceMetrics.twoMinuteWarnings++;
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
      console.log(`🔧 NFL Enhancement: Game ${gameState.gameId} - status=${gameState.status}, isLive=${gameState.isLive}`);

      // Get live data from NFL API for any non-final game (fixes catch-22 gating loop)
      if (gameState.gameId && gameState.status !== 'final') {
        console.log(`✅ NFL Enhancement: Fetching enhanced data for non-final game ${gameState.gameId}`);
        const { NFLApiService } = await import('../nfl-api');
        const nflApi = new NFLApiService();
        const enhancedData = await nflApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          this.performanceMetrics.cacheHits++;
          
          // Add weather data for NFL games (for outdoor stadiums only)
          let weatherContext = gameState.weatherContext;
          try {
            const weatherData = await weatherService.getWeatherForTeam(gameState.homeTeam);
            const weatherImpact = weatherService.getNFLWeatherImpact(weatherData);
            
            // Only add weather context for meaningful weather conditions
            if (weatherImpact.weatherAlert || weatherImpact.fieldGoalDifficulty !== 'low') {
              console.log(`🌤️ NFL Weather for ${gameState.homeTeam}: ${weatherData.condition} ${weatherData.temperature}°F, ${weatherData.windSpeed}mph winds`);
              
              weatherContext = {
                data: weatherData,
                impact: weatherImpact,
                fieldGoalFactor: weatherService.calculateFieldGoalWeatherFactor(weatherData),
                passingFactor: weatherService.calculatePassingWeatherFactor(weatherData),
                runningFactor: weatherService.calculateRunningWeatherFactor(weatherData),
                isOutdoorStadium: !this.isIndoorStadium(gameState.homeTeam)
              };
            }
          } catch (error) {
            // Weather fetch failed, continue without it
            console.warn(`🌤️ Weather data unavailable for NFL game ${gameState.gameId}:`, error);
          }

          const enhancedGameState = {
            ...gameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
            down: enhancedData.down || gameState.down || 1,
            yardsToGo: enhancedData.yardsToGo || gameState.yardsToGo || 10,
            fieldPosition: enhancedData.fieldPosition || gameState.fieldPosition || 50,
            possession: enhancedData.possession || gameState.possession || gameState.homeTeam,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore,
            weatherContext,
            weather: weatherContext,
            // Respect original game status - only force false for finished games, preserve original live state
            isLive: gameState.status === 'final' ? false : gameState.isLive
          };
          console.log(`🚀 NFL Enhancement: Game ${gameState.gameId} enhanced - isLive=${enhancedGameState.isLive}, Q${enhancedGameState.quarter}, ${enhancedGameState.down}&${enhancedGameState.yardsToGo} at ${enhancedGameState.fieldPosition}yd line`);
          return enhancedGameState;
        } else {
          this.performanceMetrics.cacheMisses++;
        }
      }
    } catch (error) {
      console.error('Error enhancing NFL game state with live data:', error);
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

  // Check if team plays in indoor stadium
  private isIndoorStadium(teamName: string): boolean {
    const indoorTeams = [
      'Detroit Lions', 'Minnesota Vikings', 'New Orleans Saints', 'Las Vegas Raiders'
    ];
    const retractableRoofTeams = [
      'Arizona Cardinals', 'Atlanta Falcons', 'Dallas Cowboys', 'Houston Texans', 'Indianapolis Colts'
    ];
    
    // Indoor stadiums never have weather impact
    if (indoorTeams.includes(teamName)) return true;
    
    // Retractable roof stadiums - assume open for this implementation
    // In a real system, you'd check current roof status
    return false;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  // Process alerts with cross-sport AI enhancement for high-priority NFL situations
  private async processEnhancedNFLAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Process all alerts for AI enhancement to ensure maximum coverage
        const probability = await this.calculateProbability(gameState);

        console.log(`🧠 NFL AI Enhancement: Processing ${alert.type} alert (${probability}%)`);

        // Build cross-sport context for NFL
        const aiContext: CrossSportContext = {
            sport: 'NFL',
            gameId: gameState.gameId,
            alertType: alert.type,
            priority: alert.priority,
            probability: probability,
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            isLive: gameState.isLive,
            quarter: gameState.quarter,
            timeRemaining: gameState.timeRemaining,
            down: gameState.down,
            yardsToGo: gameState.yardsToGo,
            fieldPosition: gameState.fieldPosition,
            possession: gameState.possession,
            redZone: gameState.fieldPosition ? gameState.fieldPosition <= 20 : false,
            goalLine: gameState.fieldPosition ? gameState.fieldPosition <= 5 : false,
            weather: gameState.weather ? {
              temperature: gameState.weather.data?.temperature || 72,
              condition: gameState.weather.data?.condition || 'Clear',
              windSpeed: gameState.weather.data?.windSpeed || 0,
              humidity: gameState.weather.data?.humidity || 50,
              impact: gameState.weather.impact?.description || 'Minimal impact'
            } : undefined,
            originalMessage: alert.message,
            originalContext: alert.context
          };

        // NON-BLOCKING: Queue for async AI enhancement and return base alert immediately
        unifiedAIProcessor.queueAlert(alert, aiContext, 'system').catch(error => {
          console.warn(`⚠️ NFL AI Queue failed for ${alert.type}:`, error);
        });
        console.log(`🚀 NFL Async AI: Queued ${alert.type} for background enhancement`);

        // Always return base alert immediately (async enhancement happens via WebSocket)
        enhancedAlerts.push(alert);
      } catch (error) {
        console.error(`❌ NFL AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    if (aiTime > 50) {
      console.log(`⚠️ NFL AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'NFL' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'NFL');
      console.log(`📋 NFL User preferences for ${userId}: ${userPrefs.length} found`);
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);
      console.log(`✅ NFL Enabled alert types: ${enabledTypes.join(', ')}`);

      // Filter to only valid NFL alerts that have corresponding module files
      const validNFLAlerts = [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD',
        'NFL_MASSIVE_WEATHER'
      ];

      const nflEnabledTypes = enabledTypes.filter(alertType =>
        validNFLAlerts.includes(alertType)
      );

      // Check global settings for these NFL alerts
      const globallyEnabledTypes = [];
      for (const alertType of nflEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        console.log(`🔍 NFL Alert ${alertType}: globally enabled = ${isGloballyEnabled}`);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing NFL engine for user ${userId} with ${globallyEnabledTypes.length} NFL alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the NFL alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize NFL engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'NFL_GAME_START': './alert-cylinders/nfl/game-start-module.ts',
        'NFL_SECOND_HALF_KICKOFF': './alert-cylinders/nfl/second-half-kickoff-module.ts',
        'NFL_TWO_MINUTE_WARNING': './alert-cylinders/nfl/two-minute-warning-module.ts',
        'NFL_RED_ZONE': './alert-cylinders/nfl/red-zone-module.ts',
        'NFL_FOURTH_DOWN': './alert-cylinders/nfl/fourth-down-module.ts',
        'NFL_RED_ZONE_OPPORTUNITY': './alert-cylinders/nfl/red-zone-opportunity-module.ts',
        'NFL_TURNOVER_LIKELIHOOD': './alert-cylinders/nfl/turnover-likelihood-module.ts',
        'NFL_MASSIVE_WEATHER': './alert-cylinders/nfl/massive-weather-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NFL module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const instance = new module.default();
      console.log(`✅ NFL ENGINE: Successfully registered alert module: ${alertType} from ${modulePath}`);
      return instance;
    } catch (error) {
      console.error(`❌ Failed to load NFL alert module ${alertType}:`, error);
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
      console.log(`🔄 NFL alert cylinders already loaded: ${this.alertModules.size} modules`);
      return; // Reuse existing modules
    }

    // Only clear when types have actually changed
    if (typesChanged) {
      this.alertModules.clear();
      console.log(`🧹 Cleared NFL alert modules due to type changes`);
    }

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded NFL alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} NFL alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  /**
   * Compose time-based, actionable alerts using AlertComposer
   */
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const composedAlerts: AlertResult[] = [];

    for (const alert of alerts) {
      try {
        // Generate enhanced payload with time-sensitive intelligence
        const enhancedPayload = await alertComposer.composeEnhancedAlert(alert, gameState, {
          // Add any NFL-specific context
          recentLineMovement: this.getRecentLineMovement(gameState),
          sharpMoney: this.getSharpMoneyIndicator(gameState)
        });

        // Create enhanced alert with rich messaging
        const enhancedAlert: AlertResult = {
          ...alert,
          message: enhancedPayload.headline,
          context: {
            ...alert.context,
            enhanced: enhancedPayload,
            displayText: alertComposer.formatForDisplay(enhancedPayload),
            mobileText: alertComposer.formatForMobileNotification(enhancedPayload),
            timing: enhancedPayload.timing,
            action: enhancedPayload.action,
            insight: enhancedPayload.insight,
            riskReward: enhancedPayload.riskReward
          }
        };

        composedAlerts.push(enhancedAlert);
        console.log(`⚡ NFL Alert Composed: ${alert.type} - ${enhancedPayload.timing.urgencyLevel} priority`);
      } catch (error) {
        console.error(`Failed to compose NFL alert:`, error);
        composedAlerts.push(alert); // Fallback to original
      }
    }

    return composedAlerts;
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
    const quarter = gameState.quarter || 1;

    if (scoreDiff <= 3 && quarter >= 4) {
      return { indicator: 'heavy', direction: 'over', confidence: 85 };
    }
    if (gameState.fieldPosition && gameState.fieldPosition <= 20) {
      return { indicator: 'moderate', direction: 'over', confidence: 70 };
    }

    return null;
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
      sport: 'NFL',
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
        redZoneOpportunities: this.performanceMetrics.redZoneOpportunities,
        fourthDownSituations: this.performanceMetrics.fourthDownSituations,
        twoMinuteWarnings: this.performanceMetrics.twoMinuteWarnings,
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

  // Override to return all available NFL alert types
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'NFL_GAME_START',
      'NFL_SECOND_HALF_KICKOFF',
      'NFL_TWO_MINUTE_WARNING',
      'NFL_RED_ZONE',
      'NFL_FOURTH_DOWN',
      'NFL_RED_ZONE_OPPORTUNITY',
      'NFL_TURNOVER_LIKELIHOOD',
      'NFL_MASSIVE_WEATHER'
    ];
  }
}