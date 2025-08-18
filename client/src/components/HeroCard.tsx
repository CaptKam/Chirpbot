export function HeroCard({
  title = "An epic battle on the field",
  subtitle = "Follow Live • Westfield Arena",
  cta = "Open Game",
  onClick,
}: { title?: string; subtitle?: string; cta?: string; onClick?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[rgb(27,42,82)] via-[rgb(20,31,63)] to-[rgb(15,22,38)] border border-[var(--divider)]">
      <img
        src="https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1500&auto=format&fit=crop"
        className="absolute inset-0 w-full h-full object-cover opacity-35"
        alt=""
      />
      <div className="relative p-5">
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[color:rgb(34_211_238_/_15%)] text-[var(--accent)]">
          LIVE MATCH
        </div>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        <button
          onClick={onClick}
          className="mt-4 inline-flex items-center rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}