import { clsx } from "clsx";
import React from "react";

export interface AlertCardProps {
  sport: string;
  type: string;
  priority: number;
  timeIso?: string;
  message: string;
  matchup: { home: string; away: string };
  context?: {
    inning?: { number: number; half: string };
    outs?: number;
    count?: { b: number; s: number };
    runners?: { first?: boolean; second?: boolean; third?: boolean };
    timeLeft?: string;
  };
  onAck?: () => void;
  onMute?: () => void;
  onResend?: () => void;
  className?: string;
  alertId?: string;
  alertData?: any;
  liveStatus?: 'LIVE' | 'UPDATED' | 'EXPIRED';
  openaiEnhanced?: boolean;
}

// Swipeable card wrapper
function SwipeableCard({ 
  children, 
  className, 
  alertId, 
  alertData 
}: { 
  children: React.ReactNode; 
  className?: string; 
  alertId: string; 
  alertData?: any; 
}) {
  return (
    <div className={clsx(
      "rounded-lg border text-card-foreground shadow-sm",
      "bg-white/5 backdrop-blur-sm transition-all duration-300",
      className
    )}>
      {children}
    </div>
  );
}

// Alert type icons
const getAlertIcon = (type: string) => {
  switch (type) {
    case "RISP":
    case "RUNNERS_1ST_2ND": 
    case "BASES_LOADED":
      return <span className="text-2xl">⚾</span>;
    case "LATE_PRESSURE":
    case "NINTH_TIE":
      return <span className="text-2xl">⚡</span>;
    case "CLOSE_GAME_LATE":
    case "CLOSE_GAME":
      return <span className="text-2xl">📈</span>;
    case "HOME_RUN":
      return <span className="text-2xl">💥</span>;
    case "HIGH_SCORING":
      return <span className="text-2xl">🔥</span>;
    default:
      return <span className="text-2xl">🚀</span>;
  }
};

// Priority styling
const getPriorityGradient = (priority: number) => {
  if (priority >= 90) return "from-red-500 to-red-600";
  if (priority >= 80) return "from-orange-500 to-orange-600";
  if (priority >= 70) return "from-yellow-500 to-yellow-600";
  return "from-blue-500 to-blue-600";
};

const getPriorityBadge = (priority: number) => {
  if (priority >= 90) return { label: "URGENT", color: "bg-red-500/20 text-red-300 border-red-500" };
  if (priority >= 80) return { label: "HIGH", color: "bg-orange-500/20 text-orange-300 border-orange-500" };
  if (priority >= 70) return { label: "MEDIUM", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500" };
  return { label: "NORMAL", color: "bg-blue-500/20 text-blue-300 border-blue-500" };
};

// Time formatting
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

// Badge component
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
      className
    )}>
      {children}
    </span>
  );
}

