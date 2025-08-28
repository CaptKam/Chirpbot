import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 text-[14px]",
      className || "bg-emerald-500/10 ring-emerald-500/30 text-emerald-300"
    )}>
      {children}
    </span>
  );
}