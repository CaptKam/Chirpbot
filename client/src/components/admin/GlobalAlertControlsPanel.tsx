import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Settings, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Eye,
  EyeOff,
  Save,
  Activity,
  Zap,
  Target,
  Filter
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface GlobalAlertControl {
  id: string;
  sport: string;
  alertType: string;
  settingKey: string | null;
  enabled: boolean;
  priority: number;
  probability: number;
  description: string;
  adminNotes: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface AlertControlsResponse {
  controls: GlobalAlertControl[];
  totalControls: number;
  enabledControls: number;
  sport: string;
}

const SPORTS = ["ALL", "MLB", "NFL", "NBA", "NHL", "WEATHER"];
const CATEGORIES = ["scoring", "situational", "weather", "prediction"];

const CATEGORY_CONFIG = {
  scoring: { color: "bg-green-100 text-green-800", icon: "🎯", label: "Scoring" },
  situational: { color: "bg-blue-100 text-blue-800", icon: "⚡", label: "Situational" },
  weather: { color: "bg-yellow-100 text-yellow-800", icon: "🌦️", label: "Weather" },
  prediction: { color: "bg-purple-100 text-purple-800", icon: "🔮", label: "AI Prediction" }
};

const SPORT_COLORS = {
  MLB: "bg-orange-100 text-orange-800",
  NFL: "bg-green-100 text-green-800", 
  NBA: "bg-red-100 text-red-800",
  NHL: "bg-blue-100 text-blue-800",
  WEATHER: "bg-yellow-100 text-yellow-800"
};

export function GlobalAlertControlsPanel() {
  const [selectedSport, setSelectedSport] = useState<string>("ALL");
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterEnabled, setFilterEnabled] = useState<string>("ALL");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: controlsData, isLoading } = useQuery<AlertControlsResponse>({
    queryKey: ["/api/admin/alert-controls", { sport: selectedSport === "ALL" ? undefined : selectedSport }],
    refetchInterval: 30000,
  });

  const initializeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/alert-controls/initialize", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initialize");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alert-controls"] });
      toast({
        title: "Initialization Complete",
        description: "Global alert controls have been initialized with all current alert types.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Initialization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-initialize on first load if no controls exist
  useEffect(() => {
    if (controlsData && controlsData.totalControls === 0 && !initializeMutation.isPending) {
      console.log("Auto-initializing global alert controls...");
      initializeMutation.mutate();
    }
  }, [controlsData, initializeMutation]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await fetch(`/api/admin/alert-controls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alert-controls"] });
      toast({
        title: "Control Updated",
        description: "Alert control has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleControlEnabled = (id: string, enabled: boolean) => {
    updateMutation.mutate({ id, updates: { enabled } });
  };

  const updateControlPriority = (id: string, priority: number) => {
    updateMutation.mutate({ id, updates: { priority } });
  };

  const updateControlProbability = (id: string, probability: number) => {
    updateMutation.mutate({ id, updates: { probability } });
  };

  const updateControlNotes = (id: string, adminNotes: string) => {
    updateMutation.mutate({ id, updates: { adminNotes } });
  };

  const toggleExpanded = (controlId: string) => {
    const newExpanded = new Set(expandedControls);
    if (newExpanded.has(controlId)) {
      newExpanded.delete(controlId);
    } else {
      newExpanded.add(controlId);
    }
    setExpandedControls(newExpanded);
  };

  const filteredControls = controlsData?.controls?.filter((control) => {
    if (filterCategory !== "ALL" && control.category !== filterCategory) return false;
    if (filterEnabled === "ENABLED" && !control.enabled) return false;
    if (filterEnabled === "DISABLED" && control.enabled) return false;
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading alert controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
            <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Global Alert Master Controls</h2>
            <p className="text-muted-foreground">Centralized management of all alert types across all sports engines</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="text-red-600 border-red-600">
            Admin Only
          </Badge>
          <Button
            onClick={() => initializeMutation.mutate()}
            disabled={initializeMutation.isPending}
            variant="outline"
            size="sm"
          >
            {initializeMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            Initialize Controls
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {controlsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Controls</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold">{controlsData.totalControls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enabled</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-green-600">{controlsData.enabledControls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Disabled</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-red-600">{controlsData.totalControls - controlsData.enabledControls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Sport</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold">{controlsData.sport.toUpperCase()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters & Controls</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Sport Filter */}
            <div className="space-y-2">
              <Label>Sport</Label>
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                data-testid="select-sport-filter"
              >
                {SPORTS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                data-testid="select-category-filter"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.label || category}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={filterEnabled}
                onChange={(e) => setFilterEnabled(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                data-testid="select-status-filter"
              >
                <option value="ALL">All Status</option>
                <option value="ENABLED">Enabled Only</option>
                <option value="DISABLED">Disabled Only</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="space-y-2">
              <Label>Results</Label>
              <div className="p-2 bg-muted rounded-md">
                <span className="text-sm font-medium">{filteredControls.length} controls</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Controls List */}
      <div className="space-y-4">
        {filteredControls.map((control) => (
          <Card key={control.id} className={`border-l-4 ${control.enabled ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge className={SPORT_COLORS[control.sport as keyof typeof SPORT_COLORS] || "bg-gray-100 text-gray-800"}>
                    {control.sport}
                  </Badge>
                  <Badge className={CATEGORY_CONFIG[control.category as keyof typeof CATEGORY_CONFIG]?.color || "bg-gray-100 text-gray-800"}>
                    {CATEGORY_CONFIG[control.category as keyof typeof CATEGORY_CONFIG]?.icon} {CATEGORY_CONFIG[control.category as keyof typeof CATEGORY_CONFIG]?.label || control.category}
                  </Badge>
                  <div className="flex-1">
                    <h3 className="font-semibold">{control.alertType}</h3>
                    <p className="text-sm text-muted-foreground">{control.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Label className="text-xs">Priority: {control.priority}</Label>
                    <Label className="text-xs">Prob: {control.probability}%</Label>
                  </div>
                  <Switch
                    checked={control.enabled}
                    onCheckedChange={(enabled) => toggleControlEnabled(control.id, enabled)}
                    data-testid={`switch-${control.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(control.id)}
                    data-testid={`button-expand-${control.id}`}
                  >
                    {expandedControls.has(control.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <Collapsible open={expandedControls.has(control.id)}>
              <CollapsibleContent>
                <CardContent className="border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    {/* Priority Control */}
                    <div className="space-y-3">
                      <Label className="flex items-center space-x-2">
                        <Target className="h-4 w-4" />
                        <span>Priority: {control.priority}</span>
                      </Label>
                      <Slider
                        value={[control.priority]}
                        onValueChange={([value]) => updateControlPriority(control.id, value)}
                        min={1}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid={`slider-priority-${control.id}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    {/* Probability Control */}
                    <div className="space-y-3">
                      <Label className="flex items-center space-x-2">
                        <Activity className="h-4 w-4" />
                        <span>Probability: {control.probability}%</span>
                      </Label>
                      <Slider
                        value={[control.probability]}
                        onValueChange={([value]) => updateControlProbability(control.id, value)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid={`slider-probability-${control.id}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Admin Notes */}
                    <div className="md:col-span-2 space-y-3">
                      <Label>Admin Notes</Label>
                      <Textarea
                        value={control.adminNotes || ""}
                        onChange={(e) => updateControlNotes(control.id, e.target.value)}
                        placeholder="Add internal notes about this alert type..."
                        className="w-full"
                        rows={3}
                        data-testid={`textarea-notes-${control.id}`}
                      />
                    </div>

                    {/* Control Metadata */}
                    <div className="md:col-span-2 pt-4 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                        <div>
                          <div className="font-medium">Setting Key</div>
                          <div>{control.settingKey || "N/A"}</div>
                        </div>
                        <div>
                          <div className="font-medium">Updated</div>
                          <div>{new Date(control.updatedAt).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div className="font-medium">Status</div>
                          <div className={control.enabled ? "text-green-600" : "text-red-600"}>
                            {control.enabled ? "Active" : "Inactive"}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Control ID</div>
                          <div className="font-mono">{control.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {filteredControls.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No alert controls found</p>
              <p className="text-muted-foreground mb-4">
                {controlsData?.totalControls === 0 
                  ? "Initialize the global alert controls to get started." 
                  : "Try adjusting your filters to see more results."
                }
              </p>
              {controlsData?.totalControls === 0 && (
                <Button 
                  onClick={() => initializeMutation.mutate()}
                  disabled={initializeMutation.isPending}
                >
                  {initializeMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Initialize Alert Controls
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}