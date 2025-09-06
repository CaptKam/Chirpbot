// betbookEngine.js
//
// This module encapsulates a new optional “Betbook” engine for ChirpBot v3.  It is
// intended to provide sports betting‑related context and AI‑generated insights
// when a user performs a secondary action on an alert (e.g. sliding the alert
// card to the left).  The core alert system (Levels 1–4) remains free of
// gambling advice—no betting information is included in the primary alert
// message.  Instead, the Betbook engine exposes a function that returns
// supplemental data which can be rendered in a dedicated view.  Because
// third‑party APIs are disabled by default in this environment, the data
// returned by this module is purely illustrative.  Developers should replace
// the stubbed fields with real odds, lines, and recommendations once APIs
// become available.

/**
 * Generate Betbook information for a given alert context.  The context
 * should include enough detail to identify the game, teams and current
 * situation (e.g. sport, gameId, score, inning/period).  The returned
 * object contains odds, a generic AI‑generated statement, and example
 * sportsbook links.  Replace the stubbed values with real data when
 * integrating with a betting odds provider and an AI service.
 *
 * @param {Object} alertContext – Details about the alert (sport, gameId, tier, etc.)
 * @returns {Object} An object with betting data, advice and links.
 */
function getBetbookData(alertContext) {
  // Stubbed odds.  In a real implementation, call an odds API with
  // alertContext.sport and alertContext.gameId to obtain current lines.
  const odds = {
    // Moneyline odds for home and away teams (American format).  Stub values.
    home: -110,
    away: +100,
    // Example over/under line.  Stub value.
    total: 8.5,
  };

  // AI advice placeholder.  Without external API access, we provide a
  // neutral suggestion reminding the user that this is not betting advice.
  const aiAdvice =
    'This game appears evenly matched based on the current situation. Always do your own research before placing a wager.';

  // Example sportsbook links.  These are illustrative; replace with real
  // partner URLs when integrating the Betbook engine into production.
  const sportsbookLinks = [
    { name: 'FanDuel', url: 'https://www.fanduel.com/' },
    { name: 'DraftKings', url: 'https://www.draftkings.com/' },
  ];

  return {
    odds,
    aiAdvice,
    sportsbookLinks,
  };
}

module.exports = {
  getBetbookData,
};