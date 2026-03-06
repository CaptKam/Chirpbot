import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, TrendingUp, Wind, Activity, Shield, ChevronRight, Lock, Target, Crosshair, LayoutGrid, GripHorizontal, Radar, Wallet, Plus } from 'lucide-react';
import { Link } from 'wouter';
import { TeamLogo } from '@/components/team-logo';
import { SportsLoading } from '@/components/sports-loading';
import { getTeamAbbr, getTeamName, timeAgo } from '@/utils/team-utils';
import type { Alert } from '@/types';

// ─── Helper: alert type to icon/color ────────────────────────────
function alertMeta(type: string) {
  if (type.includes('weather') || type.includes('wind'))
    return { icon: Wind, color: 'text-primaryBlue', border: 'border-primaryBlue' };
  if (type.includes('score') || type.includes('run') || type.includes('goal') || type.includes('touchdown'))
    return { icon: Activity, color: 'text-emeraldGreen', border: 'border-emeraldGreen' };
  if (type.includes('close') || type.includes('momentum') || type.includes('lead'))
    return { icon: TrendingUp, color: 'text-amber-400', border: 'border-amber-400' };
  if (type.includes('umpire') || type.includes('zone') || type.includes('trend'))
    return { icon: Crosshair, color: 'text-emeraldGreen', border: 'border-emeraldGreen' };
  return { icon: Shield, color: 'text-primaryBlue', border: 'border-primaryBlue' };
}

// ─── Mock data (shown when no live alerts) ───────────────────────
const MOCK_COMMAND_CENTER = {
  awayAbbr: 'NYY',
  homeAbbr: 'BOS',
  awayName: 'New York Yankees',
  homeName: 'Boston Red Sox',
  sport: 'MLB',
  situation: 'B9',
  awayScore: 4,
  homeScore: 3,
  badges: ['2 OUT', '3-2 COUNT'],
  winProb: 64.2,
  winProbDelta: '+2.4%',
  leverage: 2.15,
  leverageLabel: 'HIGH',
  hasFirst: true,
  hasSecond: true,
  hasThird: true,
};

const MOCK_FLASH_ODDS = {
  tag: 'NEXT AB',
  subtitle: 'Next AB: Judge',
  title: 'Home Run (B9)',
  odds: '+320',
};

const MOCK_EDGE_PICK = {
  playerName: 'S. Ohtani',
  propLine: 'O 1.5 TB (-105)',
  edgePct: 94,
  evPlus: '18.4%',
};

const MOCK_SIGNAL = {
  title: 'Wind Shift: +12% HR Prob in BOS',
  description: 'Gusts 15mph OUT to LF. Advantage hitters.',
  timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
};

const MOCK_UMPIRE = {
  label: 'SKEWED',
  title: 'H. Gibson: High Strikes +14%',
  description: 'Tight zone low. Advantage: Power Pitchers.',
};

const MOCK_SIGNALS = [
  {
    id: 'mock-sig-1',
    type: 'wind_shift',
    title: 'Wind Shift detected in Boston',
    description: 'Wind Gusts up to 15mph blowing OUT to LF. Home Run probability increased by 12%.',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: 'mock-sig-2',
    type: 'umpire_trend',
    title: 'Umpire Strike Zone Trend',
    description: 'H. Gibson calling high strikes 14% more often than league average tonight.',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'mock-sig-3',
    type: 'momentum_shift',
    title: 'Momentum Shift - NYY',
    description: 'Yankees have scored in 3 consecutive innings. Win probability shifted +18% in last 30 min.',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
  },
  {
    id: 'mock-sig-4',
    type: 'scoring_alert',
    title: '2-Run Homer - A. Judge',
    description: 'Aaron Judge hits a 2-run blast to left field (458ft, 112mph). NYY leads 4-3.',
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
  },
];

const MOCK_EDGE_PICKS = [
  {
    id: 'mock-edge-1',
    playerName: 'Shohei Ohtani',
    propLine: 'Total Bases: O 1.5 (-105)',
    modelValue: '+18.4%',
    bookOdds: '-105',
    edgePct: 94,
    away: 'Los Angeles Dodgers',
    home: 'San Francisco Giants',
    sport: 'MLB',
  },
  {
    id: 'mock-edge-2',
    playerName: 'Aaron Judge',
    propLine: 'Home Run: YES (+280)',
    modelValue: '+12.1%',
    bookOdds: '+280',
    edgePct: 87,
    away: 'New York Yankees',
    home: 'Boston Red Sox',
    sport: 'MLB',
  },
];

