
import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class WNBAEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('WNBA');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`WNBA Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // WNBA-specific probability calculation
    // Based on quarter, time remaining, score differential, possession, etc.
    const { quarter, timeRemaining, homeScore, awayScore } = gameState;

    let probability = 50; // Base probability
    const scoreDiff = Math.abs(homeScore - awayScore);
    const timeSeconds = this.parseTimeToSeconds(timeRemaining);

    // Quarter-specific adjustments
    if (quarter >= 4) probability += 15; // Fourth quarter intensity
    if (quarter >= 5) probability += 25; // Overtime intensity

    // Time pressure adjustments
    if (timeSeconds <= 60) probability += 20; // Final minute
    else if (timeSeconds <= 120) probability += 10; // Final 2 minutes

    // Score differential impact
    if (scoreDiff <= 3) probability += 20; // Very close game
    else if (scoreDiff <= 7) probability += 10; // Close game
    else if (scoreDiff >= 15) probability -= 20; // Blowout

    return Math.min(Math.max(probability, 5), 95);
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    try {
      // Generate WNBA-specific alerts
      alerts.push(...await this.generateFourthQuarterAlerts(gameState));
      alerts.push(...await this.generateCloseGameAlerts(gameState));
      alerts.push(...await this.generateOvertimeAlerts(gameState));
      alerts.push(...await this.generateHighScoringAlerts(gameState));

    } catch (error) {
      console.error(`Error generating WNBA alerts for game ${gameState.gameId}:`, error);
    }

    return alerts;
  }

  private async generateFourthQuarterAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Fourth quarter with less than 5 minutes remaining and close score
    if (quarter === 4 && this.isWithinMinutes(timeRemaining, 5) && scoreDiff <= 10) {
      // No filtering - always enabled
      {
        const alertKey = `${gameState.gameId}_WNBA_FOURTH_QUARTER_${timeRemaining.replace(/[:\s]/g, '')}`;
        const message = `🏀 FOURTH QUARTER CRUNCH TIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left`;

        alerts.push({
          alertKey,
          type: 'WNBA_FOURTH_QUARTER',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            timeRemaining,
            scoreDiff
          },
          priority: scoreDiff <= 5 ? 95 : 88
        });
      }
    }

    return alerts;
  }

  private async generateCloseGameAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter } = gameState;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Close games in 3rd or 4th quarter
    if ((quarter >= 3) && scoreDiff <= 5 && (gameState.homeScore > 0 || gameState.awayScore > 0)) {
      // No filtering - always enabled
      {
        const alertKey = `${gameState.gameId}_WNBA_CLOSE_GAME_Q${quarter}`;
        const message = `🔥 CLOSE WNBA GAME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${scoreDiff} point game in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;

        alerts.push({
          alertKey,
          type: 'WNBA_CLOSE_GAME',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            scoreDiff
          },
          priority: 90
        });
      }
    }

    return alerts;
  }

  private async generateOvertimeAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter } = gameState;

    // Overtime detection (period 5+)
    if (quarter >= 5) {
      // No filtering - always enabled
      {
        const overtimePeriod = quarter - 4;
        const alertKey = `${gameState.gameId}_WNBA_OVERTIME_${quarter}`;
        const message = `⚡ WNBA OVERTIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${overtimePeriod}${this.getOrdinalSuffix(overtimePeriod)} OT`;

        alerts.push({
          alertKey,
          type: 'WNBA_OVERTIME',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            overtimePeriod
          },
          priority: 100
        });
      }
    }

    return alerts;
  }

  private async generateHighScoringAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const totalScore = gameState.homeScore + gameState.awayScore;
    const { quarter } = gameState;

    // High-scoring game (over 160 combined points)
    if (totalScore >= 160 && quarter >= 3) {
      // No filtering - always enabled
      {
        const alertKey = `${gameState.gameId}_WNBA_HIGH_SCORING`;
        const message = `🎯 HIGH-SCORING WNBA GAME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${totalScore} combined points`;

        alerts.push({
          alertKey,
          type: 'WNBA_HIGH_SCORING',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            totalScore,
            quarter
          },
          priority: 85
        });
      }
    }

    return alerts;
  }

  private isWithinMinutes(timeRemaining: string, minutes: number): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;
    
    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= (minutes * 60) && totalSeconds > 0;
    } catch (error) {
      return false;
    }
  }

  private parseTimeToSeconds(timeString: string): number {
    const cleanTime = timeString.trim().split(' ')[0];
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    return parseInt(cleanTime) || 0;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }
}
