import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AlertFooter from '@/components/AlertFooter';
import { SwipeableCard } from '@/components/SwipeableCard';
import { SimpleAlertCard } from '@/components/SimpleAlertCard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, TrendingUp, Users, Bell, Activity } from 'lucide-react';
import { AlertLoading } from '@/components/sports-loading';
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';

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
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF'>('all');

  // Fetch alerts using React Query
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch alert stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000, // Refetch every minute
  });

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
      // Game Start Events (All Sports) - Now using SimpleAlertCard
      'MLB_GAME_START',
      'NFL_GAME_START', 
      'NCAAF_GAME_START',
      'CFL_GAME_START',
      'WNBA_GAME_START',
      // Two Minute Warning Events
      'NFL_TWO_MINUTE_WARNING',
      'NCAAF_TWO_MINUTE_WARNING', 
      'CFL_TWO_MINUTE_WARNING',
      'WNBA_TWO_MINUTE_WARNING'
    ];
    return simpleAlertTypes.includes(alertType);
  };

  if (alertsLoading || statsLoading) {
    return <AlertLoading />;
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
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      <PageHeader 
        title="Live Alerts" 
        subtitle="Real-time sports notifications"
        icon={Bell}
      />
      <div className="max-w-4xl mx-auto space-y-6">

      {/* Filter Tabs */}
      <SportTabs 
        sports={['all', 'MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL']} 
        selectedSport={filter} 
        onSportChange={setFilter} 
      />

      {/* Alerts Content */}
      <div className="p-4 space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-300">No alerts for {filter === 'all' ? 'any sport' : filter}</p>
              <Button 
                onClick={() => refetchAlerts()} 
                variant="outline" 
                className="mt-4 border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
              >
                Refresh Alerts
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert: Alert, index: number) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
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
                  className="hover:border-emerald-500/30 transition-all duration-200"
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
                  className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/30 transition-all duration-200"
                />
              )}
            </motion.div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}