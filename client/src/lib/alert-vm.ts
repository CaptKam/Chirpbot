export type Sport = 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'SOCCER' | 'TENNIS';

export type AlertVM = {
  id: string;
  sport: Sport;
  title: string;                 // e.g., "RISP", "Red Zone", "Power Play"
  situation: string;             // e.g., "2nd & 3rd • 1 out", "1st & 10 @ OPP 22"
  scoreline: string;             // "LAD 3 — NYM 2"
  period: string;                // "Top 7", "Q4 4:12", "3rd 08:22", "Set 2 • 30-40"
  edge: { label: string; value: string }; // RP/WP/xG/TD% etc. e.g., {label:"RP", value:"71%"}
  priority: number;
  actionLine?: string;           // "LIVE BET: Over 0.5 runs this inning"
  tags?: string[];               // ["Wind +18%","Tier A","Red Zone"]
  isNew?: boolean;
  createdAt?: string;
  // Optional sport-specific mini viz (runners diamond, red-zone bar, possession chip...)
  widget?: React.ReactNode;
  actor?: string;                // e.g., "Ohtani", "Mahomes"
};