import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AlertCard from '@/components/AlertCard';
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
  state?: string; // NEW: For detecting LIVE/UPDATED/EXPIRED status
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
  // NEW: OpenAI enhancement data
  payload?: {
    openaiEnhanced?: boolean;
    status?: 'LIVE' | 'UPDATED' | 'EXPIRED';
    openaiMonitored?: boolean;
  };
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
              <AlertCard
                sport={alert.sport}
                type={alert.type}
                priority={alert.priority}
                timeIso={alert.createdAt}
                message={alert.message}
                matchup={{
                  away: alert.awayTeam,
                  home: alert.homeTeam
                }}
                context={{
                  inning: (alert.context?.inning || alert.inning) ? {
                    number: alert.context?.inning || alert.inning,
                    half: (alert.context?.isTopInning || alert.isTopInning) ? "Top" : "Bottom"
                  } : undefined,
                  outs: alert.context?.outs || alert.outs || 0,
                  count: {
                    b: alert.context?.balls || alert.balls || 0,
                    s: alert.context?.strikes || alert.strikes || 0
                  },
                  runners: {
                    first: !!(alert.context?.hasFirst || alert.hasFirst),
                    second: !!(alert.context?.hasSecond || alert.hasSecond),
                    third: !!(alert.context?.hasThird || alert.hasThird)
                  }
                }}
                alertId={alert.id}
                alertData={alert}
                className="bg-white/5 backdrop-blur-sm"
                // NEW: Live status props
                liveStatus={alert.payload?.status || (alert.state === 'LIVE' ? 'LIVE' : alert.state === 'UPDATED' ? 'UPDATED' : alert.state === 'EXPIRED' ? 'EXPIRED' : undefined)}
                openaiEnhanced={alert.payload?.openaiEnhanced}
              />
            </motion.div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}