import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud, Trophy, Calendar as CalendarIcon } from "lucide-react";
import type { Team } from "@/types";

// Real game data interfaces
interface RealGame {
  id: string;
  sport: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    color: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    color: string;
  };
  venue?: {
    name: string;
    city: string;
    state: string;
  };
  gameTime: string;
  status: {
    display: string;
    isLive: boolean;
    isCompleted: boolean;
    type: string;
  };
  matchup: string;
}

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

export default function Calendar() {
  const [activeSport, setActiveSport] = useState("MLB");

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
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

  // Fetch real games for today
  const { data: todaysGames = [], isLoading: gamesLoading } = useQuery<RealGame[]>({
    queryKey: ["/api/sports/games/today", { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch today's games");
      const data = await response.json();
      return data.games || [];
    },
  });

  // Fetch all sports games for summary
  const { data: allGames } = useQuery({
    queryKey: ["/api/sports/games/today/all"],
    queryFn: async () => {
      const response = await fetch("/api/sports/games/today/all", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch all games");
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

  // Find real game for a team
  const findTeamGame = (team: Team): RealGame | null => {
    return todaysGames.find(game => 
      game.homeTeam.name.toLowerCase().includes(team.name.toLowerCase()) ||
      game.awayTeam.name.toLowerCase().includes(team.name.toLowerCase()) ||
      game.homeTeam.abbreviation === team.initials ||
      game.awayTeam.abbreviation === team.initials
    ) || null;
  };

  const getGameStatusFromReal = (game: RealGame | null) => {
    if (!game) {
      return { label: "No Game", icon: CalendarIcon, color: "bg-gray-100 text-gray-600", detail: "No games today" };
    }

    if (game.status.isLive) {
      return { 
        label: "Live", 
        icon: Play, 
        color: "bg-green-100 text-green-800", 
        detail: `${game.status.display} • ${game.homeTeam.score}-${game.awayTeam.score}` 
      };
    }
    
    if (game.status.isCompleted) {
      return { 
        label: "Final", 
        icon: Trophy, 
        color: "bg-blue-100 text-blue-800", 
        detail: `Final • ${game.homeTeam.score}-${game.awayTeam.score}` 
      };
    }

    const gameTime = new Date(game.gameTime);
    const timeString = gameTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    return { 
      label: "Scheduled", 
      icon: Clock, 
      color: "bg-gray-100 text-gray-800", 
      detail: `Today ${timeString}` 
    };
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

        {teamsLoading ? (
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
              const teamGame = findTeamGame(team);
              const gameStatus = getGameStatusFromReal(teamGame);
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
                          {teamGame && (
                            <Badge className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {teamGame.venue ? `${teamGame.venue.city}` : "Unknown"}
                            </Badge>
                          )}
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
                        {teamGame ? teamGame.matchup : "No game scheduled"}
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
        
        {/* Today's Games Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-chirp-blue">
              Today's {activeSport} Games
            </h2>
            <span className="text-sm font-medium text-chirp-dark">
              {todaysGames.length} {todaysGames.length === 1 ? 'Game' : 'Games'}
            </span>
          </div>

          {gamesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-8 bg-gray-300 rounded"></div>
                      <div className="h-4 bg-gray-300 rounded w-32"></div>
                    </div>
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : todaysGames.length === 0 ? (
            <Card className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
              <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <h3 className="font-bold text-chirp-dark mb-2">No {activeSport} Games Today</h3>
              <p className="text-sm text-gray-600">Check back later or switch to another sport.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {todaysGames.map((game) => {
                const gameStatus = getGameStatusFromReal(game);
                const StatusIcon = gameStatus.icon;

                return (
                  <Card key={game.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            {game.awayTeam.abbreviation}
                          </div>
                          <div className="text-lg font-bold text-chirp-blue">
                            {game.awayTeam.score}
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-xs font-medium text-gray-500">vs</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            {game.homeTeam.abbreviation}
                          </div>
                          <div className="text-lg font-bold text-chirp-blue">
                            {game.homeTeam.score}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge className={`px-2 py-1 rounded-full text-xs font-medium mb-1 ${gameStatus.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {gameStatus.label}
                        </Badge>
                        <div className="text-xs text-gray-600">
                          {game.venue ? `${game.venue.city}, ${game.venue.state}` : "Location TBD"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-chirp-dark font-medium">
                          {game.matchup}
                        </span>
                        <span className="text-chirp-blue">
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
    </div>
  );
}
