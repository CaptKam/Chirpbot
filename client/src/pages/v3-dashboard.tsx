import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Clock, 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  BarChart3,
  Monitor,
  Target,
  Trophy,
  Gauge
} from "lucide-react";
import { AuthLoading } from '@/components/sports-loading';
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from '@/components/PageHeader';

// Sport icons mapping
const SportIcons = {
  MLB: "⚾",
  NFL: "🏈", 
  NBA: "🏀",
  NCAAF: "🏈",
  CFL: "🏈",
  WNBA: "🏀"
};

// Performance grade colors - emerald-based system
const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A+': case 'A': return 'text-emerald-400';
    case 'B': return 'text-emerald-300';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    default: return 'text-red-400';
  }
};

// Response time status colors - emerald-based system
const getResponseTimeStatus = (time: number) => {
  if (time < 100) return { color: 'text-emerald-400', status: 'Excellent' };
  if (time < 150) return { color: 'text-emerald-300', status: 'Good' };
  if (time < 200) return { color: 'text-yellow-400', status: 'Fair' };
  if (time < 250) return { color: 'text-orange-400', status: 'Acceptable' };
  return { color: 'text-red-400', status: 'Needs Attention' };
};

interface V3MetricsData {
  timestamp: string;
  summary: {
    totalSports: number;
    totalRequests: number;
    totalAlerts: number;
    avgResponseTime: number;
    overallCacheHitRate: number;
    v3OptimizationSuccess: number;
  };
  sportMetrics: Record<string, any>;
  v3Achievements: {
    sub250msTargets: Array<{
      sport: string;
      achieved: boolean;
      responseTime: number;
      target: number;
    }>;
    overallV3Success: number;
    performanceGrades: Array<{
      sport: string;
      grade: string;
      responseTime: number;
    }>;
  };
  systemHealth: {
    activeEngines: number;
    healthyEngines: number;
    overallHealth: number;
    memoryEfficiency: number;
    alertGenerationEfficiency: number;
  };
  performanceWarnings: Array<{
    sport: string;
    warning: string;
    responseTime: number;
    severity: string;
  }>;
  recommendations: string[];
}

