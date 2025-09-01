
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Clock, TrendingUp, Users } from 'lucide-react';

interface Alert {
  id: string;
  alertKey: string;
  sport: string;
  gameId: string;
  type: string;
  state: string;
  score: number;
  payload: any;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    last24h: 0,
    active: 0
  });
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NCAAF'>('all');
  const { socket, isConnected } = useWebSocket();

  // Fetch alerts on component mount
  useEffect(() => {
    fetchAlerts();
    fetchAlertStats();
  }, []);

  // Listen for real-time alerts via WebSocket
  useEffect(() => {
    if (socket) {
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'alert') {
            setAlerts(prev => [data.alert, ...prev]);
            setStats(prev => ({
              ...prev,
              total: prev.total + 1,
              active: prev.active + 1
            }));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    }
  }, [socket]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchAlertStats = async () => {
    try {
      const response = await fetch('/api/alerts/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching alert stats:', error);
    }
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.sport === filter);

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'RED_ZONE':
      case 'TOUCHDOWN':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'HOME_RUN':
      case 'GRAND_SLAM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'HIGH_SCORING_OPP':
      case 'CLOSE_GAME':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'RISP':
      case 'BASES_LOADED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const formatAlertType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const alertTime = new Date(dateString);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">
                Live <span className="text-emerald-400">Alerts</span>
              </h1>
              <p className="text-slate-400 mt-2">Real-time sports alerts dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-red-400'
                }`}></div>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <Button 
                onClick={fetchAlerts} 
                variant="outline" 
                className="border-slate-700 hover:bg-slate-800"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Last 24h</CardTitle>
              <Clock className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.last24h}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Active Alerts</CardTitle>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.active}</div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Filters */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} className="mb-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="all">All Sports</TabsTrigger>
            <TabsTrigger value="MLB">MLB</TabsTrigger>
            <TabsTrigger value="NFL">NFL</TabsTrigger>
            <TabsTrigger value="NCAAF">NCAAF</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-slate-500 mb-4" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">No alerts found</h3>
                <p className="text-slate-500 text-center">
                  {filter === 'all' 
                    ? 'No alerts have been generated yet. Start monitoring games to see alerts here.'
                    : `No ${filter} alerts found. Try switching to a different sport filter.`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge className={getAlertTypeColor(alert.type)}>
                          {formatAlertType(alert.type)}
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {alert.sport}
                        </Badge>
                        <span className="text-sm text-slate-500">
                          Game: {alert.gameId}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">
                          {getTimeAgo(alert.createdAt)}
                        </div>
                        <div className="text-lg font-bold text-emerald-400">
                          Score: {alert.score}
                        </div>
                      </div>
                    </div>

                    {/* Alert Details */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {alert.payload.context && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Context</h4>
                            <div className="text-sm text-slate-400 space-y-1">
                              {Object.entries(alert.payload.context).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                  <span className="text-white">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-semibold text-slate-300 mb-2">Alert Info</h4>
                          <div className="text-sm text-slate-400 space-y-1">
                            <div className="flex justify-between">
                              <span>Phase:</span>
                              <span className="text-white">{alert.payload.phase || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Situation:</span>
                              <span className="text-white">{alert.payload.situation || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>State:</span>
                              <span className="text-white">{alert.state}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
