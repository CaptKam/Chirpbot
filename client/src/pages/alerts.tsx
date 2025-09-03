import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AlertFooter from '@/components/AlertFooter';
import { SwipeableCard } from '@/components/SwipeableCard';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, TrendingUp, Users, Bell, Activity } from 'lucide-react';

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
    ? (alerts as Alert[])
    : (alerts as Alert[]).filter((alert: Alert) => alert.sport === filter);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'RISP_CHANCE':
      case 'SCORING_PROBABILITY':
        return <span className="text-2xl">🔥</span>;
      case 'BASES_LOADED':
        return <span className="text-2xl">🚨</span>;
      case 'WIND_JETSTREAM':
        return <span className="text-2xl">💨</span>;
      case 'HR_HITTER_AT_BAT':
        return <span className="text-2xl">⚾</span>;
      case 'LATE_PRESSURE':
      case 'NINTH_TIE':
        return <span className="text-2xl">⚡</span>;
      case 'CLOSE_GAME_LATE':
        return <span className="text-2xl">📈</span>;
      case 'HOME_RUN':
        return <span className="text-2xl">💥</span>;
      default:
        return <span className="text-2xl">🚀</span>;
    }
  };

  const getAlertColor = (priority: number) => {
    if (priority >= 90) return 'from-red-500 to-red-600 shadow-red-500/25';
    if (priority >= 80) return 'from-orange-500 to-orange-600 shadow-orange-500/25';
    if (priority >= 70) return 'from-yellow-500 to-yellow-600 shadow-yellow-500/25';
    return 'from-blue-500 to-blue-600 shadow-blue-500/25';
  };

  const getAlertTextColor = (priority: number) => {
    if (priority >= 90) return 'text-red-400';
    if (priority >= 80) return 'text-orange-400';
    if (priority >= 70) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 90) return 'URGENT';
    if (priority >= 80) return 'HIGH';
    if (priority >= 70) return 'MEDIUM';
    return 'NORMAL';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (alertsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide text-slate-100">Live Alerts</h1>
            <p className="text-emerald-300/80 text-xs font-medium">Real-time sports notifications</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">

      {/* Filter Tabs */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {(['all', 'MLB', 'NFL', 'NBA', 'NHL', 'NCAAF'] as const).map((sport) => (
            <button
              key={sport}
              onClick={() => setFilter(sport)}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                filter === sport
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {sport === 'all' ? 'All' : sport}
            </button>
          ))}
        </div>
      </div>

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
              <SwipeableCard 
                alertId={alert.id}
                alertData={alert}
                className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-lg"
              >
                <div className="relative overflow-hidden">
                  {/* Priority Color Bar */}
                  <div className={`h-1 w-full bg-gradient-to-r ${getAlertColor(alert.priority)} shadow-lg`}></div>
                  
                  <div className="p-4">
                    {/* Header with icon, sport, priority, and time */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getAlertIcon(alert.type)}
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm tracking-wide">{alert.sport}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-bold border-2 ${getAlertTextColor(alert.priority)} border-current px-2 py-1`}
                          >
                            {getPriorityLabel(alert.priority)}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs font-medium">{formatTime(alert.createdAt)}</span>
                    </div>
                    
                    {/* Main alert message - BIG and clear */}
                    <h3 className="text-xl font-bold mb-4 text-white leading-tight tracking-wide">
                      {alert.message}
                    </h3>
                    
                    {/* Game teams display */}
                    <div className="mb-3 text-center">
                      <p className="text-slate-300 font-medium text-lg">
                        {alert.awayTeam} vs {alert.homeTeam}
                      </p>
                    </div>
                    
                    {/* Game situation with better styling */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50">
                      <AlertFooter
                        sport={alert.sport}
                        // MLB specific
                        inning={alert.context?.inning || alert.inning}
                        isTopInning={alert.context?.isTopInning || alert.isTopInning}
                        balls={alert.context?.balls || alert.balls || 0}
                        strikes={alert.context?.strikes || alert.strikes || 0}
                        outs={alert.context?.outs || alert.outs || 0}
                        hasFirst={!!(alert.context?.hasFirst || alert.hasFirst)}
                        hasSecond={!!(alert.context?.hasSecond || alert.hasSecond)}
                        hasThird={!!(alert.context?.hasThird || alert.hasThird)}
                        // Weather data
                        weather={alert.context?.weather || alert.weather}
                        // Other sports specific
                        quarter={alert.context?.quarter}
                        timeRemaining={alert.context?.timeRemaining}
                        down={alert.context?.down}
                        yardsToGo={alert.context?.yardsToGo}
                        period={alert.context?.period}
                        createdAt={alert.createdAt}
                      />
                    </div>
                  </div>
                </div>
              </SwipeableCard>
            </motion.div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}