import { normalizeMLB, normalizeNCAAF } from './normalizer';
import { runRules } from './rule-engine';
import { savePlay, tryInsertAlert, isInCooldown, setCooldown } from '../services/db';
import { pushAlert } from '../services/notifier';
import { activeRuleset } from '../services/feature-flags';

export async function processRawTick(sport: 'MLB'|'NCAAF', gameId: string, raw: any) {
  const norm = sport === 'MLB' ? normalizeMLB(raw) : normalizeNCAAF(raw);
  if (norm.state.status !== 'LIVE') return;

  await savePlay(sport, gameId, norm.ts, raw); // append only

  const candidates = runRules(sport, norm.state, activeRuleset());
  
  // Debug logging for rule engine
  if (candidates.length) {
    console.log('[rule_fired]', { 
      sport, 
      gameId, 
      n: candidates.length, 
      types: candidates.map(x => x.type) 
    });
  }
  
  for (const c of candidates) {
    // Fill in the gameId that was passed to us
    c.gameId = gameId;
    
    const inserted = await tryInsertAlert(c); // ON CONFLICT DO NOTHING
    if (!inserted) continue;                  // dedup hit

    const inCd = await isInCooldown(c);
    if (inCd) continue;                       // suppressed by cooldown

    await pushAlert(c);                       // Telegram/WebSocket
    await setCooldown(c);                     // from config/cooldowns.json
  }
}