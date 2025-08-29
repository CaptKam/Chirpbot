// betbookEngine.ts
//
// Optional "Betbook" engine for ChirpBot v3. Provides sports betting context
// and AI-generated insights when user performs secondary action (swipe left).
// Core alert system remains gambling-advice-free.

export interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
}

export interface AlertContext {
  sport: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning?: number;
  period?: string;
  probability?: number;
  priority?: number;
}

/**
 * Generate Betbook information for a given alert context.
 * Returns odds, AI advice, and sportsbook links.
 * 
 * Note: Currently returns stubbed data. Replace with real API calls
 * when integrating with betting odds providers.
 */
export function getBetbookData(alertContext: AlertContext): BetbookData {
  // Stubbed odds - replace with real odds API
  const odds = {
    home: -110 + Math.floor(Math.random() * 40) - 20, // Vary by ±20
    away: +100 + Math.floor(Math.random() * 40) - 20,
    total: 8.5 + (Math.random() - 0.5) * 2, // Vary by ±1
  };

  // Generate contextual AI advice based on alert
  let aiAdvice = 'This game appears evenly matched based on the current situation.';
  
  if (alertContext.probability && alertContext.probability > 0.75) {
    aiAdvice = `High scoring probability (${Math.round(alertContext.probability * 100)}%) detected. Consider live betting opportunities, but always do your own research.`;
  } else if (alertContext.priority && alertContext.priority >= 90) {
    aiAdvice = `High priority alert indicates significant game momentum. Monitor live lines for value opportunities.`;
  } else if (alertContext.sport === 'MLB' && alertContext.inning && alertContext.inning >= 7) {
    aiAdvice = 'Late inning action can create volatile betting lines. Consider in-game wagering with caution.';
  }

  // Add standard disclaimer
  aiAdvice += ' Always gamble responsibly and within your means.';

  // Example sportsbook links - replace with real partner URLs
  const sportsbookLinks = [
    { name: 'FanDuel', url: 'https://www.fanduel.com/' },
    { name: 'DraftKings', url: 'https://www.draftkings.com/' },
    { name: 'BetMGM', url: 'https://www.betmgm.com/' },
    { name: 'Caesars', url: 'https://www.caesars.com/sportsbook' },
  ];

  return {
    odds,
    aiAdvice,
    sportsbookLinks,
  };
}

/**
 * Check if Betbook should be available for this alert context
 */
export function shouldShowBetbook(alertContext: AlertContext): boolean {
  // Only show for live games with reasonable probability
  const isLiveGame = Boolean(alertContext.gameId) && (alertContext.homeScore >= 0 || alertContext.awayScore >= 0);
  const hasReasonableProbability = !alertContext.probability || alertContext.probability >= 0.6;
  
  return isLiveGame && hasReasonableProbability;
}