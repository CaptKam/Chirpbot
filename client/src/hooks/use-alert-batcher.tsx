import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

export type IncomingAlert = {
  id: string;
  type: string;
  priority: number;
  title?: string;
  description?: string;
  createdAt?: string;
  gameInfo?: {
    gamePk?: number;
    inning?: number;
    inningState?: string; // "top"/"bottom"
    paId?: number | string;
    runners?: { first?: boolean; second?: boolean; third?: boolean };
    score?: { home: number; away: number };
    homeTeam?: string; 
    awayTeam?: string;
    tier?: "A"|"B"|"C";
  };
  // Include other fields from existing Alert type
  sport?: string;
  confidence?: number;
  weather?: string;
  aiContext?: string;
  seen?: boolean;
  userId?: string;
};

type Batch = {
  gamePk: number;
  startedAt: number;
  items: IncomingAlert[];
};

const BATCH_WINDOW_MS = 5000;        // group per game for 5s
const DIGEST_THRESHOLD = 6;          // >6 toasts in 10s → digest
const DIGEST_WINDOW_MS = 10000;
const POPUP_TYPES = new Set([
  "BASES_LOADED",
  "EXTRA_INNINGS", 
  "POWER_HITTER_AT_BAT"
]);

function isTierA(a: IncomingAlert) {
  return a.type === "POWER_HITTER_AT_BAT" && a.gameInfo?.tier === "A";
}

function shouldToast(a: IncomingAlert) {
  return (a.priority >= 85) || POPUP_TYPES.has(a.type) || isTierA(a);
}

function entityKey(a: IncomingAlert) {
  const g = a.gameInfo ?? {};
  // PA-scoped when possible; else fall back to game + type
  return `${g.gamePk ?? "-"}:${a.type}:${g.inning ?? "-"}:${g.inningState ?? "-"}:${g.paId ?? "-"}`;
}

function gameLabel(a: IncomingAlert) {
  const g = a.gameInfo ?? {};
  if (g.awayTeam && g.homeTeam) {
    return `${g.awayTeam} @ ${g.homeTeam}`;
  }
  return a.title || "Game Alert";
}

export function useAlertBatcher() {
  const [feed, setFeed] = useState<IncomingAlert[]>([]);
  const batchesRef = useRef<Map<number, Batch>>(new Map());
  const toastHistoryRef = useRef<number[]>([]); // timestamps of toasts
  const visibleRef = useRef<boolean>(true);

  useEffect(() => {
    const onVis = () => { 
      visibleRef.current = !document.hidden; 
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Call this for every incoming alert (e.g., WebSocket onmessage)
  function ingest(a: IncomingAlert) {
    // 1) Merge escalation in place (same entityKey)
    setFeed(prev => {
      const idx = prev.findIndex(x => entityKey(x) === entityKey(a));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          // keep highest priority / latest desc / updated tier
          priority: Math.max(next[idx].priority ?? 0, a.priority ?? 0),
          description: a.description ?? next[idx].description,
          gameInfo: { ...next[idx].gameInfo, ...a.gameInfo },
        };
        // visual cue: optional property to style animation
        (next[idx] as any).__escalated = true;
        return next;
      }
      return [a, ...prev].slice(0, 400);
    });

    // 2) Batch per game for toast decisions
    const gpk = a.gameInfo?.gamePk;
    if (!gpk) {
      // No game info, handle individual alert
      if (shouldToast(a) && visibleRef.current) {
        const now = Date.now();
        toastHistoryRef.current = toastHistoryRef.current.filter(t => now - t < DIGEST_WINDOW_MS);
        const tooMany = toastHistoryRef.current.length >= DIGEST_THRESHOLD;
        
        if (!tooMany) {
          toastHistoryRef.current.push(now);
          toast({
            title: `⚡ ${a.type.replace(/_/g, " ")}`,
            description: a.description || a.title || "New alert",
            duration: 3500,
          });
        }
      }
      return;
    }

    const now = Date.now();
    const batches = batchesRef.current;
    const existing = batches.get(gpk);
    if (!existing || now - existing.startedAt > BATCH_WINDOW_MS) {
      batches.set(gpk, { gamePk: gpk, startedAt: now, items: [a] });
      setTimeout(() => flushBatch(gpk), BATCH_WINDOW_MS + 10);
    } else {
      existing.items.push(a);
    }
  }

  function flushBatch(gamePk: number) {
    const batch = batchesRef.current.get(gamePk);
    if (!batch) return;
    batchesRef.current.delete(gamePk);

    // Decide toast vs silent
    const best = [...batch.items].sort((a,b) => (b.priority||0)-(a.priority||0))[0];

    // Digest guard: if too many toasts recently, summarize instead
    const now = Date.now();
    toastHistoryRef.current = toastHistoryRef.current.filter(t => now - t < DIGEST_WINDOW_MS);
    const wouldToast = shouldToast(best);
    const tooMany = toastHistoryRef.current.length >= DIGEST_THRESHOLD;

    if (!wouldToast || !visibleRef.current) {
      // Silent (or tab hidden) → rely on feed; optional badge increment elsewhere
      return;
    }

    if (tooMany) {
      // One digest toast (don't spam)
      toastHistoryRef.current.push(now);
      const total = batch.items.length;
      toast({
        title: `Live: ${gameLabel(best)}`,
        description: `+${total} alerts in the last ${Math.round(DIGEST_WINDOW_MS/1000)}s • Open to review`,
        duration: 4000,
      });
      return;
    }

    // Normal toast for the best item in this batch
    toastHistoryRef.current.push(now);
    const more = batch.items.length - 1;
    
    // Create formatted description like the current system
    const gameInfo = best.gameInfo || {};
    const score = gameInfo.score ? 
      `${gameInfo.awayTeam} ${gameInfo.score.away} - ${gameInfo.score.home} ${gameInfo.homeTeam}` : 
      gameLabel(best);
    const inningInfo = gameInfo.inning ? 
      `Inning ${gameInfo.inning} ${gameInfo.inningState === 'top' ? '▲' : '▼'}` : '';
    
    toast({
      title: `⚡ ${best.type.replace(/_/g, " ")}`,
      description: (
        <div className="space-y-1">
          <div className="font-semibold">{best.description}</div>
          <div className="text-xs opacity-80">{score}</div>
          {inningInfo && <div className="text-xs opacity-80">{inningInfo}</div>}
          {more > 0 && <div className="text-xs opacity-80">+{more} more in this burst</div>}
        </div>
      ),
      duration: 3500,
    });
  }

  return { feed, ingest };
}