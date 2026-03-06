import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Clock, Target, Bot, TrendingUp, Smartphone, ChevronDown, Zap } from 'lucide-react';
import { parseISO } from 'date-fns';
import { BaseballDiamond } from '@/components/baseball-diamond';

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
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 4) return `${weeksAgo}w ago`;
    const monthsAgo = Math.floor(daysAgo / 30);
    if (monthsAgo < 12) return `${monthsAgo}mo ago`;
    return `${Math.floor(daysAgo / 365)}y ago`;
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

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Sport-specific design tokens
const sportTokens: Record<string, {
  accent: string; accentBg: string; accentBorder: string; accentGlow: string;
  icon: string; label: string; textClass: string; bgClass: string; borderClass: string;
}> = {
  MLB: {
    accent: '#22C55E', accentBg: 'rgba(34,197,94,0.07)', accentBorder: 'rgba(34,197,94,0.15)',
    accentGlow: '0 0 24px rgba(34,197,94,0.12)', icon: '\u26be', label: 'Baseball',
    textClass: 'text-green-400', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/20',
  },
  NFL: {
    accent: '#F97316', accentBg: 'rgba(249,115,22,0.07)', accentBorder: 'rgba(249,115,22,0.15)',
    accentGlow: '0 0 24px rgba(249,115,22,0.12)', icon: '\ud83c\udfc8', label: 'Football',
    textClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20',
  },
  NBA: {
    accent: '#A855F7', accentBg: 'rgba(168,85,247,0.07)', accentBorder: 'rgba(168,85,247,0.15)',
    accentGlow: '0 0 24px rgba(168,85,247,0.12)', icon: '\ud83c\udfc0', label: 'Basketball',
    textClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/20',
  },
  NHL: {
    accent: '#06B6D4', accentBg: 'rgba(6,182,212,0.07)', accentBorder: 'rgba(6,182,212,0.15)',
    accentGlow: '0 0 24px rgba(6,182,212,0.12)', icon: '\ud83c\udfd2', label: 'Hockey',
    textClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/20',
  },
  NCAAF: {
    accent: '#3B82F6', accentBg: 'rgba(59,130,246,0.07)', accentBorder: 'rgba(59,130,246,0.15)',
    accentGlow: '0 0 24px rgba(59,130,246,0.12)', icon: '\ud83c\udfc8', label: 'College Football',
    textClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/20',
  },
  WNBA: {
    accent: '#EC4899', accentBg: 'rgba(236,72,153,0.07)', accentBorder: 'rgba(236,72,153,0.15)',
    accentGlow: '0 0 24px rgba(236,72,153,0.12)', icon: '\ud83c\udfc0', label: "Women's Basketball",
    textClass: 'text-pink-400', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/20',
  },
  CFL: {
    accent: '#EF4444', accentBg: 'rgba(239,68,68,0.07)', accentBorder: 'rgba(239,68,68,0.15)',
    accentGlow: '0 0 24px rgba(239,68,68,0.12)', icon: '\ud83c\udfc8', label: 'Canadian Football',
    textClass: 'text-red-400', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/20',
  },
};

const defaultTokens = {
  accent: '#94A3B8', accentBg: 'rgba(148,163,184,0.07)', accentBorder: 'rgba(148,163,184,0.15)',
  accentGlow: '0 0 24px rgba(148,163,184,0.08)', icon: '\u2b50', label: 'Sports',
  textClass: 'text-slate-400', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/20',
};

