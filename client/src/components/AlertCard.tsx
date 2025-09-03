import React from "react";
import clsx from "clsx";
import { SwipeableCard } from "./SwipeableCard";

/**
 * Redesigned Alert Card (drop‑in)
 * - Dynamic priority color bar & badge
 * - Icon by alert type
 * - Clear hierarchy: type → message → matchup → context footer
 * - Optional action buttons (ACK / MUTE / RESEND)
 * - Works standalone (uses simple <Badge/> + <SwipeableCard/> fallbacks)
 */

// ---------------- Types ----------------
export type AlertType =
  | "RISP_CHANCE"
  | "SCORING_PROBABILITY"
  | "BASES_LOADED"
  | "WIND_JETSTREAM"
  | "HR_HITTER_AT_BAT"
  | "LATE_PRESSURE"
  | "NINTH_TIE"
  | "CLOSE_GAME_LATE"
  | "HOME_RUN";

export type InningHalf = "Top" | "Bottom";

export type AlertCardProps = {
  sport: "MLB" | "NFL" | "NBA" | string;
  type: AlertType | string;
  priority: number; // 0‑100
  timeIso?: string;
  message: string;
  matchup: { away: string; home: string };
  context?: {
    inning?: { number: number; half: InningHalf };
    timeLeft?: string; // for non‑MLB
    outs?: number; // 0..2
    count?: { b: number; s: number };
    runners?: { first: boolean; second: boolean; third: boolean };
  };
  // Action handlers (optional)
  onAck?: () => void;
  onMute?: () => void;
  onResend?: () => void;
  className?: string;
  alertId?: string;
  alertData?: any;
  // NEW: OpenAI live status
  liveStatus?: 'LIVE' | 'UPDATED' | 'EXPIRED';
  openaiEnhanced?: boolean;
};

// --------------- Helpers ---------------
const getAlertIcon = (type: string) => {
  switch (type) {
    case "RISP_CHANCE":
    case "SCORING_PROBABILITY":
      return <span className="text-2xl">🔥</span>;
    case "BASES_LOADED":
      return <span className="text-2xl">🚨</span>;
    case "WIND_JETSTREAM":
      return <span className="text-2xl">💨</span>;
    case "HR_HITTER_AT_BAT":
      return <span className="text-2xl">⚾</span>;
    case "LATE_PRESSURE":
    case "NINTH_TIE":
      return <span className="text-2xl">⚡</span>;
    case "CLOSE_GAME_LATE":
      return <span className="text-2xl">📈</span>;
    case "HOME_RUN":
      return <span className="text-2xl">💥</span>;
    default:
      return <span className="text-2xl">🚀</span>;
  }
};

const getPriorityGradient = (priority: number) => {
  if (priority >= 90) return "from-red-500 to-red-600 shadow-red-500/25";
  if (priority >= 80) return "from-orange-500 to-orange-600 shadow-orange-500/25";
  if (priority >= 70) return "from-yellow-500 to-yellow-600 shadow-yellow-500/25";
  return "from-blue-500 to-blue-600 shadow-blue-500/25";
};

const getPriorityText = (priority: number) => {
  if (priority >= 90) return { label: "URGENT", text: "text-red-400", ring: "ring-red-300/40" };
  if (priority >= 80) return { label: "HIGH", text: "text-orange-400", ring: "ring-orange-300/40" };
  if (priority >= 70) return { label: "MEDIUM", text: "text-yellow-400", ring: "ring-yellow-300/40" };
  return { label: "NORMAL", text: "text-blue-400", ring: "ring-blue-300/40" };
};

const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
};

// --------------- Fallback UI atoms ---------------
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

