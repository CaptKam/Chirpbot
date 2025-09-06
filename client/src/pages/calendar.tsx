import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud, CheckCircle, UserPlus, LogOut, Sparkles, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Game, GameDay } from "@shared/schema";
import { TeamLogo } from "@/components/team-logo";
import { GameCardTemplate } from "@/components/GameCardTemplate";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

// Helper functions
const removeCity = (teamName: string) => {
  if (!teamName) return '';
  // Remove city names from team names (e.g., "New York Yankees" -> "Yankees")
  const words = teamName.split(' ');
  return words.length > 1 ? words.slice(-1).join(' ') : teamName;
};

const extractTeamAbbreviation = (teamName: string) => {
  if (!teamName || teamName.trim() === '') return 'TBD';
  
  // Full team name mappings (check these first)
  const fullTeamMappings: Record<string, string> = {
    'San Diego Padres': 'SD',
    'Washington Nationals': 'WSH',
    'Oakland Athletics': 'OAK',
    'Tampa Bay Rays': 'TB',
    'Kansas City Royals': 'KC',
    'Kansas City': 'KC',
    'Royals': 'KC',
    // Add college teams
    'TCU Horned Frogs': 'TCU',
    'North Carolina Tar Heels': 'UNC'
  };
  
  // Check full team name first
  if (fullTeamMappings[teamName]) {
    return fullTeamMappings[teamName];
  }
  
  // Extract abbreviation from team name
  const cityPrefixes = ['New York', 'Los Angeles', 'San Francisco', 'St. Louis', 'Tampa Bay', 'San Diego', 'Washington', 'Kansas City'];
  let cleanName = teamName;
  
  // Remove city prefixes
  for (const prefix of cityPrefixes) {
    if (teamName.startsWith(prefix)) {
      cleanName = teamName.replace(prefix, '').trim();
      break;
    }
  }
  
  // Common team abbreviations
  const abbreviations: Record<string, string> = {
    'Yankees': 'NYY', 'Mets': 'NYM', 'Dodgers': 'LAD', 'Angels': 'LAA',
    'Giants': 'SF', 'Athletics': 'OAK', 'Padres': 'SD', 'Cardinals': 'STL',
    'Cubs': 'CHC', 'White Sox': 'CWS', 'Tigers': 'DET', 'Guardians': 'CLE',
    'Twins': 'MIN', 'Royals': 'KC', 'Astros': 'HOU', 'Rangers': 'TEX',
    'Mariners': 'SEA', 'Red Sox': 'BOS', 'Orioles': 'BAL', 'Blue Jays': 'TOR',
    'Rays': 'TB', 'Marlins': 'MIA', 'Nationals': 'WSH', 'Phillies': 'PHI',
    'Braves': 'ATL', 'Pirates': 'PIT', 'Reds': 'CIN', 'Brewers': 'MIL',
    'Diamondbacks': 'ARI', 'Rockies': 'COL'
  };
  
  return abbreviations[cleanName] || cleanName.slice(0, 3).toUpperCase();
};

import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { SportsLoading, GameCardLoading } from '@/components/sports-loading';
import { BaseballDiamond, WeatherDisplay } from '@/components/baseball-diamond';
import { WeatherImpactVisualizer } from '@/components/WeatherImpactVisualizer';
import { useGamesAvailability } from '@/hooks/useGamesAvailability';

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF", "WNBA"];
const TEST_USER_ID = "test-user-123"; // Fallback user ID

