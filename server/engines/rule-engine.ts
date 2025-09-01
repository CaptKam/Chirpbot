import type { AlertCandidate, CanonicalState } from '../models/contracts';
import { mlbRules_L1 } from './rules/mlb';
import { ncaafRules_L1 } from './rules/ncaaf';

export function runRules(sport: 'MLB'|'NCAAF', state: CanonicalState, ruleset: string): AlertCandidate[] {
  if (sport === 'MLB') return mlbRules_L1(state, ruleset);
  if (sport === 'NCAAF') return ncaafRules_L1(state, ruleset);
  return [];
}