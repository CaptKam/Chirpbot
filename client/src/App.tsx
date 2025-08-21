import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import Calendar from "./pages/calendar";
import Alerts from "./pages/alerts";
import Settings from "./pages/settings";
import Signup from "./pages/signup";
import Login from "./pages/login";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/AdminLogin";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

function ProtectedRoute({ component: Component, requireAdmin = false }: { component: React.ComponentType; requireAdmin?: boolean }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center p-8 bg-red-900/20 rounded-lg border border-red-500/30">
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-slate-300">Admin privileges required to access this page.</p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#0B1220] to-[#0F1A32] text-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AppContent() {
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get settings to check if push notifications are enabled
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (lastMessage && isAuthenticated) {
      switch (lastMessage.type) {
        case 'new_alert':
          const alertData = lastMessage.data as any;
          
          // Find the sport-specific settings
          // Settings can be either an array of settings objects or undefined
          const settingsArray = Array.isArray(settings) ? settings : [];
          const sportSettings = settingsArray.find((s: any) => s.sport === alertData.sport);
          
          // Only show toast if push notifications are enabled
          if (!sportSettings?.pushNotificationsEnabled) {
            return;
          }
          
          const gameInfo = alertData.gameInfo || {};
          const score = gameInfo.score ? `${gameInfo.awayTeam} ${gameInfo.score.away} - ${gameInfo.score.home} ${gameInfo.homeTeam}` : alertData.title;
          const inningInfo = gameInfo.inning ? `Inning ${gameInfo.inning} ${gameInfo.inningState === 'top' ? '▲' : '▼'}` : '';
          
          toast({
            title: `⚡ ${alertData.type}`,
            description: (
              <div className="space-y-1">
                <div className="font-semibold">{alertData.description}</div>
                <div className="text-xs opacity-80">{score}</div>
                {inningInfo && <div className="text-xs opacity-80">{inningInfo}</div>}
              </div>
            ),
            action: (
              <ToastAction altText="View Alerts" onClick={() => setLocation('/alerts')}>
                View
              </ToastAction>
            ),
          });
          break;
        case 'team_monitoring_changed':
          // Handle team monitoring changes if needed
          break;
        case 'settings_changed':
          // Handle settings changes if needed
          break;
      }
    }
  }, [lastMessage, toast, isAuthenticated, settings, setLocation]);

  return (
    <div className={isAuthenticated ? "max-w-md mx-auto bg-transparent min-h-screen relative" : "min-h-screen"}>
      <Switch>
        <Route path="/" component={() => <PublicRoute component={Landing} />} />
        <Route path="/login" component={() => <PublicRoute component={Login} />} />
        <Route path="/signup" component={() => <PublicRoute component={Signup} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Calendar} />} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} requireAdmin={true} />} />
        <Route component={NotFound} />
      </Switch>
      {isAuthenticated && <BottomNavigation />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-gradient-to-b from-[#0B1220] to-[#0F1A32] min-h-screen text-slate-100 antialiased">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
