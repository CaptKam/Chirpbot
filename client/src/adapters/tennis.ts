// client/src/adapters/tennis.ts
import type { AlertVM } from "@/lib/alert-vm";
import { adapters } from "./base";

adapters.push({
  sport: "TENNIS",
  canHandle: (a: any) => a.sport === "TENNIS",
  toViewModel: (a: any): AlertVM => {
    const home = a.gameInfo?.homeTeam ?? a.players?.home?.name ?? "Player A";
    const away = a.gameInfo?.awayTeam ?? a.players?.away?.name ?? "Player B";
    const setLabel =
      a.gameInfo?.set ? `Set ${a.gameInfo.set}` :
      a.currentSet ? `Set ${a.currentSet}` : "";

    return {
      id: a.id,
      sport: "TENNIS",
      title: `${away} vs ${home}`,
      situation: a.type ?? "Tennis Alert",             // e.g., "Set Point" / "Tiebreak Start"
      scoreline: a.gameInfo?.score
        ? `${a.gameInfo.score.away}-${a.gameInfo.score.home}`
        : a.score ? `${a.score.away}-${a.score.home}` : "",
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