// Enhanced Game Display Component for Live MLB Games
function EnhancedGameDisplay({ gameId, inning, isTopInning, isLive }: { 
  gameId: string; 
  inning: number; 
  isTopInning: boolean; 
  isLive: boolean 
}) {
  const { data: enhancedData } = useQuery({
    queryKey: ['enhanced-game', gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}/live`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch live game data");
      return response.json();
    },
    enabled: isLive,
    refetchInterval: isLive ? 10000 : false, // Refresh every 10s for live games
    staleTime: 8000,
    retry: 3,
    retryDelay: 1000
  });

  return (
    <BaseballDiamond 
      runners={enhancedData?.runners || {
        first: false,
        second: false,
        third: false
      }}
      inning={enhancedData?.inning || inning}
      isTopInning={enhancedData?.isTopInning ?? isTopInning}
      outs={enhancedData?.outs || 0}
      balls={enhancedData?.balls || 0}
      strikes={enhancedData?.strikes || 0}
      size="sm"
      showCount={isLive}
    />
  );
}

// Weather Display Wrapper with real API data
function GameWeatherDisplay({ teamName, size = 'sm' }: { teamName: string; size?: 'sm' | 'md' }) {
  const { data: weather } = useQuery({
    queryKey: ['weather', teamName],
    queryFn: async () => {
      const response = await fetch(`/api/weather/team/${encodeURIComponent(teamName)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Weather fetch failed');
      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 1
  });

  if (!weather) {
    // Show loading state with fallback data
    return (
      <WeatherDisplay 
        windSpeed={5}
        windDirection="N"
        size={size}
      />
    );
  }

  // Convert wind direction degrees to cardinal direction
  const getCardinalDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  return (
    <WeatherDisplay 
      windSpeed={weather.windSpeed}
      windDirection={getCardinalDirection(weather.windDirection)}
      size={size}
    />
  );
}

export default function Calendar() {
  const [activeSport, setActiveSport] = useState("MLB");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { hasGamesWithinTwoDays, hasTomorrowGames } = useGamesAvailability();

  // Fetch today's games
  const { data: todayGamesData, isLoading: isLoadingToday } = useQuery<GameDay>({
    queryKey: ["/api/games/today", { sport: activeSport, date: format(selectedDate, 'yyyy-MM-dd') }],
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

  // Fetch tomorrow's games when there are games within two days
  const { data: tomorrowGamesData, isLoading: isLoadingTomorrow } = useQuery<GameDay>({
    queryKey: ["/api/games/today", { sport: activeSport, date: format(addDays(selectedDate, 1), 'yyyy-MM-dd') }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch games");
      return response.json();
    },
    enabled: hasGamesWithinTwoDays && hasTomorrowGames && isSameDay(selectedDate, new Date()),
  });

  const todayGames = todayGamesData?.games || [];
  const tomorrowGames = tomorrowGamesData?.games || [];
  const games = todayGames; // Keep existing behavior for main games list
  const isLoading = isLoadingToday || (hasGamesWithinTwoDays && hasTomorrowGames && isLoadingTomorrow);

  // Fetch alerts for badge count
  const { data: alerts } = useQuery({
    queryKey: ["/api/alerts", { limit: "10" }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return response.json();
    },
  });


  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });
  


  // Load persisted monitored games
  const userId = user?.id || TEST_USER_ID;
  const { data: monitoredGames, isLoading: isLoadingMonitored } = useQuery({
    queryKey: [`/api/user/${userId}/monitored-games`, { sport: activeSport }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await fetch(`${url}?${searchParams}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch monitored games");
      return response.json();
    },
  });

  // Sync selected games with persisted monitored games
  useEffect(() => {
    if (monitoredGames) {
      const persistedGameIds = new Set<string>(monitoredGames.map((game: any) => game.gameId));
      setSelectedGames(persistedGameIds);
    }
  }, [monitoredGames, activeSport]);

  // Add game monitoring
  const addMonitoringMutation = useMutation({
    mutationFn: async ({ gameId, sport, homeTeamName, awayTeamName }: { 
      gameId: string; 
      sport: string; 
      homeTeamName: string; 
      awayTeamName: string; 
    }) => {
      return apiRequest("POST", `/api/user/${userId}/monitored-games`, { 
        gameId, sport, homeTeamName, awayTeamName 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}/monitored-games`] });
    }
  });

  // Remove game monitoring
  const removeMonitoringMutation = useMutation({
    mutationFn: async (gameId: string) => {
      return apiRequest("DELETE", `/api/user/${userId}/monitored-games/${gameId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}/monitored-games`] });
    }
  });

  const toggleGameSelection = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
      // Remove from database
      removeMonitoringMutation.mutate(gameId);
    } else {
      newSelected.add(gameId);
      // Add to database
      addMonitoringMutation.mutate({
        gameId,
        sport: activeSport,
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name
      });
    }
    setSelectedGames(newSelected);
  };

  // Calculate selected count only for current sport's games
  const selectedCount = games.filter(game => selectedGames.has(game.id)).length;

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


  return (
    <>
      
    
    <div className="pb-20 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 text-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">ChirpBot</h1>
            <p className="text-emerald-300/80 text-xs font-semibold">V2 Alert System</p>
          </div>
        </div>
      </header>

      {/* Sport Tabs */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="flex overflow-x-auto">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => {
                setActiveSport(sport);
                // Clear cache when switching sports to ensure fresh data
                queryClient.invalidateQueries({ queryKey: ["/api/games/today"] });
              }}
              data-testid={`sport-tab-${sport.toLowerCase()}`}
              className={`px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                activeSport === sport
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200"
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
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-black uppercase tracking-wider text-slate-100">
                {isSameDay(selectedDate, new Date()) ? "Today's Games" : format(selectedDate, 'MMMM d, yyyy')}
              </h2>
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 hover:border-emerald-400 transition-all duration-200 font-semibold"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Pick Date
              </Button>
            </div>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm font-semibold text-emerald-400">
                {games.filter(g => g.status === 'live').length} Live
              </span>
              <span className="text-sm font-semibold text-emerald-300">
                {games.filter(g => g.status === 'scheduled').length} Scheduled
              </span>
              <span className="text-sm font-semibold text-slate-400">
                {games.filter(g => g.status === 'final').length} Final
              </span>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-300">
            {selectedCount}/{games.length} Selected
          </span>
        </div>

        {/* Date Picker */}
        {showDatePicker && (
          <Card className="mb-4 bg-white/5 backdrop-blur-sm border-white/10">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="text-slate-300 hover:text-slate-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-lg font-semibold text-slate-100">
                  {format(selectedDate, 'MMMM yyyy')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="text-slate-300 hover:text-slate-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Week View */}
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
                    {day}
                  </div>
                ))}
                
                {eachDayOfInterval({
                  start: startOfWeek(selectedDate),
                  end: endOfWeek(selectedDate)
                }).map(date => (
                  <Button
                    key={date.toISOString()}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }}
                    className={`h-10 text-sm ${
                      isSameDay(date, selectedDate)
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isSameDay(date, new Date())
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-white/5'
                    }`}
                  >
                    {format(date, 'd')}
                  </Button>
                ))}
              </div>
              
              {/* Quick Navigation */}
              <div className="flex space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date());
                    setShowDatePicker(false);
                  }}
                  className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(addDays(new Date(), 1));
                    setShowDatePicker(false);
                  }}
                  className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                >
                  Tomorrow
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <SportsLoading sport={activeSport} message={`Loading ${activeSport} games...`} size="lg" />
            {[...Array(2)].map((_, i) => (
              <GameCardLoading key={i} sport={activeSport} />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-8 text-slate-300">
            <p className="text-lg font-medium">No games scheduled for today</p>
            <p className="text-sm mt-2 text-slate-400">Check back later or try a different sport</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Today's Games */}
            <div className="space-y-3">
              {/* Sort games to show live games first, then scheduled, then final */}
              {games
                .sort((a, b) => {
                  // Live games first
                  if (a.status === 'live' && b.status !== 'live') return -1;
                  if (b.status === 'live' && a.status !== 'live') return 1;
                  // Then scheduled games
                  if (a.status === 'scheduled' && b.status === 'final') return -1;
                  if (b.status === 'scheduled' && a.status === 'final') return 1;
                  // Then by start time
                  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                })
                .map((game, index) => {
              const isSelected = selectedGames.has(game.id);
              const startTime = new Date(game.startTime);
              const formattedTime = isNaN(startTime.getTime()) 
                ? 'TBD'
                : startTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  });

              // Validate game data before rendering
              const gameId = game.id && !game.id.includes('undefined') ? game.id : `${activeSport}-game-${index}`;
              const awayTeamName = game.awayTeam?.name || 'TBD';
              const homeTeamName = game.homeTeam?.name || 'TBD';
              const awayTeamAbbr = extractTeamAbbreviation(awayTeamName);
              const homeTeamAbbr = extractTeamAbbreviation(homeTeamName);

              return (
                <div key={gameId} className="relative">
                  <GameCardTemplate
                    gameId={gameId}
                    homeTeam={{
                      name: homeTeamName,
                      abbreviation: homeTeamAbbr,
                      score: game.homeTeam?.score
                    }}
                    awayTeam={{
                      name: awayTeamName,
                      abbreviation: awayTeamAbbr,
                      score: game.awayTeam?.score
                    }}
                    sport={activeSport}
                    status={game.status === 'live' ? 'live' : game.status === 'final' ? 'final' : 'scheduled'}
                    startTime={game.startTime}
                    venue={game.venue}
                    inning={game.inning}
                    quarter={game.quarter}
                    period={game.period}
                    isTopInning={game.inningState === 'Top'}
                    isSelected={isSelected}
                    onSelect={() => toggleGameSelection(game.id)}
                    size="lg"
                    showWeather={true}
                    showVenue={true}
                    showEnhancedMLB={game.status === 'live'}
                  />
                </div>
              );
            })}
            </div>

            {/* Tomorrow's Games Section */}
            {hasGamesWithinTwoDays && hasTomorrowGames && isSameDay(selectedDate, new Date()) && tomorrowGames.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 pt-4 border-t border-white/10">
                  <h2 className="text-lg font-black uppercase tracking-wider text-slate-100">
                    Tomorrow's Games
                  </h2>
                  <span className="text-sm font-semibold text-slate-300">
                    {format(addDays(selectedDate, 1), 'MMMM d, yyyy')}
                  </span>
                </div>
                
                {tomorrowGames
                  .sort((a, b) => {
                    // Sort by start time
                    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                  })
                  .map((game, index) => {
                  const isSelected = selectedGames.has(game.id);
                  const startTime = new Date(game.startTime);
                  const formattedTime = isNaN(startTime.getTime()) 
                    ? 'TBD'
                    : startTime.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      });

                  // Validate game data before rendering
                  const gameId = game.id && !game.id.includes('undefined') ? game.id : `${activeSport}-tomorrow-game-${index}`;
                  const awayTeamName = game.awayTeam?.name || 'TBD';
                  const homeTeamName = game.homeTeam?.name || 'TBD';
                  const awayTeamAbbr = extractTeamAbbreviation(awayTeamName);
                  const homeTeamAbbr = extractTeamAbbreviation(homeTeamName);

                  return (
                    <div key={gameId} className="relative">
                      <GameCardTemplate
                        gameId={gameId}
                        homeTeam={{
                          name: homeTeamName,
                          abbreviation: homeTeamAbbr,
                          score: undefined // Tomorrow's games don't have scores
                        }}
                        awayTeam={{
                          name: awayTeamName,
                          abbreviation: awayTeamAbbr,
                          score: undefined
                        }}
                        sport={activeSport}
                        status="scheduled"
                        startTime={game.startTime}
                        venue={game.venue}
                        isSelected={isSelected}
                        onSelect={() => toggleGameSelection(game.id)}
                        size="lg"
                        showWeather={true}
                        showVenue={true}
                        showEnhancedMLB={false} // Don't show baseball diamond for tomorrow's games
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
