import { ReactNode } from "react";
import { Link } from "wouter";
import { Bell, Radio } from "lucide-react";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)] antialiased">
      <header className="sticky top-0 z-40 bg-[color:rgb(11_18_32/.7)] backdrop-blur border-b border-[var(--divider)]">
        <div className="mx-auto max-w-[1200px] h-14 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="size-7 rounded-xl bg-[var(--brand)] shadow-card" />
            <span className="font-semibold tracking-tight">ChirpBot</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[color:rgb(34_211_238_/_15%)] text-[var(--accent)] text-xs animate-pulseLive">
              <Radio className="size-3.5" /> LIVE
            </span>
            <button className="p-2 rounded-lg hover:bg-[var(--panel)] border border-[var(--divider)] transition-colors">
              <Bell className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-4">{children}</main>

      <div className="lg:hidden fixed inset-x-0 bottom-0">
        <BottomNavigation />
      </div>
    </div>
  );
}