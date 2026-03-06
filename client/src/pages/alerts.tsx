import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { UniversalAlertCard } from '@/components/UniversalAlertCard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, TrendingUp, Users, Bell, Activity } from 'lucide-react';
import { AlertLoading } from '@/components/sports-loading';
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';
import { getSeasonAwareSports, getSportTabColors } from '@shared/season-manager';
import { Alert } from '@/types';

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AlertCard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#161B22] ring-1 ring-red-500/30 border-0 rounded-xl p-6 shadow-xl shadow-red-500/5" role="alert">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-red-400 mb-1">Something went wrong</h3>
              <p className="text-sm text-slate-300" style={{ fontSize: '14px' }}>This alert could not be displayed. Try refreshing the page.</p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AlertStats {
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  monitoredGames: number;
}

// Shimmer skeleton with glassmorphism design
const ShimmerBlock = ({ w = '100%', h = 14, r = 8 }: { w?: string | number; h?: number; r?: number }) => (
  <div className="animate-shimmer" style={{ width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,0.04)' }} />
);

const AlertSkeleton = ({ sport, delay = 0 }: { sport: string; delay?: number }) => {
  return (
    <div
      className="glass-card rounded-2xl overflow-hidden animate-stagger-in"
      style={{
        animationDelay: `${delay * 80}ms`,
        borderTop: '2px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="p-4">
        {/* Header shimmer */}
        <div className="flex items-center gap-2.5 mb-3">
          <ShimmerBlock w={36} h={36} r={12} />
          <div className="flex-1 space-y-1.5">
            <ShimmerBlock w={100} h={10} />
            <ShimmerBlock w={60} h={8} />
          </div>
          <ShimmerBlock w={48} h={22} r={8} />
        </div>
        {/* Scoreboard shimmer */}
        <div className="glass-surface rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShimmerBlock w={80} h={12} />
              <ShimmerBlock w={28} h={24} r={4} />
            </div>
            <ShimmerBlock w={20} h={8} />
            <div className="flex items-center gap-2 flex-row-reverse">
              <ShimmerBlock w={80} h={12} />
              <ShimmerBlock w={28} h={24} r={4} />
            </div>
          </div>
        </div>
        {/* Content shimmer */}
        <div className="space-y-2 mb-3">
          <ShimmerBlock w="85%" h={12} />
          <ShimmerBlock w="60%" h={10} />
        </div>
      </div>
      {/* Footer shimmer */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <ShimmerBlock w={40} h={16} r={20} />
        <ShimmerBlock w={50} h={16} r={20} />
      </div>
    </div>
  );
};

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF' | 'WNBA' | 'CFL'>('all');

  // Fetch alerts using React Query with HTTP polling every 5 seconds
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts, error: alertsError } = useQuery<Alert[]>({
    queryKey: ['/api/alerts', { limit: 120 }],
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
    retry: 1,
    staleTime: 15000, // Consider data stale after 15 seconds
  });


  // Fetch alert stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000, // Refetch every minute
  });

  // Demo alerts shown when no real alerts exist (for UI testing)
  const demoAlerts: Alert[] = useMemo(() => {
    const now = new Date().toISOString();
    return [
      {
        id: 'demo-1',
        type: 'MLB_BASES_LOADED_NO_OUTS',
        sport: 'MLB',
        title: 'Bases Loaded, 0 Outs',
        description: 'Aaron Judge at bat with bases loaded, no outs in the 7th. Yankees trail 3-2.',
        message: 'Aaron Judge at bat with bases loaded, no outs in the 7th. Yankees trail 3-2.',
        gameId: 'demo_mlb_1',
        confidence: 87,
        priority: 95,
        homeTeam: 'New York Yankees',
        awayTeam: 'Boston Red Sox',
        homeScore: 2,
        awayScore: 3,
        inning: 7,
        isTopInning: false,
        outs: 0,
        hasFirst: true,
        hasSecond: true,
        hasThird: true,
        context: {
          homeTeam: 'New York Yankees',
          awayTeam: 'Boston Red Sox',
          homeScore: 2,
          awayScore: 3,
          inning: 7,
          isTopInning: false,
          confidence: 0.87,
          scoringProbability: 0.86,
          currentBatter: 'Aaron Judge',
          currentPitcher: 'Chris Sale',
          aiInsights: ['Judge batting .340 in bases-loaded situations this season', 'Sale has allowed 4 hits in last 2 innings', 'Wind blowing out at 14mph to center field at Fenway', 'Run expectancy with bases loaded, 0 out: +2.29 runs'],
          aiTitle: 'High-Leverage At-Bat',
          aiCallToAction: 'Watch for grand slam opportunity',
        },
        timestamp: now,
        sentToTelegram: false,
      },
      {
        id: 'demo-2',
        type: 'NFL_RED_ZONE',
        sport: 'NFL',
        title: 'Red Zone - 4th & Goal',
        description: 'Chiefs at the 3-yard line, 4th & Goal. Mahomes targeting Kelce. 2:15 left in the 4th.',
        message: 'Chiefs at the 3-yard line, 4th & Goal. Mahomes targeting Kelce. 2:15 left in the 4th.',
        gameId: 'demo_nfl_1',
        confidence: 92,
        priority: 96,
        homeTeam: 'Kansas City Chiefs',
        awayTeam: 'Buffalo Bills',
        homeScore: 24,
        awayScore: 27,
        context: {
          homeTeam: 'Kansas City Chiefs',
          awayTeam: 'Buffalo Bills',
          homeScore: 24,
          awayScore: 27,
          quarter: 4,
          timeRemaining: '2:15',
          down: 4,
          yardsToGo: 3,
          fieldPosition: 'BUF 3',
          confidence: 0.92,
          aiInsights: ['Chiefs convert 78% of 4th & Goal from the 3', 'Kelce has 3 TDs in red zone this season', 'Bills defense allowing 62% red zone conversion rate'],
          aiTitle: 'Must-Score Situation',
          aiCallToAction: 'Game-deciding play incoming',
          scoringProbability: 0.78,
        },
        timestamp: new Date(Date.now() - 120000).toISOString(),
        sentToTelegram: false,
      },
      {
        id: 'demo-3',
        type: 'NBA_CLUTCH_TIME',
        sport: 'NBA',
        title: 'Clutch Time - Tied Game',
        description: 'Lakers-Warriors tied 108-108 with 1:42 left. LeBron has the ball against Curry.',
        message: 'Lakers-Warriors tied 108-108 with 1:42 left. LeBron has the ball against Curry.',
        gameId: 'demo_nba_1',
        confidence: 85,
        priority: 90,
        homeTeam: 'Los Angeles Lakers',
        awayTeam: 'Golden State Warriors',
        homeScore: 108,
        awayScore: 108,
        context: {
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Golden State Warriors',
          homeScore: 108,
          awayScore: 108,
          quarter: 4,
          timeRemaining: '1:42',
          confidence: 0.85,
          aiInsights: ['LeBron shoots 48% in final 2 minutes this season', 'Warriors have blown 3 4th-quarter leads this week', 'Lakers on an 8-0 run in last 2 minutes'],
          aiTitle: 'Clutch Time Showdown',
          aiCallToAction: 'Star vs star in crunch time',
          scoringProbability: 0.52,
        },
        timestamp: new Date(Date.now() - 60000).toISOString(),
        sentToTelegram: false,
      },
      {
        id: 'demo-4',
        type: 'MLB_MOMENTUM_SHIFT',
        sport: 'MLB',
        title: 'Momentum Shift',
        description: 'Dodgers score 4 runs in the 6th to take a 6-3 lead. Ohtani with a 2-run double.',
        message: 'Dodgers score 4 runs in the 6th to take a 6-3 lead. Ohtani with a 2-run double.',
        gameId: 'demo_mlb_2',
        confidence: 79,
        priority: 82,
        homeTeam: 'Los Angeles Dodgers',
        awayTeam: 'San Diego Padres',
        homeScore: 6,
        awayScore: 3,
        inning: 6,
        isTopInning: false,
        outs: 1,
        hasFirst: false,
        hasSecond: true,
        hasThird: false,
        context: {
          homeTeam: 'Los Angeles Dodgers',
          awayTeam: 'San Diego Padres',
          homeScore: 6,
          awayScore: 3,
          inning: 6,
          isTopInning: false,
          currentBatter: 'Freddie Freeman',
          aiInsights: ['Ohtani now 4-for-4 today', 'Padres bullpen ERA is 5.20 this month'],
          aiTitle: 'Rally in Progress',
        },
        timestamp: new Date(Date.now() - 300000).toISOString(),
        sentToTelegram: false,
      },
      {
        id: 'demo-5',
        type: 'NFL_FOURTH_DOWN',
        sport: 'NFL',
        title: '4th Down Decision',
        description: 'Eagles go for it on 4th & 1 at midfield. Hurts in shotgun, 3rd quarter.',
        message: 'Eagles go for it on 4th & 1 at midfield. Hurts in shotgun, 3rd quarter.',
        gameId: 'demo_nfl_2',
        confidence: 74,
        priority: 78,
        homeTeam: 'Philadelphia Eagles',
        awayTeam: 'Dallas Cowboys',
        homeScore: 17,
        awayScore: 14,
        context: {
          homeTeam: 'Philadelphia Eagles',
          awayTeam: 'Dallas Cowboys',
          homeScore: 17,
          awayScore: 14,
          quarter: 3,
          timeRemaining: '8:33',
          down: 4,
          yardsToGo: 1,
          fieldPosition: 'DAL 48',
          confidence: 0.74,
          aiInsights: ['Eagles convert 82% on 4th & 1 this season', 'Hurts averages 3.2 yards on QB sneaks'],
          aiTitle: 'Aggressive Play Call',
        },
        timestamp: new Date(Date.now() - 180000).toISOString(),
        sentToTelegram: false,
      },
    ];
  }, []);

  // Use demo alerts when no real alerts are available
  const displayAlerts = (alerts && alerts.length > 0) ? alerts : demoAlerts;

  // Group alerts by sport for better organization
  const alertsBySport = useMemo(() => {
    const grouped: Record<string, Alert[]> = {};
    (displayAlerts as Alert[]).forEach((alert: Alert) => {
      const sport = alert.sport || 'OTHER';
      if (!grouped[sport]) grouped[sport] = [];
      grouped[sport].push(alert);
    });
    return grouped;
  }, [displayAlerts]);

  const filteredAlerts = filter === 'all'
    ? (displayAlerts as Alert[] || [])
    : (displayAlerts as Alert[] || []).filter((alert: Alert) => alert.sport === filter);


  if (alertsLoading || statsLoading) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#080C10] to-[#0D0D0D] text-slate-100 antialiased min-h-screen" data-testid="alerts-loading">
        <PageHeader 
          title="ChirpBot" 
          subtitle="Real-Time Alert Dashboard"
        />

        {/* Filter Tabs - placeholder during loading */}
        <SportTabs 
          sports={['all', ...getSeasonAwareSports()]} 
          activeSport={filter} 
          onSportChange={(sport) => setFilter(sport as typeof filter)}
          data-testid="sport-filter-tabs" 
        />

        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6" data-testid="alerts-container">
          <div className="pb-8 space-y-4" data-testid="alerts-skeleton-list">
            {Array.from({ length: 5 }, (_, index) => (
              <AlertSkeleton key={`skeleton-${index}`} sport={filter} delay={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#080C10] to-[#0D0D0D] text-slate-100 antialiased min-h-screen" data-testid="alerts-page">
      <PageHeader 
        title="ChirpBot" 
        subtitle="Real-Time Alert Dashboard"
      />

      {/* Filter Tabs - moved outside constraining div for full width */}
      <SportTabs 
        sports={['all', ...getSeasonAwareSports()]} 
        activeSport={filter} 
        onSportChange={(sport) => setFilter(sport as typeof filter)}
        data-testid="sport-filter-tabs" 
      />

      <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6" data-testid="alerts-container">
        {/* Demo mode banner — glass design */}
        {(!alerts || alerts.length === 0) && !alertsError && !alertsLoading && (
          <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 animate-stagger-in" style={{ borderLeft: '3px solid #F59E0B' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="font-display text-[11px] font-bold text-amber-400 uppercase tracking-wider">Demo Mode</span>
              <p className="text-[11px] text-slate-400 mt-0.5 font-display">
                Showing sample alerts. Real alerts appear when games are live.
              </p>
            </div>
          </div>
        )}
        {/* Alerts Content */}
        <div className="pb-8 space-y-4" data-testid="alerts-list">
        {alertsError ? (
          <div className="glass-card rounded-2xl p-8 animate-stagger-in" style={{ borderTop: '2px solid #EF4444' }} role="alert">
            <div className="text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-display">
                Unable to load alerts
              </h3>
              <p className="text-slate-400 text-sm mb-6 font-display">
                We couldn't connect to the server. Check your connection and try again.
              </p>
              <Button
                onClick={() => refetchAlerts()}
                variant="outline"
                size="lg"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 min-h-[48px] px-8 font-bold btn-haptic"
                aria-label="Retry loading alerts"
              >
                <Activity className="w-4 h-4 mr-2" aria-hidden="true" />
                Try Again
              </Button>
            </div>
          </div>
        ) : filteredAlerts.length === 0 ? (() => {
          // Static class mappings to ensure Tailwind includes all classes for empty state
          const getSportEmptyStateClasses = (sport: string) => {
            switch (sport) {
              case 'MLB':
                return {
                  shadow: 'shadow-green-500/5',
                  iconBg: 'bg-green-500/20',
                  iconRing: 'ring-green-500/30',
                  iconColor: 'text-green-400',
                  buttonBorder: 'border-green-500/30',
                  buttonText: 'text-green-400',
                  buttonHover: 'hover:bg-green-500/10 hover:border-green-500'
                };
              case 'NFL':
                return {
                  shadow: 'shadow-orange-500/5',
                  iconBg: 'bg-orange-500/20',
                  iconRing: 'ring-orange-500/30',
                  iconColor: 'text-orange-400',
                  buttonBorder: 'border-orange-500/30',
                  buttonText: 'text-orange-400',
                  buttonHover: 'hover:bg-orange-500/10 hover:border-orange-500'
                };
              case 'NBA':
                return {
                  shadow: 'shadow-purple-500/5',
                  iconBg: 'bg-purple-500/20',
                  iconRing: 'ring-purple-500/30',
                  iconColor: 'text-purple-400',
                  buttonBorder: 'border-purple-500/30',
                  buttonText: 'text-purple-400',
                  buttonHover: 'hover:bg-purple-500/10 hover:border-purple-500'
                };
              case 'NHL':
                return {
                  shadow: 'shadow-cyan-500/5',
                  iconBg: 'bg-cyan-500/20',
                  iconRing: 'ring-cyan-500/30',
                  iconColor: 'text-cyan-400',
                  buttonBorder: 'border-cyan-500/30',
                  buttonText: 'text-cyan-400',
                  buttonHover: 'hover:bg-cyan-500/10 hover:border-cyan-500'
                };
              case 'NCAAF':
                return {
                  shadow: 'shadow-blue-500/5',
                  iconBg: 'bg-blue-500/20',
                  iconRing: 'ring-blue-500/30',
                  iconColor: 'text-blue-400',
                  buttonBorder: 'border-blue-500/30',
                  buttonText: 'text-blue-400',
                  buttonHover: 'hover:bg-blue-500/10 hover:border-blue-500'
                };
              case 'CFL':
                return {
                  shadow: 'shadow-red-500/5',
                  iconBg: 'bg-red-500/20',
                  iconRing: 'ring-red-500/30',
                  iconColor: 'text-red-400',
                  buttonBorder: 'border-red-500/30',
                  buttonText: 'text-red-400',
                  buttonHover: 'hover:bg-red-500/10 hover:border-red-500'
                };
              case 'WNBA':
                return {
                  shadow: 'shadow-pink-500/5',
                  iconBg: 'bg-pink-500/20',
                  iconRing: 'ring-pink-500/30',
                  iconColor: 'text-pink-400',
                  buttonBorder: 'border-pink-500/30',
                  buttonText: 'text-pink-400',
                  buttonHover: 'hover:bg-pink-500/10 hover:border-pink-500'
                };
              default:
                return {
                  shadow: 'shadow-emerald-500/5',
                  iconBg: 'bg-emerald-500/20',
                  iconRing: 'ring-emerald-500/30',
                  iconColor: 'text-emerald-400',
                  buttonBorder: 'border-emerald-500/30',
                  buttonText: 'text-emerald-400',
                  buttonHover: 'hover:bg-emerald-500/10 hover:border-emerald-500'
                };
            }
          };
          
          const colors = getSportEmptyStateClasses(filter === 'all' ? 'MLB' : filter);
          
          return (
            <div className="glass-card rounded-2xl p-8 animate-stagger-in">
              <div className="text-center">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Bell className={`h-8 w-8 ${colors.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 font-display">
                  No Alerts Available
                </h3>
                <p className="text-slate-400 text-sm mb-6 font-display">
                  {`No alerts for ${filter === 'all' ? 'any sport' : filter} at the moment`}
                </p>
                <Button
                  onClick={() => refetchAlerts()}
                  variant="outline"
                  size="lg"
                  className={`${colors.buttonBorder} ${colors.buttonText} ${colors.buttonHover} transition-all duration-300 px-8 py-3 font-bold uppercase tracking-wide btn-haptic`}
                  data-testid="button-refresh-alerts"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh Alerts
                </Button>
              </div>
            </div>
          );
        })() : (
          filteredAlerts.map((alert: Alert, index: number) => (
            <div
              key={alert.id}
              className="animate-stagger-in"
              style={{ animationDelay: `${index * 60}ms` }}
              data-testid={`alert-container-${alert.id}`}
            >
              <ErrorBoundary>
                <UniversalAlertCard
                  alert={{
                    id: alert.id,
                    type: alert.type || 'UNKNOWN',
                    message: alert.message || 'Alert content unavailable',
                    gameId: alert.gameId || '',
                    sport: alert.sport || 'OTHER',
                    homeTeam: typeof alert.homeTeam === 'string' ? alert.homeTeam : (alert.homeTeam?.name || 'Unknown'),
                    awayTeam: typeof alert.awayTeam === 'string' ? alert.awayTeam : (alert.awayTeam?.name || 'Unknown'),
                    confidence: alert.confidence || 0,
                    priority: alert.priority || 0,
                    createdAt: alert.createdAt || alert.timestamp || new Date().toISOString(),
                    homeScore: alert.homeScore,
                    awayScore: alert.awayScore,
                    context: alert.context,
                    sentToTelegram: alert.sentToTelegram,
                    weather: alert.context?.weather || alert.weatherData,
                    gameInfo: alert.gameInfo,
                    gamblingInsights: alert.gamblingInsights
                  }}
                />
              </ErrorBoundary>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}