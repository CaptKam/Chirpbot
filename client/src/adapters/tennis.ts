// client/src/adapters/tennis.ts
import type { AlertVM } from "@/lib/alert-vm";
import { adapters } from "./base";

adapters.push({
  sport: "TENNIS",
  canHandle: (a: any) => a.sport === "TENNIS",
  toViewModel: (a: any): AlertVM => {
    const home = a.gameInfo?.homeTeam ?? a.players?.home?.name ?? "Player A";
    const away = a.gameInfo?.awayTeam ?? a.players?.away?.name ?? "Player B";
    const setLabel = a.gameInfo?.set ? `Set ${a.gameInfo.set}` : "Live";

    // Tennis scoring: Show games in set (e.g., "6-4") and current game score if available
    let scoreline = "";
    if (a.gameInfo?.score) {
      scoreline = `${a.gameInfo.score.away}-${a.gameInfo.score.home}`;
      if (a.gameInfo?.gameScore) {
        scoreline += ` (${a.gameInfo.gameScore.away}-${a.gameInfo.gameScore.home})`;
      }
    } else if (a.gameInfo?.gameScore) {
      scoreline = `${a.gameInfo.gameScore.away}-${a.gameInfo.gameScore.home}`;
    } else {
      scoreline = "Live";
    }

    return {
      id: a.id,
      sport: "TENNIS",
      title: `${away} vs ${home}`,
      situation: a.type ?? "Tennis Alert",             // e.g., "Set Point" / "Tiebreak Start"
      scoreline: scoreline,
      period: setLabel,
      edge: { label: "Priority", value: `${a.priority ?? 80}` },
      priority: a.priority ?? 80,
      actionLine: a.description,
      tags: ["Tennis"],
      isNew: !a.seen,
      createdAt: a.timestamp ?? a.created_at,
    };
  },
});