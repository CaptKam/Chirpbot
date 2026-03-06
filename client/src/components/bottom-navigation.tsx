import { Link, useLocation } from "wouter";
import { Calendar, Settings, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

// Placeholder for the utility hook to check for games within the next two days.
// This hook should fetch game data and return a boolean indicating availability.
// For now, we'll assume it returns true to display the tabs.
const useGamesAvailability = () => {
  // Replace this with actual game data fetching and logic
  const hasGamesWithinTwoDays = true;
  return { hasGamesWithinTwoDays };
};

export function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { hasGamesWithinTwoDays } = useGamesAvailability();

  // Fetch alert count for badge
  const { data: alertStats } = useQuery({
    queryKey: ['/api/alerts/stats'],
    refetchInterval: 10000, // Refetch every 10 seconds for timely badge updates
    enabled: hasGamesWithinTwoDays,
  });

  const baseNavItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar" },
  ];

  // Conditionally add Calendar, Alerts, and Settings tabs if there are games within two days
  const conditionalNavItems = hasGamesWithinTwoDays
    ? [
        { path: "/alerts", icon: AlertTriangle, label: "Alerts", testId: "nav-alerts", badgeCount: (alertStats as any)?.unreadCount || 0 },
        { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
      ]
    : [];

  const navItems = [...baseNavItems, ...conditionalNavItems];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-lg border-t border-white/10 shadow-2xl z-50">
      <div className="flex max-w-md mx-auto">
        {navItems.map((item) => {
          const { path, icon: Icon, label, testId } = item;
          const badgeCount = (item as any).badgeCount || 0;
          const isActive = location === path || (path === "/dashboard" && location === "/");

          return (
            <Link
              key={path}
              href={path}
              data-testid={testId}
              className={`flex-1 py-4 px-2 sm:px-4 text-center transition-colors relative min-h-[60px] flex flex-col items-center justify-center ${
                isActive
                  ? "text-emerald-400 font-bold"
                  : "text-slate-200 hover:text-slate-100"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 mx-auto" />
                {badgeCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center font-bold">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-1">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder for the Calendar page component logic.
// This component should load today's and tomorrow's games if hasGamesWithinTwoDays is true,
// and display a "Tomorrow's Games" title.
// export function CalendarPage() {
//   const { hasGamesWithinTwoDays } = useGamesAvailability();
//   // ... rest of the calendar page logic
//   return (
//     <div>
//       {hasGamesWithinTwoDays ? (
//         <>
//           <h2>Tomorrow's Games</h2>
//           {/* Display today's and tomorrow's games */}
//         </>
//       ) : (
//         <p>No games scheduled for the next two days.</p>
//       )}
//     </div>
//   );
// }