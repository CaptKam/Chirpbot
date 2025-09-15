

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getSeasonAwareSports } from '@shared/season-manager';

const SPORTS = getSeasonAwareSports();

export function useGamesAvailability() {
  const today = new Date();

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

  return {
    todayGames: todayGames || [],
    hasTodayGames: (todayGames?.length || 0) > 0,
  };
}

