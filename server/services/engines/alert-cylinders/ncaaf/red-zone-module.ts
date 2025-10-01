
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class RedZoneModule extends BaseAlertModule {
  alertType = 'NCAAF_RED_ZONE';
  sport = 'NCAAF';

  private lastSignatureByGame: Map<string, string> = new Map();

  isTriggered(gameState: GameState): boolean {
    const gameId = gameState.gameId;
    
    console.log(`🔍 NCAAF Red Zone check for ${gameState.gameId}: status=${gameState.status}, fieldPos=${gameState.fieldPosition}, quarter=${gameState.quarter}`);
    
    // Check if we have field position data
    const hasFieldPosition = gameState.fieldPosition !== undefined && gameState.fieldPosition !== null;
    
    // PATH 1: Normal red zone detection with field position
    if (hasFieldPosition) {
      const meetsBasicConditions = gameState.status === 'live' && 
                                   gameState.fieldPosition <= 20 &&
                                   gameState.fieldPosition > 0;

      // If not in red zone anymore, clear the signature
      if (!meetsBasicConditions || gameState.fieldPosition > 20) {
        this.lastSignatureByGame.delete(gameId);
        console.log(`❌ Red Zone: Not in red zone, clearing signature for ${gameId}`);
        return false;
      }

      // Build current signature
      const currentSignature = this.buildGameSignature(gameState);
      const lastSignature = this.lastSignatureByGame.get(gameId);

      // First time seeing this game in red zone, or signature changed
      if (!lastSignature || lastSignature !== currentSignature) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED for ${gameId}: ${gameState.fieldPosition} yard line (signature changed from "${lastSignature}" to "${currentSignature}")`);
        this.lastSignatureByGame.set(gameId, currentSignature);
        return true;
      }

      // Same signature - don't trigger
      console.log(`⏭️  Red Zone: Same signature, skipping alert for ${gameId}: ${currentSignature}`);
      return false;
    }
    
    // PATH 2: Q4 close-game fallback when fieldPosition is missing
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '0:00');
    const isQ4Close = gameState.status === 'live' &&
                     gameState.quarter === 4 && 
                     scoreDiff <= 14 && 
                     timeSeconds <= 300; // 5 minutes
    
    if (isQ4Close) {
      // Build fallback signature
      const currentSignature = this.buildFallbackSignature(gameState);
      const lastSignature = this.lastSignatureByGame.get(gameId);
      
      if (!lastSignature || lastSignature !== currentSignature) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED (Q4 fallback) for ${gameId}: No field position, Q4 close game (signature changed from "${lastSignature}" to "${currentSignature}")`);
        this.lastSignatureByGame.set(gameId, currentSignature);
        return true;
      }
      
      console.log(`⏭️  Red Zone Q4 fallback: Same signature, skipping alert for ${gameId}: ${currentSignature}`);
      return false;
    }
    
    // Neither path triggered - clear signature if exists
    if (this.lastSignatureByGame.has(gameId)) {
      this.lastSignatureByGame.delete(gameId);
      console.log(`❌ Red Zone: Conditions not met, clearing signature for ${gameId}`);
    }
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already called by engine - removed duplicate check
    const probability = this.calculateProbability(gameState);
    const down = gameState.down || 1;
    const yardsToGo = gameState.yardsToGo || 10;

    return {
      alertKey: `${gameState.gameId}_NCAAF_RED_ZONE_${down}_${yardsToGo}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | ${this.createDynamicMessage(gameState, down, yardsToGo)}`,
      displayMessage: `🏈 ${this.createDynamicMessage(gameState, down, yardsToGo)} | Q${gameState.quarter}`,
      context: {
        gameId: gameState.gameId,
        sport: gameState.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        down: gameState.down,
        yardsToGo: gameState.yardsToGo,
        fieldPosition: gameState.fieldPosition,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        probability
      },
      priority: probability > 70 ? 90 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    let probability = 55; // Base red zone probability for college

    // Field position impact
    if (gameState.fieldPosition <= 10) probability += 25; // Goal line area
    else if (gameState.fieldPosition <= 15) probability += 15;

    // Down and distance impact
    if (gameState.down === 1) probability += 20; // College teams more aggressive on 1st down
    else if (gameState.down === 2) probability += 10;
    else if (gameState.down === 3) probability -= 5;
    else if (gameState.down === 4) probability += 15; // College teams go for it more

    // Yards to go impact
    if (gameState.yardsToGo <= 3) probability += 20;
    else if (gameState.yardsToGo <= 7) probability += 10;

    // Time pressure (4th quarter or overtime)
    if (gameState.quarter === 4) probability += 15;
    else if (gameState.quarter >= 5) probability += 20; // Overtime

    // Close game bonus
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 7) probability += 10;

    return Math.min(Math.max(probability, 25), 95);
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  private createDynamicMessage(gameState: GameState, down: number, yardsToGo: number): string {
    const fieldPos = gameState.fieldPosition;
    const quarter = gameState.quarter;
    const ordinalSuffix = this.getOrdinalSuffix(down);
    
    // Create contextual red zone message
    if (fieldPos && fieldPos <= 20) {
      if (yardsToGo <= 3 && fieldPos <= 10) {
        return `${down}${ordinalSuffix} & Goal at ${fieldPos}-yard line`;
      } else if (yardsToGo <= 3) {
        return `${down}${ordinalSuffix} & ${yardsToGo} at ${fieldPos}-yard line`;
      } else {
        return `${down}${ordinalSuffix} & ${yardsToGo} at ${fieldPos}-yard line`;
      }
    } else {
      // Fallback for Q4 close games when field position is missing
      const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
      if (quarter === 4 && scoreDiff <= 7) {
        return `${down}${ordinalSuffix} & ${yardsToGo} - Close Q4 red zone opportunity`;
      } else {
        return `${down}${ordinalSuffix} & ${yardsToGo} - Red zone opportunity`;
      }
    }
  }

  private buildGameSignature(gameState: GameState): string {
    const possessionTeam = this.getPossessionTeam(gameState);
    const quarter = gameState.quarter || 0;
    const down = gameState.down || 0;
    const yardsToGo = gameState.yardsToGo || 0;
    const fieldPosition = gameState.fieldPosition || 0;
    
    // Field position bucket: group yards into buckets (1-5, 6-10, 11-15, 16-20)
    const fieldPositionBucket = Math.ceil(fieldPosition / 5) * 5;
    
    // Clock bucket: round time to 30-second intervals to avoid jitter
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '0:00');
    const clockBucket = Math.floor(timeSeconds / 30) * 30;
    
    return `${possessionTeam}|Q${quarter}|${down}&${yardsToGo}|${fieldPositionBucket}|${clockBucket}`;
  }

  private buildFallbackSignature(gameState: GameState): string {
    const possessionTeam = this.getPossessionTeam(gameState);
    const down = gameState.down || 0;
    const yardsToGo = gameState.yardsToGo || 0;
    
    // Clock bucket: round time to 30-second intervals to avoid jitter
    const timeSeconds = this.parseTimeToSeconds(gameState.timeRemaining || '0:00');
    const clockBucket = Math.floor(timeSeconds / 30) * 30;
    
    return `${possessionTeam}|Q4_CLOSE|${down}&${yardsToGo}|${clockBucket}`;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString) return 0;
    const cleanTime = timeString.trim().split(' ')[0];
    
    if (cleanTime.includes(':')) {
      const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
      return (minutes * 60) + seconds;
    }
    
    return parseInt(cleanTime) || 0;
  }

  private getPossessionTeam(gameState: GameState): string {
    // Use possession field if available
    if (gameState.possession) {
      return gameState.possession;
    }
    
    // Default to away team for simplicity
    return gameState.awayTeam;
  }
}
