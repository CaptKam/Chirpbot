import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


export default class ScoringPlayModule extends BaseAlertModule {
  alertType = 'NCAAF_SCORING_PLAY';
  sport = 'NCAAF';
  
  // Track scores to detect changes
  private lastScores: Map<string, { home: number, away: number }> = new Map();

  isTriggered(gameState: GameState): boolean {
    console.log(`🔍 NCAAF Scoring Play check for ${gameState.gameId}: status=${gameState.status}, scores=${gameState.homeScore}-${gameState.awayScore}`);
    
    // Must be a live game
    if (gameState.status !== 'live') {
      console.log(`❌ Scoring Play: Game not live (${gameState.status})`);
      return false;
    }
    
    const gameId = gameState.gameId;
    const lastScore = this.lastScores.get(gameId);
    const currentHome = gameState.homeScore || 0;
    const currentAway = gameState.awayScore || 0;
    
    // First time seeing this game - initialize but don't trigger
    if (!lastScore) {
      this.lastScores.set(gameId, { home: currentHome, away: currentAway });
      console.log(`📊 Scoring Play: Initial score tracked for ${gameId}: ${currentHome}-${currentAway}`);
      return false;
    }
    
    // Check if score changed
    const scoreChanged = (lastScore.home !== currentHome) || (lastScore.away !== currentAway);
    
    if (scoreChanged) {
      console.log(`🎯 NCAAF SCORING PLAY TRIGGERED! Old: ${lastScore.home}-${lastScore.away}, New: ${currentHome}-${currentAway}`);
      // Update tracked scores
      this.lastScores.set(gameId, { home: currentHome, away: currentAway });
      return true;
    }
    
    console.log(`❌ Scoring Play: No score change detected`);
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const homeScore = gameState.homeScore || 0;
    const awayScore = gameState.awayScore || 0;
    
    // Determine who scored
    const lastScore = this.lastScores.get(gameState.gameId);
    let scoringTeam = '';
    let points = 0;
    
    if (lastScore) {
      if (homeScore > lastScore.home) {
        scoringTeam = gameState.homeTeam;
        points = homeScore - lastScore.home;
      } else if (awayScore > lastScore.away) {
        scoringTeam = gameState.awayTeam;
        points = awayScore - lastScore.away;
      }
    }
    
    return {
      alertKey: `${gameState.gameId}_scoring_${homeScore}_${awayScore}_${Date.now()}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | SCORING PLAY`,
      displayMessage: `🏈 NCAAF SCORING PLAY | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore,
        awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
        down: gameState.down || null,
        yardsToGo: gameState.yardsToGo || null,
        fieldPosition: gameState.fieldPosition || null,
        possession: gameState.possession || scoringTeam,
        scoringTeam,
        pointsScored: points
      },
      priority: 85
    };
  }

  calculateProbability(gameState: GameState): number {
    if (!this.isTriggered(gameState)) return 0;
    return 100; // Certain when score changes
  }
}