import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud, Calendar as CalendarIcon } from "lucide-react";
import type { GameData, MonitoredTeam } from "@shared/schema";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

export default function Calendar() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [monitoredTeams, setMonitoredTeams] = useState<Record<string, boolean>>({});

  // Load monitored teams from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('chirpbot_monitored_teams');
    if (saved) {
      try {
        setMonitoredTeams(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load monitored teams from localStorage:', error);
      }
    }
  }, []);

  // Save monitored teams to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chirpbot_monitored_teams', JSON.stringify(monitoredTeams));
  }, [monitoredTeams]);

  // Fetch today's games
  const { data: games = [], isLoading: gamesLoading } = useQuery<GameData[]>({
    queryKey: ["/api/games", { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch games");
      return response.json();
    },
  });

  // Fetch teams for monitoring toggles
  const { data: teams = [], isLoading: teamsLoading } = useQuery<MonitoredTeam[]>({
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

  const toggleTeamMonitoring = (teamName: string, monitored: boolean) => {
    setMonitoredTeams(prev => ({
      ...prev,
      [teamName]: monitored
    }));
  };

  const isLoading = gamesLoading || teamsLoading;
  const filteredGames = games.filter(game => game.sport === activeSport);
  const monitoredCount = Object.values(monitoredTeams).filter(Boolean).length;

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

  const formatGameTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case 'live':
        return { label: "Live", icon: Play, color: "bg-green-100 text-green-800" };
      case 'final':
        return { label: "Final", icon: Clock, color: "bg-gray-100 text-gray-800" };
      case 'postponed':
        return { label: "Postponed", icon: Clock, color: "bg-yellow-100 text-yellow-800" };
      default:
        return { label: "Scheduled", icon: Clock, color: "bg-blue-100 text-blue-800" };
    }
  };

  const getTeamInfo = (teamName: string) => {
    // Find team in our database or use defaults
    const team = teams.find(t => t.name === teamName);
    if (team) {
      return { initials: team.initials, logoColor: team.logoColor };
    }
    
    // Generate initials from team name as fallback
    const initials = teamName.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
      
    return { initials, logoColor: '#1D2E5F' };
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

      {/* Today's Games */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-chirp-blue" />
            <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
              Today's Games
            </h2>
          </div>
          <span className="text-sm font-medium text-chirp-dark">
            {filteredGames.length} {activeSport} Games
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
                      <div className="h-4 bg-gray-300 rounded w-48 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-32"></div>
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-gray-300 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="text-chirp-dark">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No {activeSport} games scheduled for today</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredGames.map((game) => {
              const statusInfo = getStatusDisplay(game.status);
              const StatusIcon = statusInfo.icon;
              const homeTeamInfo = getTeamInfo(game.homeTeam);
              const awayTeamInfo = getTeamInfo(game.awayTeam);

              return (
                <Card key={game.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: awayTeamInfo.logoColor }}
                        >
                          {awayTeamInfo.initials}
                        </div>
                        <span className="text-sm font-medium text-chirp-dark">@</span>
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: homeTeamInfo.logoColor }}
                        >
                          {homeTeamInfo.initials}
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-chirp-blue text-sm" data-testid={`game-matchup-${game.id}`}>
                          {game.awayTeam} vs {game.homeTeam}
                        </p>
                        <p className="text-xs text-chirp-dark">{formatGameTime(game.startTime)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Team monitoring toggles */}
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-chirp-dark">Monitor Teams:</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between space-x-4">
                      {/* Away team toggle */}
                      <div className="flex items-center space-x-2 flex-1">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: awayTeamInfo.logoColor }}
                        >
                          {awayTeamInfo.initials}
                        </div>
                        <span className="text-sm text-chirp-dark truncate flex-1">{game.awayTeam}</span>
                        <Switch
                          checked={monitoredTeams[game.awayTeam] || false}
                          onCheckedChange={(monitored) => toggleTeamMonitoring(game.awayTeam, monitored)}
                          data-testid={`team-toggle-${game.awayTeam.replace(/\s+/g, '-').toLowerCase()}`}
                          className="data-[state=checked]:bg-chirp-red"
                        />
                      </div>
                      
                      {/* Home team toggle */}
                      <div className="flex items-center space-x-2 flex-1">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: homeTeamInfo.logoColor }}
                        >
                          {homeTeamInfo.initials}
                        </div>
                        <span className="text-sm text-chirp-dark truncate flex-1">{game.homeTeam}</span>
                        <Switch
                          checked={monitoredTeams[game.homeTeam] || false}
                          onCheckedChange={(monitored) => toggleTeamMonitoring(game.homeTeam, monitored)}
                          data-testid={`team-toggle-${game.homeTeam.replace(/\s+/g, '-').toLowerCase()}`}
                          className="data-[state=checked]:bg-chirp-red"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {game.venue && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-chirp-dark">{game.venue}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Monitor Summary */}
        {monitoredCount > 0 && (
          <Card className="bg-chirp-blue text-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span className="font-bold">Monitoring Active</span>
              </div>
              <span className="text-blue-200 text-sm">
                {monitoredCount} team{monitoredCount !== 1 ? 's' : ''} monitored
              </span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
