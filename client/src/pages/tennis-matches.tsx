import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TennisMatch } from "@shared/schema";

interface TennisMatchResponse {
  matches: (TennisMatch & { isMonitoring: boolean })[];
}

export default function TennisMatchesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tennis", "matches"],
    queryFn: async (): Promise<TennisMatchResponse> => {
      const response = await fetch("/api/tennis/matches");
      if (!response.ok) throw new Error("Failed to fetch tennis matches");
      return response.json();
    },
    refetchInterval: 15_000, // Refresh every 15 seconds
  });

  const toggleMonitoringMutation = useMutation({
    mutationFn: async ({ matchId, enable }: { matchId: string; enable: boolean }) => {
      return apiRequest("POST", "/api/tennis/toggle-monitoring", { matchId, enable });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis", "matches"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 text-slate-400">
        <div className="animate-pulse">Loading tennis matches...</div>
      </div>
    );
  }

  const matches = data?.matches ?? [];

  if (matches.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-slate-400 mb-4">No live tennis matches at the moment</div>
        <div className="text-sm text-slate-500">
          Live matches will appear here when tournaments are active
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">🎾 Live Tennis Matches</h1>
        <div className="text-sm text-slate-400">
          {matches.length} match{matches.length !== 1 ? 'es' : ''} available
        </div>
      </div>

      {matches.map((match) => (
        <div 
          key={match.matchId} 
          className="flex items-center justify-between rounded-lg p-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-100 mb-1">
              <span className="text-blue-400">{match.players.home.name}</span>
              <span className="mx-2 text-slate-400">vs</span>
              <span className="text-red-400">{match.players.away.name}</span>
            </div>
            
            <div className="text-sm text-slate-300 mb-1">
              Set {match.currentSet}: <span className="font-mono">{match.gamesInSet.home}-{match.gamesInSet.away}</span>
              {match.isTiebreak && <span className="ml-2 text-yellow-400">🏆 Tiebreak</span>}
            </div>
            
            <div className="text-xs text-slate-400 space-x-4">
              <span>Score: {match.score.home} - {match.score.away}</span>
              <span>Serving: {match.serving === 'home' ? match.players.home.name : match.players.away.name}</span>
              {match.tournament && <span>📍 {match.tournament}</span>}
              {match.surface && <span>🎾 {match.surface}</span>}
            </div>
          </div>

          <button
            data-testid={`button-toggle-monitoring-${match.matchId}`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              match.isMonitoring 
                ? "bg-emerald-500 text-black hover:bg-emerald-600" 
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
            onClick={() => toggleMonitoringMutation.mutate({
              matchId: match.matchId,
              enable: !match.isMonitoring
            })}
            disabled={toggleMonitoringMutation.isPending}
          >
            {toggleMonitoringMutation.isPending ? '...' : match.isMonitoring ? "Monitoring" : "Monitor"}
          </button>
        </div>
      ))}

      <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h3 className="text-sm font-medium text-blue-300 mb-1">Alert Types Available</h3>
        <div className="text-xs text-blue-200 space-x-2">
          <span>🎾 Break Points</span>
          <span>🏆 Set Points</span>
          <span>🚨 Match Points</span>
          <span>⚡ Tiebreaks</span>
          <span>📈 Momentum Shifts</span>
        </div>
      </div>
    </div>
  );
}