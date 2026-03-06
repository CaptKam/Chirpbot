import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Bell, Shield, Activity, AlertTriangle, ChevronRight, TrendingUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSeasonAwareSports } from '@shared/season-manager';
import { Alert } from '@/types';

// ─── V3 Design System Tokens ("Bloomberg meets FanDuel") ──────────
// Background:   #0F1A32 (solidBackground)
// Card Surface: #161B22 (surface)
// Primary Blue: #2489F5
// Emerald:      #22C55E / #10B981 (glow)
// Alert Red:    #EF4444
// Border:       #1E293B

const DS = {
  cardSurface: '#161B22',
  border: '#1E293B',
  alertRed: '#EF4444',
  primaryBlue: '#2489F5',
  emeraldGreen: '#22C55E',
  emeraldGlow: '#10B981',
} as const;

// ─── Animation Variants ──────────────────────────────────────────
// 01 Alert Slide: 0.4s ease-out, y: 30→0
const cardSlide = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

// 03 Insight Expand: 0.3s cubic-bezier mask-reveal
const insightExpand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

// Stagger children
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

// ─── Error Boundary ───────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AlertCard error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border p-6" style={{ background: DS.cardSurface, borderColor: DS.border }} role="alert">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-400 mb-1">Something went wrong</h3>
              <p className="text-sm text-[#94A3B8]">This alert could not be displayed.</p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

const TEAM_ABBR: Record<string, string> = {
  'New York Yankees': 'NYY', 'Boston Red Sox': 'BOS', 'Los Angeles Dodgers': 'LAD',
  'San Francisco Giants': 'SFG', 'Houston Astros': 'HOU', 'Texas Rangers': 'TEX',
  'Chicago Cubs': 'CHC', 'St. Louis Cardinals': 'STL', 'Atlanta Braves': 'ATL',
  'Philadelphia Phillies': 'PHI', 'San Diego Padres': 'SD', 'Los Angeles Angels': 'LAA',
  'Seattle Mariners': 'SEA', 'Toronto Blue Jays': 'TOR', 'Tampa Bay Rays': 'TB',
  'Baltimore Orioles': 'BAL', 'Minnesota Twins': 'MIN', 'Cleveland Guardians': 'CLE',
  'Detroit Tigers': 'DET', 'Chicago White Sox': 'CWS', 'Kansas City Royals': 'KC',
  'Milwaukee Brewers': 'MIL', 'Pittsburgh Pirates': 'PIT', 'Cincinnati Reds': 'CIN',
  'Arizona Diamondbacks': 'ARI', 'Colorado Rockies': 'COL', 'Miami Marlins': 'MIA',
  'Washington Nationals': 'WSH', 'New York Mets': 'NYM', 'Oakland Athletics': 'OAK',
  'Kansas City Chiefs': 'KC', 'Buffalo Bills': 'BUF', 'Philadelphia Eagles': 'PHI',
  'Dallas Cowboys': 'DAL', 'Los Angeles Lakers': 'LAL', 'Golden State Warriors': 'GSW',
};

function getAbbr(name: string | { name: string } | undefined): string {
  if (!name) return '???';
  const n = typeof name === 'string' ? name : name.name;
  return TEAM_ABBR[n] || n.split(' ').pop()?.substring(0, 3).toUpperCase() || '???';
}

function getTeamName(team: string | { name: string } | undefined): string {
  if (!team) return 'Unknown';
  return typeof team === 'string' ? team : team.name;
}

