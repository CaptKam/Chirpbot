import { BaseSportEngine, GameState, AlertResult } from './base-engine';

const DEBUG = process.env.NODE_ENV !== 'production';

type EnhancedNBA = {
  quarter?: number;
  timeRemaining?: string;
  possession?: string;
  homeScore?: number;
  awayScore?: number;
  period?: number;
  clock?: string;
  shotClock?: number;
  situation?: Record<string, unknown>;
  starPlayerStats?: Record<string, unknown>;
};

export class NBAEngine extends BaseSportEngine {
  private static nbaApiService: { getEnhancedGameData?: (gameId: string) => Promise<EnhancedNBA & { error?: any }> } | null = null;

  constructor() {
    super('NBA');
  }

  protected getModuleMap(): Record<string, string> {
    return {
      'NBA_GAME_START': './alert-cylinders/nba/game-start-module.ts',
      'NBA_FOURTH_QUARTER': './alert-cylinders/nba/fourth-quarter-module.ts',
      'NBA_FINAL_MINUTES': './alert-cylinders/nba/final-minutes-module.ts',
      'NBA_TWO_MINUTE_WARNING': './alert-cylinders/nba/two-minute-warning-module.ts',
      'NBA_OVERTIME': './alert-cylinders/nba/overtime-module.ts',
      'NBA_CLUTCH_PERFORMANCE': './alert-cylinders/nba/clutch-performance-module.ts',
      'NBA_CHAMPIONSHIP_IMPLICATIONS': './alert-cylinders/nba/championship-implications-module.ts',
      'NBA_SUPERSTAR_ANALYTICS': './alert-cylinders/nba/superstar-analytics-module.ts',
      'NBA_PLAYOFF_INTENSITY': './alert-cylinders/nba/playoff-intensity-module.ts',
    };
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    const t0 = Date.now();
    try {
      if (!gameState?.isLive) return 0;

      let p = 50;
      const quarter = Number(gameState.quarter ?? 0);
      const timeRemaining = String(gameState.timeRemaining ?? '');
      const homeScore = Number(gameState.homeScore ?? 0);
      const awayScore = Number(gameState.awayScore ?? 0);
      const totalScore = homeScore + awayScore;

      // Quarter weighting
      if (quarter === 1) p += 10;
      else if (quarter === 2) p += 12;
      else if (quarter === 3) p += 14;
      else if (quarter === 4) p += 20;
      else if (quarter >= 5) p += 30;

      // Time pressure
      const secs = this.parseTimeToSeconds(timeRemaining);
      if (quarter >= 4) {
        if (secs <= 60) p += 25;
        else if (secs <= 120) p += 18;
        else if (secs <= 300) p += 12;
      }
      if (quarter >= 3 && secs % 24 <= 5) p += 8;

      // Score pressure
      const diff = Math.abs(homeScore - awayScore);
      if (diff <= 3) p += 25;
      else if (diff <= 6) p += 18;
      else if (diff <= 10) p += 12;
      else if (diff <= 15) p += 8;
      else if (diff >= 20) p -= 10;

      // Pace
      if (quarter >= 3) {
        if (totalScore >= 220) p += 15;
        else if (totalScore >= 200) p += 10;
        else if (totalScore <= 180) p += 8;
      }

      if (quarter >= 3 && gameState.possession) p += 5;

      return Math.max(10, Math.min(95, Math.round(p)));
    } finally {
      this.pushMetric('probabilityCalculationTime', Date.now() - t0);
    }
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const t0 = Date.now();
    try {
      if (!gameState?.gameId || !gameState.isLive) return [];

      const threshold = 70;
      const preProb = await this.calculateProbability(gameState);
      if (preProb < threshold) return [];

      const enhanced = await this.enhanceGameStateWithLiveData(gameState);
      const alerts = await super.generateLiveAlerts(enhanced);

      this.incrementMetric('totalAlerts', alerts.length);
      return alerts;
    } finally {
      this.pushMetric('alertGenerationTime', Date.now() - t0);
    }
  }

  private async enhanceGameStateWithLiveData(gameState: GameState): Promise<GameState> {
    const t0 = Date.now();
    try {
      if (!gameState.isLive || !gameState.gameId) return gameState;

      if (!NBAEngine.nbaApiService) {
        const { NBAApiService } = await import('../nba-api');
        NBAEngine.nbaApiService = new NBAApiService();
      }

      const enhanced = await NBAEngine.nbaApiService.getEnhancedGameData?.(gameState.gameId).catch(() => null);
      if (!enhanced || 'error' in enhanced) {
        this.incrementMetric('cacheMisses');
        return gameState;
      }

      this.incrementMetric('cacheHits');
      return {
        ...gameState,
        quarter: enhanced.quarter ?? gameState.quarter,
        timeRemaining: enhanced.timeRemaining ?? gameState.timeRemaining,
        possession: enhanced.possession ?? gameState.possession,
        homeScore: typeof enhanced.homeScore === 'number' && enhanced.homeScore >= 0 ? enhanced.homeScore : gameState.homeScore,
        awayScore: typeof enhanced.awayScore === 'number' && enhanced.awayScore >= 0 ? enhanced.awayScore : gameState.awayScore,
        period: enhanced.period ?? (gameState as any).period ?? gameState.quarter,
        clock: enhanced.clock ?? (gameState as any).clock ?? gameState.timeRemaining,
        shotClock: enhanced.shotClock ?? (gameState as any).shotClock ?? 24,
        situation: enhanced.situation ?? (gameState as any).situation ?? {},
        starPlayerStats: enhanced.starPlayerStats ?? (gameState as any).starPlayerStats ?? {},
      };
    } catch (err) {
      console.error(`[NBA] enhance failed:`, err);
      return gameState;
    } finally {
      this.pushMetric('gameStateEnhancementTime', Date.now() - t0);
    }
  }

  protected getSportSpecificMetrics() {
    return {
      activeGameTracking: 0,
      totalTrackedAlerts: 0,
    };
  }
}
