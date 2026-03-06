import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, Bot, TrendingUp, Smartphone, ChevronDown, Zap, ExternalLink, Shield } from 'lucide-react';
import { parseISO } from 'date-fns';

const formatTimeAgo = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    if (daysAgo < 7) return `${daysAgo}d ago`;
    return `${Math.floor(daysAgo / 7)}w ago`;
  } catch {
    return 'Unknown';
  }
};

const removeNcaafMascot = (teamName: string, sport?: string) => {
  if (!teamName || sport !== 'NCAAF') return teamName;
  const mascots = [
    'Tigers', 'Bulldogs', 'Crimson Tide', 'Volunteers', 'Gators', 'Wildcats',
    'Aggies', 'Longhorns', 'Sooners', 'Trojans', 'Bruins', 'Cardinal',
    'Fighting Irish', 'Seminoles', 'Hurricanes', 'Cavaliers', 'Yellow Jackets',
    'Blue Devils', 'Demon Deacons', 'Tar Heels', 'Wolfpack', 'Orange',
    'Eagles', 'Panthers', 'Cardinals', 'Badgers', 'Hawkeyes', 'Cornhuskers',
    'Wolverines', 'Buckeyes', 'Nittany Lions', 'Spartans', 'Hoosiers',
    'Boilermakers', 'Terrapins', 'Scarlet Knights', 'Golden Gophers',
    'Illini', 'Horned Frogs', 'Red Raiders', 'Mountaineers', 'Cowboys',
    'Jayhawks', 'Cyclones', 'Bears', 'Ducks', 'Beavers', 'Huskies',
    'Cougars', 'Sun Devils', 'Utes', 'Buffaloes', 'Knights', 'Bulls',
    'Bearcats', 'Rebels', 'Rainbow Warriors', 'Aztecs', 'Broncos', 'Mustangs',
    'Mean Green', 'Owls', 'Golden Panthers', 'Blazers', 'Roadrunners'
  ];
  for (const mascot of mascots) {
    if (teamName.endsWith(mascot)) return teamName.replace(mascot, '').trim();
  }
  return teamName;
};

