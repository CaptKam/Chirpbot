import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Bell, Shield, Activity, AlertTriangle, ChevronUp, TrendingUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSeasonAwareSports } from '@shared/season-manager';
import { Alert } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { TeamLogo } from '@/components/team-logo';

// ─── V3 Design Tokens ────────────────────────────────────────────
const DS = {
  cardSurface: '#161B22',
  border: '#1E293B',
  alertRed: '#EF4444',
} as const;

// ─── Animation Variants ──────────────────────────────────────────
const cardSlide = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

const insightExpand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

// ─── Error Boundary ──────────────────────────────────────────────
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
              <p className="text-sm text-slate-400">This alert could not be displayed.</p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

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

function getSportAccent(sport: string) {
  switch (sport) {
    case 'MLB': return { bar: '#22C55E', pill: 'bg-emeraldGreen text-white shadow-sm shadow-emeraldGreen/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NBA': return { bar: '#A855F7', pill: 'bg-purple-500 text-white shadow-sm shadow-purple-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NFL': return { bar: '#F97316', pill: 'bg-orange-500 text-white shadow-sm shadow-orange-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NHL': return { bar: '#06B6D4', pill: 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'NCAAF': return { bar: '#3B82F6', pill: 'bg-blue-500 text-white shadow-sm shadow-blue-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'CFL': return { bar: '#EF4444', pill: 'bg-red-500 text-white shadow-sm shadow-red-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    case 'WNBA': return { bar: '#EC4899', pill: 'bg-pink-500 text-white shadow-sm shadow-pink-500/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
    default: return { bar: '#22C55E', pill: 'bg-emeraldGreen text-white shadow-sm shadow-emeraldGreen/8', pillInactive: 'bg-slate-800 text-slate-400 hover:text-slate-200' };
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

function getWinProb(alert: Alert): { value: number; team: string } | null {
  const prob = alert.context?.aiGameProjection?.winProbability;
  if (prob) {
    const homeAbbr = getAbbr(alert.homeTeam);
    const awayAbbr = getAbbr(alert.awayTeam);
    return prob.home >= prob.away
      ? { value: Math.round(prob.home), team: homeAbbr }
      : { value: Math.round(prob.away), team: awayAbbr };
  }
  const scoring = alert.context?.scoringProbability;
  if (scoring) return { value: Math.round(scoring * 100), team: getAbbr(alert.homeTeam) };
  if (alert.confidence && alert.confidence > 50) return { value: alert.confidence, team: getAbbr(alert.homeTeam) };
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
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 w-32 bg-slate-700 rounded" />
        <div className="h-5 w-14 bg-slate-700 rounded-full" />
      </div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-14 w-14 bg-slate-700 rounded-full" />
          <div className="h-8 w-8 bg-slate-700 rounded" />
        </div>
        <div className="h-16 w-16 bg-slate-700 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-slate-700 rounded" />
          <div className="h-14 w-14 bg-slate-700 rounded-full" />
        </div>
      </div>
      <div className="h-12 w-full bg-slate-700 rounded-lg" />
    </motion.div>
  );
}

// ─── Featured Live Alert Card ────────────────────────────────────

function FeaturedAlertCard({ alert }: { alert: Alert }) {
  const [insightsOpen, setInsightsOpen] = useState(false);

  const homeAbbr = getAbbr(alert.homeTeam);
  const awayAbbr = getAbbr(alert.awayTeam);
  const homeName = getTeamName(alert.homeTeam);
  const awayName = getTeamName(alert.awayTeam);
  const homeScore = alert.homeScore ?? alert.context?.homeScore ?? 0;
  const awayScore = alert.awayScore ?? alert.context?.awayScore ?? 0;
  const inningLabel = getInningLabel(alert);
  const outs = getOutsCount(alert);
  const winProb = getWinProb(alert);
  const isMLB = alert.sport === 'MLB';
  const accent = getSportAccent(alert.sport);
  const insights = alert.context?.aiInsights || [];

  const first = alert.hasFirst || alert.context?.hasFirst;
  const second = alert.hasSecond || alert.context?.hasSecond;
  const third = alert.hasThird || alert.context?.hasThird;

  // Wind data
  const windSpeed = alert.context?.windSpeed || alert.weather?.windSpeed;
  const windDir = alert.context?.windDirection || alert.weather?.windDirection;

  // Gambling data
  const market = alert.gamblingInsights?.market;
  const ml = market?.moneyline;
  const total = market?.total;
  const re24 = alert.context?.scoringProbability;

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border-t-4 bg-surface border border-slate-800 shadow-md"
      style={{ borderTopColor: accent.bar }}
      {...cardSlide}
    >
      {/* Header: situation + LIVE badge */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="px-2 py-1 rounded bg-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {inningLabel}{outs > 0 ? ` \u2022 ${outs} Out${outs !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-chirpRed/10 text-chirpRed text-[10px] font-bold uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-chirpRed animate-live-pulse-ring" />
          Live
        </span>
      </div>

      <div className="p-4 pt-2">
        {/* Scoreboard: Away — Diamond — Home */}
        <div className="flex items-center justify-between mb-8">
          {/* Away team */}
          <div className="flex items-center gap-2">
            <TeamLogo teamName={awayName} abbreviation={awayAbbr} sport={alert.sport} size="lg" className="rounded-full border border-slate-700" />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-slate-400 uppercase">{awayAbbr}</span>
              <span className="text-3xl font-black">{awayScore}</span>
            </div>
          </div>

          {/* Center: Diamond with wind overlay (MLB) or situation text */}
          <div className="relative flex flex-col items-center">
            {isMLB ? (
              <>
                <div className="relative w-16 h-16 rotate-45 border-2 border-slate-800 rounded-sm">
                  {/* 2nd base (top-left in rotated view) */}
                  <div className={`absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-sm transition-all duration-300 ${second ? 'bg-emeraldGreen shadow-sm shadow-emeraldGreen/20 animate-diamond-pop' : 'bg-slate-700'}`} />
                  {/* 1st base (top-right) */}
                  <div className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm transition-all duration-300 ${first ? 'bg-emeraldGreen shadow-sm shadow-emeraldGreen/20 animate-diamond-pop' : 'bg-slate-700'}`} />
                  {/* 3rd base (bottom-left) */}
                  <div className={`absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-sm transition-all duration-300 ${third ? 'bg-emeraldGreen shadow-sm shadow-emeraldGreen/20 animate-diamond-pop' : 'bg-slate-700'}`} />
                  {/* Home plate */}
                  <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-slate-700 rounded-sm" />

                  {/* Wind overlay inside diamond */}
                  {windSpeed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center -rotate-45">
                      <span className="text-[8px] font-black text-slate-400 text-center leading-[1]">
                        {windSpeed} MPH
                        {windDir && <><br />{windDir}</>}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                  {getRunnerText(alert)}
                </p>
              </>
            ) : (
              <div className="text-center">
                {alert.context?.down && (
                  <p className="text-sm font-bold text-white">
                    {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo}
                  </p>
                )}
                {alert.context?.fieldPosition && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase">at {alert.context.fieldPosition}</p>
                )}
                {!alert.context?.down && inningLabel && (
                  <p className="text-sm font-bold text-white">{inningLabel}</p>
                )}
              </div>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="font-bold text-xs text-slate-400 uppercase">{homeAbbr}</span>
              <span className="text-3xl font-black">{homeScore}</span>
            </div>
            <TeamLogo teamName={homeName} abbreviation={homeAbbr} sport={alert.sport} size="lg" className="rounded-full border border-slate-700" />
          </div>
        </div>

        {/* Expandable Gambling Insights Drawer */}
        <div className="relative -mx-4 -mb-4 bg-slate-800/50 border-t border-slate-800/50">
          <button
            onClick={() => setInsightsOpen(!insightsOpen)}
            className="w-full flex items-center justify-center gap-2 py-4 group"
          >
            <motion.div
              animate={{ rotate: insightsOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUp className="w-5 h-5 text-emeraldGreen" />
            </motion.div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest group-active:scale-95 transition-transform">
              View Gambling Insights
            </span>
          </button>

          <AnimatePresence>
            {insightsOpen && (
              <motion.div
                className="overflow-hidden"
                initial={insightExpand.initial}
                animate={insightExpand.animate}
                exit={insightExpand.exit}
                transition={insightExpand.transition}
              >
                <div className="px-4 pb-6 pt-2 space-y-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface p-3 rounded-lg border border-slate-800 shadow-[0_0_8px_-2px_rgba(34,197,94,0.12)]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {isMLB ? 'RE24 Run Exp.' : 'Scoring Prob'}
                      </p>
                      <p className="text-lg font-black text-emeraldGreen">
                        {re24 ? `+${(re24 * 2).toFixed(2)}` : winProb ? `${winProb.value}%` : '--'}
                      </p>
                    </div>
                    <div className="bg-surface p-3 rounded-lg border border-slate-800 shadow-[0_0_8px_-2px_rgba(34,197,94,0.12)]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Win Prob ({winProb?.team || homeAbbr})
                      </p>
                      <p className="text-lg font-black text-emeraldGreen">
                        {winProb ? `${winProb.value}%` : '--'}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Live Odds */}
                  <div className="bg-surface p-4 rounded-xl border border-slate-800 shadow-[0_0_8px_-2px_rgba(34,197,94,0.12)]">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detailed Live Odds</h4>
                      <span className="text-[10px] font-bold text-emeraldGreen flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-emeraldGreen" />
                        SECURE
                      </span>
                    </div>
                    <div className="space-y-3">
                      {ml ? (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">{homeAbbr} Moneyline</span>
                            <span className="font-black text-emeraldGreen">
                              {ml.home != null ? (ml.home > 0 ? `+${ml.home}` : ml.home) : '--'}
                            </span>
                          </div>
                          {total?.points != null && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">Total Runs (O/U {total.points})</span>
                              <span className="font-black text-emeraldGreen">
                                Over {total.over != null ? (total.over > 0 ? `+${total.over}` : total.over) : '--'}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">{homeAbbr} Moneyline</span>
                            <span className="font-black text-emeraldGreen">
                              {homeScore > awayScore ? '-240' : '+180'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Total Runs (O/U {(homeScore + awayScore + 2.5).toFixed(1)})</span>
                            <span className="font-black text-emeraldGreen">Over -115</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* AI Insights */}
                  {insights.length > 0 && (
                    <div className="bg-surface p-4 rounded-xl border border-slate-800">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">AI Insights</h4>
                      <div className="space-y-2">
                        {insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-emeraldGreen text-[10px] mt-0.5">*</span>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Compact Alert Card (Upcoming Alerts list) ───────────────────

function CompactAlertCard({ alert, index }: { alert: Alert; index: number }) {
  const homeAbbr = getAbbr(alert.homeTeam);
  const awayAbbr = getAbbr(alert.awayTeam);
  const homeName = getTeamName(alert.homeTeam);
  const awayName = getTeamName(alert.awayTeam);
  const ago = timeAgo(alert.timestamp || alert.createdAt || '');
  const accent = getSportAccent(alert.sport);

  return (
    <motion.div
      className="bg-surface p-4 rounded-xl border border-slate-800 flex items-center justify-between"
      style={{ borderTopWidth: '4px', borderTopColor: accent.bar }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.08 }}
    >
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          <TeamLogo teamName={awayName} abbreviation={awayAbbr} sport={alert.sport} size="sm" className="rounded-full border-2 border-surface" />
          <TeamLogo teamName={homeName} abbreviation={homeAbbr} sport={alert.sport} size="sm" className="rounded-full border-2 border-surface" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm">{awayAbbr} @ {homeAbbr}</p>
          <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
            {alert.title || alert.description?.substring(0, 60)}
          </p>
          {ago && <p className="text-[10px] text-slate-500 mt-0.5">{ago}</p>}
        </div>
      </div>
      <button className="p-2 bg-primaryBlue/10 text-primaryBlue rounded-lg shrink-0">
        <Bell className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

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

  const { isLoading: statsLoading } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  // Demo alerts shown when no live data
  const demoAlerts: Alert[] = useMemo(() => {
    const now = new Date().toISOString();
    return [
      {
        id: 'demo-1', type: 'MLB_BASES_LOADED_NO_OUTS', sport: 'MLB',
        title: 'Bases Loaded, 2 Outs',
        description: 'Aaron Judge at bat with runners on 1st & 3rd, 2 outs in the 7th. Yankees lead 4-2.',
        message: 'Aaron Judge at bat with runners on 1st & 3rd.',
        gameId: 'demo_mlb_1', confidence: 87, priority: 95,
        homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
        homeScore: 4, awayScore: 2, inning: 7, isTopInning: false, outs: 2,
        hasFirst: true, hasSecond: false, hasThird: true,
        context: {
          homeTeam: 'New York Yankees', awayTeam: 'Boston Red Sox',
          homeScore: 4, awayScore: 2, inning: 7, isTopInning: false,
          confidence: 0.87, scoringProbability: 0.86,
          currentBatter: 'Aaron Judge', currentPitcher: 'Chris Sale',
          windSpeed: 12, windDirection: '\u2197 OUT TO LF',
          aiInsights: [
            'Judge batting .340 in high-leverage situations',
            'Sale has allowed 4 hits in last 2 innings',
            'Wind blowing out at 12mph to left field at Fenway',
            'Run expectancy with runners on 1st & 3rd, 2 out: +0.54 runs',
          ],
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
        title: 'LAD @ SFG - Starting Soon',
        description: 'Dodgers at Giants, first pitch in 45 minutes.',
        message: 'Dodgers at Giants starting soon.',
        gameId: 'demo_mlb_2', confidence: 0, priority: 60,
        homeTeam: 'San Francisco Giants', awayTeam: 'Los Angeles Dodgers',
        context: {
          homeTeam: 'San Francisco Giants', awayTeam: 'Los Angeles Dodgers',
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

  // ─── Sport pills ───────────────────────────────────────────────
  const sportPills = (
    <div className="flex overflow-x-auto no-scrollbar px-4 pb-3 pt-1 gap-2 border-b border-slate-800">
      {availableSports.map((sport) => {
        const isActive = sport === filter;
        const accent = getSportAccent(sport === 'all' ? 'MLB' : sport);
        return (
          <button
            key={sport}
            onClick={() => setFilter(sport)}
            data-testid={`sport-tab-${sport.toLowerCase()}`}
            className={`flex-none px-5 py-2 rounded-full font-bold text-sm transition-all duration-200 ease-out ${
              isActive ? accent.pill : accent.pillInactive
            }`}
          >
            {sport.toUpperCase()}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="pb-24 min-h-screen bg-solidBackground" data-testid={isLoading || statsLoading ? "alerts-loading" : "alerts-page"}>
      <PageHeader title="MLB Live Alert" subtitle="Real-Time Signals" />
      {sportPills}

      {isLoading || statsLoading ? (
        <main className="p-4 space-y-6">
          {[0, 1, 2].map((i) => <AlertSkeleton key={i} delay={i} />)}
        </main>
      ) : (
        <motion.main
          className="p-4 space-y-6 overflow-y-auto"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Demo mode banner */}
          {alerts.length === 0 && !error && !isLoading && (
            <motion.div
              className="rounded-xl px-4 py-3 flex items-center gap-3 border-l-[3px] border-l-amber-500 border border-slate-800"
              style={{ background: DS.cardSurface }}
              {...cardSlide}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/15">
                <Bell className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Demo Mode</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Showing sample alerts. Real alerts appear when games are live.
                </p>
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {error ? (
            <motion.div
              className="rounded-xl p-8 border text-center border-t-4 border-t-chirpRed"
              style={{ background: DS.cardSurface, borderColor: DS.border }}
              {...cardSlide}
            >
              <AlertTriangle className="h-8 w-8 text-chirpRed mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Unable to load alerts</h3>
              <p className="text-slate-400 text-sm mb-6">Check your connection and try again.</p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="border-chirpRed/30 text-chirpRed hover:bg-chirpRed/10"
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
              <Bell className="h-8 w-8 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">No Alerts Available</h3>
              <p className="text-slate-400 text-sm mb-6">
                No alerts for {filter === 'all' ? 'any sport' : filter} at the moment.
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="border-emeraldGreen/30 text-emeraldGreen hover:bg-emeraldGreen/10"
              >
                <Activity className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Featured live card */}
              {featuredAlert && (
                <ErrorBoundary>
                  <FeaturedAlertCard alert={featuredAlert} />
                </ErrorBoundary>
              )}

              {/* Upcoming Alerts list */}
              {remainingAlerts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-lg font-bold">Upcoming Alerts</h2>
                    <button className="text-primaryBlue text-sm font-bold">See All</button>
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
      )}
    </div>
  );
}
