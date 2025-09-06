import { BaseSportEngine, GameState, AlertResult } from './base-engine';

export class NFLEngine extends BaseSportEngine {
  constructor() {
    super('NFL');
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

  private alertModules: Map<string, any> = new Map();

  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    
    // Process each initialized alert module
    for (const [alertType, module] of this.alertModules.entries()) {
      try {
        const result = await module.checkAlert(gameState);
        if (result.shouldAlert) {
          alerts.push({
            alertKey: `${gameState.gameId}-${alertType}-${Date.now()}`,
            type: alertType,
            message: result.message,
            priority: result.priority || 50,
            context: result.context || gameState
          });
        }
      } catch (error) {
        console.error(`❌ Error processing ${alertType} alert:`, error);
      }
    }
    
    return alerts;
  }

  async initializeUserAlertModules(enabledAlertTypes: string[]): Promise<void> {
    console.log(`🔧 Loading ${enabledAlertTypes.length} NFL alert modules...`);
    
    for (const alertType of enabledAlertTypes) {
      try {
        const module = await this.loadAlertModule(alertType);
        if (module) {
          this.alertModules.set(alertType, module);
          console.log(`✅ NFL module loaded: ${alertType}`);
        }
      } catch (error) {
        console.error(`❌ Failed to load NFL module: ${alertType}`, error);
      }
    }
    
    console.log(`🎯 Successfully initialized ${this.alertModules.size} NFL alert modules`);
  }

  async loadAlertModule(alertType: string): Promise<any | null> {
    const moduleMap: Record<string, string> = {
      'GAME_START': 'game-start-module',
      'RED_ZONE': 'red-zone-module',
      'FOURTH_DOWN': 'fourth-down-module',
      'TWO_MINUTE_WARNING': 'two-minute-warning-module',
      'CLUTCH_TIME': 'clutch-time-module',
      'OVERTIME': 'overtime-module'
    };

    const moduleName = moduleMap[alertType];
    if (!moduleName) {
      console.log(`❌ No NFL module found for: ${alertType}`);
      return null;
    }

    try {
      const modulePath = `./alert-cylinders/nfl/${moduleName}`;
      const module = await import(modulePath);
      return module;
    } catch (error) {
      console.error(`❌ Failed to load NFL alert module ${alertType}:`, error);
      return null;
    }
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