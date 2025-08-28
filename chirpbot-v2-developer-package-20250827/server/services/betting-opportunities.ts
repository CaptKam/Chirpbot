
export interface BettingOpportunity {
  type: 'over_under' | 'moneyline' | 'prop_bet' | 'live_total' | 'team_total';
  confidence: number;
  recommendation: string;
  expectedValue: number;
  unitSize: 1 | 2 | 3 | 4 | 5; // Max 5 units
  market: string;
  odds: string;
  reasoning: string;
  timeWindow: 'immediate' | 'next_inning' | 'game_end';
}

export class BettingAnalyzer {
  static analyzeBettingOpportunities(
    gameState: any,
    hybridAnalysis: any,
    marketOdds?: any
  ): BettingOpportunity[] {
    const opportunities: BettingOpportunity[] = [];
    const { finalProbability, expectedRuns, weatherAnalysis } = hybridAnalysis;
    
    // Live Over/Under Analysis
    if (finalProbability >= 85) {
      opportunities.push({
        type: 'live_total',
        confidence: finalProbability,
        recommendation: `Live Over ${(gameState.homeScore + gameState.awayScore + 1.5).toFixed(1)}`,
        expectedValue: (finalProbability - 80) * 0.1, // Simple EV calculation
        unitSize: finalProbability >= 90 ? 5 : finalProbability >= 85 ? 3 : 2,
        market: 'Total Runs',
        odds: '+110',
        reasoning: `${finalProbability}% scoring probability with ${expectedRuns.toFixed(1)} expected runs`,
        timeWindow: 'immediate'
      });
    }

    // Weather-Based Props
    if (weatherAnalysis.impact === "Moderate" && gameState.currentBatter?.stats.hr >= 15) {
      opportunities.push({
        type: 'prop_bet',
        confidence: 75,
        recommendation: `${gameState.currentBatter.name} Home Run +350`,
        expectedValue: 0.15,
        unitSize: 2,
        market: 'Player Props',
        odds: '+350',
        reasoning: `Power hitter + favorable weather conditions`,
        timeWindow: 'immediate'
      });
    }

    // Pitcher Fatigue Analysis
    if (gameState.currentPitcher?.stats.era >= 4.50 && gameState.inning >= 6) {
      opportunities.push({
        type: 'team_total',
        confidence: 80,
        recommendation: `Batting Team Over 4.5 Runs`,
        expectedValue: 0.12,
        unitSize: 3,
        market: 'Team Total',
        odds: '+105',
        reasoning: `Struggling pitcher (${gameState.currentPitcher.stats.era} ERA) + late-game fatigue`,
        timeWindow: 'next_inning'
      });
    }

    return opportunities;
  }
}
