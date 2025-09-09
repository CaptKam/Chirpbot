import { cn } from "@/lib/utils";

// Sport-specific color mapping for pills
function getSportPillColors(sport?: string): string {
  switch (sport?.toUpperCase()) {
    case 'MLB':
      return 'bg-green-500/15 ring-green-400/40 text-green-200';
    case 'NFL':
      return 'bg-orange-500/15 ring-orange-400/40 text-orange-200';
    case 'NBA':
      return 'bg-purple-500/15 ring-purple-400/40 text-purple-200';
    case 'WNBA':
      return 'bg-pink-500/15 ring-pink-400/40 text-pink-200';
    case 'CFL':
      return 'bg-red-500/15 ring-red-400/40 text-red-200';
    case 'NCAAF':
      return 'bg-blue-500/15 ring-blue-400/40 text-blue-200';
    case 'NHL':
      return 'bg-cyan-500/15 ring-cyan-400/40 text-cyan-200';
    default:
      return 'bg-emerald-500/15 ring-emerald-400/40 text-emerald-200';
  }
}

export function Pill({ children, className, sport }: { 
  children: React.ReactNode; 
  className?: string;
  sport?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 text-[12px]", getSportPillColors(sport), className)}>
      {children}
    </span>
  );
}