import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
      "bg-slate-800/80 text-slate-300 border border-slate-700/50",
      className
    )}>
      {children}
    </span>
  );
}