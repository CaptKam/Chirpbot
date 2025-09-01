import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
    ? alerts 
    : alerts.filter((alert: Alert) => alert.sport === filter);

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
          <div className="w-12 h-12 border-4 border-[#2387F4] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-wide uppercase">
          LIVE ALERTS
        </h1>
        <p className="text-slate-300">Real-time sports notifications and updates</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-[#1C2B5E]/20 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-[#2387F4]" />
              <div>
                <p className="text-xs text-slate-400">Total Alerts</p>
                <p className="text-xl font-bold text-white">{stats?.totalAlerts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1C2B5E]/20 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-[#2387F4]" />
              <div>
                <p className="text-xs text-slate-400">Today</p>
                <p className="text-xl font-bold text-white">{stats?.todayAlerts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1C2B5E]/20 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-[#2387F4]" />
              <div>
                <p className="text-xs text-slate-400">Live Games</p>
                <p className="text-xl font-bold text-white">{stats?.liveGames || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1C2B5E]/20 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-[#2387F4]" />
              <div>
                <p className="text-xs text-slate-400">Monitored</p>
                <p className="text-xl font-bold text-white">{stats?.monitoredGames || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="grid w-full grid-cols-5 bg-[#1C2B5E]/30">
          <TabsTrigger value="all" className="data-[state=active]:bg-[#2387F4]">All</TabsTrigger>
          <TabsTrigger value="MLB" className="data-[state=active]:bg-[#2387F4]">MLB</TabsTrigger>
          <TabsTrigger value="NFL" className="data-[state=active]:bg-[#2387F4]">NFL</TabsTrigger>
          <TabsTrigger value="NBA" className="data-[state=active]:bg-[#2387F4]">NBA</TabsTrigger>
          <TabsTrigger value="NHL" className="data-[state=active]:bg-[#2387F4]">NHL</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
              <Card className="bg-[#1C2B5E]/20 border-slate-700">
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-300">No alerts for {filter === 'all' ? 'any sport' : filter}</p>
                  <Button 
                    onClick={() => refetchAlerts()} 
                    variant="outline" 
                    className="mt-4 border-[#2387F4] text-[#2387F4] hover:bg-[#2387F4]/10"
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
                  <Card className="bg-[#1C2B5E]/20 border-slate-700 hover:border-[#2387F4]/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full ${getAlertColor(alert.priority)}`}>
                            {getAlertIcon(alert.type)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline" className="text-xs border-[#2387F4] text-[#2387F4]">
                                {alert.sport}
                              </Badge>
                              <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                                {alert.type.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            <p className="text-white font-medium mb-1">{alert.message}</p>
                            
                            <div className="text-sm text-slate-400">
                              {alert.homeTeam} vs {alert.awayTeam}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{formatTime(alert.createdAt)}</p>
                          <div className="flex items-center space-x-1 mt-1">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-slate-400">{alert.confidence}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}