// Baseball Diamond Visual
function BaseballDiamond({
  runners = { first: false, second: false, third: false },
  size = 60,
}: {
  runners?: { first?: boolean; second?: boolean; third?: boolean };
  size?: number;
}) {
  const s = size;
  const cx = s / 2, cy = s / 2, offset = s * 0.3, baseSize = s * 0.15;
  
  const bases = [
    { x: cx, y: cy - offset, occupied: runners.second, label: '2nd' },
    { x: cx + offset, y: cy, occupied: runners.first, label: '1st' },
    { x: cx, y: cy + offset, occupied: runners.third, label: '3rd' },
    { x: cx - offset, y: cy, occupied: false, label: 'Home' },
  ];

  return (
    <div className="flex-shrink-0">
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="drop-shadow-sm">
        {/* Diamond outline */}
        <polygon 
          points={`${cx},${cy - offset} ${cx + offset},${cy} ${cx},${cy + offset} ${cx - offset},${cy}`} 
          fill="rgba(15, 23, 42, 0.8)" 
          stroke="rgba(100, 116, 139, 0.6)" 
          strokeWidth="2" 
        />
        
        {/* Bases */}
        {bases.map((base, i) => (
          <g key={i} transform={`translate(${base.x - baseSize/2}, ${base.y - baseSize/2}) rotate(45 ${baseSize/2} ${baseSize/2})`}>
            <rect 
              width={baseSize} 
              height={baseSize} 
              rx="2" 
              fill={base.occupied ? "#22c55e" : "rgba(15, 23, 42, 0.8)"} 
              stroke={base.occupied ? "#16a34a" : "rgba(100, 116, 139, 0.6)"} 
              strokeWidth="2"
              className="transition-all duration-300"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// Game Context Display
function GameContext({ sport, context }: { sport: string; context?: AlertCardProps["context"] }) {
  if (sport !== "MLB") {
    return (
      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
        <div className="text-sm text-slate-300">
          Game Time: <span className="font-semibold text-white">{context?.timeLeft || "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
      <div className="flex items-center gap-4">
        <BaseballDiamond runners={context?.runners} />
        
        <div className="flex-1">
          {/* Inning */}
          <div className="text-sm font-medium text-slate-200 mb-3">
            {context?.inning ? `${context.inning.half} ${context.inning.number}` : "Inning TBD"}
          </div>
          
          {/* Game Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">Outs</div>
              <div className="text-lg font-bold text-white">{context?.outs ?? "—"}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">Count</div>
              <div className="text-lg font-bold text-white">
                {context?.count ? `${context.count.b}-${context.count.s}` : "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">RISP</div>
              <div className={clsx(
                "text-lg font-bold",
                (context?.runners?.second || context?.runners?.third) 
                  ? "text-green-400" 
                  : "text-slate-400"
              )}>
                {(context?.runners?.second || context?.runners?.third) ? "YES" : "NO"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Alert Card Component
export default function AlertCard(props: AlertCardProps) {
  const {
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
  } = props;

  const priorityGrad = getPriorityGradient(priority);
  const priorityBadge = getPriorityBadge(priority);

  return (
    <SwipeableCard 
      className={clsx("border-white/10 hover:border-white/20", className)}
      alertId={alertId || ''}
      alertData={alertData}
    >
      {/* Priority Header Bar */}
      <div className={clsx("h-1 w-full bg-gradient-to-r", priorityGrad)} />
      
      <div className="p-6 space-y-6">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getAlertIcon(type)}
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wider">{sport}</span>
              <Badge className={clsx("border font-bold px-2 py-1", priorityBadge.color)}>
                {priorityBadge.label}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Live Status */}
            {liveStatus && (
              <Badge className={clsx(
                "font-bold border",
                liveStatus === 'LIVE' && "bg-green-500/20 text-green-300 border-green-500",
                liveStatus === 'UPDATED' && "bg-blue-500/20 text-blue-300 border-blue-500",
                liveStatus === 'EXPIRED' && "bg-gray-500/20 text-gray-300 border-gray-500"
              )}>
                {liveStatus === 'LIVE' && '🔴 LIVE'}
                {liveStatus === 'UPDATED' && '🔄 UPDATED'}
                {liveStatus === 'EXPIRED' && '⏰ EXPIRED'}
              </Badge>
            )}
            
            {/* OpenAI Enhanced */}
            {openaiEnhanced && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500 font-bold">
                🤖 AI
              </Badge>
            )}
            
            <span className="text-slate-400 text-xs font-medium">{timeAgo(timeIso)}</span>
          </div>
        </div>

        {/* Alert Message */}
        <div>
          <h3 className="text-2xl font-bold text-white leading-tight mb-2">
            {message}
          </h3>
        </div>

        {/* Team Matchup */}
        <div className="text-center py-2">
          <p className="text-slate-300 font-semibold text-lg">
            {matchup.away} <span className="text-slate-500 mx-2">vs</span> {matchup.home}
          </p>
        </div>

        {/* Game Context */}
        <GameContext sport={sport} context={context} />

        {/* Action Buttons */}
        {(onAck || onMute || onResend) && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              {onAck && (
                <button 
                  onClick={onAck}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Acknowledge
                </button>
              )}
              {onMute && (
                <button 
                  onClick={onMute}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Mute
                </button>
              )}
              {onResend && (
                <button 
                  onClick={onResend}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Resend
                </button>
              )}
            </div>
            
            <div className="text-xs text-slate-500">
              Priority: <span className="font-semibold text-slate-300">{priority}</span>
            </div>
          </div>
        )}
      </div>
    </SwipeableCard>
  );
}