// Get team abbreviation from full name
const getTeamAbbr = (name: string): string => {
  if (!name) return '???';
  // Common abbreviation mappings
  const abbrMap: Record<string, string> = {
    'New York Yankees': 'NYY', 'Boston Red Sox': 'BOS', 'Los Angeles Dodgers': 'LAD',
    'San Francisco Giants': 'SF', 'Houston Astros': 'HOU', 'Texas Rangers': 'TEX',
    'Chicago Cubs': 'CHC', 'St. Louis Cardinals': 'STL', 'Atlanta Braves': 'ATL',
    'Philadelphia Phillies': 'PHI', 'San Diego Padres': 'SD', 'Los Angeles Angels': 'LAA',
    'Seattle Mariners': 'SEA', 'Toronto Blue Jays': 'TOR', 'Tampa Bay Rays': 'TB',
    'Baltimore Orioles': 'BAL', 'Minnesota Twins': 'MIN', 'Cleveland Guardians': 'CLE',
    'Detroit Tigers': 'DET', 'Chicago White Sox': 'CWS', 'Kansas City Royals': 'KC',
    'Milwaukee Brewers': 'MIL', 'Pittsburgh Pirates': 'PIT', 'Cincinnati Reds': 'CIN',
    'Arizona Diamondbacks': 'ARI', 'Colorado Rockies': 'COL', 'Miami Marlins': 'MIA',
    'Washington Nationals': 'WSH', 'New York Mets': 'NYM', 'Oakland Athletics': 'OAK',
    // NFL
    'Kansas City Chiefs': 'KC', 'Buffalo Bills': 'BUF', 'Philadelphia Eagles': 'PHI',
    'Dallas Cowboys': 'DAL', 'San Francisco 49ers': 'SF', 'Green Bay Packers': 'GB',
    'Baltimore Ravens': 'BAL', 'Cincinnati Bengals': 'CIN', 'Miami Dolphins': 'MIA',
    'New England Patriots': 'NE', 'Los Angeles Rams': 'LAR', 'Los Angeles Chargers': 'LAC',
    'Denver Broncos': 'DEN', 'Pittsburgh Steelers': 'PIT', 'Cleveland Browns': 'CLE',
    'Detroit Lions': 'DET', 'Minnesota Vikings': 'MIN', 'Chicago Bears': 'CHI',
    'Jacksonville Jaguars': 'JAX', 'Tennessee Titans': 'TEN', 'Indianapolis Colts': 'IND',
    'Houston Texans': 'HOU', 'New York Giants': 'NYG', 'New York Jets': 'NYJ',
    'Washington Commanders': 'WAS', 'Carolina Panthers': 'CAR', 'Tampa Bay Buccaneers': 'TB',
    'New Orleans Saints': 'NO', 'Atlanta Falcons': 'ATL', 'Seattle Seahawks': 'SEA',
    'Arizona Cardinals': 'ARI', 'Las Vegas Raiders': 'LV',
    // NBA
    'Los Angeles Lakers': 'LAL', 'Golden State Warriors': 'GSW', 'Boston Celtics': 'BOS',
    'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Denver Nuggets': 'DEN',
    'Phoenix Suns': 'PHX', 'Philadelphia 76ers': 'PHI', 'Brooklyn Nets': 'BKN',
    'New York Knicks': 'NYK', 'Dallas Mavericks': 'DAL', 'Memphis Grizzlies': 'MEM',
    'Sacramento Kings': 'SAC', 'Cleveland Cavaliers': 'CLE', 'Toronto Raptors': 'TOR',
    'Chicago Bulls': 'CHI', 'Atlanta Hawks': 'ATL', 'Minnesota Timberwolves': 'MIN',
    'Oklahoma City Thunder': 'OKC', 'New Orleans Pelicans': 'NOP',
    'Indiana Pacers': 'IND', 'Portland Trail Blazers': 'POR',
    'San Antonio Spurs': 'SAS', 'Utah Jazz': 'UTA', 'Orlando Magic': 'ORL',
    'Washington Wizards': 'WAS', 'Charlotte Hornets': 'CHA', 'Houston Rockets': 'HOU',
    'Detroit Pistons': 'DET', 'Los Angeles Clippers': 'LAC',
  };
  return abbrMap[name] || name.split(' ').pop()?.substring(0, 3).toUpperCase() || name.substring(0, 3).toUpperCase();
};

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Sport-specific design tokens
const sportTokens: Record<string, {
  accent: string; accentBg: string; accentBorder: string;
  accentGlow: string; borderGlow: string;
  icon: string; label: string; textClass: string;
}> = {
  MLB: {
    accent: '#22C55E', accentBg: 'rgba(34,197,94,0.07)', accentBorder: 'rgba(34,197,94,0.25)',
    accentGlow: '0 0 30px rgba(34,197,94,0.15), 0 0 60px rgba(34,197,94,0.05)',
    borderGlow: 'rgba(34,197,94,0.35)',
    icon: '\u26be', label: 'MLB', textClass: 'text-green-400',
  },
  NFL: {
    accent: '#F97316', accentBg: 'rgba(249,115,22,0.07)', accentBorder: 'rgba(249,115,22,0.25)',
    accentGlow: '0 0 30px rgba(249,115,22,0.15), 0 0 60px rgba(249,115,22,0.05)',
    borderGlow: 'rgba(249,115,22,0.35)',
    icon: '\ud83c\udfc8', label: 'NFL', textClass: 'text-orange-400',
  },
  NBA: {
    accent: '#A855F7', accentBg: 'rgba(168,85,247,0.07)', accentBorder: 'rgba(168,85,247,0.25)',
    accentGlow: '0 0 30px rgba(168,85,247,0.15), 0 0 60px rgba(168,85,247,0.05)',
    borderGlow: 'rgba(168,85,247,0.35)',
    icon: '\ud83c\udfc0', label: 'NBA', textClass: 'text-purple-400',
  },
  NHL: {
    accent: '#06B6D4', accentBg: 'rgba(6,182,212,0.07)', accentBorder: 'rgba(6,182,212,0.25)',
    accentGlow: '0 0 30px rgba(6,182,212,0.15), 0 0 60px rgba(6,182,212,0.05)',
    borderGlow: 'rgba(6,182,212,0.35)',
    icon: '\ud83c\udfd2', label: 'NHL', textClass: 'text-cyan-400',
  },
  NCAAF: {
    accent: '#3B82F6', accentBg: 'rgba(59,130,246,0.07)', accentBorder: 'rgba(59,130,246,0.25)',
    accentGlow: '0 0 30px rgba(59,130,246,0.15), 0 0 60px rgba(59,130,246,0.05)',
    borderGlow: 'rgba(59,130,246,0.35)',
    icon: '\ud83c\udfc8', label: 'NCAAF', textClass: 'text-blue-400',
  },
  WNBA: {
    accent: '#EC4899', accentBg: 'rgba(236,72,153,0.07)', accentBorder: 'rgba(236,72,153,0.25)',
    accentGlow: '0 0 30px rgba(236,72,153,0.15), 0 0 60px rgba(236,72,153,0.05)',
    borderGlow: 'rgba(236,72,153,0.35)',
    icon: '\ud83c\udfc0', label: 'WNBA', textClass: 'text-pink-400',
  },
  CFL: {
    accent: '#EF4444', accentBg: 'rgba(239,68,68,0.07)', accentBorder: 'rgba(239,68,68,0.25)',
    accentGlow: '0 0 30px rgba(239,68,68,0.15), 0 0 60px rgba(239,68,68,0.05)',
    borderGlow: 'rgba(239,68,68,0.35)',
    icon: '\ud83c\udfc8', label: 'CFL', textClass: 'text-red-400',
  },
};

