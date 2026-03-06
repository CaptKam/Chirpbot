import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { ArrowLeft, TrendingUp, Wind, Activity, Shield, Crosshair, X, Settings2 } from 'lucide-react';
import { getTeamAbbr, getTeamName, timeAgo } from '@/utils/team-utils';
import { SportsLoading } from '@/components/sports-loading';
import type { Alert } from '@/types';

// ─── Timeline event type mapping ─────────────────────────────────
function eventMeta(type: string) {
  if (type.includes('weather') || type.includes('wind'))
    return { icon: Wind, ring: 'border-primaryBlue/50 bg-primaryBlue/10', iconColor: 'text-primaryBlue', glow: false, border: 'border-primaryBlue/30' };
  if (type.includes('score') || type.includes('run') || type.includes('goal') || type.includes('touchdown') || type.includes('homer'))
    return { icon: Activity, ring: 'border-primaryBlue bg-primaryBlue', iconColor: 'text-white', glow: false, border: 'border-l-primaryBlue' };
  if (type.includes('close') || type.includes('momentum') || type.includes('lead') || type.includes('insight') || type.includes('probability'))
    return { icon: TrendingUp, ring: 'border-emeraldGreen/50 bg-emeraldGreen/10', iconColor: 'text-emeraldGreen', glow: true, border: 'border-emeraldGreen/30' };
  if (type.includes('umpire') || type.includes('zone') || type.includes('trend'))
    return { icon: Crosshair, ring: 'border-emeraldGreen/50 bg-emeraldGreen/10', iconColor: 'text-emeraldGreen', glow: true, border: 'border-emeraldGreen/30' };
  if (type.includes('odds') || type.includes('market') || type.includes('betting'))
    return { icon: Shield, ring: 'border-emeraldGreen/50 bg-emeraldGreen/10', iconColor: 'text-emeraldGreen', glow: true, border: 'border-emeraldGreen/40' };
  if (type.includes('strikeout') || type.includes('out') || type.includes('error'))
    return { icon: X, ring: 'border-slate-800 bg-slate-900', iconColor: 'text-red-500', glow: false, border: 'border-slate-800' };
  return { icon: Shield, ring: 'border-slate-800 bg-slate-900', iconColor: 'text-slate-400', glow: false, border: 'border-slate-800' };
}

