import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Play, Calendar as CalendarIcon, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Game, GameDay } from "@shared/schema";
import { TeamLogo } from "@/components/team-logo";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getTeamAbbr, getSportAccent } from '@/utils/team-utils';

import { format, addDays, parseISO } from "date-fns";
import { SportsLoading, GameCardLoading } from '@/components/sports-loading';
import { PageHeader } from '@/components/PageHeader';

import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();

export default function Calendar() {
  const { toast } = useToast();
  const [activeSport, setActiveSport] = useState("MLB");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
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

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const searchFilteredGames = searchQuery.trim()
    ? games.filter(g => {
        const q = searchQuery.toLowerCase();
        return (g.homeTeam?.name?.toLowerCase().includes(q) ||
                g.awayTeam?.name?.toLowerCase().includes(q) ||
                g.venue?.toLowerCase().includes(q));
      })
    : games;

  // Get contextual badge for a game (weather, live status, etc.)
  const getContextBadge = (game: any) => {
    if (game.status === 'live') {
      const state = game.inning ? `${game.inningState === 'Top' ? 'Top' : 'Bot'} ${game.inning}` :
                    game.quarter ? `Q${game.quarter} ${game.timeRemaining || ''}`.trim() :
                    game.period ? `P${game.period} ${game.timeRemaining || ''}`.trim() : 'Live';
      return { text: state, color: 'text-emeraldGreen', bg: 'bg-emeraldGreen/10', icon: <Play className="w-3.5 h-3.5" /> };
    }
    if (game.status === 'final') {
      return { text: 'Final', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: null };
    }
    return null;
  };

  const dateLabel = selectedDates.size === 1 && serverDate?.date && selectedDates.has(serverDate.date)
    ? "Today's"
    : selectedDates.size === 4 ? "Next 4 Days"
    : `${selectedDates.size} Days`;

  const displayDate = serverDate?.date
    ? format(parseISO(serverDate.date + 'T12:00:00'), 'MMM d, yyyy')
    : '';

  return (
    <div className="pb-24 sm:pb-28 bg-solidBackground text-white antialiased min-h-screen">
      <PageHeader title="ChirpBot" subtitle="Smart Alert Setup" />
      {/* Search bar */}
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primaryBlue/50 focus:outline-none"
            placeholder="Search teams or venues..."
          />
        </div>
      </div>
      {/* Sport pills */}
      <div className="px-4 pt-4 pb-2 bg-[#101922]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {SPORTS.map((sport) => {
            const accent = getSportAccent(sport);
            return (
              <button
                key={sport}
                onClick={() => {
                  setActiveSport(sport);
                  queryClient.invalidateQueries({ queryKey: ["/api/games/today"] });
                }}
                data-testid={`sport-tab-${sport.toLowerCase()}`}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ease-out ${
                  activeSport === sport ? accent.pill : accent.pillInactive
                }`}
              >
                {sport}
              </button>
            );
          })}
        </div>
      </div>
      {/* Section header */}
      <div className="px-4 py-4 flex items-center justify-between bg-[#101922] text-[#ffffff]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {dateLabel} {activeSport} Games
        </h2>
        <span className="text-xs font-medium text-primaryBlue">{displayDate}</span>
      </div>
      {/* Game cards */}
      <div className="flex flex-col px-4 gap-3 pb-4 bg-[#101922] text-[#ffffff]">
        {!isInitialized ? (
          <SportsLoading sport={activeSport} message="Initializing..." size="lg" />
        ) : isLoading ? (
          <>
            <SportsLoading sport={activeSport} message={`Loading ${activeSport} games...`} size="lg" />
            {[...Array(2)].map((_, i) => (
              <GameCardLoading key={i} sport={activeSport} />
            ))}
          </>
        ) : searchFilteredGames.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 text-center border border-slate-800" data-testid="empty-state">
            <CalendarIcon className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-200 mb-1">
              {searchQuery ? 'No matches found' : 'No Games Scheduled'}
            </h3>
            <p className="text-sm text-slate-500">
              {searchQuery ? 'Try a different search term' : 'Check back later or try a different sport'}
            </p>
          </div>
        ) : (
          <>
            {Array.from(selectedDates)
              .sort()
              .map(dateStr => {
                const dateGames = searchFilteredGames.filter(g => g.fetchDate === dateStr);
                if (dateGames.length === 0) return null;

                const date = parseISO(dateStr + 'T12:00:00');
                const isToday = serverDate?.date ? dateStr === serverDate.date : false;

                return (
                  <div key={dateStr}>
                    {selectedDates.size > 1 && (
                      <div className="flex items-center gap-2 mb-3 mt-4 first:mt-0">
                        <div className="h-px flex-1 bg-slate-800" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {isToday ? 'Today' : format(date, 'EEEE, MMM d')}
                        </span>
                        <div className="h-px flex-1 bg-slate-800" />
                      </div>
                    )}
                    {dateGames
                      .sort((a, b) => {
                        if (a.status === 'live' && b.status !== 'live') return -1;
                        if (b.status === 'live' && a.status !== 'live') return 1;
                        if (a.status === 'scheduled' && b.status === 'final') return -1;
                        if (b.status === 'scheduled' && a.status === 'final') return 1;
                        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                      })
                      .map((game, index) => {
                        const gameId = game.gameId || `${activeSport.toLowerCase()}-${index}-${game.startTime || Date.now()}`;
                        if (!gameId || gameId === 'undefined' || gameId.includes('undefined') || gameId === 'null') return null;

                        const isMonitored = selectedGames.has(game.gameId);
                        const awayTeamName = game.awayTeam?.name || 'TBD';
                        const homeTeamName = game.homeTeam?.name || 'TBD';
                        const awayAbbr = getTeamAbbr(awayTeamName);
                        const homeAbbr = getTeamAbbr(homeTeamName);
                        const badge = getContextBadge(game);
                        const startTime = new Date(game.startTime);
                        const formattedTime = isNaN(startTime.getTime()) ? 'TBD'
                          : startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                        return (
                          <div
                            key={gameId}
                            className="rounded-xl p-4 border border-slate-800 pt-[9px] pb-[9px] mt-[10px] mb-[10px] bg-[#101825]"
                            data-testid={`game-card-${gameId}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Left: stacked logos + info */}
                              <div className="flex flex-1 gap-4">
                                {/* Stacked team logos */}
                                <div className="flex flex-col shrink-0">
                                  <TeamLogo teamName={awayTeamName} abbreviation={awayAbbr} sport={activeSport} size="sm" className="rounded-full border border-slate-700" />
                                  <TeamLogo teamName={homeTeamName} abbreviation={homeAbbr} sport={activeSport} size="sm" className="rounded-full border border-slate-700 -mt-3" />
                                </div>

                                {/* Game info */}
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base font-bold">
                                      {awayAbbr}
                                      {(game.status === 'live' || game.status === 'final') && game.awayTeam?.score != null
                                        ? ` ${game.awayTeam.score}`
                                        : ''
                                      }
                                      {' @ '}
                                      {(game.status === 'live' || game.status === 'final') && game.homeTeam?.score != null
                                        ? `${game.homeTeam.score} `
                                        : ''
                                      }
                                      {homeAbbr}
                                    </span>
                                    {game.status === 'live' && (
                                      <span className="px-1.5 py-0.5 rounded bg-primaryBlue/10 text-primaryBlue text-[10px] font-bold uppercase tracking-tighter">
                                        Live
                                      </span>
                                    )}
                                  </div>

                                  {/* Context badge */}
                                  {badge && (
                                    <div className={`flex items-center gap-1.5 ${badge.color} ${badge.bg} px-2 py-0.5 rounded-md w-fit`}>
                                      {badge.icon}
                                      <span className="text-[11px] font-semibold">{badge.text}</span>
                                    </div>
                                  )}

                                  <p className="text-xs text-slate-400 font-medium truncate">
                                    {game.venue ? `${game.venue} \u2022 ` : ''}{formattedTime}
                                  </p>
                                </div>
                              </div>

                              {/* Right: monitoring toggle */}
                              <div className="flex flex-col items-end justify-center pt-1">
                                <Switch
                                  checked={isMonitored}
                                  onCheckedChange={() => toggleGameSelection(gameId)}
                                  className="data-[state=checked]:bg-emeraldGreen"
                                  data-testid={`toggle-monitor-${gameId}`}
                                />
                                <span className="text-[10px] mt-1 font-semibold text-slate-400 uppercase tracking-tighter">
                                  {isMonitored ? 'Monitoring' : 'Follow'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}