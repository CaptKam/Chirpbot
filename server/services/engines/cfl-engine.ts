
import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class CFLEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('CFL');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`CFL Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // CFL-specific probability calculation
    // Based on down, distance, field position, time remaining, etc.
    const { down, yardsToGo, fieldPosition, quarter, timeRemaining } = gameState;

    let probability = 50; // Base probability

    // Down-specific adjustments (CFL has 3 downs vs NFL's 4)
    if (down === 1) probability += 25;
    else if (down === 2) probability += 10;
    else if (down === 3) probability -= 20; // Third down is critical in CFL

    // Distance adjustments
    if (yardsToGo <= 3) probability += 15;
    else if (yardsToGo <= 7) probability += 5;
    else if (yardsToGo >= 15) probability -= 15;

    // Field position (red zone bonus) - CFL field is 110 yards
    if (fieldPosition <= 25) probability += 25; // CFL red zone
    else if (fieldPosition <= 40) probability += 10;

    // Time pressure
    if (quarter >= 4 && this.parseTimeToSeconds(timeRemaining) <= 180) { // 3 minutes in CFL
      probability += 10;
    }

    return Math.min(Math.max(probability, 5), 95);
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];

    try {
      // Generate CFL-specific alerts
      alerts.push(...await this.generateGameStartAlerts(gameState));
      alerts.push(...await this.generateHalftimeKickoffAlerts(gameState));
      alerts.push(...await this.generateThreeMinuteWarningAlerts(gameState));
      alerts.push(...await this.generateRedZoneAlerts(gameState));
      alerts.push(...await this.generateThirdDownAlerts(gameState));
      alerts.push(...await this.generateOvertimeAlerts(gameState));

    } catch (error) {
      console.error(`Error generating CFL alerts for game ${gameState.gameId}:`, error);
    }

    return alerts;
  }

  private async generateGameStartAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Game start - first quarter kickoff
    if (quarter === 1 && this.isKickoffTime(timeRemaining)) {
      // No filtering - always enabled
      {
        const alertKey = `${gameState.gameId}_CFL_GAME_START`;
        const message = `🏈 CFL GAME START! ${gameState.awayTeam} @ ${gameState.homeTeam} - Kickoff time!`;

        alerts.push({
          alertKey,
          type: 'CFL_GAME_START',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            timeRemaining,
            isGameStart: true
          },
          priority: 100
        });
      }
    }

    return alerts;
  }

  private async generateHalftimeKickoffAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Second half kickoff
    if (quarter === 3 && this.isKickoffTime(timeRemaining)) {
      // No filtering - always enabled
      {
        const alertKey = `${gameState.gameId}_CFL_SECOND_HALF_KICKOFF`;
        const message = `🏈 CFL SECOND HALF KICKOFF! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Second half begins!`;

        alerts.push({
          alertKey,
          type: 'CFL_SECOND_HALF_KICKOFF',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            timeRemaining,
            isSecondHalf: true
          },
          priority: 95
        });
      }
    }

    return alerts;
  }

  private async generateThreeMinuteWarningAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Check if we're in the final 3 minutes (CFL uses 3-minute warning)
    if (this.isWithinThreeMinutes(timeRemaining) && quarter > 0) {
      // No filtering - always enabled
      {
        const isEndOfHalf = quarter === 2 || quarter === 4;
        const alertKey = `${gameState.gameId}_THREE_MINUTE_WARNING_Q${quarter}_${timeRemaining.replace(/[:\s]/g, '')}`;
        const message = `⏰ THREE MINUTE WARNING! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;

        alerts.push({
          alertKey,
          type: 'THREE_MINUTE_WARNING',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            timeRemaining,
            isEndOfHalf
          },
          priority: 88
        });
      }
    }

    return alerts;
  }

  private async generateRedZoneAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { fieldPosition, down, yardsToGo } = gameState;

    // Red zone detection (within 25 yards of goal line in CFL)
    if (fieldPosition <= 25) {
      // No filtering - always enabled
      {
        const probability = await this.calculateProbability(gameState);
        const alertKey = `${gameState.gameId}_RED_ZONE_${down}_${yardsToGo}`;
        const message = `🎯 CFL RED ZONE! ${gameState.awayTeam} vs ${gameState.homeTeam} - ${down}${this.getOrdinalSuffix(down)} & ${yardsToGo}, ${fieldPosition} yard line (${probability}% TD chance)`;

        alerts.push({
          alertKey,
          type: 'RED_ZONE',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            down,
            yardsToGo,
            fieldPosition,
            probability
          },
          priority: probability > 70 ? 90 : 85
        });
      }
    }

    return alerts;
  }

  private async generateThirdDownAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { down, yardsToGo, fieldPosition } = gameState;

    // Third down situations (critical in CFL - equivalent to 4th down in NFL)
    if (down === 3) {
      // No filtering - always enabled
      {
        const probability = await this.calculateProbability(gameState);
        const alertKey = `${gameState.gameId}_THIRD_DOWN_${yardsToGo}_${fieldPosition}`;
        const message = `🏈 CFL THIRD DOWN! ${gameState.awayTeam} vs ${gameState.homeTeam} - 3rd & ${yardsToGo} at ${fieldPosition} yard line`;

        alerts.push({
          alertKey,
          type: 'THIRD_DOWN',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            down,
            yardsToGo,
            fieldPosition,
            probability
          },
          priority: yardsToGo <= 3 ? 95 : 85
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
        const alertKey = `${gameState.gameId}_OVERTIME_${quarter}`;
        const message = `⚡ CFL OVERTIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${overtimePeriod}${this.getOrdinalSuffix(overtimePeriod)} OT`;

        alerts.push({
          alertKey,
          type: 'OVERTIME',
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

  private isKickoffTime(timeRemaining: string): boolean {
    // Kickoff typically happens at start of quarter (15:00 or close to it)
    if (!timeRemaining) return false;
    
    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds >= 880 && totalSeconds <= 900; // Between 14:40 and 15:00
    } catch (error) {
      return false;
    }
  }

  private isWithinThreeMinutes(timeRemaining: string): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;
    
    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= 180 && totalSeconds > 0;
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