// --------------- Baseball Diamond (MLB) ---------------
function BaseballDiamond({
  runners = { first: false, second: false, third: false },
  size = 56,
}: {
  runners?: { first: boolean; second: boolean; third: boolean };
  size?: number;
}) {
  const s = size;
  const cx = s / 2, cy = s / 2, off = s * 0.35, base = s * 0.18;
  const bases = [
    { x: cx, y: cy - off, occ: runners.second }, // 2nd
    { x: cx + off, y: cy, occ: runners.first },  // 1st
    { x: cx, y: cy + off, occ: runners.third },  // 3rd
    { x: cx - off, y: cy, occ: false },          // home (display only)
  ];
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      <polygon points={`${cx},${cy - off} ${cx + off},${cy} ${cx},${cy + off} ${cx - off},${cy}`} fill="#0b1220" stroke="#1f2937" strokeWidth={2} />
      {bases.map((b, i) => (
        <g key={i} transform={`translate(${b.x - base / 2}, ${b.y - base / 2}) rotate(45 ${base / 2} ${base / 2})`}>
          <rect width={base} height={base} rx={2} fill={b.occ ? "#16a34a" : "#0b1220"} stroke="#64748b" strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}

// --------------- Context Footer ---------------
function ContextFooter({
  sport,
  context,
}: {
  sport: string;
  context?: AlertCardProps["context"];
}) {
  if (sport !== "MLB") {
    return (
      <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-slate-200 text-sm">
        <div className="flex items-center justify-between">
          <span>Game time: {context?.timeLeft ?? "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 mt-2">
      <div className="flex items-center gap-4">
        <BaseballDiamond runners={context?.runners} />
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-slate-200 mb-2">
            {context?.inning ? `${context.inning.half} ${context.inning.number}` : "Inning —"}
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
            <div>
              <span className="text-slate-400">Outs:</span>
              <div className="font-semibold text-white">{context?.outs ?? "-"}</div>
            </div>
            <div>
              <span className="text-slate-400">Count:</span>
              <div className="font-semibold text-white">{context?.count ? `${context.count.b}-${context.count.s}` : "-"}</div>
            </div>
            <div>
              <span className="text-slate-400">RISP:</span>
              <div className="font-semibold text-white">{context?.runners?.second || context?.runners?.third ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------- Main Card ---------------
export default function AlertCard({ 
  sport, 
  type, 
  priority, 
  timeIso, 
  message, 
  matchup, 
  context, 
  onAck, 
  onMute, 
  onResend, 
  className,
  alertId,
  alertData,
  liveStatus,
  openaiEnhanced
}: AlertCardProps) {
  const grad = getPriorityGradient(priority);
  const { label, text, ring } = getPriorityText(priority);

  return (
    <SwipeableCard 
      className={clsx("border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-lg", className)}
      alertId={alertId || ''}
      alertData={alertData}
    >
      <div className="relative overflow-hidden">
        {/* Priority bar */}
        <div className={clsx("h-1 w-full bg-gradient-to-r shadow-lg", grad)} />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getAlertIcon(type)}
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wide">{sport}</span>
                <Badge className={clsx("border-2 px-2 py-0.5", text, ring)}>{label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Live Status Badge */}
              {liveStatus && (
                <Badge 
                  className={clsx(
                    "text-xs font-bold px-2 py-0.5 border-2",
                    liveStatus === 'LIVE' && "bg-green-500/20 text-green-300 border-green-500",
                    liveStatus === 'UPDATED' && "bg-blue-500/20 text-blue-300 border-blue-500",
                    liveStatus === 'EXPIRED' && "bg-gray-500/20 text-gray-300 border-gray-500"
                  )}
                >
                  {liveStatus === 'LIVE' && '🔴 LIVE'}
                  {liveStatus === 'UPDATED' && '🔄 UPDATED'} 
                  {liveStatus === 'EXPIRED' && '⏰ EXPIRED'}
                </Badge>
              )}
              {/* OpenAI Enhancement Indicator */}
              {openaiEnhanced && (
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500 text-xs px-1.5 py-0.5">
                  🤖 AI
                </Badge>
              )}
              <span className="text-slate-400 text-xs font-medium">{timeAgo(timeIso)}</span>
            </div>
          </div>

          {/* Message */}
          <h3 className="text-xl font-bold mb-4 text-white leading-tight tracking-wide">{message}</h3>

          {/* Matchup */}
          <div className="mb-4 text-center">
            <p className="text-slate-300 font-medium text-lg">{matchup.away} <span className="opacity-70">vs</span> {matchup.home}</p>
          </div>

          {/* Context footer */}
          <ContextFooter sport={sport} context={context} />

          {/* Actions (optional) */}
          {(onAck || onMute || onResend) && (
            <div className="mt-3 flex items-center gap-2">
              {onAck && (
                <button onClick={onAck} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">ACK</button>
              )}
              {onMute && (
                <button onClick={onMute} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">MUTE</button>
              )}
              {onResend && (
                <button onClick={onResend} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700">RESEND</button>
              )}
              {/* Priority chip on the right */}
              <div className="ml-auto text-xs text-slate-400">Priority: <span className="font-semibold text-slate-200">{priority}</span></div>
            </div>
          )}
        </div>
      </div>
    </SwipeableCard>
  );
}