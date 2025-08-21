// server/alerts-core/types.ts
export type Half = "top" | "bottom";

export type Frame = {
  gamePk: number;
  inning: number;
  half: Half;
  outs: 0 | 1 | 2;
  runners: { first: boolean; second: boolean; third: boolean };
  score: { home: number; away: number };
  batterId?: number | null;
  onDeckId?: number | null;
  // optional basics only — NO AI/NO weather in startup phase
};

export type AlertEvent = {
  kind: string;              // "RISP", "BASES_LOADED_0", "TIE_9TH", etc.
  priority: number;          // 0..100 (flat, deterministic)
  title: string;             // human-readable title
  description: string;       // short context line
};