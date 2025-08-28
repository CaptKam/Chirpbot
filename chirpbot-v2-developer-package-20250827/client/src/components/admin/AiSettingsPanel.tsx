import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  AlertCircle, 
  Save, 
  RefreshCw, 
  Power, 
  Zap, 
  Shield,
  Brain,
  Settings2,
  Code,
  ToggleLeft,
  ToggleRight,
  Activity,
  Database,
  FileCode
} from "lucide-react";

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
  maxTokens: number;
  temperature: number;
  customPrompt?: string;
  alertLogic?: string;
  updatedAt: string;
  updatedBy: string;
}

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

const ALERT_TYPES = {
  MLB: [
    "starBatter", "powerHitter", "eliteClutch", "avgHitter", "rbiMachine",
    "runnersOnBase", "inningChange", "closeGame", "lateInning"
  ],
  NFL: [
    "touchdown", "fieldGoal", "turnover", "redZone", "twoMinuteWarning",
    "overtime", "bigPlay", "fourthDown"
  ],
  NBA: [
    "clutchShot", "threePointer", "dunk", "fastBreak", "comeback",
    "overtime", "finalMinute", "starPlayer"
  ],
  NHL: [
    "goal", "powerPlay", "penalty", "overtime", "shootout",
    "hatTrick", "fight", "emptyNet"
  ]
};

const AI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Most Capable)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Efficient)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Legacy)" }
];

