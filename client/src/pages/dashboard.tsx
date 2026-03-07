import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, TrendingUp, Wind, Activity, Shield, ChevronRight, Target, LayoutGrid, GripHorizontal, Radar, Eye, Calendar } from 'lucide-react';
import { Link } from 'wouter';
import { TeamLogo } from '@/components/team-logo';
import { SportsLoading } from '@/components/sports-loading';
import { useAuth } from '@/hooks/useAuth';
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
  return { icon: Shield, color: 'text-primaryBlue', border: 'border-primaryBlue' };
}

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id;

  // ─── Data fetching ───────────────────────────────────────────────
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 15000,
  });

  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  const { data: monitoredGames = [] } = useQuery({
    queryKey: [`/api/user/${userId}/monitored-games`],
    queryFn: async ({ queryKey }) => {
      const response = await fetch(queryKey[0] as string, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000,
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

  const hottestAlert = useMemo(() => {
    if (alerts.length === 0) return null;
    return [...alerts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  }, [alerts]);

  const oddsAlert = useMemo(() => {
    return alerts.find(a =>
      a.gamblingInsights?.market?.moneyline || a.gamblingInsights?.market?.spread || a.gamblingInsights?.market?.total
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
  const monitoredCount = (monitoredGames as any[]).length;

  // ─── Live featured game helpers ─────────────────────────────────
  const featured = featuredAlert;
  const fHome = featured ? getTeamAbbr(featured.context?.homeTeam || featured.homeTeam) : null;
  const fAway = featured ? getTeamAbbr(featured.context?.awayTeam || featured.awayTeam) : null;
  const fSport = featured?.sport || 'MLB';

  const situationLabel = featured ? (() => {
    const c = featured.context;
    if (c?.inning) {
      const half = c.isTopInning ? 'T' : 'B';
      return `${half}${c.inning}`;
    }
    if (c?.quarter) return `Q${c.quarter}`;
    if (c?.period) return `P${c.period}`;
    return '';
  })() : '';

  const situationBadges = featured ? (() => {
    const c = featured.context;
    const badges: string[] = [];
    if (c?.outs != null) badges.push(`${c.outs} OUT`);
    if (c?.count) badges.push(c.count);
    if (c?.timeRemaining) badges.push(c.timeRemaining);
    return badges;
  })() : [];

  const homeScore = featured?.context?.homeScore ?? featured?.homeScore;
  const awayScore = featured?.context?.awayScore ?? featured?.awayScore;

  const winProbVal = featured?.context?.aiGameProjection?.winProbability?.home
    ? Math.round(featured.context.aiGameProjection.winProbability.home)
    : null;

  const leverageVal = featured?.aiConfidence
    ? featured.aiConfidence.toFixed(0)
    : featured?.gamblingInsights?.confidence
      ? (featured.gamblingInsights.confidence * 100).toFixed(0)
      : null;

  const hasFirst = featured?.context?.hasFirst || false;
  const hasSecond = featured?.context?.hasSecond || false;
  const hasThird = featured?.context?.hasThird || false;

  return (
    <div className="pb-24 sm:pb-28 text-white antialiased min-h-screen bg-[#101922]">
      {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-50 flex items-center backdrop-blur-xl px-4 py-3 justify-between border-b border-slate-800/60 bg-[#101922]">
        <div className="flex items-center gap-3">
          <div className="bg-primaryBlue/20 rounded-lg size-9 flex items-center justify-center text-primaryBlue border border-primaryBlue/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-slate-100 text-sm font-black leading-tight tracking-tight uppercase">Dashboard</h2>
            <p className="text-[10px] text-emeraldGreen font-bold uppercase tracking-widest">
              {hasLiveData ? 'Live' : 'Standby'}
            </p>
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
        <main className="flex-1 p-4 space-y-4 bg-[#101922]">
          {/* ━━ 1. Live Command Center ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {hasLiveData && <span className="h-2 w-2 rounded-full bg-red-500 animate-live-pulse-ring" />}
                <h4 className="text-slate-400 text-[10px] font-black leading-normal tracking-[0.2em] uppercase">Live Command Center</h4>
              </div>
              {featured && fAway && fHome && (
                <span className="text-[10px] font-bold text-slate-500">
                  {fAway} @ {fHome} {situationLabel && `\u2022 ${situationLabel}`}
                </span>
              )}
            </div>

            {featured ? (
              <Link href={featured.gameId ? `/game/${featured.gameId}` : '/alerts'}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-slate-800 shadow-2xl p-4 cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <h3 className="text-2xl font-black text-white tracking-tighter">
                        {fAway} {awayScore ?? '-'} <span className="text-slate-600 px-1">/</span> {fHome} {homeScore ?? '-'}
                      </h3>
                      {situationBadges.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          {situationBadges.map((badge, i) => (
                            <span key={i} className="bg-slate-800 text-[10px] px-1.5 py-0.5 rounded font-bold text-slate-300">{badge}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {fSport === 'MLB' && (
                      <div className="relative size-14 border border-slate-700/50 rotate-45 flex items-center justify-center shrink-0">
                        <div className={`absolute -top-1.5 -left-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasThird ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                        <div className={`absolute -top-1.5 -right-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasSecond ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                        <div className={`absolute -bottom-1.5 -right-1.5 size-2.5 rounded-sm transition-all duration-300 ${hasFirst ? 'bg-emeraldGreen shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'border border-slate-600'}`} />
                        <div className="absolute -bottom-1.5 -left-1.5 size-2.5 border border-slate-600 rounded-sm" />
                      </div>
                    )}

                    {fSport !== 'MLB' && (
                      <div className="flex -space-x-2 shrink-0">
                        <TeamLogo teamName={getTeamName(featured.context?.awayTeam || featured.awayTeam)} abbreviation={fAway || ''} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                        <TeamLogo teamName={getTeamName(featured.context?.homeTeam || featured.homeTeam)} abbreviation={fHome || ''} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Win Prob</p>
                      <span className="text-2xl font-black text-primaryBlue leading-none">
                        {winProbVal != null ? `${winProbVal}%` : '--'}
                      </span>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Confidence</p>
                      <span className="text-2xl font-black text-emeraldGreen leading-none">
                        {leverageVal ?? '--'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              /* Empty state - no live games */
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-slate-800/50 p-6">
                <div className="text-center">
                  <div className="size-12 mx-auto mb-3 rounded-full bg-slate-800/60 flex items-center justify-center">
                    <Radar className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 mb-1">No live games right now</p>
                  <p className="text-xs text-slate-500 mb-4">Monitor games from the calendar to see live data here</p>
                  <Link href="/calendar">
                    <button className="bg-primaryBlue/20 hover:bg-primaryBlue/30 text-primaryBlue font-bold py-2 px-6 rounded-lg border border-primaryBlue/30 transition-all text-sm flex items-center gap-2 mx-auto">
                      <Calendar className="w-4 h-4" />
                      <span>Browse Games</span>
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* ━━ 2. Power Grid (2x2 tiles) ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-2 gap-3">
            {/* ── Live Odds Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primaryBlue/5 rounded-full -translate-y-8 translate-x-8 blur-2xl" />
              <div className="flex items-center justify-between z-10">
                <Activity className="w-5 h-5 text-primaryBlue" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Live Odds</span>
              </div>
              {oddsAlert ? (
                <>
                  <div className="z-10">
                    <p className="text-[10px] text-slate-400 mb-1 uppercase font-bold truncate">
                      {getTeamAbbr(oddsAlert.context?.awayTeam || oddsAlert.awayTeam)} @ {getTeamAbbr(oddsAlert.context?.homeTeam || oddsAlert.homeTeam)}
                    </p>
                    <h4 className="text-sm font-bold text-white leading-snug truncate">
                      {oddsAlert.gamblingInsights?.market?.moneyline
                        ? `ML: ${oddsAlert.gamblingInsights.market.moneyline.home ?? '--'}`
                        : oddsAlert.gamblingInsights?.market?.spread
                          ? `Spread: ${oddsAlert.gamblingInsights.market.spread.points ?? '--'}`
                          : 'Odds Available'}
                    </h4>
                  </div>
                  <Link href="/alerts">
                    <button className="w-full bg-primaryBlue text-white py-2 rounded-lg text-xs font-black shadow-lg shadow-primaryBlue/20">
                      VIEW ODDS
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <div className="z-10 flex-1 flex items-center justify-center">
                    <p className="text-[10px] text-slate-500 text-center">Odds appear when games are live</p>
                  </div>
                  <Link href="/calendar">
                    <button className="w-full border border-slate-700 py-2 rounded-lg text-xs font-bold text-slate-400">
                      MONITOR A GAME
                    </button>
                  </Link>
                </>
              )}
            </div>

            {/* ── Edge Pick Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden">
              {edgeAlert ? (
                <>
                  <div className="absolute top-0 right-0">
                    <span className="bg-emeraldGreen text-[8px] font-black text-black px-2 py-0.5 rounded-bl-lg">
                      {Math.round((edgeAlert.gamblingInsights?.confidence ?? 0) * 100 || edgeAlert.aiConfidence || 0)}% EDGE
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="size-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-emeraldGreen" />
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase">Edge Pick</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white truncate">{edgeAlert.title?.split(':')[0]?.trim() || 'Edge Alert'}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{edgeAlert.gamblingInsights?.bullets?.[0] || edgeAlert.description?.slice(0, 60)}</p>
                  </div>
                  <Link href="/alerts">
                    <button className="w-full bg-emeraldGreen/10 border border-emeraldGreen/30 py-1.5 rounded-lg text-[10px] font-bold text-emeraldGreen">
                      VIEW ANALYSIS
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="size-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-slate-500" />
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase">Edge Pick</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-[10px] text-slate-500 text-center">High-confidence picks appear during live games</p>
                  </div>
                  <div className="h-7" />
                </>
              )}
            </div>

            {/* ── Latest Signal Tile ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Radar className="w-5 h-5 text-emeraldGreen" />
                {signalAlert && (
                  <div className="flex gap-0.5">
                    <div className="size-1 rounded-full bg-emeraldGreen" />
                    <div className="size-1 rounded-full bg-slate-700" />
                    <div className="size-1 rounded-full bg-slate-700" />
                  </div>
                )}
              </div>
              {signalAlert ? (
                <>
                  <div className="flex-1 mt-2 overflow-hidden">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Latest Signal</p>
                    <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{signalAlert.title}</p>
                    <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">{signalAlert.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span className="text-slate-500">{timeAgo(signalAlert.timestamp)}</span>
                    <Link href="/alerts" className="text-primaryBlue uppercase">Details &rarr;</Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 mt-2 flex flex-col items-center justify-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Latest Signal</p>
                    <p className="text-[10px] text-slate-500 text-center">Weather & momentum signals appear during live games</p>
                  </div>
                  <div className="h-4" />
                </>
              )}
            </div>

            {/* ── Games Monitoring Tile (replaces Bankroll) ── */}
            <div className="aspect-square bg-slate-900 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Eye className="w-5 h-5 text-primaryBlue" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Monitoring</span>
              </div>
              <div className="text-center py-1">
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Active Games</span>
                <span className="text-lg font-black text-white">{monitoredCount}</span>
              </div>
              <div className="space-y-1.5">
                {monitoredCount > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {(monitoredGames as any[]).slice(0, 3).map((g: any) => (
                      <span key={g.gameId} className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold truncate max-w-[80px]">
                        {g.awayTeamName ? getTeamAbbr(g.awayTeamName) : '?'} @ {g.homeTeamName ? getTeamAbbr(g.homeTeamName) : '?'}
                      </span>
                    ))}
                    {monitoredCount > 3 && (
                      <span className="text-[8px] text-slate-500 font-bold">+{monitoredCount - 3}</span>
                    )}
                  </div>
                )}
                <Link href="/calendar">
                  <button className="w-full border border-slate-700 py-1 rounded text-[10px] font-bold text-slate-300">
                    {monitoredCount > 0 ? 'MANAGE' : 'ADD GAMES'}
                  </button>
                </Link>
              </div>
            </div>

            {/* ── Hottest Alert (full-width bar, replaces Umpire Trend) ── */}
            <div className="col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-3 flex items-center gap-4">
              <div className="size-12 shrink-0 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                <Target className="w-5 h-5 text-emeraldGreen" />
              </div>
              {hottestAlert ? (
                <Link href="/alerts" className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Hottest Alert</span>
                    <span className="text-[10px] font-bold text-white bg-red-500/20 px-1.5 py-0.5 rounded text-red-400">
                      SCORE {hottestAlert.score ?? '--'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{hottestAlert.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{hottestAlert.description}</p>
                </Link>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Hottest Alert</span>
                  </div>
                  <p className="text-xs text-slate-500">No active alerts. Monitor games to receive real-time signals.</p>
                </div>
              )}
            </div>
          </div>

          {/* ━━ 3. High Confidence Alerts ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {edgePicks.length > 0 && (
            <section className="px-4 pt-2">
              <h3 className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emeraldGreen" />
                High Confidence Alerts
              </h3>
              <div className="space-y-4">
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
                          {confidence}% CONF
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
              </div>
            </section>
          )}

          {/* ━━ 4. Signal Log ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section className="px-4 pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">Signal Log</h3>
              {signalLog.length > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inset-0 rounded-full bg-emeraldGreen animate-live-pulse-ring blur-[2px]" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emeraldGreen" />
                </span>
              )}
            </div>
            {signalLog.length > 0 ? (
              <div className="space-y-2">
                {signalLog.map((signal) => {
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
            ) : (
              <div className="text-center py-8 bg-surface/30 rounded-xl border border-slate-800/50">
                <Radar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No signals yet</p>
                <p className="text-xs text-slate-600 mt-1">Alerts will appear here when your monitored games go live</p>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
