import type { AlertUI } from '../adapters/types';

export function BaseDiamond({ on1, on2, on3 }:{on1?:boolean; on2?:boolean; on3?:boolean}) {
  return (
    <div className="relative h-6 w-6">
      {/* Infield dirt area */}
      <div className="absolute inset-0 bg-amber-900/20 rounded-sm border border-amber-700/30" />
      
      {/* Base paths */}
      <div className="absolute inset-0">
        {/* Home to 1st */}
        <div className="absolute bottom-0 left-1/2 w-px h-3 bg-white/20 rotate-45 origin-bottom" />
        {/* Home to 3rd */}
        <div className="absolute bottom-0 left-1/2 w-px h-3 bg-white/20 -rotate-45 origin-bottom" />
        {/* 1st to 2nd */}
        <div className="absolute right-0 top-1/2 w-3 h-px bg-white/20 rotate-45 origin-right" />
        {/* 2nd to 3rd */}
        <div className="absolute left-0 top-1/2 w-3 h-px bg-white/20 -rotate-45 origin-left" />
      </div>

      {/* Home plate (pentagon shape at bottom) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white border border-white/50" 
           style={{clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%)'}} />
      
      {/* Bases */}
      {/* 2nd base (top) */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 ${on2?'bg-emerald-400':'bg-white border border-white/50'}`} />
      
      {/* 3rd base (left) */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45 ${on3?'bg-emerald-400':'bg-white border border-white/50'}`} />
      
      {/* 1st base (right) */}
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45 ${on1?'bg-emerald-400':'bg-white border border-white/50'}`} />
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

export function CountPips({ balls, strikes, outs }:{balls:number; strikes:number; outs:number}) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-300">
      <span className="flex items-center gap-1">B<Pips filled={balls} total={3} /></span>
      <span className="flex items-center gap-1">S<Pips filled={strikes} total={2} /></span>
      <span className="flex items-center gap-1">O<Pips filled={outs} total={2} /></span>
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

      {/* type + confidence */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] rounded border border-emerald-500 text-emerald-400 px-1.5 py-0.5">{ui.typeLabel}</span>
        {ui.confidence!=null && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />{ui.confidence}%
          </span>
        )}
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

      {/* FOOTER: sport graphics + chips (order: graphics → chips) */}
      {(ui.footerGraphics?.length || ui.chips?.length) ? (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-300">
          {/* graphics slot */}
          {ui.footerGraphics?.length ? (
            <div className="flex items-center gap-3">
              {ui.footerGraphics.map((g, i) => <span key={i} className="flex items-center">{g}</span>)}
            </div>
          ) : null}

          {/* chips */}
          {ui.chips?.map((c, i) => (
            <span key={i} className="rounded-md bg-white/5 px-2 py-1">{c}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}