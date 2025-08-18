import { ChevronRight } from "lucide-react";

export function MatchRow({
  a, b, time, venue, onClick,
}: {
  a: { name: string; abbr?: string; color?: string };
  b: { name: string; abbr?: string; color?: string };
  time: string;
  venue?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-16 rounded-xl bg-[var(--panel)] border border-[var(--divider)] flex items-center gap-3 px-3 hover:bg-[color:rgb(18_26_42_/_92%)] transition-colors"
    >
      <span className="w-1.5 h-10 rounded-full" style={{ background: a.color ?? '#EF4444' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="truncate font-medium">{a.name} vs {b.name}</p>
          <p className="font-tabular text-sm text-[var(--muted)]">{time}</p>
        </div>
        <p className="text-xs text-[var(--muted)] truncate">{venue}</p>
      </div>
      <ChevronRight className="size-4 text-[var(--muted)]" />
    </button>
  );
}