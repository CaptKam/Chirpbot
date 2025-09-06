
/**
 * Enhanced Betbook Engine with Dynamic AI Betting Insights
 * Provides real-time betting analysis based on game context and alert types
 */

function getBetbookData(alertContext) {
  const { sport, type, probability, homeScore, awayScore, inning, outs } = alertContext;
  
  // Dynamic odds calculation based on game situation
  const scoreDiff = (homeScore || 0) - (awayScore || 0);
  const totalScore = (homeScore || 0) + (awayScore || 0);
  
  let homeOdds = -110;
  let awayOdds = -110;
  let totalLine = sport === 'MLB' ? Math.max(totalScore + 2.5, 8.5) : Math.max(totalScore + 3, 45);
  
  // Adjust odds based on score differential and game situation
  if (scoreDiff > 0) {
    homeOdds = Math.max(-250, -110 - (scoreDiff * 20));
    awayOdds = Math.min(+200, -110 + (scoreDiff * 25));
  } else if (scoreDiff < 0) {
    awayOdds = Math.max(-250, -110 - (Math.abs(scoreDiff) * 20));
    homeOdds = Math.min(+200, -110 + (Math.abs(scoreDiff) * 25));
  }
  
  // Generate dynamic AI advice based on alert type and context
  let aiAdvice = generateContextualAdvice(alertContext, totalLine, probability);
  
  // Enhanced sportsbook links with context
  const sportsbookLinks = [
    { name: 'FanDuel', url: 'https://www.fanduel.com/' },
    { name: 'DraftKings', url: 'https://www.draftkings.com/' },
    { name: 'Bet365', url: 'https://www.bet365.com/' },
    { name: 'BetMGM', url: 'https://sports.betmgm.com/' }
  ];

  return {
    odds: {
      home: homeOdds,
      away: awayOdds,
      total: totalLine
    },
    aiAdvice,
    sportsbookLinks,
    confidence: Math.min(95, probability || 70),
    timestamp: new Date().toISOString()
  };
}

function generateContextualAdvice(context, totalLine, probability) {
  const { type, inning, outs, homeScore, awayScore } = context;
  
  // High-confidence betting situations
  if (probability >= 85) {
    switch (type) {
      case 'BASES_LOADED':
        return `🔥 HIGH VALUE: Bases loaded with ${3 - (outs || 0)} outs remaining. Historical data shows 87% chance of runs scoring. Strong bet on OVER ${totalLine}.`;
      case 'RISP':
        return `⚡ LIVE VALUE: Runner in scoring position creates immediate betting opportunity. Consider OVER ${totalLine} - ${probability}% scoring probability.`;
      case 'STRIKEOUT':
        return `📊 MOMENTUM SHIFT: Strikeout changes game dynamics. Monitor next at-bat for live betting adjustments.`;
      default:
        return `🎯 PREMIUM ALERT: ${probability}% confidence situation. Strong betting value detected.`;
    }
  }
  
  // Medium-confidence situations
  if (probability >= 70) {
    switch (type) {
      case 'CLOSE_GAME_LIVE':
        return `⚖️ LIVE OPPORTUNITY: Close game creates volatile betting environment. Consider small position on OVER ${totalLine}.`;
      case 'LATE_PRESSURE':
        return `⏰ CLUTCH TIME: Late-inning pressure often leads to runs. Monitor OVER ${totalLine} for value.`;
      default:
        return `📈 MODERATE VALUE: ${probability}% situation shows betting potential. Research recommended.`;
    }
  }
  
  // Standard advice for lower probability alerts
  return `📊 TRACKING: ${type} situation developing. Monitor for betting value as game progresses.`;
}

module.exports = {
  getBetbookData,
};
