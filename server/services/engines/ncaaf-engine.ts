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
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'RED_ZONE', 'FOURTH_DOWN'
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
    // NCAAF-specific probability calculation
    // Based on down, distance, field position, time remaining, etc.
    const { down, yardsToGo, fieldPosition, quarter, timeRemaining } = gameState;

    let probability = 50; // Base probability

    // Down-specific adjustments
    if (down === 1) probability += 20;
    else if (down === 2) probability += 10;
    else if (down === 3) probability -= 10;
    else if (down === 4) probability -= 30;

    // Distance adjustments
    if (yardsToGo <= 3) probability += 15;
    else if (yardsToGo <= 7) probability += 5;
    else if (yardsToGo >= 15) probability -= 15;

    // Field position (red zone bonus)
    if (fieldPosition <= 20) probability += 25;
    else if (fieldPosition <= 40) probability += 10;

    // Time pressure
    if (quarter >= 4 && this.parseTimeToSeconds(timeRemaining) <= 120) {
      probability += 10;
    }

    return Math.min(Math.max(probability, 5), 95);
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

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'ncaaf');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Filter to only valid NCAAF alerts  
      const validNCAAFAlerts = [
        'NCAAF_GAME_START', 'NCAAF_TWO_MINUTE_WARNING', 'RED_ZONE', 'FOURTH_DOWN'
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

  // Load alert modules dynamically - NCAAF only
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      // Map NCAAF alert types to actual module files
      const moduleMap: Record<string, string> = {
        'NCAAF_GAME_START': 'ncaaf-game-start-module',
        'NCAAF_TWO_MINUTE_WARNING': 'two-minute-warning-module',
        'RED_ZONE': 'red-zone-module',
        'FOURTH_DOWN': 'fourth-down-module'
      };

      const moduleFileName = moduleMap[alertType];
      if (!moduleFileName) {
        console.log(`❌ No NCAAF module found for: ${alertType}`);
        return null;
      }

      const modulePath = `./alert-cylinders/${this.sport.toLowerCase()}/${moduleFileName}`;
      const module = await import(modulePath);
      const ModuleClass = module.default;
      return new ModuleClass();
    } catch (error) {
      console.error(`❌ Failed to load NCAAF alert module ${alertType}:`, error);
      return null;
    }
  }

  // Initialize alert modules for enabled alert types - NCAAF only
  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    this.alertModules.clear();

    console.log(`🔧 Loading ${enabledAlertTypes.length} NCAAF alert modules...`);

    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ Loaded NCAAF alert module: ${alertType}`);
        } else {
          console.log(`❌ Failed to load NCAAF module: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Error loading NCAAF ${alertType}:`, error);
      }
    }

    console.log(`🎯 Successfully initialized ${this.alertModules.size} NCAAF alert modules`);
  }
}