export function AiSettingsPanel() {
  const [selectedSport, setSelectedSport] = useState<string>("MLB");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [alertLogic, setAlertLogic] = useState<string>("");
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AiSettings>({
    queryKey: [`/api/admin/ai-settings/${selectedSport}`],
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AiSettings>) => {
      const response = await fetch(`/api/admin/ai-settings/${selectedSport}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/ai-settings/${selectedSport}`] });
      toast({
        title: "Settings Updated",
        description: `AI settings for ${selectedSport} have been saved successfully.`,
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

  const handleToggle = (field: keyof AiSettings, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  const handleSliderChange = (field: keyof AiSettings, value: number[]) => {
    updateMutation.mutate({ [field]: value[0] });
  };

  const handleTextChange = (field: keyof AiSettings, value: string) => {
    updateMutation.mutate({ [field]: value });
  };

  const handleAlertTypeToggle = (alertType: string) => {
    if (!settings) return;
    const currentTypes = settings.allowTypes || [];
    const newTypes = currentTypes.includes(alertType)
      ? currentTypes.filter(t => t !== alertType)
      : [...currentTypes, alertType];
    updateMutation.mutate({ allowTypes: newTypes });
  };

  const handleSaveCustomPrompt = () => {
    updateMutation.mutate({ customPrompt });
  };

  const handleSaveAlertLogic = () => {
    updateMutation.mutate({ alertLogic });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sport Selector */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AI Control Center</h2>
              <p className="text-muted-foreground">Complete system control and configuration</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              {SPORTS.map((sport) => (
                <Button
                  key={sport}
                  variant={selectedSport === sport ? "default" : "outline"}
                  size="lg"
                  onClick={() => setSelectedSport(sport)}
                  className="min-w-[80px]"
                >
                  {sport}
                </Button>
              ))}
            </div>
            <Badge 
              variant={settings?.enabled ? "default" : "secondary"} 
              className="text-lg px-4 py-2"
            >
              {settings?.enabled ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-pulse" />
                  ACTIVE
                </>
              ) : "INACTIVE"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Master Controls */}
        <Card className="border-2 border-blue-200 dark:border-blue-900">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Power className="h-5 w-5 text-blue-600" />
                <CardTitle>Master Controls</CardTitle>
              </div>
              {settings?.enabled && <Activity className="h-4 w-4 text-green-500 animate-pulse" />}
            </div>
            <CardDescription>Core AI system configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* System Enable */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
              <div className="space-y-1">
                <Label className="text-base font-semibold flex items-center">
                  <Power className="h-4 w-4 mr-2" />
                  System Enabled
                </Label>
                <span className="text-sm text-muted-foreground">
                  Master switch for {selectedSport} AI alerts
                </span>
              </div>
              <Switch
                checked={settings?.enabled || false}
                onCheckedChange={(checked) => handleToggle("enabled", checked)}
                className="scale-125"
              />
            </div>

            {/* Dry Run Mode */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-base font-semibold">Dry Run Mode</Label>
                <span className="text-sm text-muted-foreground">
                  Test without sending real alerts
                </span>
              </div>
              <Switch
                checked={settings?.dryRun || false}
                onCheckedChange={(checked) => handleToggle("dryRun", checked)}
              />
            </div>

            {/* PII Redaction */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  <Shield className="inline h-4 w-4 mr-1" />
                  Redact PII
                </Label>
                <span className="text-sm text-muted-foreground">
                  Remove personal information from alerts
                </span>
              </div>
              <Switch
                checked={settings?.redactPii || false}
                onCheckedChange={(checked) => handleToggle("redactPii", checked)}
              />
            </div>

            {/* Rate Limit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  <Zap className="inline h-4 w-4 mr-1" />
                  Rate Limit
                </Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {settings?.rateLimitMs ? (settings.rateLimitMs / 1000) : 30}s
                </span>
              </div>
              <Slider
                value={[(settings?.rateLimitMs || 30000) / 1000]}
                onValueChange={(value) => handleSliderChange("rateLimitMs", value.map(v => v * 1000))}
                min={5}
                max={120}
                step={5}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                Minimum time between alerts (5s - 120s)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* AI Model Configuration */}
        <Card className="border-2 border-purple-200 dark:border-purple-900">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <CardTitle>AI Model Configuration</CardTitle>
            </div>
            <CardDescription>Fine-tune AI behavior and responses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Model Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">AI Model</Label>
              <Select
                value={settings?.model || "gpt-4o-mini"}
                onValueChange={(value) => handleTextChange("model", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Creativity</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {((settings?.temperature || 70) / 100).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[settings?.temperature || 70]}
                onValueChange={(value) => handleSliderChange("temperature", value)}
                min={0}
                max={100}
                step={10}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                0 = Deterministic, 1 = Creative
              </span>
            </div>

            {/* Max Tokens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Response Length</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {settings?.maxTokens || 500} tokens
                </span>
              </div>
              <Slider
                value={[settings?.maxTokens || 500]}
                onValueChange={(value) => handleSliderChange("maxTokens", value)}
                min={100}
                max={2000}
                step={100}
                className="w-full"
              />
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Min Confidence</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {settings?.minProbability || 65}%
                </span>
              </div>
              <Slider
                value={[settings?.minProbability || 65]}
                onValueChange={(value) => handleSliderChange("minProbability", value)}
                min={30}
                max={95}
                step={5}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                Minimum confidence for alert generation
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Types Configuration */}
      <Card className="border-2 border-green-200 dark:border-green-900">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
          <div className="flex items-center space-x-2">
            <Settings2 className="h-5 w-5 text-green-600" />
            <CardTitle>Alert Types Control</CardTitle>
          </div>
          <CardDescription>
            Enable or disable specific alert types for {selectedSport}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ALERT_TYPES[selectedSport as keyof typeof ALERT_TYPES]?.map((type) => (
              <div
                key={type}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  settings?.allowTypes?.includes(type)
                    ? "bg-green-50 dark:bg-green-950 border-green-500"
                    : "bg-muted/30 border-muted"
                }`}
                onClick={() => handleAlertTypeToggle(type)}
              >
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium cursor-pointer">
                    {type.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  {settings?.allowTypes?.includes(type) ? (
                    <ToggleRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Logic & Prompts */}
      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950">
          <div className="flex items-center space-x-2">
            <Code className="h-5 w-5 text-orange-600" />
            <CardTitle>Custom Alert Logic & Prompts</CardTitle>
          </div>
          <CardDescription>
            Advanced customization for alert generation and processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prompt">
                <FileCode className="h-4 w-4 mr-2" />
                Custom Prompt
              </TabsTrigger>
              <TabsTrigger value="logic">
                <Code className="h-4 w-4 mr-2" />
                Alert Logic
              </TabsTrigger>
              <TabsTrigger value="database">
                <Database className="h-4 w-4 mr-2" />
                Data Rules
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="prompt" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  AI System Prompt Override
                </Label>
                <Textarea
                  placeholder="Enter custom instructions for AI alert generation...
Example:
You are a sports analyst AI. Focus on high-impact moments and provide exciting, engaging commentary. Always include player names and statistics when available."
                  className="min-h-[200px] font-mono text-sm"
                  value={customPrompt || settings?.customPrompt || ""}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  Override the default AI prompt with custom instructions
                </span>
              </div>
              <Button 
                onClick={handleSaveCustomPrompt}
                className="w-full"
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Custom Prompt
              </Button>
            </TabsContent>
            
            <TabsContent value="logic" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Alert Generation Rules
                </Label>
                <Textarea
                  placeholder="Define custom logic for when alerts should be triggered...
Example:
if (game.inning >= 7 && Math.abs(game.homeScore - game.awayScore) <= 2) {
  // Close game in late innings
  return { shouldAlert: true, priority: 'high' };
}"
                  className="min-h-[200px] font-mono text-sm"
                  value={alertLogic || settings?.alertLogic || ""}
                  onChange={(e) => setAlertLogic(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  Custom JavaScript-like logic for alert conditions
                </span>
              </div>
              <Button 
                onClick={handleSaveAlertLogic}
                className="w-full"
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Alert Logic
              </Button>
            </TabsContent>

            <TabsContent value="database" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Data Processing Rules
                </Label>
                <Textarea
                  placeholder="Define rules for data filtering and processing...
Example:
- Only process games with attendance > 10000
- Exclude preseason games
- Priority to nationally televised games"
                  className="min-h-[200px] font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  Define how game data should be filtered and processed
                </span>
              </div>
              <Button className="w-full" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Data Rules
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status & Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="font-mono text-sm flex items-center">
                {settings?.enabled ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                    Active
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-gray-400 rounded-full mr-2" />
                    Inactive
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mode</p>
              <p className="font-mono text-sm">
                {settings?.dryRun ? "Dry Run" : "Production"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-mono text-sm">
                {settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "Never"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Active Alerts</p>
              <p className="font-mono text-sm">
                {settings?.allowTypes?.length || 0} types
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}