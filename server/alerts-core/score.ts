// server/alerts-core/score.ts
import type { Frame } from "./types";

// Transparent, small, deterministic scoring used by rules.
// Startup phase: simple RISP + leverage; no AI, no weather.
export function basePriority(frame: Frame): number {
  const { outs, inning, runners } = frame;

  let p = 50; // base
  // RISP boost
  const risp = +!!runners.second + +!!runners.third;
  if (risp === 1) p += 20;
  if (risp === 2) p += 30;
  if (runners.first && runners.second && runners.third) p += 35; // bases loaded

  // Out leverage (fewer outs → higher)
  if (outs === 0) p += 12;
  if (outs === 1) p += 6;

  // Late innings leverage
  if (inning >= 7) p += 8;

  // clamp
  return Math.max(0, Math.min(100, p));
}