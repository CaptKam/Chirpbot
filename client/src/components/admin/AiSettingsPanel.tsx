import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AiSettings {
  id: string;
  sport: string;
  enabled: boolean;
  dryRun: boolean;
  rateLimitMs: number;
  minProbability: number;
  inningThreshold: number;
  allowTypes: string[];
  redactPii: boolean;
  model: string;
  maxTokens: number | null;
  temperature: number;
  updatedBy: string | null;
  updatedAt: string;
}

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];
const AI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
const ALERT_TYPES = [
  "Game Start", "7th Inning Warning", "Tie Game 9th Inning", "Close Game",
  "Late Inning Pressure", "Star Batter Alert", "Power Hitter Alert",
  "Elite Hitter in Clutch", "300+ Hitter Alert", "RBI Machine Alert",
  "Runners on Base", "Inning Change", "Weather Alert", "Injury Alert"
];

export function AiSettingsPanel() {
  const [selectedSport, setSelectedSport] = useState<string>("MLB");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AiSettings>({
    queryKey: ["/api/admin/ai-settings", selectedSport],
    enabled: !!selectedSport,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AiSettings>) => {
      return await apiRequest(`/api/admin/ai-settings/${selectedSport}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-settings", selectedSport] });
      toast({
        title: "Settings Updated",
        description: `AI settings for ${selectedSport} have been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update AI settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = (updates: Partial<AiSettings>) => {
    updateSettingsMutation.mutate(updates);
  };

  const handleToggleAlertType = (alertType: string) => {
    if (!settings) return;
    
    const currentTypes = settings.allowTypes || [];
    const newTypes = currentTypes.includes(alertType)
      ? currentTypes.filter(type => type !== alertType)
      : [...currentTypes, alertType];
    
    handleSaveSettings({ allowTypes: newTypes });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Configuration</h2>
            <p className="text-muted-foreground">Manage AI alert generation settings per sport</p>
          </div>
        </div>
        
        <Select value={selectedSport} onValueChange={setSelectedSport}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map((sport) => (
              <SelectItem key={sport} value={sport}>{sport}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>General Settings</span>
                {settings.dryRun && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Dry Run
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Basic AI processing configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable AI */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Processing Enabled</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable AI enhancement for {selectedSport} alerts
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => handleSaveSettings({ enabled })}
                  data-testid="switch-ai-enabled"
                />
              </div>

              {/* Dry Run Mode */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dry Run Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Test AI without actually sending alerts
                  </p>
                </div>
                <Switch
                  checked={settings.dryRun}
                  onCheckedChange={(dryRun) => handleSaveSettings({ dryRun })}
                  data-testid="switch-dry-run"
                />
              </div>

              {/* PII Redaction */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Redact Personal Info</Label>
                  <p className="text-sm text-muted-foreground">
                    Remove sensitive data from AI prompts
                  </p>
                </div>
                <Switch
                  checked={settings.redactPii}
                  onCheckedChange={(redactPii) => handleSaveSettings({ redactPii })}
                  data-testid="switch-redact-pii"
                />
              </div>

              {/* Rate Limit */}
              <div className="space-y-2">
                <Label>Rate Limit (seconds)</Label>
                <div className="flex items-center space-x-3">
                  <Slider
                    value={[settings.rateLimitMs / 1000]}
                    onValueChange={([value]) => handleSaveSettings({ rateLimitMs: value * 1000 })}
                    max={300}
                    min={5}
                    step={5}
                    className="flex-1"
                    data-testid="slider-rate-limit"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {settings.rateLimitMs / 1000}s
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Minimum time between AI processing requests
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Model Settings */}
          <Card>
            <CardHeader>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>AI processing parameters and thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label>AI Model</Label>
                <Select 
                  value={settings.model} 
                  onValueChange={(model) => handleSaveSettings({ model })}
                >
                  <SelectTrigger data-testid="select-ai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={settings.maxTokens || 500}
                  onChange={(e) => handleSaveSettings({ maxTokens: parseInt(e.target.value) })}
                  min={100}
                  max={2000}
                  data-testid="input-max-tokens"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum tokens for AI response generation
                </p>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label>Temperature</Label>
                <div className="flex items-center space-x-3">
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={([temperature]) => handleSaveSettings({ temperature })}
                    max={100}
                    min={0}
                    step={5}
                    className="flex-1"
                    data-testid="slider-temperature"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {settings.temperature}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI creativity level (0% = focused, 100% = creative)
                </p>
              </div>

              {/* Confidence Threshold */}
              <div className="space-y-2">
                <Label>Minimum Confidence</Label>
                <div className="flex items-center space-x-3">
                  <Slider
                    value={[settings.minProbability]}
                    onValueChange={([minProbability]) => handleSaveSettings({ minProbability })}
                    max={100}
                    min={30}
                    step={5}
                    className="flex-1"
                    data-testid="slider-min-confidence"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {settings.minProbability}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Minimum AI confidence required to send alerts
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Alert Types */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Allowed Alert Types</CardTitle>
              <CardDescription>
                Configure which types of alerts can be processed by AI for {selectedSport}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ALERT_TYPES.map((alertType) => {
                  const isEnabled = (settings.allowTypes || []).includes(alertType);
                  return (
                    <Button
                      key={alertType}
                      variant={isEnabled ? "default" : "outline"}
                      className="justify-start h-auto p-3 text-left"
                      onClick={() => handleToggleAlertType(alertType)}
                      data-testid={`button-alert-type-${alertType.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-white' : 'bg-muted-foreground'}`} />
                        <span className="text-sm">{alertType}</span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${settings?.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">
                AI Status: {settings?.enabled ? 'Active' : 'Inactive'} for {selectedSport}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Last updated: {settings ? new Date(settings.updatedAt).toLocaleString() : 'Never'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}