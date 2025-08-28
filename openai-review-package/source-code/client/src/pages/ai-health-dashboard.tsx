import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, Zap, TrendingUp } from 'lucide-react';

interface AIHealthMetrics {
  isHealthy: boolean;
  isReady: boolean;
  lastSuccessfulCall: number;
  failureCount: number;
  averageLatency: number;
  cpuUsage: number;
  memoryUsage: number;
  openaiStatus: 'healthy' | 'degraded' | 'unavailable';
  degradedMode: boolean;
  lastError?: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
}

interface HealthCheck {
  timestamp: number;
  latency: number;
  success: boolean;
  error?: string;
}

interface AIHealthResponse {
  metrics: AIHealthMetrics;
  recentHistory: HealthCheck[];
  summary: {
    successRate: string;
    averageLatency: string;
    uptime: string;
  };
}

export default function AIHealthDashboard() {
  const [healthData, setHealthData] = useState<AIHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/ai/health/metrics', {
        headers: {
          'x-internal-request': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-3xl font-bold">AI Health Monitor</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="text-muted-foreground">Loading health metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !healthData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-3xl font-bold">AI Health Monitor</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Failed to load health data: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, recentHistory, summary } = healthData;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (isHealthy: boolean, isReady: boolean) => {
    if (isHealthy && isReady) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (!isHealthy) return <XCircle className="h-5 w-5 text-red-600" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  };

  return (
    <div className="p-6 space-y-6" data-testid="ai-health-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-3xl font-bold">AI Health Monitor</h1>
        </div>
        <button 
          onClick={fetchHealthData}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          data-testid="refresh-button"
        >
          <Activity className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              {getStatusIcon(metrics.isHealthy, metrics.isReady)}
              <span className="font-semibold">
                {metrics.isHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(metrics.openaiStatus)}>
                {metrics.openaiStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">OpenAI Status</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">{summary.averageLatency}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Avg Latency</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="font-semibold">{summary.successRate}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>System Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Memory Usage</span>
                <span>{metrics.memoryUsage}%</span>
              </div>
              <Progress value={metrics.memoryUsage} className="mt-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-semibold">{summary.uptime}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failure Count</p>
                <p className="font-semibold">{metrics.failureCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>API Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Requests</p>
                <p className="font-semibold">{metrics.totalRequests}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Successful</p>
                <p className="font-semibold">{metrics.successfulRequests}</p>
              </div>
            </div>
            
            <div>
              <p className="text-muted-foreground text-sm">Last Successful Call</p>
              <p className="font-semibold">
                {metrics.lastSuccessfulCall ? 
                  new Date(metrics.lastSuccessfulCall).toLocaleString() : 
                  'Never'
                }
              </p>
            </div>

            {metrics.degradedMode && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Degraded Mode</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  AI features are temporarily disabled due to health issues.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Health Checks</CardTitle>
          <CardDescription>Last 10 health check results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No health check history available</p>
            ) : (
              recentHistory.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {check.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {new Date(check.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    {check.success && (
                      <span className="text-muted-foreground">{check.latency}ms</span>
                    )}
                    {check.error && (
                      <span className="text-red-600 max-w-xs truncate">{check.error}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {metrics.lastError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Last Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono bg-red-50 p-3 rounded-lg border">
              {metrics.lastError}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}