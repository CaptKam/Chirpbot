import { Link, useLocation } from "wouter";
import { Calendar, AlertTriangle, Settings, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function BottomNavigation() {
  const [location] = useLocation();
  
  // Get unseen alerts count
  const { data: unseenCount } = useQuery<{ count: number }>({
    queryKey: ['/api/alerts/unseen/count'],
    refetchInterval: 5000, // Check every 5 seconds
  });

  const navItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar" },
    { path: "/alerts", icon: AlertTriangle, label: "Alerts", testId: "nav-alerts" },
    { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
  ];

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
                {/* Show subtle indicator for unseen alerts */}
                {path === "/alerts" && unseenCount && unseenCount.count > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
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
