
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';
import { cleanAlertFormatter } from '../../../clean-alert-formatter';

export default class RedZoneModule extends BaseAlertModule {
  alertType = 'NCAAF_RED_ZONE';
  sport = 'NCAAF';

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Red Zone check for ${gameState.gameId}: status=${gameState.status}, fieldPos=${gameState.fieldPosition}, quarter=${gameState.quarter}`);
    
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
    
    // RELAXED: Fallback for close games in Q4 when field position is missing
    if (gameState.fieldPosition === null || gameState.fieldPosition === undefined) {
      const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
      const isCloseQ4Game = gameState.quarter === 4 && scoreDiff <= 7;
      
      if (isCloseQ4Game) {
        console.log(`🎯 NCAAF Red Zone TRIGGERED (Q4 close game fallback) for ${gameState.gameId}: score diff ${scoreDiff}`);
        return true;
      }
    }
    
    console.log(`❌ Red Zone: Not in red zone or fallback conditions`);
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
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | RED ZONE`,
      displayMessage: cleanAlertFormatter.format({
        type: this.alertType,
        sport: this.sport,
        gameState: gameState,
        context: {
          gameId: gameState.gameId,
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
        riskReward: {
          probability: probability
        }
      }).primary,
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
}