// ─── Mock timeline (shown when no live alerts for game) ──────────
const MOCK_TIMELINE = [
  {
    id: 'nar-1',
    type: 'narrative',
    title: '"Full count pitch coming for Judge..."',
    description: '',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    isNarrative: true,
  },
  {
    id: 'nar-2',
    type: 'insight',
    title: 'Win Prob (NYY) increased to 82%',
    description: 'High-leverage count following loaded bases situation.',
    timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
    meta: 'RE24: +1.45',
  },
  {
    id: 'nar-3',
    type: 'scoring_alert',
    title: 'Runner Steals Second',
    description: 'Gleyber Torres swipes bag on a 98mph heater.',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'nar-4',
    type: 'odds_shift',
    title: 'Odds Shift: Scoring Threat',
    description: 'NYY Moneyline moved to -300 following stolen base.',
    timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
    oddsValue: '-300',
    oddsLabel: 'NYY Moneyline',
  },
  {
    id: 'nar-5',
    type: 'strikeout',
    title: 'Strikeout Looking',
    description: 'Aaron Judge caught looking at a back-door slider.',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

export default function GameNarrative() {
  const [, params] = useRoute('/game/:gameId');
  const gameId = params?.gameId;

  // Fetch alerts for this game
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 10000,
  });

  // Filter alerts for this game, or show all if no gameId
  const gameAlerts = useMemo(() => {
    if (!gameId || gameId === 'live') return alerts;
    return alerts.filter(a => a.gameId === gameId);
  }, [alerts, gameId]);

  // Get featured alert to extract scoreboard
  const featured = useMemo(() => {
    return gameAlerts.find(a =>
      a.context?.homeTeam && a.context?.awayTeam &&
      (a.context?.inning || a.context?.quarter || a.context?.period)
    ) || gameAlerts[0];
  }, [gameAlerts]);

  const hasLiveData = gameAlerts.length > 0;

  // Scoreboard data
  const fHome = featured ? getTeamAbbr(featured.context?.homeTeam || featured.homeTeam) : 'BOS';
  const fAway = featured ? getTeamAbbr(featured.context?.awayTeam || featured.awayTeam) : 'NYY';
  const homeScore = featured?.context?.homeScore ?? featured?.homeScore ?? (hasLiveData ? 0 : 2);
  const awayScore = featured?.context?.awayScore ?? featured?.awayScore ?? (hasLiveData ? 0 : 4);

  const situationTop = featured ? (() => {
    const c = featured.context;
    if (c?.inning) {
      const half = c.isTopInning ? 'Top' : 'Bot';
      return `${half} ${c.inning}th`;
    }
    if (c?.quarter) return `Q${c.quarter}`;
    if (c?.period) return `P${c.period}`;
    return 'Live';
  })() : 'Bot 7th';

  const situationOuts = featured?.context?.outs != null ? `${featured.context.outs} Outs` : '2 Outs';
  const situationBases = featured ? (() => {
    const c = featured.context;
    const bases = [c?.hasFirst && '1st', c?.hasSecond && '2nd', c?.hasThird && '3rd'].filter(Boolean);
    if (bases.length === 3) return 'Bases Loaded';
    if (bases.length > 0) return `Runners ${bases.join(' & ')}`;
    return '';
  })() : 'Runners 1st & 3rd';

  // Timeline events: use live alerts or mock
  const timeline = hasLiveData
    ? gameAlerts.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        timestamp: a.timestamp,
        meta: a.gamblingInsights?.confidence ? `Conf: ${Math.round(a.gamblingInsights.confidence * 100)}%` : undefined,
        oddsValue: a.gamblingInsights?.market?.moneyline?.home ? `${a.gamblingInsights.market.moneyline.home > 0 ? '+' : ''}${a.gamblingInsights.market.moneyline.home}` : undefined,
        oddsLabel: a.gamblingInsights?.market?.moneyline ? `${getTeamName(a.context?.homeTeam || a.homeTeam)} ML` : undefined,
        isNarrative: false,
      }))
    : MOCK_TIMELINE;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-solidBackground flex items-center justify-center">
        <SportsLoading sport="MLB" message="Loading game..." size="lg" />
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-28 min-h-screen antialiased flex flex-col bg-[#101922] text-[#ffffff]">
      {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="sticky top-0 z-30 bg-solidBackground/80 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 bg-[#101922] text-[#ffffff]">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="bg-primaryBlue/20 p-1.5 rounded-lg text-primaryBlue">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight">Live Narrative</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-live-pulse-ring" />
              Live
            </span>
            <button className="text-slate-400">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      {/* ━━ Sticky Scoreboard ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="sticky top-[53px] z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="font-bold text-sm">{fAway} {awayScore}</span>
          </div>
          <span className="text-slate-600 text-xs">@</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm">{fHome} {homeScore}</span>
            <div className="h-6 w-6 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-emeraldGreen uppercase tracking-widest">
            {situationTop} {situationOuts ? `\u2022 ${situationOuts}` : ''}
          </p>
          {situationBases && (
            <p className="text-[9px] font-bold text-slate-500 uppercase">{situationBases}</p>
          )}
        </div>
      </div>
      {/* ━━ Timeline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[39px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-slate-800 to-transparent" />

        <div className="p-4 space-y-6 bg-[#101922] text-[#ffffff]">
          {timeline.map((event) => {
            const meta = eventMeta(event.type);
            const Icon = meta.icon;
            const isInsight = event.type.includes('insight') || event.type.includes('momentum') || event.type.includes('probability') || event.type.includes('odds') || event.type.includes('market');
            const isKeyPlay = event.type.includes('score') || event.type.includes('run') || event.type.includes('homer') || event.type.includes('touchdown');
            const isNarrative = (event as any).isNarrative;
            const hasOdds = (event as any).oddsValue;

            return (
              <div key={event.id} className="relative flex gap-4">
                {/* Timeline node */}
                <div className={`z-10 flex-none h-12 w-12 rounded-full border-2 flex items-center justify-center ${meta.ring} ${isKeyPlay ? 'border-4 border-slate-900 shadow-xl' : ''} ${meta.glow ? 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]' : ''}`}>
                  <Icon className={`w-5 h-5 ${meta.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  {/* Timestamp */}
                  {!isInsight && !hasOdds && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                      {timeAgo(event.timestamp)}
                    </span>
                  )}

                  {/* Card */}
                  {isNarrative ? (
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <p className="font-bold text-sm tracking-tight italic">{event.title}</p>
                    </div>
                  ) : isInsight && !hasOdds ? (
                    <div className={`bg-slate-900 border p-3 rounded-xl ${meta.border} ${meta.glow ? 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]' : ''}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-emeraldGreen uppercase tracking-tighter">Live Insight</span>
                        {(event as any).meta && (
                          <span className="text-[10px] font-bold text-slate-500">{(event as any).meta}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-300">
                        {event.description || event.title}
                      </p>
                    </div>
                  ) : hasOdds ? (
                    <div className={`bg-slate-900 border p-3 rounded-xl ${meta.border} ${meta.glow ? 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)]' : ''}`}>
                      <p className="text-[10px] font-black text-emeraldGreen uppercase mb-2">
                        {event.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{(event as any).oddsLabel}</span>
                        <span className="text-sm font-black bg-emeraldGreen text-slate-950 px-2 py-0.5 rounded">
                          {(event as any).oddsValue}
                        </span>
                      </div>
                      <Link href="/alerts">
                        <button className="w-full mt-3 bg-emeraldGreen/10 hover:bg-emeraldGreen/20 py-2 rounded-lg text-xs font-bold text-emeraldGreen transition-colors border border-emeraldGreen/20">
                          View Live Odds
                        </button>
                      </Link>
                    </div>
                  ) : isKeyPlay ? (
                    <div className="bg-slate-900 border-l-4 border-primaryBlue p-4 rounded-xl shadow-lg">
                      <h3 className="font-black text-lg leading-none mb-1">{event.title}</h3>
                      <p className="text-slate-400 text-sm">{event.description}</p>
                    </div>
                  ) : (
                    <div className={`bg-slate-900 border p-3 rounded-xl ${meta.border} ${event.type.includes('strikeout') || event.type.includes('out') ? 'opacity-80' : ''}`}>
                      <h3 className="font-bold text-sm">{event.title}</h3>
                      {event.description && (
                        <p className="text-slate-500 text-xs mt-0.5">{event.description}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* View Past Innings button */}
          <div className="pt-8 text-center">
            <button className="px-6 py-2 rounded-full border border-slate-800 text-slate-500 text-xs font-bold uppercase tracking-widest hover:bg-slate-900 transition-colors">
              View Past Innings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
