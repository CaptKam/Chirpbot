import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Bell, Play, Clock, Sun, CloudRain, Cloud, UserPlus, LogOut, Sparkles, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { Game, GameDay } from "@shared/schema";
import { TeamLogo } from "@/components/team-logo";
import { GameCardTemplate } from "@/components/GameCardTemplate";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
    // MLB
    'Yankees': 'NYY', 'Mets': 'NYM', 'Dodgers': 'LAD', 'Angels': 'LAA',
    'Athletics': 'OAK', 'Padres': 'SD',
    'Cubs': 'CHC', 'White Sox': 'CWS', 'Guardians': 'CLE',
    'Twins': 'MIN', 'Royals': 'KC', 'Astros': 'HOU', 'Rangers': 'TEX',
    'Mariners': 'SEA', 'Red Sox': 'BOS', 'Orioles': 'BAL', 'Blue Jays': 'TOR',
    'Rays': 'TB', 'Marlins': 'MIA', 'Nationals': 'WSH', 'Phillies': 'PHI',
    'Pirates': 'PIT', 'Reds': 'CIN', 'Brewers': 'MIL',
    'Diamondbacks': 'ARI', 'Rockies': 'COL',
    // NBA
    'Hawks': 'ATL', 'Celtics': 'BOS', 'Nets': 'BKN', 'Hornets': 'CHA',
    'Bulls': 'CHI', 'Cavaliers': 'CLE', 'Mavericks': 'DAL', 'Nuggets': 'DEN',
    'Pistons': 'DET', 'Warriors': 'GSW', 'Rockets': 'HOU', 'Pacers': 'IND',
    'Clippers': 'LAC', 'Lakers': 'LAL', 'Grizzlies': 'MEM', 'Heat': 'MIA',
    'Bucks': 'MIL', 'Timberwolves': 'MIN', 'Pelicans': 'NOP', 'Knicks': 'NYK',
    'Thunder': 'OKC', 'Magic': 'ORL', '76ers': 'PHI', 'Suns': 'PHX',
    'Trail Blazers': 'POR', 'Blazers': 'POR', 'Kings': 'SAC', 'Spurs': 'SAS',
    'Raptors': 'TOR', 'Jazz': 'UTA', 'Wizards': 'WAS',
    // NFL
    'Falcons': 'ATL', 'Ravens': 'BAL', 'Bills': 'BUF',
    'Panthers': 'CAR', 'Bears': 'CHI', 'Bengals': 'CIN', 'Browns': 'CLE',
    'Cowboys': 'DAL', 'Broncos': 'DEN', 'Lions': 'DET', 'Packers': 'GB',
    'Texans': 'HOU', 'Colts': 'IND', 'Jaguars': 'JAX', 'Chiefs': 'KC',
    'Chargers': 'LAC', 'Rams': 'LAR', 'Raiders': 'LV', 'Dolphins': 'MIA',
    'Vikings': 'MIN', 'Patriots': 'NE', 'Saints': 'NO',
    'Jets': 'NYJ', 'Eagles': 'PHI', 'Steelers': 'PIT', 'Seahawks': 'SEA',
    '49ers': 'SF', 'Niners': 'SF', 'Buccaneers': 'TB', 'Bucs': 'TB', 'Titans': 'TEN', 'Commanders': 'WAS',
    // Full names for disambiguation
    'SF Giants': 'SF', 'San Francisco Giants': 'SF', 'NY Giants': 'NYG', 'New York Giants': 'NYG',
    'STL Cardinals': 'STL', 'St. Louis Cardinals': 'STL', 'Arizona Cardinals': 'ARI',
    'Atlanta Braves': 'ATL', 'Detroit Tigers': 'DET'
  };

  return abbreviations[cleanName] || cleanName.slice(0, 3).toUpperCase();
};

