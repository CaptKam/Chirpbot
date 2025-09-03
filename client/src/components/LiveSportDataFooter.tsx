interface GameContext {
  outs?: number;
  balls?: number;
  strikes?: number;
  down?: number;
  yardsToGo?: number;
  timeRemaining?: string;
  hasFirst?: boolean;
  hasSecond?: boolean;
  hasThird?: boolean;
}

interface LiveSportDataFooterProps {
  sport: string;
  context?: GameContext;
  priority?: number;
}

export function LiveSportDataFooter({ sport, context, priority }: LiveSportDataFooterProps) {
  return (
    <div className="space-y-2">
      {/* Compact Game Situation */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        {/* MLB Specific */}
        {sport === 'MLB' && context?.outs !== undefined && (
          <div className="bg-slate-800/50 rounded p-2 text-center border border-slate-700/30">
            <div className="text-xs text-slate-400">OUTS</div>
            <div className="text-sm font-bold text-white">{context.outs}</div>
          </div>
        )}

        {sport === 'MLB' && (context?.balls !== undefined || context?.strikes !== undefined) && (
          <div className="bg-slate-800/50 rounded p-2 text-center border border-slate-700/30">
            <div className="text-xs text-slate-400">COUNT</div>
            <div className="text-sm font-bold text-white">
              {context?.balls ?? 0}-{context?.strikes ?? 0}
            </div>
          </div>
        )}

        {/* Football Specific */}
        {(sport === 'NFL' || sport === 'NCAAF' || sport === 'CFL') && context?.down && (
          <div className="bg-slate-800/50 rounded p-2 text-center border border-slate-700/30">
            <div className="text-xs text-slate-400">DOWN</div>
            <div className="text-sm font-bold text-white">
              {context.down}&{context.yardsToGo || 10}
            </div>
          </div>
        )}

        {/* Universal Time */}
        {context?.timeRemaining && (
          <div className="bg-slate-800/50 rounded p-2 text-center border border-slate-700/30">
            <div className="text-xs text-slate-400">TIME</div>
            <div className="text-sm font-bold text-white">{context.timeRemaining}</div>
          </div>
        )}

        {/* Priority */}
        <div className="bg-slate-800/50 rounded p-2 text-center border border-slate-700/30">
          <div className="text-xs text-slate-400">PRI</div>
          <div className={`text-sm font-bold ${(priority ?? 0) >= 90 ? 'text-red-400' : (priority ?? 0) >= 80 ? 'text-orange-400' : (priority ?? 0) >= 70 ? 'text-yellow-400' : 'text-blue-400'}`}>
            {priority ?? 0}
          </div>
        </div>
      </div>

      {/* Compact Base Runners (MLB only) */}
      {sport === 'MLB' && (context?.hasFirst || context?.hasSecond || context?.hasThird) && (
        <div className="flex justify-center mt-2">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rotate-45 border border-slate-600 bg-slate-800/30"></div>
            <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${context?.hasSecond ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
            <div className={`absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${context?.hasFirst ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
            <div className={`absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${context?.hasThird ? 'bg-emerald-400 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-slate-600 border border-slate-500"></div>
          </div>
        </div>
      )}
    </div>
  );
}