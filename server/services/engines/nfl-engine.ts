import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { asyncAIProcessor } from '../async-ai-processor';
import { CrossSportContext } from '../cross-sport-ai-enhancement';
import { weatherService } from '../weather-service';
import { alertComposer, EnhancedAlertPayload } from '../alert-composer';
import { sendTelegramAlert, type TelegramConfig } from '../telegram';

export class NFLEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;
  private lineMovementCache: Map<string, any> = new Map(); // Track line movements
  
  // Deduplication tracking - tracks sent alerts to prevent duplicates
  private sentAlerts: Map<string, Set<string>> = new Map(); // gameId -> Set of alertKeys
  private alertTimestamps: Map<string, number> = new Map(); // alertKey -> timestamp
  private lastCleanup: number = Date.now();
  private readonly ALERT_COOLDOWN_MS = 300000; // 5 minutes cooldown per alert
  private readonly CLEANUP_INTERVAL_MS = 600000; // Clean up old entries every 10 minutes
  private readonly MAX_ALERTS_PER_GAME = 50; // Prevent memory overload per game
  
  private performanceMetrics = {
    alertGenerationTime: [] as number[],
    moduleLoadTime: [] as number[],
    enhanceDataTime: [] as number[],
    totalRequests: 0,
    totalAlerts: 0,
    cacheHits: 0,
    cacheMisses: 0,
    aiEnhancementTime: [] as number[],
    enhancedAlerts: 0,
    probabilityCalculationTime: [] as number[],
    duplicatesBlocked: 0,
    alertsSent: 0
  };

  constructor() {
    super('NFL');
    this.settingsCache = new SettingsCache(storage);
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
    
    try {
      // Early exit if game is not valid
      if (!gameState.gameId) {
        console.log('⚠️ NFL: No gameId provided, skipping alert generation');
        return [];
      }
      
      // Enhance game state with NFL-specific live data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);

      // Use the parent class method which properly calls all loaded modules
      const rawAlerts = await super.generateLiveAlerts(enhancedGameState);
      
      // Filter out duplicate alerts before processing
      const dedupedAlerts: AlertResult[] = [];
      for (const alert of rawAlerts) {
        // Check if this alert has already been sent
        if (!this.hasAlertBeenSent(enhancedGameState.gameId, alert.alertKey)) {
          dedupedAlerts.push(alert);
          // Mark as sent immediately to prevent duplicates in same processing cycle
          this.markAlertSent(enhancedGameState.gameId, alert.alertKey);
        }
      }
      
      // If all alerts were duplicates, return early
      if (dedupedAlerts.length === 0) {
        console.log(`🔄 NFL: All ${rawAlerts.length} alerts were duplicates for game ${enhancedGameState.gameId}`);
        return [];
      }
      
      console.log(`✅ NFL: Processing ${dedupedAlerts.length} new alerts (blocked ${rawAlerts.length - dedupedAlerts.length} duplicates)`);
      
      // Enhance alerts with time-sensitive intelligence via AlertComposer
      const composedAlerts = await this.composeTimeBasedAlerts(dedupedAlerts, enhancedGameState);
      
      // Process alerts with cross-sport AI enhancement for high-priority NFL situations
      const alerts = await this.processEnhancedNFLAlerts(composedAlerts, enhancedGameState);
      
      this.performanceMetrics.totalAlerts += alerts.length;
      
      // Send alerts to both WebSocket and Telegram simultaneously (already deduplicated)
      await this.deliverAlertsToAllChannels(alerts, enhancedGameState);
      
      return alerts;
    } finally {
      const alertTime = Date.now() - startTime;
      this.performanceMetrics.alertGenerationTime.push(alertTime);
      this.performanceMetrics.totalRequests++;
      
      // Keep only last 100 measurements for performance
      if (this.performanceMetrics.alertGenerationTime.length > 100) {
        this.performanceMetrics.alertGenerationTime = this.performanceMetrics.alertGenerationTime.slice(-100);
      }
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
        'NFL_RED_ZONE', 'NFL_FOURTH_DOWN', 'NFL_RED_ZONE_OPPORTUNITY', 'NFL_TURNOVER_LIKELIHOOD',
        'NFL_MASSIVE_WEATHER'
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
        'NFL_TURNOVER_LIKELIHOOD': './alert-cylinders/nfl/turnover-likelihood-module.ts',
        'NFL_MASSIVE_WEATHER': './alert-cylinders/nfl/massive-weather-module.ts'
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
  
  // Process NFL alerts with cross-sport AI enhancement for high-priority situations
  private async processEnhancedNFLAlerts(rawAlerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const enhancedAlerts: AlertResult[] = [];
    const aiStartTime = Date.now();

    for (const alert of rawAlerts) {
      try {
        // Only enhance medium-priority alerts (>= 60 probability)
        const probability = await this.calculateProbability(gameState);
        
        if (probability >= 60 && this.crossSportAI.configured) {
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
              impact: gameState.weather.impact?.description || 'Minimal impact',
              // Rich NFL weather context for AI processing
              fieldGoalDifficulty: gameState.weather.impact?.fieldGoalDifficulty || 'low',
              passingConditions: gameState.weather.impact?.passingConditions || 'excellent',
              preferredStrategy: gameState.weather.impact?.preferredStrategy || 'balanced',
              weatherAlert: gameState.weather.impact?.weatherAlert || false,
              fieldGoalFactor: gameState.weather.fieldGoalFactor || 1.0,
              passingFactor: gameState.weather.passingFactor || 1.0,
              runningFactor: gameState.weather.runningFactor || 1.0,
              isOutdoorStadium: gameState.weather.isOutdoorStadium || false,
              strategicImplications: this.getWeatherStrategicImplications(gameState.weather.impact, gameState),
              bettingImplications: this.getWeatherBettingImplications(gameState.weather.impact, gameState)
            } : undefined,
            originalMessage: alert.message,
            originalContext: alert.context
          };

          const aiResponse = await this.crossSportAI.enhanceAlert(aiContext);
          
          // Update alert with AI enhancement
          enhancedAlerts.push({
            ...alert,
            message: aiResponse.enhancedMessage,
            context: {
              ...alert.context,
              aiEnhanced: true,
              aiInsights: aiResponse.contextualInsights,
              aiRecommendation: aiResponse.actionableRecommendation,
              urgencyLevel: aiResponse.urgencyLevel,
              bettingContext: aiResponse.bettingContext,
              confidence: aiResponse.confidence,
              sportSpecificData: aiResponse.sportSpecificData,
              processingTime: aiResponse.aiProcessingTime
            }
          });

          this.performanceMetrics.enhancedAlerts++;
        } else {
          // Keep original alert for lower-priority situations
          enhancedAlerts.push(alert);
        }
      } catch (error) {
        console.error(`❌ NFL AI Enhancement failed for ${alert.type}:`, error);
        // Fallback to original alert on error
        enhancedAlerts.push(alert);
      }
    }

    const aiTime = Date.now() - aiStartTime;
    this.performanceMetrics.aiEnhancementTime.push(aiTime);
    if (aiTime > 50) {
      console.log(`⚠️ NFL AI Enhancement slow: ${aiTime}ms (target: <50ms)`);
    }

    return enhancedAlerts;
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
      
      // Note: AI enhancement now handled through unified AsyncAI pipeline
      // This method is kept for compatibility but returns original alert
      return {
        ...alert,
        context: {
          ...alert.context,
          aiEnhanced: false,
          note: 'AI enhancement moved to unified pipeline'
        }
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
  
  /**
   * Compose time-based, actionable alerts using AlertComposer
   */
  private async composeTimeBasedAlerts(alerts: AlertResult[], gameState: GameState): Promise<AlertResult[]> {
    const composedAlerts: AlertResult[] = [];
    
    for (const alert of alerts) {
      try {
        // Generate enhanced payload with time-sensitive intelligence
        const enhancedPayload = await alertComposer.composeEnhancedAlert(alert, gameState, {
          // Add NFL-specific context
          recentLineMovement: this.getRecentLineMovement(gameState),
          sharpMoney: this.getSharpMoneyIndicator(gameState),
          weatherImpact: gameState.weather
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
   * Get recent line movement for NFL context
   */
  private getRecentLineMovement(gameState: GameState): any {
    // In production, this would connect to real-time odds feeds
    // For now, simulate based on game state
    const key = `${gameState.gameId}_line`;
    const previous = this.lineMovementCache.get(key);
    const current = {
      total: (gameState.homeScore || 0) + (gameState.awayScore || 0),
      spread: (gameState.homeScore || 0) - (gameState.awayScore || 0),
      quarter: gameState.quarter || 0,
      timestamp: Date.now()
    };
    
    if (previous && (current.timestamp - previous.timestamp) < 60000) {
      const totalMove = current.total - previous.total;
      const spreadMove = current.spread - previous.spread;
      
      if (Math.abs(totalMove) >= 3 || Math.abs(spreadMove) >= 0.5) {
        this.lineMovementCache.set(key, current);
        return {
          totalMove,
          spreadMove,
          quarterChange: current.quarter !== previous.quarter,
          timeAgo: Math.floor((current.timestamp - previous.timestamp) / 1000)
        };
      }
    }
    
    this.lineMovementCache.set(key, current);
    return null;
  }
  
  /**
   * Get sharp money indicators for NFL
   */
  private getSharpMoneyIndicator(gameState: GameState): any {
    // In production, this would use real betting data
    // Simulate based on game flow and field position
    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const quarter = gameState.quarter || 1;
    const fieldPosition = gameState.fieldPosition || 50;
    
    // Red zone situations often see sharp action
    if (fieldPosition <= 20 && quarter >= 3) {
      return { indicator: 'heavy', direction: 'TD props', confidence: 75 };
    }
    
    // Close games in 4th quarter
    if (scoreDiff <= 3 && quarter === 4) {
      return { indicator: 'moderate', direction: 'under', confidence: 65 };
    }
    
    // Fourth down situations
    if (gameState.down === 4) {
      return { indicator: 'spike', direction: 'live action', confidence: 80 };
    }
    
    return null;
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

    const deduplicationRate = this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked > 0
      ? (this.performanceMetrics.duplicatesBlocked / (this.performanceMetrics.alertsSent + this.performanceMetrics.duplicatesBlocked)) * 100
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
        deduplicationRate,
        totalRequests: this.performanceMetrics.totalRequests,
        totalAlerts: this.performanceMetrics.totalAlerts,
        alertsSent: this.performanceMetrics.alertsSent,
        duplicatesBlocked: this.performanceMetrics.duplicatesBlocked,
        enhancedAlerts: this.performanceMetrics.enhancedAlerts,
        cacheHits: this.performanceMetrics.cacheHits,
        cacheMisses: this.performanceMetrics.cacheMisses
      },
      sportSpecific: {
        aiEnhancementRate: this.performanceMetrics.totalAlerts > 0 
          ? (this.performanceMetrics.enhancedAlerts / this.performanceMetrics.totalAlerts) * 100 
          : 0,
        weatherIntegratedAlerts: this.performanceMetrics.enhancedAlerts,
        contextAwareAlerts: this.performanceMetrics.totalAlerts,
        activeGameTracking: this.sentAlerts.size,
        totalTrackedAlerts: this.alertTimestamps.size
      },
      recentPerformance: {
        calculationTimes: this.performanceMetrics.probabilityCalculationTime?.slice(-20) || [],
        alertTimes: this.performanceMetrics.alertGenerationTime.slice(-20),
        enhancementTimes: this.performanceMetrics.enhanceDataTime.slice(-20),
        aiTimes: this.performanceMetrics.aiEnhancementTime.slice(-20)
      }
    };
  }

  /**
   * Check if an alert has already been sent recently
   */
  private hasAlertBeenSent(gameId: string, alertKey: string): boolean {
    // Check if this exact alert was sent recently
    const lastSent = this.alertTimestamps.get(alertKey);
    if (lastSent && (Date.now() - lastSent) < this.ALERT_COOLDOWN_MS) {
      this.performanceMetrics.duplicatesBlocked++;
      console.log(`🚫 NFL Duplicate blocked: ${alertKey} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
      return true;
    }
    
    // Check if we've sent too many alerts for this game
    const gameAlerts = this.sentAlerts.get(gameId);
    if (gameAlerts && gameAlerts.size >= this.MAX_ALERTS_PER_GAME) {
      console.log(`⚠️ NFL Alert limit reached for game ${gameId} (${gameAlerts.size} alerts)`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Mark an alert as sent
   */
  private markAlertSent(gameId: string, alertKey: string): void {
    // Track by game
    if (!this.sentAlerts.has(gameId)) {
      this.sentAlerts.set(gameId, new Set());
    }
    this.sentAlerts.get(gameId)!.add(alertKey);
    
    // Track timestamp
    this.alertTimestamps.set(alertKey, Date.now());
    this.performanceMetrics.alertsSent++;
    
    console.log(`✅ NFL Alert tracked: ${alertKey} for game ${gameId}`);
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupOldAlerts();
  }
  
  /**
   * Clean up old alert tracking data to prevent memory leaks
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    
    // Only run cleanup periodically
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) {
      return;
    }
    
    console.log(`🧹 NFL Alert cleanup: Removing alerts older than ${this.ALERT_COOLDOWN_MS}ms`);
    
    // Clean up old timestamps
    let removedCount = 0;
    for (const [alertKey, timestamp] of this.alertTimestamps.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN_MS) {
        this.alertTimestamps.delete(alertKey);
        removedCount++;
      }
    }
    
    // Clean up game tracking for finished games (no alerts in last hour)
    const oneHourAgo = now - 3600000;
    for (const [gameId, alerts] of this.sentAlerts.entries()) {
      let hasRecentAlert = false;
      for (const alertKey of alerts) {
        const timestamp = this.alertTimestamps.get(alertKey);
        if (timestamp && timestamp > oneHourAgo) {
          hasRecentAlert = true;
          break;
        }
      }
      
      if (!hasRecentAlert) {
        this.sentAlerts.delete(gameId);
        console.log(`🧹 NFL Removed tracking for game ${gameId}`);
      }
    }
    
    this.lastCleanup = now;
    console.log(`🧹 NFL Alert cleanup complete: removed ${removedCount} old alerts`);
  }

  // Send alerts to Telegram - WebSocket broadcasting removed to prevent duplicates
  // Note: WebSocket broadcasting now handled exclusively by AsyncAI processor for enhancement
  private async deliverAlertsToAllChannels(alerts: AlertResult[], gameState: GameState): Promise<void> {
    if (!alerts || alerts.length === 0) return;
    
    try {
      console.log(`🚀 Delivering ${alerts.length} NFL alerts to Telegram (WebSocket handled by AsyncAI processor)`);
      
      // Only Telegram delivery - WebSocket broadcasting removed to prevent duplicates
      await this.deliverAlertsToTelegram(alerts, gameState);
      
      console.log(`✅ Telegram delivery complete for ${alerts.length} alerts`);
      
    } catch (error) {
      console.error('❌ Alert delivery system error:', error);
    }
  }

  // REMOVED: WebSocket delivery method - prevents duplicate alerts
  // WebSocket broadcasting now handled exclusively by AsyncAI processor in routes.ts
  // This ensures all alerts go through AI enhancement before being broadcast
  // 
  // private async deliverAlertsToWebSocket(alerts: AlertResult[], gameState: GameState): Promise<void> {
  //   // Method removed to prevent duplicate WebSocket broadcasts
  //   // All WebSocket delivery now handled by AsyncAI processor for proper enhancement
  // }

  private async deliverAlertsToTelegram(alerts: AlertResult[], gameState: GameState): Promise<void> {
    try {
      // Get all users with Telegram enabled
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(user => 
        user.telegramEnabled && 
        user.telegramBotToken && 
        user.telegramChatId &&
        user.telegramBotToken !== 'default_key' &&
        user.telegramChatId !== 'test-chat-id'
      );
      
      if (telegramUsers.length === 0) {
        console.log('📱 ℹ️ No users with valid Telegram configurations found');
        return;
      }
      
      console.log(`📱 🚀 Delivering ${alerts.length} NFL alerts to ${telegramUsers.length} Telegram users`);
      
      // Send alerts to each user
      for (const alert of alerts) {
        // Double-check alert hasn't been sent (extra safety)
        const telegramKey = `telegram_${alert.alertKey}`;
        if (this.hasAlertBeenSent(gameState.gameId, telegramKey)) {
          console.log(`📱 🚫 Telegram alert already sent: ${telegramKey}`);
          continue;
        }
        
        for (const user of telegramUsers) {
          try {
            const telegramConfig: TelegramConfig = {
              botToken: user.telegramBotToken!,
              chatId: user.telegramChatId!
            };
            
            const telegramAlert = {
              id: alert.alertKey,
              type: alert.type,
              title: alert.message.split('|')[0].trim(), // Extract title from message
              description: alert.message,
              gameInfo: {
                awayTeam: gameState.awayTeam,
                homeTeam: gameState.homeTeam,
                score: {
                  away: gameState.awayScore,
                  home: gameState.homeScore
                },
                quarter: gameState.quarter,
                timeRemaining: gameState.timeRemaining,
                down: gameState.down,
                yardsToGo: gameState.yardsToGo,
                fieldPosition: gameState.fieldPosition,
                possession: gameState.possession,
                weather: gameState.weather ? {
                  temperature: gameState.weather.data?.temperature,
                  condition: gameState.weather.data?.condition,
                  windSpeed: gameState.weather.data?.windSpeed,
                  impact: gameState.weather.impact?.description
                } : null
              }
            };
            
            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
            
            if (sent) {
              console.log(`📱 ✅ Sent ${alert.type} alert to ${user.username || user.id}`);
              // Mark this specific telegram alert as sent after successful delivery
              this.markAlertSent(gameState.gameId, telegramKey);
            } else {
              console.log(`📱 ❌ Failed to send ${alert.type} alert to ${user.username || user.id}`);
            }
          } catch (error) {
            console.error(`📱 ❌ Telegram delivery error for user ${user.username || user.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('📱 ❌ Telegram delivery system error:', error);
    }
  }
}