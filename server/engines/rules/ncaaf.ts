import type { CanonicalState, AlertCandidate } from '../../models/contracts';

export function ncaafRules_L1(state: CanonicalState, ruleVersion='ruleset_v1'): AlertCandidate[] {
  if (!state.clock || !state.fieldPos || !state.downDist) return [];
  const yard = state.fieldPos.yardline ?? 99;
  const redZone = yard <= 20;
  if (!redZone) return [];

  const phase = `Q${state.clock.period}_${state.clock.time ?? '??:??'}`;
  const situation = `RZ_${yard}_YDS_D${state.downDist.down ?? 0}_TG${state.downDist.toGo ?? 0}`;
  let score = 60; // base for red zone
  if ((state.clock.period ?? 1) >= 4) score += 10;              // late game bump
  if ((state.downDist.toGo ?? 10) <= 3) score += 10;            // short to-go bump

  const alert: AlertCandidate = {
    sport: 'NCAAF',
    gameId: 'unknown',
    type: 'RED_ZONE',
    phase,
    situation,
    ruleVersion,
    score,
    context: {
      yardline: yard,
      down: state.downDist.down,
      toGo: state.downDist.toGo,
      scoreline: state.score,
      possession: state.possession
    }
  };
  return [alert];
}