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

  // Alert processing is now handled by the base class using alert cylinders
  async generateLiveAlerts(gameState: GameState): Promise<AlertResult[]> {
    console.log(`🚫 NFL alert generation is disabled - no alerts will be generated`);
    return [];
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