// Sport accent color: returns the sport's 4px top-bar color + text accent
function getSportAccent(sport: string) {
  switch (sport) {
    case 'MLB': return { bar: '#22C55E', text: 'text-green-400', pill: 'bg-green-500 text-white shadow-lg shadow-green-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'NBA': return { bar: '#A855F7', text: 'text-purple-400', pill: 'bg-purple-500 text-white shadow-lg shadow-purple-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'NFL': return { bar: '#F97316', text: 'text-orange-400', pill: 'bg-orange-500 text-white shadow-lg shadow-orange-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'NHL': return { bar: '#06B6D4', text: 'text-cyan-400', pill: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'NCAAF': return { bar: '#3B82F6', text: 'text-blue-400', pill: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'CFL': return { bar: '#EF4444', text: 'text-red-400', pill: 'bg-red-500 text-white shadow-lg shadow-red-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    case 'WNBA': return { bar: '#EC4899', text: 'text-pink-400', pill: 'bg-pink-500 text-white shadow-lg shadow-pink-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
    default: return { bar: '#22C55E', text: 'text-green-400', pill: 'bg-green-500 text-white shadow-lg shadow-green-500/20', pillInactive: 'bg-[#161B22] text-[#94A3B8] hover:text-slate-200' };
  }
}

function getInningLabel(alert: Alert): string {
  const ctx = alert.context;
  const inning = alert.inning || ctx?.inning;
  const isTop = alert.isTopInning ?? ctx?.isTopInning;
  if (inning) {
    const half = isTop ? 'Top' : 'Bottom';
    const suffix = inning === 1 ? 'st' : inning === 2 ? 'nd' : inning === 3 ? 'rd' : 'th';
    return `${half} ${inning}${suffix}`;
  }
  const quarter = ctx?.quarter;
  if (quarter) return `Q${quarter} ${ctx?.timeRemaining || ''}`.trim();
  const period = ctx?.period;
  if (period) return `P${period} ${ctx?.timeRemaining || ''}`.trim();
  return '';
}

function getRunnerText(alert: Alert): string {
  const first = alert.hasFirst || alert.context?.hasFirst;
  const second = alert.hasSecond || alert.context?.hasSecond;
  const third = alert.hasThird || alert.context?.hasThird;
  const bases: string[] = [];
  if (first) bases.push('1st');
  if (second) bases.push('2nd');
  if (third) bases.push('3rd');
  if (bases.length === 3) return 'Bases Loaded';
  if (bases.length === 0) return 'Bases Empty';
  return `Runners ${bases.join(' & ')}`;
}

function getOutsCount(alert: Alert): number {
  return alert.outs ?? alert.context?.outs ?? 0;
}

function getWinProb(alert: Alert): number | null {
  const prob = alert.context?.aiGameProjection?.winProbability;
  if (prob) return Math.max(prob.home, prob.away);
  const scoring = alert.context?.scoringProbability;
  if (scoring) return Math.round(scoring * 100);
  if (alert.confidence && alert.confidence > 50) return alert.confidence;
  return null;
}

function timeAgo(dateString: string): string {
  try {
    const sec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return '';
  }
}

// ─── Diamond Component (80x80, 12x12 bases per spec) ─────────────
// 04 Base Runner Glow: gray → green with scale pulse, 0.5s fade

function Diamond({ first, second, third }: { first?: boolean; second?: boolean; third?: boolean }) {
  const baseSize = 'w-3 h-3'; // 12px
  const emptyStyle = `${baseSize} rotate-45 border-2 border-[#1E293B] transition-all duration-500`;
  const activeStyle = `${baseSize} rotate-45 border-2 border-green-400 bg-green-500 transition-all duration-500`;
  // Glow effect via box-shadow
  const glowShadow = '0 0 10px rgba(34,197,94,0.6), 0 0 20px rgba(34,197,94,0.3)';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center mx-auto flex-shrink-0">
      {/* 2nd base - top center */}
      <motion.div
        className={`absolute top-0 left-1/2 -translate-x-1/2 ${second ? activeStyle : emptyStyle}`}
        animate={second ? { scale: [1, 1.2, 1], boxShadow: glowShadow } : { scale: 1, boxShadow: 'none' }}
        transition={{ duration: 0.5 }}
      />
      {/* 3rd base - left middle */}
      <motion.div
        className={`absolute left-0 top-1/2 -translate-y-1/2 ${third ? activeStyle : emptyStyle}`}
        animate={third ? { scale: [1, 1.2, 1], boxShadow: glowShadow } : { scale: 1, boxShadow: 'none' }}
        transition={{ duration: 0.5 }}
      />
      {/* 1st base - right middle */}
      <motion.div
        className={`absolute right-0 top-1/2 -translate-y-1/2 ${first ? activeStyle : emptyStyle}`}
        animate={first ? { scale: [1, 1.2, 1], boxShadow: glowShadow } : { scale: 1, boxShadow: 'none' }}
        transition={{ duration: 0.5 }}
      />
      {/* Home plate */}
      <div className="w-2 h-2 rotate-45 bg-[#1E293B] absolute bottom-1 left-1/2 -translate-x-1/2 opacity-50" />
    </div>
  );
}