const defaultTokens = {
  accent: '#94A3B8', accentBg: 'rgba(148,163,184,0.07)', accentBorder: 'rgba(148,163,184,0.15)',
  accentGlow: '0 0 24px rgba(148,163,184,0.08)', borderGlow: 'rgba(148,163,184,0.20)',
  icon: '\u2b50', label: 'SPORT', textClass: 'text-slate-400',
};

// ─── Team Logo Circle ───
function TeamLogo({ teamName, accent, size = 56 }: { teamName: string; accent: string; size?: number }) {
  const abbr = getTeamAbbr(teamName);
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))`,
        border: `2px solid rgba(255,255,255,0.08)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <span className="score-display text-xs text-slate-300" style={{ letterSpacing: '0.02em' }}>{abbr}</span>
    </div>
  );
}

// ─── Outs indicator dots (like the mockup) ───
function OutsDots({ count = 0 }: { count: number }) {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i < count ? '#22C55E' : 'transparent',
          border: `2px solid ${i < count ? '#22C55E' : 'rgba(255,255,255,0.15)'}`,
          boxShadow: i < count ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
        }} />
      ))}
    </div>
  );
}

// ─── Baseball Diamond SVG (matching mockup style) ───
function DiamondVisual({ runners = { first: false, second: false, third: false } }: {
  runners: { first?: boolean; second?: boolean; third?: boolean };
}) {
  const sz = 72;
  const m = sz / 2;
  const d = 10; // diamond size
  const active = '#22C55E';
  const inactive = 'rgba(255,255,255,0.12)';
  const activeBorder = '#16A34A';
  const inactiveBorder = 'rgba(255,255,255,0.20)';

  return (
    <div className="flex flex-col items-center">
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
        {/* Diamond lines */}
        <line x1={m} y1={8} x2={sz - 8} y2={m} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={sz - 8} y1={m} x2={m} y2={sz - 8} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={m} y1={sz - 8} x2={8} y2={m} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={8} y1={m} x2={m} y2={8} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Home plate */}
        <rect x={m - d / 2} y={sz - 8 - d / 2} width={d} height={d}
          fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth="1"
          transform={`rotate(45 ${m} ${sz - 8})`} />

        {/* 1st base (right) */}
        <rect x={sz - 8 - d / 2} y={m - d / 2} width={d} height={d}
          fill={runners.first ? active : 'rgba(255,255,255,0.04)'}
          stroke={runners.first ? activeBorder : inactiveBorder} strokeWidth="1.5"
          transform={`rotate(45 ${sz - 8} ${m})`} />

        {/* 2nd base (top) */}
        <rect x={m - d / 2} y={8 - d / 2} width={d} height={d}
          fill={runners.second ? active : 'rgba(255,255,255,0.04)'}
          stroke={runners.second ? activeBorder : inactiveBorder} strokeWidth="1.5"
          transform={`rotate(45 ${m} 8)`} />

        {/* 3rd base (left) */}
        <rect x={8 - d / 2} y={m - d / 2} width={d} height={d}
          fill={runners.third ? active : 'rgba(255,255,255,0.04)'}
          stroke={runners.third ? activeBorder : inactiveBorder} strokeWidth="1.5"
          transform={`rotate(45 8 ${m})`} />
      </svg>
      <span className="text-[9px] text-slate-500 font-display tracking-wider uppercase mt-0.5">Diamond</span>
    </div>
  );
}

