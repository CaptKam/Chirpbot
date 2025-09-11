
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();

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
      for (const sport of SPORTS) {
        try {
          const response = await fetch(`${url}?sport=${sport}&${searchParams}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            allGames.push(...(data.games || []));
          }
        } catch (error) {
          console.log(`Error fetching ${sport} games for today:`, error);
        }
      }
      return allGames;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check tomorrow's games across all sports
  const { data: tomorrowGames } = useQuery({
    queryKey: ["/api/games/today", { date: format(tomorrow, 'yyyy-MM-dd') }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      
      const allGames = [];
      for (const sport of SPORTS) {
        try {
          const response = await fetch(`${url}?sport=${sport}&${searchParams}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            allGames.push(...(data.games || []));
          }
        } catch (error) {
          console.log(`Error fetching ${sport} games for tomorrow:`, error);
        }
      }
      return allGames;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasGamesWithinTwoDays = (todayGames?.length || 0) > 0 || (tomorrowGames?.length || 0) > 0;
  
  return {
    hasGamesWithinTwoDays,
    todayGames: todayGames || [],
    tomorrowGames: tomorrowGames || [],
    hasTodayGames: (todayGames?.length || 0) > 0,
    hasTomorrowGames: (tomorrowGames?.length || 0) > 0,
  };
}
