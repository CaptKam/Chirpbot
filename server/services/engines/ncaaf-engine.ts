import { BaseSportEngine, GameState, AlertResult } from './base-engine';

const DEBUG = process.env.NODE_ENV !== 'production';

export class NCAAFEngine extends BaseSportEngine {
  private static ncaafApiService: any = null;

  constructor() {
    super('NCAAF', { defaultTimeouts: 3 });
    this.metrics.redZoneDetections = 0;
    this.metrics.fourthDownSituations = 0;
    this.metrics.comebackOpportunities = 0;
  }

  protected getModuleMap(): Record<string, string> {
    return {
      'NCAAF_GAME_START': './alert-cylinders/ncaaf/game-start-module.ts',
      'NCAAF_TWO_MINUTE_WARNING': './alert-cylinders/ncaaf/two-minute-warning-module.ts',
      'NCAAF_RED_ZONE': './alert-cylinders/ncaaf/red-zone-module.ts',
      'NCAAF_FOURTH_DOWN_DECISION': './alert-cylinders/ncaaf/fourth-down-decision-module.ts',
      'NCAAF_UPSET_OPPORTUNITY': './alert-cylinders/ncaaf/upset-opportunity-module.ts',
      'NCAAF_RED_ZONE_EFFICIENCY': './alert-cylinders/ncaaf/red-zone-efficiency-module.ts',
      'NCAAF_COMEBACK_POTENTIAL': './alert-cylinders/ncaaf/comeback-potential-module.ts',
      'NCAAF_MASSIVE_WEATHER': './alert-cylinders/ncaaf/massive-weather-module.ts',
      'NCAAF_SECOND_HALF_KICKOFF': './alert-cylinders/ncaaf/second-half-kickoff-module.ts',
      'NCAAF_CLOSE_GAME': './alert-cylinders/ncaaf/close-game-module.ts',
      'NCAAF_SCORING_PLAY': './alert-cylinders/ncaaf/scoring-play-module.ts',
      'NCAAF_FOURTH_QUARTER': './alert-cylinders/ncaaf/fourth-quarter-module.ts',
      'NCAAF_HALFTIME': './alert-cylinders/ncaaf/halftime-module.ts',
    };
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    if (!gameState.isLive) return 0;

    let p = 50;
    const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore } = gameState;

    const quarterBonus = [0, 15, 10, 12, 20][quarter as number] || 0;
    p += quarterBonus;

    if (timeRemaining) {
      const secs = this.parseTimeToSeconds(timeRemaining);
      if (secs <= 120 && (quarter === 2 || quarter === 4)) p += 25;
      else if (secs <= 300) p += 15;
    }

    if (down && yardsToGo) {
      const downBonus = [0, 12, 8, 5, 30][down as number] || 0;
      p += downBonus;
      if ((yardsToGo as number) <= 3) p += 10;
      if (down === 4 && fieldPosition !== undefined && (fieldPosition as number) <= 20) p += 15;
    }

    if (fieldPosition !== undefined) {
      if ((fieldPosition as number) <= 20) p += 25;
      else if ((fieldPosition as number) <= 40) p += 12;
    }

    if (homeScore !== undefined && awayScore !== undefined) {
      const scoreDiff = Math.abs(homeScore - awayScore);
      if (scoreDiff <= 3) p += 25;
      else if (scoreDiff <= 7) p += 18;
      else if (scoreDiff <= 14) p += 10;
      else if (scoreDiff <= 21) p += 5;
    }

    return Math.min(Math.max(p, 10), 95);
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    if (!gameState.gameId) return [];

    try {
      const enhanced = await this.enhanceGameStateWithLiveData(gameState);
      const rawAlerts = await super.generateLiveAlerts(enhanced);

      const fieldPos = enhanced.fieldPosition ?? 50;
      if ((fieldPos as number) <= 20) this.incrementMetric('redZoneDetections');
      if (enhanced.down === 4) this.incrementMetric('fourthDownSituations');
      if (enhanced.homeScore !== undefined && enhanced.awayScore !== undefined) {
        const scoreDiff = Math.abs(enhanced.homeScore - enhanced.awayScore);
        if (scoreDiff <= 14 && ((enhanced.quarter as number) ?? 1) >= 3) this.incrementMetric('comebackOpportunities');
      }

      this.incrementMetric('totalAlerts', rawAlerts.length);
      this.incrementMetric('totalRequests');
      return rawAlerts;
    } catch {
      return [];
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive || !gameState.gameId) return gameState;

