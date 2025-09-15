import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Activity, 
  Clock, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  RefreshCw,
  Filter,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
  homeScore?: number;
  awayScore?: number;
  context?: any;
  sentToTelegram?: boolean;
}

interface AlertStats {
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  monitoredGames: number;
}

const SPORTS = ['all', 'MLB', 'NFL', 'NBA', 'WNBA', 'NCAAF', 'CFL'] as const;
type SportFilter = typeof SPORTS[number];

const LoadingSkeleton = () => (
  <Card className="bg-gradient-to-r from-slate-900/50 to-slate-800/30 border border-slate-700/30 backdrop-blur-sm">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32 bg-slate-700/50" />
        <Skeleton className="h-5 w-16 bg-slate-700/30" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-4 w-full mb-3 bg-slate-700/40" />
      <Skeleton className="h-4 w-3/4 bg-slate-700/30" />
      <div className="flex items-center justify-between mt-4">
        <Skeleton className="h-6 w-24 bg-slate-700/40" />
        <Skeleton className="h-8 w-20 bg-slate-700/30" />
      </div>
    </CardContent>
  </Card>
);

const StatsCard = ({ stats }: { stats?: AlertStats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Bell className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Total Alerts</p>
          <p className="text-2xl font-bold text-blue-400" data-testid="stat-total-alerts">
            {stats?.totalAlerts || 0}
          </p>
        </div>
      </div>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <Clock className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Today</p>
          <p className="text-2xl font-bold text-emerald-400" data-testid="stat-today-alerts">
            {stats?.todayAlerts || 0}
          </p>
        </div>
      </div>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Activity className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Live Games</p>
          <p className="text-2xl font-bold text-orange-400" data-testid="stat-live-games">
            {stats?.liveGames || 0}
          </p>
        </div>
      </div>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Users className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Monitored</p>
          <p className="text-2xl font-bold text-purple-400" data-testid="stat-monitored-games">
            {stats?.monitoredGames || 0}
          </p>
        </div>
      </div>
    </motion.div>
  </div>
);

const SportFilter = ({ 
  selectedSport, 
  onSportChange 
}: { 
  selectedSport: SportFilter;
  onSportChange: (sport: SportFilter) => void;
}) => (
  <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
    <Filter className="h-5 w-5 text-slate-400 flex-shrink-0" />
    <div className="flex gap-2">
      {SPORTS.map((sport) => (
        <Button
          key={sport}
          variant={selectedSport === sport ? "default" : "outline"}
          size="sm"
          onClick={() => onSportChange(sport)}
          className={`
            flex-shrink-0 uppercase tracking-wide font-bold text-xs
            ${selectedSport === sport 
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
              : 'border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
            }
          `}
          data-testid={`filter-${sport.toLowerCase()}`}
        >
          {sport}
        </Button>
      ))}
    </div>
  </div>
);

const AlertCard = ({ alert }: { alert: Alert }) => {
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'border-red-500/50 bg-red-500/5';
    if (priority >= 6) return 'border-orange-500/50 bg-orange-500/5';
    if (priority >= 4) return 'border-yellow-500/50 bg-yellow-500/5';
    return 'border-emerald-500/50 bg-emerald-500/5';
  };

  const getPriorityIcon = (priority: number) => {
    if (priority >= 8) return <AlertTriangle className="h-4 w-4 text-red-400" />;
    if (priority >= 6) return <TrendingUp className="h-4 w-4 text-orange-400" />;
    return <Zap className="h-4 w-4 text-emerald-400" />;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={`
          transition-all duration-300 hover:shadow-lg backdrop-blur-sm
          bg-gradient-to-r from-slate-900/80 to-slate-800/60
          border-l-4 ${getPriorityColor(alert.priority)}
        `}
        data-testid={`alert-card-${alert.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getPriorityIcon(alert.priority)}
              <div>
                <CardTitle className="text-lg font-bold text-slate-100">
                  {alert.type.replace(/_/g, ' ')}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                    {alert.sport}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {formatTime(alert.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-300">
                {alert.homeTeam} vs {alert.awayTeam}
              </div>
              {(alert.homeScore !== undefined && alert.awayScore !== undefined) && (
                <div className="text-lg font-bold text-slate-100">
                  {alert.homeScore} - {alert.awayScore}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <p className="text-slate-300 mb-4 leading-relaxed">
            {alert.message}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400">
                  {alert.confidence}% confidence
                </span>
              </div>
              {alert.sentToTelegram && (
                <Badge variant="outline" className="text-xs border-emerald-600 text-emerald-400">
                  Sent to Telegram
                </Badge>
              )}
            </div>
            
            <Badge 
              variant="outline" 
              className={`text-xs font-medium
                ${alert.priority >= 8 ? 'border-red-500 text-red-400' : ''}
                ${alert.priority >= 6 && alert.priority < 8 ? 'border-orange-500 text-orange-400' : ''}
                ${alert.priority < 6 ? 'border-emerald-500 text-emerald-400' : ''}
              `}
            >
              Priority {alert.priority}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EmptyState = ({ 
  selectedSport, 
  onRefresh 
}: { 
  selectedSport: SportFilter;
  onRefresh: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16"
  >
    <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-slate-700/50 to-slate-800/30 flex items-center justify-center mb-6">
      <Bell className="h-12 w-12 text-slate-400" />
    </div>
    <h3 className="text-xl font-bold text-slate-100 mb-2">
      No Alerts Available
    </h3>
    <p className="text-slate-400 mb-6 max-w-md mx-auto">
      {selectedSport === 'all' 
        ? 'No alerts have been generated yet. Check back during live games for real-time updates.'
        : `No ${selectedSport} alerts at the moment. Switch to "All" to see alerts from other sports.`
      }
    </p>
    <Button
      onClick={onRefresh}
      variant="outline"
      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500"
      data-testid="button-refresh-alerts"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh Alerts
    </Button>
  </motion.div>
);

export default function AlertsPage() {
  const [selectedSport, setSelectedSport] = useState<SportFilter>('all');

  // Fetch alerts
  const { 
    data: alerts = [], 
    isLoading: alertsLoading, 
    refetch: refetchAlerts 
  } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch stats
  const { 
    data: stats, 
    isLoading: statsLoading 
  } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter alerts based on selected sport
  const filteredAlerts = selectedSport === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.sport === selectedSport);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/realtime-alerts`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('🔗 WebSocket connected for real-time alerts');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_alert') {
          console.log('🔔 New alert received via WebSocket');
          refetchAlerts();
        }
      } catch (error) {
        console.warn('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [refetchAlerts]);

  if (alertsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-black uppercase tracking-wider text-slate-100 mb-2">
              ChirpBot V3
            </h1>
            <p className="text-xl text-slate-400">
              Real-Time Sports Intelligence Dashboard
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
                  <Skeleton className="h-12 w-12 rounded-lg bg-slate-700/50 mb-3" />
                  <Skeleton className="h-4 w-20 bg-slate-700/40 mb-2" />
                  <Skeleton className="h-8 w-16 bg-slate-700/50" />
                </div>
              ))}
            </div>
            
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <LoadingSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100"
      data-testid="alerts-page"
    >
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-black uppercase tracking-wider text-slate-100 mb-2">
            ChirpBot V3
          </h1>
          <p className="text-xl text-slate-400">
            Real-Time Sports Intelligence Dashboard
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-emerald-400 font-medium">
              Live Monitoring Active
            </span>
          </div>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          {/* Stats Cards */}
          <StatsCard stats={stats} />

          {/* Sport Filter */}
          <SportFilter 
            selectedSport={selectedSport}
            onSportChange={setSelectedSport}
          />

          {/* Alerts List */}
          <div className="space-y-4" data-testid="alerts-container">
            <AnimatePresence mode="wait">
              {filteredAlerts.length === 0 ? (
                <EmptyState 
                  selectedSport={selectedSport}
                  onRefresh={() => refetchAlerts()}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                  data-testid="alerts-list"
                >
                  {filteredAlerts.map((alert, index) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <AlertCard alert={alert} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}