export default function Dashboard() {
  // ─── Data fetching ───────────────────────────────────────────────
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 15000,
  });

  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  // ─── Derived data ───────────────────────────────────────────────
  const featuredAlert = useMemo(() => {
    return alerts.find(a =>
      a.context?.homeTeam && a.context?.awayTeam &&
      (a.context?.inning || a.context?.quarter || a.context?.period)
    ) || alerts[0];
  }, [alerts]);

  const signalAlert = useMemo(() => {
    return alerts.find(a =>
      a.type?.includes('weather') || a.type?.includes('wind') || a.type?.includes('momentum')
    );
  }, [alerts]);

  const umpireAlert = useMemo(() => {
    return alerts.find(a =>
      a.type?.includes('umpire') || a.type?.includes('zone') || a.type?.includes('trend')
    );
  }, [alerts]);

  const edgeAlert = useMemo(() => {
    return alerts.find(a =>
      (a.gamblingInsights?.confidence ?? 0) > 0.6 || (a.aiConfidence ?? 0) > 70
    );
  }, [alerts]);

  const edgePicks = useMemo(() => {
    return alerts
      .filter(a => (a.gamblingInsights?.confidence ?? 0) > 0.6 || (a.aiConfidence ?? 0) > 70)
      .slice(0, 3);
  }, [alerts]);

  const signalLog = useMemo(() => alerts.slice(0, 8), [alerts]);

  const unreadCount = (alertStats as any)?.unreadCount || 0;
  const hasLiveData = alerts.length > 0;

  // ─── Live featured game helpers ─────────────────────────────────
  const featured = featuredAlert;
  const fHome = featured ? getTeamAbbr(featured.context?.homeTeam || featured.homeTeam) : MOCK_COMMAND_CENTER.homeAbbr;
  const fAway = featured ? getTeamAbbr(featured.context?.awayTeam || featured.awayTeam) : MOCK_COMMAND_CENTER.awayAbbr;
  const fSport = featured?.sport || MOCK_COMMAND_CENTER.sport;

  const situationLabel = featured ? (() => {
    const c = featured.context;
    if (c?.inning) {
      const half = c.isTopInning ? 'T' : 'B';
      return `${half}${c.inning}`;
    }
    if (c?.quarter) return `Q${c.quarter}`;
    if (c?.period) return `P${c.period}`;
    return '';
  })() : MOCK_COMMAND_CENTER.situation;

  const situationBadges = featured ? (() => {
    const c = featured.context;
    const badges: string[] = [];
    if (c?.outs != null) badges.push(`${c.outs} OUT`);
    if (c?.count) badges.push(c.count);
    if (c?.timeRemaining) badges.push(c.timeRemaining);
    return badges;
  })() : MOCK_COMMAND_CENTER.badges;

  const homeScore = featured?.context?.homeScore ?? featured?.homeScore ?? (hasLiveData ? undefined : MOCK_COMMAND_CENTER.homeScore);
  const awayScore = featured?.context?.awayScore ?? featured?.awayScore ?? (hasLiveData ? undefined : MOCK_COMMAND_CENTER.awayScore);

  const winProbVal = featured?.context?.aiGameProjection?.winProbability?.home
    ? Math.round(featured.context.aiGameProjection.winProbability.home)
    : (hasLiveData ? null : MOCK_COMMAND_CENTER.winProb);
  const winProbDelta = hasLiveData ? null : MOCK_COMMAND_CENTER.winProbDelta;

  const leverageVal = hasLiveData
    ? (featured?.aiConfidence ? featured.aiConfidence.toFixed(2) : featured?.gamblingInsights?.confidence ? (featured.gamblingInsights.confidence * 100).toFixed(0) : null)
    : MOCK_COMMAND_CENTER.leverage.toFixed(2);
  const leverageLabel = hasLiveData ? null : MOCK_COMMAND_CENTER.leverageLabel;

  const hasFirst = featured?.context?.hasFirst || (!hasLiveData && MOCK_COMMAND_CENTER.hasFirst);
  const hasSecond = featured?.context?.hasSecond || (!hasLiveData && MOCK_COMMAND_CENTER.hasSecond);
  const hasThird = featured?.context?.hasThird || (!hasLiveData && MOCK_COMMAND_CENTER.hasThird);

  // Signal tile data
  const sigTitle = signalAlert?.title || MOCK_SIGNAL.title;
  const sigDesc = signalAlert?.description || MOCK_SIGNAL.description;
  const sigTime = signalAlert?.timestamp || MOCK_SIGNAL.timestamp;

  // Umpire tile data
  const umpTitle = umpireAlert?.title || MOCK_UMPIRE.title;
  const umpDesc = umpireAlert?.description || MOCK_UMPIRE.description;
  const umpLabel = umpireAlert ? 'LIVE' : MOCK_UMPIRE.label;

  // Edge pick tile data
  const edgeName = edgeAlert?.title?.split(':')[0]?.trim() || MOCK_EDGE_PICK.playerName;
  const edgeLine = edgeAlert?.gamblingInsights?.bullets?.[0] || MOCK_EDGE_PICK.propLine;
  const edgePct = edgeAlert
    ? Math.round((edgeAlert.gamblingInsights?.confidence ?? 0) * 100 || edgeAlert.aiConfidence || 0)
    : MOCK_EDGE_PICK.edgePct;
  const edgeEv = edgeAlert?.gamblingInsights?.market?.total?.points
    ? `${edgeAlert.gamblingInsights.market.total.points}%`
    : MOCK_EDGE_PICK.evPlus;

  return (
    <div className="pb-24 sm:pb-28 bg-solidBackground text-white antialiased min-h-screen">
      {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-50 flex items-center bg-solidBackground/90 backdrop-blur-xl px-4 py-3 justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="bg-primaryBlue/20 rounded-lg size-9 flex items-center justify-center text-primaryBlue border border-primaryBlue/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-slate-100 text-sm font-black leading-tight tracking-tight uppercase">Dashboard</h2>
            <p className="text-[10px] text-emeraldGreen font-bold uppercase tracking-widest">Power Mode</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex size-9 items-center justify-center rounded-lg bg-slate-800/40 text-slate-400 border border-slate-700/50">
            <GripHorizontal className="w-5 h-5" />
          </button>
          <Link href="/alerts">
            <button className="relative flex size-9 items-center justify-center rounded-lg bg-slate-800/40 text-slate-100 border border-slate-700/50">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-primaryBlue border border-solidBackground" />
              )}
            </button>
          </Link>
        </div>
      </header>

      {alertsLoading ? (
        <div className="p-8">
          <SportsLoading sport="MLB" message="Loading dashboard..." size="lg" />
        </div>
      ) : (
        <main className="flex-1 pb-4 p-4 space-y-4">
          {/* ━━ 1. Live Command Center ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-live-pulse-ring" />
                <h4 className="text-slate-400 text-[10px] font-black leading-normal tracking-[0.2em] uppercase">Live Command Center</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                {fAway} @ {fHome} • {situationLabel}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-slate-800 shadow-2xl p-4">
              {/* Score + situation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-black text-white tracking-tighter">
                    {fAway} {awayScore ?? '-'} <span className="text-slate-600 px-1">/</span> {fHome} {homeScore ?? '-'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {situationBadges.map((badge, i) => (
                      <span key={i} className="bg-slate-800 text-[10px] px-1.5 py-0.5 rounded font-bold text-slate-300">{badge}</span>
                    ))}
                  </div>
                </div>

                {/* Baseball diamond */}
                {fSport === 'MLB' && (
                  <div className="relative size-14 border border-slate-700/50 rotate-45 flex items-center justify-center shrink-0">
                    <div className={`absolute -top-1.5 -left-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasThird ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                    <div className={`absolute -top-1.5 -right-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasSecond ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                    <div className={`absolute -bottom-1.5 -right-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasFirst ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                    <div className="absolute -bottom-1.5 -left-1.5 size-2.5 border border-slate-600 rounded-sm" />
                  </div>
                )}

                {/* Team logos (non-MLB) */}
                {fSport !== 'MLB' && (
                  <div className="flex -space-x-2 shrink-0">
                    <TeamLogo teamName={getTeamName(featured?.context?.awayTeam || featured?.awayTeam)} abbreviation={fAway} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                    <TeamLogo teamName={getTeamName(featured?.context?.homeTeam || featured?.homeTeam)} abbreviation={fHome} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Win Prob</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-primaryBlue leading-none">
                      {winProbVal != null ? `${winProbVal}%` : '--'}
                    </span>
                    {winProbDelta && (
                      <span className="text-[10px] text-emeraldGreen font-bold pb-0.5">{winProbDelta}</span>
                    )}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">
                    {hasLiveData ? 'Confidence' : 'RE24 Leverage'}
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-emeraldGreen leading-none">
                      {leverageVal ?? '--'}
                    </span>
                    {leverageLabel && (
                      <span className="text-[10px] text-red-400 font-bold pb-0.5">{leverageLabel}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ━━ 2. Power Grid (2×2 tiles) ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-2 gap-3">
            {/* ── Flash Odds Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primaryBlue/5 rounded-full -translate-y-8 translate-x-8 blur-2xl" />
              <div className="flex items-center justify-between z-10">
                <Activity className="w-5 h-5 text-primaryBlue" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Flash Odds</span>
              </div>
              <div className="z-10">
                <p className="text-[10px] text-slate-400 mb-1 uppercase font-bold">{MOCK_FLASH_ODDS.subtitle}</p>
                <h4 className="text-sm font-bold text-white leading-snug">{MOCK_FLASH_ODDS.title}</h4>
              </div>
              <Link href="/alerts">
                <button className="w-full bg-primaryBlue text-white py-2 rounded-lg text-xs font-black shadow-lg shadow-primaryBlue/20 flex flex-col items-center">
                  <span className="text-[8px] opacity-80 uppercase tracking-tighter">BET NOW</span>
                  <span>{MOCK_FLASH_ODDS.odds}</span>
                </button>
              </Link>
            </div>

            {/* ── Edge Pick Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0">
                <span className="bg-emeraldGreen text-[8px] font-black text-black px-2 py-0.5 rounded-bl-lg">{edgePct}% EDGE</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="size-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emeraldGreen" />
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase">Edge Pick</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{edgeName}</h4>
                <p className="text-[10px] text-slate-400">{edgeLine}</p>
              </div>
              <div className="flex items-center justify-between bg-black/40 rounded-lg p-1.5 border border-slate-800">
                <div className="text-center flex-1">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase">EV+</span>
                  <span className="text-xs font-bold text-emeraldGreen">{edgeEv}</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <Link href="/alerts" className="flex-1 flex justify-center text-primaryBlue">
                  <Plus className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* ── Latest Signal Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Radar className="w-5 h-5 text-emeraldGreen" />
                <div className="flex gap-0.5">
                  <div className="size-1 rounded-full bg-emeraldGreen" />
                  <div className="size-1 rounded-full bg-slate-700" />
                  <div className="size-1 rounded-full bg-slate-700" />
                </div>
              </div>
              <div className="flex-1 mt-2 overflow-hidden">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Latest Signal</p>
                <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{sigTitle}</p>
                <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">{sigDesc}</p>
              </div>
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className="text-slate-500">{timeAgo(sigTime)}</span>
                <Link href="/alerts" className="text-primaryBlue uppercase">Details →</Link>
              </div>
            </div>

            {/* ── Bankroll Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Wallet className="w-5 h-5 text-slate-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Bankroll</span>
              </div>
              <div className="text-center py-1">
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Active Risk</span>
                <span className="text-lg font-black text-white">$450.00</span>
              </div>
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-emeraldGreen h-full w-[70%]" />
                </div>
                <div className="flex justify-between text-[8px] font-black text-slate-500">
                  <span>LIMIT</span>
                  <span>$1.2K MAX</span>
                </div>
              </div>
              <button className="w-full border border-slate-700 py-1 rounded text-[10px] font-bold text-slate-300">MANAGE</button>
            </div>

            {/* ── Umpire Trend (full-width bar) ── */}
            <div className="col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-3 flex items-center gap-4">
              <div className="size-12 shrink-0 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                <Target className="w-5 h-5 text-emeraldGreen" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Umpire Trend</span>
                  <span className="text-[10px] font-bold text-white bg-red-500/20 px-1.5 py-0.5 rounded text-red-400">{umpLabel}</span>
                </div>
                <p className="text-xs font-bold text-white truncate">{umpTitle}</p>
                <p className="text-[10px] text-slate-500 truncate">{umpDesc}</p>
              </div>
            </div>
          </div>

          {/* ━━ 3. Daily Edge Picks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section className="px-4 pt-2">
            <h3 className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emeraldGreen" />
              Daily Edge Picks
            </h3>
            <div className="space-y-4">
              {/* Live edge picks from API */}
              {edgePicks.map((alert) => {
                const confidence = alert.gamblingInsights?.confidence
                  ? Math.round(alert.gamblingInsights.confidence * 100)
                  : alert.aiConfidence || 0;
                const advice = alert.context?.aiBettingAdvice;
                const home = getTeamName(alert.context?.homeTeam || alert.homeTeam);
                const away = getTeamName(alert.context?.awayTeam || alert.awayTeam);

                return (
                  <div key={alert.id} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface to-slate-800 border border-slate-700/50">
                    {confidence > 0 && (
                      <div className="absolute top-0 right-0 bg-emeraldGreen text-black text-[10px] font-black px-3 py-1 rounded-bl-lg">
                        {confidence}% EDGE
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex gap-4 items-center mb-4">
                        <div className="flex -space-x-2">
                          <TeamLogo teamName={away} abbreviation={getTeamAbbr(alert.context?.awayTeam || alert.awayTeam)} sport={alert.sport} size="sm" className="rounded-full border-2 border-slate-700" />
                          <TeamLogo teamName={home} abbreviation={getTeamAbbr(alert.context?.homeTeam || alert.homeTeam)} sport={alert.sport} size="sm" className="rounded-full border-2 border-slate-700" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-white">{alert.title}</h4>
                          <p className="text-xs text-slate-400">{away} @ {home}</p>
                        </div>
                      </div>

                      {(advice || alert.gamblingInsights?.bullets) && (
                        <div className="flex items-center gap-4 py-3 border-y border-slate-800/50 mb-4">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-500 uppercase">Recommendation</p>
                            <p className="font-bold text-emeraldGreen text-sm truncate">
                              {advice?.recommendation || alert.gamblingInsights?.bullets?.[0] || '--'}
                            </p>
                          </div>
                          {advice?.confidence != null && (
                            <>
                              <div className="w-px h-8 bg-slate-800" />
                              <div className="text-right">
                                <p className="text-[10px] text-slate-500 uppercase">AI Conf.</p>
                                <p className="font-bold text-white">{Math.round(advice.confidence)}%</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <Link href="/alerts">
                        <button className="w-full bg-primaryBlue/20 hover:bg-primaryBlue/30 text-primaryBlue font-bold py-2.5 rounded-lg border border-primaryBlue/30 transition-all flex items-center justify-center gap-2">
                          <span>VIEW ANALYSIS</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}

              {/* Mock edge picks (show when no live picks) */}
              {edgePicks.length < 2 && MOCK_EDGE_PICKS.slice(edgePicks.length).map((pick) => (
                <div key={pick.id} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface to-slate-800 border border-slate-700/50">
                  <div className="absolute top-0 right-0 bg-emeraldGreen text-black text-[10px] font-black px-3 py-1 rounded-bl-lg">
                    {pick.edgePct}% EDGE
                  </div>
                  <div className="p-5">
                    <div className="flex gap-4 items-center mb-4">
                      <div className="flex -space-x-2">
                        <TeamLogo teamName={pick.away} abbreviation={getTeamAbbr(pick.away)} sport={pick.sport} size="sm" className="rounded-full border-2 border-slate-700" />
                        <TeamLogo teamName={pick.home} abbreviation={getTeamAbbr(pick.home)} sport={pick.sport} size="sm" className="rounded-full border-2 border-slate-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{pick.playerName}</h4>
                        <p className="text-xs text-slate-400">{pick.propLine}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-3 border-y border-slate-800/50 mb-4">
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-500 uppercase">Avg Model Value</p>
                        <p className="font-bold text-emeraldGreen">{pick.modelValue}</p>
                      </div>
                      <div className="w-px h-8 bg-slate-800" />
                      <div className="flex-1 text-right">
                        <p className="text-[10px] text-slate-500 uppercase">Book Odds</p>
                        <p className="font-bold text-white">{pick.bookOdds}</p>
                      </div>
                    </div>

                    <button className="w-full bg-primaryBlue/20 hover:bg-primaryBlue/30 text-primaryBlue font-bold py-2.5 rounded-lg border border-primaryBlue/30 transition-all flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>ADD TO SLIP</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ━━ 4. Signal Log ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section className="px-4 pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">Signal Log</h3>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inset-0 rounded-full bg-emeraldGreen animate-live-pulse-ring blur-[2px]" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emeraldGreen" />
              </span>
            </div>
            <div className="space-y-2">
              {(signalLog.length > 0 ? signalLog : MOCK_SIGNALS).map((signal) => {
                const meta = alertMeta(signal.type);
                const Icon = meta.icon;
                return (
                  <div key={signal.id} className={`flex gap-3 p-3 bg-surface/50 rounded-lg border-l-2 ${meta.border}`}>
                    <div className={`shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-bold text-white truncate">{signal.title}</p>
                        <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(signal.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{signal.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
