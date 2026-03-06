import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Search, TrendingUp, Wind, Activity, Shield, Play, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { PageHeader } from '@/components/PageHeader';
import { TeamLogo } from '@/components/team-logo';
import { SportsLoading } from '@/components/sports-loading';
import type { Alert } from '@/types';

// ─── Helper: time ago ─────────────────────────────────────────────
function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

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

// ─── Helper: extract team abbreviation ───────────────────────────
function teamAbbr(team: string | { name: string; abbreviation?: string } | undefined): string {
  if (!team) return '???';
  if (typeof team === 'object') return team.abbreviation || team.name?.slice(0, 3).toUpperCase() || '???';
  const words = team.split(' ');
  return words.length > 1 ? words[words.length - 1].slice(0, 3).toUpperCase() : team.slice(0, 3).toUpperCase();
}

function teamName(team: string | { name: string } | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'object' ? team.name : team;
}

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
  // Featured live alert (most recent with game context)
  const featuredAlert = useMemo(() => {
    return alerts.find(a =>
      a.context?.homeTeam && a.context?.awayTeam &&
      (a.context?.inning || a.context?.quarter || a.context?.period)
    ) || alerts[0];
  }, [alerts]);

  // Alerts with gambling insights for the markets section
  const marketAlerts = useMemo(() => {
    return alerts
      .filter(a => a.gamblingInsights?.market || a.context?.aiBettingAdvice)
      .slice(0, 6);
  }, [alerts]);

  // High-confidence alerts for edge picks
  const edgePicks = useMemo(() => {
    return alerts
      .filter(a => (a.gamblingInsights?.confidence ?? 0) > 0.6 || (a.aiConfidence ?? 0) > 70)
      .slice(0, 3);
  }, [alerts]);

  // Recent signal log (latest 8 alerts)
  const signalLog = useMemo(() => alerts.slice(0, 8), [alerts]);

  const unreadCount = (alertStats as any)?.unreadCount || 0;

  // ─── Featured game helpers ──────────────────────────────────────
  const featured = featuredAlert;
  const fHome = featured ? teamAbbr(featured.context?.homeTeam || featured.homeTeam) : '???';
  const fAway = featured ? teamAbbr(featured.context?.awayTeam || featured.awayTeam) : '???';
  const fHomeName = featured ? teamName(featured.context?.homeTeam || featured.homeTeam) : 'TBD';
  const fAwayName = featured ? teamName(featured.context?.awayTeam || featured.awayTeam) : 'TBD';
  const fSport = featured?.sport || 'MLB';

  const situationText = featured ? (() => {
    const c = featured.context;
    if (c?.inning) {
      const half = c.isTopInning ? 'T' : 'B';
      const outs = c.outs != null ? ` | ${c.outs} OUT` : '';
      const bases = [c.hasFirst && '1B', c.hasSecond && '2B', c.hasThird && '3B'].filter(Boolean);
      const baseText = bases.length === 3 ? ' | BASES LOADED' : bases.length > 0 ? ` | ${bases.join(', ')}` : '';
      return `${half}${c.inning}${outs}${baseText}`;
    }
    if (c?.quarter) return `Q${c.quarter} ${c.timeRemaining || ''}`.trim();
    if (c?.period) return `P${c.period} ${c.timeRemaining || ''}`.trim();
    return featured.type?.replace(/_/g, ' ').toUpperCase() || 'ALERT';
  })() : '';

  const homeScore = featured?.context?.homeScore ?? featured?.homeScore;
  const awayScore = featured?.context?.awayScore ?? featured?.awayScore;
  const winProb = featured?.context?.aiGameProjection?.winProbability;

  // Baseball diamond bases
  const hasFirst = featured?.context?.hasFirst || false;
  const hasSecond = featured?.context?.hasSecond || false;
  const hasThird = featured?.context?.hasThird || false;

  return (
    <div className="pb-24 sm:pb-28 bg-solidBackground text-white antialiased min-h-screen">
      <PageHeader title="ChirpBot" subtitle="System Online">
        <div className="flex gap-2">
          <Link href="/alerts">
            <button className="relative flex size-10 items-center justify-center rounded-full bg-slate-800/50 text-slate-100">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 rounded-full bg-primaryBlue" />
              )}
            </button>
          </Link>
        </div>
      </PageHeader>

      {alertsLoading ? (
        <div className="p-8">
          <SportsLoading sport="MLB" message="Loading dashboard..." size="lg" />
        </div>
      ) : (
        <main className="flex-1">
          {/* ── 1. Live Command Center ─────────────────────────────── */}
          {featured && (
            <section className="p-4">
              <h4 className="text-slate-400 text-[10px] font-black tracking-[0.2em] mb-3 uppercase">
                Live Command Center
              </h4>
              <div className="relative overflow-hidden rounded-xl bg-surface border border-slate-800 shadow-2xl">
                {/* LIVE badge */}
                <div className="absolute top-0 right-0 p-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-chirpRed/10 px-2 py-1 text-[10px] font-bold text-chirpRed">
                    <span className="h-1.5 w-1.5 rounded-full bg-chirpRed animate-pulse" /> LIVE
                  </span>
                </div>

                <div className="p-5">
                  {/* Situation + matchup */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-medium">{situationText}</span>
                      <h3 className="text-xl font-bold text-white mt-1">
                        {fAway}
                        {awayScore != null && <span className="text-slate-400 ml-2">{awayScore}</span>}
                        <span className="text-slate-500 mx-2">vs</span>
                        {fHome}
                        {homeScore != null && <span className="text-slate-400 ml-2">{homeScore}</span>}
                      </h3>
                    </div>

                    {/* Baseball diamond (MLB only) */}
                    {fSport === 'MLB' && (
                      <div className="flex items-center justify-center h-16 w-16 rotate-45 border-2 border-slate-700/50 relative shrink-0">
                        <div className={`absolute -top-1.5 -right-1.5 size-3 rounded-sm ${hasSecond ? 'bg-emeraldGreen' : 'border border-slate-600'}`} />
                        <div className={`absolute -top-1.5 -left-1.5 size-3 rounded-sm ${hasThird ? 'bg-emeraldGreen' : 'border border-slate-600'}`} />
                        <div className={`absolute -bottom-1.5 -right-1.5 size-3 rounded-sm ${hasFirst ? 'bg-emeraldGreen' : 'border border-slate-600'}`} />
                        <div className="absolute -bottom-1.5 -left-1.5 size-3 border border-slate-600 rounded-sm" />
                      </div>
                    )}

                    {/* Team logos (non-MLB) */}
                    {fSport !== 'MLB' && (
                      <div className="flex -space-x-2 shrink-0">
                        <TeamLogo teamName={fAwayName} abbreviation={fAway} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                        <TeamLogo teamName={fHomeName} abbreviation={fHome} sport={fSport} size="sm" className="rounded-full border-2 border-slate-800" />
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Win Prob</p>
                      <p className="text-2xl font-black text-primaryBlue">
                        {winProb ? `${Math.round(winProb.home)}%` : '--'}
                      </p>
                    </div>
                    <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Confidence</p>
                      <p className="text-2xl font-black text-emeraldGreen">
                        {featured.aiConfidence ? `${featured.aiConfidence}%` : featured.gamblingInsights?.confidence ? `${Math.round(featured.gamblingInsights.confidence * 100)}%` : '--'}
                      </p>
                    </div>
                  </div>

                  <Link href="/alerts">
                    <button className="w-full bg-primaryBlue hover:bg-primaryBlue/90 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                      <span>VIEW FULL ANALYSIS</span>
                      <TrendingUp className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ── 2. Flash Odds Markets ──────────────────────────────── */}
          {marketAlerts.length > 0 && (
            <section className="py-2">
              <div className="flex items-center justify-between px-4 mb-3">
                <h3 className="text-white text-base font-bold tracking-tight">FLASH ODDS MARKETS</h3>
                <Link href="/alerts">
                  <span className="text-primaryBlue text-xs font-bold">VIEW ALL</span>
                </Link>
              </div>
              <div className="flex overflow-x-auto gap-3 px-4 no-scrollbar">
                {marketAlerts.map((alert) => {
                  const market = alert.gamblingInsights?.market;
                  const ml = market?.moneyline;
                  const total = market?.total;

                  return (
                    <div key={alert.id} className="min-w-[280px] bg-surface border border-slate-800 p-4 rounded-xl shrink-0">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-emeraldGreen bg-emeraldGreen/10 px-2 py-0.5 rounded uppercase">
                          {alert.type?.replace(/_/g, ' ').slice(0, 20) || 'MARKET'}
                        </span>
                        <span className="text-slate-500 text-[10px]">{timeAgo(alert.timestamp)}</span>
                      </div>
                      <p className="text-sm font-bold text-white mb-4 line-clamp-2">{alert.title}</p>
                      <div className="flex gap-2">
                        {ml?.home != null && (
                          <div className="flex-1 bg-slate-800 border border-slate-700 text-white py-2 rounded-lg text-sm font-bold flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-normal">HOME</span>
                            <span>{ml.home > 0 ? '+' : ''}{ml.home}</span>
                          </div>
                        )}
                        {ml?.away != null && (
                          <div className="flex-1 bg-slate-800 border border-slate-700 text-white py-2 rounded-lg text-sm font-bold flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-normal">AWAY</span>
                            <span>{ml.away > 0 ? '+' : ''}{ml.away}</span>
                          </div>
                        )}
                        {total?.points != null && (
                          <div className="flex-1 bg-primaryBlue/20 border border-primaryBlue/30 text-primaryBlue py-2 rounded-lg text-sm font-bold flex flex-col items-center">
                            <span className="text-[10px] font-normal opacity-70">O/U</span>
                            <span>{total.points}</span>
                          </div>
                        )}
                        {!ml && !total && (
                          <div className="flex-1 bg-primaryBlue/10 text-primaryBlue py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1">
                            <span>View Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 3. Daily Edge Picks ────────────────────────────────── */}
          {edgePicks.length > 0 && (
            <section className="p-4">
              <h3 className="text-white text-base font-bold tracking-tight mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emeraldGreen" />
                DAILY EDGE PICKS
              </h3>
              <div className="space-y-4">
                {edgePicks.map((alert) => {
                  const confidence = alert.gamblingInsights?.confidence
                    ? Math.round(alert.gamblingInsights.confidence * 100)
                    : alert.aiConfidence || 0;
                  const advice = alert.context?.aiBettingAdvice;
                  const home = teamName(alert.context?.homeTeam || alert.homeTeam);
                  const away = teamName(alert.context?.awayTeam || alert.awayTeam);

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
                            <TeamLogo teamName={away} abbreviation={teamAbbr(alert.context?.awayTeam || alert.awayTeam)} sport={alert.sport} size="sm" className="rounded-full border-2 border-slate-700" />
                            <TeamLogo teamName={home} abbreviation={teamAbbr(alert.context?.homeTeam || alert.homeTeam)} sport={alert.sport} size="sm" className="rounded-full border-2 border-slate-700" />
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

          {/* ── 4. Signal Log ──────────────────────────────────────── */}
          <section className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">Signal Log</h3>
              <span className="flex h-2 w-2 rounded-full bg-emeraldGreen animate-pulse" />
            </div>
            {signalLog.length === 0 ? (
              <div className="bg-surface rounded-xl p-8 text-center border border-slate-800">
                <Bell className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-200 mb-1">No Signals Yet</h3>
                <p className="text-sm text-slate-500">Monitor games from the Schedule tab to receive signals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {signalLog.map((alert) => {
                  const meta = alertMeta(alert.type);
                  const Icon = meta.icon;
                  return (
                    <div key={alert.id} className={`flex gap-3 p-3 bg-surface/50 rounded-lg border-l-2 ${meta.border}`}>
                      <div className={`shrink-0 ${meta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-bold text-white truncate">{alert.title}</p>
                          <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(alert.timestamp)}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{alert.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Empty state when no alerts at all ──────────────────── */}
          {!featured && signalLog.length === 0 && (
            <section className="p-4">
              <div className="bg-surface rounded-xl p-8 text-center border border-slate-800">
                <Activity className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-200 mb-2">Welcome to ChirpBot</h3>
                <p className="text-sm text-slate-400 mb-6">Head to the Schedule tab to monitor games and start receiving live signals.</p>
                <Link href="/calendar">
                  <button className="bg-primaryBlue hover:bg-primaryBlue/90 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                    Browse Games
                  </button>
                </Link>
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
