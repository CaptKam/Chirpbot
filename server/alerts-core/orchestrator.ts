// server/alerts-core/orchestrator.ts
import type { Frame, AlertEvent } from "./types";
import { applyRules } from "./rules";

// Use the existing global deduper (already production-ready)
import { dedup } from "../services/engine-coordinator";

export function processFrame(frame: Frame): AlertEvent[] {
  const candidates = applyRules(frame);
  const emitted: AlertEvent[] = [];

  for (const a of candidates) {
    const fp = dedup.fingerprint(a.kind, {
      gamePk: frame.gamePk,
      inning: frame.inning,
      half: frame.half,
      outs: frame.outs,
      runners: {
        first: !!frame.runners.first,
        second: !!frame.runners.second,
        third: !!frame.runners.third,
      },
      batterId: frame.batterId ?? null,
      onDeckId: frame.onDeckId ?? null,
      windDir: "neutral", // startup phase: no weather bucket
    });

    if (!dedup.shouldEmitFingerprint(fp, a.kind)) {
      continue; // suppressed within lifecycle/cooldown
    }
    emitted.push(a);
  }

  return emitted;
}