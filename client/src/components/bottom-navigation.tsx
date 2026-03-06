import { Link, useLocation } from "wouter";
import { Calendar, Bell, Settings, TrendingDown } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

// V3 Bottom Navigation — 5-tab with raised center "Matchup" button
// Design: solidBackground bg, slate-800 top border, raised primaryBlue center

export function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  const badgeCount = (alertStats as any)?.unreadCount || 0;

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-solidBackground border-t border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md mx-auto flex justify-between items-center px-6 py-4">
        {/* Scores */}
        <Link
          href="/dashboard"
          aria-label="View scores"
          aria-current={location === "/dashboard" || location === "/" ? "page" : undefined}
          data-testid="nav-calendar"
          className="flex flex-col items-center"
        >
          <svg
            className={`w-6 h-6 ${location === "/dashboard" || location === "/" ? "text-white" : "text-slate-500"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
          </svg>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${
            location === "/dashboard" || location === "/" ? "text-white" : "text-slate-500"
          }`}>
            Scores
          </span>
        </Link>

        {/* Standings / Calendar */}
        <Link
          href="/calendar"
          aria-label="View calendar"
          data-testid="nav-standings"
          className="flex flex-col items-center"
        >
          <svg
            className={`w-6 h-6 ${location === "/calendar" ? "text-white" : "text-slate-500"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
          </svg>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${
            location === "/calendar" ? "text-white" : "text-slate-500"
          }`}>
            Schedule
          </span>
        </Link>

        {/* Center: Matchup — raised button */}
        <Link
          href="/alerts"
          aria-label="View alerts and matchups"
          data-testid="nav-alerts"
          className="flex flex-col items-center -mt-8"
        >
          <div className="relative w-14 h-14 bg-primaryBlue rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(36,137,245,0.4)] border-4 border-solidBackground">
            <Bell className="w-7 h-7 text-white" strokeWidth={2.5} />
            {badgeCount > 0 && (
              <div
                className="absolute -top-1 -right-1 bg-chirpRed text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold shadow-lg shadow-chirpRed/30"
                style={{ fontSize: '10px', lineHeight: 1 }}
                aria-label={`${badgeCount} unread alerts`}
                role="status"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </div>
            )}
          </div>
          <span className="text-[9px] font-black tracking-widest uppercase mt-1 text-primaryBlue">
            Alerts
          </span>
        </Link>

        {/* News / Settings */}
        <Link
          href="/settings"
          aria-label="Open settings"
          data-testid="nav-settings"
          className="flex flex-col items-center"
        >
          <svg
            className={`w-6 h-6 ${location === "/settings" ? "text-white" : "text-slate-500"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
            <path d="M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${
            location === "/settings" ? "text-white" : "text-slate-500"
          }`}>
            Settings
          </span>
        </Link>

        {/* Bets (placeholder) */}
        <div className="flex flex-col items-center opacity-50 cursor-not-allowed">
          <TrendingDown className="w-6 h-6 text-slate-500" />
          <span className="text-[9px] font-bold tracking-widest uppercase mt-1 text-slate-500">
            Bets
          </span>
        </div>
      </div>
    </nav>
  );
}
