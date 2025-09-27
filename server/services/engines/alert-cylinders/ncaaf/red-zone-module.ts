
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class RedZoneModule extends BaseAlertModule {
  alertType = 'NCAAF_RED_ZONE';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Red Zone check for ${gameState.gameId}: status=${gameState.status}, fieldPos=${gameState.fieldPosition}, quarter=${gameState.quarter}, scores=${gameState.homeScore}-${gameState.awayScore}`);
    
    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Red Zone: Game not live (${gameState.status})`);
      return false;
    }
    
    // Primary check: Team is in red zone (within 20 yards of goal line)
    if (gameState.fieldPosition !== undefined && 
        gameState.fieldPosition !== null &&
        gameState.fieldPosition <= 20 &&
        gameState.fieldPosition > 0) {
      console.log(`🎯 NCAAF Red Zone TRIGGERED for ${gameState.gameId}: ${gameState.fieldPosition} yard line`);
      return true;
    }
    
    // ENHANCED: More generous fallback conditions when field position is missing
    if (gameState.fieldPosition === null || gameState.fieldPosition === undefined) {
      const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
      const quarter = gameState.quarter || 1;
      
      // Fallback 1: Close games in Q3 or Q4
      if ((quarter === 3 || quarter === 4) && scoreDiff <= 7) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED (close game fallback Q${quarter}) for ${gameState.gameId}: score diff ${scoreDiff}`);
        return true;
      }
      
      // Fallback 2: 4th down situations (likely near goal line)
      if (gameState.down === 4 && gameState.yardsToGo && gameState.yardsToGo <= 5) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED (4th & short fallback) for ${gameState.gameId}: 4th & ${gameState.yardsToGo}`);
        return true;
      }
      
      // Fallback 3: Any tied game after Q1
      if (scoreDiff === 0 && quarter > 1) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED (tied game fallback Q${quarter}) for ${gameState.gameId}`);
        return true;
      }
    }
    
    console.log(`❌ Red Zone: Not in red zone or fallback conditions (fieldPos: ${gameState.fieldPosition}, quarter: ${gameState.quarter})`);
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
    if (!this.isTriggered(gameState)) return 0;

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
}
