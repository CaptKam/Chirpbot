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
    console.log(`🚫 WNBA alert generation is disabled - no alerts will be generated`);
    return [];
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