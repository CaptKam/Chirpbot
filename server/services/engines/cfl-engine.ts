import { BaseSportEngine, GameState, AlertResult } from './base-engine';

const DEBUG = process.env.NODE_ENV !== 'production';

export class CFLEngine extends BaseSportEngine {
  constructor() {
    super('CFL', { defaultTimeouts: 1 }); // CFL: 1 timeout per half
    this.metrics.thirdDownSituations = 0;
    this.metrics.rougeOpportunities = 0;
    this.metrics.overtimeAlerts = 0;
  }

  protected getModuleMap(): Record<string, string> {
    return {
      'CFL_GAME_START': './alert-cylinders/cfl/game-start-module.ts',
      'CFL_TWO_MINUTE_WARNING': './alert-cylinders/cfl/two-minute-warning-module.ts',
      'CFL_FOURTH_QUARTER': './alert-cylinders/cfl/fourth-quarter-module.ts',
      'CFL_FINAL_MINUTES': './alert-cylinders/cfl/final-minutes-module.ts',
      'CFL_GREY_CUP_IMPLICATIONS': './alert-cylinders/cfl/grey-cup-implications-module.ts',
      'CFL_THIRD_DOWN_SITUATION': './alert-cylinders/cfl/third-down-situation-module.ts',
      'CFL_ROUGE_OPPORTUNITY': './alert-cylinders/cfl/rouge-opportunity-module.ts',
      'CFL_OVERTIME': './alert-cylinders/cfl/overtime-module.ts',
      'CFL_MASSIVE_WEATHER': './alert-cylinders/cfl/massive-weather-module.ts',
    };
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive) return 0;

      let p = 50;
      const { quarter, timeRemaining, down, yardsToGo, fieldPosition, homeScore, awayScore } = gameState;

      if (quarter === 1) p += 10;
      else if (quarter === 2) p += 12;
      else if (quarter === 3) p += 14;
      else if (quarter === 4) p += 20;
      else if ((quarter as number) >= 5) p += 30;

      if (timeRemaining) {
        const secs = this.parseTimeToSeconds(timeRemaining);
        if (secs <= 60 && (quarter as number) >= 4) p += 25;
        else if (secs <= 120 && (quarter as number) >= 4) p += 18;
        else if (secs <= 180 && (quarter as number) >= 4) p += 12;
        if (secs % 20 <= 3 && (quarter as number) >= 3) p += 8;
      }

      // CFL 3-down system
      if (down && yardsToGo !== undefined) {
        if (down === 1) p += 15;
        else if (down === 2) p += 8;
        else if (down === 3) p += 25;

        if ((yardsToGo as number) <= 1) p += 20;
        else if ((yardsToGo as number) <= 3) p += 12;
        else if ((yardsToGo as number) <= 10) p += 5;
        else if ((yardsToGo as number) >= 15) p -= 5;
      }

      // CFL 110-yard field
      if (fieldPosition !== undefined) {
        if ((fieldPosition as number) <= 20) p += 25;
        else if ((fieldPosition as number) <= 35) p += 15;
        else if ((fieldPosition as number) <= 55) p += 5;
        if ((fieldPosition as number) <= 45 && down === 3) p += 10; // Rouge potential
      }

      if (homeScore !== undefined && awayScore !== undefined) {
        const scoreDiff = Math.abs(homeScore - awayScore);
        if (scoreDiff <= 3) p += 25;
        else if (scoreDiff <= 7) p += 18;
        else if (scoreDiff <= 14) p += 12;
        else if (scoreDiff <= 21) p += 8;
        else if (scoreDiff >= 28) p -= 10;

        const totalScore = homeScore + awayScore;
        if (totalScore >= 60 && (quarter as number) >= 3) p += 15;
        else if (totalScore >= 45 && (quarter as number) >= 3) p += 10;
        else if (totalScore <= 30 && (quarter as number) >= 3) p += 8;

        if ((quarter as number) >= 4) {
          if (scoreDiff <= 7) p += 20;
          if (scoreDiff <= 3) p += 10;
        }
      }

      if ((quarter as number) >= 5) p += 15;

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

      if (enhanced.quarter && (enhanced.quarter as number) >= 4) this.incrementMetric('overtimeAlerts');
      if (enhanced.down === 3) this.incrementMetric('thirdDownSituations');
      if (enhanced.fieldPosition && (enhanced.fieldPosition as number) <= 45 && enhanced.down === 3) {
        this.incrementMetric('rougeOpportunities');
      }
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

      const { CFLApiService } = await import('../cfl-api');
      const cflApi = new CFLApiService();
      const enhancedData = await cflApi.getEnhancedGameData(gameState.gameId);

      if (!enhancedData || enhancedData.error) {
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
        quarter: enhancedData.quarter || gameState.quarter || 1,
        timeRemaining: enhancedData.timeRemaining || gameState.timeRemaining,
        down: enhancedData.down || gameState.down,
        yardsToGo: enhancedData.yardsToGo || gameState.yardsToGo,
        fieldPosition: enhancedData.fieldPosition || gameState.fieldPosition,
        homeScore: enhancedData.homeScore || gameState.homeScore,
        awayScore: enhancedData.awayScore || gameState.awayScore,
        possession: enhancedData.possession || gameState.possession,
        possessionSide: enhancedData.possessionSide || null,
        homeTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.homeTimeoutsRemaining : null,
        awayTimeoutsRemaining: timeoutStats.tracked ? timeoutStats.awayTimeoutsRemaining : null,
        isLive: gameState.status === 'final' ? false : gameState.isLive,
      };
    } catch (error) {
      console.error('[CFL] enhance failed:', error);
      this.incrementMetric('cacheMisses');
      return gameState;
    } finally {
      this.pushMetric('gameStateEnhancementTime', Date.now() - t0);
    }
  }

  protected getSportSpecificMetrics() {
    return {
      thirdDownSituations: this.metrics.thirdDownSituations,
      rougeOpportunities: this.metrics.rougeOpportunities,
      overtimeAlerts: this.metrics.overtimeAlerts,
    };
  }
}