// ─── Live Pulse Indicator ─────────────────────────────────────────
// 02 Live Pulse: 2s infinite loop, scale 100%→150%, opacity→0

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{
          backgroundColor: DS.emeraldGreen,
          animation: 'livePulse 2s ease-out infinite',
        }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: DS.emeraldGreen }}
      />
      <style>{`
        @keyframes livePulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────

function AlertSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="rounded-xl border p-4 animate-pulse"
      style={{ background: DS.cardSurface, borderColor: DS.border }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: delay * 0.08 }}
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <div className="h-3 w-16 bg-slate-700 rounded" />
        </div>
        <div className="h-8 w-24 bg-slate-700 rounded-lg" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-2 w-1/4">
          <div className="h-12 w-12 bg-slate-700 rounded-xl" />
          <div className="h-3 w-8 bg-slate-700 rounded" />
          <div className="h-10 w-10 bg-slate-700 rounded" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-3">
          <div className="h-3 w-20 bg-slate-700 rounded" />
          <div className="h-20 w-20 bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
        <div className="flex flex-col items-center gap-2 w-1/4">
          <div className="h-12 w-12 bg-slate-700 rounded-xl" />
          <div className="h-3 w-8 bg-slate-700 rounded" />
          <div className="h-10 w-10 bg-slate-700 rounded" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Featured Live Alert Card ─────────────────────────────────────

function FeaturedAlertCard({ alert }: { alert: Alert }) {
  const [insightsOpen, setInsightsOpen] = useState(false);

  const homeAbbr = getAbbr(alert.homeTeam);
  const awayAbbr = getAbbr(alert.awayTeam);
  const homeScore = alert.homeScore ?? alert.context?.homeScore ?? 0;
  const awayScore = alert.awayScore ?? alert.context?.awayScore ?? 0;
  const inningLabel = getInningLabel(alert);
  const outs = getOutsCount(alert);
  const winProb = getWinProb(alert);
  const leading = homeScore >= awayScore ? 'home' : 'away';
  const leadingAbbr = leading === 'home' ? homeAbbr : awayAbbr;
  const isMLB = alert.sport === 'MLB';
  const accent = getSportAccent(alert.sport);
  const insights = alert.context?.aiInsights || [];

  const first = alert.hasFirst || alert.context?.hasFirst;
  const second = alert.hasSecond || alert.context?.hasSecond;
  const third = alert.hasThird || alert.context?.hasThird;

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border"
      style={{
        background: DS.cardSurface,
        borderColor: DS.border,
        borderTopWidth: '4px',
        borderTopColor: accent.bar,
      }}
      {...cardSlide}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <LivePulse />
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Live Alert</p>
          </div>
          {winProb && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
              style={{
                background: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.2)',
                boxShadow: '0 0 20px -5px rgba(16,185,129,0.4)',
              }}
            >
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Win Prob ({leadingAbbr})</p>
              <p
                className="text-xl font-black text-emerald-400 font-mono leading-none"
                style={{ textShadow: '0 0 10px rgba(16,185,129,0.6)' }}
              >
                {winProb}%
              </p>
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className={`flex flex-col items-center gap-1 w-1/4 ${leading !== 'home' ? 'opacity-40' : ''}`}>
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: DS.border }}
            >
              <Shield className="w-6 h-6 text-[#94A3B8]" />
            </div>
            <span className="text-xs font-black tracking-tighter text-[#94A3B8] uppercase">{homeAbbr}</span>
            <span className="text-4xl font-black text-[#F8FAFC] font-mono">{homeScore}</span>
          </div>

          {/* Center — inning + diamond */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            {inningLabel && (
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{inningLabel}</p>
            )}
            {isMLB && (
              <Diamond first={first} second={second} third={third} />
            )}
            <div className="text-center space-y-0.5">
              {isMLB && (
                <p className={`text-[10px] font-bold ${accent.text} tracking-tight`}>
                  {getRunnerText(alert).toUpperCase()}
                </p>
              )}
              {alert.context?.down && (
                <p className={`text-[10px] font-bold ${accent.text} tracking-tight`}>
                  {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo} {alert.context.fieldPosition ? `at ${alert.context.fieldPosition}` : ''}
                </p>
              )}
              {(isMLB || outs > 0) && (
                <p className="text-[11px] font-black text-[#F8FAFC] tracking-widest uppercase">{outs} OUT{outs !== 1 ? 'S' : ''}</p>
              )}
            </div>
          </div>

          {/* Away team */}
          <div className={`flex flex-col items-center gap-1 w-1/4 ${leading !== 'away' ? 'opacity-40' : ''}`}>
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center border"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: DS.border }}
            >
              <Shield className="w-6 h-6 text-[#94A3B8]" />
            </div>
            <span className="text-xs font-black tracking-tighter text-[#94A3B8] uppercase">{awayAbbr}</span>
            <span className="text-4xl font-black text-[#F8FAFC] font-mono">{awayScore}</span>
          </div>
        </div>

        {/* AI Insight strip */}
        {alert.context?.aiTitle && (
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${DS.border}` }}>
            <button
              onClick={() => setInsightsOpen(!insightsOpen)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <p className="text-[11px] font-bold text-emerald-400">{alert.context.aiTitle}</p>
              </div>
              {insights.length > 0 && (
                <motion.div
                  animate={{ rotate: insightsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                </motion.div>
              )}
            </button>
            {alert.context.aiCallToAction && (
              <p className="text-[11px] text-[#94A3B8] mt-1 ml-[22px]">{alert.context.aiCallToAction}</p>
            )}

            {/* 03 Insight Expand — Gambling/AI drawer */}
            <AnimatePresence>
              {insightsOpen && insights.length > 0 && (
                <motion.div
                  className="overflow-hidden"
                  initial={insightExpand.initial}
                  animate={insightExpand.animate}
                  exit={insightExpand.exit}
                  transition={insightExpand.transition}
                >
                  <div
                    className="mt-3 rounded-lg p-3 space-y-2 backdrop-blur-md"
                    style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${DS.border}` }}
                  >
                    {insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 text-[10px] mt-0.5">*</span>
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Background decoration */}
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none">
        <Activity className="w-24 h-24" />
      </div>
    </motion.div>
  );
}

// ─── Compact Alert Card (for the list) ────────────────────────────

function CompactAlertCard({ alert, index }: { alert: Alert; index: number }) {
  const homeAbbr = getAbbr(alert.homeTeam);
  const awayAbbr = getAbbr(alert.awayTeam);
  const homeScore = alert.homeScore ?? alert.context?.homeScore;
  const awayScore = alert.awayScore ?? alert.context?.awayScore;
  const accent = getSportAccent(alert.sport);
  const ago = timeAgo(alert.timestamp || alert.createdAt || '');

  return (
    <motion.div
      className="p-4 rounded-xl border flex items-center justify-between hover:brightness-110 transition-all cursor-pointer"
      style={{
        background: DS.cardSurface,
        borderColor: DS.border,
        borderTopWidth: '4px',
        borderTopColor: accent.bar,
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.08 }}
    >
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          <div
            className="h-10 w-10 rounded-full border-2 flex items-center justify-center"
            style={{ background: DS.cardSurface, borderColor: '#000' }}
          >
            <Shield className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <div
            className="h-10 w-10 rounded-full border-2 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: '#000' }}
          >
            <Shield className="w-4 h-4 text-slate-500" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-[#F8FAFC] font-mono">
              {homeAbbr} {homeScore !== undefined ? homeScore : ''} - {awayScore !== undefined ? awayScore : ''} {awayAbbr}
            </p>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${accent.pill} !shadow-none`}>
              {alert.sport}
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] font-medium truncate max-w-[200px]">
            {alert.title || alert.description?.substring(0, 60)}
          </p>
          {ago && <p className="text-[10px] text-slate-600 mt-0.5">{ago}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

interface AlertStats {
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  monitoredGames: number;
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<string>('all');
  const availableSports = ['all', ...getSeasonAwareSports()];

  const { data: alerts = [], isLoading, refetch, error } = useQuery<Alert[]>({
    queryKey: ['/api/alerts', { limit: 120 }],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    retry: 1,
    staleTime: 15000,
  });

  const { isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  // Demo alerts
  const demoAlerts: Alert[] = useMemo(() => {
    const now = new Date().toISOString();
    return [
      {
        id: 'demo-1', type: 'MLB_BASES_LOADED_NO_OUTS', sport: 'MLB',
        title: 'Bases Loaded, 0 Outs',
        description: 'Aaron Judge at bat with bases loaded, no outs in the 7th. Yankees trail 3-2.',
        message: 'Aaron Judge at bat with bases loaded, no outs in the 7th. Yankees trail 3-2.',
        gameId: 'demo_mlb_1', confidence: 87, priority: 95,
        homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
        homeScore: 4, awayScore: 2, inning: 7, isTopInning: false, outs: 2,
        hasFirst: true, hasSecond: false, hasThird: true,
        context: {
          homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
          homeScore: 4, awayScore: 2, inning: 7, isTopInning: false,
          confidence: 0.87, scoringProbability: 0.86,
          currentBatter: 'Aaron Judge', currentPitcher: 'Chris Sale',
          aiInsights: ['Judge batting .340 in bases-loaded situations', 'Sale has allowed 4 hits in last 2 innings', 'Wind blowing out at 14mph to center field at Fenway', 'Run expectancy with runners on 1st & 3rd, 2 out: +0.54 runs'],
          aiTitle: 'High-Leverage At-Bat',
          aiCallToAction: 'Watch for grand slam opportunity',
          aiGameProjection: { finalScorePrediction: '6-3 NYY', keyMoments: [], winProbability: { home: 82, away: 18 } },
        },
        timestamp: now, sentToTelegram: false,
      },
      {
        id: 'demo-2', type: 'NFL_RED_ZONE', sport: 'NFL',
        title: 'Red Zone - 4th & Goal',
        description: 'Chiefs at the 3-yard line, 4th & Goal. Mahomes targeting Kelce.',
        message: 'Chiefs at the 3-yard line, 4th & Goal.',
        gameId: 'demo_nfl_1', confidence: 92, priority: 96,
        homeTeam: 'Kansas City Chiefs', awayTeam: 'Buffalo Bills',
        homeScore: 24, awayScore: 27,
        context: {
          homeTeam: 'Kansas City Chiefs', awayTeam: 'Buffalo Bills',
          homeScore: 24, awayScore: 27, quarter: 4, timeRemaining: '2:15',
          down: 4, yardsToGo: 3, fieldPosition: 'BUF 3', confidence: 0.92,
          aiInsights: ['Chiefs convert 78% of 4th & Goal from the 3', 'Kelce has 3 TDs in red zone this season', 'Bills defense allowing 62% red zone conversion rate'],
          aiTitle: 'Must-Score Situation', aiCallToAction: 'Game-deciding play incoming',
          scoringProbability: 0.78,
        },
        timestamp: new Date(Date.now() - 120000).toISOString(), sentToTelegram: false,
      },
      {
        id: 'demo-3', type: 'NBA_CLUTCH_TIME', sport: 'NBA',
        title: 'Clutch Time - Tied Game',
        description: 'Lakers-Warriors tied 108-108 with 1:42 left.',
        message: 'Lakers-Warriors tied 108-108 with 1:42 left.',
        gameId: 'demo_nba_1', confidence: 85, priority: 90,
        homeTeam: 'Los Angeles Lakers', awayTeam: 'Golden State Warriors',
        homeScore: 108, awayScore: 108,
        context: {
          homeTeam: 'Los Angeles Lakers', awayTeam: 'Golden State Warriors',
          homeScore: 108, awayScore: 108, quarter: 4, timeRemaining: '1:42',
          confidence: 0.85,
          aiInsights: ['LeBron shoots 48% in final 2 minutes this season', 'Warriors have blown 3 4th-quarter leads this week', 'Lakers on an 8-0 run in last 2 minutes'],
          aiTitle: 'Clutch Time Showdown', aiCallToAction: 'Star vs star in crunch time',
          scoringProbability: 0.52,
        },
        timestamp: new Date(Date.now() - 60000).toISOString(), sentToTelegram: false,
      },
      {
        id: 'demo-4', type: 'MLB_MOMENTUM_SHIFT', sport: 'MLB',
        title: 'Momentum Shift',
        description: 'Dodgers score 4 runs in the 6th to take a 6-3 lead.',
        message: 'Dodgers score 4 runs in the 6th.',
        gameId: 'demo_mlb_2', confidence: 79, priority: 82,
        homeTeam: 'Los Angeles Dodgers', awayTeam: 'San Diego Padres',
        homeScore: 6, awayScore: 3, inning: 6, isTopInning: false, outs: 1,
        hasFirst: false, hasSecond: true, hasThird: false,
        context: {
          homeTeam: 'Los Angeles Dodgers', awayTeam: 'San Diego Padres',
          homeScore: 6, awayScore: 3, inning: 6, isTopInning: false,
          currentBatter: 'Freddie Freeman',
          aiInsights: ['Ohtani now 4-for-4 today', 'Padres bullpen ERA is 5.20 this month'],
          aiTitle: 'Rally in Progress',
        },
        timestamp: new Date(Date.now() - 300000).toISOString(), sentToTelegram: false,
      },
    ];
  }, []);

  const displayAlerts = alerts.length > 0 ? alerts : demoAlerts;
  const filteredAlerts = filter === 'all'
    ? displayAlerts
    : displayAlerts.filter((a) => a.sport === filter);

  const sortedAlerts = useMemo(() =>
    [...filteredAlerts].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [filteredAlerts]
  );

  const featuredAlert = sortedAlerts[0] || null;
  const remainingAlerts = sortedAlerts.slice(1);

  // ─── Loading State ──────────────────────────────────────────────
  if (isLoading || statsLoading) {
    return (
      <div className="pb-24 min-h-screen" style={{ backgroundColor: '#0F1A32' }} data-testid="alerts-loading">
        <Header />
        <SportPills sports={availableSports} active={filter} onSelect={setFilter} />
        <main className="p-4 space-y-6">
          {[0, 1, 2].map((i) => <AlertSkeleton key={i} delay={i} />)}
        </main>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="pb-24 min-h-screen" style={{ backgroundColor: '#0F1A32' }} data-testid="alerts-page">
      <Header alertCount={displayAlerts.length} />
      <SportPills sports={availableSports} active={filter} onSelect={setFilter} />

      <motion.main
        className="p-4 space-y-6 overflow-y-auto"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Demo mode banner */}
        {alerts.length === 0 && !error && !isLoading && (
          <motion.div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              background: DS.cardSurface,
              borderLeft: '3px solid #F59E0B',
              border: `1px solid ${DS.border}`,
              borderLeftWidth: '3px',
              borderLeftColor: '#F59E0B',
            }}
            {...cardSlide}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Demo Mode</span>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Showing sample alerts. Real alerts appear when games are live.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {error ? (
          <motion.div
            className="rounded-xl p-8 border text-center"
            style={{ background: DS.cardSurface, borderColor: DS.border, borderTopWidth: '4px', borderTopColor: DS.alertRed }}
            {...cardSlide}
          >
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#F8FAFC] mb-2">Unable to load alerts</h3>
            <p className="text-[#94A3B8] text-sm mb-6">Check your connection and try again.</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Activity className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </motion.div>
        ) : sortedAlerts.length === 0 ? (
          <motion.div
            className="rounded-xl p-8 border text-center"
            style={{ background: DS.cardSurface, borderColor: DS.border }}
            {...cardSlide}
          >
            <Bell className="h-8 w-8 text-[#94A3B8] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#F8FAFC] mb-2">No Alerts Available</h3>
            <p className="text-[#94A3B8] text-sm mb-6">
              No alerts for {filter === 'all' ? 'any sport' : filter} at the moment.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Featured card */}
            {featuredAlert && (
              <ErrorBoundary>
                <FeaturedAlertCard alert={featuredAlert} />
              </ErrorBoundary>
            )}

            {/* Remaining alerts list */}
            {remainingAlerts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h2 className="text-lg font-bold text-[#F8FAFC]">More Alerts</h2>
                  <span className="text-emerald-400 text-sm font-bold">{remainingAlerts.length} alert{remainingAlerts.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {remainingAlerts.map((alert, i) => (
                    <ErrorBoundary key={alert.id}>
                      <CompactAlertCard alert={alert} index={i} />
                    </ErrorBoundary>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────

function Header({ alertCount }: { alertCount?: number }) {
  return (
    <header
      className="sticky top-0 z-20 backdrop-blur-md"
      style={{ background: 'rgba(15,26,50,0.95)', borderBottom: `1px solid ${DS.border}` }}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <Activity className="w-6 h-6 text-green-400" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-[#F8FAFC]">ChirpBot</h1>
        </div>
        <button className="relative p-2 text-[#94A3B8]">
          <Bell className="w-6 h-6" />
          {alertCount !== undefined && alertCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <LivePulse />
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

// ─── Sport Filter Pills ──────────────────────────────────────────

function SportPills({ sports, active, onSelect }: { sports: string[]; active: string; onSelect: (s: string) => void }) {
  return (
    <div
      className="flex overflow-x-auto px-4 py-3 gap-2 backdrop-blur-sm"
      style={{ background: 'rgba(15,26,50,0.9)', borderBottom: `1px solid ${DS.border}`, scrollbarWidth: 'none' }}
    >
      {sports.map((sport) => {
        const isActive = sport === active;
        const accent = getSportAccent(sport === 'all' ? 'MLB' : sport);
        return (
          <button
            key={sport}
            onClick={() => onSelect(sport)}
            data-testid={`sport-tab-${sport.toLowerCase()}`}
            className={`flex-none px-5 py-2 rounded-full font-bold text-sm transition-all ${
              isActive ? accent.pill : accent.pillInactive
            }`}
          >
            {sport.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
