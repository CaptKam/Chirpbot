import { Link, useLocation } from "wouter";
import { Calendar, Settings, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";

export function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const baseNavItems = [
    { path: "/dashboard", icon: Calendar, label: "Calendar", testId: "nav-calendar" },
    { path: "/alerts", icon: AlertTriangle, label: "Alerts", testId: "nav-alerts" },
    { path: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
  ];

  // Keep navigation clean - admin access via web panel
  const navItems = baseNavItems;

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