      if (!NCAAFEngine.ncaafApiService) {
        const { NCAAFApiService } = await import('../ncaaf-api');
        NCAAFEngine.ncaafApiService = new NCAAFApiService();
      }

      const enhancedData = await NCAAFEngine.ncaafApiService.getEnhancedGameData?.(gameState.gameId);
      if (!enhancedData || enhancedData.error || !this.isEnhancedDataMeaningful(enhancedData, gameState)) {
        this.incrementMetric('cacheMisses');
        return gameState;
      }

      this.incrementMetric('cacheHits');

      await this.updateTimeoutsFromESPN(gameState.gameId, gameState.homeTeam as string, gameState.awayTeam as string, enhancedData.homeTimeoutsRemaining, enhancedData.awayTimeoutsRemaining, enhancedData.quarter);
      const timeoutStats = this.getTimeoutStats(gameState.gameId);

      if (enhancedData.possessionSide) {
        this.trackPossessionChange(gameState.gameId, gameState.homeTeam as string, gameState.awayTeam as string, enhancedData.possessionSide, enhancedData.quarter, enhancedData.fieldPosition);
      }

      return {
        ...gameState,
        quarter: this.pickEnhanced(enhancedData.quarter, gameState.quarter, 1),
        timeRemaining: this.pickEnhanced(enhancedData.timeRemaining, gameState.timeRemaining, '15:00'),
        down: enhancedData.down ?? gameState.down,
        yardsToGo: enhancedData.yardsToGo ?? gameState.yardsToGo,
        fieldPosition: enhancedData.fieldPosition ?? gameState.fieldPosition,
        possession: enhancedData.possession ?? gameState.possession,
        homeScore: this.pickScore(enhancedData.homeScore, gameState.homeScore),
        awayScore: this.pickScore(enhancedData.awayScore, gameState.awayScore),
        homeRank: enhancedData.homeRank ?? (gameState.homeRank || 0),
        awayRank: enhancedData.awayRank ?? (gameState.awayRank || 0),
        homeTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.homeTimeoutsRemaining : null,
        awayTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.awayTimeoutsRemaining : null,
      };
    } catch {
      return gameState;
    } finally {
      this.pushMetric('gameStateEnhancementTime', Date.now() - t0);
    }
  }

  private isEnhancedDataMeaningful(enhancedData: any, gameState: GameState): boolean {
    if (enhancedData.quarter === 1 && enhancedData.timeRemaining === '15:00' &&
        enhancedData.homeScore === 0 && enhancedData.awayScore === 0 &&
        (gameState.quarter !== 1 || gameState.timeRemaining !== '15:00' ||
         gameState.homeScore !== 0 || gameState.awayScore !== 0)) {
      return false;
    }
    return true;
  }

  private pickEnhanced<T>(enhanced: T | undefined, original: T | undefined, stubDefault: T): T | undefined {
    if (enhanced === stubDefault && original !== undefined && original !== stubDefault) return original;
    return enhanced !== undefined && enhanced !== stubDefault ? enhanced : original;
  }

  private pickScore(enhanced: number | undefined, original: number): number {
    if (enhanced === 0 && original > 0) return original;
    return enhanced !== undefined ? enhanced : original;
  }

  async processMultipleGames(gameStates: GameState[]): Promise<AlertResult[]> {
    const results = await Promise.all(
      gameStates.map(gs => this.generateLiveAlerts(gs).catch(() => [] as AlertResult[]))
    );
    return results.flat();
  }

  protected getSportSpecificMetrics() {
    return {
      redZoneDetections: this.metrics.redZoneDetections,
      fourthDownSituations: this.metrics.fourthDownSituations,
      comebackOpportunities: this.metrics.comebackOpportunities,
      collegeFootballAlerts: this.metrics.totalAlerts,
    };
  }
}
