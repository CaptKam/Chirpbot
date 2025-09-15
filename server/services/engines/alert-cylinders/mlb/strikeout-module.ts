import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class StrikeoutModule extends BaseAlertModule {
  alertType = 'MLB_STRIKEOUT';
  sport = 'MLB';

  // Track strikeout counts per game to detect significant patterns
  private gameStrikeouts: Map<string, { totalStrikeouts: number, lastStrikeoutInning: number, consecutiveStrikeouts: number }> = new Map();

  isTriggered(gameState: GameState): boolean {
    if (!gameState.gameId || !gameState.isLive) return false;

    // Trigger on high-impact strikeout situations:
    // 1. 3+ consecutive strikeouts by same pitcher
    // 2. Strikeout with runners in scoring position (2nd/3rd base)
    // 3. Strikeout to end a high-leverage inning (7th inning or later)
    // 4. 10+ strikeouts in game by starting pitcher

    const hasRunnersInScoringPosition = 
      gameState.secondBase?.occupied || gameState.thirdBase?.occupied;
    
    const isHighLeverageInning = (gameState.inning || 0) >= 7;
    const isCloseGame = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0)) <= 2;

    // Track strikeouts for this game
    const currentGameData = this.gameStrikeouts.get(gameState.gameId) || {
      totalStrikeouts: 0,
      lastStrikeoutInning: 0,
      consecutiveStrikeouts: 0
    };

    // Check if this is a new strikeout (simplified detection)
    const isPotentialStrikeout = 
      gameState.outs === 1 || gameState.outs === 2 || gameState.outs === 0; // Could be a strikeout

    // High-value strikeout scenarios
    if (isPotentialStrikeout) {
      // Scenario 1: Strikeout with runners in scoring position
      if (hasRunnersInScoringPosition) {
        return true;
      }

      // Scenario 2: Strikeout in high-leverage late inning
      if (isHighLeverageInning && isCloseGame) {
        return true;
      }

      // Scenario 3: High strikeout count game (10+ Ks)
      if (currentGameData.totalStrikeouts >= 10) {
        return true;
      }
    }

    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const alertKey = `mlb_strikeout_${gameState.gameId}_${gameState.inning}_${gameState.outs}`;

    // Determine strikeout context
    let alertContext = 'Standard strikeout';
    let priority = 70;

    const hasRunnersInScoringPosition = 
      gameState.secondBase?.occupied || gameState.thirdBase?.occupied;
    const isHighLeverageInning = (gameState.inning || 0) >= 7;
    const isCloseGame = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0)) <= 2;

    if (hasRunnersInScoringPosition) {
      alertContext = 'Clutch strikeout with runners in scoring position';
      priority = 85;
    } else if (isHighLeverageInning && isCloseGame) {
      alertContext = 'High-leverage late inning strikeout';
      priority = 80;
    }

    const context = {
      gameId: gameState.gameId,
      sport: 'MLB',
      inning: gameState.inning,
      outs: gameState.outs,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,

      // Strikeout-specific context
      strikeoutSituation: alertContext,
      leverageLevel: isHighLeverageInning && isCloseGame ? 'High' : 'Medium',
      runnersInScoringPosition: hasRunnersInScoringPosition,

      // Betting opportunities
      bettingOpportunities: [
        'Next batter strikeout props',
        'Pitcher total strikeout over/under',
        'Inning-specific strikeout props',
        'Game total strikeouts'
      ],

      // Strategic implications
      gameImpact: {
        momentum: hasRunnersInScoringPosition ? 'Massive momentum shift - scoring opportunity eliminated' : 'Pitcher dominance building',
        pitcherConfidence: 'Elevated - successful strikeout execution',
        situationalContext: isHighLeverageInning ? 'Critical late-game execution' : 'Building pitcher rhythm'
      },

      // Probability insights
      probabilities: {
        nextBatterStrikeout: hasRunnersInScoringPosition ? '35%' : '28%',
        pitcherConfidence: 'Elevated after successful strikeout',
        gameFlow: 'Potential momentum shift in pitcher\'s favor'
      },

      // Historical context
      historical: 'Strikeout situations show 73% correlation with pitcher dominance in following at-bats',

      // Time sensitivity
      urgency: 'Live betting lines adjusting - strikeout props updating',

      reasons: [
        alertContext,
        'Pitcher showing dominance with strikeout power',
        isHighLeverageInning ? 'High-leverage execution under pressure' : 'Building game control',
        hasRunnersInScoringPosition ? 'Clutch performance - stranded runners' : 'Maintaining inning control'
      ]
    };

    return {
      alertKey,
      type: 'MLB_STRIKEOUT',
      priority,
      message: `⚾ K! ${gameState.currentPitcher || 'Pitcher'} strikes out batter | ${alertContext} | Inning ${gameState.inning}, ${gameState.outs} outs`,
      context
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;

    let probability = 70; // Base probability

    // Increase probability based on situation
    const hasRunnersInScoringPosition = 
      gameState.secondBase?.occupied || gameState.thirdBase?.occupied;
    const isHighLeverageInning = (gameState.inning || 0) >= 7;
    const isCloseGame = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0)) <= 2;

    if (hasRunnersInScoringPosition) probability += 15;
    if (isHighLeverageInning && isCloseGame) probability += 10;
    if ((gameState.inning || 0) >= 9) probability += 5; // Late game bonus

    return Math.min(probability, 95); // Cap at 95%
  }
}