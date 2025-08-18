import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import Calendar from "./pages/calendar";
import Alerts from "./pages/alerts";
import Settings from "./pages/settings";
import AdminPortal from "./pages/admin-simple";
import Signup from "./pages/signup";
import Login from "./pages/login";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useWebSocket } from "@/hooks/use-websocket";
import React, { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-chirp-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-chirp-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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

  useEffect(() => {
    if (lastMessage && isAuthenticated) {
      switch (lastMessage.type) {
        case 'new_alert':
          toast({
            title: "New Alert",
            description: (lastMessage.data as any).title,
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
  }, [lastMessage, toast, isAuthenticated]);

  return (
    <div className={isAuthenticated ? "max-w-md mx-auto bg-white min-h-screen relative" : "min-h-screen"}>
      <Switch>
        <Route path="/" component={() => <PublicRoute component={Landing} />} />
        <Route path="/login" component={() => <PublicRoute component={Login} />} />
        <Route path="/signup" component={() => <PublicRoute component={Signup} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Calendar} />} />
        <Route path="/alerts" component={() => <ProtectedRoute component={Alerts} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/advanced-settings" component={() => {
          const AdvancedSettings = React.lazy(() => import("./pages/advanced-settings"));
          return <ProtectedRoute component={() => <React.Suspense fallback={<div>Loading...</div>}><AdvancedSettings /></React.Suspense>} />;
        }} />
        <Route path="/admin" component={() => <ProtectedRoute component={AdminPortal} />} />
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
        <div className="bg-chirp-gray min-h-screen">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
