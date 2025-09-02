// Universal UI shape (tiny & future-proof)
export type AlertUI = {
  sport: string;                       // "MLB" | "NBA" | "NFL" | "NHL" | ...
  matchup: string;                     // "Away @ Home"
  score?: string;                      // "3–2" (optional)
  typeLabel: string;                   // "RISP", "POWER PLAY", "RED ZONE", etc.
  confidence?: number;                 // 0–100
  message: string;                     // one-liner, ≤80 chars

  // Footer graphics (all sport visuals consolidated here)
  footerGraphics?: React.ReactNode[]; // small icons/widgets per sport

  // Who's involved (optional)
  people?: { label: string; value: string }[]; // e.g. Batter, On-Deck, Pitcher | Shooter, QB, etc.

  // Footer chips (universal)
  chips?: string[];                    // e.g. ["Top 7th", "⏱ 02:18", "Wind ↑ 12 mph", "Red Zone"]

  // Timestamp
  createdAtISO: string;
};