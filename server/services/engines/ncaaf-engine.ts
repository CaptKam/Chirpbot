import { BaseSportEngine, GameState, AlertResult } from './base-engine';
import { SettingsCache } from '../settings-cache';
import { storage } from '../../storage';

export class NCAAFEngine extends BaseSportEngine {
  // Removed settingsCache property as it's related to alerts

  constructor() {
    super('NCAAF');
    // Removed settingsCache initialization
  }

  // Removed isAlertEnabled method

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
    console.log(`🚫 NCAAF alert generation is disabled - no alerts will be generated`);
    return [];
  }

  // Removed generateTwoMinuteWarningAlerts method
  // Removed generateRedZoneAlerts method
  // Removed generateFourthDownAlerts method
  // Removed generateGameStartAlerts method
  // Removed generateHalftimeKickoffAlerts method
  // Removed generateOvertimeAlerts method

  // Removed isWithinTwoMinutes method
  // Removed parseTimeToSeconds method
  // Removed isKickoffTime method
  // Removed getOrdinalSuffix method
}