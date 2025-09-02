import type { AlertUI } from '../adapters/types';

export function BaseDiamond({ on1, on2, on3 }:{on1?:boolean; on2?:boolean; on3?:boolean}) {
  return (
    <div className="relative h-6 w-6 rotate-45">
      <div className="absolute inset-0 rounded-sm border border-white/30" />
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-sm ${on2?'bg-emerald-400':'border border-white/30'}`} />
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-sm ${on3?'bg-emerald-400':'border border-white/30'}`} />
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-sm ${on1?'bg-emerald-400':'border border-white/30'}`} />
    </div>
  );
}

function Pips({ filled, total }:{filled:number; total:number}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({length: total}).map((_,i)=>(
        <span key={i} className={`h-2 w-2 rounded-full ${i<filled?'bg-emerald-400':'border border-white/30'}`} />
      ))}
    </div>
  );
}

export function UniversalAlertCard({ ui }: { ui: AlertUI }) {
  return (
    <div className="p-4">
      {/* header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xs font-semibold">{ui.sport}</span>
          <span className="text-slate-200 text-xs">{ui.matchup}{ui.score ? <span className="ml-2 text-slate-400">{ui.score}</span> : null}</span>
        </div>
        <span className="text-slate-400 text-[10px]">{new Date(ui.createdAtISO).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>

      {/* type + confidence + quick visuals */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] rounded border border-emerald-500 text-emerald-400 px-1.5 py-0.5">{ui.typeLabel}</span>
          {ui.confidence!=null && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />{ui.confidence}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {ui.bases && <BaseDiamond on1={ui.bases.on1} on2={ui.bases.on2} on3={ui.bases.on3} />}
          {ui.pips && ui.pips.length>0 && (
            <div className="flex items-center gap-3 text-[10px] text-slate-300">
              {ui.pips.map((p,i)=>(
                <span key={i} className="flex items-center gap-1">{p.label}<Pips filled={p.filled} total={p.total} /></span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* message */}
      <h4 className="font-semibold mb-2 text-slate-100 line-clamp-2">{ui.message}</h4>

      {/* people pills */}
      {ui.people?.length ? (
        <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
          {ui.people.map((p,i)=>(
            <span key={i} className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">{p.label}: <span className="text-slate-100">{p.value}</span></span>
          ))}
        </div>
      ):null}

      {/* footer chips */}
      {ui.chips?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
          {ui.chips.map((c,i)=>(
            <span key={i} className="rounded-md bg-white/5 px-2 py-1">{c}</span>
          ))}
        </div>
      ):null}
    </div>
  );
}