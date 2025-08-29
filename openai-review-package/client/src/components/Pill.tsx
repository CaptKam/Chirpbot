import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 text-[12px] bg-emerald-500/15 ring-emerald-400/40 text-emerald-200", className)}>
      {children}
    </span>
  );
}