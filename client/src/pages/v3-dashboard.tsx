import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Sport icons mapping
const SportIcons = {
  MLB: "⚾",
  NFL: "🏈", 
  NBA: "🏀",
  NCAAF: "🏈",
  CFL: "🏈",
  WNBA: "🏀"
};

// Performance grade colors
const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A+': case 'A': return 'text-green-500';
    case 'B': return 'text-blue-500';
    case 'C': return 'text-yellow-500';
    case 'D': return 'text-orange-500';
    default: return 'text-red-500';
  }
};

// Response time status colors
const getResponseTimeStatus = (time: number) => {
  if (time < 100) return { color: 'text-green-500', status: 'Excellent' };
  if (time < 150) return { color: 'text-blue-500', status: 'Good' };
  if (time < 200) return { color: 'text-yellow-500', status: 'Fair' };
  if (time < 250) return { color: 'text-orange-500', status: 'Acceptable' };
  return { color: 'text-red-500', status: 'Needs Attention' };
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
    good: 'border-green-500 bg-green-50 dark:bg-green-950/20',
    warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    error: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    neutral: 'border-gray-200 dark:border-gray-700'
  };

  return (
    <Card className={`${statusColors[status]} transition-all hover:scale-105`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
              <p className="text-2xl font-bold">
                {value}{unit}
                {trend !== undefined && (
                  <span className={`ml-2 text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SportEngineCard({ sport, metrics }: { sport: string, metrics: any }) {
  const responseTimeStatus = getResponseTimeStatus(metrics.performance?.avgResponseTime || 0);
  const grade = metrics.performance?.grade || 'N/A';
  
  return (
    <Card className="hover:shadow-lg transition-all" data-testid={`sport-engine-${sport.toLowerCase()}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{SportIcons[sport as keyof typeof SportIcons]}</span>
            <span className="font-bold">{sport}</span>
          </div>
          <Badge variant={metrics.performance?.error ? "destructive" : "default"}>
            {metrics.performance?.error ? "Error" : "Active"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metrics.performance?.error ? (
          <div className="text-center py-4">
            <AlertTriangle className="mx-auto mb-2 text-red-500" size={24} />
            <p className="text-sm text-red-600 dark:text-red-400">Metrics Unavailable</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Response Time</span>
              <span className={`font-bold ${responseTimeStatus.color}`}>
                {metrics.performance?.avgResponseTime?.toFixed(1) || 0}ms
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Grade</span>
              <span className={`font-bold text-lg ${getGradeColor(grade)}`}>
                {grade}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Cache Hit Rate</span>
              <span className="font-bold">
                {metrics.performance?.cacheHitRate?.toFixed(1) || 0}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Alerts</span>
              <span className="font-bold">
                {metrics.performance?.totalAlerts || 0}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">V3 Target</span>
              <div className="flex items-center space-x-1">
                {(metrics.performance?.avgResponseTime || 0) < 250 ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <AlertTriangle className="text-red-500" size={16} />
                )}
                <span className="text-sm">
                  {(metrics.performance?.avgResponseTime || 0) < 250 ? 'Achieved' : 'Needs Work'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function V3AchievementCard({ achievements }: { achievements: any }) {
  const successRate = achievements.overallV3Success || 0;
  const achievedCount = achievements.sub250msTargets?.filter((t: any) => t.achieved).length || 0;
  const totalCount = achievements.sub250msTargets?.length || 6;

  return (
    <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="text-yellow-500" size={24} />
          <span>V3 Optimization Achievement</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {successRate.toFixed(1)}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Overall V3 Success Rate</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold">
              {achievedCount}/{totalCount}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Sports Achieving Sub-250ms</p>
          </div>
          
          <Progress value={successRate} className="w-full" />
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            {achievements.sub250msTargets?.map((target: any) => (
              <div 
                key={target.sport} 
                className={`p-2 rounded text-center text-sm ${
                  target.achieved 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                <div className="font-bold">{target.sport}</div>
                <div className="text-xs">{target.responseTime.toFixed(1)}ms</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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
      <div className="p-6">
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
              Failed to Load Performance Metrics
            </h3>
            <p className="text-red-600 dark:text-red-300 mb-4">
              Unable to retrieve V3 performance data from the server.
            </p>
            <button 
              onClick={() => refetch()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              data-testid="button-retry"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metricsData) {
    return <div>No data available</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="v3-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">V3 Performance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Real-time monitoring of multi-sport intelligence platform performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            <Activity className="w-4 h-4 mr-2" />
            Live
          </Badge>
          <span className="text-sm text-gray-500">
            Last updated: {new Date(metricsData.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Performance Warnings */}
      {metricsData.performanceWarnings && metricsData.performanceWarnings.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle size={20} />
              <span>Performance Warnings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metricsData.performanceWarnings.map((warning, index) => (
                <div key={index} className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded flex justify-between items-center">
                  <div>
                    <span className="font-bold">{warning.sport}</span>: {warning.warning}
                  </div>
                  <Badge variant={warning.severity === 'high' ? 'destructive' : 'secondary'}>
                    {warning.responseTime.toFixed(1)}ms
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="engines" data-testid="tab-engines">Sport Engines</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">V3 Achievements</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">System Health</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <V3AchievementCard achievements={metricsData.v3Achievements} />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="text-blue-500" size={20} />
                  <span>Performance Grades</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metricsData.v3Achievements.performanceGrades.map((grade) => (
                    <div key={grade.sport} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{SportIcons[grade.sport as keyof typeof SportIcons]}</span>
                        <span className="font-medium">{grade.sport}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-lg font-bold ${getGradeColor(grade.grade)}`}>
                          {grade.grade}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({grade.responseTime.toFixed(1)}ms)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Sub-250ms Achievement Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metricsData.v3Achievements.sub250msTargets.map((target) => (
                    <div key={target.sport} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{SportIcons[target.sport as keyof typeof SportIcons]}</span>
                        <div>
                          <div className="font-medium">{target.sport}</div>
                          <div className="text-sm text-gray-500">{target.responseTime.toFixed(1)}ms</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {target.achieved ? (
                          <CheckCircle className="text-green-500" size={20} />
                        ) : (
                          <AlertTriangle className="text-red-500" size={20} />
                        )}
                        <span className={`font-bold ${target.achieved ? 'text-green-600' : 'text-red-600'}`}>
                          {target.achieved ? 'Achieved' : 'Needs Work'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsData.recommendations.length > 0 ? (
                  <div className="space-y-2">
                    {metricsData.recommendations.map((recommendation, index) => (
                      <div key={index} className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-l-4 border-blue-500">
                        <p className="text-sm">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto mb-2 text-green-500" size={48} />
                    <p className="text-green-600 dark:text-green-400 font-medium">
                      All systems performing optimally!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard
              icon={<Monitor className="text-blue-500" size={20} />}
              title="Active Engines"
              value={`${metricsData.systemHealth.healthyEngines}/${metricsData.systemHealth.activeEngines}`}
              status={metricsData.systemHealth.overallHealth > 90 ? 'good' : 'warning'}
            />
            
            <MetricCard
              icon={<Zap className="text-green-500" size={20} />}
              title="System Health"
              value={metricsData.systemHealth.overallHealth.toFixed(1)}
              unit="%"
              status={metricsData.systemHealth.overallHealth > 90 ? 'good' : metricsData.systemHealth.overallHealth > 80 ? 'warning' : 'error'}
            />
            
            <MetricCard
              icon={<Activity className="text-purple-500" size={20} />}
              title="Alert Efficiency"
              value={metricsData.systemHealth.alertGenerationEfficiency.toFixed(1)}
              unit="%"
              status="neutral"
            />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>System Status Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Engine Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Engines:</span>
                      <span className="font-bold">{metricsData.systemHealth.activeEngines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Healthy Engines:</span>
                      <span className="font-bold text-green-600">{metricsData.systemHealth.healthyEngines}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overall Health:</span>
                      <span className="font-bold">{metricsData.systemHealth.overallHealth.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Performance Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Memory Efficiency:</span>
                      <span className="font-bold">{metricsData.systemHealth.memoryEfficiency.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Requests:</span>
                      <span className="font-bold">{metricsData.summary.totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Alerts:</span>
                      <span className="font-bold">{metricsData.summary.totalAlerts.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}