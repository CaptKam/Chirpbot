// userSettings.ts
//
// Module for handling per-user alert preferences when deciding 
// whether to emit an alert. Integrates with ChirpBot v3 4-tier system.

export interface UserSettings {
  alertsEnabled?: boolean;
  sports?: { [sport: string]: boolean };
  tiers?: { [tier: string]: boolean };
  betbookEnabled?: boolean;
}

/**
 * Check if alerts are globally enabled for a user.
 */
export function isGloballyEnabled(settings: UserSettings | null | undefined): boolean {
  return settings?.alertsEnabled !== false;
}

/**
 * Check whether the user has enabled notifications for a given sport.
 */
export function isSportEnabled(settings: UserSettings | null | undefined, sport: string): boolean {
  if (!settings?.sports) return true;
  const pref = settings.sports[sport];
  return pref !== false;
}

/**
 * Check whether the user has enabled a specific alert tier.
 */
export function isTierEnabled(settings: UserSettings | null | undefined, tier: number): boolean {
  if (!settings?.tiers) return true;
  const pref = settings.tiers[tier] ?? settings.tiers[`level${tier}`];
  return pref !== false;
}

/**
 * Determine whether the alert should be dispatched to a particular user
 * based on their preferences. All three checks must be true.
 */
export function shouldNotifyUser(
  settings: UserSettings | null | undefined, 
  sport: string, 
  tier: number
): boolean {
  return (
    isGloballyEnabled(settings) &&
    isSportEnabled(settings, sport) &&
    isTierEnabled(settings, tier)
  );
}

/**
 * Check whether the user has enabled the Betbook engine.
 */
export function isBetbookEnabled(settings: UserSettings | null | undefined): boolean {
  return settings?.betbookEnabled !== false;
}