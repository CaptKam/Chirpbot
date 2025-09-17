import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class ScoringOpportunityModule extends BaseAlertModule {
  alertType = 'MLB_SCORING_OPPORTUNITY';
  sport = 'MLB';
  
  // Track last alert to avoid spam
  private lastAlerts: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 120000; // 2 minutes between alerts

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 MLB Scoring Opportunity check for ${gameState.gameId}: hasSecond=${gameState.hasSecond}, hasThird=${gameState.hasThird}, outs=${gameState.outs}`);
    
    // Must be a live game
    if (!gameState.isLive) {
      console.log(`❌ Scoring Opportunity: Game not live`);
      return false;
    }
    
    // Check for runners in scoring position (2nd or 3rd base)
    const hasRunnerSecond = gameState.hasSecond || false;
    const hasRunnerThird = gameState.hasThird || false;
    
    if (!hasRunnerSecond && !hasRunnerThird) {
      console.log(`❌ Scoring Opportunity: No runners in scoring position`);
      return false;
    }
    
    // Don't trigger with 3 outs (inning over)
    if (gameState.outs >= 3) {
      console.log(`❌ Scoring Opportunity: Inning is over (3 outs)`);
      return false;
    }
    
    // Generate unique key for this situation
    const situationKey = `${gameState.gameId}_${gameState.inning}_${gameState.isTopInning ? 'T' : 'B'}_${hasRunnerSecond ? '2' : ''}${hasRunnerThird ? '3' : ''}_${gameState.outs}out`;
    
    // Check cooldown
    const lastAlert = this.lastAlerts.get(situationKey);
    if (lastAlert && (Date.now() - lastAlert) < this.COOLDOWN_MS) {
      console.log(`❌ Scoring Opportunity: Cooldown active for ${situationKey}`);
      return false;
    }
    
    console.log(`🎯 MLB SCORING OPPORTUNITY TRIGGERED! Runners: 2nd=${hasRunnerSecond}, 3rd=${hasRunnerThird}`);
    this.lastAlerts.set(situationKey, Date.now());
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const hasRunnerSecond = gameState.hasSecond || false;
    const hasRunnerThird = gameState.hasThird || false;
    const hasRunnerFirst = gameState.hasFirst || false;
    const inningText = gameState.isTopInning ? `Top ${gameState.inning}` : `Bottom ${gameState.inning}`;
    
    let message = `Scoring opportunity - ${inningText} - `;
    
    // Describe the situation
    if (hasRunnerThird && hasRunnerSecond && hasRunnerFirst) {
      message += `Bases loaded`;
    } else if (hasRunnerThird && hasRunnerSecond) {
      message += `Runners on 2nd and 3rd`;
    } else if (hasRunnerThird) {
      message += `Runner on 3rd`;
    } else if (hasRunnerSecond) {
      message += `Runner on 2nd`;
    }
    
    message += ` with ${gameState.outs} out - ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`;
    
    if (gameState.currentBatter) {
      message += ` - ${gameState.currentBatter} at bat`;
    }
    
    return {
      alertKey: `${gameState.gameId}_scoring_opp_${gameState.inning}_${Date.now()}`,
      type: this.alertType,
      message,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs,
        hasFirst: gameState.hasFirst,
        hasSecond: gameState.hasSecond,
        hasThird: gameState.hasThird,
        currentBatter: gameState.currentBatter,
        currentPitcher: gameState.currentPitcher
      },
      priority: hasRunnerThird ? 88 : 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    
    const hasRunnerThird = gameState.hasThird || false;
    const hasRunnerSecond = gameState.hasSecond || false;
    
    // Higher probability with runner on third
    if (hasRunnerThird && hasRunnerSecond) return 90;
    if (hasRunnerThird) return 85;
    if (hasRunnerSecond) return 75;
    
    return 70;
  }
}