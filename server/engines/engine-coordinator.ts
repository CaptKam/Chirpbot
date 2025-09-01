import { normalizeMLB, normalizeNCAAF } from './normalizer';
import { runRules } from './rule-engine';
import { savePlay, tryInsertAlert, isInCooldown, setCooldown } from '../services/db';
import { pushAlert } from '../services/notifier';
import { activeRuleset } from '../services/feature-flags';
import { shouldSendAdvancedAlert, buildAdvancedDedupKey, calculatePriority } from '../services/advanced-deduplication';
import { generateAiNote, formatAlertMessage } from '../services/ai-notes';

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
    
    // Enhanced processing: add dedup key, priority, and message
    c.dedupKey = buildAdvancedDedupKey(c);
    c.priority = calculatePriority(c);
    c.message = formatAlertMessage(c);
    
    // Use advanced deduplication instead of simple cooldown
    const shouldSend = await shouldSendAdvancedAlert(c);
    if (!shouldSend) {
      console.log(`Alert suppressed by advanced deduplication: ${c.type} for ${c.gameId}`);
      continue;
    }
    
    // Generate AI contextual note (async, non-blocking)
    generateAiNote(c).then(aiNote => {
      if (aiNote) {
        c.aiNote = aiNote;
        console.log(`AI note generated for ${c.type}: ${aiNote.substring(0, 100)}...`);
      }
    }).catch(error => {
      console.error('Failed to generate AI note:', error);
    });
    
    const inserted = await tryInsertAlert(c); // ON CONFLICT DO NOTHING
    if (!inserted) continue;                  // dedup hit

    await pushAlert(c);                       // Telegram/WebSocket
    
    // Optional: Keep legacy cooldown as fallback
    await setCooldown(c);                     // from config/cooldowns.json
  }
}