import { Link, useLocation } from "wouter";
import { Bell, Settings, TrendingDown } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

// V3 Bottom Navigation — 5-tab with raised center Alerts button
// Lobby | Schedule | [Alerts] | Settings | Bets

export function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  const badgeCount = (alertStats as any)?.unreadCount || 0;

  const isLobby = location === "/dashboard" || location === "/";

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-[#101922]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-md mx-auto flex justify-between items-center px-6 py-4">
        {/* Lobby */}
        <Link
          href="/dashboard"
          aria-label="Lobby"
          aria-current={isLobby ? "page" : undefined}
          data-testid="nav-lobby"
          className="flex flex-col items-center"
        >
          {isLobby ? (
            <div className="size-10 flex items-center justify-center rounded-full bg-primaryBlue text-white shadow-[0_0_12px_rgba(36,137,245,0.15)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
          ) : (
            <div className="size-10 flex items-center justify-center rounded-full text-slate-500">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
          )}
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${isLobby ? "text-white" : "text-slate-500"}`}>
            Lobby
          </span>
        </Link>

        {/* Schedule */}
        <Link
          href="/calendar"
          aria-label="View schedule"
          data-testid="nav-calendar"
          className="flex flex-col items-center"
        >
          <div className={`size-10 flex items-center justify-center rounded-full ${location === "/calendar" ? "text-white" : "text-slate-500"}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
            </svg>
          </div>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${location === "/calendar" ? "text-white" : "text-slate-500"}`}>
            Schedule
          </span>
        </Link>

        {/* Center: Alerts — raised button */}
        <Link
          href="/alerts"
          aria-label="View alerts"
          data-testid="nav-alerts"
          className="flex flex-col items-center -mt-8"
        >
          <div className="relative w-14 h-14 bg-primaryBlue rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(36,137,245,0.15)] border-4 border-solidBackground">
            <Bell className="w-7 h-7 text-white" strokeWidth={2.5} />
            {badgeCount > 0 && (
              <div
                className="absolute -top-1 -right-1 bg-chirpRed text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold shadow-sm shadow-chirpRed/10"
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

        {/* Settings */}
        <Link
          href="/settings"
          aria-label="Open settings"
          data-testid="nav-settings"
          className="flex flex-col items-center"
        >
          <div className={`size-10 flex items-center justify-center rounded-full ${location === "/settings" ? "text-white" : "text-slate-500"}`}>
            <Settings className="w-5 h-5" />
          </div>
          <span className={`text-[9px] font-bold tracking-widest uppercase mt-1 ${location === "/settings" ? "text-white" : "text-slate-500"}`}>
            Settings
          </span>
        </Link>

        {/* Bets (placeholder) */}
        <div className="flex flex-col items-center opacity-50 cursor-not-allowed">
          <div className="size-10 flex items-center justify-center rounded-full text-slate-500">
            <TrendingDown className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase mt-1 text-slate-500">
            Bets
          </span>
        </div>
      </div>
    </nav>
  );
}
