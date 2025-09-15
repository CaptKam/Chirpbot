import React, { useState, useEffect, useMemo } from 'react';
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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Fetch alerts using React Query
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts, error: alertsError } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  // Monitor WebSocket connection
  useEffect(() => {
    const checkWebSocketConnection = () => {
      if (typeof window !== 'undefined' && window.WebSocket) {
        // WebSocket connection monitoring would go here
        // For now, we'll assume connected if no errors
        if (!alertsError) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('disconnected');
        }
      }
    };

    checkWebSocketConnection();
    const interval = setInterval(checkWebSocketConnection, 5000);
    return () => clearInterval(interval);
  }, [alertsError]);

  // Fetch alert stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
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

  const filteredAlerts = filter === 'all' 
    ? (alerts as Alert[] || [])
    : (alerts as Alert[] || []).filter((alert: Alert) => alert.sport === filter);


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
        subtitle={
          <div className="flex items-center gap-2">
            <span>Real-Time Alert Dashboard</span>
            <div className={`h-2 w-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} title={`Connection: ${connectionStatus}`}></div>
          </div>
        }
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
              <p className="text-slate-300 text-base mb-6">
                Unable to load alerts. Please check your connection.
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
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-8 shadow-xl shadow-emerald-500/5">
            <div className="text-center">
              <div className="h-16 w-16 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <Bell className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-slate-100 mb-2">
                No Alerts Available
              </h3>
              <p className="text-slate-300 text-base mb-6">
                {connectionStatus === 'disconnected' ? 
                  'Connection lost. Attempting to reconnect...' :
                  `No alerts for ${filter === 'all' ? 'any sport' : filter} at the moment`
                }
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
            <div
              key={alert.id}
              className={`mb-4 ${index === filteredAlerts.length - 1 ? 'mb-8' : ''}`}
              data-testid={`alert-container-${alert.id}`}
            >
              <UniversalAlertCard 
                alert={{
                  id: alert.id,
                  type: alert.type,
                  message: alert.message,
                  gameId: alert.gameId,
                  sport: alert.sport,
                  homeTeam: alert.homeTeam,
                  awayTeam: alert.awayTeam,
                  confidence: alert.confidence,
                  priority: alert.priority,
                  createdAt: alert.createdAt,
                  homeScore: alert.context?.homeScore || alert.homeScore || alert.context?.scores?.home,
                  awayScore: alert.context?.awayScore || alert.awayScore || alert.context?.scores?.away,
                  context: alert.context,
                  sentToTelegram: alert.sentToTelegram,
                  weather: alert.context?.weather || alert.weather || alert.weatherData,
                  gameInfo: alert.context?.gameInfo || alert.gameInfo
                }}
              />
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}