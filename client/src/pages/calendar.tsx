import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud } from "lucide-react";
import type { Team } from "@/types";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

export default function Calendar() {
  const [activeSport, setActiveSport] = useState("MLB");

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams", { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
  });

  const toggleMonitoringMutation = useMutation({
    mutationFn: async ({ id, monitored }: { id: string; monitored: boolean }) => {
      const response = await apiRequest("PATCH", `/api/teams/${id}/monitor`, { monitored });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
  });

  const monitoredCount = teams.filter(team => team.monitored).length;

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "sunny":
      case "clear":
        return <Sun className="w-3 h-3" />;
      case "cloudy":
      case "overcast":
        return <Cloud className="w-3 h-3" />;
      case "rain":
      case "rainy":
        return <CloudRain className="w-3 h-3" />;
      default:
        return <Sun className="w-3 h-3" />;
    }
  };

  const getGameStatus = (team: Team) => {
    // Mock game status - in real implementation, this would come from live data
    const statuses = [
      { label: "Live", icon: Play, color: "bg-green-100 text-green-800", detail: "Bottom 7th • 2 outs" },
      { label: "Scheduled", icon: Clock, color: "bg-gray-100 text-gray-800", detail: "Tomorrow 7:10 PM" },
    ];
    
    return team.initials === "LAD" ? statuses[0] : statuses[1];
  };

  const getWeatherData = () => {
    // Mock weather data - in real implementation, this would come from weather API
    return { temperature: 72, condition: "Clear" };
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <header className="bg-chirp-blue text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-chirp-red rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">ChirpBot</h1>
            <p className="text-blue-200 text-xs font-medium">V2 Alert System</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-chirp-red px-3 py-1 rounded-full">
            <span className="text-white text-xs font-bold uppercase tracking-wide">
              <div className="w-1.5 h-1.5 bg-red-300 rounded-full inline-block mr-1 animate-pulse"></div>
              LIVE
            </span>
          </div>
          <Button variant="ghost" size="sm" className="relative p-0 text-white hover:text-gray-200">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-chirp-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </header>

      {/* Sport Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => setActiveSport(sport)}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                activeSport === sport
                  ? "border-chirp-red text-chirp-red"
                  : "border-transparent text-chirp-dark hover:text-chirp-blue"
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      {/* Teams List */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
            Monitor Teams
          </h2>
          <span className="text-sm font-medium text-chirp-dark">
            {monitoredCount}/{teams.length} Active
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => {
              const gameStatus = getGameStatus(team);
              const weather = getWeatherData();
              const StatusIcon = gameStatus.icon;

              return (
                <Card key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: team.logoColor }}
                      >
                        {team.initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-chirp-blue" data-testid={`team-name-${team.id}`}>
                          {team.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${gameStatus.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {gameStatus.label}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {getWeatherIcon(weather.condition)}
                            <span className="ml-1">{weather.temperature}°F</span>
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <Switch
                      checked={team.monitored}
                      onCheckedChange={(monitored) => 
                        toggleMonitoringMutation.mutate({ id: team.id, monitored })
                      }
                      data-testid={`team-toggle-${team.id}`}
                      className="data-[state=checked]:bg-chirp-red"
                    />
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-chirp-dark">
                        {team.initials === "SF" ? "@ Los Angeles Dodgers" : "vs San Francisco Giants"}
                      </span>
                      <span className="font-medium text-chirp-blue" data-testid={`game-status-${team.id}`}>
                        {gameStatus.detail}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
