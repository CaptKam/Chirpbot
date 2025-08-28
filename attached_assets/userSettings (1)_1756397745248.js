// userSettings.js
//
// This module demonstrates how to honour per‑user alert preferences when
// deciding whether to emit an alert.  It should be integrated into
// whichever part of your alert engine handles final notification
// dispatch.

/**
 * Check if alerts are globally enabled for a user.
 *
 * @param {object} settings User settings with an `alertsEnabled` flag.
 * @returns {boolean} True if global alerts are enabled.
 */
function isGloballyEnabled(settings) {
  return settings?.alertsEnabled !== false;
}

/**
 * Check whether the user has enabled notifications for a given sport.
 *
 * @param {object} settings User settings with a `sports` map, where
 *   `sports[sport]` can be true/false.
 * @param {string} sport The sport code (e.g. 'MLB', 'NBA').
 * @returns {boolean} True if alerts for this sport are allowed.
 */
function isSportEnabled(settings, sport) {
  if (!settings?.sports) return true;
  const pref = settings.sports[sport];
  return pref !== false;
}

/**
 * Check whether the user has enabled a specific alert tier.  The `tiers`
 * property should map tier numbers (1..4) or tier names to booleans.
 *
 * @param {object} settings User settings with a `tiers` map.
 * @param {number} tier The tier of the alert (1..4).
 * @returns {boolean} True if this tier is allowed.
 */
function isTierEnabled(settings, tier) {
  if (!settings?.tiers) return true;
  const pref = settings.tiers[tier] ?? settings.tiers[`level${tier}`];
  return pref !== false;
}

/**
 * Determine whether the alert should be dispatched to a particular user
 * based on their preferences.  All three checks (global, sport, tier)
 * must be true for an alert to be delivered.
 *
 * @param {object} settings The user’s alert settings.
 * @param {string} sport The sport code (e.g. 'MLB', 'NBA').
 * @param {number} tier The tier of the alert (1..4).
 * @returns {boolean} True if the user should receive this alert.
 */
function shouldNotifyUser(settings, sport, tier) {
  return (
    isGloballyEnabled(settings) &&
    isSportEnabled(settings, sport) &&
    isTierEnabled(settings, tier)
  );
}

/**
 * Check whether the user has enabled the Betbook engine.  The Betbook
 * engine surfaces betting context and AI insights in a secondary view
 * (e.g. a swipe left on an alert).  This preference is separate from
 * the main alert system; even if tiers are enabled, a user may choose
 * to disable Betbook data entirely.  If no `betbookEnabled` flag is
 * provided, Betbook is assumed to be allowed.
 *
 * @param {object} settings User settings with an optional `betbookEnabled` flag.
 * @returns {boolean} True if Betbook data should be shown.
 */
function isBetbookEnabled(settings) {
  // When undefined, default to true so that Betbook features are available
  // unless the user opts out.
  return settings?.betbookEnabled !== false;
}

module.exports = {
  isGloballyEnabled,
  isSportEnabled,
  isTierEnabled,
  shouldNotifyUser,
  isBetbookEnabled,
};

module.exports = {
  isGloballyEnabled,
  isSportEnabled,
  isTierEnabled,
  shouldNotifyUser,
};