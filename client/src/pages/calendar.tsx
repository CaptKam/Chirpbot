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
import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';

import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();
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
  // Set default sport based on current season - NFL has highest priority in September
  const getCurrentDefaultSport = () => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    // September-February: NFL season (highest priority)
    if (currentMonth >= 9 || currentMonth <= 2) return "NFL";
    // August-January: NCAAF also active but lower priority
    if (currentMonth >= 8 || currentMonth === 1) return "NFL"; // NFL still higher priority
    // April-October: MLB season
    if (currentMonth >= 4 && currentMonth <= 10) return "MLB";
    // October-June: NBA season  
    if (currentMonth >= 10 || currentMonth <= 6) return "NBA";
    
    return "NFL"; // Default fallback
  };
  
  const [activeSport, setActiveSport] = useState(getCurrentDefaultSport());
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [teamFilter, setTeamFilter] = useState<{homeTeam?: string, awayTeam?: string} | null>(null);
  
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
  
  // Apply team filter if active
  const filteredTodayGames = teamFilter 
    ? todayGames.filter(game => 
        (teamFilter.homeTeam && game.homeTeam?.name === teamFilter.homeTeam) ||
        (teamFilter.awayTeam && game.awayTeam?.name === teamFilter.awayTeam) ||
        (teamFilter.homeTeam && game.awayTeam?.name === teamFilter.homeTeam) ||
        (teamFilter.awayTeam && game.homeTeam?.name === teamFilter.awayTeam)
      )
    : todayGames;
    
  const games = filteredTodayGames;
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
      
    
    <div className="pb-24 sm:pb-28 bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100 antialiased min-h-screen">
      <PageHeader 
        title="ChirpBot" 
        subtitle="Game Calendar & Monitoring" 
      />

      {/* Sport Tabs */}
      <SportTabs
        sports={SPORTS}
        activeSport={activeSport}
        onSportChange={setActiveSport}
        onSportChangeCallback={() => {
          // Clear cache when switching sports to ensure fresh data
          queryClient.invalidateQueries({ queryKey: ["/api/games/today"] });
        }}
      />

      {/* Teams List */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">
                {isSameDay(selectedDate, new Date()) ? "Today's Games" : format(selectedDate, 'MMMM d, yyyy')}
                {teamFilter && (
                  <span className="text-sm font-normal text-emerald-400 ml-2">
                    - {teamFilter.homeTeam || teamFilter.awayTeam} games
                  </span>
                )}
              </h2>
              
              {/* Season Data Notice */}
              {activeSport === 'MLB' && isSameDay(selectedDate, new Date()) && (
                <div className="bg-amber-500/20 backdrop-blur-sm border-amber-500/50 ring-1 ring-amber-500/30 text-amber-300 px-3 py-1 rounded-lg text-xs font-semibold">
                  📅 Historical 2024 Season (2025 season not yet available)
                </div>
              )}
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="bg-emerald-500/20 backdrop-blur-sm border-emerald-500/50 ring-1 ring-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 hover:border-emerald-400 hover:ring-emerald-400/50 transition-all duration-200 font-semibold"
                data-testid="button-date-picker"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Pick Date
              </Button>
              {teamFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTeamFilter(null)}
                  className="bg-red-500/20 backdrop-blur-sm border-red-500/50 ring-1 ring-red-500/30 text-red-300 hover:bg-red-500/30 hover:ring-red-400/50 transition-all duration-200"
                  data-testid="button-clear-filter"
                >
                  Clear Filter
                </Button>
              )}
            </div>
            
          </div>
          <div className="px-3 py-1 rounded-xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
            <span className="text-sm font-semibold text-slate-300" data-testid="text-selected-count">
              {selectedCount}/{games.length} Selected
            </span>
          </div>
        </div>

        {/* Date Picker */}
        {showDatePicker && (
          <div className="mb-4 bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-6 shadow-xl shadow-emerald-500/5" data-testid="date-picker-container">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="text-slate-300 hover:text-slate-100 hover:bg-emerald-500/10 rounded-xl transition-all duration-200"
                  data-testid="button-previous-day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">
                  {format(selectedDate, 'MMMM yyyy')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="text-slate-300 hover:text-slate-100 hover:bg-emerald-500/10 rounded-xl transition-all duration-200"
                  data-testid="button-next-day"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Week View */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-bold uppercase tracking-wide text-slate-400 py-2">
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
                    className={`h-10 text-sm rounded-xl transition-all duration-200 ${
                      isSameDay(date, selectedDate)
                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 backdrop-blur-sm shadow-lg shadow-emerald-500/10'
                        : isSameDay(date, new Date())
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 backdrop-blur-sm'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-white/5 hover:ring-1 hover:ring-white/10 backdrop-blur-sm'
                    }`}
                    data-testid={`button-date-${format(date, 'yyyy-MM-dd')}`}
                  >
                    {format(date, 'd')}
                  </Button>
                ))}
              </div>
              
              {/* Quick Navigation */}
              <div className="flex space-x-3 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date());
                    setShowDatePicker(false);
                  }}
                  className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-today"
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
                  className="text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 ring-1 ring-blue-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-tomorrow"
                >
                  Tomorrow
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            <SportsLoading sport={activeSport} message={`Loading ${activeSport} games...`} size="lg" />
            {[...Array(2)].map((_, i) => (
              <GameCardLoading key={i} sport={activeSport} />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm ring-1 ring-white/10 border-0 rounded-xl p-8 text-center shadow-xl shadow-emerald-500/5" data-testid="empty-state">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <CalendarIcon className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-wide text-slate-100 mb-2">No Games Scheduled</h3>
            <p className="text-sm text-slate-400">Check back later or try a different sport</p>
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
                    isTopInning={game.inningState === 'Top'}
                    isSelected={isSelected}
                    onSelect={() => toggleGameSelection(game.id)}
                    size="lg"
                    showWeather={true}
                    showVenue={true}
                    showEnhancedMLB={false}
                  />
                </div>
              );
            })}
            </div>

            {/* Tomorrow's Games Section */}
            {hasGamesWithinTwoDays && hasTomorrowGames && isSameDay(selectedDate, new Date()) && tomorrowGames.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 pt-6 border-t border-white/10">
                  <h2 className="text-xl font-black uppercase tracking-wide text-slate-100">
                    Tomorrow's Games
                  </h2>
                  <div className="px-3 py-1 rounded-xl bg-blue-500/20 ring-1 ring-blue-500/30 backdrop-blur-sm">
                    <span className="text-sm font-semibold text-blue-300" data-testid="text-tomorrow-date">
                      {format(addDays(selectedDate, 1), 'MMMM d, yyyy')}
                    </span>
                  </div>
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
                        showEnhancedMLB={game.status === 'live'} // Don't show baseball diamond for tomorrow's games
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
