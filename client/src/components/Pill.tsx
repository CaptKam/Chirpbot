import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      "bg-white/7 ring-1 ring-white/15 text-slate-200",
      className
    )}>
      {children}
    </span>
  );
}