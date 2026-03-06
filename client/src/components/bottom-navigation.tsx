import { Link, useLocation } from "wouter";
import { Calendar, Settings, AlertTriangle, Bell } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

export function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Fetch alert count for badge
  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 60000,
  });

  // Always show all 3 tabs (Apple HIG: 3-5 tabs, always visible, never hidden)
  const navItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar", ariaLabel: "View game calendar" },
    { path: "/alerts", icon: Bell, label: "Alerts", testId: "nav-alerts", ariaLabel: "View alerts", badgeCount: (alertStats as any)?.unreadCount || 0 },
    { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings", ariaLabel: "Open settings" },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Glassmorphism background — 3-layer elevated surface */}
      <div className="bg-[#161B22]/95 backdrop-blur-xl border-t border-white/[0.08] shadow-2xl">
        <div className="flex max-w-md mx-auto">
          {navItems.map((item) => {
            const { path, icon: Icon, label, testId, ariaLabel } = item;
            const badgeCount = (item as any).badgeCount || 0;
            const isActive = location === path || (path === "/dashboard" && location === "/");

            return (
              <Link
                key={path}
                href={path}
                data-testid={testId}
                aria-label={ariaLabel}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 min-h-[56px] px-2 text-center relative flex flex-col items-center justify-center transition-colors duration-200 ease-out ${
                  isActive
                    ? "text-emerald-400 font-semibold"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                <div className="relative">
                  {/* Active indicator bar (Apple HIG — selected tab indicator) */}
                  {isActive && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-emerald-400 rounded-full" />
                  )}
                  <Icon className="w-6 h-6 mx-auto" strokeWidth={isActive ? 2.5 : 2} />
                  {badgeCount > 0 && (
                    <div
                      className="absolute -top-1.5 -right-2.5 bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold shadow-lg shadow-red-500/30"
                      style={{ fontSize: '11px', lineHeight: 1 }}
                      aria-label={`${badgeCount} unread alerts`}
                      role="status"
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </div>
                  )}
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider mt-1"
                  style={{ fontSize: '11px' }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
