import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class NCAAFEngine extends BaseSportEngine {
  private settingsCache: SettingsCache;

  constructor() {
    super('NCAAF');
    this.settingsCache = new SettingsCache(storage);
  }

  async isAlertEnabled(alertType: string): Promise<boolean> {
    try {
      // Only check settings for actual NCAAF alert types
      const validNCAAFAlerts = [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_RED_ZONE', 'FOURTH_DOWN',
        'NCAAF_SECOND_HALF_KICKOFF', 'OVERTIME', 'CLUTCH_TIME'
      ];

      if (!validNCAAFAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid NCAAF alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`NCAAF Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
    }
  }

  async calculateProbability(gameState: GameState): Promise<number> {
    if (!gameState.isLive) return 0;

    let probability = 50; // Base probability

    // Two-minute warning situations are high priority
    if (gameState.quarter === 2 || gameState.quarter === 4) {
      const totalSeconds = this.parseTimeToSeconds(gameState.timeRemaining);
      if (totalSeconds <= 120) {
        probability += 30;
      }
    }

    // Game start situations
    if (gameState.quarter === 1 && this.isKickoffTime(gameState.timeRemaining)) {
      probability += 25;
    }

    // Close game situations
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 7) {
      probability += 15;
    }

    return Math.min(100, probability);
  }

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    // Alert processing is now handled by the base class using alert cylinders
    return super.generateLiveAlerts(gameState);
  }

  private async generateTwoMinuteWarningAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('TWO_MINUTE_WARNING'))) {
      return alerts;
    }

    // Check if we're in the final 2 minutes of any quarter
    if (this.isWithinTwoMinutes(timeRemaining) && quarter > 0) {
      const isEndOfHalf = quarter === 2 || quarter === 4;
      const alertKey = `${gameState.gameId}_TWO_MINUTE_WARNING_Q${quarter}_${timeRemaining.replace(/[:\s]/g, '')}`;
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
          isEndOfHalf
        },
        priority: 88
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
      const message = `🎯 RED ZONE! ${gameState.awayTeam} vs ${gameState.homeTeam} - ${down}${this.getOrdinalSuffix(down)} & ${yardsToGo}, ${fieldPosition} yard line (${probability}% TD chance)`;

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

  private async generateGameStartAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('NCAAF_GAME_START'))) {
      return alerts;
    }

    // Game start - first quarter kickoff
    if (quarter === 1 && this.isKickoffTime(timeRemaining)) {
      const alertKey = `${gameState.gameId}_NCAAF_GAME_START`;
      const message = `🏈 NCAAF GAME START! ${gameState.awayTeam} @ ${gameState.homeTeam} - Kickoff time!`;

      alerts.push({
        alertKey,
        type: 'NCAAF_GAME_START',
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
    if (!(await this.isAlertEnabled('NCAAF_SECOND_HALF_KICKOFF'))) {
      return alerts;
    }

    // Second half kickoff
    if (quarter === 3 && this.isKickoffTime(timeRemaining)) {
      const alertKey = `${gameState.gameId}_NCAAF_SECOND_HALF_KICKOFF`;
      const message = `🏈 NCAAF SECOND HALF KICKOFF! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - Second half begins!`;

      alerts.push({
        alertKey,
        type: 'NCAAF_SECOND_HALF_KICKOFF',
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

  private async generateOvertimeAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter } = gameState;

    // Double-check global settings before generating any alerts
    if (!(await this.isAlertEnabled('OVERTIME'))) {
      return alerts;
    }

    // Overtime detection (period 5+)
    if (quarter >= 5) {
      const overtimePeriod = quarter - 4;
      const alertKey = `${gameState.gameId}_OVERTIME_${quarter}`;
      const message = `⚡ NCAAF OVERTIME! ${gameState.awayTeam} ${gameState.awayScore}, ${gameState.homeTeam} ${gameState.homeScore} - ${overtimePeriod}${this.getOrdinalSuffix(overtimePeriod)} OT`;

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

    return alerts;
  }

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining || timeRemaining === '0:00') return false;

    try {
      const totalSeconds = this.parseTimeToSeconds(timeRemaining);
      return totalSeconds <= 120 && totalSeconds > 0;
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

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Get available alert types from cylinders
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'NCAAF_GAME_START',
      'NCAAF_TWO_MINUTE_WARNING'
    ];
  }

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'NCAAF' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'NCAAF');

      // CRITICAL FIX: Only process if user has explicit NCAAF preferences
      if (userPrefs.length === 0) {
        console.log(`🚫 User ${userId} has no explicit NCAAF preferences - skipping NCAAF initialization`);
        return;
      }

      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      if (enabledTypes.length === 0) {
        console.log(`🚫 User ${userId} has no enabled NCAAF alerts - skipping NCAAF initialization`);
        return;
      }

      // Filter to only valid NCAAF alerts
      const validNCAAFAlerts = [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'NCAAF_RED_ZONE', 'FOURTH_DOWN',
        'NCAAF_SECOND_HALF_KICKOFF', 'OVERTIME', 'CLUTCH_TIME'
      ];

      const ncaafEnabledTypes = enabledTypes.filter(alertType =>
        validNCAAFAlerts.includes(alertType)
      );

      // Check global settings for these NCAAF alerts
      const globallyEnabledTypes = [];
      for (const alertType of ncaafEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing NCAAF engine for user ${userId} with ${globallyEnabledTypes.length} NCAAF alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the NCAAF alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize NCAAF engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'NCAAF_GAME_START': './alert-cylinders/ncaaf/game-start-module.ts',
        'NCAAF_TWO_MINUTE_WARNING': './alert-cylinders/ncaaf/two-minute-warning-module.ts',
        'NCAAF_RED_ZONE': './alert-cylinders/ncaaf/red-zone-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No NCAAF module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      return new module.default();
    } catch (error) {
      console.error(`❌ Failed to load NCAAF alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert cylinder modules for enabled alert types
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    for (const alertType of enabledAlertTypes) {
      const module = await this.loadAlertModule(alertType);
      if (module) {
        this.alertModules.set(alertType, module);
        console.log(`✅ Loaded NCAAF alert cylinder: ${alertType}`);
      }
    }

    console.log(`🔧 Initialized ${this.alertModules.size} NCAAF alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }
}