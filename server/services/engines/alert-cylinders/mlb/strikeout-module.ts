import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class StrikeoutModule extends BaseAlertModule {
  alertType = 'STRIKEOUT';
  sport = 'MLB';

  isTriggered(gameState: GameState): boolean {
    // Trigger on 2 strikes (high strikeout probability) or 3 strikes (actual strikeout)
    const triggered = gameState.strikes === 2 || gameState.strikes === 3;
    console.log(`🔍 STRIKEOUT check: strikes=${gameState.strikes}, outs=${gameState.outs} → ${triggered}`);
    return triggered;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) return null;

    const { strikes, balls, outs, inning, hasFirst, hasSecond, hasThird } = gameState;
    
    let message: string;
    let priority: number;
    let alertKey: string;

    if (strikes === 3) {
      // Actual strikeout occurred
      alertKey = `${gameState.gameId}_STRIKEOUT_ACTUAL_${inning}_${outs}`;
      message = `⚾ STRIKEOUT! Batter struck out, ${outs} out${outs !== 1 ? 's' : ''}`;
      priority = 85;
    } else if (strikes === 2) {
      // Two-strike count - high strikeout potential
      alertKey = `${gameState.gameId}_STRIKEOUT_POTENTIAL_${inning}_${outs}_${balls}${strikes}`;
      
      const runnerContext = [];
      if (hasFirst) runnerContext.push('1st');
      if (hasSecond) runnerContext.push('2nd');
      if (hasThird) runnerContext.push('3rd');
      
      const runnerText = runnerContext.length > 0 
        ? `, ${runnerContext.join(' & ')} base` 
        : '';
      
      message = `⚾ 2 STRIKES! ${balls}-2 count, ${outs} out${outs !== 1 ? 's' : ''}${runnerText} - Strikeout situation!`;
      priority = 70;
    } else {
      return null;
    }

    return {
      alertKey,
      type: this.alertType,
      message,
      context: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning,
        outs,
        balls,
        strikes,
        hasFirst,
        hasSecond,
        hasThird,
        strikeoutSituation: strikes === 2,
        actualStrikeout: strikes === 3
      },
      priority
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    let probability = 60; // Base strikeout probability for 2 strikes
    
    if (gameState.strikes === 3) {
      return 100; // Already happened
    }
    
    // Adjust for count situation
    if (gameState.balls === 0) probability += 15; // 0-2 count very dangerous
    else if (gameState.balls === 1) probability += 10; // 1-2 count dangerous
    else if (gameState.balls === 2) probability += 5; // 2-2 count still pressure
    else if (gameState.balls === 3) probability -= 5; // 3-2 full count, more careful
    
    // Adjust for outs (more pressure with 2 outs)
    if (gameState.outs === 2) probability += 10;
    else if (gameState.outs === 1) probability += 5;
    
    // Late game situations
    if (gameState.inning >= 7) probability += 5;
    
    // Runners on base creates more pressure to avoid strikeout
    if (gameState.hasSecond || gameState.hasThird) {
      probability -= 5; // Batter might be more careful with RISP
    }
    
    return Math.min(Math.max(probability, 40), 95);
  }
}