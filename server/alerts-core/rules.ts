// server/alerts-core/rules.ts
import type { Frame, AlertEvent } from "./types";
import { basePriority } from "./score";

export function applyRules(frame: Frame): AlertEvent[] {
  const A: AlertEvent[] = [];
  const { inning, half, outs, runners, score } = frame;

  const tie = score.home === score.away;

  // --- Game state rules ---
  if (inning === 1 && half === "top" && outs === 0) {
    A.push({
      kind: "GAME_START",
      priority: 40,
      title: "Game Start",
      description: "First pitch!",
    });
  }
  if (inning === 7 && half === "top" && outs === 0) {
    A.push({
      kind: "SEVENTH_INNING_WARNING",
      priority: 50,
      title: "7th Inning Warning",
      description: "Critical innings ahead.",
    });
  }
  if (inning === 9 && half === "top" && tie && outs === 0) {
    A.push({
      kind: "TIE_GAME_9TH",
      priority: 85,
      title: "Tie Game — 9th",
      description: "Final inning leverage.",
    });
  }

  // --- RISP rules (startup set) ---
  const risp = (runners.second || runners.third) && outs < 2;
  if (risp) {
    A.push({
      kind: "RISP",
      priority: Math.max(70, basePriority(frame)),
      title: "Runners in Scoring Position",
      description: `< outs: ${outs}, inning: ${half} ${inning}>`,
    });
  }

  // Second & Third, 1 out — classic high EV
  if (runners.second && runners.third && outs === 1) {
    A.push({
      kind: "R2_R3_ONE_OUT",
      priority: 85,
      title: "2nd & 3rd, 1 Out",
      description: "Prime scoring chance.",
    });
  }

  // Bases loaded variants
  if (runners.first && runners.second && runners.third) {
    const key = `BASES_LOADED_${outs}`;
    const base = outs === 0 ? 95 : outs === 1 ? 85 : 95;
    A.push({
      kind: key,
      priority: base,
      title: "Bases Loaded",
      description: `${outs} out${outs === 1 ? "" : "s"}.`,
    });
  }

  // Runner on 3rd, 1 out (sac fly / GB)
  if (runners.third && outs === 1) {
    A.push({
      kind: "R3_ONE_OUT",
      priority: 80,
      title: "Runner on 3rd, 1 Out",
      description: "High conversion spot.",
    });
  }

  // Close game late (≤1 run, 7th+)
  const close = Math.abs(score.home - score.away) <= 1;
  if (inning >= 7 && close) {
    A.push({
      kind: "CLOSE_GAME_LATE",
      priority: 70,
      title: "Close Game (Late)",
      description: "High leverage innings.",
    });
  }

  return A;
}