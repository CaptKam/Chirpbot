import { cn } from "@/lib/utils";

type Runners = { first?: boolean; second?: boolean; third?: boolean };

export function RunnersDiamond({ r }: { r: Runners }) {
  // tiny diamond made of 4 squares; highlight 1B/2B/3B as filled
  return (
    <div className="relative w-10 h-10">
      {/* 2B */}
      <div className={cn(
        "absolute left-1/2 top-0 -translate-x-1/2 w-3 h-3 rotate-45 border border-white/30",
        r.second && "bg-yellow-300/90 border-yellow-300/90"
      )}/>
      {/* 3B */}
      <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border border-white/30",
        r.third && "bg-yellow-300/90 border-yellow-300/90"
      )}/>
      {/* 1B */}
      <div className={cn(
        "absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border border-white/30",
        r.first && "bg-yellow-300/90 border-yellow-300/90"
      )}/>
      {/* Home */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-3 h-3 rotate-45 border border-white/20"/>
    </div>
  );
}