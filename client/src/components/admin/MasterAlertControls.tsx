import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, AlertCircle, CheckCircle, Activity, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MasterAlertControl {
  id: string;
  alertKey: string;
  sport: string;
  enabled: boolean;
  displayName: string;
  description: string;
  category: string;
  updatedAt: string;
  updatedBy?: string;
}

const SPORTS = ["MLB", "NFL", "NBA", "NHL"] as const;

export default function MasterAlertControls() {
  const [activeSport, setActiveSport] = useState<string>("MLB");
  const { toast } = useToast();

  // Fetch master alert controls
  const { data: controls, isLoading } = useQuery<MasterAlertControl[]>({
    queryKey: ["/api/admin/master-alert-controls", { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await apiRequest("GET", `${url}?${searchParams}`);
      return response.json();
    },
  });

  // Update master alert control
  const updateControlMutation = useMutation({
    mutationFn: async ({ alertKey, sport, updates }: { 
      alertKey: string; 
      sport: string; 
      updates: { enabled: boolean } 
    }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/admin/master-alert-controls/${sport}/${alertKey}`, 
        updates
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-alert-controls"] });
      toast({
        title: "Alert Control Updated",
        description: "Master alert control has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update master alert control. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = async (alertKey: string, sport: string, enabled: boolean) => {
    updateControlMutation.mutate({
      alertKey,
      sport,
      updates: { enabled },
    });
  };

  // Group controls by category
  const controlsByCategory = controls?.reduce((acc, control) => {
    const category = control.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(control);
    return acc;
  }, {} as Record<string, MasterAlertControl[]>) || {};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Game Situations": return Activity;
      case "Scoring Events": return CheckCircle;
      case "Player Performance": return Shield;
      case "AI Predictions": return AlertCircle;
      case "Special Events": return Settings2;
      default: return AlertCircle;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Game Situations": return "text-blue-600 bg-blue-50 border-blue-200";
      case "Scoring Events": return "text-green-600 bg-green-50 border-green-200";
      case "Player Performance": return "text-purple-600 bg-purple-50 border-purple-200";
      case "AI Predictions": return "text-orange-600 bg-orange-50 border-orange-200";
      case "Special Events": return "text-pink-600 bg-pink-50 border-pink-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const enabledCount = controls?.filter(c => c.enabled).length || 0;
  const totalCount = controls?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master Alert Controls</h2>
          <p className="text-muted-foreground">
            Control which alert types are available to users across the platform
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            {enabledCount} of {totalCount} enabled
          </Badge>
          <div className="text-sm text-muted-foreground">
            Global visibility controls
          </div>
        </div>
      </div>

      {/* Sport Selector */}
      <div className="flex space-x-2">
        {SPORTS.map((sport) => (
          <Button
            key={sport}
            variant={activeSport === sport ? "default" : "outline"}
            onClick={() => setActiveSport(sport)}
            className="h-9 px-3"
            data-testid={`button-sport-${sport.toLowerCase()}`}
          >
            {sport}
          </Button>
        ))}
      </div>

      <Separator />

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading alert controls...</div>
        </div>
      )}

      {/* Alert Controls by Category */}
      {!isLoading && (
        <div className="space-y-6">
          {Object.entries(controlsByCategory).map(([category, categoryControls]) => {
            const CategoryIcon = getCategoryIcon(category);
            const categoryColorClass = getCategoryColor(category);
            
            return (
              <Card key={category} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CategoryIcon className="w-5 h-5" />
                    {category}
                    <Badge 
                      variant="secondary" 
                      className={`ml-2 ${categoryColorClass}`}
                    >
                      {categoryControls.filter(c => c.enabled).length} of {categoryControls.length} enabled
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categoryControls.map((control) => (
                    <div 
                      key={control.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/25 transition-colors"
                      data-testid={`control-${control.sport.toLowerCase()}-${control.alertKey}`}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{control.displayName}</h4>
                          <Badge 
                            variant={control.enabled ? "default" : "secondary"}
                            className={control.enabled ? "bg-green-500" : ""}
                          >
                            {control.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {control.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Key: {control.alertKey}</span>
                          {control.updatedAt && (
                            <span>Last updated: {new Date(control.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={control.enabled}
                          onCheckedChange={(enabled) => handleToggle(control.alertKey, control.sport, enabled)}
                          disabled={updateControlMutation.isPending}
                          data-testid={`switch-${control.sport.toLowerCase()}-${control.alertKey}`}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && controls?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Alert Controls Found</h3>
            <p className="text-muted-foreground">
              No master alert controls are configured for {activeSport}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">
                How Master Alert Controls Work
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                Master alert controls determine which alert types are globally available to users. 
                When disabled here, users cannot enable these alerts in their personal settings, 
                regardless of their individual preferences. This provides platform-wide control 
                over alert visibility while maintaining the hierarchical preference system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}