// Outs indicator dots
function OutsDots({ count = 0 }: { count: number }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
          i < count
            ? 'bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.4)]'
            : 'bg-white/10 border border-white/10'
        }`} />
      ))}
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
  const isLive = true; // alerts are real-time

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

  const alertTypeLabel = alert.type.replace(/^(MLB|NFL|NBA|NCAAF|WNBA|CFL|NHL)_/, '').replace(/_/g, ' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={`glass-card rounded-2xl overflow-hidden ${isHighPriority ? 'animate-glow-pulse' : ''}`}
        style={{
          borderTop: `2px solid ${tokens.accent}`,
          ...(isHighPriority ? { background: `${tokens.accentBg}` } : {}),
        }}
      >
        {/* ─── Header: Sport badge + Type + Time ─── */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {/* Sport icon with glass bg */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{
                  background: tokens.accentBg,
                  border: `1px solid ${tokens.accentBorder}`,
                }}
              >
                {tokens.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-display text-xs font-bold uppercase tracking-[0.12em] ${tokens.textClass}`}>
                    {alertTypeLabel}
                  </span>
                  {isHighPriority && (
                    <span
                      className="animate-live-pulse inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.20)',
                        color: '#EF4444',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
                      HIGH
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] text-slate-500 font-medium font-display">{formatTimeAgo(alert.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {alert.sentToTelegram && (
                <Smartphone className="w-3.5 h-3.5 text-blue-400/60" />
              )}
              {confidencePercent > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: tokens.accentBg, border: `1px solid ${tokens.accentBorder}` }}
                >
                  <Target className={`w-3 h-3 ${tokens.textClass}`} />
                  <span className={`score-display text-xs ${tokens.textClass}`}>{confidencePercent}%</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Scoreboard: Glassmorphism panel with condensed mono scores ─── */}
          <div className="glass-surface rounded-xl p-3 mb-3">
            <div className="flex items-center">
              {/* Away team */}
              <div className="flex-1 flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="font-display text-[13px] font-bold text-slate-100 leading-tight">{displayAwayTeam}</span>
                  {!hasScores && <span className="text-[9px] text-slate-500 font-display">Away</span>}
                </div>
                {hasScores && (
                  <span className="score-display text-2xl text-white ml-auto animate-roll-up">
                    {alert.awayScore}
                  </span>
                )}
              </div>

              {/* Center divider with game state */}
              <div className="flex flex-col items-center gap-1 mx-3 flex-shrink-0 min-w-[48px]">
                {hasScores ? (
                  <>
                    <span className="text-[10px] text-slate-600 font-light">vs</span>
                    {/* MLB inning indicator */}
                    {alert.sport === 'MLB' && alert.context?.inning && (
                      <div className="flex items-center gap-1">
                        <div className="animate-live-pulse w-1 h-1 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                        <span className="text-[9px] font-bold text-green-400 font-display">
                          {alert.context.isTopInning ? '\u25b2' : '\u25bc'} {ord(alert.context.inning)}
                        </span>
                      </div>
                    )}
                    {/* NFL/NBA quarter */}
                    {(alert.sport === 'NFL' || alert.sport === 'NCAAF' || alert.sport === 'CFL' || alert.sport === 'NBA' || alert.sport === 'WNBA') && alert.context?.quarter && (
                      <div className="flex items-center gap-1">
                        <div className="animate-live-pulse w-1 h-1 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                        <span className="text-[9px] font-bold text-green-400 font-display">Q{alert.context.quarter}</span>
                      </div>
                    )}
                    {/* NHL period */}
                    {alert.sport === 'NHL' && alert.context?.period && (
                      <div className="flex items-center gap-1">
                        <div className="animate-live-pulse w-1 h-1 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                        <span className="text-[9px] font-bold text-green-400 font-display">P{alert.context.period}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-500 font-display font-medium">@</span>
                )}
              </div>

              {/* Home team */}
              <div className="flex-1 flex items-center gap-2 flex-row-reverse">
                <div className="flex flex-col items-end">
                  <span className="font-display text-[13px] font-bold text-slate-100 leading-tight text-right">{displayHomeTeam}</span>
                  {!hasScores && <span className="text-[9px] text-slate-500 font-display">Home</span>}
                </div>
                {hasScores && (
                  <span className="score-display text-2xl text-white mr-auto animate-roll-up">
                    {alert.homeScore}
                  </span>
                )}
              </div>
            </div>

            {/* MLB-specific: Outs + Baseball diamond inline */}
            {alert.sport === 'MLB' && alert.context && (alert.context.inning || alert.context.outs !== undefined) && (
              <div className="flex items-center justify-center gap-4 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {(alert.context.hasFirst || alert.context.hasSecond || alert.context.hasThird) && (
                  <BaseballDiamond
                    runners={{
                      first: alert.context.hasFirst,
                      second: alert.context.hasSecond,
                      third: alert.context.hasThird,
                    }}
                    outs={alert.context.outs ?? 0}
                    balls={alert.context.balls ?? 0}
                    strikes={alert.context.strikes ?? 0}
                    size="sm"
                    showCount={false}
                  />
                )}
                <div className="flex items-center gap-3">
                  {(alert.context.balls !== undefined || alert.context.strikes !== undefined) && (
                    <span className="score-display text-[11px] text-emerald-400 bg-white/[0.04] px-2 py-0.5 rounded">
                      {alert.context.balls ?? 0}-{alert.context.strikes ?? 0}
                    </span>
                  )}
                  {alert.context.outs !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <OutsDots count={alert.context.outs} />
                      <span className="text-[9px] text-slate-500 font-display font-medium">
                        {alert.context.outs} out{alert.context.outs !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* NFL/NCAAF/CFL: Down & distance + field position + time */}
            {(alert.sport === 'NFL' || alert.sport === 'NCAAF' || alert.sport === 'CFL') && alert.context?.quarter && (
              <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {alert.context.down && alert.context.yardsToGo !== undefined && (
                  <span className="text-[10px] font-bold text-slate-200 bg-white/[0.04] px-2 py-0.5 rounded font-display">
                    {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo}
                  </span>
                )}
                {alert.context.fieldPosition && (
                  <span className="text-[10px] text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded font-display">
                    {alert.context.fieldPosition}
                  </span>
                )}
                {alert.context.timeRemaining && (
                  <span className="score-display text-[10px] text-slate-300 bg-white/[0.04] px-2 py-0.5 rounded">
                    {alert.context.timeRemaining}
                  </span>
                )}
              </div>
            )}

            {/* NBA/WNBA: Time remaining */}
            {(alert.sport === 'NBA' || alert.sport === 'WNBA') && alert.context?.timeRemaining && (
              <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="score-display text-[10px] text-slate-300 bg-white/[0.04] px-2 py-0.5 rounded">
                  {alert.context.timeRemaining}
                </span>
              </div>
            )}
          </div>

          {/* ─── Alert Content ─── */}
          <div className="mb-3">
            {presentation?.source === 'ai' && (
              <div className="flex items-center gap-1.5 mb-2">
                <Bot className={`w-3.5 h-3.5 ${tokens.textClass}`} />
                <span className={`text-[9px] font-bold uppercase tracking-[0.10em] ${tokens.textClass} font-display`}>
                  AI Enhanced
                </span>
              </div>
            )}

            {aiTitle && (
              <div className={`text-[11px] font-bold uppercase tracking-[0.06em] ${tokens.textClass} font-display mb-1`}>
                {aiTitle}
              </div>
            )}

            <div className="text-sm font-semibold text-slate-100 leading-relaxed">
              {displayTitle}
            </div>

            {displayBody && (
              <div className="text-xs text-slate-400 leading-relaxed mt-1">
                {displayBody}
              </div>
            )}
          </div>

          {/* ─── AI Insights expandable ─── */}
          {aiInsights.length > 0 && (
            <div className="mb-3">
              <div
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between cursor-pointer py-1.5 btn-haptic"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="text-[10px] font-bold text-slate-500 tracking-[0.08em] uppercase font-display">
                  AI Insights
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                />
              </div>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5 pt-1"
                >
                  {aiInsights.map((insight: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap className={`w-3 h-3 mt-0.5 flex-shrink-0 ${tokens.textClass}`} />
                      <span className="text-[11px] text-slate-300 leading-relaxed">{insight}</span>
                    </div>
                  ))}
                  {alert.context?.aiCallToAction && (
                    <div
                      className="mt-2 px-3 py-2 rounded-lg text-center"
                      style={{ background: tokens.accentBg, border: `1px solid ${tokens.accentBorder}` }}
                    >
                      <span className={`text-[11px] font-bold font-display ${tokens.textClass}`}>
                        {alert.context.aiCallToAction}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer: Sport badge + tags ─── */}
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-display"
              style={{
                background: tokens.accentBg,
                border: `1px solid ${tokens.accentBorder}`,
                color: tokens.accent,
              }}
            >
              {alert.sport}
            </span>
            {(presentation?.tags || alert.gamblingInsights?.tags || []).slice(0, 2).map((tag: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium text-slate-500 font-display"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {alert.context?.scoringProbability && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="score-display text-[10px] text-green-400">
                {Math.round(alert.context.scoringProbability * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
