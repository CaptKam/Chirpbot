import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import Calendar from "./pages/calendar";
import Settings from "./pages/settings";
import Admin from "./pages/admin";
import Signup from "./pages/signup";
import Login from "./pages/login";
import Alerts from "./pages/alerts";
import V3PerformanceDashboard from "./pages/v3-performance-dashboard";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { AuthLoading } from "@/components/sports-loading";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function RegularAppContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { lastMessage } = useWebSocket();

  // Get settings to check if push notifications are enabled
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (lastMessage && isAuthenticated) {
      switch (lastMessage.type) {
        case 'team_monitoring_changed':
          // Handle team monitoring changes
          break;
        case 'settings_changed':
          // Handle settings changes if needed
          break;
      }
    }
  }, [lastMessage, toast, isAuthenticated, settings, setLocation]);

  // Check if current route is V3 dashboard for wider layout
  const [location] = useLocation();
  const isV3Dashboard = location === '/v3-dashboard';
  
  return (
    <div className={isAuthenticated ? `${isV3Dashboard ? 'max-w-7xl' : 'max-w-md'} mx-auto bg-transparent min-h-screen relative` : "min-h-screen"}>
      <Switch>
        <Route path="/" component={() => <PublicRoute component={Landing} />} />
        <Route path="/login" component={() => <PublicRoute component={Login} />} />
        <Route path="/signup" component={() => <PublicRoute component={Signup} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Calendar} />} />
        <Route path="/alerts" component={() => <ProtectedRoute component={Alerts} />} />
        <Route path="/v3-dashboard" component={() => <ProtectedRoute component={V3PerformanceDashboard} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/admin" component={() => <ProtectedRoute component={Admin} />} />
        <Route component={NotFound} />
      </Switch>
      {isAuthenticated && <BottomNavigation />}
    </div>
  );
}

function AppContent() {
  return <RegularAppContent />;
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