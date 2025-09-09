
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
      // Only check settings for actual WNBA alert types
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER'
      ];

      if (!validWNBAAlerts.includes(alertType)) {
        console.log(`❌ ${alertType} is not a valid WNBA alert type - rejecting`);
        return false;
      }

      return await this.settingsCache.isAlertEnabled(this.sport, alertType);
    } catch (error) {
      console.error(`WNBA Settings cache error for ${alertType}:`, error);
      return true; // Default to true if cache fails
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

  // Override to delegate to base class modular system
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    // Use the parent class method which properly calls all loaded modules
    return super.generateLiveAlerts(gameState);
  }

  private async generateFourthQuarterAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const { quarter, timeRemaining } = gameState;
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);

    // Fourth quarter with less than 5 minutes remaining and close score
    if (quarter === 4 && this.isWithinMinutes(timeRemaining, 5) && scoreDiff <= 10) {
      // Check if WNBA_FOURTH_QUARTER alerts are enabled
      if (await this.isAlertEnabled('WNBA_FOURTH_QUARTER')) {
        const alertKey = `${gameState.gameId}_WNBA_FOURTH_QUARTER_${timeRemaining.replace(/[:\s]/g, '')}`;
        const awayTeamName = typeof gameState.awayTeam === 'string' ? gameState.awayTeam : 
                            gameState.awayTeam?.displayName || gameState.awayTeam?.name || 'Away Team';
        const homeTeamName = typeof gameState.homeTeam === 'string' ? gameState.homeTeam : 
                            gameState.homeTeam?.displayName || gameState.homeTeam?.name || 'Home Team';
        
        const message = `🏀 FOURTH QUARTER CRUNCH TIME! ${awayTeamName} ${gameState.awayScore}, ${homeTeamName} ${gameState.homeScore} - ${timeRemaining} left`;

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
      // Check if WNBA_CLOSE_GAME alerts are enabled
      if (await this.isAlertEnabled('WNBA_CLOSE_GAME')) {
        const alertKey = `${gameState.gameId}_WNBA_CLOSE_GAME_Q${quarter}`;
        const awayTeamName = typeof gameState.awayTeam === 'string' ? gameState.awayTeam : 
                            gameState.awayTeam?.displayName || gameState.awayTeam?.name || 'Away Team';
        const homeTeamName = typeof gameState.homeTeam === 'string' ? gameState.homeTeam : 
                            gameState.homeTeam?.displayName || gameState.homeTeam?.name || 'Home Team';
        
        const message = `🔥 CLOSE WNBA GAME! ${awayTeamName} ${gameState.awayScore}, ${homeTeamName} ${gameState.homeScore} - ${scoreDiff} point game in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;

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
      // Check if WNBA_OVERTIME alerts are enabled
      if (await this.isAlertEnabled('WNBA_OVERTIME')) {
        const overtimePeriod = quarter - 4;
        const alertKey = `${gameState.gameId}_WNBA_OVERTIME_${quarter}`;
        const awayTeamName = typeof gameState.awayTeam === 'string' ? gameState.awayTeam : 
                            gameState.awayTeam?.displayName || gameState.awayTeam?.name || 'Away Team';
        const homeTeamName = typeof gameState.homeTeam === 'string' ? gameState.homeTeam : 
                            gameState.homeTeam?.displayName || gameState.homeTeam?.name || 'Home Team';
        
        const message = `⚡ WNBA OVERTIME! ${awayTeamName} ${gameState.awayScore}, ${homeTeamName} ${gameState.homeScore} - ${overtimePeriod}${this.getOrdinalSuffix(overtimePeriod)} OT`;

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
      // Check if WNBA_HIGH_SCORING alerts are enabled
      if (await this.isAlertEnabled('WNBA_HIGH_SCORING')) {
        const alertKey = `${gameState.gameId}_WNBA_HIGH_SCORING`;
        const awayTeamName = typeof gameState.awayTeam === 'string' ? gameState.awayTeam : 
                            gameState.awayTeam?.displayName || gameState.awayTeam?.name || 'Away Team';
        const homeTeamName = typeof gameState.homeTeam === 'string' ? gameState.homeTeam : 
                            gameState.homeTeam?.displayName || gameState.homeTeam?.name || 'Home Team';
        
        const message = `🎯 HIGH-SCORING WNBA GAME! ${awayTeamName} ${gameState.awayScore}, ${homeTeamName} ${gameState.homeScore} - ${totalScore} combined points`;

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

  // Initialize alert modules based on user's enabled preferences
  async initializeForUser(userId: string): Promise<void> {
    try {
      // Get user's enabled alert types - use uppercase 'WNBA' to match database
      const userPrefs = await storage.getUserAlertPreferencesBySport(userId, 'WNBA');
      const enabledTypes = userPrefs
        .filter(pref => pref.enabled)
        .map(pref => pref.alertType);

      // Filter to only valid WNBA alerts that have corresponding modules
      const validWNBAAlerts = [
        'WNBA_GAME_START', 'WNBA_TWO_MINUTE_WARNING', 'FINAL_MINUTES',
        'HIGH_SCORING_QUARTER', 'LOW_SCORING_QUARTER', 'FOURTH_QUARTER'
      ];

      const wnbaEnabledTypes = enabledTypes.filter(alertType =>
        validWNBAAlerts.includes(alertType)
      );

      // Check global settings for these WNBA alerts
      const globallyEnabledTypes = [];
      for (const alertType of wnbaEnabledTypes) {
        const isGloballyEnabled = await this.isAlertEnabled(alertType);
        if (isGloballyEnabled) {
          globallyEnabledTypes.push(alertType);
        }
      }

      console.log(`🎯 Initializing WNBA engine for user ${userId} with ${globallyEnabledTypes.length} WNBA alerts: ${globallyEnabledTypes.join(', ')}`);

      // Initialize the WNBA alert modules using parent class method
      await this.initializeUserAlertModules(globallyEnabledTypes);

    } catch (error) {
      console.error(`❌ Failed to initialize WNBA engine for user ${userId}:`, error);
    }
  }

  // Load alert cylinder module for specific alert type
  async loadAlertModule(alertType: string): Promise<any | null> {
    try {
      const moduleMap: Record<string, string> = {
        'WNBA_GAME_START': './alert-cylinders/wnba/game-start-module.ts',
        'WNBA_TWO_MINUTE_WARNING': './alert-cylinders/wnba/two-minute-warning-module.ts',
        'FINAL_MINUTES': './alert-cylinders/wnba/final-minutes-module.ts',
        'HIGH_SCORING_QUARTER': './alert-cylinders/wnba/high-scoring-quarter-module.ts',
        'LOW_SCORING_QUARTER': './alert-cylinders/wnba/low-scoring-quarter-module.ts',
        'FOURTH_QUARTER': './alert-cylinders/wnba/fourth-quarter-module.ts'
      };

      const modulePath = moduleMap[alertType];
      if (!modulePath) {
        console.log(`❌ No WNBA module found for alert type: ${alertType}`);
        return null;
      }

      const module = await import(modulePath);
      return new module.default();
    } catch (error) {
      console.error(`❌ Failed to load WNBA alert module ${alertType}:`, error);
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
        console.log(`✅ Loaded WNBA alert cylinder: ${alertType}`);
      }
    }
    
    console.log(`🔧 Initialized ${this.alertModules.size} WNBA alert cylinders: ${Array.from(this.alertModules.keys()).join(', ')}`);
  }

  // Override to return only valid WNBA alert types
  async getAvailableAlertTypes(): Promise<string[]> {
    return [
      'WNBA_GAME_START',
      'WNBA_TWO_MINUTE_WARNING',
      'FINAL_MINUTES',
      'HIGH_SCORING_QUARTER',
      'LOW_SCORING_QUARTER',
      'FOURTH_QUARTER'
    ];
  }
}
