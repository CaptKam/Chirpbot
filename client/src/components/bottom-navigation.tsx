import { Link, useLocation } from "wouter";
import { Calendar, Settings, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";

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

  const baseNavItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar" },
  ];

  // Conditionally add Calendar, Alerts, and Settings tabs if there are games within two days
  const conditionalNavItems = hasGamesWithinTwoDays
    ? [
        { path: "/alerts", icon: AlertTriangle, label: "Alerts", testId: "nav-alerts" },
        { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
      ]
    : [];

  const navItems = [...baseNavItems, ...conditionalNavItems];

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white/5 backdrop-blur-md border-t border-white/10 shadow-xl z-50">
      <div className="flex">
        {navItems.map(({ path, icon: Icon, label, testId }) => {
          const isActive = location === path || (path === "/dashboard" && location === "/");

          return (
            <Link
              key={path}
              href={path}
              data-testid={testId}
              className={`flex-1 py-3 px-4 text-center transition-colors relative ${
                isActive
                  ? "text-emerald-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 mb-1 mx-auto" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">
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