import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { SportsLoading, GameCardLoading } from '@/components/sports-loading';
import { BaseballDiamond, WeatherDisplay } from '@/components/baseball-diamond';
import { WeatherImpactVisualizer } from '@/components/WeatherImpactVisualizer';

import { SportTabs } from '@/components/SportTabs';
import { PageHeader } from '@/components/PageHeader';

import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();

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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: false, // Weather doesn't need constant polling
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
  const { toast } = useToast();
  const [activeSport, setActiveSport] = useState("MLB");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [teamFilter, setTeamFilter] = useState<{homeTeam?: string, awayTeam?: string} | null>(null);

  // Fetch server's Pacific date to ensure timezone alignment
  const { data: serverDate } = useQuery({
    queryKey: ["/api/server-date"],
    queryFn: async () => {
      const response = await fetch("/api/server-date", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch server date");
      return response.json();
    },
    staleTime: 60000,
  });

  // Initialize selectedDates - will be updated when server date loads
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (serverDate?.date && !isInitialized) {
      const dates = new Set<string>();
      // Parse the date string at noon to avoid timezone shifts
      const serverNow = parseISO(serverDate.date + 'T12:00:00');
      for (let i = 0; i < 4; i++) {
        dates.add(format(addDays(serverNow, i), 'yyyy-MM-dd'));
      }
      setSelectedDates(dates);
      setIsInitialized(true);
      console.log('📅 Calendar initialized with server date:', serverDate.date, 'Selected dates:', Array.from(dates));
    }
  }, [serverDate?.date, isInitialized]);

  // Memoize sorted dates array to prevent queryKey instability
  const sortedDates = useMemo(() => Array.from(selectedDates).sort(), [selectedDates]);

  // Fetch games for all selected dates - only when initialized
  const { data: allGamesData, isLoading: isLoadingGames } = useQuery({
    queryKey: ["/api/games/multi-day", { sport: activeSport, dates: sortedDates }],
    enabled: isInitialized && selectedDates.size > 0,
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey as [string, { sport: string; dates: string[] }];

      // Fetch games for each selected date
      const promises = params.dates.map(async (date) => {
        const searchParams = new URLSearchParams({ sport: params.sport, date });
        const response = await fetch(`/api/games/today?${searchParams}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch games");
        const data = await response.json();
        return { date, games: data.games || [] };
      });

      const results = await Promise.all(promises);

      // Combine all games with date labels
      const allGames = results.flatMap(({ date, games }) =>
        games.map((game: any) => ({ ...game, fetchDate: date }))
      );

      return { games: allGames, dates: params.dates };
    },
  });

  const allGames = allGamesData?.games || [];

  // Apply team filter if active
  const filteredGames = teamFilter
    ? allGames.filter(game =>
        (teamFilter.homeTeam && game.homeTeam?.name === teamFilter.homeTeam) ||
        (teamFilter.awayTeam && game.awayTeam?.name === teamFilter.awayTeam) ||
        (teamFilter.homeTeam && game.awayTeam?.name === teamFilter.homeTeam) ||
        (teamFilter.awayTeam && game.homeTeam?.name === teamFilter.awayTeam)
      )
    : allGames;

  const games = filteredGames;
  const isLoading = isLoadingGames;

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



  // Load persisted monitored games - require proper authentication
  const userId = user?.id;
  const { data: allMonitoredGames, isLoading: isLoadingMonitored } = useQuery({
    queryKey: [`/api/user/${userId}/monitored-games`],
    queryFn: async ({ queryKey }) => {
      const [url] = queryKey;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch monitored games");
      return response.json();
    },
    enabled: !!userId, // Only run query if user is authenticated
  });

  // Filter monitored games by active sport on the frontend (case-insensitive)
  // Memoize to prevent useEffect from firing on every render
  const monitoredGameIds = useMemo(() => {
    if (!allMonitoredGames) return [];
    return allMonitoredGames
      .filter((game: any) => (game.sport || '').toUpperCase() === activeSport.toUpperCase())
      .map((game: any) => game.gameId as string);
  }, [allMonitoredGames, activeSport]);

  // Sync selected games with persisted monitored games
  useEffect(() => {
    setSelectedGames(new Set(monitoredGameIds));
  }, [monitoredGameIds]);

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
      toast({
        title: "Game added to monitoring",
        description: "You'll receive alerts for this game",
      });
    },
    onError: (error) => {
      console.error('Failed to add game monitoring:', error);
      toast({
        title: "Failed to add game",
        description: "Please try again or check if you're logged in",
        variant: "destructive",
      });
    }
  });

  // Remove game monitoring
  const removeMonitoringMutation = useMutation({
    mutationFn: async (gameId: string) => {
      return apiRequest("DELETE", `/api/user/${userId}/monitored-games/${gameId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}/monitored-games`] });
      toast({
        title: "Game removed from monitoring",
        description: "You won't receive alerts for this game",
      });
    },
    onError: (error) => {
      console.error('Failed to remove game monitoring:', error);
      toast({
        title: "Failed to remove game",
        description: "Please try again or check if you're logged in",
        variant: "destructive",
      });
    }
  });

  const toggleGameSelection = (gameId: string) => {
    // Strict validation for gameId
    if (!gameId || gameId === 'undefined' || gameId === 'null' || gameId.includes('undefined') || gameId.includes('null')) {
      console.error(`Invalid gameId attempted: ${gameId}`);
      toast({
        title: "Invalid game",
        description: "This game cannot be monitored (missing or invalid ID)",
        variant: "destructive",
      });
      return;
    }

    // Check if user is authenticated
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please log in to monitor games",
        variant: "destructive",
      });
      return;
    }

    // Find game with fallback to both id and gameId fields
    const game = games.find(g => {
      const gId = g.gameId || g.id;
      return gId === gameId;
    });

    if (!game) {
      console.error(`Game not found for ID: ${gameId}`, {
        searchedGames: games.map(g => ({ gameId: g.gameId, id: g.id }))
      });
      toast({
        title: "Game not found",
        description: "Unable to locate game data",
        variant: "destructive",
      });
      return;
    }

    // Validate game has required team data
    if (!game.homeTeam?.name || !game.awayTeam?.name) {
      console.error(`Game ${gameId} missing team data`, game);
      toast({
        title: "Incomplete game data",
        description: "This game is missing team information",
        variant: "destructive",
      });
      return;
    }

    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
      // Remove from database
      removeMonitoringMutation.mutate(gameId);
    } else {
      // Final validation before API call
      const validGameId = gameId && gameId !== 'null' && gameId !== 'undefined' ? gameId : null;
      if (!validGameId) {
        console.error(`Cannot monitor game: gameId is invalid`, { gameId, game });
        toast({
          title: "Cannot monitor game",
          description: "Game ID is invalid",
          variant: "destructive",
        });
        return;
      }

      console.log(`📡 Calling API to add monitored game:`, {
        gameId: validGameId,
        sport: activeSport.toUpperCase(),
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name
      });

      // Add to local Set for immediate UI feedback
      newSelected.add(gameId);

      addMonitoringMutation.mutate({
        gameId: validGameId,
        sport: activeSport.toUpperCase(),
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name
      });
    }
    setSelectedGames(newSelected);
  };

  // Calculate selected count only for current sport's games
  const selectedCount = games.filter(game => selectedGames.has(game.gameId || game.id)).length;

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
                {selectedDates.size === 1 && serverDate?.date && selectedDates.has(serverDate.date)
                  ? "Today's Games"
                  : selectedDates.size === 1
                  ? format(parseISO(Array.from(selectedDates)[0] + 'T12:00:00'), 'MMMM d, yyyy')
                  : selectedDates.size === 4 && serverDate?.date && Array.from(selectedDates).includes(serverDate.date)
                  ? "Next 4 Days"
                  : `${selectedDates.size} Days Selected`}
                {teamFilter && (
                  <span className="text-sm font-normal text-emerald-400 ml-2">
                    - {teamFilter.homeTeam || teamFilter.awayTeam} games
                  </span>
                )}
              </h2>
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="bg-emerald-500/30 backdrop-blur-sm border-emerald-500/60 ring-2 ring-emerald-500/40 text-emerald-200 hover:bg-emerald-500/40 hover:text-emerald-100 hover:border-emerald-400 hover:ring-emerald-400/60 transition-all duration-200 font-bold shadow-lg shadow-emerald-500/20"
                data-testid="button-date-picker"
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Pick Multiple Days
              </Button>
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
                <h3 className="text-xl font-black uppercase tracking-wide text-slate-100">
                  Select Multiple Days
                </h3>
                <div className="text-sm text-slate-400">
                  {selectedDates.size} day{selectedDates.size !== 1 ? 's' : ''} selected
                </div>
              </div>

              {/* Team Filter Section */}
              {teamFilter && (
                <div className="p-3 bg-emerald-500/10 backdrop-blur-sm ring-1 ring-emerald-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-emerald-300">Filtering:</span>
                      <span className="text-sm text-slate-200">{teamFilter.homeTeam || teamFilter.awayTeam}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTeamFilter(null)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-7 px-2"
                    >
                      Clear Filter
                    </Button>
                  </div>
                </div>
              )}

              {/* Week View */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-bold uppercase tracking-wide text-slate-400 py-2">
                    {day}
                  </div>
                ))}

                {serverDate?.date && eachDayOfInterval({
                  start: startOfWeek(parseISO(serverDate.date + 'T12:00:00')),
                  end: addDays(endOfWeek(parseISO(serverDate.date + 'T12:00:00')), 14)
                }).map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isSelected = selectedDates.has(dateStr);
                  const todayStr = serverDate.date;
                  const isToday = dateStr === todayStr;

                  return (
                    <Button
                      key={date.toISOString()}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newDates = new Set(selectedDates);
                        if (isSelected) {
                          newDates.delete(dateStr);
                          // Don't allow deselecting all dates
                          if (newDates.size === 0 && serverDate?.date) {
                            newDates.add(serverDate.date);
                          }
                        } else {
                          newDates.add(dateStr);
                        }
                        setSelectedDates(newDates);
                      }}
                      className={`h-10 text-sm rounded-xl transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-500/50 backdrop-blur-sm shadow-lg shadow-emerald-500/20 font-bold'
                          : isToday
                          ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 backdrop-blur-sm'
                          : 'text-slate-300 hover:text-slate-100 hover:bg-white/5 hover:ring-1 hover:ring-white/10 backdrop-blur-sm'
                      }`}
                      data-testid={`button-date-${dateStr}`}
                    >
                      {format(date, 'd')}
                    </Button>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!serverDate?.date) return;
                    const dates = new Set<string>();
                    // Parse the date at noon to avoid timezone shifts
                    const now = parseISO(serverDate.date + 'T12:00:00');
                    for (let i = 0; i < 4; i++) {
                      dates.add(format(addDays(now, i), 'yyyy-MM-dd'));
                    }
                    setSelectedDates(dates);
                    // Force refresh the games after updating dates
                    queryClient.invalidateQueries({ queryKey: ["/api/games/multi-day"] });
                  }}
                  className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-today"
                >
                  Next 4 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!serverDate?.date) return;
                    const weekend = [];
                    const now = parseISO(serverDate.date + 'T12:00:00');
                    for (let i = 0; i < 7; i++) {
                      const day = addDays(now, i);
                      const dayOfWeek = day.getDay();
                      if (dayOfWeek === 0 || dayOfWeek === 6) {
                        weekend.push(format(day, 'yyyy-MM-dd'));
                      }
                    }
                    setSelectedDates(new Set(weekend));
                  }}
                  className="text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 ring-1 ring-blue-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-weekend"
                >
                  This Weekend
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!serverDate?.date) return;
                    const week = [];
                    const now = parseISO(serverDate.date + 'T12:00:00');
                    for (let i = 0; i < 7; i++) {
                      week.push(format(addDays(now, i), 'yyyy-MM-dd'));
                    }
                    setSelectedDates(new Set(week));
                  }}
                  className="text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 ring-1 ring-purple-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-week"
                >
                  Next 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDatePicker(false);
                  }}
                  className="ml-auto text-slate-400 border-slate-500/30 bg-slate-500/10 hover:bg-slate-500/20 ring-1 ring-slate-500/20 backdrop-blur-sm rounded-xl transition-all duration-200 font-semibold"
                  data-testid="button-close"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isInitialized ? (
          <div className="space-y-3">
            <SportsLoading sport={activeSport} message="Initializing calendar..." size="lg" />
          </div>
        ) : isLoading ? (
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
            {/* Games grouped by date */}
            {Array.from(selectedDates)
              .sort()
              .map(dateStr => {
                const dateGames = games.filter(g => g.fetchDate === dateStr);
                if (dateGames.length === 0) return null;

                const date = parseISO(dateStr + 'T12:00:00');
                const isToday = serverDate?.date ? dateStr === serverDate.date : false;

                return (
                  <div key={dateStr} className="space-y-3">
                    {selectedDates.size > 1 && (
                      <div className="flex items-center space-x-2 mt-6 first:mt-0">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 bg-emerald-500/10 rounded-full ring-1 ring-emerald-500/20">
                          {isToday ? 'Today' : format(date, 'EEEE, MMM d')}
                        </h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                      </div>
                    )}
                    {dateGames
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
              const isSelected = selectedGames.has(game.gameId);
              const startTime = new Date(game.startTime);
              const formattedTime = isNaN(startTime.getTime())
                ? 'TBD'
                : startTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  });

              // Validate game data before rendering
              const gameId = game.gameId || `${activeSport.toLowerCase()}-${index}-${game.startTime || Date.now()}`;

              // Skip games with invalid IDs
              if (!gameId || gameId === 'undefined' || gameId.includes('undefined') || gameId === 'null') {
                console.warn(`Skipping game with invalid ID at index ${index}`, game);
                return null;
              }

              const awayTeamName = game.awayTeam?.name || 'TBD';
              const homeTeamName = game.homeTeam?.name || 'TBD';
              const awayTeamAbbr = extractTeamAbbreviation(awayTeamName);
              const homeTeamAbbr = extractTeamAbbreviation(homeTeamName);

              console.log(`🔍 Rendering game card: gameId=${gameId}, sport=${activeSport}, home=${homeTeamName}, away=${awayTeamName}`);

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
                    timeRemaining={game.timeRemaining}
                    runners={{ first: false, second: false, third: false }}
                    balls={0}
                    strikes={0}
                    outs={0}
                    possessionData={game.possession ? {
                      tracked: true,
                      currentPossession: game.possession === game.homeTeam?.name ? 'home' : 'away',
                      homePossessions: (game as any).homePossessions || 0,
                      awayPossessions: (game as any).awayPossessions || 0
                    } : undefined}
                    timeoutData={(game.homeTimeoutsRemaining != null || game.awayTimeoutsRemaining != null) ? {
                      tracked: true,
                      homeTimeoutsRemaining: game.homeTimeoutsRemaining ?? 0,
                      awayTimeoutsRemaining: game.awayTimeoutsRemaining ?? 0
                    } : undefined}
                    isSelected={isSelected}
                    onSelect={() => toggleGameSelection(gameId)}
                    size="lg"
                    showWeather={true}
                    showVenue={true}
                    showEnhancedMLB={true}
                  />
                </div>
              );
                      })}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}