interface UniversalAlertProps {
  id: string;
  type: string;
  message: string;
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  confidence: number;
  priority: number;
  createdAt: string;
  homeScore?: number;
  awayScore?: number;
  context?: any;
  sentToTelegram?: boolean;
  weather?: any;
  gameInfo?: any;
  gamblingInsights?: {
    structuredTemplate?: string;
    bullets?: string[];
    confidence?: number;
    tags?: string[];
  };
  hasComposerEnhancement?: boolean;
}

export function UniversalAlertCard({ alert, showEnhancements = false }: { alert: UniversalAlertProps; showEnhancements?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const tokens = sportTokens[alert.sport] || defaultTokens;
  const isHighPriority = alert.priority > 80;

  const presentation = alert.context?.presentation;
  const displayTitle = presentation?.title || alert.message;
  const displayBody = presentation?.body;
  const displayConfidence = presentation?.confidence || alert.gamblingInsights?.confidence || alert.confidence || 0;
  const confidencePercent = displayConfidence > 1 ? Math.min(100, Math.round(displayConfidence)) : Math.round(displayConfidence * 100);
  const aiInsights = alert.context?.aiInsights || [];
  const aiTitle = alert.context?.aiTitle;

  const displayAwayTeam = removeNcaafMascot(alert.awayTeam, alert.sport);
  const displayHomeTeam = removeNcaafMascot(alert.homeTeam, alert.sport);
  const hasScores = alert.awayScore !== undefined && alert.homeScore !== undefined;

  const awayAbbr = getTeamAbbr(displayAwayTeam);
  const homeAbbr = getTeamAbbr(displayHomeTeam);

  // Runner description text
  const getRunnerText = () => {
    const ctx = alert.context;
    if (!ctx) return null;
    const on: string[] = [];
    if (ctx.hasFirst) on.push('1st');
    if (ctx.hasSecond) on.push('2nd');
    if (ctx.hasThird) on.push('3rd');
    if (on.length === 0) return null;
    if (on.length === 3) return 'Bases Loaded';
    return `Runners on ${on.join(' & ')}`;
  };

  // Game period text
  const getPeriodText = () => {
    const ctx = alert.context;
    if (!ctx) return null;
    if (alert.sport === 'MLB' && ctx.inning) {
      return `${ctx.isTopInning ? 'Top' : 'Bottom'} ${ord(ctx.inning)}`;
    }
    if ((alert.sport === 'NFL' || alert.sport === 'NCAAF' || alert.sport === 'CFL') && ctx.quarter) {
      return `Q${ctx.quarter}${ctx.timeRemaining ? ' · ' + ctx.timeRemaining : ''}`;
    }
    if ((alert.sport === 'NBA' || alert.sport === 'WNBA') && ctx.quarter) {
      return `Q${ctx.quarter}${ctx.timeRemaining ? ' · ' + ctx.timeRemaining : ''}`;
    }
    if (alert.sport === 'NHL' && ctx.period) {
      return `P${ctx.period}${ctx.timeRemaining ? ' · ' + ctx.timeRemaining : ''}`;
    }
    return null;
  };

  const periodText = getPeriodText();
  const runnerText = getRunnerText();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ═══ Main Card — Full glowing border like mockup ═══ */}
      <div
        className={`rounded-2xl overflow-hidden ${isHighPriority ? 'animate-glow-pulse' : ''}`}
        style={{
          background: '#0E1318',
          border: `1.5px solid ${tokens.borderGlow}`,
          boxShadow: tokens.accentGlow,
        }}
      >
        {/* ─── Scoreboard Section ─── */}
        <div className="px-5 pt-5 pb-4">
          {/* LIVE badge — top right */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={`font-display text-[11px] font-bold uppercase tracking-[0.10em] ${tokens.textClass}`}>
                {alert.sport} Live Alert
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {alert.sentToTelegram && (
                <Smartphone className="w-3.5 h-3.5 text-blue-400/50 mr-1" />
              )}
              <span className="animate-live-pulse w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              <span className="text-[11px] font-bold text-red-400 font-display tracking-wider">LIVE</span>
            </div>
          </div>

          {/* ─── Team Logos + Score ─── */}
          <div className="flex items-center justify-between mb-4">
            {/* Away team */}
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <TeamLogo teamName={displayAwayTeam} accent={tokens.accent} size={56} />
              <span className="font-display text-sm font-bold text-white tracking-wide">{awayAbbr}</span>
            </div>

            {/* Score center */}
            <div className="flex flex-col items-center gap-1.5 px-2">
              {hasScores ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="score-display text-4xl text-white animate-roll-up">{alert.awayScore}</span>
                    <span className="text-lg text-slate-600 font-light">-</span>
                    <span className="score-display text-4xl text-white animate-roll-up">{alert.homeScore}</span>
                  </div>
                  {periodText && (
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-display"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94A3B8',
                      }}
                    >
                      {periodText}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-xl text-slate-500 font-display">@</span>
                  {periodText && (
                    <span className="text-[10px] text-slate-500 font-display">{periodText}</span>
                  )}
                </>
              )}
            </div>

            {/* Home team */}
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <TeamLogo teamName={displayHomeTeam} accent={tokens.accent} size={56} />
              <span className="font-display text-sm font-bold text-white tracking-wide">{homeAbbr}</span>
            </div>
          </div>

          {/* ─── MLB: Diamond + Outs + Runner text ─── */}
          {alert.sport === 'MLB' && alert.context && (alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird || alert.context.outs !== undefined) && (
            <div className="flex items-center gap-5 justify-center mb-4 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <DiamondVisual runners={{
                first: alert.context.hasFirst,
                second: alert.context.hasSecond,
                third: alert.context.hasThird,
              }} />

              <div className="flex flex-col gap-2">
                {/* Outs dots */}
                {alert.context.outs !== undefined && (
                  <div className="flex items-center gap-2">
                    <OutsDots count={alert.context.outs} />
                    <span className="text-xs text-slate-400 font-display">{alert.context.outs} Outs</span>
                  </div>
                )}
                {/* Runner description */}
                {runnerText && (
                  <span className="text-sm font-bold text-white font-display">{runnerText}</span>
                )}
                {/* Count */}
                {(alert.context.balls !== undefined || alert.context.strikes !== undefined) && (
                  <span className="score-display text-xs text-emerald-400">
                    Count: {alert.context.balls ?? 0}-{alert.context.strikes ?? 0}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ─── NFL/NCAAF/CFL: Down & Distance + Field Position ─── */}
          {(alert.sport === 'NFL' || alert.sport === 'NCAAF' || alert.sport === 'CFL') && alert.context?.down && (
            <div className="flex items-center justify-center gap-3 mb-4 py-3 flex-wrap"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white font-display"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo}
              </span>
              {alert.context.fieldPosition && (
                <span className="text-xs text-slate-400 font-display">
                  at {alert.context.fieldPosition}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── Gambling Insight Panel ─── */}
        {(aiInsights.length > 0 || alert.context?.scoringProbability || confidencePercent > 0) && (
          <div className="mx-4 mb-4 rounded-xl overflow-hidden"
            style={{ border: `1px solid ${tokens.accentBorder}`, background: tokens.accentBg }}>
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 mb-3">
                <Shield className={`w-4 h-4 ${tokens.textClass}`} />
                <span className={`font-display text-[11px] font-bold uppercase tracking-[0.10em] ${tokens.textClass}`}>
                  Gambling Insight
                </span>
              </div>

              {/* Stats rows */}
              <div className="space-y-2">
                {alert.context?.scoringProbability && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-display">Scoring Probability</span>
                    <span className={`score-display text-sm font-bold ${tokens.textClass}`}>
                      {Math.round(alert.context.scoringProbability * 100)}%
                    </span>
                  </div>
                )}
                {confidencePercent > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-display">Win Probability ({awayAbbr})</span>
                    <span className={`score-display text-sm font-bold ${tokens.textClass}`}>
                      {confidencePercent}%
                    </span>
                  </div>
                )}
                {aiInsights.slice(0, 2).map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <Zap className={`w-3 h-3 mt-0.5 flex-shrink-0 ${tokens.textClass}`} />
                    <span className="text-[11px] text-slate-300 leading-relaxed font-display">{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-3 text-center font-display text-sm font-bold btn-haptic transition-all duration-150"
              style={{
                background: tokens.accent,
                color: '#fff',
                borderTop: `1px solid ${tokens.accentBorder}`,
              }}
            >
              {expanded ? 'Hide Details' : 'View Live Odds'} &rarr;
            </button>
          </div>
        )}

        {/* ─── Expanded AI Details ─── */}
        <AnimatePresence>
          {expanded && aiInsights.length > 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="px-4 pb-3"
            >
              <div className="space-y-2 pt-1">
                {aiInsights.slice(2).map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <Zap className={`w-3 h-3 mt-0.5 flex-shrink-0 ${tokens.textClass}`} />
                    <span className="text-[11px] text-slate-300 leading-relaxed font-display">{insight}</span>
                  </div>
                ))}
                {alert.context?.aiCallToAction && (
                  <div className="mt-2 px-3 py-2 rounded-lg text-center"
                    style={{ background: tokens.accentBg, border: `1px solid ${tokens.accentBorder}` }}>
                    <span className={`text-[11px] font-bold font-display ${tokens.textClass}`}>
                      {alert.context.aiCallToAction}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Alert Message ─── */}
        <div className="px-5 pb-4">
          {aiTitle && (
            <div className={`text-[10px] font-bold uppercase tracking-[0.08em] ${tokens.textClass} font-display mb-1`}>
              {aiTitle}
            </div>
          )}
          <div className="text-[13px] font-medium text-slate-200 leading-relaxed font-display">
            {displayTitle}
          </div>
          {displayBody && (
            <div className="text-xs text-slate-400 leading-relaxed mt-1 font-display">{displayBody}</div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] text-slate-500 font-display">{formatTimeAgo(alert.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {(presentation?.tags || alert.gamblingInsights?.tags || []).slice(0, 2).map((tag: string, idx: number) => (
              <span key={idx} className="text-[9px] text-slate-500 font-display px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {tag}
              </span>
            ))}
            <span className="text-[9px] font-bold font-display px-2 py-0.5 rounded-full"
              style={{ background: tokens.accentBg, border: `1px solid ${tokens.accentBorder}`, color: tokens.accent }}>
              {alert.sport}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
