import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { History, Search, Filter, Calendar, Clock, TrendingUp, Trophy } from 'lucide-react';
import { AlertLoading } from '@/components/sports-loading';
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';
import { getSeasonAwareSports } from '@shared/season-manager';
import { format, parseISO, isAfter, isBefore, subDays } from 'date-fns';
import { Alert } from '@/types';


interface AlertStats {
  totalAlerts: number;
  todayAlerts: number;
  liveGames: number;
  monitoredGames: number;
}

export default function AlertHistoryPage() {
  const [filter, setFilter] = useState<'all' | 'MLB' | 'NFL' | 'NBA' | 'NHL' | 'NCAAF' | 'WNBA' | 'CFL'>('all');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'sport'>('newest');

  // Fetch all alerts (not just recent ones)
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts', { history: true }],
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlertStats>({
    queryKey: ['/api/alerts/stats'],
  });

  // Filter and sort alerts based on current settings
  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    
    let filtered = alerts;

    // Filter by sport
    if (filter !== 'all') {
      filtered = filtered.filter(alert => alert.sport === filter);
    }

    // Filter by date range
    const now = new Date();
    if (dateRange !== 'all') {
      const cutoffDate = dateRange === 'today' 
        ? subDays(now, 0)
        : dateRange === '7days' 
        ? subDays(now, 7)
        : subDays(now, 30);
      
      filtered = filtered.filter(alert => {
        const alertDate = alert.createdAt || alert.timestamp;
        return alertDate && isAfter(parseISO(alertDate), cutoffDate);
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(alert => {
        const message = alert.message || '';
        const homeTeam = typeof alert.homeTeam === 'string' ? alert.homeTeam : alert.homeTeam?.name || '';
        const awayTeam = typeof alert.awayTeam === 'string' ? alert.awayTeam : alert.awayTeam?.name || '';
        
        return message.toLowerCase().includes(term) ||
               alert.type.toLowerCase().includes(term) ||
               homeTeam.toLowerCase().includes(term) ||
               awayTeam.toLowerCase().includes(term) ||
               alert.sport.toLowerCase().includes(term);
      });
    }

    // Sort alerts
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          const bDate = b.createdAt || b.timestamp || '';
          const aDate = a.createdAt || a.timestamp || '';
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        case 'oldest':
          const aDateOld = a.createdAt || a.timestamp || '';
          const bDateOld = b.createdAt || b.timestamp || '';
          return new Date(aDateOld).getTime() - new Date(bDateOld).getTime();
        case 'priority':
          return (b.priority || 0) - (a.priority || 0);
        case 'sport':
          return a.sport.localeCompare(b.sport);
        default:
          return 0;
      }
    });

    return filtered;
  }, [alerts, filter, dateRange, searchTerm, sortBy]);

  // Group alerts by date for better organization
  const groupedAlerts = useMemo(() => {
    const groups: { [key: string]: Alert[] } = {};
    
    filteredAlerts.forEach(alert => {
      const date = format(parseISO(alert.createdAt || alert.timestamp || new Date().toISOString()), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(alert);
    });
    
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredAlerts]);

  const AlertHistoryCard = ({ alert }: { alert: Alert }) => {
    const formattedTime = format(parseISO(alert.createdAt || alert.timestamp || new Date().toISOString()), 'HH:mm');
    const isPriorityHigh = (alert.priority || 0) >= 80;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl shadow-xl shadow-emerald-500/5 hover:ring-emerald-500/20 transition-all duration-300" data-testid={`alert-card-${alert.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${isPriorityHigh ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'} font-medium`}
                  data-testid={`sport-badge-${alert.sport}`}
                >
                  {alert.sport}
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="bg-slate-500/20 text-slate-300 border-slate-500/30"
                  data-testid={`type-badge-${alert.type}`}
                >
                  {alert.type.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-3 h-3" />
                <span data-testid={`alert-time-${alert.id}`}>{formattedTime}</span>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-slate-200 text-sm leading-relaxed" data-testid={`alert-message-${alert.id}`}>
                {alert.message}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-slate-400">
                {alert.homeTeam && alert.awayTeam && (
                  <span data-testid={`matchup-${alert.id}`}>
                    {typeof alert.awayTeam === 'string' ? alert.awayTeam : alert.awayTeam?.name || 'Away'} @ {typeof alert.homeTeam === 'string' ? alert.homeTeam : alert.homeTeam?.name || 'Home'}
                  </span>
                )}
                {(alert.homeScore !== undefined && alert.awayScore !== undefined) && (
                  <span data-testid={`score-${alert.id}`}>
                    {alert.awayScore} - {alert.homeScore}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {alert.sentToTelegram && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                    Sent
                  </Badge>
                )}
                {alert.priority && (
                  <Badge 
                    variant="outline" 
                    className={`${isPriorityHigh ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'} text-xs`}
                    data-testid={`priority-badge-${alert.id}`}
                  >
                    {alert.priority}%
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const StatsCard = ({ title, value, icon: Icon, color }: { 
    title: string; 
    value: number; 
    icon: React.ElementType; 
    color: string; 
  }) => (
    <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-100">{value.toLocaleString()}</p>
          </div>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );

  if (alertsLoading || statsLoading) {
    return <AlertLoading />;
  }

  const seasonAwareSports = getSeasonAwareSports();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
      <PageHeader 
        icon={History}
        title="Alert History" 
        subtitle="View and search through all past alerts"
      />

      <div className="max-w-md mx-auto px-4 pb-24 space-y-6">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <StatsCard
              title="Total Alerts"
              value={stats.totalAlerts}
              icon={History}
              color="text-emerald-400"
            />
            <StatsCard
              title="Today's Alerts"
              value={stats.todayAlerts}
              icon={Clock}
              color="text-blue-400"
            />
          </div>
        )}

        {/* Filters and Search */}
        <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-900/50 border-slate-700 text-slate-100 placeholder-slate-400"
                data-testid="search-input"
              />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-2 gap-3">
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as 'all' | 'today' | '7days' | '30days')} data-testid="date-range-select">
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'newest' | 'oldest' | 'priority' | 'sport')} data-testid="sort-by-select">
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="priority">By Priority</SelectItem>
                  <SelectItem value="sport">By Sport</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sport Tabs */}
        <SportTabs 
          activeSport={filter} 
          onSportChange={(tab: any) => setFilter(tab)}
          sports={getSeasonAwareSports()}
        />

        {/* Results Summary */}
        <div className="text-center text-slate-400 text-sm">
          Showing {filteredAlerts.length} alerts
          {searchTerm && ` matching "${searchTerm}"`}
        </div>

        {/* Grouped Alerts */}
        <div className="space-y-6">
          {groupedAlerts.length === 0 ? (
            <Card className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl">
              <CardContent className="p-8 text-center">
                <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">No alerts found</h3>
                <p className="text-slate-400">
                  {searchTerm ? 'Try adjusting your search terms or filters.' : 'No alerts match your current filters.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            groupedAlerts.map(([date, dateAlerts]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                    {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <div className="flex-1 h-px bg-slate-700"></div>
                  <Badge variant="secondary" className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-xs">
                    {dateAlerts.length}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {dateAlerts.map((alert) => (
                    <AlertHistoryCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}