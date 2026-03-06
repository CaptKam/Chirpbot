import { BaseSportEngine, GameState, AlertResult } from './base-engine';

const DEBUG = process.env.NODE_ENV !== 'production';

export class WNBAEngine extends BaseSportEngine {
  constructor() {
    super('WNBA');
    this.metrics.clutchTimeDetections = 0;
    this.metrics.overtimeAlerts = 0;
    this.metrics.closeGameSituations = 0;
  }

  protected getModuleMap(): Record<string, string> {
    return {
      'WNBA_GAME_START': './alert-cylinders/wnba/game-start-module.ts',
      'WNBA_TWO_MINUTE_WARNING': './alert-cylinders/wnba/two-minute-warning-module.ts',
      'WNBA_FINAL_MINUTES': './alert-cylinders/wnba/final-minutes-module.ts',
      'WNBA_HIGH_SCORING_QUARTER': './alert-cylinders/wnba/high-scoring-quarter-module.ts',
      'WNBA_LOW_SCORING_QUARTER': './alert-cylinders/wnba/low-scoring-quarter-module.ts',
      'WNBA_FOURTH_QUARTER': './alert-cylinders/wnba/fourth-quarter-module.ts',
      'WNBA_CLUTCH_TIME_OPPORTUNITY': './alert-cylinders/wnba/clutch-time-opportunity-module.ts',
      'WNBA_COMEBACK_POTENTIAL': './alert-cylinders/wnba/comeback-potential-module.ts',
      'WNBA_CRUNCH_TIME_DEFENSE': './alert-cylinders/wnba/crunch-time-defense-module.ts',
      'WNBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/wnba/wnba-championship-implications-module.ts',
    };
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive) return 0;

      let p = 50;
      const { quarter, timeRemaining, homeScore, awayScore, possession } = gameState;

      if (quarter === 1) p += 10;
      else if (quarter === 2) p += 12;
      else if (quarter === 3) p += 14;
      else if (quarter === 4) p += 20;
      else if ((quarter as number) >= 5) p += 30;

      if (timeRemaining) {
        const secs = this.parseTimeToSeconds(timeRemaining);
        if (secs <= 60 && (quarter as number) >= 4) p += 25;
        else if (secs <= 120 && (quarter as number) >= 4) p += 18;
        else if (secs <= 300 && (quarter as number) >= 4) p += 12;
        if (secs % 24 <= 5 && (quarter as number) >= 3) p += 8;
      }

      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 2) p += 25;
        else if (scoreDiff <= 5) p += 18;
        else if (scoreDiff <= 10) p += 10;
        else if (scoreDiff <= 15) p += 5;
        else if (scoreDiff >= 20) p -= 15;

        const totalScore = homeScore + awayScore;
        if (totalScore >= 160 && (quarter as number) >= 3) p += 12;
        else if (totalScore >= 140 && (quarter as number) >= 3) p += 8;
        else if (totalScore <= 120 && (quarter as number) >= 3) p += 6;

        if ((quarter as number) >= 4 && scoreDiff <= 8) p += 15;
      }

      if (possession && (quarter as number) >= 3) p += 3;

      return Math.min(Math.max(p, 10), 95);
    } finally {
      this.pushMetric('probabilityCalculationTime', Date.now() - t0);
    }
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const t0 = Date.now();
    try {
      if (!gameState.gameId) return [];

      const enhanced = await this.enhanceGameStateWithLiveData(gameState);
      const rawAlerts = await super.generateLiveAlerts(enhanced);

      if ((enhanced.quarter as number) >= 4) this.incrementMetric('clutchTimeDetections');
      if ((enhanced.quarter as number) >= 5) this.incrementMetric('overtimeAlerts');
      if (enhanced.homeScore !== undefined && enhanced.awayScore !== undefined) {
        const scoreDiff = Math.abs(enhanced.homeScore - enhanced.awayScore);
        if (scoreDiff <= 5 && (enhanced.quarter as number) >= 4) this.incrementMetric('closeGameSituations');
      }

      this.incrementMetric('totalAlerts', rawAlerts.length);
      return rawAlerts;
    } finally {
      this.pushMetric('alertGenerationTime', Date.now() - t0);
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    try {
      if (!gameState.isLive || !gameState.gameId) return gameState;

      const { WNBAApiService } = await import('../wnba-api');
      const wnbaApi = new WNBAApiService();
      const enhancedData = await wnbaApi.getEnhancedGameData(gameState.gameId);

      if (!enhancedData || enhancedData.error) return gameState;

      return {
        ...gameState,
        quarter: enhancedData.quarter || gameState.quarter || 1,
        timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining || '',
        possession: enhancedData.possession || null,
        homeScore: enhancedData.homeScore || gameState.homeScore,
        awayScore: enhancedData.awayScore || gameState.awayScore,
        period: enhancedData.period || enhancedData.quarter || gameState.quarter || 1,
        clock: enhancedData.clock || enhancedData.timeRemaining || gameState.timeRemaining || '',
        situation: enhancedData.situation || {},
      };
    } catch (error) {
      console.error('[WNBA] enhance failed:', error);
      return gameState;
    }
  }

  protected getSportSpecificMetrics() {
    return {
      clutchTimeDetections: this.metrics.clutchTimeDetections,
      overtimeAlerts: this.metrics.overtimeAlerts,
      closeGameSituations: this.metrics.closeGameSituations,
    };
  }
}