function MetricCard({ 
  icon, 
  title, 
  value, 
  unit = '', 
  trend, 
  status = 'neutral' 
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  status?: 'good' | 'warning' | 'error' | 'neutral';
}) {
  const statusColors = {
    good: 'ring-emerald-500/30',
    warning: 'ring-yellow-500/30',
    error: 'ring-red-500/30',
    neutral: 'ring-white/10'
  };

  return (
    <div className={`bg-white/5 backdrop-blur-sm ring-1 ${statusColors[status]} border-0 rounded-xl p-4 shadow-xl shadow-emerald-500/5 transition-all hover:scale-105 hover:bg-white/10`} data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-black text-slate-100">
              {value}{unit}
              {trend !== undefined && (
                <span className={`ml-2 text-sm font-bold ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SportEngineCard({ sport, metrics }: { sport: string, metrics: any }) {
  const responseTimeStatus = getResponseTimeStatus(metrics.performance?.avgResponseTime || 0);
  const grade = metrics.performance?.grade || 'N/A';
  
  return (
    <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5 hover:bg-white/10 hover:ring-emerald-500/30 transition-all" data-testid={`sport-engine-${sport.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{SportIcons[sport as keyof typeof SportIcons]}</span>
          <span className="font-black text-slate-100 text-lg uppercase tracking-wide">{sport}</span>
        </div>
        <div className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wide ${
          metrics.performance?.error 
            ? 'bg-red-500/20 ring-1 ring-red-500/30 text-red-400' 
            : 'bg-emerald-500/20 ring-1 ring-emerald-500/30 text-emerald-400'
        }`}>
          {metrics.performance?.error ? "Error" : "Active"}
        </div>
      </div>
      
      {metrics.performance?.error ? (
        <div className="text-center py-6">
          <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-sm text-red-400 font-medium">Metrics Unavailable</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300 font-medium">Response Time</span>
            <span className={`font-bold ${responseTimeStatus.color} text-lg`}>
              {metrics.performance?.avgResponseTime?.toFixed(1) || 0}ms
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300 font-medium">Grade</span>
            <span className={`font-black text-xl ${getGradeColor(grade)}`}>
              {grade}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300 font-medium">Cache Hit Rate</span>
            <span className="font-bold text-slate-100 text-lg">
              {metrics.performance?.cacheHitRate?.toFixed(1) || 0}%
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-300 font-medium">Total Alerts</span>
            <span className="font-bold text-slate-100 text-lg">
              {metrics.performance?.totalAlerts || 0}
            </span>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-sm text-slate-300 font-medium">V3 Target</span>
            <div className="flex items-center space-x-2">
              {(metrics.performance?.avgResponseTime || 0) < 250 ? (
                <CheckCircle className="text-emerald-400" size={16} />
              ) : (
                <AlertTriangle className="text-red-400" size={16} />
              )}
              <span className={`text-sm font-bold ${
                (metrics.performance?.avgResponseTime || 0) < 250 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {(metrics.performance?.avgResponseTime || 0) < 250 ? 'Achieved' : 'Needs Work'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function V3AchievementCard({ achievements }: { achievements: any }) {
  const successRate = achievements.overallV3Success || 0;
  const achievedCount = achievements.sub250msTargets?.filter((t: any) => t.achieved).length || 0;
  const totalCount = achievements.sub250msTargets?.length || 6;

  return (
    <div className="bg-white/5 backdrop-blur-sm ring-2 ring-emerald-500/30 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
          <Trophy className="text-emerald-400" size={24} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">V3 Optimization Achievement</h3>
      </div>
      
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-5xl font-black text-emerald-400 mb-2">
            {successRate.toFixed(1)}%
          </div>
          <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Overall V3 Success Rate</p>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-black text-slate-100 mb-2">
            {achievedCount}/{totalCount}
          </div>
          <p className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Sports Achieving Sub-250ms</p>
        </div>
        
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${Math.min(successRate, 100)}%` }}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-6">
          {achievements.sub250msTargets?.map((target: any) => (
            <div 
              key={target.sport} 
              className={`p-3 rounded-xl text-center border-0 ring-1 transition-all ${
                target.achieved 
                  ? 'bg-emerald-500/20 ring-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/20 ring-red-500/30 text-red-300'
              }`}
            >
              <div className="font-black text-sm uppercase tracking-wide">{target.sport}</div>
              <div className="text-xs font-semibold opacity-80">{target.responseTime.toFixed(1)}ms</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function V3Dashboard() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  
  const { data: metricsData, isLoading, error, refetch } = useQuery<V3MetricsData>({
    queryKey: ['/api/v3/performance-metrics'],
    enabled: isAuthenticated,
    refetchInterval: refreshInterval,
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refetch, refreshInterval]);

  if (isAuthLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <div>Unauthorized</div>;
  }

  if (isLoading) {
    return <AuthLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased">
        <PageHeader 
          title="V3 Performance Dashboard" 
          subtitle="Real-time monitoring of multi-sport intelligence platform performance"
          icon={BarChart3}
        />
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-red-500/30 border-0 rounded-xl p-8 shadow-xl shadow-red-500/5 text-center">
            <div className="p-3 rounded-lg bg-red-500/20 ring-1 ring-red-500/30 w-fit mx-auto mb-6">
              <AlertTriangle className="text-red-400" size={48} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-100 mb-4">
              Failed to Load Performance Metrics
            </h3>
            <p className="text-slate-300 mb-6 font-medium">
              Unable to retrieve V3 performance data from the server.
            </p>
            <Button 
              onClick={() => refetch()}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold px-6 py-3 rounded-xl transition-all hover:scale-105"
              data-testid="button-retry"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased">
        <PageHeader 
          title="V3 Performance Dashboard" 
          subtitle="Real-time monitoring of multi-sport intelligence platform performance"
          icon={BarChart3}
        />
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-8 shadow-xl shadow-emerald-500/5 text-center">
            <div className="p-3 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 w-fit mx-auto mb-6">
              <BarChart3 className="text-emerald-400" size={48} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-100 mb-4">
              No Data Available
            </h3>
            <p className="text-slate-300 font-medium">
              Performance metrics are currently unavailable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased" data-testid="v3-dashboard">
      <PageHeader 
        title="V3 Performance Dashboard" 
        subtitle="Real-time monitoring of multi-sport intelligence platform performance"
        icon={BarChart3}
      >
        <div className="flex items-center space-x-2">
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-emerald-500/30 border-0 rounded-xl px-3 py-1 flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Live</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Last updated: {new Date(metricsData.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </PageHeader>
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

      {/* Performance Warnings */}
      {metricsData.performanceWarnings && metricsData.performanceWarnings.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm ring-1 ring-yellow-500/30 border-0 rounded-xl p-6 shadow-xl shadow-yellow-500/5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-lg bg-yellow-500/20 ring-1 ring-yellow-500/30">
              <AlertTriangle className="text-yellow-400" size={20} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">Performance Warnings</h3>
          </div>
          <div className="space-y-3">
            {metricsData.performanceWarnings.map((warning, index) => (
              <div key={index} className="bg-yellow-500/10 backdrop-blur-sm ring-1 ring-yellow-500/20 border-0 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-100">{warning.sport}</span>
                  <span className="text-slate-300">: {warning.warning}</span>
                </div>
                <div className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wide ${
                  warning.severity === 'high' 
                    ? 'bg-red-500/20 ring-1 ring-red-500/30 text-red-400' 
                    : 'bg-yellow-500/20 ring-1 ring-yellow-500/30 text-yellow-400'
                }`}>
                  {warning.responseTime.toFixed(1)}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Gauge className="text-blue-500" size={20} />}
          title="Avg Response Time"
          value={metricsData.summary.avgResponseTime.toFixed(1)}
          unit="ms"
          status={metricsData.summary.avgResponseTime < 200 ? 'good' : metricsData.summary.avgResponseTime < 250 ? 'warning' : 'error'}
        />
        
        <MetricCard
          icon={<Database className="text-green-500" size={20} />}
          title="Cache Hit Rate"
          value={metricsData.summary.overallCacheHitRate.toFixed(1)}
          unit="%"
          status={metricsData.summary.overallCacheHitRate > 80 ? 'good' : metricsData.summary.overallCacheHitRate > 60 ? 'warning' : 'error'}
        />
        
        <MetricCard
          icon={<TrendingUp className="text-purple-500" size={20} />}
          title="Total Alerts"
          value={metricsData.summary.totalAlerts.toLocaleString()}
          status="neutral"
        />
        
        <MetricCard
          icon={<Target className="text-orange-500" size={20} />}
          title="V3 Success Rate"
          value={metricsData.summary.v3OptimizationSuccess.toFixed(1)}
          unit="%"
          status={metricsData.summary.v3OptimizationSuccess > 80 ? 'good' : metricsData.summary.v3OptimizationSuccess > 60 ? 'warning' : 'error'}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-2 mb-6">
          <div className="grid grid-cols-4 gap-2">
            <TabsTrigger 
              value="overview" 
              data-testid="tab-overview"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/30 data-[state=active]:text-emerald-400 text-slate-300 font-semibold uppercase tracking-wide rounded-lg px-4 py-3 transition-all hover:bg-white/10"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="engines" 
              data-testid="tab-engines"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/30 data-[state=active]:text-emerald-400 text-slate-300 font-semibold uppercase tracking-wide rounded-lg px-4 py-3 transition-all hover:bg-white/10"
            >
              Sport Engines
            </TabsTrigger>
            <TabsTrigger 
              value="achievements" 
              data-testid="tab-achievements"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/30 data-[state=active]:text-emerald-400 text-slate-300 font-semibold uppercase tracking-wide rounded-lg px-4 py-3 transition-all hover:bg-white/10"
            >
              V3 Achievements
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              data-testid="tab-system"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/30 data-[state=active]:text-emerald-400 text-slate-300 font-semibold uppercase tracking-wide rounded-lg px-4 py-3 transition-all hover:bg-white/10"
            >
              System Health
            </TabsTrigger>
          </div>
        </div>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <V3AchievementCard achievements={metricsData.v3Achievements} />
            
            <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
                  <BarChart3 className="text-emerald-400" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">Performance Grades</h3>
              </div>
              <div className="space-y-4">
                {metricsData.v3Achievements.performanceGrades.map((grade) => (
                  <div key={grade.sport} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{SportIcons[grade.sport as keyof typeof SportIcons]}</span>
                      <span className="font-bold text-slate-100">{grade.sport}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xl font-black ${getGradeColor(grade.grade)}`}>
                        {grade.grade}
                      </span>
                      <span className="text-sm text-slate-400 font-medium">
                        ({grade.responseTime.toFixed(1)}ms)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="engines" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(metricsData.sportMetrics).map(([sport, metrics]) => (
              <SportEngineCard key={sport} sport={sport} metrics={metrics} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="achievements" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
                  <Target className="text-emerald-400" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">Sub-250ms Achievement Status</h3>
              </div>
              <div className="space-y-4">
                {metricsData.v3Achievements.sub250msTargets.map((target) => (
                  <div key={target.sport} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl">
                    <div className="flex items-center space-x-4">
                      <span className="text-xl">{SportIcons[target.sport as keyof typeof SportIcons]}</span>
                      <div>
                        <div className="font-bold text-slate-100">{target.sport}</div>
                        <div className="text-sm text-slate-400 font-medium">{target.responseTime.toFixed(1)}ms</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {target.achieved ? (
                        <CheckCircle className="text-emerald-400" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-400" size={20} />
                      )}
                      <span className={`font-bold text-sm uppercase tracking-wide ${
                        target.achieved ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {target.achieved ? 'Achieved' : 'Needs Work'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
                  <TrendingUp className="text-emerald-400" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">Recommendations</h3>
              </div>
              {metricsData.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {metricsData.recommendations.map((recommendation, index) => (
                    <div key={index} className="p-4 bg-emerald-500/10 backdrop-blur-sm ring-1 ring-emerald-500/20 rounded-xl border-l-4 border-emerald-400">
                      <p className="text-slate-300 font-medium">{recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-3 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30 w-fit mx-auto mb-4">
                    <CheckCircle className="text-emerald-400" size={48} />
                  </div>
                  <p className="text-emerald-400 font-bold text-lg">
                    All systems performing optimally!
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard
              icon={<Monitor className="text-emerald-400" size={20} />}
              title="Active Engines"
              value={`${metricsData.systemHealth.healthyEngines}/${metricsData.systemHealth.activeEngines}`}
              status={metricsData.systemHealth.overallHealth > 90 ? 'good' : 'warning'}
            />
            
            <MetricCard
              icon={<Zap className="text-emerald-400" size={20} />}
              title="System Health"
              value={metricsData.systemHealth.overallHealth.toFixed(1)}
              unit="%"
              status={metricsData.systemHealth.overallHealth > 90 ? 'good' : metricsData.systemHealth.overallHealth > 80 ? 'warning' : 'error'}
            />
            
            <MetricCard
              icon={<Activity className="text-emerald-400" size={20} />}
              title="Alert Efficiency"
              value={metricsData.systemHealth.alertGenerationEfficiency.toFixed(1)}
              unit="%"
              status="neutral"
            />
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
                <Monitor className="text-emerald-400" size={20} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">System Status Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <h4 className="font-bold text-slate-100 mb-4 uppercase tracking-wide">Engine Status</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Total Engines:</span>
                    <span className="font-bold text-slate-100">{metricsData.systemHealth.activeEngines}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Healthy Engines:</span>
                    <span className="font-bold text-emerald-400">{metricsData.systemHealth.healthyEngines}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Overall Health:</span>
                    <span className="font-bold text-slate-100">{metricsData.systemHealth.overallHealth.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 rounded-xl p-4">
                <h4 className="font-bold text-slate-100 mb-4 uppercase tracking-wide">Performance Metrics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Memory Efficiency:</span>
                    <span className="font-bold text-slate-100">{metricsData.systemHealth.memoryEfficiency.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Total Requests:</span>
                    <span className="font-bold text-slate-100">{metricsData.summary.totalRequests.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Total Alerts:</span>
                    <span className="font-bold text-slate-100">{metricsData.summary.totalAlerts.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}