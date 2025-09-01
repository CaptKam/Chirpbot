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
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL'>('all');

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

      <div className="max-w-4xl mx-auto p-4 space-y-6">

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="grid w-full grid-cols-5 bg-white/5 backdrop-blur-sm border-white/10">
          <TabsTrigger value="all" className="data-[state=active]:bg-emerald-500">All</TabsTrigger>
          <TabsTrigger value="MLB" className="data-[state=active]:bg-emerald-500">MLB</TabsTrigger>
          <TabsTrigger value="NFL" className="data-[state=active]:bg-emerald-500">NFL</TabsTrigger>
          <TabsTrigger value="NBA" className="data-[state=active]:bg-emerald-500">NBA</TabsTrigger>
          <TabsTrigger value="NHL" className="data-[state=active]:bg-emerald-500">NHL</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="space-y-4">
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
                    className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="p-4">
                      {/* Header with type and time */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-emerald-400 text-sm font-semibold">{alert.sport}</span>
                        <span className="text-slate-400 text-xs">{formatTime(alert.createdAt)}</span>
                      </div>
                      
                      {/* Alert Type Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-400">
                          {alert.type.replace('_', ' ')}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-xs text-emerald-400">{alert.confidence}%</span>
                        </div>
                      </div>
                      
                      {/* Main alert message */}
                      <h4 className="font-bold mb-1 text-slate-100">{alert.message}</h4>
                      
                      {/* Team matchup */}
                      <p className="text-sm text-slate-300 mb-3">{alert.homeTeam} vs {alert.awayTeam}</p>
                      
                      {/* Game situation with colored background */}
                      <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
                        <AlertFooter
                          inning={alert.inning}
                          isTopInning={alert.isTopInning}
                          balls={alert.balls || 0}
                          strikes={alert.strikes || 0}
                          outs={alert.outs || 0}
                          hasFirst={!!alert.hasFirst}
                          hasSecond={!!alert.hasSecond}
                          hasThird={!!alert.hasThird}
                          createdAt={alert.createdAt}
                        />
                      </div>
                    </div>
                  </SwipeableCard>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}