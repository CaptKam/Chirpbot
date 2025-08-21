import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Brain, Settings, Activity, Users, BarChart3 } from "lucide-react";
import { AiSettingsPanel } from "@/components/admin/AiSettingsPanel";
// import { AiLearningLogsPanel } from "@/components/admin/AiLearningLogsPanel";
// import { AuditLogsPanel } from "@/components/admin/AuditLogsPanel";

interface DashboardStats {
  aiLogs: {
    total: number;
    successful: number;
    withFeedback: number;
    avgConfidence: number;
  };
  byType: Record<string, number>;
  bySport: Record<string, number>;
  recentActivity: Array<{
    id: string;
    action: string;
    resource: string;
    userId: string;
    createdAt: string;
  }>;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Control Panel</h1>
              <p className="text-muted-foreground">AI Alert Management & System Monitoring</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Settings</span>
            </TabsTrigger>
            <TabsTrigger value="ai-logs" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>AI Logs</span>
            </TabsTrigger>
            <TabsTrigger value="audit-logs" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Audit Logs</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {stats && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total AI Interactions</CardTitle>
                      <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.aiLogs.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.aiLogs.successful} successful
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.aiLogs.total > 0 
                          ? Math.round((stats.aiLogs.successful / stats.aiLogs.total) * 100)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AI processing success rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">User Feedback</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.aiLogs.withFeedback}</div>
                      <p className="text-xs text-muted-foreground">
                        Alerts with user ratings
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {Math.round(stats.aiLogs.avgConfidence || 0)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AI confidence score
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Alert Types Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Alert Types Distribution</CardTitle>
                      <CardDescription>Recent AI alert generation by type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(stats.byType).slice(0, 6).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{type}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${Math.min(100, (count / Math.max(...Object.values(stats.byType))) * 100)}%` 
                                  }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sports Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Sports Distribution</CardTitle>
                      <CardDescription>AI alert generation by sport</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(stats.bySport).map(([sport, count]) => (
                          <div key={sport} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{sport}</span>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Admin Activity</CardTitle>
                    <CardDescription>Latest administrative actions in the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{activity.action.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              Resource: {activity.resource} • User: {activity.userId.slice(0, 8)}...
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai-settings">
            <AiSettingsPanel />
          </TabsContent>

          {/* AI Logs Tab */}
          <TabsContent value="ai-logs">
            <Card>
              <CardHeader>
                <CardTitle>AI Learning Logs</CardTitle>
                <CardDescription>Coming soon - View AI decision history</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit-logs">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Coming soon - View admin activity</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}