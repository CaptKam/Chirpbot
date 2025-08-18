import { Link, useLocation } from "wouter";
import { Calendar, AlertTriangle, Settings } from "lucide-react";

export function BottomNavigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar" },
    { path: "/alerts", icon: AlertTriangle, label: "Alerts", testId: "nav-alerts" },
    { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-chirp-border-gray shadow-lg z-50">
      <div className="flex">
        {navItems.map(({ path, icon: Icon, label, testId }) => {
          const isActive = location === path || (path === "/dashboard" && location === "/");
          return (
            <Link
              key={path}
              href={path}
              data-testid={testId}
              className={`flex-1 py-3 px-4 text-center transition-colors ${
                isActive 
                  ? "text-chirp-cta-blue font-bold" 
                  : "text-chirp-text-muted hover:text-chirp-text-dark"
              }`}
            >
              <Icon className="w-6 h-6 mb-1 mx-auto" />
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
