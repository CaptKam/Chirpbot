import type { AlertUI } from '../adapters/types';

export function BaseDiamond({ on1, on2, on3 }:{on1?:boolean; on2?:boolean; on3?:boolean}) {
  return (
    <div className="relative h-7 w-7 rotate-45">
      <div className="absolute inset-0 rounded-sm bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-400/30" />
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-sm transition-all ${on2?'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-500/30':'bg-slate-700/50 border border-slate-500/30'}`} />
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-sm transition-all ${on3?'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-500/30':'bg-slate-700/50 border border-slate-500/30'}`} />
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-sm transition-all ${on1?'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-500/30':'bg-slate-700/50 border border-slate-500/30'}`} />
    </div>
  );
}

function Pips({ filled, total }:{filled:number; total:number}) {
  return (
    <div className="flex gap-1">
      {Array.from({length: total}).map((_,i)=>(
        <span key={i} className={`h-2.5 w-2.5 rounded-full transition-all ${i<filled?'bg-gradient-to-br from-blue-400 to-blue-500 shadow-sm':'bg-slate-700/50 border border-slate-500/30'}`} />
      ))}
    </div>
  );
}

export function CountPips({ balls, strikes, outs }:{balls:number; strikes:number; outs:number}) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium">
      <span className="flex items-center gap-1.5 text-blue-300">B <Pips filled={balls} total={3} /></span>
      <span className="flex items-center gap-1.5 text-orange-300">S <Pips filled={strikes} total={2} /></span>
      <span className="flex items-center gap-1.5 text-red-300">O <Pips filled={outs} total={2} /></span>
    </div>
  );
}

export function UniversalAlertCard({ ui }: { ui: AlertUI }) {
  // Determine alert urgency color based on confidence
  const getUrgencyColor = (confidence?: number) => {
    if (!confidence) return 'from-blue-500/20 to-blue-600/20 border-blue-400/40';
    if (confidence >= 85) return 'from-red-500/20 to-orange-500/20 border-red-400/40 animate-pulse';
    if (confidence >= 70) return 'from-yellow-500/20 to-orange-500/20 border-yellow-400/40';
    return 'from-blue-500/20 to-blue-600/20 border-blue-400/40';
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-blue-400';
    if (confidence >= 85) return 'text-red-400';
    if (confidence >= 70) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className={`p-5 rounded-xl bg-gradient-to-br ${getUrgencyColor(ui.confidence)} backdrop-blur-md border transition-all hover:scale-[1.02] hover:shadow-2xl`}>
      {/* header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{ui.sport}</span>
            {ui.confidence != null && ui.confidence >= 85 && (
              <span className="text-xs font-bold text-red-400 animate-pulse">🔥 HOT</span>
            )}
          </div>
          <span className="text-sm text-gray-300 font-medium">{ui.matchup}{ui.score ? <span className="ml-2 text-white font-bold">{ui.score}</span> : null}</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">{new Date(ui.createdAtISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>

      {/* type + confidence bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-slate-700 to-slate-600 text-white px-3 py-1 rounded-full shadow-lg">{ui.typeLabel}</span>
        {ui.confidence!=null && (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden max-w-[100px]">
              <div 
                className={`h-full bg-gradient-to-r ${ui.confidence >= 85 ? 'from-red-400 to-orange-400' : ui.confidence >= 70 ? 'from-yellow-400 to-orange-400' : 'from-blue-400 to-cyan-400'} transition-all`}
                style={{ width: `${ui.confidence}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${getConfidenceColor(ui.confidence)}`}>{ui.confidence}%</span>
          </div>
        )}
      </div>

      {/* message - larger and bolder */}
      <h4 className="font-bold text-lg mb-3 text-white leading-tight line-clamp-2">{ui.message}</h4>

      {/* people pills - more prominent */}
      {ui.people?.length ? (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {ui.people.map((p,i)=>(
            <span key={i} className="rounded-lg bg-gradient-to-r from-slate-700/70 to-slate-600/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm border border-slate-500/20">
              <span className="text-gray-400">{p.label}:</span> <span className="text-white font-bold ml-1">{p.value}</span>
            </span>
          ))}
        </div>
      ):null}

      {/* FOOTER: sport graphics + chips */}
      {(ui.footerGraphics?.length || ui.chips?.length) ? (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-600/30">
          {/* graphics slot */}
          {ui.footerGraphics?.length ? (
            <div className="flex items-center gap-4">
              {ui.footerGraphics.map((g, i) => <span key={i} className="flex items-center">{g}</span>)}
            </div>
          ) : null}

          {/* chips - more visible */}
          {ui.chips?.map((c, i) => (
            <span key={i} className="rounded-lg bg-slate-700/50 px-2.5 py-1 text-xs font-medium text-gray-300 backdrop-blur-sm border border-slate-600/30">{c}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}