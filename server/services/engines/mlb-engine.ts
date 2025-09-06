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
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`MLB Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // MLB-specific probability calculation
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

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    try {
      // Generate MLB-specific alerts
      alerts.push(...await this.generateGameStartAlerts(gameState));
      alerts.push(...await this.generateInningAlerts(gameState));
      alerts.push(...await this.generateRunnersInScoringPositionAlerts(gameState));
      alerts.push(...await this.generateBasesLoadedAlerts(gameState));
      alerts.push(...await this.generateCloseGameAlerts(gameState));
      alerts.push(...await this.generateHomeRunAlerts(gameState));

    } catch (error) {
      console.error(`Error generating MLB alerts for game ${gameState.gameId}:`, error);
    }

    return alerts;
  }

  private async generateGameStartAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { inning, inningState } = gameState;

    // Game start - first inning, top half
    if (inning === 1 && inningState === 'Top') {
      const alertKey = `${gameState.gameId}_MLB_GAME_START`;
      const message = `⚾ GAME START! ${gameState.awayTeam} @ ${gameState.homeTeam} - First pitch!`;

      alerts.push({
        alertKey,
        type: 'MLB_GAME_START',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning,
          inningState,
          isGameStart: true
        },
        priority: 85
      });
    }

    return alerts;
  }

  private async generateInningAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { inning, inningState } = gameState;

    // Seventh inning stretch
    if (inning === 7 && inningState === 'Top') {
      const alertKey = `${gameState.gameId}_MLB_SEVENTH_INNING`;
      const message = `⚾ SEVENTH INNING! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Stretch time!`;

      alerts.push({
        alertKey,
        type: 'MLB_SEVENTH_INNING',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning,
          inningState,
          isSeventhInning: true
        },
        priority: 70
      });
    }

    // Ninth inning
    if (inning === 9) {
      const alertKey = `${gameState.gameId}_MLB_NINTH_INNING_${inningState}`;
      const message = `⚾ NINTH INNING ${inningState}! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Final inning!`;

      alerts.push({
        alertKey,
        type: 'MLB_NINTH_INNING',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning,
          inningState,
          isNinthInning: true
        },
        priority: 90
      });
    }

    return alerts;
  }

  private async generateRunnersInScoringPositionAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { hasSecond, hasThird, outs, inning } = gameState;

    if (hasSecond || hasThird) {
      const alertKey = `${gameState.gameId}_MLB_RISP_${inning}_${outs}`;
      const runners = [];
      if (hasSecond) runners.push('2nd');
      if (hasThird) runners.push('3rd');
      
      const message = `⚾ RUNNERS IN SCORING POSITION! ${runners.join(' & ')} base, ${outs} out${outs !== 1 ? 's' : ''}`;

      alerts.push({
        alertKey,
        type: 'RISP',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning,
          outs,
          hasSecond,
          hasThird,
          scoringPosition: true
        },
        priority: 80
      });
    }

    return alerts;
  }

  private async generateBasesLoadedAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { hasFirst, hasSecond, hasThird, outs, inning } = gameState;

    if (hasFirst && hasSecond && hasThird) {
      const alertKey = `${gameState.gameId}_MLB_BASES_LOADED_${inning}_${outs}`;
      const message = `⚾ BASES LOADED! ${outs} out${outs !== 1 ? 's' : ''} - Maximum scoring potential!`;

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
          outs,
          hasFirst,
          hasSecond,
          hasThird,
          basesLoaded: true
        },
        priority: 95
      });
    }

    return alerts;
  }

  private async generateCloseGameAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { homeScore, awayScore, inning } = gameState;
    const scoreDiff = Math.abs(homeScore - awayScore);

    if (scoreDiff <= 2 && inning >= 7) {
      const alertKey = `${gameState.gameId}_MLB_CLOSE_GAME_${inning}`;
      const message = `⚾ CLOSE GAME! ${gameState.awayTeam} ${awayScore}, ${gameState.homeTeam} ${homeScore} - ${scoreDiff} run game in ${inning}th inning`;

      alerts.push({
        alertKey,
        type: 'CLOSE_GAME',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore,
          awayScore,
          inning,
          scoreDifference: scoreDiff,
          closeGame: true
        },
        priority: 85
      });
    }

    return alerts;
  }

  private async generateHomeRunAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    // This would be triggered when a home run occurs
    // For now, this is a placeholder - in a real implementation,
    // this would be triggered by actual game events
    if (gameState.lastPlay && gameState.lastPlay.includes('home run')) {
      const alertKey = `${gameState.gameId}_MLB_HOME_RUN_${Date.now()}`;
      const message = `⚾ HOME RUN! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore}`;

      alerts.push({
        alertKey,
        type: 'HOME_RUN',
        message,
        context: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning: gameState.inning,
          homeRun: true
        },
        priority: 100
      });
    }

    return alerts;
  }

  // Helper method to parse time strings (if needed)
  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    // MLB doesn't use time format like football, but keeping for compatibility
    const parts = timeString.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }
}