import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class MLBEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('MLB');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual MLB alert types
      const validMLBAlerts = [
        'BASES_LOADED', 'FULL_COUNT', 'RISP', 'CLOSE_GAME', 'LATE_PRESSURE',
        'POWER_HITTER', 'HOT_HITTER', 'RUNNERS_1ST_2ND', 'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH', 'TEST_ALERT'
      ];

      if (!validMLBAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid MLB alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const { inning, outs, homeScore, awayScore } = gameState;

    let probability = 50; // Base probability

    // Inning-specific adjustments
    if (inning >= 7) probability += 15; // Late innings
    else if (inning >= 4) probability += 8; // Middle innings
    else if (inning <= 2) probability += 10; // Early game excitement

    // Outs situation
    if (outs === 0) probability += 15; // No outs
    else if (outs === 1) probability += 5; // One out
    else if (outs === 2) probability -= 10; // Two outs - pressure

    // Score situation
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff <= 2) probability += 20; // Close game
    else if (scoreDiff <= 5) probability += 10; // Moderately close
    else if (scoreDiff >= 8) probability -= 15; // Blowout

    // Base runners (if available)
    if (gameState.hasFirst || gameState.hasSecond || gameState.hasThird) {
      probability += 10; // Runners on base
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  // Override to add MLB-specific alert generation
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    
    try {
      // Enhance game state with MLB-specific data if needed
      const enhancedGameState = await this.enhanceGameStateWithLiveData(gameState);
      
      if (!enhancedGameState.isLive) {
        return alerts;
      }

      // Generate MLB-specific alerts based on game state
      
      // RISP Alert (Runner in Scoring Position - 2nd or 3rd base)
      if (enhancedGameState.hasSecond || enhancedGameState.hasThird) {
        alerts.push({
          alertKey: `${gameState.gameId}-risp-${enhancedGameState.inning}-${enhancedGameState.outs}`,
          type: 'RISP',
          message: `Runner in scoring position: ${gameState.awayTeam} vs ${gameState.homeTeam}${enhancedGameState.hasSecond ? ' - 2nd base' : ''}${enhancedGameState.hasThird ? ' - 3rd base' : ''}, ${enhancedGameState.outs} outs`,
          context: {
            gameId: gameState.gameId,
            inning: enhancedGameState.inning,
            outs: enhancedGameState.outs,
            hasSecond: enhancedGameState.hasSecond,
            hasThird: enhancedGameState.hasThird
          },
          priority: 85
        });
      }

      // Bases Loaded Alert
      if (enhancedGameState.hasFirst && enhancedGameState.hasSecond && enhancedGameState.hasThird) {
        alerts.push({
          alertKey: `${gameState.gameId}-bases-loaded-${enhancedGameState.inning}-${enhancedGameState.outs}`,
          type: 'BASES_LOADED',
          message: `Bases loaded: ${gameState.awayTeam} vs ${gameState.homeTeam}, ${enhancedGameState.outs} outs`,
          context: {
            gameId: gameState.gameId,
            inning: enhancedGameState.inning,
            outs: enhancedGameState.outs
          },
          priority: 100
        });
      }

      // Runners on 1st and 2nd Alert
      if (enhancedGameState.hasFirst && enhancedGameState.hasSecond && !enhancedGameState.hasThird) {
        alerts.push({
          alertKey: `${gameState.gameId}-runners-1st-2nd-${enhancedGameState.inning}-${enhancedGameState.outs}`,
          type: 'RUNNERS_1ST_2ND',
          message: `Runners on 1st & 2nd: ${gameState.awayTeam} vs ${gameState.homeTeam}, ${enhancedGameState.outs} outs`,
          context: {
            gameId: gameState.gameId,
            inning: enhancedGameState.inning,
            outs: enhancedGameState.outs
          },
          priority: 80
        });
      }

      // Late Pressure Alert (8th inning or later with close score)
      if (enhancedGameState.inning >= 8) {
        const scoreDiff = Math.abs(enhancedGameState.homeScore - enhancedGameState.awayScore);
        if (scoreDiff <= 3) {
          alerts.push({
            alertKey: `${gameState.gameId}-late-pressure-${enhancedGameState.inning}`,
            type: 'LATE_PRESSURE',
            message: `Late inning pressure: ${gameState.awayTeam} vs ${gameState.homeTeam} (${enhancedGameState.awayScore}-${enhancedGameState.homeScore}) - Inning ${enhancedGameState.inning}`,
            context: {
              gameId: gameState.gameId,
              inning: enhancedGameState.inning,
              scoreDifference: scoreDiff
            },
            priority: 95
          });
        }
      }

      // Full Count Alert (3-2)
      if (enhancedGameState.balls === 3 && enhancedGameState.strikes === 2) {
        alerts.push({
          alertKey: `${gameState.gameId}-full-count-${enhancedGameState.inning}-${enhancedGameState.outs}`,
          type: 'FULL_COUNT',
          message: `Full count (3-2): ${gameState.awayTeam} vs ${gameState.homeTeam}, ${enhancedGameState.outs} outs`,
          context: {
            gameId: gameState.gameId,
            inning: enhancedGameState.inning,
            outs: enhancedGameState.outs,
            balls: enhancedGameState.balls,
            strikes: enhancedGameState.strikes
          },
          priority: 75
        });
      }

    } catch (error) {
      console.error(`Error generating MLB alerts for ${gameState.gameId}:`, error);
    }
    
    return alerts;
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      // Get live data from MLB API if game is live
      if (gameState.isLive && gameState.gameId) {
        const { MLBApiService } = await import('../mlb-api');
        const mlbApi = new MLBApiService();
        const enhancedData = await mlbApi.getEnhancedGameData(gameState.gameId);

        if (enhancedData && !enhancedData.error) {
          return {
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
            awayScore: enhancedData.awayScore || gameState.awayScore
          };
        }
      }
    } catch (error) {
      console.error('Error enhancing game state with live data:', error);
    }

    return gameState;
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'mlb');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Filter to only valid MLB alerts
      const validMLBAlerts = [
        'BASES_LOADED', 'FULL_COUNT', 'RISP', 'CLOSE_GAME', 'LATE_PRESSURE',
        'POWER_HITTER', 'HOT_HITTER', 'RUNNERS_1ST_2ND', 'MLB_GAME_START',
        'MLB_SEVENTH_INNING_STRETCH', 'TEST_ALERT'
      ];

      const mlbEnabledTypes = enabledTypes.filter(alertType =>
        validMLBAlerts.includes(alertType)
      );

      // Check global settings for these MLB alerts
      const globallyEnabledTypes = [];
      for (const alertType of mlbEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
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

  // Initialize alert modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    console.log(`✅ MLB engine initialized with ${enabledAlertTypes.length} alert types: ${enabledAlertTypes.join(', ')}`);
  }
}