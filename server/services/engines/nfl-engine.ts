import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class NFLEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('NFL');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NFL Settings cache error for ${alertType}:`, error);
      return true;
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    // NFL-specific probability calculation
    const { quarter, timeRemaining, down, yardsToGo, fieldPosition } = gameState;

    let probability = 50; // Base probability

    // Quarter-specific adjustments
    if (quarter === 1) probability += 10; // Game start excitement
    else if (quarter === 3) probability += 8; // Second half start
    else if (quarter === 4) probability += 15; // Fourth quarter drama

    // Down and distance
    if (down === 1) probability += 15;
    else if (down === 2) probability += 5;
    else if (down === 3) probability -= 5;
    else if (down === 4) probability -= 20;

    // Field position (red zone)
    if (fieldPosition <= 20) probability += 20;
    else if (fieldPosition <= 40) probability += 10;

    // Time factors
    if (this.parseTimeToSeconds(timeRemaining) <= 120) {
      probability += 20; // Two-minute warning
    }

    return Math.min(Math.max(probability, 10), 95);
  }

  // Alert processing is now handled by the base class using alert cylinders
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    return [];
  }

  private async generateGameStartAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('NFL_GAME_START'))) {
      return alerts;
    }

    // Game start - first quarter kickoff
    if (quarter === 1 && this.isKickoffTime(timeRemaining)) {
      const alertKey = `${gameState.gameId}_NFL_GAME_START`;
      const message = `🏈 GAME START! ${gameState.awayTeam} @ ${gameState.homeTeam} - Kickoff time!`;

        alerts.push({
          alertKey,
          type: 'NFL_GAME_START',
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

    return alerts;
  }

  private async generateHalftimeKickoffAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('NFL_SECOND_HALF_KICKOFF'))) {
      return alerts;
    }

    // Second half kickoff
    if (quarter === 3 && this.isKickoffTime(timeRemaining)) {
      const alertKey = `${gameState.gameId}_NFL_SECOND_HALF_KICKOFF`;
      const message = `🏈 SECOND HALF KICKOFF! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Second half begins!`;

        alerts.push({
          alertKey,
          type: 'NFL_SECOND_HALF_KICKOFF',
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

    return alerts;
  }

  private async generateRedZoneAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { fieldPosition, down, yardsToGo } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('RED_ZONE'))) {
      return alerts;
    }

    // Red zone detection (within 20 yards of goal line)
    if (fieldPosition <= 20) {
      const probability = await this.calculateProbability(gameState);
      const alertKey = `${gameState.gameId}_RED_ZONE_${down}_${yardsToGo}`;
      const message = `🎯 RED ZONE! ${gameState.awayTeam} vs ${gameState.homeTeam} - ${down}${this.getOrdinalSuffix(down)} & ${yardsToGo}, ${fieldPosition} yard line`;

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

    return alerts;
  }

  private async generateFourthDownAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { down, yardsToGo, fieldPosition } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('FOURTH_DOWN'))) {
      return alerts;
    }

    // Fourth down situations
    if (down === 4) {
      const probability = await this.calculateProbability(gameState);
      const alertKey = `${gameState.gameId}_FOURTH_DOWN_${yardsToGo}_${fieldPosition}`;
      const message = `🏈 FOURTH DOWN! ${gameState.awayTeam} vs ${gameState.homeTeam} - 4th & ${yardsToGo} at ${fieldPosition} yard line`;

        alerts.push({
          alertKey,
          type: 'FOURTH_DOWN',
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

    return alerts;
  }

  private async generateTwoMinuteWarningAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('TWO_MINUTE_WARNING'))) {
      return alerts;
    }

    // Two-minute warning (end of 2nd and 4th quarters)
    if ((quarter === 2 || quarter === 4) && this.isTwoMinuteWarning(timeRemaining)) {
      const isEndOfGame = quarter === 4;
      const alertKey = `${gameState.gameId}_TWO_MINUTE_WARNING_Q${quarter}`;
      const message = `⏰ TWO MINUTE WARNING! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${timeRemaining} left in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;

        alerts.push({
          alertKey,
          type: 'TWO_MINUTE_WARNING',
          message,
          context: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            homeScore: gameState.homeScore,
            awayScore: gameState.awayScore,
            quarter,
            timeRemaining,
            isEndOfGame
          },
          priority: isEndOfGame ? 95 : 88
        });
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

  private isTwoMinuteWarning(timeRemaining: string): boolean {
    if (!timeRemaining) return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= 125 && totalSeconds >= 115; // Around 2:00 mark
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