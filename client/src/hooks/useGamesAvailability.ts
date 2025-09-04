
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";

const SPORTS = ["MLB", "NFL", "NBA", "NHL", "CFL", "NCAAF", "WNBA"];

export function useGamesAvailability() {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  // Check today's games across all sports
  const { data: todayGames } = useQuery({
    queryKey: ["/api/games/today", { date: format(today, 'yyyy-MM-dd') }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      
      const allGames = [];
      const gamesBySport: Record<string, any[]> = {};
      
      for (const sport of SPORTS) {
        try {
          const response = await fetch(`${url}?sport=${sport}&${searchParams}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const games = data.games || [];
            gamesBySport[sport] = games;
            allGames.push(...games);
          } else {
            gamesBySport[sport] = [];
          }
        } catch (error) {
          console.log(`Error fetching ${sport} games for today:`, error);
          gamesBySport[sport] = [];
        }
      }
      return { allGames, gamesBySport };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check tomorrow's games across all sports
  const { data: tomorrowGames } = useQuery({
    queryKey: ["/api/games/tomorrow", { date: format(tomorrow, 'yyyy-MM-dd') }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      
      const allGames = [];
      const gamesBySport: Record<string, any[]> = {};
      
      for (const sport of SPORTS) {
        try {
          const response = await fetch(`/api/games/today?sport=${sport}&${searchParams}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const games = data.games || [];
            gamesBySport[sport] = games;
            allGames.push(...games);
          } else {
            gamesBySport[sport] = [];
          }
        } catch (error) {
          console.log(`Error fetching ${sport} games for tomorrow:`, error);
          gamesBySport[sport] = [];
        }
      }
      return { allGames, gamesBySport };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const todayGamesBySport = todayGames?.gamesBySport || {};
  const tomorrowGamesBySport = tomorrowGames?.gamesBySport || {};
  
  // Calculate which sports have games within two days
  const sportsWithGames = SPORTS.filter(sport => {
    const todayCount = (todayGamesBySport[sport] || []).length;
    const tomorrowCount = (tomorrowGamesBySport[sport] || []).length;
    return todayCount > 0 || tomorrowCount > 0;
  });

  const hasGamesWithinTwoDays = (todayGames?.allGames?.length || 0) > 0 || (tomorrowGames?.allGames?.length || 0) > 0;
  
  return {
    hasGamesWithinTwoDays,
    sportsWithGames,
    todayGames: todayGames?.allGames || [],
    tomorrowGames: tomorrowGames?.allGames || [],
    todayGamesBySport,
    tomorrowGamesBySport,
    hasTodayGames: (todayGames?.allGames?.length || 0) > 0,
    hasTomorrowGames: (tomorrowGames?.allGames?.length || 0) > 0,
    getSportHasGames: (sport: string) => {
      const todayCount = (todayGamesBySport[sport] || []).length;
      const tomorrowCount = (tomorrowGamesBySport[sport] || []).length;
      return todayCount > 0 || tomorrowCount > 0;
    }
  };
}
