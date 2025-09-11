import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AlertFooter from '@/components/AlertFooter';
import { SwipeableCard } from '@/components/SwipeableCard';
import { SimpleAlertCard } from '@/components/SimpleAlertCard';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, TrendingUp, Users, Bell, Activity, RefreshCw } from 'lucide-react';
import { AlertLoading } from '@/components/sports-loading';
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, AlertLoadingGrid, ErrorState, LoadingMore } from '@/components/alert-states';
import { useToast } from '@/hooks/use-toast';

interface Alert {
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
  // Footer data
  inning?: number;
  isTopInning?: boolean;
  outs?: number;
  balls?: number;
  strikes?: number;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
  context?: any;
  // Additional fields that might come from API
  title?: string;
  description?: string;
  homeScore?: number;
  awayScore?: number;
  timestamp?: string;
  sentToTelegram?: boolean;
  weather?: any;
  weatherData?: any;
  betbookData?: any;
  gameInfo?: any;
}

interface AlertStats {
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  monitoredGames: number;
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF' | 'WNBA' | 'CFL'>('all');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const { toast } = useToast();

  // Fetch alerts using React Query
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts, isError: alertsError, error: alertError } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update last refresh time when data is fetched
  useEffect(() => {
    if (alerts && !alertsLoading) {
      setLastRefreshTime(new Date());
    }
  }, [alerts, alertsLoading]);

  // Refresh mutation with feedback
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const result = await refetchAlerts();
      return result;
    },
    onSuccess: () => {
      setLastRefreshTime(new Date());
      toast({
        title: "Alerts refreshed",
        description: "Successfully refreshed all alerts",
      });
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh alerts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  // Fetch alert stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000, // Refetch every minute
  });

  // Group alerts by sport for better organization
  const alertsBySport = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    alerts.forEach((alert: any) => {
      const sport = alert.sport || 'OTHER';
      if (!grouped[sport]) grouped[sport] = [];
      grouped[sport].push(alert);
    });
    return grouped;
  }, [alerts]);

  // Calculate alert counts for each sport including 'all'
  const alertCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'all': alerts.length
    };
    
    // Initialize counts for all sports
    ['MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL'].forEach(sport => {
      counts[sport] = alertsBySport[sport]?.length || 0;
    });
    
    return counts;
  }, [alerts, alertsBySport]);

  const filteredAlerts = filter === 'all' 
    ? (alerts as Alert[] || [])
    : (alerts as Alert[] || []).filter((alert: Alert) => alert.sport === filter);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'CLOSE_GAME':
        return <AlertTriangle className="h-4 w-4" />;
      case 'BASES_LOADED':
        return <Users className="h-4 w-4" />;
      case 'HOME_RUN':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertColor = (priority: number) => {
    if (priority >= 90) return 'bg-red-500';
    if (priority >= 80) return 'bg-orange-500';
    if (priority >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Determine which alert types should use the simple card
  const shouldUseSimpleCard = (alertType: string) => {
    const simpleAlertTypes = [
      // Game Start Events (Sport-specific)
      'NFL_GAME_START',
      'MLB_GAME_START',
      'WNBA_GAME_START',
      // Game Events (Legacy)
      'TWO_MINUTE_WARNING',
      'NCAAF_KICKOFF', 
      'NCAAF_HALFTIME',
      'GAME_START',
      'GAME_END',
      // Final Game Results
      'HIGH_SCORING',
      'SHUTOUT',
      'BLOWOUT',
      'CLOSE_GAME',
      // Time-based
      'OVERTIME',
      'FINAL_DRIVE',
      // Simple milestones
      'TOUCHDOWN',
      'FIELD_GOAL',
      'SAFETY'
    ];
    return simpleAlertTypes.includes(alertType);
  };

  // Show loading state with skeleton cards
  if (alertsLoading || statsLoading) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
        <PageHeader 
          title="Live Alerts" 
          subtitle="Loading real-time sports notifications..."
          icon={Bell}
        />
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">
          <SportTabs 
            sports={['all', 'MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL']} 
            activeSport={filter} 
            onSportChange={setFilter}
            alertCounts={{}}
          />
          <AlertLoadingGrid count={6} />
        </div>
      </div>
    );
  }

  // Show error state if loading failed
  if (alertsError) {
    return (
      <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
        <PageHeader 
          title="Live Alerts" 
          subtitle="Real-time sports notifications"
          icon={Bell}
        />
        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">
          <ErrorState 
            message={alertError?.message || "Failed to load alerts"}
            onRetry={handleRefresh}
          />
        </div>
      </div>
    );
  }

  const AlertSkeleton = () => (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-slate-700 rounded w-32"></div>
        <div className="h-4 bg-slate-700 rounded w-16"></div>
      </div>
      <div className="h-4 bg-slate-700 rounded w-full mb-4"></div>
      <div className="flex items-center justify-between">
        <div className="h-6 bg-slate-700 rounded w-48"></div>
        <div className="h-6 bg-slate-700 rounded w-12"></div>
      </div>
    </div>
  );

  return (
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      <PageHeader 
        title="Live Alerts" 
        subtitle="Real-time sports notifications"
        icon={Bell}
      />
      <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6">

      {/* Filter Tabs */}
      <SportTabs 
        sports={['all', 'MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL']} 
        activeSport={filter} 
        onSportChange={setFilter}
        alertCounts={alertCounts}
      />

      {/* Alerts Content - Responsive Grid */}
      <div className="pb-8">
        {filteredAlerts.length === 0 ? (
          <EmptyState 
            sport={filter}
            onRefresh={handleRefresh}
            isRefreshing={refreshMutation.isLoading}
            lastRefreshTime={lastRefreshTime}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAlerts.map((alert: Alert, index: number) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col h-full"
            >
              {shouldUseSimpleCard(alert.type) ? (
                // Use Simple Card for basic alerts
                <SimpleAlertCard 
                  alert={{
                    id: alert.id,
                    type: alert.type,
                    message: alert.message,
                    sport: alert.sport,
                    homeTeam: alert.homeTeam,
                    awayTeam: alert.awayTeam,
                    priority: alert.priority,
                    confidence: alert.confidence,
                    createdAt: alert.createdAt,
                    context: alert.context
                  }}
                  className="border-emerald-500/30 h-full"
                />
              ) : (
                // Use Complex Card for detailed game state alerts
                <SwipeableCard 
                  alertId={alert.id}
                  children={null}
                  alertData={{
                    id: alert.id,
                    type: alert.type,
                    sport: alert.sport,
                    title: alert.title || '',
                    description: alert.description || '',
                    homeTeam: alert.homeTeam,
                    awayTeam: alert.awayTeam,
                    homeScore: alert.context?.homeScore || alert.homeScore || alert.context?.scores?.home || 0,
                    awayScore: alert.context?.awayScore || alert.awayScore || alert.context?.scores?.away || 0,
                    probability: alert.confidence,
                    priority: alert.priority,
                    confidence: alert.confidence,
                    message: alert.message,
                    createdAt: alert.createdAt,
                    timestamp: alert.timestamp || alert.createdAt || new Date().toISOString(),
                    sentToTelegram: alert.sentToTelegram || false,
                    context: {
                      ...alert.context,
                      // MLB specific
                      inning: alert.context?.inning || alert.inning,
                      isTopInning: alert.context?.isTopInning || alert.isTopInning,
                      balls: alert.context?.balls || alert.balls,
                      strikes: alert.context?.strikes || alert.strikes,
                      outs: alert.context?.outs || alert.outs,
                      hasFirst: alert.context?.hasFirst || alert.hasFirst,
                      hasSecond: alert.context?.hasSecond || alert.hasSecond,
                      hasThird: alert.context?.hasThird || alert.hasThird,
                      // Football specific (NFL, NCAAF, CFL)
                      quarter: alert.context?.quarter,
                      down: alert.context?.down,
                      yardsToGo: alert.context?.yardsToGo,
                      timeRemaining: alert.context?.timeRemaining,
                      fieldPosition: alert.context?.fieldPosition,
                      // Basketball specific (NBA)
                      courtPosition: alert.context?.courtPosition,
                      // Hockey specific (NHL)
                      period: alert.context?.period,
                      rinkPosition: alert.context?.rinkPosition,
                      // Weather (all sports)
                      weather: alert.context?.weather || alert.weather || alert.weatherData
                    },
                    betbookData: alert.context?.betbookData,
                    gameInfo: alert.context?.gameInfo
                  }}
                  className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/30 transition-all duration-200 h-full"
                />
              )}
            </motion.div>
          ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}