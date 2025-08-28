// supersession.js
//
// Demonstration of alert supersession logic.  This module manages
// context-aware deduplication with tier upgrading.  Only one alert
// is emitted for the same context; if a higher-level alert arrives
// within the cooldown window, it supersedes any lower-level alerts.

/**
 * Map used to store the last emitted tier and timestamp for each
 * context.  Keys should uniquely identify the situation (e.g.,
 * sport:gameId:inning:outs:runners:batter).  Values track the
 * highest tier seen so far and when it was emitted.
 */
const contextMap = new Map();

/**
 * Determine whether a new alert should be emitted based on the
 * supersession rules.  A new alert is emitted if there is no prior
 * record, or if the new tier is higher than the last emitted tier,
 * or if the prior alert is outside of its cooldown window.
 *
 * @param {string} contextKey – The deduplication key for this
 *   situation.
 * @param {number} newTier – The tier of the candidate alert (1–4).
 * @param {number} cooldownMs – The time in milliseconds to wait
 *   before re-alerting on the same context.
 * @returns {boolean} – True if the alert should be emitted.
 */
function shouldEmitNewAlert(contextKey, newTier, cooldownMs) {
  const existing = contextMap.get(contextKey);
  if (!existing) {
    return true;
  }
  const { tier: lastTier, timestamp } = existing;
  const now = Date.now();
  // If the new tier is higher than the last recorded tier, allow upgrade.
  if (newTier > lastTier) {
    return true;
  }
  // Otherwise, check the cooldown window.  Do not emit if within cooldown.
  if (now - timestamp < cooldownMs) {
    return false;
  }
  return true;
}

/**
 * Record a newly emitted alert.  Stores the highest tier and
 * timestamp so future alerts for the same context can be suppressed
 * or upgraded appropriately.
 *
 * @param {string} contextKey – The deduplication key for this
 *   situation.
 * @param {number} tier – The tier of the emitted alert (1–4).
 */
function recordAlert(contextKey, tier) {
  contextMap.set(contextKey, { tier, timestamp: Date.now() });
}

module.exports = {
  shouldEmitNewAlert,
  recordAlert,
};