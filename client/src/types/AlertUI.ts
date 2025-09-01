// Universal Alert UI Contract - All sports must map to this minimal shape before rendering
export type AlertUI = {
  sport: string;                       // "MLB" | "NBA" | "NFL" | "NHL" | ...
  matchup: string;                     // "Away @ Home"
  score?: string;                      // "3–2" (optional)
  typeLabel: string;                   // "RISP", "POWER PLAY", "RED ZONE", etc.
  confidence?: number;                 // 0–100
  message: string;                     // one-liner, ≤80 chars

  // Quick-glance visuals (all optional, render if present)
  bases?: { on1?: boolean; on2?: boolean; on3?: boolean };  // MLB only
  pips?: { label: string; filled: number; total: number }[]; // e.g. Balls/Strikes/Outs OR Fouls/TOs

  // Who's involved (optional)
  people?: { label: string; value: string }[]; // e.g. Batter, On-Deck, Pitcher | Shooter, QB, etc.

  // Footer chips (universal)
  chips?: string[];                    // e.g. ["Top 7th", "⏱ 02:18", "Wind ↑ 12 mph", "Red Zone"]

  // Timestamp
  createdAtISO: string;
};