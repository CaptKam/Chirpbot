import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  BarChart3, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Gauge, 
  TrendingUp,
  Zap,
  AlertTriangle,
  Eye,
  Target,
  Trophy,
  MemoryStick
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SportMetrics {
  sport: string;
  performance?: {
    avgResponseTime: number;
    avgCalculationTime: number;
    avgAlertGenerationTime: number;
    avgEnhancementTime: number;
    cacheHitRate: number;
    totalRequests: number;
    totalAlerts: number;
    cacheHits: number;
    cacheMisses: number;
  };
  // Flattened format (NCAAF, CFL)
  averageAlertGenerationTime?: number;
  averageEnhanceDataTime?: number;
  averageProbabilityCalculationTime?: number;
  cacheHitRate?: number;
  totalRequests?: number;
  totalAlerts?: number;
  cacheHits?: number;
  cacheMisses?: number;
  sportSpecific?: any;
  recentPerformance?: any;
}

interface V3Achievement {
  sport: string;
  achieved: boolean;
  responseTime: number;
  target: number;
}

interface PerformanceGrade {
  sport: string;
  grade: string;
  responseTime: number;
}

interface V3MetricsResponse {
  timestamp: string;
  summary: {
    totalSports: number;
    totalRequests: number;
    totalAlerts: number;
    avgResponseTime: number;
    overallCacheHitRate: number;
    v3OptimizationSuccess: number;
  };
  sportMetrics: Record<string, SportMetrics>;
  v3Achievements: {
    sub250msTargets: V3Achievement[];
    overallV3Success: number;
    performanceGrades: PerformanceGrade[];
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
    severity: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
}

const SPORTS_ORDER = ['MLB', 'NFL', 'NCAAF', 'WNBA', 'NBA', 'CFL'];

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-emerald-500';
    case 'A': return 'bg-green-500';
    case 'B': return 'bg-blue-500';
    case 'C': return 'bg-yellow-500';
    case 'D': return 'bg-orange-500';
    case 'F': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function getResponseTime(metrics: SportMetrics): number {
  if (metrics.performance?.avgResponseTime !== undefined) {
    return metrics.performance.avgResponseTime;
  }
  return (metrics.averageAlertGenerationTime || 0) + 
         (metrics.averageEnhanceDataTime || 0) + 
         (metrics.averageProbabilityCalculationTime || 0);
}

function getTotalRequests(metrics: SportMetrics): number {
  return metrics.performance?.totalRequests || metrics.totalRequests || 0;
}

function getTotalAlerts(metrics: SportMetrics): number {
  return metrics.performance?.totalAlerts || metrics.totalAlerts || 0;
}

function getCacheHitRate(metrics: SportMetrics): number {
  return metrics.performance?.cacheHitRate || metrics.cacheHitRate || 0;
}

export default function V3PerformanceDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch V3 performance metrics
  const { data: v3Metrics, isLoading, error } = useQuery<V3MetricsResponse>({
    queryKey: ['/api/v3-performance-metrics'],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time monitoring
    enabled: isAuthenticated,
  });

