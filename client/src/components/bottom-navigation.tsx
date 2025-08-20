import { Link, useLocation } from "wouter";
import { Calendar, AlertTriangle, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function BottomNavigation() {
  const [location] = useLocation();
  
  // Get unseen alerts count for badge
  const { data: unseenCount } = useQuery<{ count: number }>({
    queryKey: ["/api/alerts/unseen/count"],
    refetchInterval: 10000, // Update every 10 seconds
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
          const isAlertsTab = path === "/alerts";
          const hasUnseenAlerts = unseenCount && unseenCount.count > 0;
          
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
              <div className="relative inline-block">
                <Icon className="w-6 h-6 mb-1 mx-auto" />
                {/* Badge for unseen alerts */}
                {isAlertsTab && hasUnseenAlerts && unseenCount && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
                    {unseenCount.count > 99 ? '99+' : unseenCount.count}
                  </div>
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
