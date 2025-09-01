import type { CanonicalState, AlertCandidate } from '../../models/contracts';

export function mlbRules_L1(state: CanonicalState, ruleVersion='ruleset_v1'): AlertCandidate[] {
  if (!state.inning) return [];
  const risp = (state.bases?.second || state.bases?.third) === true;
  if (!risp) return [];

  const outs = state.outs ?? 0;
  const phase = `${state.inning.half}${state.inning.num}`; // e.g., T7
  const runners =
    (state.bases?.second ? '2' : '') +
    (state.bases?.third ? '3' : '') || 'NONE';

  const situation = `RISP_${runners}_${outs}OUT`; // e.g., RISP_23_1OUT

  // Simple priority model: more runners + fewer outs -> higher score
  const baseScore = (state.bases?.second?1:0) + (state.bases?.third?1:0);
  let score = 50 + baseScore*20 - outs*10;

  // Weather bump if open roof & out to CF winds bucket recognized
  if (state.weatherBucket?.startsWith('OUT_TO_CF')) score += 10;

  const alert: AlertCandidate = {
    sport: 'MLB',
    gameId: 'unknown', // filled by coordinator
    type: 'HIGH_SCORING_OPP',
    phase,
    situation,
    playerId: state.batterId,
    weatherBucket: state.weatherBucket,
    ruleVersion,
    score,
    context: {
      outs, runners,
      scoreline: state.score
    }
  };
  // the coordinator will compute alert_key and insert
  return [alert];
}