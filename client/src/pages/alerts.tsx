import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AlertFooter from '@/components/AlertFooter';
import { AdvancedAlertCard } from '@/components/AdvancedAlertCard';
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
import { getSeasonAwareSports } from '@shared/season-manager';

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

// AlertSkeleton component defined ABOVE its usage to prevent temporal dead zone error
const AlertSkeleton = () => (
  <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 bg-emerald-500/20 rounded-lg w-32 animate-pulse"></div>
      <div className="h-4 bg-emerald-500/15 rounded w-16 animate-pulse"></div>
    </div>
    <div className="h-4 bg-emerald-500/15 rounded w-full mb-4 animate-pulse"></div>
    <div className="flex items-center justify-between">
      <div className="h-6 bg-emerald-500/20 rounded-lg w-48 animate-pulse"></div>
      <div className="h-6 bg-emerald-500/15 rounded w-12 animate-pulse"></div>
    </div>
  </div>
);

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF' | 'WNBA' | 'CFL'>('all');

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
    if (priority >= 90) return 'bg-emerald-400 ring-2 ring-emerald-300';
    if (priority >= 80) return 'bg-emerald-500/80 ring-1 ring-emerald-400';
    if (priority >= 70) return 'bg-emerald-500/60 ring-1 ring-emerald-500/50';
    return 'bg-emerald-500/40 ring-1 ring-emerald-500/30';
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
          onSportChange={setFilter}
          data-testid="sport-filter-tabs" 
        />

        <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6" data-testid="alerts-container">
          <div className="pb-8 space-y-4" data-testid="alerts-skeleton-list">
            {Array.from({ length: 5 }, (_, index) => (
              <AlertSkeleton key={`skeleton-${index}`} />
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
        onSportChange={setFilter}
        data-testid="sport-filter-tabs" 
      />

      <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 md:px-6" data-testid="alerts-container">
        {/* Alerts Content */}
        <div className="pb-8 space-y-4" data-testid="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-8 shadow-xl shadow-emerald-500/5">
            <div className="text-center">
              <div className="h-16 w-16 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <Bell className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-slate-100 mb-2">
                No Alerts Available
              </h3>
              <p className="text-slate-300 text-base mb-6">
                No alerts for {filter === 'all' ? 'any sport' : filter} at the moment
              </p>
              <Button 
                onClick={() => refetchAlerts()} 
                variant="outline" 
                size="lg"
                className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500 transition-all duration-300 px-8 py-3 font-bold uppercase tracking-wide"
                data-testid="button-refresh-alerts"
              >
                <Activity className="w-4 h-4 mr-2" />
                Refresh Alerts
              </Button>
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert: Alert, index: number) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={index === filteredAlerts.length - 1 ? 'mb-8' : ''}
              data-testid={`alert-card-${alert.id}`}
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
                  className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl shadow-xl shadow-emerald-500/5"
                  data-testid={`simple-alert-${alert.id}`}
                />
              ) : (
                // Use Advanced Alert Card for professional V3 display
                <AdvancedAlertCard 
                  alertId={alert.id}
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
                      // AI Enhancement fields
                      aiEnhanced: alert.context?.aiEnhanced,
                      aiMessage: alert.context?.aiMessage,
                      aiTitle: alert.context?.aiTitle,
                      aiInsights: alert.context?.aiInsights,
                      recommendation: alert.context?.aiRecommendation || alert.context?.recommendation,
                      aiRecommendation: alert.context?.aiRecommendation,
                      aiCallToAction: alert.context?.aiCallToAction,
                      aiBettingAdvice: alert.context?.aiBettingAdvice,
                      aiGameProjection: alert.context?.aiGameProjection,
                      aiUrgency: alert.context?.aiUrgency,
                      aiConfidenceScore: alert.context?.aiConfidenceScore,
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
                  className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl shadow-xl shadow-emerald-500/5"
                  data-testid={`advanced-alert-${alert.id}`}
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