  // Fetch alert statistics for context
  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-slate-400">Please log in to access the V3 Performance Dashboard</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading V3 Performance Metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !v3Metrics) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Failed to Load Metrics</h1>
          <p className="text-slate-400">Unable to fetch V3 performance data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 bg-clip-text text-transparent" data-testid="dashboard-title">
                V3 Performance Dashboard
              </h1>
              <p className="text-slate-400 mt-2">
                Multi-Sport Intelligence Platform - Real-time Performance Monitoring
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="border-emerald-500 text-emerald-400" data-testid="v3-optimization-badge">
                <Trophy className="w-4 h-4 mr-1" />
                V3 Optimization: {Math.round(v3Metrics.v3Achievements.overallV3Success)}%
              </Badge>
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                <Clock className="w-4 h-4 mr-1" />
                Last Updated: {new Date(v3Metrics.timestamp).toLocaleTimeString()}
              </Badge>
            </div>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-900 border-slate-700" data-testid="card-active-engines">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Engines</CardTitle>
              <Cpu className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{v3Metrics.systemHealth.activeEngines}/6</div>
              <p className="text-xs text-slate-400">
                Sports engines running
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700" data-testid="card-system-health">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(v3Metrics.systemHealth.overallHealth)}%</div>
              <Progress value={v3Metrics.systemHealth.overallHealth} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700" data-testid="card-response-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Gauge className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(v3Metrics.summary.avgResponseTime)}ms</div>
              <p className="text-xs text-slate-400">
                Target: &lt;250ms
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700" data-testid="card-total-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{v3Metrics.summary.totalAlerts.toLocaleString()}</div>
              <p className="text-xs text-slate-400">
                Across all sports
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Warnings */}
        {v3Metrics.performanceWarnings.length > 0 && (
          <Card className="bg-red-950 border-red-800 mb-8" data-testid="performance-warnings">
            <CardHeader>
              <CardTitle className="flex items-center text-red-400">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Performance Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {v3Metrics.performanceWarnings.map((warning, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-900/50 rounded-lg">
                    <div>
                      <span className="font-semibold text-red-300">{warning.sport}</span>
                      <p className="text-sm text-red-200">{warning.warning}</p>
                    </div>
                    <Badge variant={warning.severity === 'high' ? 'destructive' : 'secondary'}>
                      {warning.responseTime}ms
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900" data-testid="dashboard-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sports" data-testid="tab-sports">Sports Performance</TabsTrigger>
            <TabsTrigger value="v3-achievements" data-testid="tab-achievements">V3 Achievements</TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overview Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                    Performance Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Cache Hit Rate</span>
                    <span className="text-xl font-semibold">{Math.round(v3Metrics.summary.overallCacheHitRate)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Requests</span>
                    <span className="text-xl font-semibold">{v3Metrics.summary.totalRequests.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Alert Generation Efficiency</span>
                    <span className="text-xl font-semibold">{Math.round(v3Metrics.systemHealth.alertGenerationEfficiency)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Memory Efficiency</span>
                    <span className="text-xl font-semibold">{Math.round(v3Metrics.systemHealth.memoryEfficiency)}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="w-5 h-5 mr-2 text-emerald-500" />
                    V3 Optimization Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className="text-4xl font-bold text-emerald-400">
                      {Math.round(v3Metrics.v3Achievements.overallV3Success)}%
                    </div>
                    <p className="text-slate-400">Sports achieving sub-250ms targets</p>
                    <Progress value={v3Metrics.v3Achievements.overallV3Success} className="h-3" />
                    <div className="text-sm text-slate-500">
                      {v3Metrics.v3Achievements.sub250msTargets.filter(t => t.achieved).length} of{' '}
                      {v3Metrics.v3Achievements.sub250msTargets.length} sports optimized
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sports" className="space-y-6">
            {/* Sports Performance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SPORTS_ORDER.map((sport) => {
                const metrics = v3Metrics.sportMetrics[sport];
                if (!metrics) return null;

                const responseTime = getResponseTime(metrics);
                const totalRequests = getTotalRequests(metrics);
                const totalAlerts = getTotalAlerts(metrics);
                const cacheHitRate = getCacheHitRate(metrics);
                const grade = v3Metrics.v3Achievements.performanceGrades.find(g => g.sport === sport)?.grade || 'F';

                return (
                  <Card key={sport} className="bg-slate-900 border-slate-700" data-testid={`sport-card-${sport}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{sport}</span>
                        <Badge className={`${getGradeColor(grade)} text-white`}>
                          Grade {grade}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Response Time: {Math.round(responseTime)}ms
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Requests</span>
                        <span className="font-semibold">{totalRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Alerts</span>
                        <span className="font-semibold">{totalAlerts.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Cache Hit Rate</span>
                        <span className="font-semibold">{Math.round(cacheHitRate)}%</span>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">Sub-250ms Target</span>
                          {responseTime < 250 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <Progress value={Math.min(100, (250 / Math.max(responseTime, 1)) * 100)} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="v3-achievements" className="space-y-6">
            {/* V3 Achievements */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                  V3 Performance Achievements
                </CardTitle>
                <CardDescription>
                  Sub-250ms response time targets across all sports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {v3Metrics.v3Achievements.sub250msTargets.map((achievement) => (
                    <div key={achievement.sport} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {achievement.achieved ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <Clock className="w-6 h-6 text-yellow-500" />
                        )}
                        <div>
                          <div className="font-semibold">{achievement.sport}</div>
                          <div className="text-sm text-slate-400">
                            Target: {achievement.target}ms
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {Math.round(achievement.responseTime)}ms
                        </div>
                        <div className={`text-sm ${
                          achievement.achieved ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {achievement.achieved ? 'Achieved' : 'In Progress'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Grades */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                  Performance Grades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {v3Metrics.v3Achievements.performanceGrades.map((grade) => (
                    <div key={grade.sport} className="text-center p-4 bg-slate-800 rounded-lg">
                      <div className={`text-2xl font-bold mb-2 ${getGradeColor(grade.grade).replace('bg-', 'text-')}`}>
                        {grade.grade}
                      </div>
                      <div className="font-semibold">{grade.sport}</div>
                      <div className="text-sm text-slate-400">{Math.round(grade.responseTime)}ms</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            {/* Recommendations */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" />
                  Performance Recommendations
                </CardTitle>
                <CardDescription>
                  AI-powered insights to optimize your V3 platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {v3Metrics.recommendations.length > 0 ? (
                  <ul className="space-y-3">
                    {v3Metrics.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start space-x-3 p-3 bg-slate-800 rounded-lg">
                        <Eye className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-200">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-400 mb-2">
                      Excellent Performance!
                    </h3>
                    <p className="text-slate-400">
                      Your V3 platform is running optimally with no recommendations at this time.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}