export function activeRuleset(): string {
  return process.env.RULESET_ACTIVE || 'ruleset_v1';
}

export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === '1';
}

export function getAlertTTL(): number {
  return parseInt(process.env.ALERT_TTL_SEC || '120', 10);
}