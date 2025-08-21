import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Clock, User, Activity, Search, Filter, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  before: any;
  after: any;
  metadata: {
    sport?: string;
    userAgent?: string;
    ip?: string;
    sessionId?: string;
  } | null;
  createdAt: string;
}

const RESOURCES = ["", "ai_settings", "ai_learning_logs", "alerts", "settings", "users", "dashboard"];
const ACTIONS = ["", "view", "update", "create", "delete", "login", "logout"];

export function AuditLogsPanel() {
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs", { 
      resource: selectedResource, 
      userId: selectedUserId, 
      limit: 100 
    }],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getActionColor = (action: string) => {
    if (action.includes('view') || action.includes('read')) return "text-blue-600";
    if (action.includes('update') || action.includes('patch')) return "text-yellow-600";
    if (action.includes('create') || action.includes('post')) return "text-green-600";
    if (action.includes('delete')) return "text-red-600";
    return "text-gray-600";
  };

  const getActionIcon = (action: string) => {
    if (action.includes('view') || action.includes('read')) return "👁️";
    if (action.includes('update') || action.includes('patch')) return "✏️";
    if (action.includes('create') || action.includes('post')) return "➕";
    if (action.includes('delete')) return "🗑️";
    if (action.includes('login')) return "🔑";
    if (action.includes('logout')) return "🚪";
    return "⚡";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Audit Logs</h2>
            <p className="text-muted-foreground">Track administrative actions and system access</p>
          </div>
        </div>
        
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          Admin Only
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Filter Audit Logs</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Resource</Label>
              <Select value={selectedResource} onValueChange={setSelectedResource}>
                <SelectTrigger data-testid="select-filter-resource">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCES.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource || "All Resources"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Filter by user ID..."
                data-testid="input-filter-user-id"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedResource("");
                  setSelectedUserId("");
                }}
                className="w-full"
                data-testid="button-clear-audit-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-2">
        {logs?.map((log) => (
          <Card key={log.id} className="transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  {/* Action Icon */}
                  <div className="flex-shrink-0">
                    <span className="text-lg">{getActionIcon(log.action)}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <Badge variant="secondary">{log.resource}</Badge>
                      {log.metadata?.sport && (
                        <Badge variant="outline">{log.metadata.sport}</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>{log.userId.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      {log.resourceId && (
                        <span>ID: {log.resourceId.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`button-view-audit-${log.id}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Audit Log Details</DialogTitle>
                        <DialogDescription>
                          {log.action} • {log.resource} • {new Date(log.createdAt).toLocaleString()}
                        </DialogDescription>
                      </DialogHeader>
                      
                      {selectedLog && (
                        <ScrollArea className="max-h-[60vh]">
                          <div className="space-y-6 p-1">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">User ID</Label>
                                <p className="text-sm font-mono">{selectedLog.userId}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Action</Label>
                                <p className="text-sm">{selectedLog.action.replace(/_/g, ' ')}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Resource</Label>
                                <p className="text-sm">{selectedLog.resource}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Timestamp</Label>
                                <p className="text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                              </div>
                            </div>

                            {/* Metadata */}
                            {selectedLog.metadata && (
                              <div>
                                <Label className="text-sm font-medium">Metadata</Label>
                                <div className="mt-2 bg-muted p-3 rounded-lg">
                                  <pre className="text-xs whitespace-pre-wrap">
                                    {JSON.stringify(selectedLog.metadata, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Before/After Changes */}
                            {(selectedLog.before || selectedLog.after) && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {selectedLog.before && (
                                  <div>
                                    <Label className="text-sm font-medium">Before</Label>
                                    <div className="mt-2 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                                      <pre className="text-xs whitespace-pre-wrap">
                                        {JSON.stringify(selectedLog.before, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedLog.after && (
                                  <div>
                                    <Label className="text-sm font-medium">After</Label>
                                    <div className="mt-2 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                                      <pre className="text-xs whitespace-pre-wrap">
                                        {JSON.stringify(selectedLog.after, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {logs?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <Shield className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">No audit logs found</h3>
                  <p className="text-sm text-muted-foreground">
                    Administrative actions will be logged and displayed here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}