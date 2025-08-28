import { cn } from "@/lib/utils";

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 bg-orange-500/15 ring-orange-400/40 text-orange-200 text-[12px]">
      {children}
    </span>
  );
}