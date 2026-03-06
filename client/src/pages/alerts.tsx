import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Shield, Activity, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSeasonAwareSports } from '@shared/season-manager';
import { Alert } from '@/types';

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
        <div className="bg-white/5 ring-1 ring-red-500/30 rounded-2xl p-6" role="alert">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-400 mb-1">Something went wrong</h3>
              <p className="text-sm text-slate-300">This alert could not be displayed.</p>
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

function getSportColor(sport: string) {
  switch (sport) {
    case 'MLB': return { pill: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20', accent: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' };
    case 'NBA': return { pill: 'bg-purple-500 text-white shadow-lg shadow-purple-500/20', accent: 'text-purple-400', border: 'border-purple-500/20', glow: 'shadow-purple-500/10' };
    case 'NFL': return { pill: 'bg-orange-500 text-white shadow-lg shadow-orange-500/20', accent: 'text-orange-400', border: 'border-orange-500/20', glow: 'shadow-orange-500/10' };
    case 'NHL': return { pill: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20', accent: 'text-cyan-400', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/10' };
    case 'NCAAF': return { pill: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20', accent: 'text-blue-400', border: 'border-blue-500/20', glow: 'shadow-blue-500/10' };
    case 'CFL': return { pill: 'bg-red-500 text-white shadow-lg shadow-red-500/20', accent: 'text-red-400', border: 'border-red-500/20', glow: 'shadow-red-500/10' };
    case 'WNBA': return { pill: 'bg-pink-500 text-white shadow-lg shadow-pink-500/20', accent: 'text-pink-400', border: 'border-pink-500/20', glow: 'shadow-pink-500/10' };
    default: return { pill: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20', accent: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' };
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

// ─── Diamond Component (inline, matches mockup) ──────────────────

function Diamond({ first, second, third }: { first?: boolean; second?: boolean; third?: boolean }) {
  const baseClass = 'w-2.5 h-2.5 rotate-45 border';
  const emptyClass = `${baseClass} border-slate-500/30`;
  const activeClass = `${baseClass} bg-emerald-400 border-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]`;
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      {/* 2nd base - top center */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${second ? activeClass : emptyClass}`} />
      {/* 3rd base - left middle */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 ${third ? activeClass : emptyClass}`} />
      {/* 1st base - right middle */}
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 ${first ? activeClass : emptyClass}`} />
      {/* Home plate - bottom center */}
      <div className="w-1.5 h-1.5 rotate-45 bg-slate-600 absolute bottom-1 left-1/2 -translate-x-1/2 opacity-50" />
    </div>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────

function AlertSkeleton() {
  return (
    <div className="bg-white/5 rounded-2xl border border-white/[0.06] p-4 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-700" />
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
          <div className="h-14 w-14 bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
        <div className="flex flex-col items-center gap-2 w-1/4">
          <div className="h-12 w-12 bg-slate-700 rounded-xl" />
          <div className="h-3 w-8 bg-slate-700 rounded" />
          <div className="h-10 w-10 bg-slate-700 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Featured Live Alert Card ─────────────────────────────────────

function FeaturedAlertCard({ alert }: { alert: Alert }) {
  const homeTeam = getTeamName(alert.homeTeam);
  const awayTeam = getTeamName(alert.awayTeam);
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
  const colors = getSportColor(alert.sport);

  const first = alert.hasFirst || alert.context?.hasFirst;
  const second = alert.hasSecond || alert.context?.hasSecond;
  const third = alert.hasThird || alert.context?.hasThird;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/5 backdrop-blur-sm shadow-2xl p-4">
      {/* Header row */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Live Alert</p>
        </div>
        {winProb && (
          <div className={`flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]`}>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Win Prob ({leadingAbbr})</p>
            <p className="text-xl font-black text-emerald-400 leading-none" style={{ textShadow: '0 0 10px rgba(34,197,94,0.6)' }}>{winProb}%</p>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-between gap-2">
        {/* Home team */}
        <div className={`flex flex-col items-center gap-1 w-1/4 ${leading !== 'home' ? 'opacity-40' : ''}`}>
          <div className="h-12 w-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
            <Shield className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-xs font-black tracking-tighter text-slate-500 uppercase">{homeAbbr}</span>
          <span className="text-4xl font-black">{homeScore}</span>
        </div>

        {/* Center - inning + diamond */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {inningLabel && (
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{inningLabel}</p>
            </div>
          )}
          {isMLB && (
            <Diamond first={first} second={second} third={third} />
          )}
          <div className="text-center space-y-0.5">
            {isMLB && (
              <p className={`text-[10px] font-bold ${colors.accent} tracking-tight`}>
                {getRunnerText(alert).toUpperCase()}
              </p>
            )}
            {alert.context?.down && (
              <p className={`text-[10px] font-bold ${colors.accent} tracking-tight`}>
                {alert.context.down}{alert.context.down === 1 ? 'st' : alert.context.down === 2 ? 'nd' : alert.context.down === 3 ? 'rd' : 'th'} & {alert.context.yardsToGo} {alert.context.fieldPosition ? `at ${alert.context.fieldPosition}` : ''}
              </p>
            )}
            {(isMLB || outs > 0) && (
              <p className="text-[11px] font-black text-white tracking-widest uppercase">{outs} OUT{outs !== 1 ? 'S' : ''}</p>
            )}
          </div>
        </div>

        {/* Away team */}
        <div className={`flex flex-col items-center gap-1 w-1/4 ${leading !== 'away' ? 'opacity-40' : ''}`}>
          <div className="h-12 w-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
            <Shield className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-xs font-black tracking-tighter uppercase text-slate-500">{awayAbbr}</span>
          <span className="text-4xl font-black">{awayScore}</span>
        </div>
      </div>

      {/* AI Insight strip */}
      {alert.context?.aiTitle && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <p className="text-[11px] font-bold text-emerald-400">{alert.context.aiTitle}</p>
          </div>
          {alert.context.aiCallToAction && (
            <p className="text-[11px] text-slate-400 mt-1 ml-5.5">{alert.context.aiCallToAction}</p>
          )}
        </div>
      )}

      {/* Background decoration */}
      <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none">
        <Activity className="w-24 h-24" />
      </div>
    </div>
  );
}

// ─── Compact Alert Card (for the list) ────────────────────────────

function CompactAlertCard({ alert }: { alert: Alert }) {
  const homeAbbr = getAbbr(alert.homeTeam);
  const awayAbbr = getAbbr(alert.awayTeam);
  const homeScore = alert.homeScore ?? alert.context?.homeScore;
  const awayScore = alert.awayScore ?? alert.context?.awayScore;
  const colors = getSportColor(alert.sport);
  const ago = timeAgo(alert.timestamp || alert.createdAt || '');

  return (
    <div className="bg-white/5 p-4 rounded-xl border border-white/[0.06] flex items-center justify-between hover:bg-white/[0.08] transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          <div className="h-10 w-10 bg-white/5 rounded-full border-2 border-[#0D1117] flex items-center justify-center">
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-10 w-10 bg-white/[0.08] rounded-full border-2 border-[#0D1117] flex items-center justify-center">
            <Shield className="w-4 h-4 text-slate-500" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-white">
              {homeAbbr} {homeScore !== undefined ? homeScore : ''} - {awayScore !== undefined ? awayScore : ''} {awayAbbr}
            </p>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${colors.pill} !shadow-none text-[9px]`}>
              {alert.sport}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
            {alert.title || alert.description?.substring(0, 60)}
          </p>
          {ago && <p className="text-[10px] text-slate-600 mt-0.5">{ago}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
    </div>
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
          aiInsights: ['Judge batting .340 in bases-loaded situations', 'Sale has allowed 4 hits in last 2 innings'],
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
          aiInsights: ['Chiefs convert 78% of 4th & Goal from the 3'],
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
          aiInsights: ['LeBron shoots 48% in final 2 minutes this season'],
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
          aiInsights: ['Ohtani now 4-for-4 today'],
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

  // Sort by priority — highest first
  const sortedAlerts = useMemo(() =>
    [...filteredAlerts].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [filteredAlerts]
  );

  const featuredAlert = sortedAlerts[0] || null;
  const remainingAlerts = sortedAlerts.slice(1);

  // ─── Loading State ──────────────────────────────────────────────
  if (isLoading || statsLoading) {
    return (
      <div className="pb-24 min-h-screen" data-testid="alerts-loading">
        <Header />
        <SportPills sports={availableSports} active={filter} onSelect={setFilter} />
        <main className="p-4 space-y-4">
          <AlertSkeleton />
          <AlertSkeleton />
          <AlertSkeleton />
        </main>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="pb-24 min-h-screen" data-testid="alerts-page">
      <Header alertCount={displayAlerts.length} />
      <SportPills sports={availableSports} active={filter} onSelect={setFilter} />

      <main className="p-4 space-y-6 overflow-y-auto">
        {/* Demo mode banner */}
        {alerts.length === 0 && !error && !isLoading && (
          <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-3 border-l-[3px] border-amber-500">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/15">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Demo Mode</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Showing sample alerts. Real alerts appear when games are live.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error ? (
          <div className="bg-white/5 rounded-2xl p-8 border border-red-500/20 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Unable to load alerts</h3>
            <p className="text-slate-400 text-sm mb-6">Check your connection and try again.</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Activity className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : sortedAlerts.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-8 text-center">
            <Bell className="h-8 w-8 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Alerts Available</h3>
            <p className="text-slate-400 text-sm mb-6">
              No alerts for {filter === 'all' ? 'any sport' : filter} at the moment.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
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
                  <h2 className="text-lg font-bold text-white">More Alerts</h2>
                  <span className="text-emerald-400 text-sm font-bold">{remainingAlerts.length} alert{remainingAlerts.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {remainingAlerts.map((alert) => (
                    <ErrorBoundary key={alert.id}>
                      <CompactAlertCard alert={alert} />
                    </ErrorBoundary>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────

function Header({ alertCount }: { alertCount?: number }) {
  return (
    <header className="sticky top-0 z-20 bg-[#0D1117]/80 backdrop-blur-md border-b border-white/[0.06]">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">MLB Live Alert</h1>
        </div>
        <button className="relative p-2 text-slate-400">
          <Bell className="w-6 h-6" />
          {alertCount !== undefined && alertCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
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
    <div className="flex overflow-x-auto px-4 py-3 gap-2 border-b border-white/[0.06] bg-[#0D1117]/60 backdrop-blur-sm" style={{ scrollbarWidth: 'none' }}>
      {sports.map((sport) => {
        const isActive = sport === active;
        const colors = getSportColor(sport === 'all' ? 'MLB' : sport);
        return (
          <button
            key={sport}
            onClick={() => onSelect(sport)}
            data-testid={`sport-tab-${sport.toLowerCase()}`}
            className={`flex-none px-5 py-2 rounded-full font-bold text-sm transition-all ${
              isActive
                ? colors.pill
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            {sport.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
