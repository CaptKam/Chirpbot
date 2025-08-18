import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud, CheckCircle } from "lucide-react";
import type { Game, GameDay } from "@shared/schema";

const SPORTS = ["MLB", "NFL", "NBA", "NHL"];

export default function Calendar() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  const { data: gamesData, isLoading } = useQuery<GameDay>({
    queryKey: ["/api/games/today", { sport: activeSport }],
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

  const games = gamesData?.games || [];

  const toggleGameSelection = (gameId: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
    
    // Here we could sync with team monitoring if needed
    // For now, we'll just track game selections
  };

  const selectedCount = selectedGames.size;

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
            Today's Games
          </h2>
          <span className="text-sm font-medium text-chirp-dark">
            {selectedCount}/{games.length} Selected
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[140px] animate-pulse">
                {/* Header skeleton */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      <div className="w-4 h-4 bg-gray-300 rounded"></div>
                      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                    </div>
                  </div>
                  <div className="w-16 h-6 bg-gray-300 rounded-full"></div>
                </div>
                
                {/* Team names skeleton */}
                <div className="mb-3">
                  <div className="h-5 bg-gray-300 rounded w-48 mb-1"></div>
                </div>
                
                {/* Bottom info skeleton */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-20 h-7 bg-gray-300 rounded-full"></div>
                    <div className="w-16 h-7 bg-gray-300 rounded-full"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-5 bg-gray-300 rounded w-16 mb-1"></div>
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-8 text-chirp-dark">
            <p className="text-lg font-medium">No games scheduled for today</p>
            <p className="text-sm mt-2">Check back later or try a different sport</p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game) => {
              const isSelected = selectedGames.has(game.id);
              const weather = getWeatherData();
              const startTime = new Date(game.startTime);
              const formattedTime = startTime.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              });

              return (
                <Card 
                  key={game.id} 
                  className={`bg-white rounded-xl shadow-sm border cursor-pointer transition-all duration-200 p-6 min-h-[140px] ${
                    isSelected 
                      ? 'border-chirp-red bg-red-50 ring-2 ring-chirp-red ring-opacity-20' 
                      : 'border-gray-100 hover:border-chirp-blue hover:shadow-md'
                  }`}
                  onClick={() => toggleGameSelection(game.id)}
                  data-testid={`game-card-${game.id}`}
                >
                  {/* Header with teams and selection indicator */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-chirp-blue rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm">
                          {game.awayTeam.abbreviation}
                        </div>
                        <span className="text-chirp-dark font-bold text-lg">@</span>
                        <div className="w-12 h-12 bg-chirp-red rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm">
                          {game.homeTeam.abbreviation}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-full text-sm font-bold">
                        {game.sport}
                      </Badge>
                      {isSelected && (
                        <CheckCircle className="w-7 h-7 text-chirp-red" data-testid={`game-selected-${game.id}`} />
                      )}
                    </div>
                  </div>

                  {/* Team names */}
                  <div className="mb-3">
                    <h3 className="font-bold text-chirp-blue text-lg leading-tight" data-testid={`game-title-${game.id}`}>
                      {game.awayTeam.name} @ {game.homeTeam.name}
                    </h3>
                  </div>

                  {/* Game info row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Status badge */}
                      <Badge className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        game.status === 'live' 
                          ? 'bg-green-100 text-green-800' 
                          : game.status === 'final'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {game.status === 'live' && <Play className="w-4 h-4 mr-1.5" />}
                        {game.status === 'scheduled' && <Clock className="w-4 h-4 mr-1.5" />}
                        {game.status === 'live' ? 'LIVE' : game.status.toUpperCase()}
                      </Badge>
                      
                      {/* Weather badge */}
                      <Badge className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium">
                        {getWeatherIcon(weather.condition)}
                        <span className="ml-1.5">{weather.temperature}°F</span>
                      </Badge>
                    </div>
                    
                    {/* Time and venue */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-chirp-blue">
                        {formattedTime}
                      </div>
                      {game.venue && (
                        <div className="text-sm text-chirp-dark font-medium mt-0.5">
                          {game.venue.length > 20 ? `${game.venue.substring(0, 20)}...` : game.venue}
                        </div>
                      )}
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
