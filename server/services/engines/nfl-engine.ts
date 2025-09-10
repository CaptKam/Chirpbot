import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { AIContextController, AlertContext, AIEnhancedAlert } from '../ai-context-controller';
import { weatherService } from '../weather-service';

export class NFLEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
  private aiContextController: AIContextController;
  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    aiEnhancementTime: [] as number[],
    enhancedAlerts: 0
  };

  constructor() {
    super('NFL');
    this.settingsCache = new SettingsCache(storage);
    this.aiContextController = new AIContextController();
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual NFL alert types
      const validNFLAlerts = [
        'NFL_GAME_START', 'NFL_SECOND_HALF_KICKOFF', 'NFL_TWO_MINUTE_WARNING',
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD'
      ];

      if (!validNFLAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NFL alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NFL Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // Enhanced NFL-specific probability calculation with weather considerations
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
  }

  // Override to add NFL-specific game state enhancement and AI-enhanced alert processing
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      // Enhance game state with NFL-specific live data if needed
      const enhanceStartTime = Date.now();
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);
      const enhanceTime = Date.now() - enhanceStartTime;
      this.performanceMetrics.enhanceDataTime.push(enhanceTime);
      
      // Use the parent class method which properly calls all loaded modules
      const alertStartTime = Date.now();
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      const alertTime = Date.now() - alertStartTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      
      // Process alerts with AI enhancement for high-priority NFL situations
      const processedAlerts = await this.processEnhancedNFLAlerts(rawAlerts, enhancedGameState);
      
      this.performanceMetrics.totalAlerts += processedAlerts.length;
      
      const totalTime = Date.now() - startTime;
      if (totalTime > 100) {
        console.log(`⚠️ NFL Slow alert generation: ${totalTime}ms for game ${gameState.gameId} (enhance: ${enhanceTime}ms, alerts: ${alertTime}ms)`);
      }
      
      return processedAlerts;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ NFL Alert generation failed after ${totalTime}ms:`, error);
      return [];
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      let enhancedGameState = { ...gameState };

      // Get live data from NFL API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { NFLApiService } = await import('../nfl-api');
        const nflApi = new NFLApiService();
        const enhancedData = await nflApi.getEnhancedGameData(gameState.gameId, 'live');

        if (enhancedData && !enhancedData.error) {
          enhancedGameState = {
            ...enhancedGameState,
            quarter: enhancedData.quarter || gameState.quarter || 1,
            timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
            down: enhancedData.down || null,
            yardsToGo: enhancedData.yardsToGo || null,
            fieldPosition: enhancedData.fieldPosition || null,
            possession: enhancedData.possession || null,
            homeScore: enhancedData.homeScore || gameState.homeScore,
            awayScore: enhancedData.awayScore || gameState.awayScore
          };
        }
      }

      // Add weather data for NFL games (for outdoor stadiums only)
      try {
        const weatherData = await weatherService.getWeatherForTeam(enhancedGameState.homeTeam);
        const weatherImpact = weatherService.getNFLWeatherImpact(weatherData);
        
        // Only add weather context for meaningful weather conditions
        if (weatherImpact.weatherAlert || weatherImpact.fieldGoalDifficulty !== 'low') {
          console.log(`🌤️ NFL Weather for ${enhancedGameState.homeTeam}: ${weatherData.condition} ${weatherData.temperature}°F, ${weatherData.windSpeed}mph winds`);
          
          enhancedGameState = {
            ...enhancedGameState,
            weather: {
              data: weatherData,
              impact: weatherImpact,
              fieldGoalFactor: weatherService.calculateFieldGoalWeatherFactor(weatherData),
              passingFactor: weatherService.calculatePassingWeatherFactor(weatherData),
              runningFactor: weatherService.calculateRunningWeatherFactor(weatherData),
              isOutdoorStadium: !this.isIndoorStadium(enhancedGameState.homeTeam)
            }
          };
        }
      } catch (weatherError) {
        console.warn(`🌤️ Weather data unavailable for NFL game ${enhancedGameState.gameId}:`, weatherError);
        // Continue without weather data - not critical for game alerts
      }

      return enhancedGameState;
    } catch (error) {
      console.error('Error enhancing NFL game state with live data:', error);
      return gameState;
    }
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
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }


  // Initialize alert modules based on user's enabled preferences (optimized)
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
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD'
      ];

      const nflEnabledTypes = enabledTypes.filter(alertType =>
        validNFLAlerts.includes(alertType)
      );

      // Check global settings for these NFL alerts (optimized batch check)
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
    const startTime = Date.now();
    
    try {
      const moduleMap: Record<string, string> = {
        'NFL_GAME_START': './alert-cylinders/nfl/game-start-module.ts',
        'NFL_TWO_MINUTE_WARNING': './alert-cylinders/nfl/two-minute-warning-module.ts',
        'NFL_RED_ZONE': './alert-cylinders/nfl/red-zone-module.ts',
        'NFL_SECOND_HALF_KICKOFF': './alert-cylinders/nfl/second-half-kickoff-module.ts',
        'NFL_FOURTH_DOWN': './alert-cylinders/nfl/fourth-down-module.ts',
        'NFL_RED_ZONE_OPPORTUNITY': './alert-cylinders/nfl/red-zone-opportunity-module.ts',
        'NFL_TURNOVER_LIKELIHOOD': './alert-cylinders/nfl/turnover-likelihood-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NFL module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      const loadTime = Date.now() - startTime;
      this.performanceMetrics.moduleLoadTime.push(loadTime);
      
      if (loadTime > 50) {
        console.log(`⚠️ NFL Slow module load: ${alertType} took ${loadTime}ms`);
      }
      
      return new module.default();
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.error(`❌ Failed to load NFL alert module ${alertType} after ${loadTime}ms:`, error);
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
  
  // Process NFL alerts with AI enhancement for high-priority situations
  private async processEnhancedNFLAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const processedAlerts: AlertResult[] = [];
    
    for (const alert of rawAlerts) {
      try {
        // Check if this is a high-priority NFL alert that should get AI enhancement
        if (alert.priority >= 85 && this.shouldEnhanceNFLAlert(alert.type)) {
          const aiStartTime = Date.now();
          console.log(`🤖 NFL AI Enhancement: Processing ${alert.type} alert (priority: ${alert.priority})`);
          
          const enhancedAlert = await this.enhanceNFLAlertWithAI(alert, gameState);
          const aiTime = Date.now() - aiStartTime;
          this.performanceMetrics.aiEnhancementTime.push(aiTime);
          this.performanceMetrics.enhancedAlerts++;
          
          console.log(`✅ NFL AI Enhanced: ${alert.type} in ${aiTime}ms`);
          processedAlerts.push(enhancedAlert);
        } else {
          // Standard alert without AI enhancement
          processedAlerts.push(alert);
        }
      } catch (error) {
        console.error(`❌ NFL AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on AI failure
        processedAlerts.push(alert);
      }
    }
    
    return processedAlerts;
  }
  
  // Check if NFL alert type should receive AI enhancement
  private shouldEnhanceNFLAlert(alertType: string): boolean {
    const enhancedNFLAlerts = [
      'NFL_RED_ZONE_OPPORTUNITY',
      'NFL_TURNOVER_LIKELIHOOD', 
      'NFL_FOURTH_DOWN',
      'NFL_TWO_MINUTE_WARNING'
    ];
    
    return enhancedNFLAlerts.includes(alertType);
  }
  
  // Enhance NFL alert with AI-generated contextual analysis
  private async enhanceNFLAlertWithAI(alert: AlertResult, gameState: GameState): Promise<AlertResult> {
    try {
      // Convert GameState and AlertResult to AlertContext for AI processing
      const alertContext: AlertContext = await this.buildNFLAlertContext(alert, gameState);
      
      // Get AI enhancement from AIContextController
      const aiEnhancement: AIEnhancedAlert = await this.aiContextController.enhanceAlertWithFullControl(alertContext);
      
      // Merge AI enhancement with original alert
      return {
        ...alert,
        message: aiEnhancement.message,
        context: {
          ...alert.context,
          aiEnhanced: true,
          aiInsights: aiEnhancement.insights,
          bettingAdvice: aiEnhancement.bettingAdvice,
          gameProjection: aiEnhancement.gameProjection,
          urgency: aiEnhancement.urgency,
          callToAction: aiEnhancement.callToAction,
          confidenceScore: aiEnhancement.confidenceScore,
          aiProcessingTime: aiEnhancement.aiProcessingTime
        },
        priority: Math.max(alert.priority, 90) // Boost priority for AI-enhanced alerts
      };
    } catch (error) {
      console.error('NFL AI enhancement failed:', error);
      // Return original alert with fallback AI context
      return {
        ...alert,
        context: {
          ...alert.context,
          aiEnhanced: false,
          aiError: 'AI enhancement unavailable',
          fallbackInsight: this.getNFLFallbackInsight(alert.type, gameState)
        }
      };
    }
  }
  
  // Build AlertContext from NFL game state and alert for AI processing
  private async buildNFLAlertContext(alert: AlertResult, gameState: GameState): Promise<AlertContext> {
    const baseContext = {
      gameId: gameState.gameId,
      sport: 'NFL',
      alertType: alert.type,
      priority: alert.priority,
      probability: await this.calculateProbability(gameState),
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      quarter: gameState.quarter,
      timeRemaining: gameState.timeRemaining,
      down: gameState.down,
      yardsToGo: gameState.yardsToGo,
      fieldPosition: gameState.fieldPosition,
      possession: gameState.possession,
      redZone: gameState.fieldPosition ? gameState.fieldPosition <= 20 : false,
      goalLine: gameState.fieldPosition ? gameState.fieldPosition <= 5 : false,
      originalMessage: alert.message,
      originalContext: alert.context
    };

    // Add weather context for outdoor stadiums
    if (gameState.weather && gameState.weather.isOutdoorStadium) {
      const weatherContext = {
        weather: {
          temperature: gameState.weather.data.temperature,
          condition: gameState.weather.data.condition,
          windSpeed: gameState.weather.data.windSpeed,
          windDirection: gameState.weather.data.windDirection,
          humidity: gameState.weather.data.humidity,
          fieldGoalDifficulty: gameState.weather.impact.fieldGoalDifficulty,
          passingConditions: gameState.weather.impact.passingConditions,
          preferredStrategy: gameState.weather.impact.preferredStrategy,
          weatherAlert: gameState.weather.impact.weatherAlert,
          description: gameState.weather.impact.description,
          fieldGoalFactor: gameState.weather.fieldGoalFactor,
          passingFactor: gameState.weather.passingFactor,
          runningFactor: gameState.weather.runningFactor
        },
        weatherImpact: {
          affectsFieldGoals: gameState.weather.impact.fieldGoalDifficulty !== 'low',
          affectsPassing: gameState.weather.impact.passingConditions !== 'excellent',
          strategicImplications: this.getWeatherStrategicImplications(gameState.weather.impact, gameState),
          bettingImplications: this.getWeatherBettingImplications(gameState.weather.impact, gameState)
        }
      };
      
      return { ...baseContext, ...weatherContext };
    }

    return baseContext;
  }

  // Get strategic implications based on weather conditions
  private getWeatherStrategicImplications(weatherImpact: any, gameState: GameState): string {
    const implications = [];
    
    if (weatherImpact.fieldGoalDifficulty === 'extreme') {
      implications.push('Field goals extremely difficult - favor going for it on 4th down');
    } else if (weatherImpact.fieldGoalDifficulty === 'high') {
      implications.push('Field goal accuracy reduced - shorter attempts preferred');
    }
    
    if (weatherImpact.passingConditions === 'dangerous' || weatherImpact.passingConditions === 'poor') {
      implications.push('Passing game compromised - expect more rushing attempts');
    }
    
    if (weatherImpact.preferredStrategy === 'run-heavy') {
      implications.push('Weather strongly favors ground game over aerial attack');
    } else if (weatherImpact.preferredStrategy === 'conservative') {
      implications.push('Weather conditions call for conservative play calling');
    }
    
    if (gameState.fieldPosition && gameState.fieldPosition <= 20 && weatherImpact.fieldGoalDifficulty !== 'low') {
      implications.push('Red zone weather impact - touchdown attempts favored over field goals');
    }
    
    return implications.join('; ') || 'Weather conditions within normal parameters';
  }

  // Get betting implications based on weather conditions
  private getWeatherBettingImplications(weatherImpact: any, gameState: GameState): string {
    const implications = [];
    
    if (weatherImpact.fieldGoalDifficulty === 'extreme' || weatherImpact.fieldGoalDifficulty === 'high') {
      implications.push('Lower scoring potential - UNDER bets favored');
    }
    
    if (weatherImpact.passingConditions === 'poor' || weatherImpact.passingConditions === 'dangerous') {
      implications.push('Passing yards UNDER bets more attractive');
      implications.push('Rushing attempts/yards OVER bets more attractive');
    }
    
    if (weatherImpact.preferredStrategy === 'run-heavy') {
      implications.push('Game likely to feature more running plays and shorter possessions');
    }
    
    if (weatherImpact.weatherAlert) {
      implications.push('Increased variance - weather creates unpredictable outcomes');
    }
    
    return implications.join('; ') || 'Weather impact on betting lines minimal';
  }
  
  // Get fallback insight for NFL alerts when AI enhancement fails
  private getNFLFallbackInsight(alertType: string, gameState: GameState): string {
    switch (alertType) {
      case 'NFL_RED_ZONE_OPPORTUNITY':
        return `Red zone situations have ${gameState.fieldPosition <= 10 ? '85%' : '65%'} touchdown probability`;
      case 'NFL_TURNOVER_LIKELIHOOD':
        return `High-pressure situation with ${gameState.down === 4 ? 'critical' : 'elevated'} turnover risk`;
      case 'NFL_FOURTH_DOWN':
        return `Fourth down decisions are crucial - ${gameState.yardsToGo <= 3 ? 'go for it' : 'consider punt'} territory`;
      case 'NFL_TWO_MINUTE_WARNING':
        return `Clock management phase - every play and timeout becomes critical`;
      default:
        return 'High-value NFL betting situation detected';
    }
  }
  
  // Get performance statistics for monitoring (updated with AI metrics)
  getPerformanceStats(): any {
    const { alertGenerationTime, moduleLoadTime, enhanceDataTime, aiEnhancementTime } = this.performanceMetrics;
    
    const calculateStats = (times: number[]) => {
      if (times.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0, min: 0 };
      
      const sorted = [...times].sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const max = Math.max(...times);
      const min = Math.min(...times);
      
      return { avg: Math.round(avg * 100) / 100, p50, p95, p99, max, min };
    };
    
    return {
      alertGeneration: calculateStats(alertGenerationTime),
      moduleLoading: calculateStats(moduleLoadTime),
      dataEnhancement: calculateStats(enhanceDataTime),
      aiEnhancement: calculateStats(aiEnhancementTime),
      totalRequests: this.performanceMetrics.totalRequests,
      totalAlerts: this.performanceMetrics.totalAlerts,
      enhancedAlerts: this.performanceMetrics.enhancedAlerts,
      enhancementRate: this.performanceMetrics.totalAlerts > 0 
        ? Math.round((this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100) 
        : 0,
      cacheHitRate: this.performanceMetrics.totalRequests > 0 
        ? Math.round((this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100) 
        : 0,
      alertsPerRequest: this.performanceMetrics.totalRequests > 0 
        ? Math.round((this.performanceMetrics.totalAlerts / this.performanceMetrics.totalRequests) * 100) / 100 
        : 0
    };
  }
  
  // Log performance summary every 5 minutes (updated with AI metrics)
  logPerformanceSummary(): void {
    const stats = this.getPerformanceStats();
    console.log(`📊 NFL Engine Performance Summary:
` +
      `  Alert Generation: avg ${stats.alertGeneration.avg}ms, p95 ${stats.alertGeneration.p95}ms\n` +
      `  Module Loading: avg ${stats.moduleLoading.avg}ms, p95 ${stats.moduleLoading.p95}ms\n` +
      `  Data Enhancement: avg ${stats.dataEnhancement.avg}ms, p95 ${stats.dataEnhancement.p95}ms\n` +
      `  AI Enhancement: avg ${stats.aiEnhancement.avg}ms, p95 ${stats.aiEnhancement.p95}ms\n` +
      `  Total Requests: ${stats.totalRequests}, Alerts: ${stats.totalAlerts}\n` +
      `  Enhanced Alerts: ${stats.enhancedAlerts} (${stats.enhancementRate}%)\n` +
      `  Cache Hit Rate: ${stats.cacheHitRate}%, Alerts/Request: ${stats.alertsPerRequest}`);
  }

  // Get performance metrics for V3 dashboard (consistent with other engines)
  getPerformanceMetrics() {
    const avgCalculationTime = this.performanceMetrics.probabilityCalculationTime?.length > 0
      ? this.performanceMetrics.probabilityCalculationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.probabilityCalculationTime.length
      : 0;

    const avgAlertTime = this.performanceMetrics.alertGenerationTime.length > 0
      ? this.performanceMetrics.alertGenerationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.alertGenerationTime.length
      : 0;

    const avgEnhanceTime = this.performanceMetrics.enhanceDataTime.length > 0
      ? this.performanceMetrics.enhanceDataTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.enhanceDataTime.length
      : 0;

    const avgAITime = this.performanceMetrics.aiEnhancementTime.length > 0
      ? this.performanceMetrics.aiEnhancementTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.aiEnhancementTime.length
      : 0;

    const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
      : 0;

    return {
      sport: 'NFL',
      performance: {
        avgResponseTime: avgCalculationTime + avgAlertTime + avgEnhanceTime + avgAITime,
        avgCalculationTime,
        avgAlertGenerationTime: avgAlertTime,
        avgEnhancementTime: avgEnhanceTime,
        avgAIEnhancementTime: avgAITime,
        cacheHitRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        enhancedAlerts: this.performanceMetrics.enhancedAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        aiEnhancementRate: this.performanceMetrics.totalAlerts > 0 
          ? (this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100 
          : 0,
        weatherIntegratedAlerts: this.performanceMetrics.enhancedAlerts,
        contextAwareAlerts: this.performanceMetrics.totalAlerts
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime?.slice(-20) || [],
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.enhanceDataTime.slice(-20),
        aiTimes: this.performanceMetrics.aiEnhancementTime.slice(-20)
      }
    };
  }
}