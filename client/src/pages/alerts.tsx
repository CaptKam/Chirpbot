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
        <div className="bg-white/5 backdrop-blur-sm ring-1 ring-red-500/30 border-0 rounded-xl p-6 shadow-xl shadow-red-500/5">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-400 mb-1">Alert Display Error</h3>
              <p className="text-xs text-slate-300">This alert couldn't be displayed properly</p>
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

// AlertSkeleton component defined ABOVE its usage to prevent temporal dead zone error
const AlertSkeleton = ({ sport }: { sport: string }) => {
  // Static class mappings to ensure Tailwind includes all classes
  const getSportSkeletonClasses = (sport: string) => {
    switch (sport) {
      case 'MLB':
        return {
          shadow: 'shadow-green-500/5',
          bg1: 'bg-green-500/20',
          bg2: 'bg-green-500/15'
        };
      case 'NFL':
        return {
          shadow: 'shadow-orange-500/5',
          bg1: 'bg-orange-500/20',
          bg2: 'bg-orange-500/15'
        };
      case 'NBA':
        return {
          shadow: 'shadow-purple-500/5',
          bg1: 'bg-purple-500/20',
          bg2: 'bg-purple-500/15'
        };
      case 'NHL':
        return {
          shadow: 'shadow-cyan-500/5',
          bg1: 'bg-cyan-500/20',
          bg2: 'bg-cyan-500/15'
        };
      case 'NCAAF':
        return {
          shadow: 'shadow-blue-500/5',
          bg1: 'bg-blue-500/20',
          bg2: 'bg-blue-500/15'
        };
      case 'CFL':
        return {
          shadow: 'shadow-red-500/5',
          bg1: 'bg-red-500/20',
          bg2: 'bg-red-500/15'
        };
      case 'WNBA':
        return {
          shadow: 'shadow-pink-500/5',
          bg1: 'bg-pink-500/20',
          bg2: 'bg-pink-500/15'
        };
      default:
        return {
          shadow: 'shadow-emerald-500/5',
          bg1: 'bg-emerald-500/20',
          bg2: 'bg-emerald-500/15'
        };
    }
  };
  
  const colors = getSportSkeletonClasses(sport === 'all' ? 'MLB' : sport);
  
  return (
    <div className={`bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl ${colors.shadow} animate-pulse`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`h-6 ${colors.bg1} rounded-lg w-32 animate-pulse`}></div>
        <div className={`h-4 ${colors.bg2} rounded w-16 animate-pulse`}></div>
      </div>
      <div className={`h-4 ${colors.bg2} rounded w-full mb-4 animate-pulse`}></div>
      <div className="flex items-center justify-between">
        <div className={`h-6 ${colors.bg1} rounded-lg w-48 animate-pulse`}></div>
        <div className={`h-6 ${colors.bg2} rounded w-12 animate-pulse`}></div>
      </div>
    </div>
  );
};

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF' | 'WNBA' | 'CFL'>('all');

  // Fetch alerts using React Query with HTTP polling every 5 seconds
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts, error: alertsError } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await fetch('/api/alerts?limit=120');
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Keep polling when tab is inactive
    retry: 3,
    retryDelay: 1000,
    staleTime: 3000, // Consider data stale after 3 seconds
  });


  // Fetch alert stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const response = await fetch('/api/alerts/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch alert stats');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Group alerts by sport for better organization
  const alertsBySport = useMemo(() => {
    const grouped: Record<string, Alert[]> = {};
    (alerts as Alert[]).forEach((alert: Alert) => {
      const sport = alert.sport || 'OTHER';
      if (!grouped[sport]) grouped[sport] = [];
      grouped[sport].push(alert);
    });
    return grouped;
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const alertsArray = Array.isArray(alerts) ? alerts : [];
    return filter === 'all' 
      ? alertsArray
      : alertsArray.filter((alert: Alert) => alert.sport === filter);
  }, [alerts, filter]);


  if (alertsLoading || statsLoading) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen" data-testid="alerts-loading">
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
              <AlertSkeleton key={`skeleton-${index}`} sport={filter} />
            ))}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen" data-testid="alerts-page">
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
        {/* Alerts Content */}
        <div className="pb-8 space-y-4" data-testid="alerts-list">
        {alertsError ? (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-red-500/30 border-0 rounded-xl p-8 shadow-xl shadow-red-500/5">
            <div className="text-center">
              <div className="h-16 w-16 rounded-lg bg-red-500/20 ring-1 ring-red-500/30 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-slate-100 mb-2">
                Connection Error
              </h3>
              <p className="text-slate-300 text-base mb-4">
                Unable to load alerts. Error: {alertsError instanceof Error ? alertsError.message : 'Unknown error'}
              </p>
              <p className="text-slate-400 text-sm mb-6">
                Please check your connection or try refreshing the page.
              </p>
              <Button 
                onClick={() => refetchAlerts()} 
                variant="outline" 
                size="lg"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500 transition-all duration-300 px-8 py-3 font-bold uppercase tracking-wide"
              >
                <Activity className="w-4 h-4 mr-2" />
                Retry Connection
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
            <div className={`bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-8 shadow-xl ${colors.shadow}`}>
              <div className="text-center">
                <div className={`h-16 w-16 rounded-lg ${colors.iconBg} ring-1 ${colors.iconRing} flex items-center justify-center mx-auto mb-6`}>
                  <Bell className={`h-8 w-8 ${colors.iconColor}`} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100 mb-2">
                  No Alerts Available
                </h3>
                <p className="text-slate-300 text-base mb-6">
                  {`No alerts for ${filter === 'all' ? 'any sport' : filter} at the moment`}
                </p>
                <Button 
                  onClick={() => refetchAlerts()} 
                  variant="outline" 
                  size="lg"
                  className={`${colors.buttonBorder} ${colors.buttonText} ${colors.buttonHover} transition-all duration-300 px-8 py-3 font-bold uppercase tracking-wide`}
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
              className={`mb-4 ${index === filteredAlerts.length - 1 ? 'mb-8' : ''}`}
              data-testid={`alert-container-${alert.id}`}
            >
              <ErrorBoundary>
                <UniversalAlertCard 
                  alert={{
                    // Use backend-processed data directly with safe defaults
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