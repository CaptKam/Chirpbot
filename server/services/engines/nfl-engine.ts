import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { weatherService } from '../weather-service';

const DEBUG = process.env.NODE_ENV !== 'production';

export class NFLEngine extends BaseSportEngine {
  constructor() {
    super('NFL', { defaultTimeouts: 3 });
    // Sport-specific metric counters
    this.metrics.redZoneOpportunities = 0;
    this.metrics.fourthDownSituations = 0;
    this.metrics.twoMinuteWarnings = 0;
  }

  protected getModuleMap(): Record<string, string> {
    return {
      'NFL_GAME_START': './alert-cylinders/nfl/game-start-module.ts',
      'NFL_SECOND_HALF_KICKOFF': './alert-cylinders/nfl/second-half-kickoff-module.ts',
      'NFL_TWO_MINUTE_WARNING': './alert-cylinders/nfl/two-minute-warning-module.ts',
      'NFL_RED_ZONE': './alert-cylinders/nfl/red-zone-module.ts',
      'NFL_FOURTH_DOWN': './alert-cylinders/nfl/fourth-down-module.ts',
      'NFL_RED_ZONE_OPPORTUNITY': './alert-cylinders/nfl/red-zone-opportunity-module.ts',
      'NFL_TURNOVER_LIKELIHOOD': './alert-cylinders/nfl/turnover-likelihood-module.ts',
      'NFL_MASSIVE_WEATHER': './alert-cylinders/nfl/massive-weather-module.ts',
      'NFL_AI_SCANNER': './alert-cylinders/nfl/ai-scanner-module.ts',
    };
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive) return 0;

      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore, weather } = gameState;
      let p = 50;

      if (quarter === 1) p += 10;
      else if (quarter === 3) p += 8;
      else if (quarter === 4) p += 15;

      if (down === 1) p += 15;
      else if (down === 2) p += 5;
      else if (down === 3) p -= 5;
      else if (down === 4) p += 25;

      if (fieldPosition && (fieldPosition as number) <= 20) {
        p += 20;
        if (down === 4) p += 10;
      } else if (fieldPosition && (fieldPosition as number) <= 40) {
        p += 10;
      }

      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) p += 20;
        else if (scoreDiff <= 7) p += 10;
        else if (scoreDiff <= 14) p += 5;
      }

      const secs = this.parseTimeToSeconds(timeRemaining as string);
      if (secs <= 120) {
        p += 20;
        if (quarter === 4) p += 10;
      }

      if (yardsToGo && (yardsToGo as number) <= 3) p += 10;

      if (weather && (weather as any).isOutdoorStadium) {
        const impact = (weather as any).impact;
        if (impact?.weatherAlert) {
          p += 15;
          if (impact.fieldGoalDifficulty === 'extreme') p += 10;
          if (impact.passingConditions === 'dangerous') p += 8;
          if (down === 4 && impact.fieldGoalDifficulty !== 'low') p += 5;
        }
        if (fieldPosition && (fieldPosition as number) <= 20 && impact?.fieldGoalDifficulty === 'high') p += 5;
      }

      return Math.min(Math.max(p, 10), 95);
    } finally {
      this.pushMetric('probabilityCalculationTime', Date.now() - t0);
      this.incrementMetric('totalRequests');
    }
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const t0 = Date.now();
    try {
      if (!gameState.gameId) return [];

      const enhanced = await this.enhanceGameStateWithLiveData(gameState);
      const rawAlerts = await super.generateLiveAlerts(enhanced);

      // Track sport-specific metrics
      if (enhanced.fieldPosition && (enhanced.fieldPosition as number) <= 20) {
        this.incrementMetric('redZoneOpportunities');
      }
      if (enhanced.down === 4) this.incrementMetric('fourthDownSituations');
      const secs = this.parseTimeToSeconds((enhanced.timeRemaining as string) || '');
      if (secs <= 120 && (enhanced.quarter as number) >= 4) this.incrementMetric('twoMinuteWarnings');

      this.incrementMetric('totalAlerts', rawAlerts.length);
      return rawAlerts;
    } finally {
      this.pushMetric('alertGenerationTime', Date.now() - t0);
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const t0 = Date.now();
    try {
      if (!gameState.gameId || gameState.status === 'final') return gameState;

      const { NFLApiService } = await import('../nfl-api');
      const nflApi = new NFLApiService();
      const enhancedData = await nflApi.getEnhancedGameData(gameState.gameId);

      if (!enhancedData || enhancedData.error) {
        this.incrementMetric('cacheMisses');
        return gameState;
      }

      this.incrementMetric('cacheHits');

      // Weather
      let weatherContext = gameState.weatherContext;
      try {
        const homeTeamName = this.getTeamNameString(gameState.homeTeam);
        const weatherData = await weatherService.getWeatherForTeam(homeTeamName);
        const weatherImpact = weatherService.getNFLWeatherImpact(weatherData);
        if (weatherImpact.weatherAlert || weatherImpact.fieldGoalDifficulty !== 'low') {
          weatherContext = {
            data: weatherData, impact: weatherImpact,
            fieldGoalFactor: weatherService.calculateFieldGoalWeatherFactor(weatherData),
            passingFactor: weatherService.calculatePassingWeatherFactor(weatherData),
            runningFactor: weatherService.calculateRunningWeatherFactor(weatherData),
            isOutdoorStadium: !this.isIndoorStadium(homeTeamName)
          };
        }
      } catch { /* weather unavailable */ }

      // Possession & timeouts
      this.trackPossessionChange(gameState.gameId, gameState.homeTeam as string, gameState.awayTeam as string, enhancedData.possessionSide, enhancedData.quarter, enhancedData.fieldPosition);
      await this.updateTimeoutsFromESPN(gameState.gameId, gameState.homeTeam as string, gameState.awayTeam as string, enhancedData.homeTimeoutsRemaining, enhancedData.awayTimeoutsRemaining, enhancedData.quarter);
      const timeoutStats = this.getTimeoutStats(gameState.gameId);

      return {
        ...gameState,
        quarter: enhancedData.quarter || gameState.quarter || 1,
        timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
        down: enhancedData.down ?? gameState.down ?? null,
        yardsToGo: enhancedData.yardsToGo ?? gameState.yardsToGo ?? null,
        fieldPosition: enhancedData.fieldPosition ?? gameState.fieldPosition ?? null,
        possession: enhancedData.possession ?? gameState.possession ?? null,
        possessionSide: enhancedData.possessionSide ?? null,
        possessionTeamAbbrev: enhancedData.possessionTeamAbbrev ?? null,
        possessionTeamName: enhancedData.possessionTeamName ?? null,
        homeScore: enhancedData.homeScore || gameState.homeScore,
        awayScore: enhancedData.awayScore || gameState.awayScore,
        homeTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.homeTimeoutsRemaining : null,
        awayTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.awayTimeoutsRemaining : null,
        weatherContext, weather: weatherContext,
        isLive: gameState.status === 'final' ? false : gameState.isLive
      };
    } catch (error) {
      console.error('[NFL] enhance failed:', error);
      this.incrementMetric('cacheMisses');
      return gameState;
    } finally {
      this.pushMetric('gameStateEnhancementTime', Date.now() - t0);
    }
  }

  private isIndoorStadium(teamName: string): boolean {
    const indoor = ['Detroit Lions', 'Minnesota Vikings', 'New Orleans Saints', 'Las Vegas Raiders'];
    return indoor.includes(teamName);
  }

  protected getSportSpecificMetrics() {
    return {
      redZoneOpportunities: this.metrics.redZoneOpportunities,
      fourthDownSituations: this.metrics.fourthDownSituations,
      twoMinuteWarnings: this.metrics.twoMinuteWarnings,
      possessionTracking: { gamesTracked: this.getAllPossessionStats().length, allStats: this.getAllPossessionStats() },
    };
  }
}
