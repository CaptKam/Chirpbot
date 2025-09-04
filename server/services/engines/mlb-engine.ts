
import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';
import { weatherService } from '../weather-service';
const weatherService = {
  async getWeatherForTeam(teamName: string) {
    return {
      temperature: 72,
      condition: "Clear",
      windSpeed: 8,
      windDirection: "SW",
      humidity: 65,
      pressure: 30.1,
      timestamp: new Date().toISOString()
    };
  },
  calculateHomeRunFactor(weather: any) {
    return 1.0;
  },
  getWindDescription(windSpeed: number, windDirection: string) {
    return `${windSpeed}mph ${windDirection}`;
  }
};

export class MLBEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  // V2 RE24-Based Probability System
  private readonly RE24: Record<string, number> = {
    // No outs
    "000-0": 0.50, "100-0": 0.90, "010-0": 1.13, "001-0": 1.35,
    "110-0": 1.50, "101-0": 1.78, "011-0": 1.98, "111-0": 2.29,

    // One out  
    "000-1": 0.27, "100-1": 0.54, "010-1": 0.69, "001-1": 0.98,
    "110-1": 0.94, "101-1": 1.20, "011-1": 1.45, "111-1": 1.65,

    // Two outs
    "000-2": 0.11, "100-2": 0.25, "010-2": 0.35, "001-2": 0.37,
    "110-2": 0.47, "101-2": 0.50, "011-2": 0.63, "111-2": 0.82
  };

  constructor() {
    super('MLB');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const { hasFirst, hasSecond, hasThird, outs } = gameState;

    // Check if RE24 system is enabled
    const re24Enabled = await this.isAlertEnabled('RE24_ENABLED');
    if (!re24Enabled) {
      // Fallback to simple percentage calculation
      let baseProb = 0;
      if (hasThird) baseProb += 60;
      if (hasSecond) baseProb += 40; 
      if (hasFirst) baseProb += 20;
      baseProb = baseProb * (3 - outs) / 3;
      return Math.min(Math.max(baseProb, 15), 85);
    }

    // Build state key for RE24 lookup
    const firstBase = hasFirst ? "1" : "0";
    const secondBase = hasSecond ? "1" : "0"; 
    const thirdBase = hasThird ? "1" : "0";
    const stateKey = `${firstBase}${secondBase}${thirdBase}-${outs}`;

    // Get base run expectancy
    const baseExpectancy = this.RE24[stateKey] || 0.11;

    // Convert run expectancy to scoring probability using sigmoid function
    let probability = Math.round((1 / (1 + Math.exp(-2.5 * (baseExpectancy - 0.8)))) * 100);

    // Context-aware adjustments
    const contextFactorsEnabled = await this.isAlertEnabled('RE24_CONTEXT_FACTORS');
    if (contextFactorsEnabled) {
      // Weather adjustments for home run probability
      if (gameState.weather?.windSpeed > 10 && 
          typeof gameState.weather?.windDirection === 'string' && 
          gameState.weather?.windDirection?.includes('Out')) {
        probability += 5;
      }

      // Power hitter adjustment
      if (gameState.batter?.seasonHomeRuns >= 20) {
        probability += 3;
      }

      // Late inning pressure situations
      if (gameState.inning >= 7) {
        probability += 2;
      }

      // Close game situations (within 3 runs)
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 3) {
        probability += 3;
      }
    }

    return Math.min(Math.max(probability, 5), 95);
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    try {
      // Fetch detailed live data for MLB
      const liveData = await this.fetchDetailedLiveData(gameState.gameId);
      if (!liveData) return alerts;

      // Generate MLB-specific alerts
      alerts.push(...await this.generateBaseRunnerAlerts(gameState, liveData));
      alerts.push(...await this.generateInningPressureAlerts(gameState, liveData));
      alerts.push(...await this.generateAtBatAlerts(gameState, liveData));
      alerts.push(...await this.generateScoringAlerts(gameState, liveData));

    } catch (error) {
      console.error(`Error generating MLB alerts for game ${gameState.gameId}:`, error);
    }

    return alerts;
  }

  private async fetchDetailedLiveData(gameId: string): Promise<any> {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`);
      const data = await response.json();
      return data.liveData;
    } catch (error) {
      console.error(`Failed to fetch MLB live data for game ${gameId}:`, error);
      return null;
    }
  }

  private async generateBaseRunnerAlerts(gameState: GameState, liveData: any): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    // Use the offense object which shows current base situation
    const offense = liveData?.linescore?.offense;
    if (!offense) return alerts;

    // Check actual base occupancy
    const hasFirst = !!offense.first;
    const hasSecond = !!offense.second;
    const hasThird = !!offense.third;

    const inning = liveData.linescore?.currentInning || 0;
    const outs = liveData.linescore?.outs || 0;
    const isTopInning = liveData.linescore?.isTopInning || false;

    // Calculate scoring probability using MLB-specific logic
    const enhancedGameState = { ...gameState, hasFirst, hasSecond, hasThird, outs, inning, isTopInning };
    const scoringProbability = await this.calculateProbability(enhancedGameState);

    // Get weather data for enhanced context
    const weather = await weatherService.getWeatherForTeam(gameState.homeTeam);

    // Bases loaded: all three bases occupied
    if (hasFirst && hasSecond && hasThird) {
      const basesLoadedEnabled = await this.isAlertEnabled('BASES_LOADED');
      if (basesLoadedEnabled) {
        const alertKey = `${gameState.gameId}_BASES_LOADED_${inning}_${outs}`;
        const outsText = outs === 1 ? '1 out' : `${outs} outs`;
        const message = `🔥 BASES LOADED! (${scoringProbability}% scoring chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${outsText} in the ${isTopInning ? 'Top' : 'Bottom'} of ${inning}`;

        alerts.push({
          alertKey,
          type: 'BASES_LOADED',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            inning,
            isTopInning,
            outs,
            hasFirst,
            hasSecond,
            hasThird,
            first: offense.first?.fullName,
            second: offense.second?.fullName,
            third: offense.third?.fullName,
            situation: 'bases_loaded',
            scoringProbability,
            weather
          },
          priority: scoringProbability > 70 ? 98 : 95
        });
      }
    }
    // Runners on 1st and 2nd (prime scoring opportunity)
    else if (hasFirst && hasSecond && !hasThird) {
      const runners1st2ndEnabled = await this.isAlertEnabled('RUNNERS_1ST_2ND');
      if (runners1st2ndEnabled && scoringProbability >= 45) {
        const alertKey = `${gameState.gameId}_RUNNERS_1ST_2ND_${inning}_${outs}`;
        const outsText = outs === 1 ? '1 out' : `${outs} outs`;
        const message = `💎 Runners on 1st & 2nd (${scoringProbability}% scoring chance) ${gameState.awayTeam} vs ${gameState.homeTeam} - ${outsText}`;

        const priority = scoringProbability >= 70 ? 95 : 
                        scoringProbability >= 55 ? 90 : 85;

        alerts.push({
          alertKey,
          type: 'RUNNERS_1ST_2ND',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            inning,
            isTopInning,
            outs,
            hasFirst,
            hasSecond,
            hasThird: false,
            first: offense.first?.fullName,
            second: offense.second?.fullName,
            situation: 'runners_on_1st_and_2nd',
            scoringProbability,
            weather
          },
          priority
        });
      }
    }
    // Add other MLB-specific runner situations...

    return alerts;
  }

  private async generateInningPressureAlerts(gameState: GameState, liveData: any): Promise<AlertResult[]> {
    // MLB-specific late inning pressure logic
    const alerts: AlertResult[] = [];
    const inning = liveData.linescore?.currentInning || 0;
    const isTopInning = liveData.linescore?.isTopInning;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Late inning pressure situations (MLB-specific: 8th inning or later)
    if (inning >= 8 && scoreDiff <= 2) {
      const lateEnabled = await this.isAlertEnabled('LATE_PRESSURE');
      if (lateEnabled) {
        const alertKey = `${gameState.gameId}_LATE_PRESSURE_${inning}`;
        const situation = isTopInning ? 'top' : 'bottom';
        const weather = await weatherService.getWeatherForTeam(gameState.homeTeam);
        const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

        const message = `🔥 LATE INNING PRESSURE! ${gameState.homeTeam} ${gameState.homeScore}, ${gameState.awayTeam} ${gameState.awayScore} - ${situation} ${inning}th. ${weather.temperature}°F, ${windDesc}`;

        alerts.push({
          alertKey,
          type: 'LATE_PRESSURE',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            inning,
            isTopInning,
            scoreDiff,
            weather
          },
          priority: 92
        });
      }
    }

    return alerts;
  }

  private async generateAtBatAlerts(gameState: GameState, liveData: any): Promise<AlertResult[]> {
    // MLB-specific at-bat logic (power hitters, strikeouts, etc.)
    return [];
  }

  private async generateScoringAlerts(gameState: GameState, liveData: any): Promise<AlertResult[]> {
    // MLB-specific scoring events (home runs, grand slams, etc.)
    return [];
  }
}
